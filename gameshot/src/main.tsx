import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { OnboardingProvider } from './state/OnboardingContext';
import { RecommendationsProvider } from './state/RecommendationsContext';
import './styles/global.css';

declare global {
  interface Window {
    /** Set by the share/mac pages to open the prototype on a specific screen. */
    __GAMESHOT_START__?: string;
  }
}

const app = (
  <OnboardingProvider>
    <RecommendationsProvider>
      <App />
    </RecommendationsProvider>
  </OnboardingProvider>
);

// The shareable builds can't use URL paths, so they navigate in memory.
const router =
  import.meta.env.VITE_ROUTER === 'memory' ? (
    <MemoryRouter initialEntries={[window.__GAMESHOT_START__ ?? '/']}>{app}</MemoryRouter>
  ) : (
    <BrowserRouter>{app}</BrowserRouter>
  );

createRoot(document.getElementById('root')!).render(<StrictMode>{router}</StrictMode>);
