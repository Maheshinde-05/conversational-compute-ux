/*
 * Scale Control sample data: the 1k → 100k launch-day scenario.
 * Endpoints (see docs/scale spec §8):
 *   GET /builds/:id/scale/plans, /live, /recommendations, /guardrails, /audit
 *   POST /builds/:id/scale/simulate
 */

/* ---------- economics (sample numbers) ---------- */
export const CCU_PER_INSTANCE = 150;
export const PRICE_PER_INSTANCE_HR = 1.0; // USD, c6g.2xlarge sample price
export const PROVISIONING_LAG_MIN = 6;

export type RegionId = 'us-east-1' | 'eu-west-1' | 'ap-northeast-1';
export const REGIONS: RegionId[] = ['us-east-1', 'eu-west-1', 'ap-northeast-1'];

/* ---------- launch plan ---------- */
export type PhaseId = 'test' | 'closed_beta' | 'open_beta' | 'launch' | 'steady';

export interface PhaseConfig {
  peakCcu: number;
  hoursToPeak: number;
  instanceMix: { type: string; share: number }[];
  regions: { id: RegionId; weight: number }[];
  headroomPct: number;
  warmBufferInstances: number;
  rampStepInstances: number; // max instances added per 5 minutes
  budgetPerHour: number;
  curveSource: 'manual' | 'ai';
}

export interface Phase {
  id: PhaseId;
  name: string;
  window: string;
  config: PhaseConfig | null; // null = not configured yet
  summary: string;
}

export const PHASES: Phase[] = [
  { id: 'test', name: 'Test', window: 'Sep 8 – Sep 21', config: null, summary: 'Internal playtests, 1 region, ≤ 200 CCU' },
  { id: 'closed_beta', name: 'Closed beta', window: 'Sep 22 – Oct 5', config: null, summary: 'Invite-only, peaked at 4,100 CCU' },
  { id: 'open_beta', name: 'Open beta', window: 'Oct 9 – Oct 12', config: null, summary: 'Not configured yet' },
  {
    id: 'launch',
    name: 'Launch',
    window: 'Oct 16, 17:00 UTC → +24 h',
    summary: 'Expected 1k → 30k over 6 h',
    config: {
      peakCcu: 30000,
      hoursToPeak: 6,
      instanceMix: [
        { type: 'c6g.2xlarge', share: 70 },
        { type: 'c6i.2xlarge', share: 30 },
      ],
      regions: [
        { id: 'us-east-1', weight: 55 },
        { id: 'eu-west-1', weight: 30 },
        { id: 'ap-northeast-1', weight: 15 },
      ],
      headroomPct: 30,
      warmBufferInstances: 32,
      rampStepInstances: 40,
      budgetPerHour: 500,
      curveSource: 'manual',
    },
  },
  { id: 'steady', name: 'Steady state', window: 'From Oct 17', config: null, summary: 'Not configured yet' },
];

export interface PlanVersion {
  version: number;
  status: 'draft' | 'validated' | 'armed' | 'superseded';
  note: string;
  at: string;
}

export const PLAN_VERSIONS: PlanVersion[] = [
  { version: 3, status: 'armed', note: 'Raised warm buffer to 32 instances', at: 'Oct 2, 6:10 PM' },
  { version: 2, status: 'superseded', note: 'Added ap-northeast-1 at 15%', at: 'Sep 30, 11:02 AM' },
  { version: 1, status: 'superseded', note: 'First plan', at: 'Sep 24, 4:45 PM' },
];

/** AI-generated curve from comparable launches, with its evidence. */
export const AI_CURVE = {
  peakCcu: 96000,
  hoursToPeak: 2.5,
  summary: 'Battle-royale open-beta ramp: about 4× in the first 90 minutes, peak near T+2h30m, then a slow decline.',
  launches: [
    { name: 'Skyfall Royale · open beta (2025)', similarity: 92, note: 'Same genre and region mix; 4.1× in the first 90 min' },
    { name: 'Driftline · launch (2024)', similarity: 81, note: 'Similar marketing push; peak at T+2h10m' },
    { name: 'Hollow Peaks · open beta (2025)', similarity: 74, note: 'Smaller audience, same ramp shape' },
  ],
  missing: 'No comparable launch with a streamer-driven spike; viral cases may run higher.',
};

/* ---------- guardrails & delegation ---------- */
export interface Guardrails {
  maxQueueWaitSec: number;
  headroomMinPct: number;
  headroomMaxPct: number;
  maxHourlySpend: number;
  maxAutoPerAction: number;
  maxAutoPerHour: number;
  regionalLatencyMs: number;
  minRollbackPct: number; // system-managed
}

