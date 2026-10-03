import styles from './StepDots.module.css';

interface StepDotsProps {
  total: number;
  /** 0-based index of the current step. */
  current: number;
}

export function StepDots({ total, current }: StepDotsProps) {
  return (
    <div className={styles.dots} role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current + 1} aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i === current ? styles.active : styles.dot} />
      ))}
    </div>
  );
}
