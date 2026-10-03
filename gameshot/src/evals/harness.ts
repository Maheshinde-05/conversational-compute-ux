/*
 * Replay harness: runs a trace through agent → policy engine → operator →
 * simulated infrastructure, minute by minute, and records everything the
 * scorecard needs. Also runs the three baselines on the same world.
 */
import { CCU_PER_INSTANCE, DEFAULT_GUARDRAILS, PRICE_PER_INSTANCE_HR, PROVISIONING_LAG_MIN, type Guardrails } from '../data/scale-mock';
import { CLAIM_HORIZON, createAgent, type AgentOutput } from '../logic/scaleAgent';
import { decide, type ActionClassId, type PolicyDecision, type ProposedAction } from '../logic/policyEngine';
import type { EvalTrace } from './traces';

export type Strategy = 'agent' | 'reactive' | 'static' | 'oracle';

export interface Minute { t: number; demand: number; capacity: number; instances: number; queueP95: number; waiting: number; costPerHr: number; telemetryOk: boolean }

export interface Decision {
  t: number;
  instancesAtT: number;
  pendingAtT: number;
  output: AgentOutput;
  /** Route given at decision time (before any human approval). */
  routedTo?: string;
  proposed?: ProposedAction;
  policy?: PolicyDecision;
  executedAt?: number;
  executedDelta?: number;
  /** Ground truth for claims and calibration. */
  truth?: { breachInMin: number | null; peakWaiting: number; leadTimeMin: number; costDeltaPerHr: number | null; correct: boolean | null };
}

export interface AuditRow { t: number; action: string; trigger: string; decision: string; who: string; outcome: string; cost: number }

export interface RunResult {
  trace: EvalTrace;
  strategy: Strategy;
  minutes: Minute[];
  decisions: Decision[];
  audit: AuditRow[];
  executions: { t: number; delta: number; route: string; rule: string; actionClass: ActionClassId; costDeltaPerHr: number; autoSpentBefore: number; capsAtTime: { perAction: number; perHour: number } }[];
  invariantBreaches: string[];
  metrics: {
    minutesAboveTarget: number;
    peakQueue: number;
    totalCost: number;
    costPerCcuHour: number;
    wastePct: number;
    flaps: number;
    timing: { early: number; onTime: number; late: number };
    budgetRaised: boolean;
  };
}

const cpiAt = (tr: EvalTrace, m: number) => (CCU_PER_INSTANCE / (tr.load?.(m) ?? 1)) * (tr.efficiency?.(m) ?? 1);
const queueFor = (d: number, cap: number) => {
  const waiting = Math.max(0, d - cap);
  const headroom = cap > 0 ? Math.max(0, ((cap - d) / cap) * 100) : 0;
  return { waiting, q: waiting > 0 ? Math.min(600, 30 + 2600 * (waiting / d)) : 4 + Math.max(0, 10 - headroom) * 3 };
};

