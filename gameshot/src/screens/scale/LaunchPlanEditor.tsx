import { useMemo, useState, type ChangeEvent } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { TimeSeriesChart } from '../../components/scale/TimeSeriesChart';
import { AI_CURVE, PHASES, type PhaseConfig, type PhaseId } from '../../data/scale-mock';
import { aiCurveConfig, costPerHourFor, fmtCompact, fmtT, fmtUsd, planCurve, range, validatePlan } from '../../logic/scaleSim';
import { useScale } from '../../state/ScaleContext';
import styles from './Scale.module.css';

export function LaunchPlanEditor() {
  const s = useScale();
  const [phaseId, setPhaseId] = useState<PhaseId>('launch');
  const [showAi, setShowAi] = useState(false);
  const cfg: PhaseConfig = s.draft ?? s.armedConfig;
  const armed = s.versions.find((v) => v.status === 'armed')!;
  const nextVersion = s.versions[0].version + 1;
  const issues = useMemo(() => validatePlan(cfg, s.guardrails), [cfg, s.guardrails]);
  const errors = issues.filter((i) => i.level === 'error');
  const phase = PHASES.find((p) => p.id === phaseId)!;

  const x = range(-60, 360, 15);
  const curveSeries = [
    { id: 'draft', label: s.draft ? `Draft v${nextVersion}` : `Armed v${armed.version}`, color: 'var(--chart-categorical-2)', values: x.map((t) => planCurve(cfg, t)) },
    ...(showAi ? [{ id: 'ai', label: 'AI suggestion', color: 'var(--chart-categorical-1)', dashed: true, values: x.map((t) => planCurve(aiCurveConfig, t)) }] : []),
  ];
  const costX = range(0, 360, 15);

  const num = (k: keyof PhaseConfig) => (e: ChangeEvent<HTMLInputElement>) => s.editDraft({ [k]: Number(e.target.value) } as Partial<PhaseConfig>);

  return (
    <section aria-labelledby="plan-title" className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h2 id="plan-title" className={styles.h2}>Launch plan</h2>
          <p className={styles.intro}>Your scaling logic as data: phases, the traffic you expect, and how capacity should follow it. Armed plans are never edited in place; changes become a new version.</p>
        </div>
        <div className={styles.versionBox}>
          <span><Badge tone="riskLow">Armed</Badge> v{armed.version} · {armed.at}</span>
          {s.draft && <span><Badge tone="riskMedium">Draft</Badge> v{nextVersion} · unsaved</span>}
        </div>
      </div>

      <div className={styles.planGrid}>
        <nav className={styles.timeline} aria-label="Phases">
          <ol>
            {PHASES.map((p) => (
              <li key={p.id}>
                <button type="button" aria-current={p.id === phaseId} className={p.id === phaseId ? styles.phaseActive : undefined} onClick={() => setPhaseId(p.id)}>
                  <span className={styles.phaseName}>{p.name}</span>
                  <span className={styles.phaseWindow}>{p.window}</span>
                  <span className={styles.phaseSummary}>{p.id === 'launch' ? `Peak ${fmtCompact(cfg.peakCcu)} at ${fmtT(cfg.hoursToPeak * 60)}` : p.summary}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {phase.id !== 'launch' ? (
          <div className={`${styles.panel} ${styles.emptyPhase}`}>
            <h3>{phase.name}</h3>
            <p>{phase.summary}.</p>
            <p className={styles.muted}>This prototype configures the Launch phase end to end. Other phases use the same form.</p>
          </div>
        ) : (
          <div className={styles.planForm}>
            <section className={styles.panel} aria-labelledby="curve-title">
              <div className={styles.panelHead}>
                <h3 id="curve-title">Expected concurrent players</h3>
                <Button variant="outline" size="sm" onClick={() => setShowAi(true)}>
                  <Sparkles size={16} aria-hidden /> Generate from 3 comparable launches
                </Button>
              </div>
              <TimeSeriesChart ariaLabel="Expected concurrent players for the launch phase" x={x} xFormat={fmtT} yFormat={fmtCompact} series={curveSeries} yMax={showAi || cfg.peakCcu > 60000 ? undefined : 60000} height={240} />
              <div className={styles.sliders}>
                <label>
                  <span>Peak <strong>{cfg.peakCcu.toLocaleString('en-US')} CCU</strong></span>
                  <input type="range" min={5000} max={150000} step={1000} value={cfg.peakCcu} onChange={(e) => s.editDraft({ peakCcu: Number(e.target.value), curveSource: 'manual' })} />
                </label>
                <label>
                  <span>Reached at <strong>{fmtT(cfg.hoursToPeak * 60)}</strong></span>
                  <input type="range" min={1} max={8} step={0.5} value={cfg.hoursToPeak} onChange={(e) => s.editDraft({ hoursToPeak: Number(e.target.value), curveSource: 'manual' })} />
                </label>
              </div>
              {showAi && (
                <div className={styles.aiPanel}>
                  <h4><Sparkles size={16} aria-hidden /> Suggested curve: peak {fmtCompact(AI_CURVE.peakCcu)} at {fmtT(AI_CURVE.hoursToPeak * 60)}</h4>
                  <p>{AI_CURVE.summary}</p>
                  <ul>
                    {AI_CURVE.launches.map((l) => (
                      <li key={l.name}><strong>{l.similarity}% similar</strong> · {l.name}<span>{l.note}</span></li>
                    ))}
                  </ul>
                  <p className={styles.missingNote}><AlertTriangle size={14} aria-hidden /> {AI_CURVE.missing}</p>
                  <div className={styles.row}>
                    <Button size="sm" onClick={() => { s.editDraft({ ...aiCurveConfig }); setShowAi(false); }}>Use this curve</Button>
                    <Button size="sm" variant="text" onClick={() => setShowAi(false)}>Keep mine</Button>
                  </div>
                </div>
              )}
            </section>

            <section className={styles.panel} aria-labelledby="cap-title">
              <h3 id="cap-title" className={styles.h3}>Capacity</h3>
              <div className={styles.formGrid}>
                <fieldset>
                  <legend>Instance mix</legend>
                  {cfg.instanceMix.map((m, i) => (
                    <label key={m.type} className={styles.pctRow}>
                      <span>{m.type}</span>
                      <input type="number" min={0} max={100} value={m.share} onChange={(e) => s.editDraft({ instanceMix: cfg.instanceMix.map((x, j) => (j === i ? { ...x, share: Number(e.target.value) } : x)) })} /> %
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Regions and weights</legend>
                  {cfg.regions.map((r, i) => (
                    <label key={r.id} className={styles.pctRow}>
                      <span>{r.id}</span>
                      <input type="number" min={0} max={100} value={r.weight} onChange={(e) => s.editDraft({ regions: cfg.regions.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)) })} /> %
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Headroom target</legend>
                  <label className={styles.sliderRow}>
                    <input type="range" min={10} max={50} value={cfg.headroomPct} onChange={num('headroomPct')} />
                    <strong>{cfg.headroomPct}%</strong>
                  </label>
                  <span className={styles.hint}>Recommended {s.guardrails.headroomMinPct}–{s.guardrails.headroomMaxPct}%</span>
                </fieldset>
                <fieldset>
                  <legend>Ramp and budget</legend>
                  <label className={styles.pctRow}><span>Warm buffer</span><input type="number" min={0} value={cfg.warmBufferInstances} onChange={num('warmBufferInstances')} /> instances</label>
                  <label className={styles.pctRow}><span>Ramp step</span><input type="number" min={1} value={cfg.rampStepInstances} onChange={num('rampStepInstances')} /> per 5 min</label>
                  <label className={styles.pctRow}><span>Budget</span><input type="number" min={0} step={50} value={cfg.budgetPerHour} onChange={num('budgetPerHour')} /> $/hr</label>
                </fieldset>
              </div>
            </section>

            <section className={styles.panel} aria-labelledby="cost-title">
              <div className={styles.panelHead}>
                <h3 id="cost-title">Projected cost per hour</h3>
                <span className={styles.muted}>Expected players + {cfg.headroomPct}% headroom</span>
              </div>
              <TimeSeriesChart
                ariaLabel="Projected cost per hour against the budget"
                x={costX}
                xFormat={fmtT}
                yFormat={(v) => fmtUsd(v)}
                series={[{ id: 'cost', label: 'Projected cost', color: 'var(--chart-categorical-2)', values: costX.map((t) => costPerHourFor(planCurve(cfg, t), cfg.headroomPct)) }]}
                references={[{ y: cfg.budgetPerHour, label: `Budget ${fmtUsd(cfg.budgetPerHour)}/hr` }]}
                height={180}
              />
            </section>

            <section className={`${styles.panel} ${errors.length ? styles.panelError : issues.length ? styles.panelWarn : styles.panelOk}`} aria-labelledby="val-title" aria-live="polite">
              <h3 id="val-title" className={styles.h3}>
                {errors.length ? <><AlertOctagon size={18} aria-hidden /> Can’t arm yet</> : issues.length ? <><AlertTriangle size={18} aria-hidden /> Ready to arm, with warnings</> : <><CheckCircle2 size={18} aria-hidden /> Fits your guardrails</>}
              </h3>
              {issues.length > 0 && (
                <ul className={styles.issues}>
                  {issues.map((i) => (
                    <li key={i.message} className={i.level === 'error' ? styles.bad : styles.warn}>
                      {i.message}{i.fix && <span>{i.fix}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <div className={styles.row}>
                <Button disabled={!s.draft || errors.length > 0} onClick={s.armDraft}>Arm as v{nextVersion}</Button>
                <Button variant="text" disabled={!s.draft} onClick={s.discardDraft}>Discard draft</Button>
                {!s.draft && <span className={styles.muted}>Change anything above to start a draft.</span>}
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
