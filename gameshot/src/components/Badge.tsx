import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'critical' | 'count' | 'warning' | 'neutral' | 'riskLow' | 'riskMedium' | 'riskHigh' | 'info';

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
