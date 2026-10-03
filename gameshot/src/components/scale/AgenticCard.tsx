import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Pause, RotateCcw, Timer } from 'lucide-react';
import { Button } from '../Button';
import type { ScaleCard } from '../../data/scale-mock';
import type { CardState } from '../../state/ScaleContext';
import { fmtClock, useNow } from './useNow';
import styles from './AgenticCard.module.css';

interface Props {
  card: ScaleCard;
  state: CardState;
  deadline?: number;
  onApprove: (chosen?: string) => void;
  onDecline: (reason: string) => void;
  onRollBack: () => void;
  onHold: () => void;
}

const REASONS = ['Traffic will settle on its own', 'Too expensive', 'Wrong diagnosis', 'Handling it manually'];
const TIER_LABEL = { auto: 'Tier 1 · Auto-execute', prepare: 'Tier 2 · Auto-prepare', human: 'Tier 3 · Human only' } as const;

export function AgenticCard({ card, state, deadline, onApprove, onDecline, onRollBack, onHold }: Props) {
  const now = useNow();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const remaining = deadline ? deadline - now : null;
  const open = state.status === 'open';

  // Auto-pending cards start on their own when the hold window runs out.
  useEffect(() => {
    if (card.kind === 'auto_pending' && open && remaining !== null && remaining <= 0) onApprove('auto');
  }, [card.kind, open, remaining, onApprove]);

  if (card.kind === 'quiet') {
    return (
      <article className={`${styles.card} ${styles.quiet}`} aria-labelledby={`${card.id}-t`}>
        <header className={styles.quietHead}>
          <CheckCircle2 size={20} aria-hidden className={styles.okIcon} />
          <h3 id={`${card.id}-t`}>{card.title}</h3>
        </header>
        <p>{card.whyNow}</p>
        <p className={styles.muted}>{card.route.detail}</p>
      </article>
    );
  }

  const urgent = card.kind === 'approval' && open;
  const late = remaining !== null && remaining <= 0 && open && card.kind === 'approval';

  const anatomy = (
    <>
      <Section title="Why now">{card.whyNow}</Section>
      {card.change && (
        <Section title="What will change">
          <p>{card.change.summary}</p>
          <InfraDiff diff={card.change.diff} />
        </Section>
      )}
      {card.ifNothing && <Section title="If we do nothing">{card.ifNothing}</Section>}
      {card.cost && (
        <div className={styles.split}>
          <div>
            <h4>Players</h4>
            <p>{card.playerImpact}</p>
          </div>
          <div>
            <h4>Cost</h4>
            <p><strong>{card.cost.perHour}</strong> · {card.cost.window}</p>
            {card.cost.budgetNote && <p className={styles.warnText}>{card.cost.budgetNote}</p>}
          </div>
        </div>
      )}
      <Section title={`Confidence: ${card.confidence.level}`}>
        <p>{card.confidence.basis}</p>
        <ul className={styles.signals} aria-label="Signals used">
          {card.confidence.signals.map((s) => <li key={s}>{s}</li>)}
        </ul>
        {card.confidence.missing.map((m) => (
          <p key={m} className={styles.missing}><AlertTriangle size={14} aria-hidden /> Missing: {m}</p>
        ))}
      </Section>
      <Section title={TIER_LABEL[card.route.tier]}>
        <p><strong>{card.route.label}.</strong> {card.route.detail}</p>
        {card.leadTime && <p className={styles.muted}>{card.leadTime}</p>}
      </Section>
      {card.rollback && <Section title="Rollback">{card.rollback}</Section>}
    </>
  );

  return (
    <article
      className={`${styles.card} ${urgent ? styles.urgent : ''} ${card.kind === 'conflict' && open ? styles.conflict : ''}`}
      aria-labelledby={`${card.id}-t`}
    >
      <header className={styles.head}>
        <span className={styles.kicker}>
          {card.kind === 'auto_executed' && 'Auto-executed'}
          {card.kind === 'approval' && 'Needs your approval'}
          {card.kind === 'conflict' && 'Conflicting options'}
          {card.kind === 'auto_pending' && 'Starts automatically'}
        </span>
        <h3 id={`${card.id}-t`}>{card.title}</h3>
        {open && remaining !== null && (card.kind === 'approval' || card.kind === 'auto_pending') && (
          <div className={`${styles.countdown} ${late ? styles.late : ''}`} role="timer" aria-live="off">
            <Timer size={18} aria-hidden />
            {late ? (
              <span><strong>Decision window passed.</strong> Queue wait is now projected to pass 90 s. Approving still helps, but players will queue.</span>
            ) : card.kind === 'approval' ? (
              <span><strong className={styles.clock}>{fmtClock(remaining)}</strong> left to decide before queue wait p95 passes the 90 s target</span>
            ) : (
              <span>Starts in <strong className={styles.clock}>{fmtClock(remaining)}</strong> unless you hold it</span>
            )}
          </div>
        )}
      </header>

      {card.kind === 'auto_executed' ? (
        <details className={styles.details}>
          <summary>{card.whyNow.split('.')[0]}. See evidence, cost and rollback</summary>
          {anatomy}
        </details>
      ) : card.kind === 'conflict' ? (
        <>
          <Section title="Why now">{card.whyNow}</Section>
          <div className={styles.options}>
            {card.options!.map((o) => (
              <div key={o.id} className={`${styles.option} ${state.chosen === o.id ? styles.optionChosen : ''}`}>
                <h4>{o.label}</h4>
                <p>{o.detail}</p>
                <dl>
                  {o.tradeoffs.map((t) => (
                    <div key={t.label} className={styles[`tone_${t.tone}`]}>
                      <dt>{t.label}</dt>
                      <dd>{t.value}</dd>
                    </div>
                  ))}
                </dl>
                {o.note && <p className={styles.lean}>{o.note}</p>}
                {open && <Button variant={o.id === 'fallback' ? 'primary' : 'outline'} onClick={() => onApprove(o.id)}>Choose {o.id === 'wait' ? 'A' : 'B'}</Button>}
              </div>
            ))}
          </div>
          <Section title={`Confidence: ${card.confidence.level}`}>
            <p>{card.confidence.basis}</p>
            {card.confidence.missing.map((m) => <p key={m} className={styles.missing}><AlertTriangle size={14} aria-hidden /> Missing: {m}</p>)}
          </Section>
          <Section title={TIER_LABEL[card.route.tier]}><p><strong>{card.route.label}.</strong> {card.route.detail}</p></Section>
        </>
      ) : (
        anatomy
      )}

      <footer className={styles.foot}>
        {state.status === 'executing' && (
          <div className={styles.progress} role="status">
            <span>{card.kind === 'auto_pending' ? 'Draining idle servers' : 'Provisioning instances'} · {state.progress}%</span>
            <div className={styles.bar}><i style={{ width: `${state.progress}%` }} /></div>
          </div>
        )}
        {state.status === 'executed' && (
          <div className={styles.row}>
            <span className={styles.done}><CheckCircle2 size={16} aria-hidden /> {card.kind === 'auto_executed' ? 'Done, within your caps.' : state.chosen === 'partial' ? 'Added 8 instances.' : 'Done.'}</span>
            <Button variant="outline" size="sm" onClick={onRollBack}><RotateCcw size={14} aria-hidden /> {card.kind === 'auto_executed' ? 'Undo' : 'Roll back'}</Button>
          </div>
        )}
        {state.status === 'rolled_back' && <p className={styles.muted}>Rolled back. Previous capacity restored; live sessions kept.</p>}
        {state.status === 'held' && <p className={styles.muted}><Pause size={14} aria-hidden /> Held. Capacity kept for a possible second wave.</p>}
        {state.status === 'declined' && <p className={styles.muted}>Declined: {state.declineReason}. Saved for the post-launch review.</p>}

        {open && card.kind === 'approval' && !declining && (
          <div className={styles.actions}>
            <Button size="lg" onClick={() => onApprove()}>{card.primary}</Button>
            {card.secondary && (
              <div className={styles.secondary}>
                <Button variant="outline" onClick={() => onApprove('partial')}>{card.secondary.label}</Button>
                <span>{card.secondary.consequence}</span>
              </div>
            )}
            <Button variant="text" onClick={() => setDeclining(true)}>Decline</Button>
          </div>
        )}
        {open && card.kind === 'auto_pending' && (
          <div className={styles.actions}>
            <Button onClick={() => onApprove('now')}>Start now</Button>
            <Button variant="outline" onClick={onHold}><Pause size={14} aria-hidden /> Hold</Button>
          </div>
        )}
        {declining && (
          <form className={styles.decline} onSubmit={(e) => { e.preventDefault(); onDecline(reason); setDeclining(false); }}>
            <fieldset>
              <legend>Why are you declining?</legend>
              {REASONS.map((r) => (
                <label key={r}><input type="radio" name={`${card.id}-reason`} checked={reason === r} onChange={() => setReason(r)} /> {r}</label>
              ))}
            </fieldset>
            <div className={styles.row}>
              <Button type="submit" variant="neutral">Decline</Button>
              <Button variant="text" onClick={() => setDeclining(false)}>Back</Button>
            </div>
          </form>
        )}
      </footer>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h4>{title}</h4>
      {typeof children === 'string' ? <p>{children}</p> : children}
    </section>
  );
}

/** Before/after instance counts per region. */
export function InfraDiff({ diff }: { diff: { region: string; before: number; after: number }[] }) {
  return (
    <table className={styles.diff}>
      <caption className="visually-hidden">Instances before and after</caption>
      <thead>
        <tr><th scope="col">Region</th><th scope="col">Now</th><th scope="col">After</th><th scope="col">Change</th></tr>
      </thead>
      <tbody>
        {diff.map((d) => {
          const delta = d.after - d.before;
          return (
            <tr key={d.region}>
              <th scope="row">{d.region}</th>
              <td>{d.before}</td>
              <td>{d.after}</td>
              <td className={delta > 0 ? styles.up : delta < 0 ? styles.down : undefined}>{delta > 0 ? `+${delta}` : delta === 0 ? '—' : delta}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}