export function runTrace(tr: EvalTrace, strategy: Strategy = 'agent', base: Guardrails = DEFAULT_GUARDRAILS): RunResult {
  const g: Guardrails = { ...base, ...tr.guardrails };
  const step = createAgent(g);
  let instances = tr.warmInstances;
  let orders: { at: number; n: number }[] = [];
  let budget = g.maxHourlySpend;
  let budgetRaised = false;
  let lastFreshAt = 0;
  let loadOverride: number | null = null; // after a build rollback
  const lastKnownGood = { n: instances };
  const autoLog: { t: number; usd: number }[] = [];
  const minutes: Minute[] = [];
  const decisions: Decision[] = [];
  const audit: AuditRow[] = [];
  const executions: RunResult['executions'] = [];
  const invariantBreaches: string[] = [];
  const humanQueue: { due: number; decision: Decision; option?: string }[] = [];
  const dirs: number[] = [];
  const lead = (m: number) => tr.leadTimeMin?.(m) ?? PROVISIONING_LAG_MIN;
  const load = (m: number) => loadOverride ?? tr.load?.(m) ?? 1;
  const cpi = (m: number) => (CCU_PER_INSTANCE / load(m)) * (tr.efficiency?.(m) ?? 1);
  const inGap = (m: number) => (tr.telemetryGaps ?? []).some(([a, b]) => m >= a && m < b);

  const execute = (t: number, d: Decision, delta: number, who: string, trigger: string) => {
    const p = d.proposed!;
    if (delta > 0) orders.push({ at: t + lead(t), n: delta });
    else instances += delta;
    const autoSpentBefore = autoLog.filter((a) => a.t > t - 60).reduce((a, x) => a + x.usd, 0);
    if (who === 'Agent' && delta > 0) autoLog.push({ t, usd: delta * PRICE_PER_INSTANCE_HR });
    d.executedAt = t;
    d.executedDelta = delta;
    dirs.push(Math.sign(delta));
    executions.push({ t, delta, route: d.policy!.route, rule: d.policy!.rule, actionClass: p.actionClass, costDeltaPerHr: delta * PRICE_PER_INSTANCE_HR, autoSpentBefore, capsAtTime: { perAction: g.maxAutoPerAction, perHour: g.maxAutoPerHour } });
    audit.push({ t, action: `${p.actionClass} ${delta > 0 ? '+' : ''}${delta}`, trigger, decision: d.policy!.route, who, outcome: delta > 0 ? `Ordered; ready at T+${t + lead(t)}m` : 'Drained idle instances', cost: delta * PRICE_PER_INSTANCE_HR });
  };

  const ctxAt = (t: number, telemetryAge: number) => {
    const d = tr.demand(t);
    const long = tr.longSessionShare ?? 0.2;
    const recentPeak = Math.max(...minutes.filter((x) => x.t > t - 30).map((x) => x.demand), d);
    return {
      guardrails: g,
      tiers: { scale_up: 'auto', scale_down: 'auto', prewarm: 'prepare' } as const,
      autoSpentLastHourPerHr: autoLog.filter((a) => a.t > t - 60).reduce((a, x) => a + x.usd, 0),
      currentSpendPerHr: (instances + orders.reduce((a, o) => a + o.n, 0)) * PRICE_PER_INSTANCE_HR,
      budgetPerHr: budget,
      telemetryAgeMin: telemetryAge,
      incident: false,
      instances,
      lastKnownGoodInstances: lastKnownGood.n,
      busyInstances: Math.min(instances, Math.ceil(Math.max(d, long * recentPeak) / cpi(t))),
    };
  };

  for (let t = 0; t <= tr.durationMin; t++) {
    orders = orders.filter((o) => (o.at <= t ? ((instances += o.n), false) : true));
    const d = tr.demand(t);
    const capacity = instances * cpi(t);
    const { waiting, q } = queueFor(d, capacity);
    const anomaly = tr.queueAnomaly && t >= tr.queueAnomaly.from && t <= tr.queueAnomaly.to ? tr.queueAnomaly.sec(t) : 0;
    const queueP95 = Math.min(600, q + anomaly);
    const telemetryOk = !inGap(t);
    if (telemetryOk) lastFreshAt = t;
    if (queueP95 <= g.maxQueueWaitSec && waiting === 0) lastKnownGood.n = Math.max(lastKnownGood.n * 0.98, instances);
    minutes.push({ t, demand: d, capacity, instances, queueP95, waiting, costPerHr: instances * PRICE_PER_INSTANCE_HR, telemetryOk });

    if (strategy !== 'agent') { baselineStep(tr, strategy, t, minutes, () => instances, (n) => { if (n > 0) orders.push({ at: t + lead(t), n }); else instances += n; dirs.push(Math.sign(n)); }, () => orders.reduce((a, o) => a + o.n, 0), g); continue; }

    // human decisions coming due
    for (const h of humanQueue.filter((x) => x.due === t)) {
      const dd = h.decision;
      const telemetryAge = t - lastFreshAt;
      if (dd.output.kind === 'investigate' && dd.output.reason === 'build_regression') {
        const re = decide({ ...dd.proposed!, humanApproved: true }, ctxAt(t, telemetryAge));
        if (re.route === 'blocked') continue;
        dd.policy = re;
        dd.executedAt = t;
        loadOverride = 1;
        audit.push({ t, action: 'build_rollback to 1.0.0', trigger: 'CPU/RAM per session +40% after deploy', decision: 'human', who: 'Operator', outcome: 'Previous build restored', cost: 0 });
        continue;
      }
      if (h.option === 'raise_cap') { budget = Math.round(g.maxHourlySpend * 1.8); budgetRaised = true; audit.push({ t, action: `Raised launch-window budget to $${budget}/hr`, trigger: 'Trade-off card', decision: 'human', who: 'Operator', outcome: 'Guardrail change logged', cost: 0 }); }
      const re = decide({ ...dd.proposed!, humanApproved: true }, ctxAt(t, telemetryAge));
      dd.policy = re;
      if (re.route === 'blocked' || re.route === 'hold' || re.allowedDelta === 0) continue;
      execute(t, dd, re.allowedDelta, 'Operator', triggerOf(dd.output));
    }

    const telemetryAge = t - lastFreshAt;
    const obs = {
      t,
      ccu: telemetryOk ? d : null,
      queueP95: telemetryOk ? queueP95 : null,
      telemetryAgeMin: telemetryAge,
      loadPerSession: telemetryOk ? load(t) : null,
      buildVersion: tr.version?.(t) ?? '1.0.0',
      instances,
      pendingInstances: orders.reduce((a, o) => a + o.n, 0),
      expectedCcu: tr.noBaselineUntil && t < tr.noBaselineUntil ? null : tr.expected(t),
      preferredTypeAvailable: !(tr.typeUnavailableFrom != null && t >= tr.typeUnavailableFrom),
      budgetPerHr: budget,
    };
    const out = step(obs);
    if (t % 5 !== 0 && out.kind === 'none') continue;
    const dec: Decision = { t, output: out, instancesAtT: instances, pendingAtT: obs.pendingInstances };
    decisions.push(dec);

    // translate output → proposed action
    let proposed: ProposedAction | undefined;
    let option: string | undefined;
    if (out.kind === 'scale') proposed = { actionClass: out.direction === 'up' ? 'scale_up' : 'scale_down', instancesDelta: out.direction === 'up' ? out.instances : -out.instances, costDeltaPerHr: out.direction === 'up' ? out.instances * PRICE_PER_INSTANCE_HR : -out.instances * PRICE_PER_INSTANCE_HR };
    if (out.kind === 'tradeoff') {
      const pick = out.options[0];
      option = pick.id;
      proposed = { actionClass: pick.id === 'alt_type' ? 'instance_type' : 'scale_up', instancesDelta: pick.instances, costDeltaPerHr: pick.instances * PRICE_PER_INSTANCE_HR * (pick.id === 'alt_type' ? 1.08 : 1) };
    }
    if (out.kind === 'investigate' && out.reason === 'build_regression') proposed = { actionClass: 'build_rollback', instancesDelta: 0, costDeltaPerHr: 0 };
    if (!proposed) continue;

    dec.proposed = proposed;
    const pol = decide(proposed, ctxAt(t, telemetryAge));
    dec.policy = pol;
    // tradeoffs are always a human decision, whatever the policy route
    const route = out.kind === 'tradeoff' ? 'human' : pol.route;
    dec.routedTo = route;
    if (route === 'auto' && pol.allowedDelta !== 0) execute(t, dec, pol.allowedDelta, 'Agent', triggerOf(out));
    else if (route === 'prepare' || route === 'human') {
      if (tr.operatorDelayMin === null) {
        audit.push({ t, action: `${proposed.actionClass} ${proposed.instancesDelta}`, trigger: triggerOf(out), decision: 'awaiting human', who: 'Agent', outcome: 'No operator online; not executed', cost: 0 });
        continue;
      }
      // a newer recommendation of the same class updates the open card; the operator's clock keeps running
      const open = humanQueue.find((h) => h.due > t && h.decision.proposed?.actionClass === proposed.actionClass);
      if (open) { open.decision = dec; open.option = option; }
      else humanQueue.push({ due: t + (route === 'prepare' ? 1 : tr.operatorDelayMin), decision: dec, option });
    }
  }

  // ground truth for claims & calibration (agent only)
  if (strategy === 'agent') for (const dec of decisions) dec.truth = truthFor(tr, dec, minutes, g, lead);

  // runtime invariant checks
  for (const e of executions) {
    if (e.route === 'auto' && e.rule !== 'human_approved' && e.actionClass === 'scale_up' && (e.costDeltaPerHr > e.capsAtTime.perAction || e.autoSpentBefore + e.costDeltaPerHr > e.capsAtTime.perHour)) invariantBreaches.push(`I1 at T+${e.t}m`);
    if (e.route === 'auto' && ['region_mix', 'instance_type', 'build_rollback'].includes(e.actionClass) && e.rule !== 'human_approved') invariantBreaches.push(`I2 at T+${e.t}m`);
    if (!minutes[e.t].telemetryOk || (tr.telemetryGaps ?? []).some(([a, b]) => e.t >= a && e.t <= b + 0)) {
      const age = e.t - Math.max(...minutes.filter((x) => x.t <= e.t && x.telemetryOk).map((x) => x.t), 0);
      if (age > 3) invariantBreaches.push(`I3 at T+${e.t}m`);
    }
  }
  for (const dec of decisions) if (dec.output.kind === 'scale' && dec.t > 0 && minutes[dec.t] && !minutes[dec.t].telemetryOk && dec.t - Math.max(...minutes.filter((x) => x.t <= dec.t && x.telemetryOk).map((x) => x.t), 0) > 3) invariantBreaches.push(`I3 recommendation at T+${dec.t}m`);

  return { trace: tr, strategy, minutes, decisions, audit, executions, invariantBreaches, metrics: metricsFor(minutes, decisions, dirs, g, budgetRaised) };
}

