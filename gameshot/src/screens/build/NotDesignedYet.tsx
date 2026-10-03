import { AppShell } from '../../components/AppShell';
import styles from './Build.module.css';

export function NotDesignedYet({ what, standalone }: { what: string; standalone?: boolean }) {
  const body = <div className={styles.placeholder}>{what} — not designed yet.</div>;
  return standalone ? (
    <AppShell>
      <div className={styles.content}>{body}</div>
    </AppShell>
  ) : (
    body
  );
}