export const DEFAULT_GUARDRAILS: Guardrails = {
  maxQueueWaitSec: 90,
  headroomMinPct: 25,
  headroomMaxPct: 35,
  maxHourlySpend: 500,
  maxAutoPerAction: 50,
  maxAutoPerHour: 200,
  regionalLatencyMs: 80,
  minRollbackPct: 20,
};

export type DelegationTier = 'auto' | 'prepare' | 'human';

export interface ActionClass {
  id: string;
  label: string;
  detail: string;
  tier: DelegationTier;
  locked?: string; // reason it can't leave "human"
}

export const ACTION_CLASSES: ActionClass[] = [
  { id: 'scale_up_within', label: 'Scale up within caps', detail: 'Adds instances in existing regions, within per-action and per-hour caps', tier: 'auto' },
  { id: 'scale_down_hold', label: 'Scale down with safety hold', detail: 'Drains idle servers only; live sessions finish first', tier: 'auto' },
  { id: 'prewarm', label: 'Change pre-warm schedule', detail: 'Moves or resizes the warm buffer before a phase', tier: 'prepare' },
  { id: 'scale_up_beyond', label: 'Scale up beyond caps', detail: 'Any single action or hour above your auto-approval caps', tier: 'human', locked: 'Spending above your caps always needs a person' },
  { id: 'region_mix', label: 'Change region mix', detail: 'Adds a region or moves traffic weight between regions', tier: 'human', locked: 'Region changes affect player latency' },
  { id: 'instance_type', label: 'Switch instance type', detail: 'Uses a different instance family or size', tier: 'human', locked: 'Changes performance characteristics' },
  { id: 'incident', label: 'Anything during a declared incident', detail: 'All automation pauses while an incident is open', tier: 'human', locked: 'Incidents always return control to people' },
];

/* ---------- live launch replay ---------- */
export type LiveState = 'onplan' | 'diverging' | 'critical' | 'review';

export interface RegionRow { id: RegionId; ccu: number; headroomPct: number; latencyMs: number; queueDepth: number; note?: string }

export interface Moment {
  id: string;
  t: number; // minutes from launch
  label: string;
  state: LiveState;
  ccu: number;
  expectedCcu: number;
  queueP95Sec: number;
  playersWaiting: number;
  headroomPct: number;
  costPerHour: number;
  budgetPerHour: number;
  regions: RegionRow[];
  cardIds: string[];
}

/** Keypoints (minutes → CCU) for the replay chart. */
export const ACTUAL_KEYS: [number, number][] = [
  [-60, 900], [-30, 1500], [0, 3500], [15, 6500], [30, 11000], [45, 18000], [60, 30000], [75, 45000], [90, 61000],
  [105, 80000], [120, 100000], [150, 103000], [180, 99000], [240, 92000], [300, 84000], [360, 76000],
];
export const EXPECTED_KEYS: [number, number][] = [
  [-60, 900], [0, 3500], [45, 7500], [90, 12000], [120, 15000], [180, 20000], [240, 24500], [300, 28000], [360, 30000],
];
export const CAPACITY_KEYS: [number, number][] = [
  [-60, 4800], [0, 6000], [30, 12000], [45, 21000], [60, 34000], [75, 47000], [90, 62500], [105, 80000], [120, 97000],
  [135, 110000], [150, 122000], [180, 127000], [240, 128000], [300, 128000], [315, 110000], [360, 105000],
];
export const ACTION_MARKERS = [
  { t: 45, label: 'Auto +40' },
  { t: 95, label: 'Approved +128' },
  { t: 128, label: 'Fallback eu-west-2' },
  { t: 315, label: 'Scale-down −150' },
];

const regions = (rows: [number, number, number, number][], note?: Partial<Record<RegionId, string>>): RegionRow[] =>
  REGIONS.map((id, i) => ({ id, ccu: rows[i][0], headroomPct: rows[i][1], latencyMs: rows[i][2], queueDepth: rows[i][3], note: note?.[id] }));

