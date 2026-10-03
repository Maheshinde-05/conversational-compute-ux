import { useEffect, useState } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '../../components/Button';
import type { DelegationTier, Guardrails as G } from '../../data/scale-mock';
import { useScale } from '../../state/ScaleContext';
import styles from './Scale.module.css';

const FIELDS: { key: keyof G; label: string; detail: string; unit: string; step?: number }[] = [
  { key: 'maxQueueWaitSec', label: 'Max queue wait (p95)', detail: 'The player-experience target the agent defends first', unit: 's' },
  { key: 'headroomMinPct', label: 'Headroom, at least', detail: 'Spare capacity above current players', unit: '%' },
  { key: 'headroomMaxPct', label: 'Headroom, at most', detail: 'Above this the agent recommends scaling down', unit: '%' },
  { key: 'maxHourlySpend', label: 'Max hourly spend', detail: 'Total compute cost per hour', unit: '$/hr', step: 50 },
  { key: 'maxAutoPerAction', label: 'Max auto-approved spend per action', detail: 'Largest single change the agent may make alone', unit: '$', step: 5 },
  { key: 'maxAutoPerHour', label: 'Max auto-approved spend per hour', detail: 'Total the agent may add alone in any hour', unit: '$', step: 10 },
  { key: 'regionalLatencyMs', label: 'Regional latency target (p95)', detail: 'Fallback regions must stay under this', unit: 'ms' },
];

const TIERS: { id: DelegationTier; name: string; detail: string }[] = [
  { id: 'auto', name: '1 · Auto-execute', detail: 'The agent acts, logs it and notifies you. Rollable back.' },
  { id: 'prepare', name: '2 · Auto-prepare, you confirm', detail: 'Instances start provisioning, but nothing goes live until one click.' },
  { id: 'human', name: '3 · Human only', detail: 'The agent recommends with evidence. A person decides.' },
];

export function Guardrails() {
  const s = useScale();
  const [draft, setDraft] = useState(s.guardrails);
  useEffect(() => setDraft(s.guardrails), [s.guardrails]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(s.guardrails);
  const invalid = draft.headroomMinPct >= draft.headroomMaxPct || draft.maxAutoPerAction > draft.maxAutoPerHour;

  return (
    <section aria-labelledby="gr-title" className={styles.page}>
      <div>
        <h2 id="gr-title" className={styles.h2}>Guardrails and delegation</h2>
        <p className={styles.intro}>The agent keeps the launch inside these limits at the lowest cost. It optimizes within them, never around them. When two limits conflict, it brings you the trade-off instead of guessing.</p>
      </div>

      <section className={styles.panel} aria-labelledby="limits-title">
        <h3 id="limits-title" className={styles.h3}>Limits</h3>
        <div className={styles.limits}>
          {FIELDS.map((f) => (
            <label key={f.key} className={styles.limit}>
              <span className={styles.limitText}><strong>{f.label}</strong><span>{f.detail}</span></span>
              <span className={styles.limitInput}>
                <input type="number" min={0} step={f.step ?? 1} value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) })} />
                <span>{f.unit}</span>
              </span>
            </label>
          ))}
          <div className={styles.limit}>
            <span className={styles.limitText}><strong>Minimum rollback capacity</strong><span>Always keeps this share of last-known-good capacity</span></span>
            <span className={styles.limitInput}><Lock size={14} aria-hidden /> {draft.minRollbackPct}% · system-managed</span>
          </div>
        </div>
        {draft.headroomMinPct >= draft.headroomMaxPct && <p className={styles.bad}>Minimum headroom must be below the maximum.</p>}
        {draft.maxAutoPerAction > draft.maxAutoPerHour && <p className={styles.bad}>The per-action cap can’t be larger than the per-hour cap.</p>}
        <div className={styles.row}>
          <Button disabled={!dirty || invalid} onClick={() => s.setGuardrails(draft)}>Save limits</Button>
          <Button variant="text" disabled={!dirty} onClick={() => setDraft(s.guardrails)}>Discard</Button>
        </div>
      </section>

      <section aria-labelledby="tiers-title">
        <h3 id="tiers-title" className={styles.h3}>Who acts</h3>
        <p className={styles.intro}>Each kind of action sits in one tier. Trust is earned per action class, never granted globally.</p>
        <div className={styles.tiers}>
          {TIERS.map((t) => (
            <section key={t.id} className={`${styles.tier} ${styles[`tier_${t.id}`]}`} aria-labelledby={`tier-${t.id}`}>
              <h4 id={`tier-${t.id}`}>{t.name}</h4>
              <p className={styles.hint}>{t.detail}</p>
              <ul>
                {s.actionClasses.filter((a) => a.tier === t.id).map((a) => (
                  <li key={a.id}>
                    <strong>{a.label}</strong>
                    <span>{a.detail}</span>
                    {a.locked ? (
                      <span className={styles.locked}><Lock size={12} aria-hidden /> {a.locked}</span>
                    ) : (
                      <label className={styles.moveTo}>
                        Tier
                        <select value={a.tier} onChange={(e) => s.setTier(a.id, e.target.value as DelegationTier)}>
                          <option value="auto">1 · Auto-execute</option>
                          <option value="prepare">2 · Auto-prepare</option>
                          <option value="human">3 · Human only</option>
                        </select>
                      </label>
                    )}
                    {a.id === 'scale_up_within' && <span className={styles.capNote}>Caps: {'$'}{s.guardrails.maxAutoPerAction} per action, {'$'}{s.guardrails.maxAutoPerHour} per hour</span>}
                  </li>
                ))}
                {s.actionClasses.every((a) => a.tier !== t.id) && <li className={styles.emptyTier}>Nothing in this tier</li>}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="earned-title">
        <h3 id="earned-title" className={styles.h3}><Sparkles size={18} aria-hidden /> Earned delegation</h3>
        {s.suggestion === 'open' ? (
          <div className={styles.suggestionInline}>
            <p><strong>You’ve approved 6 scale-ups in us-east-1 this launch.</strong> Auto-execute them up to $75 per action?</p>
            <div className={styles.row}>
              <Button size="sm" onClick={s.acceptSuggestion}>Auto-execute up to $75</Button>
              <Button size="sm" variant="text" onClick={s.dismissSuggestion}>Not now</Button>
            </div>
          </div>
        ) : s.suggestion === 'accepted' ? (
          <p>us-east-1 scale-ups now auto-execute up to $75 per action. Accepted this launch, logged in the audit log.</p>
        ) : (
          <p className={styles.muted}>When you approve the same kind of action several times, the agent offers to take it on, one action class at a time. Approve the T+1h30m card on the Live tab to see it.</p>
        )}
      </section>
    </section>
  );
}
