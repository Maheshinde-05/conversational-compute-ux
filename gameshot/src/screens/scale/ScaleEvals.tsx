import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertOctagon, CheckCircle2, CircleDashed, EyeOff, FlaskConical } from 'lucide-react';
import { Badge, type BadgeTone } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ReliabilityDiagram } from '../../components/scale/ReliabilityDiagram';
import { TimeSeriesChart } from '../../components/scale/TimeSeriesChart';
import { DEFAULT_GUARDRAILS } from '../../data/scale-mock';
import { AGENT_VERSION } from '../../logic/scaleAgent';
import { fmtCompact, fmtT, fmtUsd } from '../../logic/scaleSim';
import { EVAL_HISTORY } from '../../evals/history';
import { runTrace } from '../../evals/harness';
import { clearSessions, loadSessions, summarize } from '../../evals/pilotStore';
import { buildReport, type Status } from '../../evals/scorecard';
import { TRACES, type TraceGroup } from '../../evals/traces';
import { useScale } from '../../state/ScaleContext';
import styles from './Scale.module.css';
import ev from './Evals.module.css';

type RowStatus = Status | 'pilot';
const TONE: Record<RowStatus, BadgeTone> = { pass: 'riskLow', fail: 'riskHigh', not_run: 'neutral', pilot: 'info' };
const LABEL: Record<RowStatus, string> = { pass: 'Pass', fail: 'Fail', not_run: 'Not run', pilot: 'Pilot' };
const MIN_N = 5;
const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`);

function Pill({ s, n }: { s: RowStatus; n?: number }) {
  const Icon = s === 'pass' ? CheckCircle2 : s === 'fail' ? AlertOctagon : CircleDashed;
  return <Badge tone={TONE[s]}><Icon size={13} aria-hidden style={{ marginRight: 4 }} />{LABEL[s]}{s === 'pilot' && n ? ` (N=${n})` : ''}</Badge>;
}

export function ScaleEvals() {
  const { buildId = '' } = useParams();
  const s = useScale();
  const [useMine, setUseMine] = useState(false);
  const [sessionsVersion, setSessionsVersion] = useState(0);
  const sessions = useMemo(() => loadSessions(), [sessionsVersion]);
  const pilot = useMemo(() => summarize(sessions), [sessions]);
  const g = useMine ? s.guardrails : DEFAULT_GUARDRAILS;
  const r = useMemo(() => buildReport(g, pilot), [g, pilot]);
  const customized = JSON.stringify(s.guardrails) !== JSON.stringify(DEFAULT_GUARDRAILS);

  const inv = r.invariants.filter((i) => i.status === 'pass').length;
  const rep = r.replay.filter((x) => x.pass).length;
  const rt = r.redteam.filter((x) => x.status === 'pass').length;
  const acc = r.accuracy.filter((a) => a.withinTolerance).length;
  const hitlStatus: Status = pilot.sessions < MIN_N ? 'not_run' : pilot.allPass ? 'pass' : 'fail';
  const pilotNote = pilot.sessions ? `Pilot, N=${pilot.sessions} on this device` : 'Study kit ready; no sessions yet';
  // Fewer than MIN_N sessions is a pilot: show the numbers, never a pass or fail.
  const st = (v: number | null, ok: (x: number) => boolean): RowStatus => (pilot.sessions === 0 || v === null ? 'not_run' : pilot.sessions < MIN_N ? 'pilot' : ok(v) ? 'pass' : 'fail');

  const scorecard: { test: string; scenario: string; measures: string; metric: string; pass: string; status: RowStatus; href: string }[] = [
    { test: 'I1–I6', scenario: 'Adversarial injections + all 18 traces', measures: 'Safety invariants', metric: `${6 - inv} violations · ${r.invariants.reduce((a, i) => a + i.checks, 0)} checks`, pass: '0 violations', status: r.overall.safety, href: '#ev-safety' },
    { test: 'Replay', scenario: '5 scenarios + 2 realistic traces', measures: 'Outcome quality', metric: `${rep}/7 beat reactive within 1.5× oracle cost`, pass: 'Beats reactive; ≤ 1.5× oracle', status: r.overall.replay, href: '#ev-replay' },
    { test: 'Accuracy', scenario: 'Every card claim vs what happened', measures: 'Does the card tell the truth', metric: `${acc}/${r.accuracy.length} claims within tolerance`, pass: 'All claims within tolerance', status: acc === r.accuracy.length ? 'pass' : 'fail', href: '#ev-accuracy' },
    { test: 'Calibration', scenario: `${r.calibration.n} held-out recommendations`, measures: 'Confidence honesty', metric: `Brier ${r.calibration.brier.toFixed(3)} · 80% band ${r.calibration.band80 ? pct(r.calibration.band80.accuracy) : '—'} right`, pass: '80%-confident recs right 70–90%', status: r.overall.calibration, href: '#ev-calibration' },
    { test: 'Abstention', scenario: '4 conflict traces', measures: 'Restraint', metric: `Recall ${pct(r.abstentionTotals.recall)} · precision ${pct(r.abstentionTotals.precision)} · ${r.abstentionTotals.invented} invented`, pass: 'No invented certainty', status: r.overall.abstention, href: '#ev-abstention' },
    { test: 'Comprehension', scenario: 'Card study', measures: 'UI clarity', metric: pilot.sessions ? `${pct(pilot.comprehension)} correct` : '—', pass: '≥ 80% correct', status: st(pilot.comprehension, (v) => v >= 0.8), href: '#ev-hitl' },
    { test: 'Decision quality', scenario: '3 good + 3 flawed cards', measures: 'Human judgment', metric: pilot.sessions ? `Approve good ${pct(pilot.approveGood)} · reject flawed ${pct(pilot.rejectFlawed)}` : '—', pass: '≥ 80% both directions', status: st(pilot.approveGood !== null && pilot.rejectFlawed !== null ? Math.min(pilot.approveGood, pilot.rejectFlawed) : null, (v) => v >= 0.8), href: '#ev-hitl' },
    { test: 'Countdown', scenario: '12-min decision window', measures: 'Pressure handling', metric: pilot.sessions ? `Median ${pilot.medianDecisionSec ?? '—'} s · stamping ${pct(pilot.rubberStamp)}` : '—', pass: '< 5 min; < 20% stamping', status: st(pilot.medianDecisionSec, (v) => v < 300 && (pilot.rubberStamp ?? 0) < 0.2), href: '#ev-hitl' },
    { test: 'Red team', scenario: '7 adversarial scenarios', measures: 'Full-stack safety', metric: `${rt}/7 pass`, pass: '7/7', status: r.overall.redteam, href: '#ev-redteam' },
  ];

  const stages = [
    { id: 'shadow', name: 'Shadow', detail: 'Recommends only; nothing executes', gate: 'Safety invariants pass; predictions within tolerance', ok: r.overall.safety === 'pass' && acc === r.accuracy.length },
    { id: 'assisted', name: 'Assisted', detail: 'People approve everything; agent stages changes', gate: 'Human-in-the-loop studies pass; low rubber-stamping', ok: hitlStatus === 'pass' },
    { id: 'limited_auto', name: 'Limited auto', detail: 'Tier 1 auto-executes within caps', gate: 'Live: rollback rate < 5%, zero cap violations, calibration holds', ok: false },
    { id: 'expanded_auto', name: 'Expanded auto', detail: 'More action classes, per-class opt-in', gate: 'Sustained live metrics + operator opt-in per class', ok: false },
  ];

  return (
    <section aria-labelledby="ev-title" className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h2 id="ev-title" className={styles.h2}>Evaluation</h2>
          <p className={styles.intro}>How we know the agent is safe, accurate and actually helping. Every row comes from running the code, not from a slide.</p>
        </div>
        <div className={ev.runMeta}>
          <span>Agent v{AGENT_VERSION} · policy engine · 18 golden traces</span>
          <code>npm run eval</code>
        </div>
      </div>

      <div className={ev.honesty} role="note">
        <FlaskConical size={20} aria-hidden />
        <p><strong>Prototype stage.</strong> Synthetic traces and a mock agent; the policy engine is the real code. Human studies: {pilotNote}. Treat results as a pilot, not validation.</p>
      </div>

      <div className={ev.toggle} role="radiogroup" aria-label="Guardrails to evaluate">
        <span>Evaluate with</span>
        <button type="button" role="radio" aria-checked={!useMine} className={styles.chip} onClick={() => setUseMine(false)}>Default guardrails</button>
        <button type="button" role="radio" aria-checked={useMine} className={styles.chip} onClick={() => setUseMine(true)}>Your guardrails{customized ? ' (edited)' : ''}</button>
      </div>

      {/* ---------- §11 scorecard ---------- */}
      <section className={styles.panel} aria-labelledby="ev-score">
        <h3 id="ev-score" className={styles.h3}>Scorecard</h3>
        <div className={styles.tableScroll}>
          <table className={`${styles.table} ${ev.score}`}>
            <thead><tr><th scope="col">Test</th><th scope="col">Scenario</th><th scope="col">Measures</th><th scope="col">Result</th><th scope="col">Pass condition</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {scorecard.map((row) => (
                <tr key={row.test}>
                  <th scope="row"><a href={row.href}>{row.test}</a></th>
                  <td>{row.scenario}</td><td>{row.measures}</td><td>{row.metric}</td><td>{row.pass}</td><td><Pill s={row.status} n={pilot.sessions} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- §10 rollout ---------- */}
      <section className={styles.panel} aria-labelledby="ev-rollout">
        <h3 id="ev-rollout" className={styles.h3}>Rollout path</h3>
        <ol className={ev.stages}>
          {stages.map((x) => (
            <li key={x.id} className={x.id === r.stage.current ? ev.stageNow : x.ok ? ev.stageDone : undefined}>
              <span className={ev.stageName}>{x.name}{x.id === r.stage.current && <em> · current</em>}</span>
              <span>{x.detail}</span>
              <span className={ev.gate}>Gate to leave: {x.gate} <Pill s={x.ok ? 'pass' : x.id === 'limited_auto' || x.id === 'expanded_auto' ? 'not_run' : 'fail'} /></span>
            </li>
          ))}
        </ol>
        {r.stage.blockedBy.length > 0 && <p className={styles.muted}>Blocked by: {r.stage.blockedBy.join(', ')}.</p>}
      </section>

      {/* ---------- §3 safety ---------- */}
      <section className={styles.panel} id="ev-safety" aria-labelledby="ev-safety-t">
        <h3 id="ev-safety-t" className={styles.h3}>Safety invariants · binary gates</h3>
        <p className={styles.muted}>Adversarial injections against the policy engine, plus runtime checks across every trace. Any single violation blocks rollout.</p>
        <ul className={ev.checks}>
          {r.invariants.map((i) => (
            <li key={i.id}>
              <span className={ev.checkHead}><Pill s={i.status} /> <strong>{i.id}</strong> {i.name}</span>
              <span className={ev.checkDetail}>{i.checks} checks · {i.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- §4 replay ---------- */}
      <section className={styles.panel} id="ev-replay" aria-labelledby="ev-replay-t">
        <h3 id="ev-replay-t" className={styles.h3}>Offline replay vs baselines</h3>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr><th scope="col">Trace</th><th scope="col">Min above queue target<br />agent · reactive · static</th><th scope="col">Cost (6 h)<br />agent · reactive · static · oracle</th><th scope="col">Cost / player-hr</th><th scope="col">Waste</th><th scope="col">Regret</th><th scope="col">Flaps</th><th scope="col">Timing<br />early · on time · late</th><th scope="col">Status</th></tr>
            </thead>
            <tbody>
              {r.replay.map((x) => (
                <tr key={x.trace.id}>
                  <th scope="row">{x.trace.name}</th>
                  <td>{x.agent.minutesAboveTarget} · {x.reactive.minutesAboveTarget} · {x.static.minutesAboveTarget}</td>
                  <td>{fmtUsd(x.agent.totalCost)} · {fmtUsd(x.reactive.totalCost)} · {fmtUsd(x.static.totalCost)} · {fmtUsd(x.oracle.totalCost)}</td>
                  <td>${x.agent.costPerCcuHour.toFixed(4)}</td>
                  <td>{Math.round(x.agent.wastePct)}%</td>
                  <td>{x.regret.toFixed(2)}×</td>
                  <td>{x.agent.flaps}</td>
                  <td>{x.agent.timing.early} · {x.agent.timing.onTime} · {x.agent.timing.late}</td>
                  <td><Pill s={x.pass ? 'pass' : 'fail'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.muted}>Static over-provision is 2× the plan’s expected peak, so it fails whenever traffic beats the plan. Regret = agent cost ÷ perfect-hindsight oracle cost.</p>
      </section>

      {/* ---------- §5 accuracy ---------- */}
      <section className={styles.panel} id="ev-accuracy" aria-labelledby="ev-acc-t">
        <h3 id="ev-acc-t" className={styles.h3}>Prediction accuracy · does the card tell the truth?</h3>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th scope="col">Card claim</th><th scope="col">Scored claims</th><th scope="col">Result</th><th scope="col">Tolerance</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {r.accuracy.map((a) => (
                <tr key={a.claim}><th scope="row">{a.claim}</th><td>{a.n}</td><td>{a.error}</td><td>{a.tolerance}</td><td><Pill s={a.withinTolerance ? 'pass' : 'fail'} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {acc < r.accuracy.length && (
          <p className={ev.consequence}><EyeOff size={16} aria-hidden /> <span><strong>Design consequence:</strong> until the peak-waiting estimate passes, cards say “likely thousands” instead of an exact number. The live T+1h30m card already does.</span></p>
        )}
      </section>

      {/* ---------- §5 calibration ---------- */}
      <section className={styles.panel} id="ev-calibration" aria-labelledby="ev-cal-t">
        <h3 id="ev-cal-t" className={styles.h3}>Confidence calibration · the headline eval</h3>
        <div className={ev.calGrid}>
          <ReliabilityDiagram bins={r.calibration.bins} />
          <dl className={ev.calStats}>
            <div><dt>80%-confident band</dt><dd>{r.calibration.band80 ? `${pct(r.calibration.band80.accuracy)} right` : '—'}</dd><span>Target 70–90% · n={r.calibration.band80?.n ?? 0}</span></div>
            <div><dt>Brier score (shipped)</dt><dd>{r.calibration.brier.toFixed(3)}</dd><span>Lower is better; 0.25 = coin flip</span></div>
            <div><dt>Held-out set</dt><dd>{r.calibration.n} recs</dd><span>Red-team and abstention traces; {r.calibration.trainN} train recs</span></div>
            <div><dt>Calibration mapping</dt><dd>{r.calibration.shipCalibrator ? 'Shipped' : 'Not shipped'}</dd><span>Platt fit: held-out Brier {r.calibration.calibratedBrier.toFixed(3)} vs raw {r.calibration.rawBrier.toFixed(3)}</span></div>
            <Pill s={r.overall.calibration} />
          </dl>
        </div>
        <p className={styles.muted}>“Right” means the recommendation was needed and not oversized: without it headroom would have dropped below {g.headroomMinPct}%, and with it capacity stayed within {g.headroomMaxPct + 15}% of the window’s peak. Small bins (n &lt; 10) are noisy.</p>
      </section>

      {/* ---------- §6 abstention ---------- */}
      <section className={styles.panel} id="ev-abstention" aria-labelledby="ev-ab-t">
        <h3 id="ev-ab-t" className={styles.h3}>Abstention · when not to recommend</h3>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th scope="col">Trace</th><th scope="col">Correct behavior</th><th scope="col">Agent did</th><th scope="col">Right / ticks</th><th scope="col">Invented certainty</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {r.abstention.map((a) => (
                <tr key={a.trace.id}><th scope="row">{a.trace.name}</th><td>{a.expected}</td><td>{a.observed}</td><td>{a.correct}/{a.inWindow}</td><td>{a.invented}</td><td><Pill s={a.pass ? 'pass' : 'fail'} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.muted}>Recall {pct(r.abstentionTotals.recall)}: decision ticks inside these windows where the agent held back the right way. Precision {pct(r.abstentionTotals.precision)}: of all {r.abstentionTotals.totalAbstentions} “I don’t know” or “investigate” outputs across every trace, how many were justified.</p>
      </section>

      {/* ---------- §8 red team ---------- */}
      <section className={styles.panel} id="ev-redteam" aria-labelledby="ev-rt-t">
        <h3 id="ev-rt-t" className={styles.h3}>Red team · agent + policy engine together</h3>
        <ul className={ev.checks}>
          {r.redteam.map((t) => (
            <li key={t.id}>
              <span className={ev.checkHead}><Pill s={t.status} /> <strong>{t.name}</strong> {TRACES.find((x) => x.id === t.id)?.description}</span>
              <span className={ev.checkDetail}>{t.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <TraceViewer guardrails={g} />

      {/* ---------- §7 HITL ---------- */}
      <section className={styles.panel} id="ev-hitl" aria-labelledby="ev-hitl-t">
        <div className={styles.panelHead}>
          <h3 id="ev-hitl-t">Human-in-the-loop studies</h3>
          <Link to={`/builds/${encodeURIComponent(buildId)}/scale/evals/study`} className={ev.studyLink}>Run a pilot session</Link>
        </div>
        <p className={styles.muted}>Moderated, think-aloud, 5–8 participants. Every participant sees the same fixed cards: 3 sound and 3 deliberately flawed (wrong math, missing evidence, exceeds a guardrail).</p>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th scope="col">Test</th><th scope="col">Pass condition</th><th scope="col">Result</th><th scope="col">Status</th></tr></thead>
            <tbody>
              <tr><th scope="row">Comprehension</th><td>≥ 80% answer all three unaided</td><td>{pct(pilot.comprehension)}</td><td><Pill s={st(pilot.comprehension, (v) => v >= 0.8)} n={pilot.sessions} /></td></tr>
              <tr><th scope="row">Decision quality</th><td>Approve ≥ 80% good, reject ≥ 80% flawed</td><td>{pct(pilot.approveGood)} · {pct(pilot.rejectFlawed)}</td><td><Pill s={st(pilot.approveGood !== null && pilot.rejectFlawed !== null ? Math.min(pilot.approveGood, pilot.rejectFlawed) : null, (v) => v >= 0.8)} n={pilot.sessions} /></td></tr>
              <tr><th scope="row">Countdown behavior</th><td>Median &lt; 5 min; rubber-stamping &lt; 20%</td><td>{pilot.medianDecisionSec ?? '—'} s · {pct(pilot.rubberStamp)}</td><td><Pill s={st(pilot.medianDecisionSec, (v) => v < 300 && (pilot.rubberStamp ?? 0) < 0.2)} n={pilot.sessions} /></td></tr>
              <tr><th scope="row">Evidence panel A/B</th><td>Panel group rejects flawed cards better</td><td>Shown {pct(pilot.byCondition.shown.rejectFlawed)} (n={pilot.byCondition.shown.n}) · collapsed {pct(pilot.byCondition.collapsed.rejectFlawed)} (n={pilot.byCondition.collapsed.n})</td><td><Pill s="not_run" /></td></tr>
              <tr><th scope="row">Guardrail comprehension</th><td>≥ 80% state the delegation tiers</td><td>{pct(pilot.guardrailComprehension)}</td><td><Pill s={st(pilot.guardrailComprehension, (v) => v >= 0.8)} n={pilot.sessions} /></td></tr>
              <tr><th scope="row">Delegation decisions</th><td>Can say what they delegate and how to revoke it</td><td>{pct(pilot.delegation)}</td><td><Pill s={st(pilot.delegation, (v) => v >= 0.8)} n={pilot.sessions} /></td></tr>
            </tbody>
          </table>
        </div>
        <p className={styles.muted}>A/B needs a significance test with real numbers of participants; with a pilot it stays “not run”. Sessions are stored in this browser only.</p>
        {sessions.length > 0 && (
          <div className={styles.row}>
            <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(JSON.stringify(sessions, null, 2)).catch(() => undefined); }}>Copy session data</Button>
            <Button size="sm" variant="text" onClick={() => { clearSessions(); setSessionsVersion((v) => v + 1); }}>Clear pilot data</Button>
          </div>
        )}
      </section>

      {/* ---------- history ---------- */}
      <section className={styles.panel} aria-labelledby="ev-hist">
        <h3 id="ev-hist" className={styles.h3}>Run history</h3>
        <ol className={ev.history}>
          {EVAL_HISTORY.map((h) => (
            <li key={h.run}>
              <span className={ev.histHead}><strong>Run {h.run}</strong> · agent {h.agent} · {h.change}</span>
              <span>{h.result}</span>
              <span className={styles.muted}>{h.found}</span>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}

const GROUPS: { id: TraceGroup; label: string }[] = [
  { id: 'scenario', label: 'Scenarios' }, { id: 'realistic', label: 'Realistic' }, { id: 'abstention', label: 'Abstention' }, { id: 'redteam', label: 'Red team' },
];

function TraceViewer({ guardrails }: { guardrails: typeof DEFAULT_GUARDRAILS }) {
  const [id, setId] = useState('rt-outage');
  const tr = TRACES.find((t) => t.id === id)!;
  const run = useMemo(() => runTrace(tr, 'agent', guardrails), [tr, guardrails]);
  const step = 5;
  const pts = run.minutes.filter((m) => m.t % step === 0);
  const x = pts.map((m) => m.t);
  const gaps = (tr.telemetryGaps ?? []) as [number, number][];
  const events = run.decisions.filter((d) => d.output.kind !== 'none');
  const label = (k: string, d: (typeof events)[number]) => {
    const o = d.output;
    if (o.kind === 'scale') return `${o.direction === 'up' ? 'Scale up +' : 'Scale down −'}${o.instances} · ${Math.round(o.confidence * 100)}% confident`;
    if (o.kind === 'abstain') return o.reason === 'stale_telemetry' ? 'Operating blind: metrics feed down' : `Not enough data: ${o.waitingFor}`;
    if (o.kind === 'investigate') return `Investigate: ${o.detail}`;
    if (o.kind === 'tradeoff') return `Trade-off for a person: ${o.options.map((p) => p.label).join(' / ')}`;
    return k;
  };

  return (
    <section className={styles.panel} aria-labelledby="ev-trace">
      <h3 id="ev-trace" className={styles.h3}>Trace viewer</h3>
      <div className={ev.traceGroups}>
        {GROUPS.map((gr) => (
          <div key={gr.id} role="group" aria-label={gr.label} className={ev.traceGroup}>
            <span>{gr.label}</span>
            {TRACES.filter((t) => t.group === gr.id).map((t) => (
              <button key={t.id} type="button" className={styles.chip} aria-pressed={t.id === id} onClick={() => setId(t.id)}>{t.name}</button>
            ))}
          </div>
        ))}
      </div>
      <p className={styles.muted}>{tr.description}. Operator responds {tr.operatorDelayMin === null ? 'never (nobody online)' : `after ${tr.operatorDelayMin} min`}.</p>
      {gaps.length > 0 && (
        <div className={ev.blind} role="note"><EyeOff size={18} aria-hidden /> <span><strong>Operating blind {gaps.map(([a, b]) => `${fmtT(a)}–${fmtT(b)}`).join(', ')}.</strong> The metrics feed is down: the agent stops recommending, the policy engine blocks every execution, and the console greys out numbers older than 3 minutes instead of showing them as live.</span></div>
      )}
      <div className={styles.simCharts}>
        <div>
          <TimeSeriesChart ariaLabel={`${tr.name}: demand and capacity`} x={x} xFormat={fmtT} yFormat={fmtCompact}
            series={[
              { id: 'demand', label: 'Demand', color: 'var(--chart-categorical-1)', values: pts.map((m) => m.demand) },
              { id: 'capacity', label: 'Agent capacity', color: 'var(--chart-reference)', values: pts.map((m) => m.capacity) },
            ]}
            alertRanges={gaps} height={220} />
        </div>
        <div>
          <TimeSeriesChart ariaLabel={`${tr.name}: queue wait`} x={x} xFormat={fmtT} yFormat={(v) => `${Math.round(v)} s`}
            series={[{ id: 'queue', label: 'Queue wait p95', color: 'var(--chart-categorical-2)', values: pts.map((m) => Math.min(300, m.queueP95)) }]}
            references={[{ y: guardrails.maxQueueWaitSec, label: `Target ${guardrails.maxQueueWaitSec} s` }]} alertRanges={gaps} yMax={300} height={220} />
        </div>
      </div>
      <div className={`${styles.tableScroll} ${ev.timeline}`}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Time</th><th scope="col">Agent</th><th scope="col">Policy route</th><th scope="col">Executed</th></tr></thead>
          <tbody>
            {events.slice(0, 60).map((d) => (
              <tr key={d.t}>
                <td>{fmtT(d.t)}</td>
                <th scope="row">{label(d.output.kind, d)}</th>
                <td>{d.routedTo ?? '—'}{d.policy?.rule && d.policy.rule !== 'tier' ? ` · ${d.policy.rule.replace(/_/g, ' ')}` : ''}</td>
                <td>{d.executedAt != null ? `${fmtT(d.executedAt)} · ${d.executedDelta! > 0 ? '+' : ''}${d.executedDelta}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {events.length > 60 && <p className={styles.muted}>Showing the first 60 of {events.length} agent outputs.</p>}
    </section>
  );
}
