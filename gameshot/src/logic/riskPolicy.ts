/*
 * Deterministic risk classification and approval routing.
 * The model's suggested tier can raise the result, never lower it.
 */
import type { ActionType, RecommendationFacts, RiskTier, Role } from '../data/recommendations';

export interface Policy {
  autoApplyLow: boolean;
  lowCostMax: number;   // changes at or below this are low risk on cost
  highCostMin: number;  // changes above this are high risk on cost
  approvers: { medium: Role[]; high: Role[] };
  changeWindows: string[];
  requireCanaryFor: ActionType[];
  expiryHours: number;
}

export const defaultPolicy: Policy = {
  autoApplyLow: false,
  lowCostMax: 50,
  highCostMin: 1000,
  approvers: { medium: ['Team leads'], high: ['Team leads', 'Finance'] },
  changeWindows: ['Tue 02:00–04:00 UTC', 'Thu 02:00–04:00 UTC'],
  requireCanaryFor: ['compute_class', 'fleet_config'],
  expiryHours: 48,
};

export type Route = 'auto' | 'digest' | 'scheduled' | 'explicit';

export interface RiskResult {
  tier: RiskTier;
  reasons: string[];       // the rules that set the tier
  raisedByModel: boolean;  // the model's suggestion was higher than the rules
}

const rank: Record<RiskTier, number> = { low: 0, medium: 1, high: 2 };
const maxTier = (a: RiskTier, b: RiskTier) => (rank[a] >= rank[b] ? a : b);

const usd = (n: number) => `$${Math.abs(n).toLocaleString('en-US')}`;

export function classifyRisk(f: RecommendationFacts, modelSuggested: RiskTier, p: Policy): RiskResult {
  const factors: { tier: RiskTier; reason: string }[] = [];

  factors.push(
    f.reversibility === 'instant'
      ? { tier: 'low', reason: 'Can be undone instantly' }
      : f.reversibility === 'window'
        ? { tier: 'medium', reason: 'Undo takes effect within minutes' }
        : { tier: 'high', reason: 'Slow to undo (needs a fleet replacement)' },
  );

  const delta = f.monthlyCostDelta;
  factors.push(
    delta <= p.lowCostMax
      ? { tier: 'low', reason: delta < 0 ? `Saves ${usd(delta)}/month` : `Adds ${usd(delta)}/month or less` }
      : delta > p.highCostMin
        ? { tier: 'high', reason: `Adds more than ${usd(p.highCostMin)}/month` }
        : { tier: 'medium', reason: `Adds ${usd(delta)}/month (above ${usd(p.lowCostMax)})` },
  );

  factors.push(
    f.playersAffected === 'none'
      ? { tier: 'low', reason: 'No player sessions interrupted' }
      : f.playersAffected === 'canary'
        ? { tier: 'medium', reason: 'Affects a share of new sessions first' }
        : f.environment === 'production'
          ? { tier: 'high', reason: 'Affects every player on a production fleet' }
          : { tier: 'medium', reason: 'Affects every session on a test fleet' },
  );

  factors.push(
    f.actionType === 'compute_class'
      ? { tier: 'high', reason: 'Changes the instance type' }
      : f.actionType === 'optimization'
        ? { tier: 'low', reason: 'Alert or optimization only' }
        : { tier: 'medium', reason: f.actionType === 'scaling_threshold' ? 'Changes a scaling rule' : 'Changes fleet configuration' },
  );

  const rulesTier = factors.reduce<RiskTier>((t, x) => maxTier(t, x.tier), 'low');
  const tier = maxTier(rulesTier, modelSuggested);
  return {
    tier,
    reasons: factors.filter((x) => x.tier === rulesTier).map((x) => x.reason),
    raisedByModel: rank[modelSuggested] > rank[rulesTier],
  };
}

export function routeFor(tier: RiskTier, p: Policy): Route {
  if (tier === 'low') return p.autoApplyLow ? 'auto' : 'digest';
  return tier === 'medium' ? 'scheduled' : 'explicit';
}

export const ROUTE_LABELS: Record<Route, string> = {
  auto: 'Applies automatically',
  digest: 'Low-risk digest',
  scheduled: 'Scheduled change',
  explicit: 'Needs explicit approval',
};

export const TIER_LABELS: Record<RiskTier, string> = { low: 'Low risk', medium: 'Medium risk', high: 'High risk' };
