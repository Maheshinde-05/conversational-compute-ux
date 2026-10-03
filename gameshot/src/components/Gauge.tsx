import styles from './Gauge.module.css';

interface GaugeProps {
  /** 0–100 */
  value: number;
  caption: string;
  size?: number;
}

/** Semicircle utilisation gauge (CPU usage card). */
export function Gauge({ value, caption, size = 136 }: GaugeProps) {
  const stroke = 18;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r;
  const filled = (Math.min(Math.max(value, 0), 100) / 100) * circumference;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <div className={styles.gauge} style={{ width: size }}>
      <svg width={size} height={size / 2 + stroke / 2} viewBox={`0 0 ${size} ${size / 2 + stroke / 2}`} aria-hidden>
        <path d={arc} fill="none" stroke="var(--chart-gauge-track)" strokeWidth={stroke} strokeLinecap="round" />
        <path
          d={arc}
          fill="none"
          stroke="var(--chart-gauge-fill)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <div className={styles.label}>
        <strong>{value}%</strong>
        <span>{caption}</span>
      </div>
    </div>
  );
}