function triggerOf(o: AgentOutput) {
  if (o.kind === 'scale') return o.evidence.join(', ');
  if (o.kind === 'tradeoff' || o.kind === 'investigate') return o.detail;
  return o.kind;
}

function truthFor(tr: EvalTrace, dec: Decision, _minutes: Minute[], g: Guardrails, lead: (m: number) => number): Decision['truth'] {
  const o = dec.output;
  if (o.kind !== 'scale' && o.kind !== 'tradeoff') return undefined;
  const t = dec.t;
  // Counterfactual capacity with no new action: current instances, plus orders already pending once they land.
  const capWithout = (m: number) => (dec.instancesAtT + (m >= lead(t) ? dec.pendingAtT : 0)) * cpiAt(tr, t + m);
  let breach: number | null = null;
  let peak = 0;
  for (let m = 0; m <= CLAIM_HORIZON && t + m <= tr.durationMin; m++) {
    const d = tr.demand(t + m);
    if (breach === null && d > capWithout(m) * 1.023) breach = m;
    peak = Math.max(peak, d - capWithout(m));
  }
  let correct: boolean | null = null;
  if (o.kind === 'scale' && o.direction === 'up') {
    // right-sized: without it headroom would fall below the minimum, and with it capacity isn't far above the window's peak
    let needed = false;
    let peakDemand = 0;
    for (let m = lead(t); m <= lead(t) + 30 && t + m <= tr.durationMin; m++) {
      const d = tr.demand(t + m);
      peakDemand = Math.max(peakDemand, d);
      if (d * (1 + g.headroomMinPct / 100) > capWithout(m)) needed = true;
    }
    const capWith = (dec.instancesAtT + dec.pendingAtT + o.instances) * cpiAt(tr, t + lead(t));
    correct = needed && capWith <= peakDemand * (1 + (g.headroomMaxPct + 15) / 100);
  } else if (o.kind === 'scale' && o.direction === 'down') {
    const after = dec.instancesAtT - o.instances;
    let ok = true;
    for (let m = 0; m <= 30 && t + m <= tr.durationMin; m++) if (tr.demand(t + m) * (1 + g.headroomMinPct / 200) > after * cpiAt(tr, t + m)) ok = false;
    correct = ok;
  }
  return { breachInMin: breach, peakWaiting: Math.max(0, Math.round(peak)), leadTimeMin: lead(t), costDeltaPerHr: dec.executedDelta != null ? dec.executedDelta * PRICE_PER_INSTANCE_HR : null, correct };
}

