import { useEffect, useRef, useState } from 'react';
import {
  DT,
  SinalSim,
  type SinalEnd,
  type SinalEvent,
  type SinalInput,
  type SinalMode,
  type SinalResult,
} from '@nocap/games';
import { createSinalAudio } from '@/lib/sinal-audio';
import { buzz, holdAudio } from '@/lib/sfx';
import { makeLayout, type Layout } from './camera';
import { attachControls } from './controls';
import { MAP_STYLE, clamp } from './draw-art';
import { drawScene, type Notice } from './draw-scene';
import './sinal.css';

type Pause = { kind: 'none' } | { kind: 'paused' } | { kind: 'count'; n: number };

interface Props {
  mode: SinalMode;
  seed: string;
  /** Cor do boneco (só no online). Sem ela, o boneco padrão do mapa. */
  color?: string;
  /** O recorde do modo neste aparelho (m), para a linha no chão do Infinito. */
  best: number;
  onEnd: (result: SinalResult, inputs: SinalInput[]) => void;
  onQuit: () => void;
}

const OVER_TEXT: Record<SinalEnd, string> = {
  vigia: 'TE VIU!',
  escuridao: 'A ESCURIDÃO TE PEGOU',
};

/**
 * A partida do Sinal Vermelho: o Canvas em tela cheia, o analógico (toque) ou W A S D, a pausa com
 * 3-2-1 e o fim. O relógio é de passo fixo (60 por segundo), o mesmo que o servidor usa para refazer
 * a corrida a partir dos movimentos que gravamos aqui.
 */
