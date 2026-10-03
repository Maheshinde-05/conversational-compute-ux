import styles from './Meter.module.css';

export type MeterTone = 'onplan' | 'diverging' | 'critical';

interface Props {
  label: string;
  value: string;
  detail: string;
  /** 0–1 fill */
  fraction: number;
  tone: MeterTone;
  /** Optional target range or limit, as 0–1 positions on the track. */
  target?: { from: number; to?: number; label: string };
}

/** Stat tile with a meter: fill carries severity, track is a lighter step of the same hue. */
export function Meter({ label, value, detail, fraction, tone, target }: Props) {
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <div className={`${styles.tile} ${styles[tone]}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      <div className={styles.track} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(f * 100)} aria-valuetext={`${value}, ${detail}`}>
        <i className={styles.fill} style={{ width: `${f * 100}%` }} />
        {target && (
          <span
            className={target.to != null ? styles.range : styles.limit}
            style={{ left: `${target.from * 100}%`, width: target.to != null ? `${(target.to - target.from) * 100}%` : undefined }}
            title={target.label}
          />
        )}
      </div>
      <span className={styles.detail}>{detail}</span>
    </div>
  );
}