export const MOMENTS: Moment[] = [
  { id: 'm-60', t: -60, label: 'T−60m', state: 'onplan', ccu: 900, expectedCcu: 900, queueP95Sec: 3, playersWaiting: 0, headroomPct: 81, costPerHour: 32, budgetPerHour: 500,
    regions: regions([[500, 82, 41, 0], [270, 80, 38, 0], [130, 79, 52, 0]]), cardIds: ['c-ready'] },
  { id: 'm0', t: 0, label: 'T+0', state: 'onplan', ccu: 3500, expectedCcu: 3500, queueP95Sec: 5, playersWaiting: 0, headroomPct: 42, costPerHour: 40, budgetPerHour: 500,
    regions: regions([[1950, 43, 44, 0], [1040, 41, 40, 0], [510, 40, 55, 0]]), cardIds: ['c-onplan'] },
  { id: 'm45', t: 45, label: 'T+45m', state: 'diverging', ccu: 18000, expectedCcu: 7500, queueP95Sec: 22, playersWaiting: 0, headroomPct: 14, costPerHour: 140, budgetPerHour: 500,
    regions: regions([[11200, 12, 52, 0], [5000, 16, 47, 0], [1800, 18, 58, 0]]), cardIds: ['c-auto45'] },
  { id: 'm90', t: 90, label: 'T+1h30m', state: 'critical', ccu: 61000, expectedCcu: 12000, queueP95Sec: 54, playersWaiting: 1400, headroomPct: 2, costPerHour: 417, budgetPerHour: 500,
    regions: regions([[37800, 1, 63, 860], [17100, 3, 58, 410], [6100, 4, 66, 130]]), cardIds: ['c-approve90'] },
  { id: 'm120', t: 120, label: 'T+2h', state: 'critical', ccu: 100000, expectedCcu: 15000, queueP95Sec: 78, playersWaiting: 3800, headroomPct: 3, costPerHour: 647, budgetPerHour: 900,
    regions: regions([[58000, 9, 61, 0], [30000, 0, 62, 3800], [12000, 8, 64, 0]], { 'eu-west-1': 'No c6g.2xlarge capacity' }), cardIds: ['c-conflict120'] },
  { id: 'm300', t: 300, label: 'T+5h', state: 'diverging', ccu: 84000, expectedCcu: 28000, queueP95Sec: 8, playersWaiting: 0, headroomPct: 34, costPerHour: 853, budgetPerHour: 900,
    regions: regions([[49000, 33, 47, 0], [24800, 35, 51, 0], [10200, 34, 57, 0]]), cardIds: ['c-down300'] },
  { id: 'm1440', t: 1440, label: 'T+24h', state: 'review', ccu: 30000, expectedCcu: 30000, queueP95Sec: 4, playersWaiting: 0, headroomPct: 30, costPerHour: 260, budgetPerHour: 500,
    regions: regions([[17000, 30, 45, 0], [9100, 31, 43, 0], [3900, 29, 54, 0]]), cardIds: ['c-review'] },
];

/* ---------- agentic cards ---------- */
export type CardKind = 'quiet' | 'auto_executed' | 'approval' | 'conflict' | 'auto_pending';

export interface CardOption {
  id: string;
  label: string;
  detail: string;
  tradeoffs: { label: string; value: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }[];
  note?: string;
}

export interface ScaleCard {
  id: string;
  kind: CardKind;
  title: string;
  whyNow: string;
  change?: { summary: string; diff: { region: RegionId | string; before: number; after: number }[] };
  ifNothing?: string;
  cost?: { perHour: string; window: string; budgetNote?: string };
  playerImpact?: string;
  confidence: { level: 'low' | 'medium' | 'high'; basis: string; signals: string[]; missing: string[] };
  route: { tier: DelegationTier; label: string; detail: string };
  rollback?: string;
  countdownMin?: number; // decision window for time-sensitive cards
  leadTime?: string;
  options?: CardOption[];
  primary?: string;
  secondary?: { label: string; consequence: string };
}

