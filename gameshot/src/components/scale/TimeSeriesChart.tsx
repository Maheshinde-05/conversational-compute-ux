import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import styles from './TimeSeriesChart.module.css';

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
  /** Shaded uncertainty band drawn in the series hue at low opacity. */
  band?: { lo: (number | null)[]; hi: (number | null)[] };
}

interface Props {
  ariaLabel: string;
  x: number[];
  xFormat: (v: number) => string;
  yFormat: (v: number) => string;
  series: ChartSeries[];
  /** Horizontal reference lines (targets, budgets). */
  references?: { y: number; label: string }[];
  /** Horizontal band, e.g. a target headroom range. */
  targetBand?: { y0: number; y1: number; label: string };
  /** Vertical event markers. */
  markers?: { x: number; label: string }[];
  /** Vertical "now" line. */
  nowX?: number;
  /** Shaded x-ranges, e.g. queue-target breaches. */
  alertRanges?: [number, number][];
  yMax?: number;
  height?: number;
}

const M = { top: 16, right: 20, bottom: 28, left: 56 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Line chart with one y-axis, crosshair tooltip, keyboard support and a table view. */
export function TimeSeriesChart({ ariaLabel, x, xFormat, yFormat, series, references = [], targetBand, markers = [], nowX, alertRanges = [], yMax, height = 260 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const tableId = useId();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = width - M.left - M.right;
  const H = height - M.top - M.bottom;
  const x0 = x[0];
  const x1 = x[x.length - 1];
  const sx = (v: number) => M.left + ((v - x0) / (x1 - x0 || 1)) * W;

  const top = useMemo(() => {
    if (yMax) return yMax;
    const all = series.flatMap((s) => [...s.values, ...(s.band?.hi ?? [])]).filter((v): v is number => v != null);
    return niceMax(Math.max(...all, ...references.map((r) => r.y), targetBand?.y1 ?? 0) * 1.08);
  }, [series, references, targetBand, yMax]);
  const sy = (v: number) => M.top + H - (v / top) * H;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);

  const path = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${sx(x[i]).toFixed(1)},${sy(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const bandPath = (lo: (number | null)[], hi: (number | null)[]) => {
    const idx = hi.map((v, i) => (v != null && lo[i] != null ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 2) return '';
    return `M${idx.map((i) => `${sx(x[i])},${sy(hi[i]!)}`).join('L')}L${[...idx].reverse().map((i) => `${sx(x[i])},${sy(lo[i]!)}`).join('L')}Z`;
  };

  // Direct end-labels for ≤ 4 series; drop any that would collide.
  const endLabels = useMemo(() => {
    if (series.length > 4) return [];
    const out: { id: string; label: string; y: number; x: number }[] = [];
    for (const s of series) {
      const i = s.values.map((v, j) => (v != null ? j : -1)).filter((j) => j >= 0).pop();
      if (i === undefined) continue;
      const y = sy(s.values[i]!);
      if (out.some((o) => Math.abs(o.y - y) < 14 && Math.abs(o.x - sx(x[i])) < 80)) continue;
      out.push({ id: s.id, label: s.label, y, x: sx(x[i]) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, width, top]);

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left + M.left;
    let best = 0;
    x.forEach((v, i) => { if (Math.abs(sx(v) - px) < Math.abs(sx(x[best]) - px)) best = i; });
    setHover(best);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(x.length - 1, (h ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? x.length) - 1));
    else if (e.key === 'Escape') setHover(null);
    else return;
    e.preventDefault();
  };

  const tipLeft = hover != null ? Math.min(Math.max(sx(x[hover]) + 12, 0), width - 200) : 0;

  return (
    <div className={styles.chart} ref={wrap}>
      {(series.length > 1 || markers.length > 0) && (
        <ul className={styles.legend} aria-hidden>
          {series.length > 1 && series.map((s) => (
            <li key={s.id}>
              <svg width="18" height="8"><line x1="1" y1="4" x2="17" y2="4" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '4 3' : undefined} strokeLinecap="round" /></svg>
              {s.label}
            </li>
          ))}
          {series.length > 1 && references.map((r) => (
            <li key={r.label}>
              <svg width="18" height="8"><line x1="1" y1="4" x2="17" y2="4" stroke="var(--chart-reference)" strokeWidth="1" /></svg>
              {r.label}
            </li>
          ))}
          {markers.length > 0 && (
            <li>
              <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="var(--sys-color-on-surface)" /></svg>
              Events: {markers.map((m) => m.label).join(' · ')}
            </li>
          )}
        </ul>
      )}

      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${ariaLabel}. Use left and right arrow keys to read values.`}
        aria-describedby={tableId}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        className={styles.svg}
      >
        {alertRanges.map(([a, b]) => (
          <rect key={a} x={sx(a)} y={M.top} width={Math.max(2, sx(b) - sx(a))} height={H} fill="var(--state-critical-container)" />
        ))}
        {targetBand && (
          <g>
            <rect x={M.left} width={W} y={sy(targetBand.y1)} height={sy(targetBand.y0) - sy(targetBand.y1)} fill="var(--state-onplan-container)" />
            <text x={M.left + 6} y={sy(targetBand.y1) + 13} className={styles.refLabel}>{targetBand.label}</text>
          </g>
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={M.left + W} y1={sy(t)} y2={sy(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={M.left - 8} y={sy(t) + 4} textAnchor="end" className={styles.tick}>{yFormat(t)}</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = x0 + f * (x1 - x0);
          return <text key={f} x={sx(v)} y={height - 8} textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'} className={styles.tick}>{xFormat(v)}</text>;
        })}

        {references.map((r) => (
          <g key={r.label}>
            <line x1={M.left} x2={M.left + W} y1={sy(r.y)} y2={sy(r.y)} stroke="var(--chart-reference)" strokeWidth={1} />
            <text x={M.left + W} y={sy(r.y) - 6} textAnchor="end" className={styles.refLabel}>{r.label}</text>
          </g>
        ))}

        {series.map((s) => s.band && <path key={`${s.id}-band`} d={bandPath(s.band.lo, s.band.hi)} fill={s.color} opacity={0.12} />)}
        {series.map((s) => (
          <path key={s.id} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '6 4' : undefined} />
        ))}

        {markers.map((m) => (
          <g key={`${m.x}-${m.label}`}>
            <line x1={sx(m.x)} x2={sx(m.x)} y1={M.top} y2={M.top + H} stroke="var(--chart-reference)" strokeWidth={1} opacity={0.5} />
            <circle cx={sx(m.x)} cy={M.top + 4} r={4} fill="var(--sys-color-on-surface)" stroke="var(--chart-surface)" strokeWidth={2} />
          </g>
        ))}
        {nowX != null && (
          <g>
            <line x1={sx(nowX)} x2={sx(nowX)} y1={M.top} y2={M.top + H} stroke="var(--sys-color-on-surface)" strokeWidth={1} />
            <text x={sx(nowX) + 4} y={M.top + H - 6} className={styles.now}>Now</text>
          </g>
        )}

        {endLabels.map((l) => (
          <text key={l.id} x={Math.min(l.x + 6, M.left + W - 2)} y={l.y - 6} textAnchor={l.x > M.left + W - 90 ? 'end' : 'start'} className={styles.endLabel}>{l.label}</text>
        ))}

        {hover != null && (
          <g>
            <line x1={sx(x[hover])} x2={sx(x[hover])} y1={M.top} y2={M.top + H} stroke="var(--sys-color-on-surface)" strokeWidth={1} opacity={0.4} />
            {series.map((s) => s.values[hover] != null && (
              <circle key={s.id} cx={sx(x[hover])} cy={sy(s.values[hover]!)} r={4} fill={s.color} stroke="var(--chart-surface)" strokeWidth={2} />
            ))}
          </g>
        )}
        <rect x={M.left} y={M.top} width={W} height={H} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>

      {hover != null && (
        <div className={styles.tooltip} style={{ left: tipLeft, top: M.top + 8 + (series.length > 1 ? 28 : 0) }} role="status">
          <span className={styles.tipX}>{xFormat(x[hover])}</span>
          {series.map((s) => s.values[hover] != null && (
            <span key={s.id} className={styles.tipRow}>
              <svg width="14" height="6" aria-hidden><line x1="1" y1="3" x2="13" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '3 2' : undefined} /></svg>
              <strong>{yFormat(s.values[hover]!)}</strong>
              <span>{s.label}</span>
            </span>
          ))}
          {markers.filter((m) => Math.abs(m.x - x[hover]) < (x[1] - x[0]) / 2 + 0.01).map((m) => (
            <span key={m.label} className={styles.tipEvent}>● {m.label}</span>
          ))}
        </div>
      )}

      <details className={styles.table}>
        <summary>Show data table</summary>
        <div className={styles.tableScroll} id={tableId}>
          <table>
            <thead>
              <tr>
                <th scope="col">Time</th>
                {series.map((s) => <th key={s.id} scope="col">{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {x.map((v, i) => (
                <tr key={v}>
                  <th scope="row">{xFormat(v)}</th>
                  {series.map((s) => <td key={s.id}>{s.values[i] != null ? yFormat(s.values[i]!) : '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
