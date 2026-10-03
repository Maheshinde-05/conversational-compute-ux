/*
 * Deterministic card fixtures for moderated studies (eval framework §7).
 * Every participant sees exactly these cards. Flawed cards contain one
 * deliberate error a careful reader can catch from the card alone.
 */
import type { ScaleCard } from './scale-mock';

export interface StudyCard {
  id: string;
  card: ScaleCard;
  good: boolean;
  flaw?: 'wrong_math' | 'missing_evidence' | 'exceeds_guardrail';
  flawExplained?: string;
  timed?: boolean;
}

const base = {
  confidence: { level: 'high' as const, basis: 'Traffic, CPU and queue signals agree.', signals: ['Live traffic', 'vCPU 88%', 'RAM 64%', 'Queue depth 300', 'Regional split 60/30/10'], missing: [] },
};

export const COMPREHENSION_CARD: ScaleCard = {
  id: 'study-comp', kind: 'approval', title: 'Add 60 instances in us-east-1',
  whyNow: 'us-east-1 CCU is up 30% in 15 minutes and climbing. Queue wait p95 is 41 s.',
  change: { summary: '+60 c6g.2xlarge in us-east-1 ($1.00/hr each)', diff: [{ region: 'us-east-1', before: 120, after: 180 }, { region: 'eu-west-1', before: 60, after: 60 }] },
  ifNothing: 'Queue wait p95 passes the 90 s target in about 20 minutes.',
  cost: { perHour: '+$60/hr', window: '~$180 for the next 3 h' },
  playerImpact: 'Room for 9,000 more players without queueing.',
  ...base,
  route: { tier: 'human', label: 'Needs you', detail: '$60 is above your $50 per-action cap.' },
  rollback: 'One click removes the 60 instances; live sessions are kept.',
};

export const COMPREHENSION_QUIZ = [
  { q: 'What will change if you approve?', options: ['60 instances are added in us-east-1', '60 instances are added in every region', 'Traffic moves from eu-west-1 to us-east-1', 'Nothing until tomorrow'], answer: 0 },
  { q: 'What happens if you do nothing?', options: ['Nothing; the agent adds them anyway', 'Queue wait passes 90 s in about 20 minutes', 'Players are disconnected', 'Cost goes up by $60/hr'], answer: 1 },
  { q: 'What does it cost?', options: ['$60 in total', 'About $60 per hour', '$180 per hour', 'It saves money'], answer: 1 },
];

