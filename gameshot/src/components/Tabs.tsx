import { NavLink } from 'react-router-dom';
import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: string;
  /** When set, the tab is a route link (console tabs). */
  to?: string;
}

interface TabsProps {
  items: TabItem[];
  /** Controlled mode — used when tabs don't map to routes. */
  value?: string;
  onChange?: (id: string) => void;
  /** 'brand' = brown underline (console); 'accent' = indigo (onboarding). */
  tone?: 'brand' | 'accent';
  ariaLabel?: string;
}

export function Tabs({ items, value, onChange, tone = 'brand', ariaLabel }: TabsProps) {
  return (
    <div className={`${styles.tabs} ${styles[tone]}`} role="tablist" aria-label={ariaLabel}>
      {items.map((t) =>
        t.to ? (
          <NavLink
            key={t.id}
            to={t.to}
            role="tab"
            className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}
          >
            {t.label}
          </NavLink>
        ) : (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={value === t.id}
            className={`${styles.tab} ${value === t.id ? styles.active : ''}`}
            onClick={() => onChange?.(t.id)}
          >
            {t.label}
          </button>
        ),
      )}
    </div>
  );
}
