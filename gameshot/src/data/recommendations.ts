/*
 * Sample AI recommendations. In production these come from the recommender
 * service: the model fills in the judgment fields (summary, rationale,
 * evidence, missing-data impact, confidence, suggested risk); code fills in
 * the facts (cost, reversibility, blast radius). Risk tier and approval route
 * are never stored here: they're computed from `facts` + the team's policy
 * (see logic/riskPolicy.ts).
 */

export type RiskTier = 'low' | 'medium' | 'high';
export type ActionType = 'compute_class' | 'fleet_config' | 'scaling_threshold' | 'optimization';
export type Role = 'Team leads' | 'Finance' | 'SRE on-call';
export type Influence = 'strong' | 'moderate' | 'weak';

export interface Evidence {
  signalId: string;
  label: string;
  value: string; // computed by code, never by the model
  influence: Influence;
  note: string;
}

/** Facts computed by code; the risk policy reads only these. */
export interface RecommendationFacts {
  actionType: ActionType;
  environment: 'test' | 'production';
  reversibility: 'instant' | 'window' | 'slow';
  monthlyCostDelta: number; // USD, negative = savings
  playersAffected: 'none' | 'canary' | 'fleet';
}

export interface Recommendation {
  id: string;
  target: string; // fleet or session the change applies to
  generatedAt: string;
  expiresIn: string;
  summary: string;
  change: { from: string; to: string };
  rationale: string | null; // null = explanation unavailable (rules-only fallback)
  evidence: Evidence[];
  missingData: { signal: string; impact: string }[];
  confidence: { level: 'low' | 'medium' | 'high'; basis: string };
  modelSuggestedRisk: RiskTier;
  facts: RecommendationFacts;
  rollbackPlan: string;
  /** Lifecycle of the analysis itself, separate from approval status. */
  freshness: 'current' | 'stale' | 'expired';
  chart?: { xLabels: string[]; series: { name: string; values: number[] }[] };
}

export const ROLES: Role[] = ['Team leads', 'Finance', 'SRE on-call'];
export const WINDOW_OPTIONS = [
  'Tue 02:00–04:00 UTC',
  'Thu 02:00–04:00 UTC',
  'Sat 06:00–08:00 UTC',
  'Daily 03:00–04:00 UTC',
];

export const ACTION_LABELS: Record<ActionType, string> = {
  compute_class: 'Instance type changes',
  fleet_config: 'Fleet configuration changes',
  scaling_threshold: 'Scaling rule changes',
  optimization: 'Alerts and optimizations',
};

