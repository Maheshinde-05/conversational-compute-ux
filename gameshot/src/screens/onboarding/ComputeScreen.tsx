import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radar } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { HighlightTile } from '../../components/Card';
import { Modal } from '../../components/Modal';
import { StepDots } from '../../components/StepDots';
import { Tabs } from '../../components/Tabs';
import { TextField } from '../../components/TextField';
import { recommendedCompute as rc } from '../../data/mock';
import { useOnboarding } from '../../state/OnboardingContext';
import shared from './Onboarding.module.css';
import styles from './ComputeScreen.module.css';

export function ComputeScreen() {
  const navigate = useNavigate();
  const { createBuild } = useOnboarding();
  const [tab, setTab] = useState('recommended');
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('game-compute-start-1');
  const [version, setVersion] = useState('');
  const [tags, setTags] = useState('');

  const submit = () => {
    const build = { name: name.trim(), version: version.trim() || '1.0.0', tags: tags.trim() };
    createBuild(build);
    setModalOpen(false);
    navigate(`/builds/${encodeURIComponent(build.name)}/versions`);
  };

  return (
    <AppShell showNav={false}>
      <div className={shared.page}>
        <h1 className={shared.title}>Choose compute</h1>
        <p className={styles.subtitle}>Choose an instance type to test your game server on. You can revisit these settings later.</p>

        <div className={styles.tabs}>
          <Tabs
            tone="accent"
            ariaLabel="Compute selection mode"
            value={tab}
            onChange={setTab}
            items={[
              { id: 'recommended', label: 'Recommended' },
              { id: 'custom', label: 'Custom select' },
            ]}
          />
        </div>

        {tab === 'recommended' ? (
          <section className={styles.panel} aria-labelledby="rec-title">
            <header className={styles.panelHeader}>
              <Radar size={16} aria-hidden />
              <h2 id="rec-title">Recommended compute instance</h2>
            </header>
            <div className={styles.panelBody}>
              <div className={styles.recommendation}>
                <span className={styles.recLabel}>Recommendation</span>
                <div className={styles.recSpec}>
                  <strong>{rc.spec}</strong>
                  <Badge tone="neutral">{rc.tier}</Badge>
                </div>
                <em className={styles.recConfidence}>{rc.confidence}</em>
              </div>

              <div className={styles.tiles}>
                <HighlightTile
                  label="Instance cost"
                  value={rc.cost}
                  link={<a href="#" className={styles.costLink} onClick={(e) => e.preventDefault()}>Learn more about cost</a>}
                />
                <HighlightTile label="Location" value={rc.location} />
                <HighlightTile label="Architecture" value={rc.architecture} />
                <HighlightTile label="Operating system" value={rc.os} />
              </div>

              <h3 className={styles.usageTitle}>Usage instructions</h3>
              <ul className={styles.usage}>
                {rc.usage.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          </section>
        ) : (
          <section className={`${styles.panel} ${styles.placeholder}`}>
            {/* TODO(design): Custom select isn't designed in the Figma file yet. */}
            <p>Custom instance selection — not designed yet.</p>
          </section>
        )}

        <div className={shared.footer}>
          <Button size="lg" className={shared.continue} onClick={() => setModalOpen(true)}>
            Continue
          </Button>
          <StepDots total={3} current={2} />
        </div>
      </div>

      <Modal
        open={modalOpen}
        title="Create build"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="text" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!name.trim()}>Create</Button>
          </>
        }
      >
        <TextField label="Name" value={name} onChange={setName} required />
        <TextField label="Version" optional value={version} onChange={setVersion} placeholder="1.0.0" />
        <TextField label="Tags" optional value={tags} onChange={setTags} placeholder="testing-beta" />
      </Modal>
    </AppShell>
  );
}
