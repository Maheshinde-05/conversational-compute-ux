/*
 * Mock Scale agent. Reads one observation every decision tick and returns a
 * recommendation, or abstains. It is deliberately simple (linear forecast
 * plus rules) so the eval harness has something real to measure; the real
 * agent would replace `step` and keep the same output contract.
 */
import { CCU_PER_INSTANCE, PRICE_PER_INSTANCE_HR, PROVISIONING_LAG_MIN, type Guardrails } from '../data/scale-mock';

export interface Observation {
  t: number;
  ccu: number | null; // null when the metrics feed is down
  queueP95: number | null;
  telemetryAgeMin: number;
  loadPerSession: number | null; // 1 = baseline CPU/RAM per session
  buildVersion: string;
  instances: number;
  pendingInstances: number;
  expectedCcu: number | null; // plan curve; null = no baseline yet
  preferredTypeAvailable: boolean;
  budgetPerHr: number;
}

export interface Claims {
  breachInMin: number | null; // minutes until queue p95 passes target with no action
  costDeltaPerHr: number;
  leadTimeMin: number;
  peakWaiting: number; // players waiting at peak in the next 30 min with no action
  /** Range from a linear and a curved fit; shown instead of the point estimate until accuracy passes. */
  peakWaitingRange: [number, number];
}

export type AgentOutput =
  | { kind: 'none'; divergence: boolean }
  | { kind: 'scale'; direction: 'up' | 'down'; instances: number; claims: Claims; confidence: number; evidence: string[]; missing: string[]; divergence: boolean }
  | { kind: 'abstain'; reason: 'insufficient_data' | 'stale_telemetry'; waitingFor: string }
  | { kind: 'investigate'; reason: 'conflicting_signals' | 'build_regression'; detail: string; confidence: number }
  | { kind: 'tradeoff'; reason: 'impossible_constraint' | 'capacity_unavailable'; detail: string; options: TradeoffOption[]; claims: Claims; confidence: number };

export interface TradeoffOption { id: 'raise_cap' | 'within_cap' | 'accept_queues' | 'wait' | 'alt_type'; label: string; instances: number }

export type AgentKind = AgentOutput['kind'];

export const AGENT_VERSION = '0.2';
const HORIZON = PROVISIONING_LAG_MIN + 10;
/** Damped trend: launches follow S-curves, so a straight line over-extrapolates. */
const damped = (slope: number, m: number) => (slope * m) / (1 + m / 30);
export const CLAIM_HORIZON = 30;

/** Least-squares quadratic y = a + b·x + c·x² (x relative to now), for accelerating traffic. */
function fitQuadratic(points: { t: number; y: number }[], now: number) {
  const n = points.length;
  if (n < 5) return null;
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, y0 = 0, y1 = 0, y2 = 0;
  for (const p of points) {
    const x = p.t - now;
    s0 += 1; s1 += x; s2 += x * x; s3 += x ** 3; s4 += x ** 4; y0 += p.y; y1 += x * p.y; y2 += x * x * p.y;
  }
  const det = s0 * (s2 * s4 - s3 * s3) - s1 * (s1 * s4 - s3 * s2) + s2 * (s1 * s3 - s2 * s2);
  if (Math.abs(det) < 1e-9) return null;
  const a = (y0 * (s2 * s4 - s3 * s3) - s1 * (y1 * s4 - s3 * y2) + s2 * (y1 * s3 - s2 * y2)) / det;
  const b = (s0 * (y1 * s4 - y2 * s3) - y0 * (s1 * s4 - s3 * s2) + s2 * (s1 * y2 - y1 * s2)) / det;
  const c = (s0 * (s2 * y2 - s3 * y1) - s1 * (s1 * y2 - s3 * y0) + y0 * (s1 * s3 - s2 * s2)) / det;
  return (m: number) => a + b * m + c * m * m;
}

