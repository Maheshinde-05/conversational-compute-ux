import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { useOnboarding } from '../../state/OnboardingContext';
import styles from './PolicyScreen.module.css';

export function PolicyScreen() {
  const navigate = useNavigate();
  const { acceptPolicy } = useOnboarding();

  return (
    <AppShell showNav={false}>
      <div className={styles.page}>
        <h1 className={styles.brand}>GameShot</h1>
        <section className={styles.card} aria-labelledby="policy-title">
          <h2 id="policy-title" className={styles.title}>Data usage policy</h2>
          <p className={styles.body}>
            By using GameLift, you agree that we may analyze your game files and code to provide personalized
            AI-powered recommendations. You acknowledge that your data will be encrypted, securely stored, and used
            exclusively for our recommendation service. You understand that we will not share your information with
            third parties or use it for any purposes beyond providing game recommendations.
          </p>
          <div className={styles.actions}>
            {/* TODO(design): where does Cancel go? Currently stays on this screen. */}
            <Button variant="text">Cancel</Button>
            <Button
              onClick={() => {
                acceptPolicy();
                navigate('/onboarding/upload');
              }}
            >
              Accept policy
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
