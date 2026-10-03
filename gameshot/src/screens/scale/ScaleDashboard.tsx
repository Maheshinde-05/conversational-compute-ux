import { useMemo, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, CheckCircle2, ClipboardCheck, Sparkles } from 'lucide-react';
import { AgenticCard } from '../../components/scale/AgenticCard';
import { Meter, type MeterTone } from '../../components/scale/Meter';
import { TimeSeriesChart } from '../../components/scale/TimeSeriesChart';
import { fmtClock, useNow } from '../../components/scale/useNow';
import { Button } from '../../components/Button';
import { ACTION_MARKERS, ACTUAL_KEYS, CAPACITY_KEYS, CARDS, EXPECTED_KEYS, MOMENTS, PRICE_PER_INSTANCE_HR, CCU_PER_INSTANCE } from '../../data/scale-mock';
import { fmtCompact, fmtInt, fmtT, fmtUsd, interp, range } from '../../logic/scaleSim';
import { useScale } from '../../state/ScaleContext';
import styles from './Scale.module.css';

const STATE_COPY = {
  onplan: { icon: CheckCircle2, label: 'On plan', tone: 'onplan' as MeterTone },
  diverging: { icon: AlertTriangle, label: 'Diverging from plan', tone: 'diverging' as MeterTone },
  critical: { icon: AlertOctagon, label: 'Queue target at risk', tone: 'critical' as MeterTone },
  review: { icon: ClipboardCheck, label: 'Launch complete', tone: 'onplan' as MeterTone },
};

