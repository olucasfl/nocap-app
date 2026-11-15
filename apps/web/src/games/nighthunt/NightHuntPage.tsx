import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTouchGuard } from '../foxgp/touch-guard';
import { NhApp } from './app';
import './nighthunt.css';

/** Night Hunt (spec 083): sobreviva à noite. Tudo é desenhado em canvas por NhApp; a simulação vive em @nocap/games. */
export function NightHuntPage() {
  useTouchGuard();
  const navigate = useNavigate();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const app = new NhApp(canvas, { exit: () => void navigate({ to: '/' }) });
    void app.start();
    if (import.meta.env.DEV) (window as unknown as { __nh?: unknown }).__nh = app.devHooks();
    return () => app.dispose();
  }, [navigate]);
  return (
    <div className="nh-root" data-testid="nh-root">
      <canvas ref={ref} className="nh-canvas" aria-label="Night Hunt: sobreviva à noite" />
    </div>
  );
}
