import { useRecommendations } from '../../../state/RecommendationsContext';
import styles from './Optimize.module.css';

export function AuditLog() {
  const { audit } = useRecommendations();
  return (
    <section className={styles.audit} aria-labelledby="audit-title">
      <h2 id="audit-title" className={styles.auditTitle}>Change history</h2>
      <p className={styles.auditHint}>Every approval, rejection, rollback and policy change, newest first.</p>
      <ol className={styles.auditList}>
        {audit.map((a) => (
          <li key={a.id}>
            <time>{a.at}</time>
            <span>
              <strong>{a.actor}</strong> · {a.action}
              <span className={styles.auditTarget}>{a.target}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
