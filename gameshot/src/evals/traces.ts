/*
 * Golden traces: deterministic launch traffic fixtures for the eval harness.
 * Same inputs every run, so results are comparable across agent changes.
 */
import type { Guardrails } from '../data/scale-mock';
import type { AgentKind } from '../logic/scaleAgent';
import { SCENARIOS, interp, planCurve } from '../logic/scaleSim';

export type TraceGroup = 'scenario' | 'realistic' | 'abstention' | 'redteam';

export interface EvalTrace {
  id: string;
  group: TraceGroup;
  name: string;
  description: string;
  durationMin: number;
  demand: (m: number) => number;
  expected: (m: number) => number;
  load?: (m: number) => number;
  version?: (m: number) => string;
  telemetryGaps?: [number, number][];
  /** Extra queue wait from a non-capacity problem (server or matchmaking issue). */
  queueAnomaly?: { from: number; to: number; sec: (m: number) => number };
  typeUnavailableFrom?: number;
  efficiency?: (m: number) => number; // <1 when traffic lands where capacity isn't
  leadTimeMin?: (m: number) => number;
  operatorDelayMin: number | null; // null = nobody online
  noBaselineUntil?: number;
  guardrails?: Partial<Guardrails>;
  warmInstances: number;
  /** Share of busy instances that host long sessions (can't be drained). */
  longSessionShare?: number;
  /** Where the correct behavior is to not recommend a normal scale action. */
  abstainWindows?: { from: number; to: number; kinds: AgentKind[]; reason: string }[];
}

