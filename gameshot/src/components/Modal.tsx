import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Uses native <dialog> for focus trapping, Esc-to-close and a11y. */
export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.modal}
      aria-labelledby="modal-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <div className={styles.inner}>
        <h2 id="modal-title" className={styles.title}>{title}</h2>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </dialog>
  );
}