export const CARDS: Record<string, ScaleCard> = {
  'c-ready': {
    id: 'c-ready', kind: 'quiet', title: 'Ready for launch',
    whyNow: 'Pre-warm finished at T−24h: 32 instances across 3 regions. Headroom 81%, all regions healthy.',
    confidence: { level: 'high', basis: 'All telemetry is current.', signals: ['Live traffic', 'vCPU / RAM', 'Queue depth', 'Regional demand'], missing: [] },
    route: { tier: 'auto', label: 'No action needed', detail: 'Plan v3 is armed. The agent will act within your guardrails.' },
  },
  'c-onplan': {
    id: 'c-onplan', kind: 'quiet', title: 'On plan. No action needed.',
    whyNow: 'Traffic is 3,500 CCU, within 4% of the plan’s curve. Headroom 42%, queue wait 5 s.',
    confidence: { level: 'high', basis: 'All telemetry is current.', signals: ['Live traffic', 'vCPU / RAM', 'Queue depth', 'Regional demand'], missing: [] },
    route: { tier: 'auto', label: 'Watching', detail: 'Next check in 1 minute.' },
  },
  'c-auto45': {
    id: 'c-auto45', kind: 'auto_executed', title: 'Added 40 instances in us-east-1 and eu-west-1',
    whyNow: 'CCU is 18,000, 2.4× the plan’s curve, and rising about 1,500 every 5 minutes.',
    change: { summary: '+28 in us-east-1, +12 in eu-west-1 (c6g.2xlarge)', diff: [
      { region: 'us-east-1', before: 84, after: 112 }, { region: 'eu-west-1', before: 38, after: 50 }, { region: 'ap-northeast-1', before: 18, after: 18 } ] },
    ifNothing: 'Headroom runs out in about 12 minutes; queue wait p95 reaches ~70 s by T+1h.',
    cost: { perHour: '+$40/hr', window: '~$140 for the expected 3.5 h' },
    playerImpact: 'Room for 6,000 more players without queueing.',
    confidence: { level: 'high', basis: 'Traffic, CPU and queue signals agree.', signals: ['Live traffic', 'vCPU 71%', 'RAM 58%', 'Queue depth 0', 'Regional split 62/28/10'], missing: [] },
    route: { tier: 'auto', label: 'Auto-executed', detail: '$40 is within your $50 per-action cap. $40 of your $200 hourly auto budget used.' },
    rollback: 'Scale back in with a safety hold. Idle cost about $8 if traffic drops.',
  },
  'c-approve90': {
    id: 'c-approve90', kind: 'approval', title: 'Add 128 instances before the queue target breaks',
    whyNow: 'CCU is 61,000, 5× the plan, climbing ~1,300 per minute. Queue wait p95 is 54 s and rising ~3 s per minute.',
    change: { summary: '+80 in us-east-1, +36 in eu-west-1, +12 in ap-northeast-1', diff: [
      { region: 'us-east-1', before: 252, after: 332 }, { region: 'eu-west-1', before: 114, after: 150 }, { region: 'ap-northeast-1', before: 51, after: 63 } ] },
    ifNothing: 'Queue wait p95 passes 90 s in about 12 minutes. Players waiting at peak: likely thousands. The agent shows no exact number because its peak-waiting estimate hasn’t passed evals yet.',
    cost: { perHour: '+$128/hr', window: '~$450 for the expected 3.5 h', budgetNote: 'Takes spend to ~$545/hr, above your $500/hr max. Approving raises the launch-window budget to $900/hr until T+6h.' },
    playerImpact: 'Keeps about 19,000 players out of the queue at peak.',
    confidence: { level: 'medium', basis: 'Traffic shape matches 2 of 3 comparable launches.', signals: ['Live traffic', 'vCPU 94%', 'RAM 71%', 'Queue depth 1,400', 'Regional split 62/28/10'], missing: ['ap-northeast-1 queue depth (collector 4 min behind)'] },
    route: { tier: 'human', label: 'Needs you', detail: 'Exceeds your $50 per-action cap and your $500/hr max hourly spend.' },
    rollback: 'Safety hold keeps live sessions. One click returns to 62,500 capacity; idle cost about $40 if traffic turns.',
    countdownMin: 12,
    leadTime: 'Instances take ~6 min to start. Decide in time for them to be ready before the breach.',
    primary: 'Approve +128 and raise budget to $900/hr',
    secondary: { label: 'Approve within budget only (+8)', consequence: 'Queue wait still passes 90 s at about T+1h50m.' },
  },
  'c-conflict120': {
    id: 'c-conflict120', kind: 'conflict', title: 'eu-west-1 is out of capacity. Pick a fallback.',
    whyNow: 'AWS returned InsufficientInstanceCapacity for c6g.2xlarge in eu-west-1. 3,800 EU players are waiting.',
    confidence: { level: 'medium', basis: 'Capacity estimates come from AWS and change quickly.', signals: ['Live traffic', 'Queue depth 3,800 (EU)', 'Capacity API', 'Latency probes'], missing: ['AWS has no firm ETA for eu-west-1 capacity'] },
    route: { tier: 'human', label: 'Needs you', detail: 'Option A breaks your queue target. Option B switches instance type, which your guardrails keep for people.' },
    options: [
      { id: 'wait', label: 'A · Wait for eu-west-1 capacity', detail: 'Keep retrying c6g.2xlarge in eu-west-1.', tradeoffs: [
        { label: 'EU queue wait p95', value: '~140 s for 20–40 min', tone: 'bad' }, { label: 'Latency', value: 'No change', tone: 'good' }, { label: 'Cost', value: '+$0', tone: 'good' } ] },
      { id: 'fallback', label: 'B · Use c6i.2xlarge in eu-west-2', detail: 'Place new EU sessions in eu-west-2 on a different instance type.', tradeoffs: [
        { label: 'EU queue wait p95', value: 'Under 90 s in ~8 min', tone: 'good' }, { label: 'Latency', value: '+12 ms (p95 74 ms, under 80)', tone: 'warn' }, { label: 'Cost', value: '+8% (~$34/hr)', tone: 'warn' } ],
        note: 'Agent’s lean: B, if 74 ms is acceptable for your EU players.' },
    ],
  },
  'c-down300': {
    id: 'c-down300', kind: 'auto_pending', title: 'Scale down 150 instances as traffic falls',
    whyNow: 'Traffic is down 18% from the peak and falling ~4% every 30 minutes. Headroom is 34% and heading for 52% by T+7h.',
    change: { summary: '−90 in us-east-1, −45 in eu-west-1, −15 in ap-northeast-1', diff: [
      { region: 'us-east-1', before: 490, after: 400 }, { region: 'eu-west-1', before: 250, after: 205 }, { region: 'ap-northeast-1', before: 113, after: 98 } ] },
    ifNothing: 'About $450 of idle compute over the next 3 hours.',
    cost: { perHour: 'Saves ~$150/hr', window: '~$450 over the next 3 h' },
    playerImpact: 'No player is moved or disconnected. 2,300 players in long sessions keep their servers until they finish.',
    confidence: { level: 'high', basis: 'Decline matches all 3 comparable launches.', signals: ['Live traffic', 'vCPU 52%', 'Session lengths', 'Forecast'], missing: [] },
    route: { tier: 'auto', label: 'Starts automatically', detail: 'Scale-down with a safety hold is in your auto-execute tier. Hold it if you expect another wave.' },
    rollback: 'Instances can be re-added in ~6 minutes. Keeps at least 20% of last-known-good capacity.',
    countdownMin: 10,
  },
  'c-review': {
    id: 'c-review', kind: 'quiet', title: 'Launch complete. Review is ready.',
    whyNow: 'Traffic settled at 30,000 CCU, back on the plan’s curve. Capacity is at target headroom.',
    confidence: { level: 'high', basis: 'All telemetry is current.', signals: ['Live traffic', 'vCPU / RAM', 'Queue depth'], missing: [] },
    route: { tier: 'auto', label: 'Watching', detail: 'Steady-state plan takes over on Oct 17.' },
  },
};

