import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { AgenticCard } from '../../components/scale/AgenticCard';
import { fmtClock, useNow } from '../../components/scale/useNow';
import { COMPREHENSION_CARD, COMPREHENSION_QUIZ, DECISION_CARDS, GUARDRAIL_QUESTION } from '../../data/study-fixtures';
import { saveSession, type PilotSession } from '../../evals/pilotStore';
import styles from './Scale.module.css';
import st from './Study.module.css';

type Step = 'intro' | 'view' | 'quiz' | 'decide' | 'guardrails' | 'delegation' | 'done';
const noop = () => undefined;

/** Moderated pilot session for the human-in-the-loop evals (framework §7). */
export function StudySession() {
  const { buildId = '' } = useParams();
  const [step, setStep] = useState<Step>('intro');
  const [participant, setParticipant] = useState('P1');
  const [condition, setCondition] = useState<'shown' | 'collapsed'>('collapsed');
  const [viewLeft, setViewLeft] = useState(60);
  const [answers, setAnswers] = useState<(number | null)[]>(COMPREHENSION_QUIZ.map(() => null));
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<PilotSession['decisions']>([]);
  const [evidenceOpened, setEvidenceOpened] = useState(false);
  const shownAt = useRef(Date.now());
  const [deadline, setDeadline] = useState<number | undefined>();
  const [guardPicks, setGuardPicks] = useState<boolean[]>(GUARDRAIL_QUESTION.options.map(() => false));
  const [delegationText, setDelegationText] = useState('');
  const [session, setSession] = useState<PilotSession | null>(null);
  const now = useNow();

  useEffect(() => {
    if (step !== 'view') return;
    const id = window.setInterval(() => setViewLeft((v) => (v <= 1 ? (window.clearInterval(id), setStep('quiz'), 0) : v - 1)), 1000);
    return () => window.clearInterval(id);
  }, [step]);

  const current = DECISION_CARDS[index];
  useEffect(() => {
    if (step !== 'decide') return;
    shownAt.current = Date.now();
    setEvidenceOpened(condition === 'shown');
    setDeadline(current.timed ? Date.now() + 12 * 60_000 : undefined);
  }, [step, index, condition, current.timed]);

  const decide = (approved: boolean) => {
    const next = [...decisions, { id: current.id, good: current.good, approved, seconds: Math.round((Date.now() - shownAt.current) / 1000), evidenceOpened, timed: !!current.timed }];
    setDecisions(next);
    if (index + 1 < DECISION_CARDS.length) setIndex(index + 1);
    else setStep('guardrails');
  };

  const finish = (delegationPass: boolean | null) => {
    const s: PilotSession = {
      id: crypto.randomUUID(), participant, condition, at: new Date().toISOString(),
      comprehension: { correct: answers.filter((a, i) => a === COMPREHENSION_QUIZ[i].answer).length, total: COMPREHENSION_QUIZ.length },
      decisions,
      guardrailCorrect: GUARDRAIL_QUESTION.options.every((o, i) => o.correct === guardPicks[i]),
      delegationPass,
    };
    saveSession(s);
    setSession(s);
    setStep('done');
  };

  const progress = { intro: 0, view: 1, quiz: 1, decide: 2, guardrails: 3, delegation: 4, done: 5 }[step];

  return (
    <section aria-labelledby="study-title" className={`${styles.page} ${st.study}`}>
      <div className={styles.pageHead}>
        <div>
          <h2 id="study-title" className={styles.h2}>Pilot study session</h2>
          <p className={styles.intro}>Facilitator: read the task aloud, then hand over. Ask the participant to think aloud. Don’t explain the cards.</p>
        </div>
        <Link to={`/builds/${encodeURIComponent(buildId)}/scale/evals`} className={styles.link}>Back to evals</Link>
      </div>
      <ol className={st.progress} aria-label="Session steps">
        {['Setup', 'Comprehension', 'Decisions', 'Guardrails', 'Delegation', 'Summary'].map((l, i) => (
          <li key={l} aria-current={i === progress ? 'step' : undefined} className={i < progress ? st.done : i === progress ? st.now : undefined}>{l}</li>
        ))}
      </ol>

      {step === 'intro' && (
        <div className={`${styles.panel} ${st.setup}`}>
          <label>Participant code <input value={participant} onChange={(e) => setParticipant(e.target.value)} /></label>
          <fieldset>
            <legend>Evidence panel condition (A/B)</legend>
            <label><input type="radio" checked={condition === 'shown'} onChange={() => setCondition('shown')} /> A · Evidence always shown</label>
            <label><input type="radio" checked={condition === 'collapsed'} onChange={() => setCondition('collapsed')} /> B · Evidence behind “Show evidence” (lets us measure rubber-stamping)</label>
          </fieldset>
          <p className={styles.muted}>About 15 minutes. Results are saved in this browser and appear on the Evals tab. Prices on every card are $1.00 per instance per hour.</p>
          <Button onClick={() => setStep('view')}>Start session</Button>
        </div>
      )}

      {step === 'view' && (
        <div className={st.stage}>
          <p className={st.prompt}>Read this card. It will disappear in <strong>{viewLeft} s</strong>, then you’ll answer three questions without it.</p>
          <AgenticCard card={COMPREHENSION_CARD} state={{ status: 'open' }} onApprove={noop} onDecline={noop} onRollBack={noop} onHold={noop} footer={<span className={styles.muted}>Reading only. No decision needed.</span>} />
          <Button variant="text" size="sm" onClick={() => setStep('quiz')}>Facilitator: skip the wait</Button>
        </div>
      )}

      {step === 'quiz' && (
        <form className={`${styles.panel} ${st.quiz}`} onSubmit={(e) => { e.preventDefault(); setStep('decide'); }}>
          {COMPREHENSION_QUIZ.map((q, qi) => (
            <fieldset key={q.q}>
              <legend>{qi + 1}. {q.q}</legend>
              {q.options.map((o, oi) => (
                <label key={o}><input type="radio" name={`q${qi}`} checked={answers[qi] === oi} onChange={() => setAnswers(answers.map((a, i) => (i === qi ? oi : a)))} /> {o}</label>
              ))}
            </fieldset>
          ))}
          <Button type="submit" disabled={answers.some((a) => a === null)}>Next</Button>
        </form>
      )}

      {step === 'decide' && (
        <div className={st.stage}>
          <p className={st.prompt}>Card {index + 1} of {DECISION_CARDS.length}. Would you approve this change? {current.timed && <strong>This one is time-sensitive.</strong>}</p>
          <AgenticCard
            key={current.id}
            card={current.card}
            state={{ status: 'open' }}
            deadline={deadline}
            onApprove={noop} onDecline={noop} onRollBack={noop} onHold={noop}
            evidence={condition}
            onEvidenceOpen={() => setEvidenceOpened(true)}
            footer={
              <div className={st.decision}>
                <Button size="lg" onClick={() => decide(true)}>Approve</Button>
                <Button size="lg" variant="outline" onClick={() => decide(false)}>Reject</Button>
                {deadline && <span className={styles.muted}>{fmtClock(deadline - now)} left</span>}
              </div>
            }
          />
        </div>
      )}

      {step === 'guardrails' && (
        <form className={`${styles.panel} ${st.quiz}`} onSubmit={(e) => { e.preventDefault(); setStep('delegation'); }}>
          <p>Here are this launch’s delegation settings. Tier 1 auto-executes within caps ($50 per action, $200 per hour). Tier 2 stages changes for one click. Tier 3 needs a person.</p>
          <ul className={st.tiers}>
            <li><strong>Tier 1 · Auto-execute:</strong> scale up within caps; scale down with safety hold</li>
            <li><strong>Tier 2 · Auto-prepare:</strong> pre-warm schedule changes</li>
            <li><strong>Tier 3 · Human only:</strong> beyond caps, region mix, instance type, anything during an incident</li>
          </ul>
          <fieldset>
            <legend>{GUARDRAIL_QUESTION.q} Select all that apply.</legend>
            {GUARDRAIL_QUESTION.options.map((o, i) => (
              <label key={o.label}><input type="checkbox" checked={guardPicks[i]} onChange={() => setGuardPicks(guardPicks.map((p, j) => (j === i ? !p : p)))} /> {o.label}</label>
            ))}
          </fieldset>
          <Button type="submit">Next</Button>
        </form>
      )}

      {step === 'delegation' && (
        <div className={`${styles.panel} ${st.quiz}`}>
          <p className={st.prompt}>The system says: <em>“You’ve approved 6 scale-ups in us-east-1 this launch. Auto-execute them up to $75 per action?”</em></p>
          <label className={st.text}>
            In your own words: what would you be delegating, and how would you take it back?
            <textarea value={delegationText} onChange={(e) => setDelegationText(e.target.value)} rows={4} />
          </label>
          <p className={styles.muted}>Facilitator: pass if they name the action class (us-east-1 scale-ups), the $75 limit, and where to revoke it (Guardrails).</p>
          <div className={styles.row}>
            <Button onClick={() => finish(true)}>Facilitator: pass</Button>
            <Button variant="outline" onClick={() => finish(false)}>Facilitator: fail</Button>
            <Button variant="text" onClick={() => finish(null)}>Skip</Button>
          </div>
        </div>
      )}

      {step === 'done' && session && (
        <div className={`${styles.panel} ${st.quiz}`}>
          <h3 className={styles.h3}>Session {session.participant} saved</h3>
          <ul className={st.results}>
            <li>Comprehension: {session.comprehension.correct}/{session.comprehension.total}</li>
            <li>Approved {session.decisions.filter((d) => d.good && d.approved).length}/3 sound cards · rejected {session.decisions.filter((d) => !d.good && !d.approved).length}/3 flawed cards</li>
            {DECISION_CARDS.filter((c) => !c.good).map((c) => {
              const d = session.decisions.find((x) => x.id === c.id)!;
              return <li key={c.id} className={d.approved ? st.miss : undefined}>{d.approved ? 'Missed' : 'Caught'}: {c.flawExplained}</li>;
            })}
            <li>Time-sensitive card: decided in {session.decisions.find((d) => d.timed)?.seconds ?? '—'} s</li>
            {session.condition === 'collapsed' && <li>Approved without opening evidence: {session.decisions.filter((d) => d.approved && !d.evidenceOpened).length} of {session.decisions.filter((d) => d.approved).length} approvals</li>}
            <li>Guardrail question: {session.guardrailCorrect ? 'correct' : 'incorrect'}</li>
          </ul>
          <p className={styles.muted}>Debrief: show the participant which cards were flawed and ask what would have helped them catch it.</p>
          <div className={styles.row}>
            <Link to={`/builds/${encodeURIComponent(buildId)}/scale/evals`} className={styles.link}>See results on the Evals tab</Link>
            <Button variant="outline" onClick={() => { setStep('intro'); setIndex(0); setDecisions([]); setAnswers(COMPREHENSION_QUIZ.map(() => null)); setGuardPicks(GUARDRAIL_QUESTION.options.map(() => false)); setDelegationText(''); setViewLeft(60); setParticipant(`P${Number(participant.replace(/\D/g, '') || 0) + 1}`); setCondition(condition === 'shown' ? 'collapsed' : 'shown'); }}>Next participant</Button>
          </div>
        </div>
      )}
    </section>
  );
}
