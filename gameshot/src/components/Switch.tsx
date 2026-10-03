import { useId } from 'react';
import styles from './Switch.module.css';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

/** On/off setting. Built on a native checkbox with role="switch". */
export function Switch({ checked, onChange, label, description }: SwitchProps) {
  const id = useId();
  return (
    <label className={styles.row} htmlFor={id}>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {description && <span className={styles.description}>{description}</span>}
      </span>
      <input id={id} type="checkbox" role="switch" className={styles.input} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.track} aria-hidden />
    </label>
  );
}
