import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { ROUTE_LABELS, TIER_LABELS, type Route } from '../../../logic/riskPolicy';
import { useRecommendations, type EnrichedRec } from '../../../state/RecommendationsContext';
import { costLabel, isOpen, statusLine, tierTone } from './format';
import styles from './Optimize.module.css';

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

const GROUP_ORDER: Route[] = ['explicit', 'scheduled', 'digest', 'auto'];

export function RecommendationList({ selectedId, onSelect }: Props) {
  const { recs, policy, applyDigest } = useRecommendations();
  const open = recs.filter(isOpen);
  const closed = recs.filter((r) => !isOpen(r));
  const digestReady = open.filter((r) => r.route === 'digest' && r.freshness === 'current');

  const item = (r: EnrichedRec) => (
    <li key={r.id}>
      <button
        type="button"
        className={`${styles.item} ${r.id === selectedId ? styles.itemActive : ''}`}
        aria-current={r.id === selectedId}
        onClick={() => onSelect(r.id)}
      >
        <span className={styles.itemTop}>
          <Badge tone={tierTone[r.risk.tier]}>{TIER_LABELS[r.risk.tier]}</Badge>
          <span className={styles.itemCost}>{costLabel(r.facts.monthlyCostDelta)}</span>
        </span>
        <span className={styles.itemTitle}>{r.summary}</span>
        <span className={styles.itemMeta}>{statusLine(r, policy.approvers.high.length)}</span>
      </button>
    </li>
  );

  return (
    <nav className={styles.list} aria-label="Recommendations">
      {GROUP_ORDER.map((route) => {
        const items = open.filter((r) => r.route === route);
        if (!items.length) return null;
        return (
          <section key={route} className={styles.group}>
            <header className={styles.groupHead}>
              <h3>
                {ROUTE_LABELS[route]} <span className={styles.groupCount}>{items.length}</span>
              </h3>
              {route === 'digest' && digestReady.length > 0 && (
                <Button variant="tonal" size="sm" onClick={() => applyDigest(digestReady.map((r) => r.id))}>
                  Apply all {digestReady.length}
                </Button>
              )}
            </header>
            <ul>{items.map(item)}</ul>
          </section>
        );
      })}
      {closed.length > 0 && (
        <section className={styles.group}>
          <header className={styles.groupHead}>
            <h3>
              Done or expired <span className={styles.groupCount}>{closed.length}</span>
            </h3>
          </header>
          <ul>{closed.map(item)}</ul>
        </section>
      )}
    </nav>
  );
}
