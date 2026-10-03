import { Link, useParams } from 'react-router-dom';
import { DataTable } from '../../components/DataTable';
import { sessions } from '../../data/mock';
import styles from './Build.module.css';

/** Not in the ★ flow — a minimal list so the session detail is reachable. */
export function SessionsTab() {
  const { buildId = '' } = useParams();
  return (
    <section aria-labelledby="sessions-title">
      <div className={styles.toolbar}>
        <h2 id="sessions-title">Sessions (#{String(sessions.length).padStart(2, '0')})</h2>
      </div>
      <DataTable
        caption="Game sessions"
        rows={sessions}
        rowKey={(s) => s.id}
        columns={[
          { key: 'name', header: 'Session', render: (s) => <Link className={styles.link} to={`/builds/${encodeURIComponent(buildId)}/sessions/${s.id}`}>{s.name}</Link> },
          { key: 'status', header: 'Status', render: (s) => s.status },
          { key: 'players', header: 'Players', render: (s) => `${s.currentPlayers} / ${s.maxPlayers}` },
          { key: 'location', header: 'Location', render: (s) => s.location },
        ]}
      />
    </section>
  );
}
