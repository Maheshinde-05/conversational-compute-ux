import { useEffect, useRef, useState } from 'react';
import type { CalibrationBin } from '../../evals/scorecard';
import styles from './TimeSeriesChart.module.css';

interface Props { bins: CalibrationBin[]; height?: number }

const M = { top: 16, right: 16, bottom: 40, left: 48 };

/** Predicted confidence (x) vs observed accuracy (y). On the diagonal = honest. */
export function ReliabilityDiagram({ bins, height = 300 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(420);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.min(520, Math.round(e.contentRect.width)))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = width - M.left - M.right;
  const H = height - M.top - M.bottom;
  const sx = (v: number) => M.left + v * W;
  const sy = (v: number) => M.top + H - v * H;
  const pts = bins.filter((b) => b.n > 0);
  const maxN = Math.max(...pts.map((b) => b.n), 1);
  const r = (n: number) => 5 + 9 * Math.sqrt(n / maxN);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className={styles.chart} ref={wrap}>
      <ul className={styles.legend} aria-hidden>
        <li><svg width="18" height="8"><line x1="1" y1="4" x2="17" y2="4" stroke="var(--chart-reference)" strokeWidth="1" /></svg>Perfect calibration</li>
        <li><svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="var(--chart-categorical-1)" /></svg>Recommendations (size = count)</li>
        <li><svg width="14" height="10"><rect width="14" height="10" fill="var(--state-onplan-container)" stroke="var(--state-onplan)" /></svg>Pass band: 80% confident → 70–90% right</li>
      </ul>
      <svg width={width} height={height} role="img" aria-label="Reliability diagram: stated confidence against observed accuracy" className={styles.svg}>
        <rect x={sx(0.75)} y={sy(0.9)} width={sx(0.85) - sx(0.75)} height={sy(0.7) - sy(0.9)} fill="var(--state-onplan-container)" stroke="var(--state-onplan)" strokeWidth={1} />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + W} y1={sy(t)} y2={sy(t)} stroke="var(--chart-grid)" />
            <text x={M.left - 8} y={sy(t) + 4} textAnchor="end" className={styles.tick}>{Math.round(t * 100)}%</text>
            <text x={sx(t)} y={height - 22} textAnchor="middle" className={styles.tick}>{Math.round(t * 100)}%</text>
          </g>
        ))}
        <text x={M.left + W / 2} y={height - 4} textAnchor="middle" className={styles.refLabel}>Confidence the agent stated</text>
        <text transform={`translate(12 ${M.top + H / 2}) rotate(-90)`} textAnchor="middle" className={styles.refLabel}>Actually right</text>
        <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} stroke="var(--chart-reference)" strokeWidth={1} />
        {pts.map((b, i) => (
          <g key={b.from} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} role="img" aria-label={`Said ${Math.round(b.meanConfidence * 100)}%, right ${Math.round(b.accuracy * 100)}%, ${b.n} recommendations`}>
            <circle cx={sx(b.meanConfidence)} cy={sy(b.accuracy)} r={Math.max(12, r(b.n))} fill="transparent" />
            <circle cx={sx(b.meanConfidence)} cy={sy(b.accuracy)} r={r(b.n)} fill="var(--chart-categorical-1)" stroke="var(--chart-surface)" strokeWidth={2} opacity={hover === null || hover === i ? 1 : 0.5} />
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className={styles.tooltip} style={{ left: Math.min(sx(pts[hover].meanConfidence) + 14, width - 180), top: sy(pts[hover].accuracy) }} role="status">
          <span className={styles.tipX}>Confidence {Math.round(pts[hover].from * 100)}–{Math.round(pts[hover].to * 100)}%</span>
          <span className={styles.tipRow}><strong>{Math.round(pts[hover].accuracy * 100)}%</strong><span>actually right</span></span>
          <span className={styles.tipRow}><strong>{Math.round(pts[hover].meanConfidence * 100)}%</strong><span>stated on average</span></span>
          <span className={styles.tipRow}><strong>{pts[hover].n}</strong><span>recommendations</span></span>
        </div>
      )}
      <details className={styles.table}>
        <summary>Show data table</summary>
        <div className={styles.tableScroll}>
          <table>
            <thead><tr><th scope="col">Confidence bin</th><th scope="col">Recommendations</th><th scope="col">Stated</th><th scope="col">Right</th></tr></thead>
            <tbody>
              {bins.map((b) => (
                <tr key={b.from}><th scope="row">{Math.round(b.from * 100)}–{Math.round(b.to * 100)}%</th><td>{b.n}</td><td>{b.n ? `${Math.round(b.meanConfidence * 100)}%` : '—'}</td><td>{b.n ? `${Math.round(b.accuracy * 100)}%` : '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