export const sampleRecommendations: Recommendation[] = [
  {
    id: 'rec-cpu',
    target: 'fleet-xyz456 · us-east-1',
    generatedAt: 'Dec 29, 4:05 PM',
    expiresIn: '46 h',
    summary: 'Move game servers from c5.large to c5.xlarge',
    change: { from: 'c5.large · 2 vCPU · 4 GB', to: 'c5.xlarge · 4 vCPU · 8 GB' },
    rationale:
      'CPU has stayed above 95% at peak for three days, and latency rises with it. Sessions are CPU-bound, not memory-bound: crash rate is normal, so servers are slow rather than failing. Doubling vCPU per instance removes the bottleneck at the lowest added cost of the three options.',
    evidence: [
      { signalId: 'cpu.p95', label: 'CPU usage, p95 (3 days)', value: '98%', influence: 'strong', note: 'Above 95% during every evening peak.' },
      { signalId: 'latency.p95', label: 'Player latency, p95', value: '142 ms (+38%)', influence: 'strong', note: 'Rises in step with CPU; below 100 ms off-peak.' },
      { signalId: 'sessions.concurrency', label: 'Sessions above 90% CPU', value: '5 of 6', influence: 'moderate', note: 'Not limited to one noisy session.' },
      { signalId: 'crash.rate', label: 'Crash rate', value: '0.4% (normal)', influence: 'weak', note: 'Rules out a crash loop as the cause.' },
      { signalId: 'spend.current', label: 'Current spend', value: '$1,130 / month', influence: 'weak', note: 'Upgrade adds about 36%.' },
    ],
    missingData: [
      { signal: 'Memory usage in us-west-1', impact: 'Can’t confirm the same bottleneck there, so this applies to us-east-1 only.' },
    ],
    confidence: { level: 'high', basis: '14 of the last 15 similar upgrades met their latency target.' },
    modelSuggestedRisk: 'medium',
    facts: { actionType: 'compute_class', environment: 'production', reversibility: 'slow', monthlyCostDelta: 412, playersAffected: 'fleet' },
    rollbackPlan:
      'Keep the c5.large fleet running for 24 hours after cutover. If crash rate or latency gets worse, shift traffic back with the fleet alias (about 2 minutes), then retire the new fleet.',
    freshness: 'current',
    chart: {
      xLabels: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
      series: [
        { name: 'CPU %', values: [62, 78, 91, 97, 98, 96, 94] },
        { name: 'Latency (scaled)', values: [40, 48, 66, 82, 88, 85, 80] },
      ],
    },
  },
  {
    id: 'rec-scale',
    target: 'fleet-xyz456 · all regions',
    generatedAt: 'Dec 29, 4:05 PM',
    expiresIn: '46 h',
    summary: 'Scale out at 65% CPU instead of 80%',
    change: { from: 'Scale out at 80% CPU', to: 'Scale out at 65% CPU' },
    rationale:
      'New instances take about 4 minutes to start. At the current 80% trigger, demand reaches 100% before new capacity arrives. Triggering at 65% gives that headroom. Extra instances run only during peaks.',
    evidence: [
      { signalId: 'scale.lag', label: 'Time from trigger to ready', value: '4 min 10 s', influence: 'strong', note: 'Measured over the last 20 scale-outs.' },
      { signalId: 'cpu.ramp', label: 'CPU climb at peak start', value: '+6% per minute', influence: 'strong', note: '80% → 100% in under 4 minutes.' },
      { signalId: 'queue.wait', label: 'Matchmaking wait at peak', value: '38 s', influence: 'moderate', note: 'Players wait while capacity catches up.' },
    ],
    missingData: [],
    confidence: { level: 'medium', basis: 'Clear pattern, but only 5 days of scale-out history.' },
    modelSuggestedRisk: 'low',
    facts: { actionType: 'scaling_threshold', environment: 'production', reversibility: 'window', monthlyCostDelta: 86, playersAffected: 'none' },
    rollbackPlan: 'Restore the 80% trigger. Takes effect on the next scaling check (about 1 minute).',
    freshness: 'current',
  },
  {
    id: 'rec-region',
    target: 'New fleet · eu-west-1',
    generatedAt: 'Dec 27, 9:12 AM',
    expiresIn: '2 h',
    summary: 'Add capacity in eu-west-1 for European players',
    change: { from: 'EU players served from us-east-1', to: 'New 4-instance fleet in eu-west-1' },
    rationale: null,
    evidence: [
      { signalId: 'demand.eu', label: 'Sessions from Europe', value: '31% (+12 pts in 2 weeks)', influence: 'strong', note: '' },
      { signalId: 'latency.eu', label: 'EU player latency, p95', value: '186 ms', influence: 'strong', note: '' },
    ],
    missingData: [{ signal: 'EU pricing for reserved capacity', impact: 'Cost uses on-demand rates and may be lower.' }],
    confidence: { level: 'medium', basis: 'Rules-only estimate; no model explanation.' },
    modelSuggestedRisk: 'medium',
    facts: { actionType: 'fleet_config', environment: 'production', reversibility: 'window', monthlyCostDelta: 640, playersAffected: 'canary' },
    rollbackPlan: 'Route EU matchmaking back to us-east-1, then scale the eu-west-1 fleet to zero.',
    freshness: 'stale',
  },
  {
    id: 'rec-alert',
    target: 'fleet-xyz456 · us-east-1',
    generatedAt: 'Dec 29, 4:05 PM',
    expiresIn: '46 h',
    summary: 'Alert when p95 latency goes above 120 ms',
    change: { from: 'No latency alert', to: 'Alert on-call at 120 ms p95 for 10 min' },
    rationale: 'Latency went above 120 ms on three evenings this week before anyone noticed. An alert gives the team warning before players complain.',
    evidence: [
      { signalId: 'latency.p95', label: 'Evenings above 120 ms', value: '3 of 7', influence: 'strong', note: 'Each lasted over 40 minutes.' },
    ],
    missingData: [],
    confidence: { level: 'high', basis: 'Threshold matches the team’s stated latency target.' },
    modelSuggestedRisk: 'low',
    facts: { actionType: 'optimization', environment: 'production', reversibility: 'instant', monthlyCostDelta: 0, playersAffected: 'none' },
    rollbackPlan: 'Delete the alert.',
    freshness: 'current',
  },
  {
    id: 'rec-idle',
    target: 'game-session-test fleet',
    generatedAt: 'Dec 29, 4:05 PM',
    expiresIn: '46 h',
    summary: 'Stop the idle test fleet overnight',
    change: { from: 'Running 24/7', to: 'Stopped 22:00–07:00 UTC' },
    rationale: 'The test fleet had no sessions between 22:00 and 07:00 UTC on any of the last 14 nights.',
    evidence: [
      { signalId: 'sessions.test.night', label: 'Overnight sessions (14 nights)', value: '0', influence: 'strong', note: '' },
      { signalId: 'spend.test', label: 'Test fleet spend', value: '$170 / month', influence: 'moderate', note: '' },
    ],
    missingData: [],
    confidence: { level: 'high', basis: 'Two full weeks of zero overnight usage.' },
    modelSuggestedRisk: 'low',
    facts: { actionType: 'optimization', environment: 'test', reversibility: 'instant', monthlyCostDelta: -64, playersAffected: 'none' },
    rollbackPlan: 'Remove the schedule; the fleet starts within 3 minutes.',
    freshness: 'current',
  },
  {
    id: 'rec-players',
    target: 'fleet-xyz456 · us-east-1',
    generatedAt: 'Dec 24, 11:30 AM',
    expiresIn: 'expired',
    summary: 'Lower max players per session from 8 to 6',
    change: { from: '8 players', to: '6 players' },
    rationale: 'Sessions with 7–8 players used most of the CPU during last week’s peaks.',
    evidence: [
      { signalId: 'cpu.by.players', label: 'CPU at 8 players', value: '97%', influence: 'strong', note: '' },
    ],
    missingData: [],
    confidence: { level: 'medium', basis: 'Based on one week of data.' },
    modelSuggestedRisk: 'medium',
    facts: { actionType: 'fleet_config', environment: 'production', reversibility: 'window', monthlyCostDelta: 0, playersAffected: 'fleet' },
    rollbackPlan: 'Restore the 8-player limit.',
    freshness: 'expired',
  },
];
