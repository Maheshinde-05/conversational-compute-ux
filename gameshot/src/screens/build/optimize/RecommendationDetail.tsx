import { useState } from 'react';
import { AlertTriangle, Clock, Info, RefreshCw, RotateCcw } from 'lucide-react';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { LineChart } from '../../../components/LineChart';
import { ROUTE_LABELS, TIER_LABELS } from '../../../logic/riskPolicy';
import { useRecommendations, type EnrichedRec } from '../../../state/RecommendationsContext';
import { ApprovalModal } from './ApprovalModal';
import { RejectForm } from './RejectForm';
import { costLabel, tierTone } from './format';
import styles from './Optimize.module.css';

const INFLUENCE_BARS = { strong: 3, moderate: 2, weak: 1 } as const;
const CHART_COLORS = ['var(--chart-categorical-1)', 'var(--chart-categorical-2)'];

export function RecommendationDetail({ rec }: { rec: EnrichedRec }) {
  const { policy, approve, applyDigest, reject, runNow, rollBack, cancel, reanalyze } = useRecommendations();
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [changeWindow, setChangeWindow] = useState(policy.changeWindows[0] ?? '');

  if (rec.state.analyzing) {
    return (
      <article className={styles.detail} aria-busy="true">
        <div className={styles.analyzing}>
          <RefreshCw size={20} aria-hidden className={styles.spin} />
          <p>Analyzing with the latest signals…</p>
        </div>
        <div className={styles.skeleton} />
        <div className={styles.skeleton} style={{ width: '70%' }} />
        <div className={styles.skeleton} style={{ width: '85%' }} />
      </article>
    );
  }

  const current = rec.freshness === 'current';
  const canary = policy.requireCanaryFor.includes(rec.facts.actionType);
  const required = rec.risk.tier === 'high' ? policy.approvers.high : policy.approvers.medium;
  const modelLower = !rec.risk.raisedByModel && rec.modelSuggestedRisk !== rec.risk.tier;

  return (
    <article className={styles.detail} aria-labelledby="rec-title">
      <header className={styles.detailHead}>
        <div className={styles.detailBadges}>
          <Badge tone={tierTone[rec.risk.tier]}>{TIER_LABELS[rec.risk.tier]}</Badge>
          <Badge tone="info">{ROUTE_LABELS[rec.route]}</Badge>
        </div>
        <h3 id="rec-title" className={styles.detailTitle}>{rec.summary}</h3>
        <p className={styles.detailMeta}>
          {rec.target} · Generated {rec.generatedAt} · {rec.freshness === 'expired' ? 'Expired' : `Expires in ${rec.expiresIn}`}
        </p>
      </header>

      {rec.freshness === 'expired' && (
        <div className={`${styles.banner} ${styles.bannerMuted}`} role="status">
          <Clock size={18} aria-hidden />
          <span>This recommendation expired after {policy.expiryHours} hours. Its evidence may be out of date.</span>
          <Button variant="outline" size="sm" onClick={() => reanalyze(rec.id)}>Re-analyze</Button>
        </div>
      )}
      {rec.freshness === 'stale' && (
        <div className={`${styles.banner} ${styles.bannerWarn}`} role="status">
          <AlertTriangle size={18} aria-hidden />
          <span>Signals changed since this was generated. Re-analyze before approving.</span>
          <Button variant="outline" size="sm" onClick={() => reanalyze(rec.id)}>Re-analyze</Button>
        </div>
      )}
      {rec.rationale === null && (
        <div className={`${styles.banner} ${styles.bannerInfo}`} role="note">
          <Info size={18} aria-hidden />
          <span>Explanation unavailable. This is the best option from the rules engine; the model didn’t return a usable explanation.</span>
        </div>
      )}

      <dl className={styles.facts}>
        <div>
          <dt>Change</dt>
          <dd>
            <span className={styles.from}>{rec.change.from}</span>
            <span aria-hidden> → </span>
            <strong>{rec.change.to}</strong>
          </dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd className={rec.facts.monthlyCostDelta < 0 ? styles.saving : undefined}>{costLabel(rec.facts.monthlyCostDelta)}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>
            <strong className={styles.capitalize}>{rec.confidence.level}</strong>
            <span className={styles.basis}>{rec.confidence.basis}</span>
          </dd>
        </div>
      </dl>

      {rec.rationale && (
        <section className={styles.section}>
          <h4>Why</h4>
          <p className={styles.rationale}>{rec.rationale}</p>
        </section>
      )}

      <section className={styles.section}>
        <h4>Evidence</h4>
        <ul className={styles.evidence}>
          {rec.evidence.map((e) => (
            <li key={e.signalId}>
              <span className={styles.evLabel}>{e.label}</span>
              <span className={styles.evValue}>{e.value}</span>
              <span className={styles.meter} aria-label={`${e.influence} influence`} title={`${e.influence} influence`}>
                {[1, 2, 3].map((n) => (
                  <i key={n} className={n <= INFLUENCE_BARS[e.influence] ? styles.meterOn : undefined} />
                ))}
              </span>
              {e.note && <span className={styles.evNote}>{e.note}</span>}
            </li>
          ))}
        </ul>
        {rec.chart && (
          <div className={styles.chart}>
            <LineChart
              xLabels={rec.chart.xLabels}
              series={rec.chart.series.map((s, i) => ({ ...s, color: CHART_COLORS[i % CHART_COLORS.length] }))}
            />
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h4>Missing data</h4>
        {rec.missingData.length === 0 ? (
          <p className={styles.muted}>None. All expected signals were available.</p>
        ) : (
          <ul className={styles.missing}>
            {rec.missingData.map((m) => (
              <li key={m.signal}>
                <strong>{m.signal}</strong>
                <span>{m.impact}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h4>Why it’s {TIER_LABELS[rec.risk.tier].toLowerCase()}</h4>
        <ul className={styles.reasons}>
          {rec.risk.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className={styles.muted}>
          {rec.risk.raisedByModel
            ? 'The model rated this riskier than the policy rules, so the higher rating applies.'
            : modelLower
              ? `The model suggested ${TIER_LABELS[rec.modelSuggestedRisk].toLowerCase()}. Your policy rules set the rating, and the model can only raise it.`
              : 'The model and your policy rules agree.'}
        </p>
      </section>

      <section className={styles.section}>
        <h4>Rollback plan</h4>
        <p>{rec.rollbackPlan}</p>
        {rec.risk.tier !== 'low' && (
          <p className={styles.muted}>{canary ? 'Rolls out to 10% of new sessions first.' : 'Rolls out to the whole target at once.'}</p>
        )}
      </section>

      <footer className={styles.actionBar}>
        {rejecting ? (
          <RejectForm onReject={(reason) => { reject(rec.id, reason); setRejecting(false); }} onCancel={() => setRejecting(false)} />
        ) : (
          renderActions()
        )}
      </footer>

      {rec.route === 'explicit' && <ApprovalModal rec={rec} open={approving} onClose={() => setApproving(false)} />}
    </article>
  );

  function renderActions() {
    const s = rec.displayStatus;
    if (rec.freshness === 'expired') return <p className={styles.muted}>Re-analyze to get a current recommendation.</p>;

    if (s === 'pending') {
      const rejectBtn = <Button variant="text" onClick={() => setRejecting(true)}>Reject</Button>;
      if (rec.route === 'digest')
        return (
          <div className={styles.actions}>
            <p className={styles.actionNote}>Waiting in the low-risk digest. Apply it now or with the rest of the batch.</p>
            <Button disabled={!current} onClick={() => applyDigest([rec.id])}>Apply now</Button>
            {rejectBtn}
          </div>
        );
      if (rec.route === 'scheduled')
        return (
          <div className={styles.actions}>
            <p className={styles.actionNote}>Needs one approval from {required.join(' or ')}.</p>
            <label className={styles.inlineField}>
              <span>Window</span>
              <select value={changeWindow} onChange={(e) => setChangeWindow(e.target.value)}>
                {policy.changeWindows.map((w) => <option key={w}>{w}</option>)}
              </select>
            </label>
            <Button disabled={!current} onClick={() => approve(rec.id, undefined, changeWindow)}>Approve and schedule</Button>
            {rejectBtn}
          </div>
        );
      return (
        <div className={styles.actions}>
          <p className={styles.actionNote}>Needs sign-off from {required.join(' and ')}.</p>
          <Button disabled={!current} onClick={() => setApproving(true)}>Review and approve</Button>
          {rejectBtn}
        </div>
      );
    }

    if (s === 'awaiting_approval') {
      const missing = policy.approvers.high.filter((r) => !rec.state.approvals[r]);
      return (
        <div className={styles.actions}>
          <ul className={styles.signoffs} aria-label="Sign-offs">
            {policy.approvers.high.map((r) => (
              <li key={r} className={rec.state.approvals[r] ? styles.signed : undefined}>
                {rec.state.approvals[r] ? '✓' : '○'} {r}
              </li>
            ))}
          </ul>
          {missing.map((r) => (
            <Button key={r} variant="outline" size="sm" onClick={() => approve(rec.id, r)}>
              Simulate {r} approval (demo)
            </Button>
          ))}
          <Button variant="text" onClick={() => cancel(rec.id)}>Withdraw approval</Button>
        </div>
      );
    }

    if (s === 'scheduled')
      return (
        <div className={styles.actions}>
          <p className={styles.actionNote}>Scheduled for {rec.state.window}. Signals are checked again before it runs.</p>
          <Button variant="outline" size="sm" onClick={() => runNow(rec.id)}>Run window now (demo)</Button>
          <Button variant="text" onClick={() => cancel(rec.id)}>Cancel change</Button>
        </div>
      );

    if (s === 'applied' || s === 'auto_applied')
      return (
        <div className={styles.actions}>
          <p className={styles.actionNote}>{s === 'auto_applied' ? 'Applied automatically under your policy.' : 'Applied.'}</p>
          <Button variant="outline" onClick={() => rollBack(rec.id)}>
            <RotateCcw size={16} aria-hidden /> Roll back
          </Button>
        </div>
      );

    if (s === 'rejected') return <p className={styles.actionNote}>Rejected: {rec.state.rejectReason?.toLowerCase()}.</p>;
    return <p className={styles.actionNote}>Rolled back. The previous configuration is active.</p>;
  }
}
