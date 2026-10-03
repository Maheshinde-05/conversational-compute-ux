import { createContext, useContext, useState, type ReactNode } from 'react';

export interface UploadedFile { id: string; name: string; kind: 'folder' | 'file' }
export interface BuildDraft { name: string; version: string; tags: string }

interface OnboardingState {
  policyAccepted: boolean;
  files: UploadedFile[];
  repoAccessEnabled: boolean;
  selectedExecutables: string[];
  launchArguments: string;
  build: BuildDraft | null;
}

interface OnboardingApi extends OnboardingState {
  acceptPolicy: () => void;
  addFiles: (files: UploadedFile[]) => void;
  removeFile: (id: string) => void;
  setRepoAccessEnabled: (v: boolean) => void;
  setSelectedExecutables: (ids: string[]) => void;
  setLaunchArguments: (v: string) => void;
  createBuild: (b: BuildDraft) => void;
}

const Ctx = createContext<OnboardingApi | null>(null);

/** Holds the wizard's answers across steps. Swap for a server draft when the API exists. */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [s, set] = useState<OnboardingState>({
    policyAccepted: false,
    files: [],
    repoAccessEnabled: false,
    selectedExecutables: [],
    launchArguments: '-logfile log.txt -port 37016 --gameMode',
    build: null,
  });

  const api: OnboardingApi = {
    ...s,
    acceptPolicy: () => set((p) => ({ ...p, policyAccepted: true })),
    addFiles: (files) => set((p) => ({ ...p, files: [...p.files, ...files] })),
    removeFile: (id) => set((p) => ({ ...p, files: p.files.filter((f) => f.id !== id) })),
    setRepoAccessEnabled: (v) => set((p) => ({ ...p, repoAccessEnabled: v })),
    setSelectedExecutables: (ids) => set((p) => ({ ...p, selectedExecutables: ids })),
    setLaunchArguments: (v) => set((p) => ({ ...p, launchArguments: v })),
    createBuild: (b) => set((p) => ({ ...p, build: b })),
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useOnboarding() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOnboarding must be used inside <OnboardingProvider>');
  return v;
}