/* ---------- audit ---------- */
export interface ScaleAuditEntry {
  id: string;
  t: string;
  phase: PhaseId;
  action: string;
  trigger: string;
  costDelta: string;
  decision: 'Auto' | 'Approved' | 'Declined' | 'Held' | 'Plan';
  who: string;
  outcome: string;
  rollback: boolean;
}

export const SEED_AUDIT: ScaleAuditEntry[] = [
  { id: 's5', t: 'T+45m', phase: 'launch', action: '+40 instances (us-east-1, eu-west-1)', trigger: 'CCU 2.4× plan', costDelta: '+$40/hr', decision: 'Auto', who: 'Agent', outcome: 'Ready in 6 min; headroom back to 22%', rollback: true },
  { id: 's4', t: 'T−24h', phase: 'launch', action: 'Pre-warm: 32 instances across 3 regions', trigger: 'Plan v3 schedule', costDelta: '+$32/hr', decision: 'Auto', who: 'Agent', outcome: 'Ready at T−23h54m', rollback: true },
  { id: 's3', t: 'Oct 2, 6:10 PM', phase: 'launch', action: 'Armed launch plan v3', trigger: 'Manual', costDelta: '—', decision: 'Plan', who: 'You', outcome: 'Validated against guardrails', rollback: false },
  { id: 's2', t: 'Sep 28, 8:12 PM', phase: 'closed_beta', action: '+6 instances (us-east-1)', trigger: 'Queue depth 120', costDelta: '+$6/hr', decision: 'Approved', who: 'Sam K.', outcome: 'Queue cleared in 9 min', rollback: true },
  { id: 's1', t: 'Sep 27, 2:40 AM', phase: 'closed_beta', action: '−10 instances (eu-west-1)', trigger: 'Headroom 61%', costDelta: '−$10/hr', decision: 'Auto', who: 'Agent', outcome: 'Saved $70 overnight', rollback: true },
];

export const PHASE_LABELS: Record<PhaseId, string> = {
  test: 'Test', closed_beta: 'Closed beta', open_beta: 'Open beta', launch: 'Launch', steady: 'Steady state',
};
