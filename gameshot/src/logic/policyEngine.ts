/*
 * Policy engine: the deterministic backstop between the agent and the
 * infrastructure. The agent may be wrong; this layer must not be.
 * Every execution path (auto, prepare, human) goes through `decide`.
 */
import type { DelegationTier, Guardrails } from '../data/scale-mock';

export type ActionClassId = 'scale_up' | 'scale_down' | 'region_mix' | 'instance_type' | 'build_rollback' | 'prewarm';

export interface ProposedAction {
  actionClass: ActionClassId;
  instancesDelta: number; // + add, − remove
  costDeltaPerHr: number;
  /** Set when a person has explicitly approved this exact action. */
  humanApproved?: boolean;
}

export interface PolicyContext {
  guardrails: Guardrails;
  tiers: Partial<Record<ActionClassId, DelegationTier>>;
  autoSpentLastHourPerHr: number; // $/hr added by auto actions in the last 60 min
  currentSpendPerHr: number;
  budgetPerHr: number; // max hourly spend, possibly raised by a person for a launch window
  telemetryAgeMin: number;
  incident: boolean;
  instances: number;
  lastKnownGoodInstances: number;
  /** Instances serving live sessions; never drained. */
  busyInstances: number;
}

export type Route = 'auto' | 'prepare' | 'human' | 'blocked' | 'hold';

export interface PolicyDecision {
  route: Route;
  /** Delta the policy allows to execute (may be clamped for scale-down). */
  allowedDelta: number;
  reasons: string[];
  rule: string; // stable id for tests and the audit log
}

export const STALE_TELEMETRY_MIN = 3;
const LOCKED_HUMAN: ActionClassId[] = ['region_mix', 'instance_type', 'build_rollback'];

export function decide(a: ProposedAction, c: PolicyContext): PolicyDecision {
  const g = c.guardrails;

  // I3: fail closed on stale or missing telemetry, for every route.
  if (c.telemetryAgeMin > STALE_TELEMETRY_MIN)
    return { route: 'blocked', allowedDelta: 0, rule: 'fail_closed_stale', reasons: [`Telemetry is ${c.telemetryAgeMin} min old (limit ${STALE_TELEMETRY_MIN}). Nothing executes until it recovers.`] };

  if (a.actionClass === 'scale_down') {
    const remove = Math.abs(a.instancesDelta);
    // I4: keep the rollback buffer.
    const floor = Math.ceil((g.minRollbackPct / 100) * c.lastKnownGoodInstances);
    const byBuffer = Math.max(0, c.instances - Math.max(floor, c.busyInstances));
    // I5: only idle instances can be drained; busy ones are held.
    const idle = Math.max(0, c.instances - c.busyInstances);
    const allowed = Math.min(remove, byBuffer, idle);
    if (allowed === 0)
      return { route: 'hold', allowedDelta: 0, rule: remove > idle ? 'safety_hold' : 'rollback_buffer', reasons: [remove > idle ? 'Every candidate instance has live sessions. Safety hold.' : `Would go below the rollback buffer of ${floor} instances.`] };
    const clamped = allowed < remove;
    const route = c.incident ? 'human' : tierRoute(c.tiers.scale_down ?? 'auto', a);
    return {
      route,
      allowedDelta: -allowed,
      rule: clamped ? (allowed === byBuffer && byBuffer < idle ? 'rollback_buffer_clamp' : 'safety_hold_clamp') : c.incident ? 'incident_human' : 'tier',
      reasons: clamped ? [`Clamped from −${remove} to −${allowed}: ${remove - allowed} instances keep live sessions or the rollback buffer.`] : [],
    };
  }

  // I2: locked classes and incidents always need a person.
  if (c.incident) return humanOr(a, 'incident_human', 'A declared incident pauses all automation.');
  if (LOCKED_HUMAN.includes(a.actionClass)) return humanOr(a, 'locked_class', `${a.actionClass} is reserved for people.`);

  if (a.actionClass === 'scale_up') {
    // I1: caps.
    if (!a.humanApproved) {
      if (a.costDeltaPerHr > g.maxAutoPerAction)
        return { route: 'human', allowedDelta: a.instancesDelta, rule: 'cap_per_action', reasons: [`$${a.costDeltaPerHr}/hr is above the $${g.maxAutoPerAction} per-action cap.`] };
      if (c.autoSpentLastHourPerHr + a.costDeltaPerHr > g.maxAutoPerHour)
        return { route: 'human', allowedDelta: a.instancesDelta, rule: 'cap_per_hour', reasons: [`Would take auto spend this hour to $${c.autoSpentLastHourPerHr + a.costDeltaPerHr}, above the $${g.maxAutoPerHour} cap.`] };
    }
    if (c.currentSpendPerHr + a.costDeltaPerHr > c.budgetPerHr && !a.humanApproved)
      return { route: 'human', allowedDelta: a.instancesDelta, rule: 'budget', reasons: [`Total spend would pass the $${c.budgetPerHr}/hr budget.`] };
  }

  return { route: a.humanApproved ? 'auto' : tierRoute(c.tiers[a.actionClass] ?? 'human', a), allowedDelta: a.instancesDelta, rule: a.humanApproved ? 'human_approved' : 'tier', reasons: [] };
}

function tierRoute(t: DelegationTier, a: ProposedAction): Route {
  if (a.humanApproved) return 'auto';
  return t === 'auto' ? 'auto' : t === 'prepare' ? 'prepare' : 'human';
}

function humanOr(a: ProposedAction, rule: string, reason: string): PolicyDecision {
  return a.humanApproved
    ? { route: 'auto', allowedDelta: a.instancesDelta, rule: 'human_approved', reasons: [] }
    : { route: 'human', allowedDelta: a.instancesDelta, rule, reasons: [reason] };
}
