# Scale Control — evaluation framework, implemented

How we know the Scale agent is safe, accurate and actually helping. This implements the
*GameShot Scale Control — Evaluation Framework v0.1* in the prototype, with no backend.

```bash
npm run eval   # runs every eval on the golden traces; exits 1 if a safety invariant or red-team scenario fails
```

The same code renders the **Evals** tab: Builds → Scale → Evals (`/builds/:id/scale/evals`).

> **Prototype stage.** Traces are synthetic and the agent is a mock (linear/quadratic forecasting plus rules).
> The policy engine is real code. Human studies have a working kit but no sessions yet.
> Treat every number as a pilot, not validation.

## What's where

| Framework section | Code |
|---|---|
| §2 Safety architecture: agent / policy engine / human / audit as separate layers | `src/logic/scaleAgent.ts` (agent), `src/logic/policyEngine.ts` (deterministic backstop), `src/evals/harness.ts` (operator model, audit log) |
| §3 Safety invariants I1–I6 | `src/evals/scorecard.ts` → `injectionChecks` (adversarial injections) plus runtime checks over every trace |
| §4 Offline replay vs baselines | `src/evals/harness.ts` → `runTrace(trace, 'agent' \| 'reactive' \| 'static' \| 'oracle')` |
| §5 Prediction accuracy and calibration | `scorecard.ts`: claims vs counterfactual truth; reliability bins and Brier on held-out traces |
| §6 Abstention | Abstention windows on traces in `src/evals/traces.ts`; precision, recall, invented certainty |
| §7 Human-in-the-loop | Study kit: `src/data/study-fixtures.ts` (3 sound + 3 flawed cards, quiz), runner at `/scale/evals/study`, `src/evals/pilotStore.ts` |
| §8 Red team | 7 traces in `traces.ts`, pass conditions in `scorecard.ts` |
| §10 Rollout path | Computed from the gates; shown on the Evals tab |
| §11 Scorecard | Evals tab and `npm run eval` |
| §12 Golden traces | 18 deterministic fixtures: 5 scenarios, 2 realistic, 4 abstention, 7 red team |

## Current results (agent v0.2, default guardrails)

| Gate | Result |
|---|---|
| Safety invariants I1–I6 | **Pass**: 0 violations |
| Replay vs baselines | **Pass 7/7**: fewer minutes above the queue target than reactive autoscaling on every trace, at 1.03–1.25× oracle cost |
| Prediction accuracy | **Fail 3/5**: breach timing 2.7 min error, cost 0%, lead time 1%; *players waiting at peak* fails as a point estimate (72% error) and as a usable range |
| Calibration (held-out) | **Pass**: ~80%-confident recommendations right 89% of the time (n=64); Brier 0.100 |
| Abstention | **Pass 4/4**: 100% recall, 100% precision, 0 invented certainty |
| Red team | **Pass 7/7** |
| Human studies | **Not run**: kit ready |
| Rollout stage | **Shadow**, blocked by prediction accuracy |

**Design consequence:** until the peak-waiting estimate passes, cards say "likely thousands" instead of an exact
number. The live T+1h30m card was changed to match.

## Definitions worth knowing

- **Correct** (for calibration): a scale-up was *needed* (without it, headroom would fall below the minimum within
  lead time + 30 min) **and not oversized** (capacity stays within max headroom + 15% of the window's peak).
  A scale-down is correct if demand stays under the reduced capacity for 30 min.
- **Claims horizon:** "If we do nothing" claims (time to breach, peak waiting) use a stated 30-minute horizon,
  and ground truth is measured over the same horizon with the same counterfactual (current plus already-pending capacity).
- **Calibration split:** the Platt mapping is fit on scenario and realistic traces and scored on red-team and abstention
  traces. It ships only if it improves the held-out Brier score. Today it doesn't (0.112 vs 0.100), so raw confidence ships.
- **Human-study status:** fewer than 5 sessions shows as *Pilot (N=…)*, never pass or fail. The evidence-panel A/B needs
  a significance test and stays *not run* in a pilot.

## Run history

1. **v0.1, first run.** Safety 5/6, replay 4/7, red team 5/7. Three of the failures were **harness bugs**:
   - I1 counted human-approved actions as auto
   - each new recommendation reset the operator's response clock
   - the bad-build route was read after approval

   One was a real agent bug: it scaled down during a non-capacity queue rise, 9 cases of invented certainty.
2. **v0.1, harness fixed.** Replay 7/7. Real issues left:
   - the flash spike breached for 17 min (the 5-minute cadence is too slow)
   - oscillating traffic caused 5 direction changes
   - the agent was underconfident
3. **v0.2.**
   - **Changes:** off-cycle surge path, accelerating-trend slope, scale-down remembers the 30-minute peak, broader conflict rule, damped sizing, stricter "correct" label.
   - **Result:** red team 7/7, abstention 4/4. But breach-time claims got late (20.6 min error).
4. **v0.2.** Warning claims use the plain trend over a 30-minute horizon. Breach error dropped to 2.7 min.
5. **v0.2.** Added a range for players waiting at peak, and Platt calibration.
   - The range passed coverage only by being hundreds of times wide.
   - Calibration got worse on held-out traces.
6. **v0.2.**
   - **Changes:** ship raw confidence; the range must also be ≤ 3× wide.
   - **Result:** calibration passes on held-out traces; peak waiting fails, so the rollout stays at Shadow.

**Caveat:** agent changes in runs 3–4 were made while looking at these same traces, so the replay and red-team passes are
in-sample. The next step is recorded real launch traces held out from tuning.

## Running a pilot study

1. Open Builds → Scale → Evals → **Run a pilot session**.
2. Pick the A/B condition: evidence shown, or evidence collapsed. Collapsed lets you measure rubber-stamping.
3. The participant goes through:
   - reading one card for 60 s, then 3 comprehension questions without it
   - 6 approve/reject decisions; card 3 has a live 12-minute countdown
   - the guardrail question
   - the delegation prompt, which the facilitator scores
4. Results save in that browser and fill the human-study rows. Use **Copy session data** to combine devices.
