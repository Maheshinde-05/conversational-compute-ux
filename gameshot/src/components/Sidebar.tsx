import { NavLink } from 'react-router-dom';
import { AreaChart, FlaskConical } from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  /** Onboarding shows the logo only; the console shows Builds / Games nav. */
  showNav?: boolean;
}

export function Sidebar({ showNav = true }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.inner}>
      <img src="/logo.png" alt="GameShot" width={50} height={50} className={styles.logo} />
      {showNav && (
        <nav className={styles.nav} aria-label="Primary">
          <NavLink to="/builds/game-compute-start-1" className={({ isActive }) => cx(styles.item, isActive && styles.active)}>
            <FlaskConical size={41} strokeWidth={2} aria-hidden />
            <span>Builds</span>
          </NavLink>
          <NavLink to="/games" className={({ isActive }) => cx(styles.item, isActive && styles.active)}>
            <AreaChart size={45} strokeWidth={2} aria-hidden />
            <span>Games</span>
          </NavLink>
        </nav>
      )}
      </div>
    </aside>
  );
}

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');
