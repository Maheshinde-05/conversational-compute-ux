import { useState } from 'react';
import { Button } from '../../../components/Button';
import styles from './Optimize.module.css';

const REASONS = ['Not needed right now', 'Too expensive', 'Wrong diagnosis', 'Missing important data', 'Other'];

export function RejectForm({ onReject, onCancel }: { onReject: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  return (
    <form
      className={styles.reject}
      onSubmit={(e) => {
        e.preventDefault();
        onReject(reason);
      }}
    >
      <fieldset>
        <legend>Why are you rejecting this?</legend>
        {REASONS.map((r) => (
          <label key={r}>
            <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
            {r}
          </label>
        ))}
      </fieldset>
      <p className={styles.rejectHint}>Your reason helps tune future recommendations.</p>
      <div className={styles.actions}>
        <Button type="submit" variant="neutral">Reject</Button>
        <Button variant="text" onClick={onCancel}>Back</Button>
      </div>
    </form>
  );
}