function metricsFor(minutes: Minute[], decisions: Decision[], dirs: number[], g: Guardrails, budgetRaised: boolean): RunResult['metrics'] {
  const totalCost = minutes.reduce((a, m) => a + m.costPerHr / 60, 0);
  const ccuHours = minutes.reduce((a, m) => a + m.demand / 60, 0);
  const waste = minutes.reduce((a, m) => a + (m.capacity > 0 ? Math.max(0, m.capacity - m.demand * (1 + g.headroomMaxPct / 100)) / m.capacity : 0), 0) / minutes.length;
  let flaps = 0;
  const nz = dirs.filter((d) => d !== 0);
  for (let i = 1; i < nz.length; i++) if (nz[i] !== nz[i - 1]) flaps++;
  const timing = { early: 0, onTime: 0, late: 0 };
  for (const d of decisions) {
    if (d.output.kind !== 'scale' || d.output.direction !== 'up' || !d.truth) continue;
    const b = d.truth.breachInMin;
    if (b === null) timing.early += d.truth.correct ? 0 : 1, timing.onTime += d.truth.correct ? 1 : 0;
    else if (b < d.truth.leadTimeMin) timing.late++;
    else if (b > 45) timing.early++;
    else timing.onTime++;
  }
  return { minutesAboveTarget: minutes.filter((m) => m.queueP95 > g.maxQueueWaitSec).length, peakQueue: Math.max(...minutes.map((m) => m.queueP95)), totalCost, costPerCcuHour: ccuHours ? totalCost / ccuHours : 0, wastePct: waste * 100, flaps, timing, budgetRaised };
}

