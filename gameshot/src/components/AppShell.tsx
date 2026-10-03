import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: ReactNode;
  showNav?: boolean;
}

export function AppShell({ children, showNav }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <Sidebar showNav={showNav} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
