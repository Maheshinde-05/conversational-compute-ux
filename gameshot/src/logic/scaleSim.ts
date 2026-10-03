/*
 * Scale Control logic: curve helpers, plan validation and a simple
 * capacity simulator. Deterministic and side-effect free, so the
 * same functions can run server-side for the real product.
 */
import {
  AI_CURVE, CCU_PER_INSTANCE, PRICE_PER_INSTANCE_HR, PROVISIONING_LAG_MIN,
  type Guardrails, type PhaseConfig, type RegionId,
} from '../data/scale-mock';

/* ---------- formatting ---------- */
export function fmtT(min: number): string {
  if (min === 0) return 'T+0';
  const sign = min < 0 ? '−' : '+';
  const a = Math.abs(Math.round(min));
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `T${sign}${h ? `${h}h` : ''}${m || !h ? `${m}m` : ''}`;
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');
export const fmtCompact = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);
export const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** Linear interpolation over [x, y] keypoints. */
export function interp(keys: [number, number][], x: number): number {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [x1, y1] = keys[i];
    if (x <= x1) {
      const [x0, y0] = keys[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return keys[keys.length - 1][1];
}

export const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

/* ---------- plan curves ---------- */
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Expected CCU at `min` minutes after launch for a phase config. */
export function planCurve(c: Pick<PhaseConfig, 'peakCcu' | 'hoursToPeak' | 'curveSource'>, min: number, start = 1000): number {
  if (min < 0) return Math.max(600, start * (1 + min / 120));
  const h = min / 60;
  if (h <= c.hoursToPeak) return start + (c.peakCcu - start) * smooth(h / c.hoursToPeak);
  // after the peak: manual plans hold; AI curves decline like the comparable launches
  return c.curveSource === 'ai' ? c.peakCcu * Math.max(0.7, 1 - 0.06 * (h - c.hoursToPeak)) : c.peakCcu;
}

export const aiCurveConfig = { peakCcu: AI_CURVE.peakCcu, hoursToPeak: AI_CURVE.hoursToPeak, curveSource: 'ai' as const };

export const costPerHourFor = (ccu: number, headroomPct: number) =>
  (Math.ceil((ccu * (1 + headroomPct / 100)) / CCU_PER_INSTANCE) * PRICE_PER_INSTANCE_HR);

/* ---------- plan validation ---------- */
export interface PlanIssue { level: 'error' | 'warning'; message: string; fix?: string }

export function validatePlan(c: PhaseConfig, g: Guardrails): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const mix = c.instanceMix.reduce((s, x) => s + x.share, 0);
  const reg = c.regions.reduce((s, x) => s + x.weight, 0);
  if (mix !== 100) issues.push({ level: 'error', message: `Instance mix adds up to ${mix}%, not 100%.` });
  if (reg !== 100) issues.push({ level: 'error', message: `Region weights add up to ${reg}%, not 100%.` });

  if (c.budgetPerHour > g.maxHourlySpend)
    issues.push({ level: 'error', message: `Phase budget ${fmtUsd(c.budgetPerHour)}/hr is above your guardrail of ${fmtUsd(g.maxHourlySpend)}/hr.`, fix: 'Lower the budget, or raise max hourly spend in Guardrails.' });

  // first hour where projected spend exceeds the budget
  for (let min = 0; min <= 360; min += 15) {
    const cost = costPerHourFor(planCurve(c, min), c.headroomPct);
    if (cost > c.budgetPerHour) {
      issues.push({
        level: 'error',
        message: `This plan exceeds its ${fmtUsd(c.budgetPerHour)}/hr budget at ${fmtT(min)} (projected ${fmtUsd(cost)}/hr).`,
        fix: 'Raise the budget, lower the headroom target, or reshape the curve.',
      });
      break;
    }
  }

  if (c.headroomPct < g.headroomMinPct || c.headroomPct > g.headroomMaxPct)
    issues.push({ level: 'warning', message: `Headroom ${c.headroomPct}% is outside your ${g.headroomMinPct}–${g.headroomMaxPct}% target.` });

  // can the ramp keep up with the steepest part of the curve?
  let steepest = 0;
  let at = 0;
  for (let min = 0; min < 360; min += 5) {
    const d = planCurve(c, min + 5) - planCurve(c, min);
    if (d > steepest) { steepest = d; at = min; }
  }
  const rampCcu = c.rampStepInstances * CCU_PER_INSTANCE;
  if (steepest * (1 + c.headroomPct / 100) > rampCcu)
    issues.push({ level: 'warning', message: `At ${fmtT(at)} the curve needs ${fmtInt(steepest * (1 + c.headroomPct / 100))} CCU of new capacity per 5 min (with headroom), but the ramp adds at most ${fmtInt(rampCcu)}.`, fix: `Raise the ramp step to at least ${Math.ceil((steepest * (1 + c.headroomPct / 100)) / CCU_PER_INSTANCE)} instances.` });

  const warm = c.warmBufferInstances * CCU_PER_INSTANCE;
  if (warm < planCurve(c, 0) * (1 + c.headroomPct / 100))
    issues.push({ level: 'warning', message: `The warm buffer (${fmtInt(warm)} CCU) is below launch-minute demand plus headroom.` });

  return issues;
}

/* ---------- simulation ---------- */
export interface Scenario {
  id: string;
  name: string;
  tests: string;
  demand: (min: number) => number;
  regionShare: Record<RegionId, number>;
  loadFactor: number; // >1 = heavier sessions
  constraint?: { region: RegionId; fromMin: number };
}

const viralKeys: [number, number][] = [[0, 1000], [45, 8000], [90, 30000], [120, 55000], [150, 80000], [180, 100000], [240, 97000], [360, 84000]];

export const SCENARIOS: Scenario[] = [
  { id: 'expected', name: 'Expected launch', tests: '1k → 30k over 6 hours. Does the plan hold comfortably?',
    demand: (m) => planCurve({ peakCcu: 30000, hoursToPeak: 6, curveSource: 'manual' }, m), regionShare: { 'us-east-1': 0.55, 'eu-west-1': 0.3, 'ap-northeast-1': 0.15 }, loadFactor: 1 },
  { id: 'viral', name: 'Viral spike', tests: '1k → 100k in 3 hours. Where does queue wait break the target, and when?',
    demand: (m) => interp(viralKeys, m), regionShare: { 'us-east-1': 0.55, 'eu-west-1': 0.3, 'ap-northeast-1': 0.15 }, loadFactor: 1 },
  { id: 'regional', name: 'Regional surge', tests: '70% of traffic lands in NA-East. Does the region mix survive?',
    demand: (m) => planCurve({ peakCcu: 55000, hoursToPeak: 4, curveSource: 'manual' }, m), regionShare: { 'us-east-1': 0.7, 'eu-west-1': 0.2, 'ap-northeast-1': 0.1 }, loadFactor: 1 },
  { id: 'heavy', name: 'Heavier build', tests: '+30% CPU and RAM per session. Does the instance mix still hold headroom?',
    demand: (m) => planCurve({ peakCcu: 30000, hoursToPeak: 6, curveSource: 'manual' }, m), regionShare: { 'us-east-1': 0.55, 'eu-west-1': 0.3, 'ap-northeast-1': 0.15 }, loadFactor: 1.3 },
  { id: 'constraint', name: 'Capacity constraint', tests: 'Preferred instance type unavailable in eu-west mid-spike. What’s the fallback?',
    demand: (m) => interp([[0, 1000], [60, 18000], [120, 48000], [180, 60000], [360, 55000]], m), regionShare: { 'us-east-1': 0.55, 'eu-west-1': 0.3, 'ap-northeast-1': 0.15 }, loadFactor: 1, constraint: { region: 'eu-west-1', fromMin: 120 } },
];

export interface SimPoint { t: number; demand: number; capacity: number; queueP95: number; waiting: number; headroomPct: number; costPerHour: number }

export interface SimResult {
  points: SimPoint[];
  approvalNeededAt: number | null; // first moment caps block a needed scale-up
  humanActsAt: number | null;
  breaches: [number, number][]; // intervals where queue p95 > target
  peakQueue: number;
  peakWaiting: number;
  totalCost: number;
  avgHeadroom: number;
  risk: 'low' | 'medium' | 'high';
}

/**
 * Simulates 0–6 h in 5-minute steps. The autoscaler orders capacity for
 * demand + headroom one lag ahead, limited by the ramp step, the per-action
 * and per-hour auto caps and the hourly budget. Beyond those caps it waits
 * for a person, who responds `responseMin` minutes later (null = nobody).
 */
export function simulate(s: Scenario, plan: PhaseConfig, g: Guardrails, responseMin: number | null): SimResult {
  const STEP = 5;
  const cpi = CCU_PER_INSTANCE / s.loadFactor;
  const weights = Object.fromEntries(plan.regions.map((r) => [r.id, r.weight / 100])) as Record<RegionId, number>;
  const inst: Record<RegionId, number> = { 'us-east-1': 0, 'eu-west-1': 0, 'ap-northeast-1': 0 };
  for (const r of plan.regions) inst[r.id] = Math.round(plan.warmBufferInstances * weights[r.id]);
  let orders: { at: number; region: RegionId; n: number }[] = [];
  const autoLog: { t: number; usd: number }[] = [];
  let approvalNeededAt: number | null = null;
  let humanActsAt: number | null = null;
  let bursted = false;
  const points: SimPoint[] = [];

  for (let t = 0; t <= 360; t += STEP) {
    // deliveries
    orders = orders.filter((o) => (o.at <= t ? ((inst[o.region] += o.n), false) : true));
    const unlocked = humanActsAt !== null && t >= humanActsAt;
    const budget = unlocked ? g.maxHourlySpend * 1.8 : g.maxHourlySpend;
    const total = () => Object.values(inst).reduce((a, b) => a + b, 0) + orders.reduce((a, o) => a + o.n, 0);

    // ordering
    const ahead = s.demand(t + PROVISIONING_LAG_MIN + STEP);
    // a person's approval releases one burst that isn't limited by the ramp step
    const burst = unlocked && !bursted;
    if (burst) bursted = true;
    let stepBudget = burst ? Infinity : plan.rampStepInstances;
    for (const r of plan.regions) {
      const blocked = s.constraint && r.id === s.constraint.region && t >= s.constraint.fromMin && !unlocked;
      const desired = Math.ceil((ahead * s.regionShare[r.id] * (1 + plan.headroomPct / 100)) / cpi);
      const have = inst[r.id] + orders.filter((o) => o.region === r.id).reduce((a, o) => a + o.n, 0);
      let need = Math.min(desired - have, stepBudget);
      if (need <= 0) continue;
      if (blocked) {
        if (approvalNeededAt === null) approvalNeededAt = t;
        continue;
      }
      if (!unlocked) {
        const hourUsd = autoLog.filter((a) => a.t > t - 60).reduce((a, x) => a + x.usd, 0);
        const perAction = Math.floor(g.maxAutoPerAction / PRICE_PER_INSTANCE_HR);
        const perHourLeft = Math.floor((g.maxAutoPerHour - hourUsd) / PRICE_PER_INSTANCE_HR);
        const budgetLeft = Math.floor((budget - total() * PRICE_PER_INSTANCE_HR) / PRICE_PER_INSTANCE_HR);
        // each region may spend up to its weight's share of the budget, plus 10% slack
        const regionLeft = Math.floor((budget * Math.min(1, weights[r.id] * 1.1)) / PRICE_PER_INSTANCE_HR) - have;
        const allowed = Math.max(0, Math.min(need, perAction, perHourLeft, budgetLeft, regionLeft));
        if (allowed < need && approvalNeededAt === null) approvalNeededAt = t;
        need = allowed;
        if (need > 0) autoLog.push({ t, usd: need * PRICE_PER_INSTANCE_HR });
      }
      if (need > 0) {
        orders.push({ at: t + PROVISIONING_LAG_MIN, region: r.id, n: need });
        stepBudget -= need;
      }
    }
    if (approvalNeededAt !== null && humanActsAt === null && responseMin !== null) humanActsAt = approvalNeededAt + responseMin;

    // serve demand
    const d = s.demand(t);
    let served = 0;
    for (const r of plan.regions) served += Math.min(d * s.regionShare[r.id], inst[r.id] * cpi);
    const capacity = Object.values(inst).reduce((a, b) => a + b, 0) * cpi;
    const waiting = Math.max(0, d - served);
    const headroomPct = capacity > 0 ? Math.max(0, ((capacity - d) / capacity) * 100) : 0;
    const queueP95 = waiting > 0 ? Math.min(600, 30 + 2600 * (waiting / d)) : 4 + Math.max(0, 10 - headroomPct) * 3;
    points.push({ t, demand: d, capacity, queueP95, waiting, headroomPct, costPerHour: Object.values(inst).reduce((a, b) => a + b, 0) * PRICE_PER_INSTANCE_HR });
  }

  const breaches: [number, number][] = [];
  let start: number | null = null;
  points.forEach((p, i) => {
    const over = p.queueP95 > g.maxQueueWaitSec;
    if (over && start === null) start = p.t;
    if ((!over || i === points.length - 1) && start !== null) { breaches.push([start, over ? p.t : points[i - 1].t]); start = null; }
  });
  const minutesOver = breaches.reduce((a, [x, y]) => a + (y - x + STEP), 0);

  return {
    points,
    approvalNeededAt,
    humanActsAt,
    breaches,
    peakQueue: Math.max(...points.map((p) => p.queueP95)),
    peakWaiting: Math.max(...points.map((p) => p.waiting)),
    totalCost: points.reduce((a, p) => a + (p.costPerHour * STEP) / 60, 0),
    avgHeadroom: points.reduce((a, p) => a + p.headroomPct, 0) / points.length,
    risk: minutesOver === 0 ? 'low' : minutesOver <= 15 ? 'medium' : 'high',
  };
}

/** Longest a person can take to respond without a queue-target breach (null if even instant fails). */
export function latestUsefulResponse(s: Scenario, plan: PhaseConfig, g: Guardrails): number | null {
  if (simulate(s, plan, g, 0).breaches.length) return null;
  let ok = 0;
  for (let m = 5; m <= 120; m += 5) {
    if (simulate(s, plan, g, m).breaches.length) break;
    ok = m;
  }
  return ok;
}
