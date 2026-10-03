/** Eval run log: what each run found and what changed. Kept honest, including harness bugs. */
export const EVAL_HISTORY = [
  { run: 1, agent: 'v0.1', change: 'First run', result: 'Safety 5/6 · Replay 4/7 · Accuracy 2/4 · Calibration fail · Abstention 3/4 · Red team 5/7',
    found: 'I1 flagged human-approved actions as auto (harness bug). Each new recommendation reset the operator’s response clock, so approvals never landed (harness bug). Agent scaled down during a non-capacity queue rise: 9 cases of invented certainty.' },
  { run: 2, agent: 'v0.1', change: 'Fixed the three harness bugs', result: 'Safety 6/6 · Replay 7/7 · Accuracy 2/4 · Calibration fail · Abstention 3/4 · Red team 5/7',
    found: 'Flash spike breached 17 min (5-min decision cadence too slow). Oscillating traffic caused 5 direction changes. Confidence underconfident (said 77%, right 95%), partly because “correct” counted any scale-up during a ramp.' },
  { run: 3, agent: 'v0.2', change: 'Off-cycle surge path, accelerating-trend slope, scale-down remembers the 30-min peak, broader conflict rule, damped sizing; “correct” now means needed and not oversized', result: 'Safety 6/6 · Replay 7/7 · Accuracy 2/4 · Abstention 4/4 · Red team 7/7',
    found: 'Damped forecast made “time to breach” claims late (20.6 min error).' },
  { run: 4, agent: 'v0.2', change: 'Warning claims use the plain near-term trend over a stated 30-min horizon; sizing keeps the damped trend', result: 'Accuracy 3/4 (breach error 2.7 min)',
    found: 'Peak-waiting estimate still 72% off: no single trend fits both accelerating and saturating spikes.' },
  { run: 5, agent: 'v0.2', change: 'Peak-waiting range; Platt calibration fit on scenario traces, scored on held-out traces', result: 'Range “passed” at 98% coverage, but was hundreds of times wide. Calibration got worse on held-out traces (Brier 0.112 vs 0.100 raw).',
    found: 'A range that wide is useless; calibration fitted on easy traces doesn’t transfer to adversarial ones.' },
  { run: 6, agent: 'v0.2', change: 'Ship raw confidence (calibrator only ships if it improves held-out Brier); range must be ≤ 3× wide', result: 'Safety 6/6 · Replay 7/7 · Calibration pass (held-out) · Abstention 4/4 · Red team 7/7 · Peak-waiting claims fail',
    found: 'Rollout stays at Shadow until the peak-waiting estimate passes. Design consequence: cards don’t show an exact waiting number.' },
];
