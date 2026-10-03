import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, LineChart as LineChartIcon, Radar } from 'lucide-react';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card, HighlightTile } from '../../components/Card';
import { DataTable } from '../../components/DataTable';
import { Gauge } from '../../components/Gauge';
import { LineChart } from '../../components/LineChart';
import { cpuSessions, instanceIssues, recommendationHistoryCount, recommendations } from '../../data/mock';
import shared from './Build.module.css';
import styles from './OptimizeTab.module.css';

type Decision = 'approved' | 'rejected' | null;

export function OptimizeTab() {
  const [activeRec, setActiveRec] = useState(recommendations[0].id);
  const [decision, setDecision] = useState<Decision>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => railRef.current?.scrollBy({ left: dir * 400, behavior: 'smooth' });

  return (
    <section aria-labelledby="opt-title">
      <h2 id="opt-title" className={shared.sectionTitle}>Optimization recommendations</h2>

      {/* Recommendation history rail */}
      <div className={styles.railWrap}>
        <button type="button" className={styles.railArrow} aria-label="Previous" onClick={() => scroll(-1)}>
          <ArrowLeft size={28} aria-hidden />
        </button>
        <div className={styles.rail} ref={railRef} role="listbox" aria-label="Recommendations">
          {recommendations.map((r) => (
            <button
              key={r.id}
              type="button"
              role="option"
              aria-selected={activeRec === r.id}
              className={`${styles.recCard} ${activeRec === r.id ? styles.recActive : ''}`}
              onClick={() => { setActiveRec(r.id); setDecision(null); }}
            >
              <span className={styles.recName}>{r.sessionName}</span>
              <span className={styles.recTime}>{r.date},<br />{r.time}</span>
            </button>
          ))}
          <button type="button" className={styles.recCard}>
            <span className={styles.recName}>HISTORY</span>
            <span className={styles.recTime}>{recommendationHistoryCount} Recommendations</span>
          </button>
        </div>
        <button type="button" className={styles.railArrow} aria-label="Next" onClick={() => scroll(1)}>
          <ArrowRight size={28} aria-hidden />
        </button>
      </div>

      {/* Summary row */}
      <div className={styles.summary}>
        <Card eyebrow="CPU usage" className={styles.cpuCard}>
          <div className={styles.cpuBody}>
            <span className={styles.date}>Dec 27, 2025</span>
            <Gauge value={98} caption="Game servers in-use" />
            <strong className={styles.bottleneck}>Bottleneck detected</strong>
          </div>
        </Card>

        <div className={styles.diagnosis}>
          <p className={styles.diagnosisText}>
            Instances are running short with vCPUS and RAM causing the bottleneck. C5.large in region US-east-1 and
            C4.2xlarge in US-west-1 has compute overload.
          </p>
          <div className={styles.tableCard}>
            <div className={styles.tableHead}>
              <h3>Instances with issues</h3>
              <Badge tone="count">{String(instanceIssues.length).padStart(2, '0')}</Badge>
            </div>
            <DataTable
              caption="Instances with issues"
              rows={instanceIssues}
              rowKey={(r) => r.id}
              columns={[
                { key: 'name', header: 'Compute name', sortValue: (r) => r.computeName, render: (r) => <a href="#" className={styles.brandLink} onClick={(e) => e.preventDefault()}>{r.computeName}</a> },
                { key: 'loc', header: 'Location', sortValue: (r) => r.location, render: (r) => r.location },
                { key: 'cap', header: 'Capacity', sortValue: (r) => r.capacity, render: (r) => <Badge tone="critical">{r.capacity}</Badge> },
              ]}
            />
          </div>
        </div>

        <Card eyebrow="Recommendation" eyebrowIcon={<Radar size={16} aria-hidden />} className={styles.recPanel}>
          <div className={styles.recPanelBody}>
            <strong className={styles.recHeadline}>2vCPU per session</strong>
            <div className={styles.recPanelRow}>
              <HighlightTile
                label="Instance cost"
                value="$ 0.062/hr"
                link={<a href="#" className={styles.costLink} onClick={(e) => e.preventDefault()}>Learn more about cost</a>}
              />
              <div className={styles.decision}>
                {decision ? (
                  <p role="status" className={styles.decisionStatus}>
                    {decision === 'approved' ? 'Approved — scaling scheduled.' : 'Rejected.'}
                    <Button variant="text" size="sm" onClick={() => setDecision(null)}>Undo</Button>
                  </p>
                ) : (
                  <>
                    <Button variant="tonal" size="lg" className={styles.decisionBtn} onClick={() => setDecision('approved')}>Approve</Button>
                    <Button variant="tonal" size="lg" className={styles.decisionBtn} onClick={() => setDecision('rejected')}>Reject</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Instance drill-down */}
      <h2 className={`${shared.sectionTitle} ${styles.drillTitle}`}>Instance C5 Large</h2>
      <div className={styles.drill}>
        <Card
          eyebrow="CPU Usage"
          eyebrowIcon={<LineChartIcon size={16} aria-hidden />}
          headerAction={<a href="#" className={styles.viewDetails} onClick={(e) => e.preventDefault()}>View details</a>}
        >
          <span className={styles.date}>Dec 27, 2025</span>
          <LineChart
            xLabels={['10:00', '11:00', '12:00', '13:00', '14:00', '15:00']}
            series={[
              { name: 'C5.large', color: 'var(--chart-categorical-1)', values: [45, 78, 70, 30, 62, 72, 58] },
              { name: 'C4.2xlarge', color: 'var(--chart-categorical-2)', values: [5, 55, 30, 52, 20, 25, 28] },
            ]}
          />
        </Card>

        <div className={styles.tableCard}>
          <div className={styles.tableHead}>
            <h3>CPU consuming sessions</h3>
            <Badge tone="warning">{String(cpuSessions.length).padStart(2, '0')}</Badge>
          </div>
          <DataTable
            caption="CPU consuming sessions"
            rows={cpuSessions}
            rowKey={(r) => r.id}
            columns={[
              { key: 'name', header: 'Compute name', sortValue: (r) => r.computeName, render: (r) => <a href="#" className={shared.link} onClick={(e) => e.preventDefault()}>{r.computeName}</a> },
              { key: 'loc', header: 'Location', sortValue: (r) => r.location, render: (r) => r.location },
              { key: 'status', header: 'Status', sortValue: (r) => r.status, render: (r) => <Badge tone="critical">{r.status}</Badge> },
            ]}
          />
        </div>
      </div>
    </section>
  );
}
