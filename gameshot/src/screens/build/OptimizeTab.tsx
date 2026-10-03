import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecommendations } from '../../state/RecommendationsContext';
import { AuditLog } from './optimize/AuditLog';
import { RecommendationDetail } from './optimize/RecommendationDetail';
import { RecommendationList } from './optimize/RecommendationList';
import { isOpen } from './optimize/format';
import shared from './Build.module.css';
import styles from './optimize/Optimize.module.css';

export function OptimizeTab() {
  const { recs } = useRecommendations();
  const location = useLocation();
  const requested = (location.state as { recId?: string } | null)?.recId;
  const [selectedId, setSelectedId] = useState(requested ?? recs[0].id);
  const selected = recs.find((r) => r.id === selectedId) ?? recs[0];

  const open = recs.filter(isOpen);
  const needsYou = open.filter((r) => r.displayStatus === 'pending' && r.route !== 'digest' && r.freshness === 'current').length;
  const inDigest = open.filter((r) => r.route === 'digest').length;
  const scheduled = open.filter((r) => r.displayStatus === 'scheduled').length;

  return (
    <section aria-labelledby="opt-title">
      <div className={styles.headRow}>
        <h2 id="opt-title" className={shared.sectionTitle}>Optimization recommendations</h2>
        <p className={styles.summary} role="status">
          <strong>{needsYou}</strong> need your approval · <strong>{inDigest}</strong> in the low-risk digest · <strong>{scheduled}</strong> scheduled
        </p>
      </div>
      <p className={styles.intro}>
        The recommender reads your fleet’s signals and explains each suggestion. Your policy decides the risk and who approves.
      </p>

      <div className={styles.layout}>
        <RecommendationList selectedId={selected.id} onSelect={setSelectedId} />
        <RecommendationDetail key={selected.id} rec={selected} />
      </div>

      <AuditLog />
    </section>
  );
}
