import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ACTION_CLASSES, CARDS, DEFAULT_GUARDRAILS, MOMENTS, PHASES, PLAN_VERSIONS, SEED_AUDIT,
  type ActionClass, type DelegationTier, type Guardrails, type PhaseConfig, type PlanVersion, type ScaleAuditEntry,
} from '../data/scale-mock';
import { fmtT, validatePlan } from '../logic/scaleSim';

export type CardStatus = 'open' | 'executing' | 'executed' | 'declined' | 'rolled_back' | 'held';

export interface CardState {
  status: CardStatus;
  progress?: number; // 0–100 while executing
  chosen?: string; // option or variant chosen
  declineReason?: string;
}

interface Api {
  guardrails: Guardrails;
  setGuardrails: (g: Guardrails) => void;
  actionClasses: ActionClass[];
  setTier: (id: string, tier: DelegationTier) => void;

  armedConfig: PhaseConfig;
  versions: PlanVersion[];
  draft: PhaseConfig | null;
  editDraft: (patch: Partial<PhaseConfig>) => void;
  discardDraft: () => void;
  armDraft: () => void;

  momentIndex: number;
  setMomentIndex: (i: number) => void;
  cardStates: Record<string, CardState>;
  deadlines: Record<string, number>;
  approve: (cardId: string, chosen?: string) => void;
  decline: (cardId: string, reason: string) => void;
  rollBack: (cardId: string) => void;
  hold: (cardId: string) => void;

  audit: ScaleAuditEntry[];
  suggestion: 'hidden' | 'open' | 'accepted' | 'dismissed';
  acceptSuggestion: () => void;
  dismissSuggestion: () => void;
}

const Ctx = createContext<Api | null>(null);
const launch = PHASES.find((p) => p.id === 'launch')!.config!;