export const DECISION_CARDS: StudyCard[] = [
  {
    id: 'g1', good: true,
    card: { id: 'study-g1', kind: 'approval', title: 'Add 24 instances in eu-west-1',
      whyNow: 'eu-west-1 CCU is 1.8× the plan and rising ~400 per minute. Headroom is 12%.',
      change: { summary: '+24 c6g.2xlarge in eu-west-1 ($1.00/hr each)', diff: [{ region: 'eu-west-1', before: 80, after: 104 }] },
      ifNothing: 'Headroom runs out in about 15 minutes; queue wait follows.',
      cost: { perHour: '+$24/hr', window: '~$72 for the next 3 h' }, playerImpact: 'Room for 3,600 more players.', ...base,
      route: { tier: 'prepare', label: 'Staged, needs one click', detail: 'Instances are provisioning; they go live when you confirm.' },
      rollback: 'One click removes them; live sessions are kept.' },
  },
  {
    id: 'f1', good: false, flaw: 'wrong_math', flawExplained: '128 instances at $1.00/hr each is $128/hr, not $40/hr.',
    card: { id: 'study-f1', kind: 'approval', title: 'Add 128 instances across three regions',
      whyNow: 'CCU is 4× the plan and climbing ~1,200 per minute. Queue wait p95 is 50 s.',
      change: { summary: '+128 c6g.2xlarge ($1.00/hr each) across us-east-1, eu-west-1, ap-northeast-1', diff: [{ region: 'us-east-1', before: 250, after: 330 }, { region: 'eu-west-1', before: 110, after: 146 }, { region: 'ap-northeast-1', before: 50, after: 62 }] },
      ifNothing: 'Queue wait p95 passes 90 s in about 15 minutes.',
      cost: { perHour: '+$40/hr', window: '~$140 for the next 3.5 h' }, playerImpact: 'Room for about 19,000 more players.', ...base,
      route: { tier: 'human', label: 'Needs you', detail: 'Changes capacity in three regions at once.' },
      rollback: 'One click returns to the previous capacity.' },
  },
  {
    id: 'g2', good: true, timed: true,
    card: { id: 'study-g2', kind: 'approval', title: 'Add 128 instances before the queue target breaks',
      whyNow: 'CCU is 61,000, 5× the plan, climbing ~1,300 per minute. Queue wait p95 is 54 s and rising ~3 s per minute.',
      change: { summary: '+128 c6g.2xlarge ($1.00/hr each): +80 us-east-1, +36 eu-west-1, +12 ap-northeast-1', diff: [{ region: 'us-east-1', before: 252, after: 332 }, { region: 'eu-west-1', before: 114, after: 150 }, { region: 'ap-northeast-1', before: 51, after: 63 }] },
      ifNothing: 'Queue wait p95 passes 90 s in about 12 minutes.',
      cost: { perHour: '+$128/hr', window: '~$450 for the next 3.5 h', budgetNote: 'Takes spend to ~$545/hr, above your $500/hr max. Approving raises the launch budget to $900/hr until T+6h.' },
      playerImpact: 'Keeps about 19,000 players out of the queue at peak.',
      confidence: { level: 'medium', basis: 'Traffic shape matches 2 of 3 comparable launches.', signals: ['Live traffic', 'vCPU 94%', 'RAM 71%', 'Queue depth 1,400'], missing: ['ap-northeast-1 queue depth (4 min behind)'] },
      route: { tier: 'human', label: 'Needs you', detail: 'Above your $50 per-action cap and $500/hr max spend.' },
      rollback: 'One click returns to the previous capacity; live sessions are kept.', countdownMin: 12 },
  },
  {
    id: 'f2', good: false, flaw: 'missing_evidence', flawExplained: 'High confidence with no signals listed: the card gives no evidence for its claim.',
    card: { id: 'study-f2', kind: 'approval', title: 'Add 40 instances in ap-northeast-1',
      whyNow: 'Demand pattern detected in ap-northeast-1.',
      change: { summary: '+40 c6g.2xlarge in ap-northeast-1 ($1.00/hr each)', diff: [{ region: 'ap-northeast-1', before: 30, after: 70 }] },
      ifNothing: 'Queue wait may increase.',
      cost: { perHour: '+$40/hr', window: '~$120 for the next 3 h' }, playerImpact: 'More capacity in Asia-Pacific.',
      confidence: { level: 'high', basis: 'Pattern detected.', signals: [], missing: [] },
      route: { tier: 'human', label: 'Needs you', detail: 'Region weight would change from 10% to 18%.' },
      rollback: 'One click removes them.' },
  },
  {
    id: 'g3', good: true,
    card: { id: 'study-g3', kind: 'approval', title: 'Scale down 90 instances as traffic falls',
      whyNow: 'Traffic is down 22% from the peak and falling ~3% every 30 minutes. Headroom is 41%, above your 35% maximum.',
      change: { summary: '−60 us-east-1, −30 eu-west-1 (idle servers only)', diff: [{ region: 'us-east-1', before: 400, after: 340 }, { region: 'eu-west-1', before: 200, after: 170 }] },
      ifNothing: 'About $270 of idle compute over the next 3 hours.',
      cost: { perHour: 'Saves ~$90/hr', window: '~$270 over the next 3 h' }, playerImpact: 'No player is moved or disconnected; long sessions keep their servers.',
      confidence: { level: 'high', basis: 'Decline matches all 3 comparable launches.', signals: ['Live traffic', 'vCPU 49%', 'Session lengths', 'Forecast'], missing: [] },
      route: { tier: 'human', label: 'Needs you', detail: 'You’ve set scale-downs above 50 instances to need approval.' },
      rollback: 'Instances can be re-added in ~6 minutes.' },
  },
  {
    id: 'f3', good: false, flaw: 'exceeds_guardrail', flawExplained: '$150/hr is above the $50 per-action cap the card itself names, so it can’t be a Tier 1 auto-execute.',
    card: { id: 'study-f3', kind: 'approval', title: 'Add 150 instances in us-east-1',
      whyNow: 'us-east-1 CCU is up 45% in 20 minutes. Queue wait p95 is 38 s.',
      change: { summary: '+150 c6g.2xlarge in us-east-1 ($1.00/hr each)', diff: [{ region: 'us-east-1', before: 200, after: 350 }] },
      ifNothing: 'Queue wait p95 passes 90 s in about 25 minutes.',
      cost: { perHour: '+$150/hr', window: '~$450 for the next 3 h' }, playerImpact: 'Room for 22,500 more players.', ...base,
      route: { tier: 'auto', label: 'Tier 1 · Auto-execute', detail: 'Within your $50 per-action auto-approval cap. Will run in 2 minutes unless you stop it.' },
      rollback: 'One click removes them.' },
  },
];

export const GUARDRAIL_QUESTION = {
  q: 'Which of these may the system do without asking anyone?',
  options: [
    { label: 'Add instances within the per-action and per-hour caps', correct: true },
    { label: 'Scale down idle servers with a safety hold', correct: true },
    { label: 'Switch to a different instance type', correct: false },
    { label: 'Move traffic weight between regions', correct: false },
    { label: 'Add instances beyond the caps if the queue is bad', correct: false },
    { label: 'Change the pre-warm schedule (it stages it; you confirm)', correct: false },
  ],
};
