import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { sampleRecommendations, type Recommendation, type Role } from '../data/recommendations';
import { classifyRisk, defaultPolicy, routeFor, type Policy, type RiskResult, type Route } from '../logic/riskPolicy';

export type Status =
  | 'pending'
  | 'in_digest'          // low risk, waiting for the batch
  | 'awaiting_approval'  // high risk, some approvers still to sign off
  | 'scheduled'
  | 'applied'
  | 'rejected'
  | 'rolled_back';

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
}

export interface RecState {
  status: Status;
  approvals: Partial<Record<Role, boolean>>;
  window?: string;
  rejectReason?: string;
  analyzing?: boolean;
}

export interface EnrichedRec extends Recommendation {
  risk: RiskResult;
  route: Route;
  state: RecState;
  /** What the UI should show, after applying policy (e.g. auto-apply). */
  displayStatus: Status | 'auto_applied';
}

interface Api {
  policy: Policy;
  setPolicy: (p: Policy) => void;
  recs: EnrichedRec[];
  audit: AuditEntry[];
  approve: (id: string, role?: Role, window?: string) => void;
  applyDigest: (ids: string[]) => void;
  reject: (id: string, reason: string) => void;
  runNow: (id: string) => void;
  rollBack: (id: string) => void;
  cancel: (id: string) => void;
  reanalyze: (id: string) => void;
}

const Ctx = createContext<Api | null>(null);

const now = () => new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const YOU = 'You (Team lead)';

const seedAudit: AuditEntry[] = [
  { id: 'a3', at: 'Dec 28, 2:14 PM', actor: 'Priya N. (Finance)', action: 'Approved', target: 'Reserve 2 c5.large instances for 1 year' },
  { id: 'a2', at: 'Dec 27, 3:02 AM', actor: 'Change window', action: 'Applied, then rolled back automatically after crash rate rose', target: 'Scale in at 30% CPU' },
  { id: 'a1', at: 'Dec 26, 10:40 AM', actor: 'Sam K. (Team lead)', action: 'Rejected: wrong diagnosis', target: 'Add 2 GB memory per session' },
];

export function RecommendationsProvider({ children }: { children: ReactNode }) {
  const [policy, setPolicyState] = useState<Policy>(defaultPolicy);
  const [states, setStates] = useState<Record<string, RecState>>(() =>
    Object.fromEntries(sampleRecommendations.map((r) => [r.id, { status: 'pending', approvals: {} } as RecState])),
  );
  const [freshness, setFreshness] = useState<Record<string, Recommendation['freshness']>>({});
  const [audit, setAudit] = useState<AuditEntry[]>(seedAudit);

  const log = (action: string, target: string, actor = YOU) =>
    setAudit((a) => [{ id: crypto.randomUUID(), at: now(), actor, action, target }, ...a]);

  const recs = useMemo<EnrichedRec[]>(
    () =>
      sampleRecommendations.map((r) => {
        const merged = { ...r, freshness: freshness[r.id] ?? r.freshness };
        const risk = classifyRisk(r.facts, r.modelSuggestedRisk, policy);
        const route = routeFor(risk.tier, policy);
        const state = states[r.id];
        const displayStatus = state.status === 'pending' && route === 'auto' && merged.freshness === 'current' ? 'auto_applied' : state.status;
        return { ...merged, risk, route, state, displayStatus };
      }),
    [policy, states, freshness],
  );

  const byId = (id: string) => recs.find((r) => r.id === id)!;
  const patch = (id: string, p: Partial<RecState>) => setStates((s) => ({ ...s, [id]: { ...s[id], ...p } }));

  const api: Api = {
    policy,
    recs,
    audit,
    setPolicy: (p) => {
      setPolicyState(p);
      log('Updated the approval policy', 'game-compute-start-1');
    },
    approve: (id, role, window) => {
      const r = byId(id);
      if (r.route === 'explicit' && role) {
        const approvals = { ...r.state.approvals, [role]: true };
        const allIn = policy.approvers.high.every((x) => approvals[x]);
        const win = window ?? policy.changeWindows[0];
        patch(id, { approvals, status: allIn ? 'scheduled' : 'awaiting_approval', window: allIn ? win : undefined });
        log(allIn ? `Approved (all sign-offs in), scheduled for ${win}` : `Approved as ${role}`, r.summary, role === 'Team leads' ? YOU : `Demo approver (${role})`);
      } else {
        const win = window ?? policy.changeWindows[0];
        patch(id, { status: 'scheduled', window: win });
        log(`Approved and scheduled for ${win}`, r.summary);
      }
    },
    applyDigest: (ids) => {
      ids.forEach((id) => patch(id, { status: 'applied' }));
      log(`Applied ${ids.length} low-risk change${ids.length > 1 ? 's' : ''} from the digest`, ids.map((id) => byId(id).summary).join('; '));
    },
    reject: (id, reason) => {
      patch(id, { status: 'rejected', rejectReason: reason });
      log(`Rejected: ${reason.toLowerCase()}`, byId(id).summary);
    },
    runNow: (id) => {
      patch(id, { status: 'applied' });
      log('Applied in change window (demo)', byId(id).summary, 'Change window');
    },
    rollBack: (id) => {
      patch(id, { status: 'rolled_back' });
      log('Rolled back', byId(id).summary);
    },
    cancel: (id) => {
      patch(id, { status: 'pending', approvals: {}, window: undefined });
      log('Cancelled the scheduled change', byId(id).summary);
    },
    reanalyze: (id) => {
      patch(id, { analyzing: true });
      window.setTimeout(() => {
        setFreshness((f) => ({ ...f, [id]: 'current' }));
        patch(id, { analyzing: false, status: 'pending', approvals: {} });
        log('Re-analyzed with the latest signals', byId(id).summary, 'Recommender');
      }, 1600);
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useRecommendations() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRecommendations must be used inside <RecommendationsProvider>');
  return v;
}
