import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Switch } from '../../components/Switch';
import { ACTION_LABELS, ROLES, WINDOW_OPTIONS, sampleRecommendations, type ActionType, type Role } from '../../data/recommendations';
import { classifyRisk, routeFor, ROUTE_LABELS, TIER_LABELS, type Policy } from '../../logic/riskPolicy';
import { useRecommendations } from '../../state/RecommendationsContext';
import { tierTone } from './optimize/format';
import shared from './Build.module.css';
import styles from './PolicyTab.module.css';

/** The rules a team sets. The preview shows how open recommendations would be routed. */
export function PolicyTab() {
  const { policy, setPolicy } = useRecommendations();
  const [draft, setDraft] = useState<Policy>(policy);
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(policy), [policy]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(policy);
  const set = (p: Partial<Policy>) => {
    setDraft((d) => ({ ...d, ...p }));
    setSaved(false);
  };
  const toggleRole = (tier: 'medium' | 'high', role: Role) => {
    const list = draft.approvers[tier];
    const next = list.includes(role) ? list.filter((r) => r !== role) : [...list, role];
    set({ approvers: { ...draft.approvers, [tier]: next } });
  };
  const toggleCanary = (t: ActionType) =>
    set({ requireCanaryFor: draft.requireCanaryFor.includes(t) ? draft.requireCanaryFor.filter((x) => x !== t) : [...draft.requireCanaryFor, t] });

  const unusedWindows = WINDOW_OPTIONS.filter((w) => !draft.changeWindows.includes(w));
  const invalid =
    draft.approvers.medium.length === 0 || draft.approvers.high.length === 0 || draft.changeWindows.length === 0 || draft.highCostMin <= draft.lowCostMax;

  return (
    <section aria-labelledby="policy-title" className={styles.page}>
      <div>
        <h2 id="policy-title" className={shared.sectionTitle}>Approval policy</h2>
        <p className={styles.intro}>
          These rules decide how risky each recommendation is and who approves it. The recommender can’t change them,
          and it can only raise a risk rating, never lower it.
        </p>
      </div>

      <div className={styles.layout}>
        <div className={styles.form}>
          <fieldset className={styles.card}>
            <legend>Low-risk changes</legend>
            <Switch
              label="Apply automatically"
              description={draft.autoApplyLow ? 'Applied as soon as they’re generated. Anyone on the team can undo them.' : 'Collected in a digest for someone to apply in one go.'}
              checked={draft.autoApplyLow}
              onChange={(v) => set({ autoApplyLow: v })}
            />
          </fieldset>

          <fieldset className={styles.card}>
            <legend>Cost limits</legend>
            <label className={styles.sentence}>
              Changes that add up to
              <span className={styles.money}>
                $<input type="number" min={0} step={10} value={draft.lowCostMax} onChange={(e) => set({ lowCostMax: Number(e.target.value) })} />
              </span>
              a month are low risk.
            </label>
            <label className={styles.sentence}>
              Changes that add more than
              <span className={styles.money}>
                $<input type="number" min={0} step={50} value={draft.highCostMin} onChange={(e) => set({ highCostMin: Number(e.target.value) })} />
              </span>
              a month are high risk.
            </label>
            {draft.highCostMin <= draft.lowCostMax && <p className={styles.error}>The high-risk limit must be above the low-risk limit.</p>}
          </fieldset>

          <fieldset className={styles.card}>
            <legend>Who approves</legend>
            {(['medium', 'high'] as const).map((tier) => (
              <div key={tier} className={styles.roleRow}>
                <span className={styles.roleLabel}>
                  <Badge tone={tierTone[tier]}>{TIER_LABELS[tier]}</Badge>
                  <span>{tier === 'medium' ? 'Any one of:' : 'All of:'}</span>
                </span>
                <span className={styles.chips}>
                  {ROLES.map((r) => (
                    <label key={r} className={`${styles.chip} ${draft.approvers[tier].includes(r) ? styles.chipOn : ''}`}>
                      <input type="checkbox" checked={draft.approvers[tier].includes(r)} onChange={() => toggleRole(tier, r)} />
                      {r}
                    </label>
                  ))}
                </span>
                {draft.approvers[tier].length === 0 && <p className={styles.error}>Pick at least one approver.</p>}
              </div>
            ))}
          </fieldset>

          <fieldset className={styles.card}>
            <legend>Change windows</legend>
            <p className={styles.hint}>Medium- and high-risk changes run only inside these windows.</p>
            <ul className={styles.windows}>
              {draft.changeWindows.map((w) => (
                <li key={w}>
                  {w}
                  <button type="button" aria-label={`Remove ${w}`} onClick={() => set({ changeWindows: draft.changeWindows.filter((x) => x !== w) })}>
                    <X size={14} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            {unusedWindows.length > 0 && (
              <label className={styles.addWindow}>
                <span>Add a window</span>
                <select value="" onChange={(e) => e.target.value && set({ changeWindows: [...draft.changeWindows, e.target.value] })}>
                  <option value="">Choose…</option>
                  {unusedWindows.map((w) => <option key={w}>{w}</option>)}
                </select>
              </label>
            )}
            {draft.changeWindows.length === 0 && <p className={styles.error}>Add at least one window.</p>}
          </fieldset>

          <fieldset className={styles.card}>
            <legend>Roll out to a canary first</legend>
            <p className={styles.hint}>10% of new sessions for 30 minutes, then everyone if health checks pass.</p>
            <span className={styles.chips}>
              {(Object.keys(ACTION_LABELS) as ActionType[]).map((t) => (
                <label key={t} className={`${styles.chip} ${draft.requireCanaryFor.includes(t) ? styles.chipOn : ''}`}>
                  <input type="checkbox" checked={draft.requireCanaryFor.includes(t)} onChange={() => toggleCanary(t)} />
                  {ACTION_LABELS[t]}
                </label>
              ))}
            </span>
          </fieldset>

          <fieldset className={styles.card}>
            <legend>Expiry</legend>
            <label className={styles.sentence}>
              Recommendations expire after
              <span className={styles.money}>
                <input type="number" min={1} max={168} value={draft.expiryHours} onChange={(e) => set({ expiryHours: Number(e.target.value) })} />
              </span>
              hours if nobody acts on them.
            </label>
          </fieldset>

          <div className={styles.saveBar}>
            <Button disabled={!dirty || invalid} onClick={() => { setPolicy(draft); setSaved(true); }}>Save policy</Button>
            <Button variant="text" disabled={!dirty} onClick={() => setDraft(policy)}>Discard changes</Button>
            <span role="status" className={styles.savedNote}>{saved && !dirty ? 'Saved. Open recommendations were re-routed.' : dirty ? 'Unsaved changes' : ''}</span>
          </div>
        </div>

        <aside className={styles.preview} aria-labelledby="preview-title">
          <h3 id="preview-title">Preview</h3>
          <p className={styles.hint}>How current recommendations would be handled under these rules.</p>
          <ul>
            {sampleRecommendations
              .filter((r) => r.freshness !== 'expired')
              .map((r) => {
                const before = classifyRisk(r.facts, r.modelSuggestedRisk, policy).tier;
                const risk = classifyRisk(r.facts, r.modelSuggestedRisk, draft);
                const route = routeFor(risk.tier, draft);
                return (
                  <li key={r.id}>
                    <span className={styles.previewTitle}>{r.summary}</span>
                    <span className={styles.previewRoute}>
                      <Badge tone={tierTone[risk.tier]}>{TIER_LABELS[risk.tier]}</Badge>
                      {ROUTE_LABELS[route]}
                      {before !== risk.tier && <em className={styles.changed}>was {TIER_LABELS[before].toLowerCase()}</em>}
                    </span>
                  </li>
                );
              })}
          </ul>
        </aside>
      </div>
    </section>
  );
}