export function ScaleDashboard() {
  const { buildId = '' } = useParams();
  const s = useScale();
  const now = useNow();
  const m = MOMENTS[s.momentIndex];
  const g = s.guardrails;
  const review = m.state === 'review';
  const nowT = review ? 360 : m.t;
  const copy = STATE_COPY[m.state];

  const chart = useMemo(() => {
    const x = range(-60, 360, 15);
    const actual = x.map((t) => (t <= nowT ? interp(ACTUAL_KEYS, t) : null));
    const capacity = x.map((t) => (t <= nowT ? interp(CAPACITY_KEYS, t) : null));
    const forecastOn = (t: number) => !review && t >= nowT && t <= nowT + 90;
    const forecast = x.map((t) => (forecastOn(t) ? interp(ACTUAL_KEYS, t) * 1.04 : null));
    const spread = (t: number) => 0.06 + ((t - nowT) / 90) * 0.14;
    return {
      x,
      series: [
        { id: 'actual', label: 'Actual CCU', color: 'var(--chart-categorical-1)', values: actual },
        { id: 'forecast', label: 'Forecast', color: 'var(--chart-categorical-1)', dashed: true, values: forecast,
          band: { lo: x.map((t, i) => (forecast[i] != null ? forecast[i]! * (1 - spread(t)) : null)), hi: x.map((t, i) => (forecast[i] != null ? forecast[i]! * (1 + spread(t)) : null)) } },
        { id: 'plan', label: 'Plan v3 expected', color: 'var(--chart-categorical-2)', values: x.map((t) => interp(EXPECTED_KEYS, t)) },
        { id: 'capacity', label: 'Provisioned capacity', color: 'var(--chart-reference)', values: capacity },
      ],
      markers: ACTION_MARKERS.filter((a) => a.t <= nowT).map((a) => ({ x: a.t, label: a.label })),
    };
  }, [nowT, review]);

  const urgent = m.cardIds.map((id) => CARDS[id]).find((c) => c.kind === 'approval' && s.cardStates[c.id].status === 'open');
  const urgentLeft = urgent && s.deadlines[urgent.id] ? s.deadlines[urgent.id] - now : null;

  const reviewStats = useMemo(() => {
    const capHours = range(-60, 360, 5).reduce((a, t) => a + interp(CAPACITY_KEYS, t) / 12, 0) + 18 * 39000;
    const instHours = capHours / CCU_PER_INSTANCE;
    const playerHours = range(-60, 360, 5).reduce((a, t) => a + interp(ACTUAL_KEYS, t) / 12, 0) + 18 * 45000;
    return { cost: instHours * PRICE_PER_INSTANCE_HR, perPlayerHour: (instHours * PRICE_PER_INSTANCE_HR) / playerHours };
  }, []);
  const decisions = s.audit.filter((a) => a.phase === 'launch' && (a.decision === 'Auto' || a.decision === 'Approved' || a.decision === 'Declined' || a.decision === 'Held'));

  return (
    <section aria-labelledby="live-title" className={styles.page}>
      <div className={styles.replay} role="group" aria-label="Launch-day replay">
        <span className={styles.replayLabel}>Launch-day replay <em>(demo)</em></span>
        {MOMENTS.map((x, i) => (
          <button key={x.id} type="button" className={styles.chip} aria-pressed={i === s.momentIndex} onClick={() => s.setMomentIndex(i)}>
            {x.label}
          </button>
        ))}
      </div>

      <header className={`${styles.stateBanner} ${styles[`state_${m.state}`]}`}>
        <copy.icon size={22} aria-hidden />
        <div>
          <h2 id="live-title">{copy.label}</h2>
          <p>
            {review
              ? 'Traffic is back on the plan’s curve. The post-launch review is below.'
              : m.state === 'onplan'
                ? 'Traffic matches the plan. Nothing needs you right now.'
                : `Traffic is ${(m.ccu / m.expectedCcu).toFixed(1)}× the plan’s curve at ${m.label}.`}
            {m.playersWaiting > 0 && <> <strong>{fmtInt(m.playersWaiting)} players waiting</strong>, queue wait p95 {m.queueP95Sec} s.</>}
          </p>
        </div>
        {urgent && (
          <a href={`#${urgent.id}-t`} className={styles.urgentPill}>
            Decision needed · <strong>{urgentLeft !== null && urgentLeft > 0 ? fmtClock(urgentLeft) : 'now'}</strong>
          </a>
        )}
      </header>

      <div className={styles.hero}>
        <div className={styles.heroFigure}>
          <span className={styles.heroLabel}>Concurrent players</span>
          <span className={styles.heroValue}>{fmtInt(m.ccu)}</span>
          <span className={styles.heroDetail}>Plan expected {fmtInt(m.expectedCcu)} at {m.label}</span>
        </div>
        <Meter
          label="Queue wait p95"
          value={`${m.queueP95Sec} s`}
          detail={`Target under ${g.maxQueueWaitSec} s${m.playersWaiting ? ` · ${fmtInt(m.playersWaiting)} waiting` : ''}`}
          fraction={m.queueP95Sec / (g.maxQueueWaitSec * 1.5)}
          tone={m.queueP95Sec > g.maxQueueWaitSec * 0.5 ? 'critical' : m.queueP95Sec > 15 ? 'diverging' : 'onplan'}
          target={{ from: 1 / 1.5, label: `${g.maxQueueWaitSec} s target` }}
        />
        <Meter
          label="Capacity headroom"
          value={`${m.headroomPct}%`}
          detail={`Target ${g.headroomMinPct}–${g.headroomMaxPct}%`}
          fraction={m.headroomPct / 60}
          tone={m.headroomPct < 10 ? 'critical' : m.headroomPct < g.headroomMinPct || m.headroomPct > g.headroomMaxPct + 10 ? 'diverging' : 'onplan'}
          target={{ from: g.headroomMinPct / 60, to: g.headroomMaxPct / 60, label: 'Target range' }}
        />
        <Meter
          label="Cost burn"
          value={`${fmtUsd(m.costPerHour)}/hr`}
          detail={`Budget ${fmtUsd(m.budgetPerHour)}/hr${m.budgetPerHour > g.maxHourlySpend ? ' (raised for launch window)' : ''}`}
          fraction={m.costPerHour / m.budgetPerHour}
          tone={m.costPerHour / m.budgetPerHour > 0.9 ? 'critical' : m.costPerHour / m.budgetPerHour > 0.75 ? 'diverging' : 'onplan'}
          target={{ from: 1, label: 'Budget' }}
        />
      </div>

      <div className={styles.liveGrid}>
        <div className={styles.liveMain}>
          <section className={styles.panel} aria-labelledby="ccu-title">
            <div className={styles.panelHead}>
              <h3 id="ccu-title">Concurrent players vs plan</h3>
              <span className={styles.muted}>{review ? 'Launch window T−1h to T+6h' : `Forecast to ${fmtT(nowT + 90)} with confidence band`}</span>
            </div>
            <TimeSeriesChart
              ariaLabel="Concurrent players: actual, forecast, plan and provisioned capacity"
              x={chart.x}
              xFormat={fmtT}
              yFormat={fmtCompact}
              series={chart.series}
              markers={chart.markers}
              nowX={review ? undefined : nowT}
              height={300}
            />
          </section>

          <section className={styles.panel} aria-labelledby="regions-title">
            <div className={styles.panelHead}>
              <h3 id="regions-title">Regions</h3>
              <span className={styles.muted}>The agent’s recommendations reference these numbers</span>
            </div>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr><th scope="col">Region</th><th scope="col">CCU</th><th scope="col">Headroom</th><th scope="col">Latency p95</th><th scope="col">Queue depth</th></tr>
                </thead>
                <tbody>
                  {m.regions.map((r) => (
                    <tr key={r.id}>
                      <th scope="row">{r.id}{r.note && <span className={styles.regionNote}><AlertTriangle size={12} aria-hidden /> {r.note}</span>}</th>
                      <td>{fmtInt(r.ccu)}</td>
                      <td><Status bad={r.headroomPct < 10} warn={r.headroomPct < g.headroomMinPct}>{r.headroomPct}%</Status></td>
                      <td><Status bad={r.latencyMs > g.regionalLatencyMs} warn={r.latencyMs > g.regionalLatencyMs * 0.75}>{r.latencyMs} ms</Status></td>
                      <td><Status bad={r.queueDepth > 1000} warn={r.queueDepth > 0}>{fmtInt(r.queueDepth)}</Status></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {review && (
            <section className={styles.panel} aria-labelledby="review-title">
              <div className={styles.panelHead}>
                <h3 id="review-title">Post-launch review</h3>
                <Link to={`/builds/${encodeURIComponent(buildId)}/scale/audit`} className={styles.link}>Open the audit log</Link>
              </div>
              <dl className={styles.reviewStats}>
                <div><dt>Peak vs plan</dt><dd>103,000 vs 30,000</dd><span>3.4× the expected curve</span></div>
                <div><dt>Cost, first 24 h</dt><dd>{fmtUsd(reviewStats.cost)}</dd><span>{`$${reviewStats.perPlayerHour.toFixed(4)} per player-hour`}</span></div>
                <div><dt>Time above queue target</dt><dd>{s.cardStates['c-approve90'].status === 'executed' && s.cardStates['c-approve90'].chosen !== 'partial' ? '0 min' : '~25 min'}</dd><span>Target p95 under {g.maxQueueWaitSec} s</span></div>
                <div><dt>Decisions</dt><dd>{decisions.filter((d) => d.decision === 'Auto').length} auto · {decisions.filter((d) => d.decision !== 'Auto').length} by people</dd><span>Every one is in the audit log</span></div>
              </dl>
              <p className={styles.muted}>What to change next time: start the launch phase from the AI-generated curve (peak near 96k) instead of the 30k manual curve, and raise the warm buffer for eu-west-1.</p>
            </section>
          )}
        </div>

        <aside className={styles.rail} aria-label="Agent recommendations">
          {s.suggestion === 'open' && (
            <div className={styles.suggestion} role="status">
              <Sparkles size={18} aria-hidden />
              <div>
                <strong>You’ve approved 6 scale-ups in us-east-1 this launch.</strong>
                <p>Let the agent auto-execute them up to $75 per action? You can change this any time in Guardrails.</p>
                <div className={styles.row}>
                  <Button size="sm" onClick={s.acceptSuggestion}>Auto-execute up to $75</Button>
                  <Button size="sm" variant="text" onClick={s.dismissSuggestion}>Not now</Button>
                </div>
              </div>
            </div>
          )}
          {s.suggestion === 'accepted' && <p className={styles.muted}>Auto-execute cap for us-east-1 scale-ups is now $75 per action.</p>}
          {m.cardIds.map((id) => (
            <AgenticCard
              key={id}
              card={CARDS[id]}
              state={s.cardStates[id]}
              deadline={s.deadlines[id]}
              onApprove={(c) => s.approve(id, c)}
              onDecline={(r) => s.decline(id, r)}
              onRollBack={() => s.rollBack(id)}
              onHold={() => s.hold(id)}
            />
          ))}
        </aside>
      </div>
    </section>
  );
}

function Status({ bad, warn, children }: { bad?: boolean; warn?: boolean; children: ReactNode }) {
  const label = bad ? 'Critical' : warn ? 'Watch' : null;
  return (
    <span className={bad ? styles.bad : warn ? styles.warn : undefined}>
      {children}
      {label && <span className="visually-hidden"> ({label})</span>}
      {bad && <AlertOctagon size={12} aria-hidden className={styles.statusIcon} />}
      {!bad && warn && <AlertTriangle size={12} aria-hidden className={styles.statusIcon} />}
    </span>
  );
}