function fit(points: { t: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return { slope: 0, r2: 0 };
  const mx = points.reduce((a, p) => a + p.t, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of points) { sxy += (p.t - mx) * (p.y - my); sxx += (p.t - mx) ** 2; syy += (p.y - my) ** 2; }
  const slope = sxx ? sxy / sxx : 0;
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 1;
  return { slope, r2 };
}

export function createAgent(g: Guardrails) {
  const history: Observation[] = [];
  let lastUpAt = -Infinity;
  let lastDownAt = -Infinity;
  let highHeadroomTicks = 0;
  let buildFlaggedFor: string | null = null;
  const baselineLoad: Record<string, number> = {};
  const target = (g.headroomMinPct + g.headroomMaxPct) / 2 / 100;

  return function step(o: Observation): AgentOutput {
    history.push(o);
    const onCycle = o.t % 5 === 0;
    const back3 = history.find((h) => h.t === o.t - 3);
    const surging = o.ccu != null && back3?.ccu != null && back3.ccu > 0 && (o.ccu - back3.ccu) / back3.ccu > 0.15;
    if (!onCycle && !surging) return { kind: 'none', divergence: false };
    if (o.telemetryAgeMin > 3 || o.ccu == null)
      return { kind: 'abstain', reason: 'stale_telemetry', waitingFor: `Metrics feed (last sample ${o.telemetryAgeMin} min ago)` };
    if (o.expectedCcu == null)
      return { kind: 'abstain', reason: 'insufficient_data', waitingFor: '30 minutes of launch traffic to set a baseline' };

    const fresh = history.filter((h) => h.ccu != null && h.t > o.t - 15 && h.telemetryAgeMin <= 1).map((h) => ({ t: h.t, y: h.ccu! }));
    const long = fit(fresh);
    const short = fit(fresh.filter((p) => p.t > o.t - 5));
    const accelerating = fresh.length >= 3 && short.slope > long.slope * 1.5 && short.slope > 0;
    const { slope, r2 } = accelerating ? { slope: short.slope, r2: Math.min(long.r2, short.r2) } : long;
    const ccu = o.ccu;
    const load = o.loadPerSession ?? 1;
    const cpi = CCU_PER_INSTANCE / load;
    const capacityNow = o.instances * cpi;
    const divergence = o.t >= 15 && (ccu / o.expectedCcu > 2 || ccu / o.expectedCcu < 0.5);

    // Bad build: per-session load jumped right after a version change.
    if (!(o.buildVersion in baselineLoad)) baselineLoad[o.buildVersion] = load;
    const versions = Object.keys(baselineLoad);
    if (versions.length > 1 && buildFlaggedFor !== o.buildVersion) {
      const prev = baselineLoad[versions[versions.length - 2]];
      if (load > prev * 1.25) {
        buildFlaggedFor = o.buildVersion;
        return { kind: 'investigate', reason: 'build_regression', detail: `CPU/RAM per session rose ${Math.round((load / prev - 1) * 100)}% after build ${o.buildVersion}. Roll back the build before adding compute.`, confidence: 0.85 };
      }
    }

    // Conflicting signals: traffic falling but queue rising with spare capacity.
    const prev5 = history.find((h) => h.t === o.t - 5);
    const queueOdd = o.queueP95 != null && o.queueP95 > g.maxQueueWaitSec * 0.4 && (o.queueP95 > g.maxQueueWaitSec || (prev5?.queueP95 != null && o.queueP95 > prev5.queueP95));
    if (slope <= 0.001 * ccu && queueOdd && capacityNow > ccu * 1.1)
      return { kind: 'investigate', reason: 'conflicting_signals', detail: 'Traffic is falling but queue wait is rising with spare capacity. Likely a server or matchmaking issue, not capacity. Not scaling.', confidence: 0.7 };

    const predicted = Math.max(ccu, ccu + damped(slope, HORIZON));
    const desired = Math.ceil((predicted * (1 + target)) / cpi);
    const have = o.instances + o.pendingInstances;

    // Claims, computed the same way for every scale-up style output.
    const claims = (delta: number): Claims => {
      let breach: number | null = null;
      let peak = 0;
      const quad = fitQuadratic(fresh, o.t);
      let peakQuad = 0;
      let peakDamped = 0;
      // "If we do nothing": plain near-term trend over a stated 30-minute horizon.
      for (let m = 0; m <= CLAIM_HORIZON; m++) {
        const d = ccu + slope * m;
        const cap = (m >= PROVISIONING_LAG_MIN ? have : o.instances) * cpi;
        if (breach === null && d > cap * 1.023) breach = m;
        peak = Math.max(peak, d - cap);
        if (quad) peakQuad = Math.max(peakQuad, Math.max(ccu, quad(m)) - cap);
        peakDamped = Math.max(peakDamped, ccu + damped(slope, m) - cap);
      }
      const ests = [peak, quad ? peakQuad : peak].map((v) => Math.max(0, Math.round(v)));
      void peakDamped;
      return { breachInMin: breach, costDeltaPerHr: Math.round(delta * PRICE_PER_INSTANCE_HR), leadTimeMin: PROVISIONING_LAG_MIN, peakWaiting: ests[0], peakWaitingRange: [Math.min(...ests), Math.max(...ests)] };
    };

    let confidence = 0.92;
    if (fresh.length < 10) confidence -= 0.15;
    if (r2 < 0.8) confidence -= (0.8 - r2) * 0.6;
    if (ccu > 0 && slope / ccu > 0.03) confidence -= 0.1;
    confidence = Math.max(0.35, Math.min(0.95, confidence));

    const delta = desired - have;
    if (delta >= Math.max(4, 0.03 * have)) {
      const after = (o.instances + o.pendingInstances + delta) * PRICE_PER_INSTANCE_HR;
      if (!o.preferredTypeAvailable)
        return { kind: 'tradeoff', reason: 'capacity_unavailable', detail: 'Preferred instance type is unavailable. Waiting risks queues; an alternate type costs ~8% more.', claims: claims(delta), confidence: confidence - 0.1,
          options: [{ id: 'alt_type', label: 'Use an alternate instance type', instances: delta }, { id: 'wait', label: 'Wait for capacity', instances: 0 }] };
      if (after > o.budgetPerHr) {
        const within = Math.max(0, Math.floor(o.budgetPerHr / PRICE_PER_INSTANCE_HR) - have);
        return { kind: 'tradeoff', reason: 'impossible_constraint', detail: `Holding the ${g.maxQueueWaitSec} s queue target needs ~$${Math.round(after)}/hr, above the $${o.budgetPerHr}/hr budget.`, claims: claims(delta), confidence,
          options: [{ id: 'raise_cap', label: 'Raise the budget for this launch window', instances: delta }, { id: 'within_cap', label: 'Add only what fits the budget', instances: within }, { id: 'accept_queues', label: 'Accept queues', instances: 0 }] };
      }
      highHeadroomTicks = 0;
      lastUpAt = o.t;
      return { kind: 'scale', direction: 'up', instances: delta, claims: claims(delta), confidence, divergence,
        evidence: [`CCU ${Math.round(ccu)}`, `trend ${slope >= 0 ? '+' : ''}${Math.round(slope)}/min`, `forecast ${Math.round(predicted)} in ${HORIZON} min`], missing: [] };
    }

    // Scale down only after sustained excess headroom and a falling or flat trend (anti-flapping).
    const headroom = capacityNow > 0 ? (capacityNow - ccu) / capacityNow : 0;
    highHeadroomTicks = headroom > g.headroomMaxPct / 100 + 0.05 && slope <= 0.001 * ccu ? highHeadroomTicks + 1 : 0;
    if (highHeadroomTicks >= 3 && o.t - lastUpAt >= 20 && o.t - lastDownAt >= 15 && o.pendingInstances === 0) {
      const recentPeak = Math.max(ccu, ...history.filter((h) => h.ccu != null && h.t > o.t - 30).map((h) => h.ccu!));
      const keep = Math.ceil((recentPeak * (1 + target)) / cpi);
      const remove = o.instances - keep;
      if (remove >= Math.max(4, 0.05 * o.instances)) {
        highHeadroomTicks = 0;
        lastDownAt = o.t;
        return { kind: 'scale', direction: 'down', instances: remove, confidence: Math.max(0.35, confidence - 0.05), divergence,
          claims: { breachInMin: null, costDeltaPerHr: -remove * PRICE_PER_INSTANCE_HR, leadTimeMin: 0, peakWaiting: 0, peakWaitingRange: [0, 0] },
          evidence: [`headroom ${Math.round(headroom * 100)}% for 15 min`, `trend ${Math.round(slope)}/min`], missing: [] };
      }
    }
    return { kind: 'none', divergence };
  };
}