export function ScaleProvider({ children }: { children: ReactNode }) {
  const [guardrails, setGuardrailsState] = useState(DEFAULT_GUARDRAILS);
  const [actionClasses, setActionClasses] = useState(ACTION_CLASSES);
  const [armedConfig, setArmedConfig] = useState<PhaseConfig>(launch);
  const [versions, setVersions] = useState(PLAN_VERSIONS);
  const [draft, setDraft] = useState<PhaseConfig | null>(null);
  const [momentIndex, setMomentIndexState] = useState(MOMENTS.findIndex((m) => m.id === 'm90'));
  const [cardStates, setCardStates] = useState<Record<string, CardState>>(() =>
    Object.fromEntries(Object.keys(CARDS).map((id) => [id, { status: id === 'c-auto45' ? 'executed' : 'open' } as CardState])),
  );
  const [deadlines, setDeadlines] = useState<Record<string, number>>({});
  const [audit, setAudit] = useState(SEED_AUDIT);
  const [suggestion, setSuggestion] = useState<Api['suggestion']>('hidden');
  const timers = useRef<number[]>([]);

  const moment = MOMENTS[momentIndex];
  const nowLabel = moment.t === 1440 ? 'T+24h' : fmtT(moment.t);
  const log = (e: Omit<ScaleAuditEntry, 'id' | 't' | 'phase'> & { t?: string }) =>
    setAudit((a) => [{ id: crypto.randomUUID(), t: e.t ?? nowLabel, phase: 'launch', ...e }, ...a]);
  const patchCard = (id: string, p: Partial<CardState>) => setCardStates((s) => ({ ...s, [id]: { ...s[id], ...p } }));

  // Start each time-sensitive card's clock the first time its moment is shown.
  useEffect(() => {
    const now = Date.now();
    setDeadlines((d) => {
      const next = { ...d };
      for (const id of moment.cardIds) if (CARDS[id].countdownMin && !next[id]) next[id] = now + CARDS[id].countdownMin! * 60_000;
      return next;
    });
  }, [moment]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const execute = (id: string, chosen?: string) => {
    patchCard(id, { status: 'executing', progress: 0, chosen });
    [20, 45, 70, 100].forEach((p, i) =>
      timers.current.push(window.setTimeout(() => patchCard(id, p === 100 ? { status: 'executed', progress: 100 } : { progress: p }), (i + 1) * 1200)),
    );
  };

  const api: Api = {
    guardrails,
    setGuardrails: (g) => {
      setGuardrailsState(g);
      log({ t: 'Settings', action: 'Updated guardrails', trigger: 'Manual', costDelta: '—', decision: 'Plan', who: 'You', outcome: 'Applies to the armed plan immediately', rollback: false });
    },
    actionClasses,
    setTier: (id, tier) => {
      setActionClasses((list) => list.map((a) => (a.id === id ? { ...a, tier } : a)));
      const a = actionClasses.find((x) => x.id === id)!;
      log({ t: 'Settings', action: `Moved “${a.label}” to ${tier === 'auto' ? 'auto-execute' : tier === 'prepare' ? 'auto-prepare' : 'human only'}`, trigger: 'Manual', costDelta: '—', decision: 'Plan', who: 'You', outcome: 'Delegation updated', rollback: false });
    },

    armedConfig,
    versions,
    draft,
    editDraft: (patch) => setDraft((d) => ({ ...(d ?? armedConfig), ...patch })),
    discardDraft: () => setDraft(null),
    armDraft: () => {
      if (!draft || validatePlan(draft, guardrails).some((i) => i.level === 'error')) return;
      const v = versions[0].version + 1;
      setVersions((list) => [
        { version: v, status: 'armed', note: draft.curveSource === 'ai' ? 'Expected curve from comparable launches' : 'Edited launch phase', at: 'Just now' },
        ...list.map((x) => (x.status === 'armed' ? { ...x, status: 'superseded' as const } : x)),
      ]);
      setArmedConfig(draft);
      setDraft(null);
      log({ t: 'Plan', action: `Armed launch plan v${v}`, trigger: 'Manual', costDelta: '—', decision: 'Plan', who: 'You', outcome: `v${v - 1} superseded; validated against guardrails`, rollback: false });
    },

    momentIndex,
    setMomentIndex: setMomentIndexState,
    cardStates,
    deadlines,
    approve: (cardId, chosen) => {
      const c = CARDS[cardId];
      if (c.kind === 'auto_pending') {
        execute(cardId, chosen);
        log({ action: 'Scale-down −150 instances (safety hold)', trigger: 'Traffic −18% from peak', costDelta: '−$150/hr', decision: 'Approved', who: 'You', outcome: 'Draining idle servers; no sessions interrupted', rollback: true });
        return;
      }
      if (c.kind === 'conflict') {
        const o = c.options!.find((x) => x.id === chosen)!;
        execute(cardId, chosen);
        log({ action: o.label, trigger: 'eu-west-1 out of capacity', costDelta: chosen === 'fallback' ? '+$34/hr' : '+$0', decision: 'Approved', who: 'You', outcome: chosen === 'fallback' ? 'EU sessions placed in eu-west-2' : 'Retrying eu-west-1', rollback: chosen === 'fallback' });
        return;
      }
      const partial = chosen === 'partial';
      execute(cardId, chosen);
      log({
        action: partial ? '+8 instances (within budget)' : '+128 instances; launch budget raised to $900/hr until T+6h',
        trigger: 'CCU 5× plan; queue p95 54 s rising',
        costDelta: partial ? '+$8/hr' : '+$128/hr',
        decision: 'Approved', who: 'You',
        outcome: partial ? 'Queue still projected to breach at T+1h50m' : 'Provisioning; ready in ~6 min',
        rollback: true,
      });
      if (!partial && suggestion === 'hidden') setSuggestion('open');
    },
    decline: (cardId, reason) => {
      patchCard(cardId, { status: 'declined', declineReason: reason });
      log({ action: `Declined: ${CARDS[cardId].title}`, trigger: '—', costDelta: '—', decision: 'Declined', who: 'You', outcome: `Reason: ${reason}`, rollback: false });
    },
    rollBack: (cardId) => {
      patchCard(cardId, { status: 'rolled_back' });
      log({ action: `Rolled back: ${CARDS[cardId].title}`, trigger: 'Manual', costDelta: '—', decision: 'Approved', who: 'You', outcome: 'Previous capacity restored; live sessions kept', rollback: false });
    },
    hold: (cardId) => {
      patchCard(cardId, { status: 'held' });
      log({ action: 'Held scale-down', trigger: 'Manual', costDelta: '+$150/hr kept', decision: 'Held', who: 'You', outcome: 'Capacity kept for a possible second wave', rollback: false });
    },

    audit,
    suggestion,
    acceptSuggestion: () => {
      setGuardrailsState((g) => ({ ...g, maxAutoPerAction: 75 }));
      setSuggestion('accepted');
      log({ action: 'Raised auto-execute cap for us-east-1 scale-ups to $75 per action', trigger: '6 approvals this launch', costDelta: '—', decision: 'Plan', who: 'You', outcome: 'Delegation earned for one action class', rollback: true });
    },
    dismissSuggestion: () => setSuggestion('dismissed'),
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useScale() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useScale must be used inside <ScaleProvider>');
  return v;
}
