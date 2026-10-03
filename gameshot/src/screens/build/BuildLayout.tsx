import { Link, Outlet, useParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { Tabs } from '../../components/Tabs';
import styles from './Build.module.css';

export function BuildLayout() {
  const { buildId = '' } = useParams();
  const base = `/builds/${encodeURIComponent(buildId)}`;

  return (
    <AppShell>
      <header className={styles.topbar}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link to="/">GameLift</Link>
          <span aria-hidden>/</span>
          <Link to={base}>Builds</Link>
          <span aria-hidden>/</span>
          <span aria-current="page">{buildId}</span>
        </nav>
        {/* TODO(engineering): wire to a build switcher once multiple builds exist. */}
        <button type="button" className={styles.buildChip}>
          {buildId}
          <ChevronDown size={18} aria-hidden />
        </button>
        <span />
      </header>

      <div className={styles.content}>
        <h1 className={styles.pageTitle}>{buildId}</h1>
        <div className={styles.tabs}>
          <Tabs
            ariaLabel="Build sections"
            items={[
              { id: 'versions', label: 'Versions', to: `${base}/versions` },
              { id: 'sessions', label: 'Sessions', to: `${base}/sessions` },
              { id: 'optimize', label: 'Optimize', to: `${base}/optimize` },
              { id: 'policy', label: 'Policy', to: `${base}/policy` },
              { id: 'scale', label: 'Scale', to: `${base}/scale` },
            ]}
          />
        </div>
        <Outlet />
      </div>
    </AppShell>
  );
}
