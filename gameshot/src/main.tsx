import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { OnboardingProvider } from './state/OnboardingContext';
import './styles/global.css';

// The shareable (artifact) build can't use URL paths, so it navigates in memory.
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <OnboardingProvider>
        <App />
      </OnboardingProvider>
    </Router>
  </StrictMode>,
);
