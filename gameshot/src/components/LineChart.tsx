import styles from './LineChart.module.css';

interface Series {
  name: string;
  color: string;
  /** y values 0–100, evenly spaced across x labels */
  values: number[];
}

interface LineChartProps {
  series: Series[];
  xLabels: string[];
  height?: number;
}

/** Lightweight smooth line chart. Swap for a charting lib once real data lands. */
export function LineChart({ series, xLabels, height = 160 }: LineChartProps) {
  const width = 420;
  const pad = { top: 8, bottom: 24 };
  const plotH = height - pad.top - pad.bottom;
  const gridLines = 5;

  const toPath = (values: number[]) => {
    const step = width / (values.length - 1);
    const pts = values.map((v, i) => [i * step, pad.top + plotH - (v / 100) * plotH] as const);
    return pts
      .map(([x, y], i) => {
        if (i === 0) return `M ${x} ${y}`;
        const [px, py] = pts[i - 1];
        const mx = (px + x) / 2;
        return `C ${mx} ${py}, ${mx} ${y}, ${x} ${y}`;
      })
      .join(' ');
  };

  return (
    <figure className={styles.figure}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.svg} role="img" aria-label={series.map((s) => s.name).join(' vs ')}>
        {Array.from({ length: gridLines }, (_, i) => {
          const y = pad.top + (plotH / (gridLines - 1)) * i;
          return <line key={i} x1={0} x2={width} y1={y} y2={y} stroke="var(--sys-color-outline)" strokeWidth={1} opacity={0.6} />;
        })}
        {series.map((s) => (
          <path key={s.name} d={toPath(s.values)} fill="none" stroke={s.color} strokeWidth={2} />
        ))}
        {xLabels.map((l, i) => (
          <text key={l} x={(width / (xLabels.length - 1)) * i} y={height - 4} className={styles.tick} textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}>
            {l}
          </text>
        ))}
      </svg>
      <figcaption className={styles.legend}>
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
