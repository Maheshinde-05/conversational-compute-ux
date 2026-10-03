import { useState } from 'react';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Modal } from '../../../components/Modal';
import { TIER_LABELS } from '../../../logic/riskPolicy';
import { useRecommendations, type EnrichedRec } from '../../../state/RecommendationsContext';
import { costLabel, tierTone } from './format';
import styles from './Optimize.module.css';

interface Props {
  rec: EnrichedRec;
  open: boolean;
  onClose: () => void;
}

/** Explicit approval for high-risk changes: review the plan, acknowledge rollback, sign off. */
export function ApprovalModal({ rec, open, onClose }: Props) {
  const { policy, approve } = useRecommendations();
  const [ack, setAck] = useState(false);
  const [changeWindow, setChangeWindow] = useState(policy.changeWindows[0] ?? '');
  const required = policy.approvers.high;
  const myRole = required.includes('Team leads') ? 'Team leads' : required[0];
  const canary = policy.requireCanaryFor.includes(rec.facts.actionType);

  return (
    <Modal
      open={open}
      title="Approve a high-risk change"
      onClose={onClose}
      footer={
        <>
          <Button variant="text" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!ack || !myRole}
            onClick={() => {
              approve(rec.id, myRole, changeWindow);
              onClose();
            }}
          >
            {myRole === 'Team leads' ? 'Approve as Team lead' : `Approve as ${myRole} (demo)`}
          </Button>
        </>
      }
    >
      <div className={styles.modalSummary}>
        <Badge tone={tierTone[rec.risk.tier]}>{TIER_LABELS[rec.risk.tier]}</Badge>
        <strong>{rec.summary}</strong>
        <span>{rec.change.from} → {rec.change.to}</span>
        <span className={styles.modalCost}>{costLabel(rec.facts.monthlyCostDelta)}</span>
      </div>

      <dl className={styles.modalFacts}>
        <dt>Rollback plan</dt>
        <dd>{rec.rollbackPlan}</dd>
        <dt>Rollout</dt>
        <dd>{canary ? 'Canary first: 10% of new sessions for 30 minutes, then the rest if health checks pass.' : 'Applied to the whole target at once.'}</dd>
        <dt>Sign-offs needed</dt>
        <dd>{required.join(' and ')}. All must approve before it’s scheduled.</dd>
      </dl>

      <label className={styles.field}>
        <span>Change window</span>
        <select value={changeWindow} onChange={(e) => setChangeWindow(e.target.value)}>
          {policy.changeWindows.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>
      </label>

      <label className={styles.ack}>
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        I’ve read the rollback plan and the evidence for this change.
      </label>
    </Modal>
  );
}
