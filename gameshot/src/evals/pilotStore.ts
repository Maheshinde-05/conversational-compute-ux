/*
 * Pilot study sessions recorded on this device. Moderated pilots run on one
 * laptop, so per-browser storage is enough; export JSON to combine devices.
 */
import type { PilotSummary } from './scorecard';

export interface PilotSession {
  id: string;
  participant: string;
  condition: 'shown' | 'collapsed';
  at: string;
  comprehension: { correct: number; total: number };
  decisions: { id: string; good: boolean; approved: boolean; seconds: number; evidenceOpened: boolean; timed: boolean }[];
  guardrailCorrect: boolean;
  delegationPass: boolean | null;
}

const KEY = 'gameshot.pilotSessions.v1';

export function loadSessions(): PilotSession[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PilotSession[]) : [];
  } catch {
    return [];
  }
}

export function saveSession(s: PilotSession) {
  try { localStorage.setItem(KEY, JSON.stringify([...loadSessions(), s])); } catch { /* storage unavailable: session stays exportable */ }
}

export function clearSessions() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

export function summarize(sessions: PilotSession[]): PilotSummary & { byCondition: Record<'shown' | 'collapsed', { n: number; rejectFlawed: number | null }>; delegation: number | null } {
  const dec = sessions.flatMap((s) => s.decisions.map((d) => ({ ...d, condition: s.condition })));
  const good = dec.filter((d) => d.good);
  const flawed = dec.filter((d) => !d.good);
  const comp = sessions.reduce((a, s) => ({ c: a.c + s.comprehension.correct, t: a.t + s.comprehension.total }), { c: 0, t: 0 });
  const approvals = dec.filter((d) => d.approved && d.condition === 'collapsed');
  const timed = dec.filter((d) => d.timed);
  const deleg = sessions.filter((s) => s.delegationPass !== null);
  const rate = (xs: unknown[], of: unknown[]) => (of.length ? xs.length / of.length : null);
  const byCond = (c: 'shown' | 'collapsed') => { const f = flawed.filter((d) => d.condition === c); return { n: sessions.filter((s) => s.condition === c).length, rejectFlawed: rate(f.filter((d) => !d.approved), f) }; };
  const summary = {
    sessions: sessions.length,
    comprehension: comp.t ? comp.c / comp.t : null,
    approveGood: rate(good.filter((d) => d.approved), good),
    rejectFlawed: rate(flawed.filter((d) => !d.approved), flawed),
    medianDecisionSec: median(timed.map((d) => d.seconds)),
    rubberStamp: rate(approvals.filter((d) => !d.evidenceOpened), approvals),
    guardrailComprehension: rate(sessions.filter((s) => s.guardrailCorrect), sessions),
    delegation: rate(deleg.filter((s) => s.delegationPass), deleg),
    byCondition: { shown: byCond('shown'), collapsed: byCond('collapsed') },
  };
  const ok = (v: number | null, min: number) => v !== null && v >= min;
  const allPass = summary.sessions >= 5 && ok(summary.comprehension, 0.8) && ok(summary.approveGood, 0.8) && ok(summary.rejectFlawed, 0.8)
    && summary.medianDecisionSec !== null && summary.medianDecisionSec < 300 && (summary.rubberStamp === null || summary.rubberStamp < 0.2) && ok(summary.guardrailComprehension, 0.8);
  return { ...summary, allPass };
}
