import { useState } from 'react';
import { Badge, type BadgeTone } from '../../components/Badge';
import { PHASE_LABELS, type PhaseId, type ScaleAuditEntry } from '../../data/scale-mock';
import { useScale } from '../../state/ScaleContext';
import styles from './Scale.module.css';

const DECISION_TONE: Record<ScaleAuditEntry['decision'], BadgeTone> = {
  Auto: 'info', Approved: 'riskLow', Declined: 'riskHigh', Held: 'riskMedium', Plan: 'neutral',
};

export function ScaleAudit() {
  const { audit } = useScale();
  const [phase, setPhase] = useState<PhaseId | 'all'>('all');
  const [decision, setDecision] = useState<ScaleAuditEntry['decision'] | 'all'>('all');
  const rows = audit.filter((a) => (phase === 'all' || a.phase === phase) && (decision === 'all' || a.decision === decision));

  return (
    <section aria-labelledby="audit-title" className={styles.page}>
      <div>
        <h2 id="audit-title" className={styles.h2}>Audit log</h2>
        <p className={styles.intro}>Every action, automated or human, with what triggered it and what it cost. This is what you show your finance team, and the input to the post-launch review.</p>
      </div>
      <div className={styles.filters}>
        <label>Phase
          <select value={phase} onChange={(e) => setPhase(e.target.value as PhaseId | 'all')}>
            <option value="all">All phases</option>
            {(Object.keys(PHASE_LABELS) as PhaseId[]).map((p) => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
          </select>
        </label>
        <label>Decision
          <select value={decision} onChange={(e) => setDecision(e.target.value as ScaleAuditEntry['decision'] | 'all')}>
            <option value="all">All decisions</option>
            {(Object.keys(DECISION_TONE) as ScaleAuditEntry['decision'][]).map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <span className={styles.muted}>{rows.length} of {audit.length} entries</span>
      </div>
      <div className={`${styles.panel} ${styles.tableScroll}`}>
        <table className={`${styles.table} ${styles.auditTable}`}>
          <thead>
            <tr><th scope="col">Time</th><th scope="col">Action</th><th scope="col">Trigger</th><th scope="col">Cost</th><th scope="col">Decision</th><th scope="col">Who</th><th scope="col">Outcome</th><th scope="col">Rollback</th></tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className={styles.nowrap}>{a.t}<span className={styles.phaseTag}>{PHASE_LABELS[a.phase]}</span></td>
                <th scope="row">{a.action}</th>
                <td>{a.trigger}</td>
                <td className={styles.nowrap}>{a.costDelta}</td>
                <td><Badge tone={DECISION_TONE[a.decision]}>{a.decision}</Badge></td>
                <td>{a.who}</td>
                <td>{a.outcome}</td>
                <td>{a.rollback ? 'Available' : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className={styles.muted}>No entries match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
