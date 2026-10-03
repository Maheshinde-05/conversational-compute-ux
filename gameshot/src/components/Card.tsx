import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  /** Small uppercase header row, e.g. "CPU USAGE". */
  eyebrow?: ReactNode;
  eyebrowIcon?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** "_Chart / Card" from Figma: white card, thin border, 40px header row. */
export function Card({ eyebrow, eyebrowIcon, headerAction, children, className }: CardProps) {
  return (
    <section className={`${styles.card} ${className ?? ''}`}>
      {eyebrow && (
        <header className={styles.header}>
          <span className={styles.eyebrow}>
            {eyebrowIcon}
            {eyebrow}
          </span>
          {headerAction}
        </header>
      )}
      <div className={styles.body}>{children}</div>
    </section>
  );
}

/** Gradient-outlined stat tile ("Card 2" in Figma) — instance cost, location… */
export function HighlightTile({ label, value, link }: { label: string; value: ReactNode; link?: ReactNode }) {
  return (
    <div className={styles.highlight}>
      <span className={styles.highlightLabel}>{label}</span>
      <strong className={styles.highlightValue}>{value}</strong>
      {link}
    </div>
  );
}

/** Outlined key/value tile used on the session detail screen. */
export function InfoTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.info}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </div>
  );
}
