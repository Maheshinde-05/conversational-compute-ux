import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonVariant =
  | 'primary'   // filled indigo — main CTA (Continue, Accept policy, Create)
  | 'outline'   // outlined — secondary (Choose file, Enable GameLift)
  | 'tonal'     // light blue — Approve / Reject
  | 'neutral'   // grey — table toolbar actions
  | 'warning'   // yellow — Connect to host
  | 'text';     // text only — Cancel, Show more

export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = [styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth, className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={cls} {...rest} />;
}
