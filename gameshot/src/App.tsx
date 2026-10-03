import { Navigate, Route, Routes } from 'react-router-dom';
import { FrameBridge } from './FrameBridge';
import { PolicyScreen } from './screens/onboarding/PolicyScreen';
import { UploadScreen } from './screens/onboarding/UploadScreen';
import { ExecutablesScreen } from './screens/onboarding/ExecutablesScreen';
import { ComputeScreen } from './screens/onboarding/ComputeScreen';
import { BuildLayout } from './screens/build/BuildLayout';
import { VersionsTab } from './screens/build/VersionsTab';
import { SessionsTab } from './screens/build/SessionsTab';
import { OptimizeTab } from './screens/build/OptimizeTab';
import { NotDesignedYet } from './screens/build/NotDesignedYet';
import { SessionDetail } from './screens/build/SessionDetail';

/*
 * Route map ↔ Figma frames (★ row on Page 1):
 *   /onboarding/policy        Foundation screen (data usage policy)
 *   /onboarding/upload        Foundation screen / Uploaded (step 1)
 *   /onboarding/executables   Uploaded – "Tell us how to run your files" (step 2)
 *   /onboarding/compute       Uploaded – "Choose compute" + Create build modal (step 3)
 *   /builds/:id/versions      build list
 *   /builds/:id/optimize      Optimization reco
 *   /builds/:id/sessions/:sid Session creation
 */
export function App() {
  return (
    <>
      <FrameBridge />
      <Routes>
        <Route path="/" element={<Navigate to="/onboarding/policy" replace />} />
        <Route path="/onboarding/policy" element={<PolicyScreen />} />
        <Route path="/onboarding/upload" element={<UploadScreen />} />
        <Route path="/onboarding/executables" element={<ExecutablesScreen />} />
        <Route path="/onboarding/compute" element={<ComputeScreen />} />
  
        <Route path="/builds/:buildId/sessions/:sessionId" element={<SessionDetail />} />
        <Route path="/builds/:buildId" element={<BuildLayout />}>
          <Route index element={<Navigate to="versions" replace />} />
          <Route path="versions" element={<VersionsTab />} />
          <Route path="sessions" element={<SessionsTab />} />
          <Route path="optimize" element={<OptimizeTab />} />
          <Route path="scale" element={<NotDesignedYet what="Scale" />} />
        </Route>
        <Route path="/games" element={<NotDesignedYet what="Games" standalone />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
