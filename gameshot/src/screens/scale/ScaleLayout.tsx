import { NavLink, Outlet, useParams } from 'react-router-dom';
import styles from './Scale.module.css';

const LINKS = [
  { to: '', label: 'Live', end: true },
  { to: 'plan', label: 'Launch plan' },
  { to: 'simulate', label: 'Simulate' },
  { to: 'guardrails', label: 'Guardrails' },
  { to: 'audit', label: 'Audit log' },
];

/** Scale Control: Plan → Simulate → Arm guardrails → Monitor → Intervene → Review. */
export function ScaleLayout() {
  const { buildId = '' } = useParams();
  const base = `/builds/${encodeURIComponent(buildId)}/scale`;
  return (
    <div className={styles.scale}>
      <nav className={styles.subnav} aria-label="Scale Control">
        {LINKS.map((l) => (
          <NavLink key={l.label} to={l.to ? `${base}/${l.to}` : base} end={l.end} className={({ isActive }) => (isActive ? styles.subActive : undefined)}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
