import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Radar } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, InfoTile } from '../../components/Card';
import { Gauge } from '../../components/Gauge';
import { sessions } from '../../data/mock';
import { TIER_LABELS } from '../../logic/riskPolicy';
import { useRecommendations } from '../../state/RecommendationsContext';
import { costLabel, tierTone } from './optimize/format';
import shared from './Build.module.css';
import styles from './SessionDetail.module.css';

export function SessionDetail() {
  const navigate = useNavigate();
  const { buildId = '', sessionId } = useParams();
  const s = sessions.find((x) => x.id === sessionId) ?? sessions[0];
  const { recs } = useRecommendations();
  const rec = recs.find((r) => r.id === 'rec-cpu') ?? recs[0];

  const tiles: [string, ReactNode][] = [
    ['Session ID', s.sessionId],
    ['Version', s.version],
    ['Status', s.status],
    ['Start time', s.startTime],
    ['End time', s.endTime],
    ['IP address', s.ipAddress],
    ['Port', s.port],
    ['Location', s.location],
    ['Current players', s.currentPlayers],
    ['Max players', s.maxPlayers],
    ['Logs', <a href={s.logsUrl} target="_blank" rel="noreferrer" className={styles.logs}>{s.logsUrl}</a>],
    ['Fleet', s.fleet],
  ];

  return (
    <AppShell>
      <header className={styles.topbar}>
        <button type="button" className={styles.back} aria-label="Back to build" onClick={() => navigate(`/builds/${encodeURIComponent(buildId)}/versions`)}>
          <ArrowLeft size={24} aria-hidden />
        </button>
        {/* TODO(design): what does Connect to host open? (CLI snippet, RDP, web console?) */}
        <Button variant="warning">Connect to host</Button>
      </header>

      <div className={shared.content}>
        <h1 className={shared.pageTitle}>{s.name}</h1>

        <dl className={styles.grid}>
          {tiles.map(([label, value]) => (
            <InfoTile key={label} label={label} value={value} />
          ))}
        </dl>

        <h2 className={`${shared.sectionTitle} ${styles.recTitle}`}>Optimization recommendations</h2>
        <Card eyebrow="Optimize CPU usage" eyebrowIcon={<Radar size={16} aria-hidden />} className={styles.recCard}>
          <div className={styles.recBody}>
            <span className={styles.muted}>Nov 27, 2025</span>
            <Gauge value={98} caption="Game servers in-use" size={120} />
            <div className={styles.stack}>
              <strong>Bottleneck detected</strong>
              <a href={`/builds/${encodeURIComponent(buildId)}/optimize`} className={styles.link} onClick={(e) => { e.preventDefault(); navigate(`/builds/${encodeURIComponent(buildId)}/optimize`); }}>
                View details
              </a>
            </div>
            <div className={styles.stack}>
              <span className={styles.small}>Recommendation</span>
              <strong>{rec.summary}</strong>
              <span className={styles.riskRow}>
                <Badge tone={tierTone[rec.risk.tier]}>{TIER_LABELS[rec.risk.tier]}</Badge>
                <span className={styles.small}>{costLabel(rec.facts.monthlyCostDelta)}</span>
              </span>
            </div>
            <Button variant="tonal" size="sm" onClick={() => navigate(`/builds/${encodeURIComponent(buildId)}/optimize`, { state: { recId: rec.id } })}>
              Review recommendation
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
