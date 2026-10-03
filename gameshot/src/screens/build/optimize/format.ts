import type { BadgeTone } from '../../../components/Badge';
import type { RiskTier } from '../../../data/recommendations';
import type { EnrichedRec } from '../../../state/RecommendationsContext';

export const tierTone: Record<RiskTier, BadgeTone> = { low: 'riskLow', medium: 'riskMedium', high: 'riskHigh' };

export function costLabel(delta: number) {
  if (delta === 0) return 'No cost change';
  const v = `$${Math.abs(delta).toLocaleString('en-US')}/month`;
  return delta > 0 ? `+${v}` : `Saves ${v}`;
}

/** One short line describing where a recommendation is in its lifecycle. */
export function statusLine(r: EnrichedRec, requiredSignOffs: number): string {
  if (r.state.analyzing) return 'Analyzing…';
  if (r.freshness === 'expired') return 'Expired';
  switch (r.displayStatus) {
    case 'auto_applied': return 'Applied automatically';
    case 'awaiting_approval': {
      const done = Object.values(r.state.approvals).filter(Boolean).length;
      return `${done} of ${requiredSignOffs} sign-offs`;
    }
    case 'scheduled': return `Scheduled · ${r.state.window}`;
    case 'applied': return 'Applied';
    case 'rejected': return 'Rejected';
    case 'rolled_back': return 'Rolled back';
    default: return r.freshness === 'stale' ? 'Signals changed · re-analyze' : 'Waiting for review';
  }
}

export const isOpen = (r: EnrichedRec) =>
  r.freshness !== 'expired' && ['pending', 'in_digest', 'awaiting_approval', 'scheduled'].includes(r.displayStatus);