export function SinalPlay({ mode, seed, color, best, onEnd, onQuit }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pause, setPause] = useState<Pause>({ kind: 'none' });
  const [over, setOver] = useState<{ reason: SinalEnd; meters: number } | null>(null);
  const [banner, setBanner] = useState<{ title: string; sub: string } | null>(null);
  const ctl = useRef<{ pause: () => void; resume: () => void } | null>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    const el = wrap.current!;
    const cv = canvas.current!;
    const c = cv.getContext('2d')!;
    const sim = new SinalSim(seed, mode);
    const audio = createSinalAudio();
    const inputs: SinalInput[] = [];
    let layout: Layout = makeLayout(360, 640, false);
    const controls = attachControls(el, () => layout);
    let layoutTouch = controls.touch();

    const resize = () => {
      const w = el.clientWidth || 360;
      const h = el.clientHeight || 640;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      layoutTouch = controls.touch();
      layout = makeLayout(w, h, layoutTouch);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let paused = false;
    let finished = false;
    let countTimer = 0;
    let bannerTimer = 0;
    let endTimer = 0;
    let lastIn: [number, number] = [0, 0];
    let face = 0;
    let warn = 0;
    let walking = false;
    let prevX = sim.x;
    let prevY = sim.y;
    let prevHidden = false;
    const notices: (Notice & { until: number })[] = [];
    const notice = (text: string, col: string, ms = 1800) =>
      notices.push({ text, color: col, until: performance.now() + ms });

    const handle = (events: SinalEvent[]) => {
      for (const e of events) {
        audio?.event(e);
        if (e.kind === 'quebrou') {
          notice('ESCONDERIJO QUEBROU', '#ff6a2b');
          buzz(30);
        } else if (e.kind === 'poder-evitado') {
          notice('PODER EVITADO', '#33c27f', 1500);
        } else if (e.kind === 'olhando') {
          buzz(12);
        } else if (e.kind === 'fase') {
          const s = MAP_STYLE[e.map];
          setBanner({
            title: e.boss ? `CHEFE: ${s.boss.toUpperCase()}` : `FASE ${e.n}`,
            sub: e.mapChanged ? `NOVO MAPA: ${s.name.toUpperCase()}` : s.name.toUpperCase(),
          });
          window.clearTimeout(bannerTimer);
          bannerTimer = window.setTimeout(() => setBanner(null), 2600);
          buzz(40);
        } else if (e.kind === 'fim') {
          finished = true;
          buzz(120);
          setOver({ reason: e.reason, meters: sim.result.meters });
          window.clearTimeout(endTimer);
          endTimer = window.setTimeout(() => {
            audio?.stop();
            onEndRef.current(sim.result, inputs);
          }, 1500);
        }
      }
    };

    const doPause = () => {
      if (finished || paused) return;
      paused = true;
      window.clearTimeout(countTimer);
      holdAudio(true);
      audio?.pause();
      setPause({ kind: 'paused' });
    };
    const doResume = () => {
      if (!paused) return;
      window.clearTimeout(countTimer);
      let n = 3;
      setPause({ kind: 'count', n });
      const step = () => {
        n--;
        if (n > 0) {
          setPause({ kind: 'count', n });
          countTimer = window.setTimeout(step, 1000);
          return;
        }
        holdAudio(false);
        audio?.resume();
        paused = false;
        last = performance.now();
        acc = 0;
        setPause({ kind: 'none' });
      };
      countTimer = window.setTimeout(step, 1000);
    };
    ctl.current = { pause: doPause, resume: doResume };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat) return;
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (paused) doResume();
        else doPause();
      }
    };
    window.addEventListener('keydown', onKey);
    const onHide = () => document.visibilityState === 'hidden' && doPause();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', doPause);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (controls.touch() !== layoutTouch) resize();
      if (!paused && !finished) acc += dt;
      let steps = 0;
      while (acc >= DT && !sim.dead && steps < 8) {
        const [vx, vy] = controls.vector();
        const m = Math.hypot(vx, vy);
        const k = m > 1 ? 1 / m : 1;
        const ax = Math.round(clamp(vx * k * 100, -100, 100));
        const ay = Math.round(clamp(vy * k * 100, -100, 100));
        // Só gravamos quando o analógico muda: é o que o servidor recebe para refazer a corrida.
        if (ax !== lastIn[0] || ay !== lastIn[1]) {
          inputs.push({ tick: sim.tick, x: ax, y: ay });
          lastIn = [ax, ay];
        }
        handle(sim.step(ax, ay));
        acc -= DT;
        steps++;
      }
      if (steps === 8) acc = 0;

      const v = sim.view;
      walking = Math.hypot(sim.x - prevX, sim.y - prevY) > 0.01;
      prevX = sim.x;
      prevY = sim.y;
      face += clamp((v.vigia === 'olhando' ? 1 : 0) - face, -dt * 6, dt * 6);
      let targetWarn = 0;
      if (v.vigia === 'aviso') {
        const cy = sim.vigiaTimeline.cycleAt(v.t);
        targetWarn = clamp((v.t - cy.avisoStart) / (cy.lookStart - cy.avisoStart), 0.15, 1);
      }
      warn += (targetWarn - warn) * Math.min(1, dt * 10);
      if (v.hidden && !prevHidden) audio?.rustle();
      prevHidden = v.hidden;
      audio?.darkness(v.y - v.darkY);
      for (let i = notices.length - 1; i >= 0; i--) if (notices[i]!.until < now) notices.splice(i, 1);

      const inverted = v.powers.some(
        (p) => p.kind === 'invertido' && p.phase === 'efeito' && !p.evaded && !v.hidden,
      );
      drawScene(c, {
        layout,
        view: v,
        color,
        t: now / 1000,
        face,
        warn,
        walking,
        joy: { show: controls.touch(), ...controls.joy() },
        keysHint: !controls.touch() && !controls.usedKeys() && sim.tick < 60 * 15,
        best: mode === 'infinito' && best > 0 ? best : null,
        notices,
        inverted,
      });
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(countTimer);
      window.clearTimeout(bannerTimer);
      window.clearTimeout(endTimer);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', doPause);
      ctl.current = null;
      holdAudio(false);
      ro.disconnect();
      controls.dispose();
      audio?.stop();
    };
  }, [mode, seed, color, best]);

  const paused = pause.kind !== 'none';

  return (
    <div className="sv-play" ref={wrap} role="application" aria-label="Partida do Sinal Vermelho">
      <canvas ref={canvas} className="sv-canvas" />
      <button
        type="button"
        className="sv-pausebtn"
        aria-label="Pausar"
        data-sfx="select"
        disabled={!!over}
        onClick={() => ctl.current?.pause()}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      </button>
      {banner && (
        <div className="sv-banner" role="status">
          <b>{banner.title}</b>
          <span className="mono">{banner.sub}</span>
        </div>
      )}
      {over && (
        <div className="sv-over" role="status">
          <b>{OVER_TEXT[over.reason]}</b>
          <span className="mono">{Math.floor(over.meters)} m</span>
        </div>
      )}
      {paused && (
        <div className="sv-pause" role="dialog" aria-modal="true" aria-label="Jogo pausado">
          {pause.kind === 'count' ? (
            <div className="sv-pause-count" aria-live="assertive">
              {pause.n}
            </div>
          ) : (
            <div className="sv-pause-card">
              <h2>Pausado</h2>
              <div className="stack">
                <button type="button" className="btn alt" data-sfx="start" onClick={() => ctl.current?.resume()}>
                  Voltar ao jogo
                </button>
                <button type="button" className="btn ghost" data-sfx="back" onClick={onQuit}>
                  Sair da partida
                </button>
              </div>
              <p className="mono sv-pause-hint">Esc ou P também pausam e voltam.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
