import { useId, type InputHTMLAttributes } from 'react';
import styles from './TextField.module.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  optional?: boolean;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}

export function TextField({ label, optional, value, onChange, multiline, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {optional && <span className={styles.optional}>(optional)</span>}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className={`${styles.input} ${styles.textarea}`}
          value={value}
          placeholder={rest.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input id={id} className={styles.input} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      )}
    </div>
  );
}
