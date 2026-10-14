import { useEffect, useRef, useState } from 'react';
import {
  ATR_DT,
  ATR_STEP_TICKS,
  AtravessaSim,
  biomeAt,
  laneBiome,
  trainState,
  type AtravessaEnd,
  type AtravessaInput,
  type AtravessaResult,
  type Dir,
} from '@nocap/games';
import { createAtravessaAudio } from '@/lib/atravessa-audio';
import { buzz, holdAudio } from '@/lib/sfx';
import { attachControls } from './input';
import { AtravessaScene } from './scene';
import './atravessa.css';

type Pause = { kind: 'none' } | { kind: 'paused' } | { kind: 'count'; n: number };

interface Props {
  seed: string;
  onEnd: (result: AtravessaResult, steps: AtravessaInput[]) => void;
  onQuit: () => void;
  onRestart: () => void;
}

const OVER_TEXT: Record<AtravessaEnd, string> = {
  veiculo: 'ATROPELADO',
  trem: 'O TREM PASSOU',
  agua: 'CAIU NA ÁGUA',
  arrastado: 'A TORA TE LEVOU',
  afundou: 'A PEDRA AFUNDOU',
  escuridao: 'A ESCURIDÃO TE PEGOU',
};

/** Depois de morrer, a tela espera um pouco para o fim da partida ser visto. */
const END_DELAY_MS = 1300;

/**
 * A partida do Atravessa!: a cena Three.js em tela cheia, toque ou W A S D, pausa com 3-2-1 e o fim.
 * O relógio é de passo fixo (60 por segundo), o mesmo que o servidor usa para refazer a partida a
 * partir dos passos gravados aqui.
 */
export function AtravessaPlay({ seed, onEnd, onQuit, onRestart }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pause, setPause] = useState<Pause>({ kind: 'none' });
  const [score, setScore] = useState(0);
  const [over, setOver] = useState<{ end: AtravessaEnd; score: number } | null>(null);
  const [hint, setHint] = useState(true);
  const [failed, setFailed] = useState(false);
  const ctl = useRef<{ pause: () => void; resume: () => void } | null>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    const el = wrap.current!;
    const cv = canvas.current!;
    let scene: AtravessaScene;
    try {
      scene = new AtravessaScene(cv, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      setFailed(true);
      return;
    }
    const sim = new AtravessaSim(seed);
    const audio = createAtravessaAudio();
    // só em desenvolvimento: deixa mexer no herói pelo console para ver os biomas sem jogar até lá
    if (import.meta.env.DEV) (window as unknown as { __atr?: AtravessaSim }).__atr = sim;
    const steps: AtravessaInput[] = [];
    const pending: Dir[] = [];
    const controls = attachControls(el, (d) => {
      if (paused || finished) return;
      pending.push(d);
      setHint(false);
    });

    const resize = () => scene.resize(el.clientWidth || 360, el.clientHeight || 640);
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let paused = false;
    let finished = false;
    let countTimer = 0;
    let endTimer = 0;
    let deathAt = 0;
    let shownScore = 0;
    // o que já foi "ouvido": o instante do último pulo e do último pouso e quantos passos foram recusados
    let hopTick = -1;
    let landTick = -1;
    let bumps = 0;

    const doPause = () => {
      if (finished || paused) return;
      paused = true;
      pending.length = 0;
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
      if (!paused && !finished) acc += dt;
      let n = 0;
      while (acc >= ATR_DT && sim.alive && n < 8) {
        // cada passo pedido entra no registro com o instante em que o servidor vai aplicá-lo
        for (const d of pending) {
          steps.push({ t: sim.tick + 1, d });
          sim.input(d);
        }
        pending.length = 0;
        sim.step();
        acc -= ATR_DT;
        n++;
      }
      if (n === 8) acc = 0;

      const v = sim.view();
      if (!paused) {
        if (v.step) {
          const started = sim.tick - Math.round(v.step.progress * ATR_STEP_TICKS);
          if (started !== hopTick) {
            hopTick = started;
            const delta = v.step.dir === 0 ? 1 : v.step.dir === 1 ? -1 : 0;
            audio?.hop(sim.row + delta, v.step.dir === 0);
          }
        }
        if (v.landed) {
          const at = sim.tick - v.landed.age;
          if (at !== landTick) {
            landTick = at;
            if (sim.alive) audio?.land(sim.world.lane(sim.row).kind);
          }
        }
        if (v.bumps !== bumps) {
          bumps = v.bumps;
          audio?.bump();
        }
        const info = biomeAt(v.y);
        audio?.setBiome(laneBiome(info));
        let warning = false;
        for (let r = Math.floor(v.y) - 5; r <= Math.floor(v.y) + 8 && !warning; r++) {
          if (r >= 0 && sim.world.lane(r).kind === 'trilho') warning = trainState(sim.world.lane(r), sim.tick).warning;
        }
        if (!finished) audio?.frame(v.danger, warning);
      }

      if (sim.score !== shownScore) {
        shownScore = sim.score;
        setScore(shownScore);
        buzz(6);
      }
      if (!sim.alive && !finished) {
        finished = true;
        deathAt = now;
        buzz(90);
        audio?.death(sim.end!);
        setOver({ end: sim.end!, score: sim.score });
        endTimer = window.setTimeout(() => {
          onEndRef.current({ score: sim.score, ticks: sim.tick, end: sim.end }, steps);
        }, END_DELAY_MS);
      }
      scene.render(sim, paused ? 0 : dt, now / 1000, finished ? { end: sim.end!, age: (now - deathAt) / 1000 } : null);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(countTimer);
      window.clearTimeout(endTimer);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', doPause);
      ctl.current = null;
      holdAudio(false);
      ro.disconnect();
      controls.dispose();
      scene.dispose();
      audio?.stop();
    };
  }, [seed]);

  const paused = pause.kind !== 'none';
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  return (
    <div className="at-play" ref={wrap} role="application" aria-label="Partida do Atravessa!">
      <canvas ref={canvas} className="at-canvas" />
      <div className="at-score" aria-live="off">
        <b>{score}</b>
      </div>
      <button
        type="button"
        className="at-pausebtn"
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
      {hint && !over && !failed && (
        <p className="at-hint mono">{touch ? 'TOQUE PARA PULAR · DESLIZE PARA IR PARA O LADO' : 'W A S D OU AS SETAS'}</p>
      )}
      {failed && (
        <div className="at-over" role="alert">
          <b>SEU APARELHO NÃO ABRIU O 3D</b>
          <button type="button" className="btn ghost" onClick={onQuit}>
            Voltar
          </button>
        </div>
      )}
      {over && (
        <div className="at-over" role="status">
          <b>{OVER_TEXT[over.end]}</b>
          <span className="mono">{over.score}</span>
        </div>
      )}
      {paused && (
        <div className="at-pause" role="dialog" aria-modal="true" aria-label="Jogo pausado">
          {pause.kind === 'count' ? (
            <div className="at-pause-count" aria-live="assertive">
              {pause.n}
            </div>
          ) : (
            <div className="at-pause-card">
              <h2>Pausado</h2>
              <div className="stack">
                <button type="button" className="btn alt" data-sfx="start" onClick={() => ctl.current?.resume()}>
                  Voltar ao jogo
                </button>
                <button type="button" className="btn" data-sfx="start" onClick={onRestart}>
                  Reiniciar partida
                </button>
                <button type="button" className="btn ghost" data-sfx="back" onClick={onQuit}>
                  Sair da partida
                </button>
              </div>
              <p className="mono at-pause-hint">Esc ou P também pausam e voltam.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