/** Deterministic noise: mulberry32 seeded per trace. */
function noise(seed: number, amp: number) {
  return (m: number) => {
    let t = (seed + Math.floor(m) * 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return 1 + (r - 0.5) * 2 * amp;
  };
}

const sc = (id: string) => SCENARIOS.find((s) => s.id === id)!;
const plan30k = (m: number) => planCurve({ peakCcu: 30000, hoursToPeak: 6, curveSource: 'manual' }, m);
const viral = sc('viral').demand;

export const TRACES: EvalTrace[] = [
  // ---- the five simulation scenarios ----
  { id: 'sc-expected', group: 'scenario', name: 'Expected launch', description: '1k → 30k over 6 h', durationMin: 360, demand: sc('expected').demand, expected: plan30k, operatorDelayMin: 8, warmInstances: 32 },
  { id: 'sc-viral', group: 'scenario', name: 'Viral spike', description: '1k → 100k in 3 h', durationMin: 360, demand: viral, expected: plan30k, operatorDelayMin: 8, warmInstances: 32 },
  { id: 'sc-regional', group: 'scenario', name: 'Regional surge', description: '70% of traffic lands in NA-East; 15% of capacity is in the wrong place',
    durationMin: 360, demand: sc('regional').demand, expected: plan30k, efficiency: (m) => (m > 60 ? 0.85 : 1), operatorDelayMin: 8, warmInstances: 32 },
  { id: 'sc-heavy', group: 'scenario', name: 'Heavier build', description: '+30% CPU/RAM per session from launch', durationMin: 360, demand: sc('expected').demand, expected: plan30k, load: () => 1.3, operatorDelayMin: 8, warmInstances: 32 },
  { id: 'sc-constraint', group: 'scenario', name: 'Capacity constraint', description: 'Preferred type unavailable from T+2h', durationMin: 360, demand: sc('constraint').demand, expected: plan30k, typeUnavailableFrom: 120, operatorDelayMin: 8, warmInstances: 32 },

  // ---- realistic traces with noise, flat periods and double peaks ----
  { id: 'rl-noisy', group: 'realistic', name: 'Noisy viral with a plateau', description: 'Viral ramp ±6% noise, 40-min plateau at T+2h', durationMin: 360,
    demand: (m) => (m > 120 && m < 160 ? viral(120) : viral(m > 160 ? m - 40 : m)) * noise(7, 0.06)(m), expected: plan30k, operatorDelayMin: 8, warmInstances: 32 },
  { id: 'rl-double', group: 'realistic', name: 'Double peak', description: 'Launch peak at T+1h30m, streamer-driven second peak at T+4h', durationMin: 360,
    demand: (m) => interp([[0, 1000], [60, 25000], [90, 40000], [150, 22000], [210, 20000], [240, 52000], [300, 30000], [360, 24000]], m) * noise(11, 0.04)(m), expected: plan30k, operatorDelayMin: 8, warmInstances: 32, longSessionShare: 0.5 },

  // ---- abstention traces ----
  { id: 'ab-nodata', group: 'abstention', name: 'Insufficient data', description: 'Brand-new title, no plan baseline for the first 30 min', durationMin: 120,
    demand: (m) => interp([[0, 800], [30, 2600], [120, 9000]], m), expected: (m) => interp([[0, 800], [120, 9000]], m), noBaselineUntil: 30, operatorDelayMin: 8, warmInstances: 32,
    abstainWindows: [{ from: 0, to: 29, kinds: ['abstain'], reason: 'No baseline yet' }] },
  { id: 'ab-conflict', group: 'abstention', name: 'Conflicting signals', description: 'Traffic falling but queue rising: a matchmaking bug, not capacity', durationMin: 150,
    demand: (m) => interp([[0, 2000], [50, 20000], [70, 20000], [150, 12000]], m), expected: (m) => interp([[0, 2000], [60, 20000], [150, 15000]], m),
    queueAnomaly: { from: 80, to: 130, sec: (m) => Math.min(160, (m - 80) * 4) }, operatorDelayMin: 8, warmInstances: 32,
    abstainWindows: [{ from: 90, to: 130, kinds: ['investigate'], reason: 'Queue rise is not a capacity problem' }] },
  { id: 'ab-impossible', group: 'abstention', name: 'Impossible constraints', description: 'Queue target needs more than the $300/hr cap; nobody online', durationMin: 240,
    demand: (m) => interp([[0, 1000], [90, 40000], [180, 60000], [240, 55000]], m), expected: plan30k, guardrails: { maxHourlySpend: 300 }, operatorDelayMin: null, warmInstances: 32,
    abstainWindows: [{ from: 80, to: 240, kinds: ['tradeoff'], reason: 'Target unreachable within the cap' }] },
  { id: 'ab-nocapacity', group: 'abstention', name: 'Capacity unavailable', description: 'Preferred instance type exhausted at T+1h30m mid-spike', durationMin: 240,
    demand: viral, expected: plan30k, typeUnavailableFrom: 90, operatorDelayMin: 8, warmInstances: 32,
    abstainWindows: [{ from: 90, to: 98, kinds: ['tradeoff'], reason: 'Must present wait / alternate type' }] },

  // ---- red-team traces ----
  { id: 'rt-flash', group: 'redteam', name: 'Flash spike', description: '10× traffic in 15 min; provisioning slows to 9 min', durationMin: 120,
    demand: (m) => interp([[0, 5000], [30, 5000], [45, 50000], [120, 48000]], m), expected: (m) => interp([[0, 5000], [120, 8000]], m), leadTimeMin: (m) => (m >= 30 ? 9 : 6), operatorDelayMin: 4, warmInstances: 50 },
  { id: 'rt-sine', group: 'redteam', name: 'Oscillating traffic', description: 'Sine-wave demand, 20k ± 10k every 30 min, for 2 h', durationMin: 120,
    demand: (m) => 20000 + 10000 * Math.sin((2 * Math.PI * m) / 30), expected: () => 20000, operatorDelayMin: 8, warmInstances: 230 },
  { id: 'rt-outage', group: 'redteam', name: 'Telemetry outage', description: 'Metrics feed dies T+1h20m – T+1h35m mid-spike', durationMin: 240,
    demand: viral, expected: plan30k, telemetryGaps: [[80, 95]], operatorDelayMin: 8, warmInstances: 32 },
  { id: 'rt-lying', group: 'redteam', name: 'Lying forecast', description: 'Plan expects 10× the real traffic', durationMin: 240,
    demand: (m) => planCurve({ peakCcu: 10000, hoursToPeak: 3, curveSource: 'manual' }, m), expected: (m) => planCurve({ peakCcu: 100000, hoursToPeak: 3, curveSource: 'manual' }, m), operatorDelayMin: 8, warmInstances: 32 },
  { id: 'rt-badbuild', group: 'redteam', name: 'Bad build', description: 'Build 1.1.0 at T+1h adds +40% CPU/RAM per session', durationMin: 180,
    demand: (m) => interp([[0, 15000], [30, 20000], [180, 20000]], m), expected: (m) => interp([[0, 15000], [30, 20000], [180, 20000]], m),
    version: (m) => (m >= 60 ? '1.1.0' : '1.0.0'), load: (m) => (m >= 60 ? 1.4 : 1), operatorDelayMin: 8, warmInstances: 180 },
  { id: 'rt-midnight', group: 'redteam', name: 'Midnight spike', description: 'Viral spike with no operator online', durationMin: 360,
    demand: viral, expected: plan30k, operatorDelayMin: null, warmInstances: 32 },
  { id: 'rt-guardrails', group: 'redteam', name: 'Conflicting guardrails', description: 'Queue target unreachable within a $250/hr cap', durationMin: 240,
    demand: (m) => interp([[0, 1000], [90, 35000], [180, 50000], [240, 48000]], m), expected: plan30k, guardrails: { maxHourlySpend: 250 }, operatorDelayMin: 8, warmInstances: 32 },
];
