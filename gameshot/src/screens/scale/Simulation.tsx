import { useMemo, useState } from 'react';
import { AlertOctagon, CheckCircle2, UserRound } from 'lucide-react';
import { Badge } from '../../components/Badge';
import { TimeSeriesChart } from '../../components/scale/TimeSeriesChart';
import { SCENARIOS, fmtCompact, fmtInt, fmtT, fmtUsd, latestUsefulResponse, simulate } from '../../logic/scaleSim';
import { useScale } from '../../state/ScaleContext';
import styles from './Scale.module.css';

const RESPONSES: { label: string; value: number | null }[] = [
  { label: '5 min', value: 5 },
  { label: '12 min', value: 12 },
  { label: '30 min', value: 30 },
  { label: 'Nobody responds', value: null },
];
const RISK_TONE = { low: 'riskLow', medium: 'riskMedium', high: 'riskHigh' } as const;

export function Simulation() {
  const s = useScale();
  const [scenarioId, setScenarioId] = useState('viral');
  const [response, setResponse] = useState<number | null>(12);
  const [useDraft, setUseDraft] = useState(false);
  const plan = useDraft && s.draft ? s.draft : s.armedConfig;
  const g = s.guardrails;
  const scenario = SCENARIOS.find((x) => x.id === scenarioId)!;

  const result = useMemo(() => simulate(scenario, plan, g, response), [scenario, plan, g, response]);
  const latest = useMemo(() => latestUsefulResponse(scenario, plan, g), [scenario, plan, g]);
  const all = useMemo(() => SCENARIOS.map((sc) => ({ sc, r: simulate(sc, plan, g, response) })), [plan, g, response]);

  const x = result.points.map((p) => p.t);
  const minutesOver = result.breaches.reduce((a, [b, e]) => a + (e - b + 5), 0);
  const markers = [
    ...(result.approvalNeededAt !== null ? [{ x: result.approvalNeededAt, label: 'Caps hit: person needed' }] : []),
    ...(result.humanActsAt !== null && result.humanActsAt <= 360 ? [{ x: result.humanActsAt, label: 'Person approves' }] : []),
  ];

  return (
    <section aria-labelledby="sim-title" className={styles.page}>
      <div>
        <h2 id="sim-title" className={styles.h2}>Simulate before you arm</h2>
        <p className={styles.intro}>Run the plan against launch scenarios to see where the queue target breaks, what it costs, and when a person would have to step in.</p>
      </div>

      <div className={styles.scenarios} role="radiogroup" aria-label="Scenario">
        {SCENARIOS.map((sc) => (
          <button key={sc.id} type="button" role="radio" aria-checked={sc.id === scenarioId} className={styles.scenario} onClick={() => setScenarioId(sc.id)}>
            <strong>{sc.name}</strong>
            <span>{sc.tests}</span>
          </button>
        ))}
      </div>

      <div className={styles.simControls}>
        <div className={styles.controlGroup} role="radiogroup" aria-label="Human response time">
          <span className={styles.controlLabel}><UserRound size={16} aria-hidden /> If a person is needed, they respond in</span>
          {RESPONSES.map((r) => (
            <button key={r.label} type="button" role="radio" aria-checked={response === r.value} className={styles.chip} onClick={() => setResponse(r.value)}>{r.label}</button>
          ))}
        </div>
        {s.draft && (
          <label className={styles.inlineCheck}>
            <input type="checkbox" checked={useDraft} onChange={(e) => setUseDraft(e.target.checked)} /> Simulate the unsaved draft
          </label>
        )}
      </div>

      <div className={`${styles.callout} ${result.breaches.length ? styles.calloutBad : styles.calloutOk}`} role="status">
        {result.breaches.length ? <AlertOctagon size={22} aria-hidden /> : <CheckCircle2 size={22} aria-hidden />}
        <div>
          <strong>
            {result.approvalNeededAt === null
              ? 'The plan handles this on its own. No person is needed.'
              : `At ${fmtT(result.approvalNeededAt)} your auto-approval caps are hit.`}
          </strong>
          <p>
            {result.approvalNeededAt !== null && (latest === null
              ? 'Even an instant approval can’t prevent a queue breach: capacity can’t start fast enough. Raise the ramp step or warm buffer.'
              : latest >= 120
                ? 'Headroom absorbs the wait, so the queue target holds even if nobody responds for two hours.'
                : `A person has about ${latest} minutes to approve before queue wait passes ${g.maxQueueWaitSec} s. `)}
            {result.breaches.length
              ? `With ${response === null ? 'nobody responding' : `a ${response}-minute response`}, queue wait exceeds the target from ${fmtT(result.breaches[0][0])} for ${minutesOver} minutes, with up to ${fmtInt(result.peakWaiting)} players waiting.`
              : result.approvalNeededAt !== null ? `With a ${response}-minute response, queue wait stays under the target.` : ''}
          </p>
        </div>
      </div>

      <dl className={styles.simStats}>
        <div><dt>Risk</dt><dd><Badge tone={RISK_TONE[result.risk]}>{result.risk[0].toUpperCase() + result.risk.slice(1)}</Badge></dd></div>
        <div><dt>Projected cost, 6 h</dt><dd>{fmtUsd(result.totalCost)}</dd></div>
        <div><dt>Peak queue wait p95</dt><dd>{result.peakQueue >= 600 ? '10 min +' : `${Math.round(result.peakQueue)} s`}</dd></div>
        <div><dt>Time above target</dt><dd>{minutesOver} min</dd></div>
        <div><dt>Average headroom</dt><dd>{Math.round(result.avgHeadroom)}%</dd></div>
      </dl>

      <div className={styles.simCharts}>
        <section className={styles.panel} aria-labelledby="sim-ccu">
          <h3 id="sim-ccu" className={styles.h3}>Demand vs capacity</h3>
          <TimeSeriesChart ariaLabel="Simulated demand and capacity" x={x} xFormat={fmtT} yFormat={fmtCompact}
            series={[
              { id: 'demand', label: 'Demand', color: 'var(--chart-categorical-1)', values: result.points.map((p) => p.demand) },
              { id: 'capacity', label: 'Capacity', color: 'var(--chart-reference)', values: result.points.map((p) => p.capacity) },
            ]}
            markers={markers} height={240} />
        </section>
        <section className={styles.panel} aria-labelledby="sim-queue">
          <h3 id="sim-queue" className={styles.h3}>Queue wait p95</h3>
          <TimeSeriesChart ariaLabel="Simulated queue wait against the target" x={x} xFormat={fmtT} yFormat={(v) => `${Math.round(v)} s`}
            series={[{ id: 'queue', label: 'Queue wait p95', color: 'var(--chart-categorical-2)', values: result.points.map((p) => Math.min(p.queueP95, 300)) }]}
            references={[{ y: g.maxQueueWaitSec, label: `Target ${g.maxQueueWaitSec} s` }]} alertRanges={result.breaches} markers={markers} yMax={300} height={200} />
        </section>
        <section className={styles.panel} aria-labelledby="sim-head">
          <h3 id="sim-head" className={styles.h3}>Headroom</h3>
          <TimeSeriesChart ariaLabel="Simulated capacity headroom against the target range" x={x} xFormat={fmtT} yFormat={(v) => `${Math.round(v)}%`}
            series={[{ id: 'headroom', label: 'Headroom', color: 'var(--chart-categorical-1)', values: result.points.map((p) => p.headroomPct) }]}
            targetBand={{ y0: g.headroomMinPct, y1: g.headroomMaxPct, label: `Target ${g.headroomMinPct}–${g.headroomMaxPct}%` }} yMax={100} height={200} />
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="sim-all">
        <h3 id="sim-all" className={styles.h3}>All scenarios with this plan</h3>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr><th scope="col">Scenario</th><th scope="col">Risk</th><th scope="col">Person needed at</th><th scope="col">Time above target</th><th scope="col">Cost, 6 h</th></tr></thead>
            <tbody>
              {all.map(({ sc, r }) => (
                <tr key={sc.id} aria-current={sc.id === scenarioId}>
                  <th scope="row"><button type="button" className={styles.linkBtn} onClick={() => setScenarioId(sc.id)}>{sc.name}</button></th>
                  <td><Badge tone={RISK_TONE[r.risk]}>{r.risk[0].toUpperCase() + r.risk.slice(1)}</Badge></td>
                  <td>{r.approvalNeededAt === null ? 'Not needed' : fmtT(r.approvalNeededAt)}</td>
                  <td>{r.breaches.reduce((a, [b, e]) => a + (e - b + 5), 0)} min</td>
                  <td>{fmtUsd(r.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
