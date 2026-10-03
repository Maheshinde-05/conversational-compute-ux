import { useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { File, Folder, Image, Plus, Table, Upload, X } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { StepDots } from '../../components/StepDots';
import { useOnboarding, type UploadedFile } from '../../state/OnboardingContext';
import shared from './Onboarding.module.css';
import styles from './UploadScreen.module.css';

const VISIBLE_FILES = 3;

function iconFor(f: UploadedFile) {
  if (f.kind === 'folder') return Folder;
  if (f.name.endsWith('.exe')) return Table;
  if (/\.(png|jpe?g|gif)$/i.test(f.name)) return Image;
  return File;
}

export function UploadScreen() {
  const navigate = useNavigate();
  const { files, addFiles, removeFile, repoAccessEnabled, setRepoAccessEnabled } = useOnboarding();
  const [showAll, setShowAll] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ingest = (list: FileList | null) => {
    if (!list?.length) return;
    addFiles(
      Array.from(list).map((f) => ({
        id: `${f.name}-${f.size}-${f.lastModified}`,
        name: f.name,
        kind: 'file' as const,
      })),
    );
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    ingest(e.dataTransfer.files);
  };

  const visible = showAll ? files : files.slice(0, VISIBLE_FILES);
  const canContinue = files.length > 0 || repoAccessEnabled;

  return (
    <AppShell showNav={false}>
      <div className={`${shared.page} ${shared.narrow}`}>
        <h1 className={shared.title}>Let’s get started with GameShot</h1>
        <p className={shared.subtitle}>Upload a game folder to GameLift to start cloud onboarding.</p>

        <span className={shared.sectionLabel}>Upload game files</span>
        <span className={shared.sectionHint}>Upload game folder that includes executables .exe and png</span>

        <div
          className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span className={styles.dropHint}>Drag and drop files, or select from below.</span>
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload size={20} aria-hidden />
            Choose file
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              ingest(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className={styles.fileList} aria-label="Uploaded files">
            {visible.map((f) => {
              const Icon = iconFor(f);
              return (
                <li key={f.id} className={styles.file}>
                  <span className={styles.thumb}>
                    <Icon size={20} strokeWidth={1.5} aria-hidden />
                  </span>
                  <span className={styles.fileName}>{f.name}</span>
                  <button type="button" className={styles.remove} aria-label={`Remove ${f.name}`} onClick={() => removeFile(f.id)}>
                    <X size={20} strokeWidth={1.8} aria-hidden />
                  </button>
                </li>
              );
            })}
            {files.length > VISIBLE_FILES && (
              <li>
                <Button variant="text" size="sm" onClick={() => setShowAll((v) => !v)}>
                  <Plus size={18} aria-hidden />
                  {showAll ? 'Show less' : 'Show more'}
                </Button>
              </li>
            )}
          </ul>
        )}

        <div className={styles.or}>
          <strong>Or</strong>
          <span>Provide access to S3 and ECR repositories</span>
        </div>

        <div className={styles.repo}>
          <div>
            <strong className={styles.repoTitle}>Enable GameLift to access repository</strong>
            <p className={styles.repoBody}>
              By enabling GameLift, you grant GameLift permission
              <br /> to access S3 and ECR on your behalf.
            </p>
          </div>
          <Button variant="outline" size="lg" aria-pressed={repoAccessEnabled} onClick={() => setRepoAccessEnabled(!repoAccessEnabled)}>
            {repoAccessEnabled ? 'GameLift enabled ✓' : 'Enable GameLift'}
          </Button>
        </div>

        <div className={shared.footer}>
          <Button size="lg" className={shared.continue} disabled={!canContinue} onClick={() => navigate('/onboarding/executables')}>
            Continue
          </Button>
          <StepDots total={3} current={0} />
        </div>
      </div>
    </AppShell>
  );
}
