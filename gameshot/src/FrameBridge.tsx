import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * When the prototype runs inside a presentation frame (the MacBook mockup),
 * report the current route to the parent page and accept back/forward commands.
 * Does nothing when the app is opened directly.
 */
export function FrameBridge() {
  const location = useLocation();
  const navigate = useNavigate();
  const framed = window.parent !== window;

  useEffect(() => {
    if (framed) window.parent.postMessage({ type: 'gameshot:route', path: location.pathname }, '*');
  }, [framed, location.pathname]);

  useEffect(() => {
    if (!framed) return;
    const onMessage = (e: MessageEvent) => {
      if (e.source === window.parent && e.data?.type === 'gameshot:nav') navigate(e.data.delta as number);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [framed, navigate]);

  return null;
}
