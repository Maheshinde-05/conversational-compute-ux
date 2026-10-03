/*
 * npm run eval: runs the Scale Control eval suite on the golden traces and
 * prints the scorecard. Exits non-zero if a safety invariant or red-team
 * scenario fails, so it can gate CI.
 */
import { buildReport } from '../src/evals/scorecard';

const r = buildReport();
const icon = (s: string) => (s === 'pass' ? 'PASS' : s === 'fail' ? 'FAIL' : 'NOT RUN');
const line = (s = '') => console.log(s);

line(`GameShot Scale Control eval · ${r.generatedFor}`);
line('='.repeat(72));
line('\nSafety invariants');
for (const i of r.invariants) line(`  ${icon(i.status).padEnd(7)} ${i.id}  ${i.name}  (${i.checks} checks)`);
line('\nReplay vs baselines (min above queue target · cost · regret vs oracle)');
for (const x of r.replay) line(`  ${icon(x.pass ? 'pass' : 'fail').padEnd(7)} ${x.trace.name.padEnd(28)} agent ${String(x.agent.minutesAboveTarget).padStart(3)} min $${Math.round(x.agent.totalCost)} · reactive ${String(x.reactive.minutesAboveTarget).padStart(3)} min $${Math.round(x.reactive.totalCost)} · static ${String(x.static.minutesAboveTarget).padStart(3)} min $${Math.round(x.static.totalCost)} · ${x.regret.toFixed(2)}× oracle · flaps ${x.agent.flaps}`);
line('\nPrediction accuracy');
for (const a of r.accuracy) line(`  ${icon(a.withinTolerance ? 'pass' : 'fail').padEnd(7)} ${a.claim.padEnd(28)} ${a.error} (n=${a.n}, tolerance ${a.tolerance})`);
line(`\nCalibration (fit on ${r.calibration.trainN} train recs, scored on ${r.calibration.n} held-out)  Brier ${r.calibration.brier.toFixed(3)} shipped (${r.calibration.shipCalibrator ? 'calibrated' : 'raw'}) · raw ${r.calibration.rawBrier.toFixed(3)} · Platt-calibrated ${r.calibration.calibratedBrier.toFixed(3)}`);
for (const b of r.calibration.bins) if (b.n) line(`  ${b.from.toFixed(2)}–${b.to.toFixed(2)}  n=${String(b.n).padStart(3)}  said ${Math.round(b.meanConfidence * 100)}%  right ${Math.round(b.accuracy * 100)}%`);
line(`  ${icon(r.calibration.pass ? 'pass' : 'fail')}  ~80%-confident band: ${r.calibration.band80 ? `${Math.round(r.calibration.band80.accuracy * 100)}% right (n=${r.calibration.band80.n})` : 'no recommendations in band'} · target 70–90%`);
line('\nAbstention');
for (const a of r.abstention) line(`  ${icon(a.pass ? 'pass' : 'fail').padEnd(7)} ${a.trace.name.padEnd(24)} ${a.correct}/${a.inWindow} correct · ${a.invented} invented certainty · saw: ${a.observed}`);
line(`  recall ${Math.round(r.abstentionTotals.recall * 100)}% · precision ${Math.round(r.abstentionTotals.precision * 100)}% (${r.abstentionTotals.falseAbstentions} unneeded of ${r.abstentionTotals.totalAbstentions})`);
line('\nRed team');
for (const t of r.redteam) line(`  ${icon(t.status).padEnd(7)} ${t.name.padEnd(24)} ${t.detail}`);
line('\nHuman-in-the-loop studies: NOT RUN (use the study kit in the app)');
line(`\nRollout stage: ${r.stage.current}${r.stage.blockedBy.length ? ` · blocked by: ${r.stage.blockedBy.join(', ')}` : ''}`);

const gateFail = r.overall.safety === 'fail' || r.overall.redteam === 'fail';
if (gateFail) { line('\nGATE FAILED: safety invariants and red-team scenarios must all pass.'); process.exit(1); }