/* ---------- baselines ---------- */
function baselineStep(tr: EvalTrace, s: Strategy, t: number, minutes: Minute[], getInst: () => number, change: (n: number) => void, pending: () => number, g: Guardrails) {
  const inst = getInst();
  const cpi = cpiAt(tr, t);
  if (s === 'static') {
    if (t === 0) {
      let peak = 0;
      for (let m = 0; m <= tr.durationMin; m++) peak = Math.max(peak, tr.expected(m));
      change(Math.ceil((2 * peak) / cpi) - inst);
    }
    return;
  }
  if (s === 'oracle') {
    // perfect hindsight: capacity always matches future demand + minimum headroom, no lag
    let need = 0;
    for (let m = 0; m <= PROVISIONING_LAG_MIN; m++) need = Math.max(need, tr.demand(Math.min(tr.durationMin, t + m)) * (1 + g.headroomMinPct / 100));
    const target = Math.ceil(need / cpi);
    if (target !== inst) { minutes[t].instances = target; minutes[t].capacity = target * cpi; minutes[t].costPerHr = target * PRICE_PER_INSTANCE_HR; const r = queueFor(minutes[t].demand, minutes[t].capacity); minutes[t].queueP95 = r.q; minutes[t].waiting = r.waiting; change(target - inst); }
    return;
  }
  // reactive: CPU > 70% → +20%; < 40% → −10%, every 5 min, telemetry gaps freeze it
  if (t % 5 !== 0 || (tr.telemetryGaps ?? []).some(([a, b]) => t >= a && t < b)) return;
  const util = tr.demand(t) / ((inst + pending()) * cpi || 1);
  if (util > 0.7) change(Math.max(1, Math.ceil(inst * 0.2)));
  else if (util < 0.4 && pending() === 0) change(-Math.max(1, Math.floor(inst * 0.1)));
}
