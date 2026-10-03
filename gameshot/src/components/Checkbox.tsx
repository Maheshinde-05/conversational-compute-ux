import { useEffect, useRef } from 'react';
import styles from './Checkbox.module.css';

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/** Native checkbox with indeterminate support; label is visually hidden. */
export function Checkbox({ checked, indeterminate = false, onChange, label }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className={styles.wrap}>
      <input
        ref={ref}
        type="checkbox"
        className={styles.box}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="visually-hidden">{label}</span>
    </label>
  );
}
