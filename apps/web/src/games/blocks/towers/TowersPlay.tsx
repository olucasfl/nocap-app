import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  MAX_LIVES,
  TOWERS_DT,
  TowersGame,
  type BadSpell,
  type GoodSpell,
  type TowersEffects,
  type TowersEvent,
  type TowersInput,
} from '@nocap/games';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MuteButton } from '@/components/MuteButton';
import { buzz } from '@/lib/sfx';
import { createTowersAudio, type TowersAudio } from '@/lib/towers-audio';
import { BlockDefs } from '../art';
import { ArrowIcon, SPELL_LABEL, SpellIcon, TinyPiece } from './tw-art';
import { burst, createFx, drawFrame, stepFx, type Fx, type View } from './draw';
import './towers.css';

export interface TowersEnd {
  score: number;
  pieces: number;
  time: number;
  spells: number;
  falls: number;
  collapses: number;
}

interface Props {
  seed: string;
  /** O recorde do aparelho. */
  best: number;
  onEnd: (end: TowersEnd) => void;
  onQuit: () => void;
}

interface Hud {
  lives: number;
  peak: number;
  stacked: number;
  held: GoodSpell[];
  queue: number[];
  fx: TowersEffects;
  fog: boolean;
}

interface Banner {
  key: number;
  tone: 'good' | 'bad' | 'warn' | 'info';
  title: string;
  sub: string | null;
}

const reduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function snapshot(g: TowersGame): Hud {
  return {
    lives: g.lives,
    peak: g.peak,
    stacked: g.stacked,
    held: g.held.slice(),
    queue: g.queue.slice(0, 2),
    fx: { ...g.fx },
    fog: g.fx.nevoa > 0,
  };
}

const sameHud = (a: Hud, b: Hud) => JSON.stringify(a) === JSON.stringify(b);

const DUST = ['#f2e4cc', '#e8d2b0', '#d9c1a0'];

/**
 * A partida do Block Towers, modo 3 vidas (spec 022): o Canvas em tela cheia, os botões (ou o
 * teclado), o guia da próxima peça, as magias e os avisos. O jogo e a física são de `TowersGame`
 * (pacote de jogos); aqui se lê o teclado, se roda em passo fixo e se transforma cada evento em som
 * e animação.
 */
export function TowersPlay({ seed, best, onEnd, onQuit }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TowersGame | null>(null);
  if (!gameRef.current) gameRef.current = new TowersGame(seed);
  const game = gameRef.current;
  const fxRef = useRef<Fx>(createFx());
  const input = useRef<TowersInput>({ left: false, right: false, down: false });
  const paused = useRef(false);
  const audioRef = useRef<TowersAudio | null>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const stats = useRef({ spells: 0, falls: 0, collapses: 0 });
  const bannerKey = useRef(0);
  const castRef = useRef<() => void>(() => undefined);
  const rotateRef = useRef<() => void>(() => undefined);

  const [hud, setHud] = useState<Hud>(() => snapshot(game));
  const [banner, setBanner] = useState<Banner | null>(null);
  const [asking, setAsking] = useState(false);
  const [over, setOver] = useState(false);

  const say = useCallback((tone: Banner['tone'], title: string, sub: string | null = null, ms = 1500) => {
    const key = ++bannerKey.current;
    setBanner({ key, tone, title, sub });
    window.setTimeout(() => setBanner((b) => (b?.key === key ? null : b)), ms);
  }, []);

  useEffect(() => {
    paused.current = asking;
  }, [asking]);

  useEffect(() => {
    const cv = canvas.current!;
    const box = wrap.current!;
    const ctx = cv.getContext('2d')!;
    const fx = fxRef.current;
    const audio = createTowersAudio();
    audioRef.current = audio;
    const calm = reduced();
    let W = 360;
    let H = 640;
    let dpr = 1;
    let view: View | null = null;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let prevHud = snapshot(game);
    let endTimer = 0;
    let darkTarget = 0;

    const resize = () => {
      const r = box.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, r.width);
      H = Math.max(1, r.height);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);

    const dust = (x: number, y: number, n: number, spread: number) => {
      if (calm) return;
      burst(fx, n, { x, y }, { kind: 'dust', color: DUST[Math.floor(Math.random() * DUST.length)]!, size: 0.2, gravity: 1.5 }, spread);
    };
    const sparkle = (x: number, y: number, n: number, color = '#ffd23f') => {
      if (calm) return;
      burst(fx, n, { x, y }, { kind: 'star', color, size: 0.2, gravity: 2, life: 0.9 }, 4);
    };
    const mood = (m: Fx['mood']) => {
      fx.mood = m;
      fx.moodT = 0;
    };

    const heartAt = (i: number) => {
      const w = view?.wizard ?? { x: W * 0.15, y: H * 0.31, u: 26 };
      const hs = w.u * 0.3;
      return { x: w.x + w.u * 1.15 + i * hs * 2.6, y: w.y + w.u * 0.2, hs };
    };

    const handle = (e: TowersEvent) => {
      switch (e.type) {
        case 'spawn':
          audio?.spawn();
          break;
        case 'move':
          audio?.move();
          break;
        case 'rotate':
          audio?.rotate();
          break;
        case 'blocked':
          audio?.blocked();
          break;
        case 'land':
          if (e.speed > 1.5) {
            audio?.land(e.speed);
            dust(e.x, e.y, Math.min(12, Math.round(e.speed * 1.2)), 2 + e.speed * 0.3);
            if (e.speed > 6 && !calm) fx.shake = Math.max(fx.shake, Math.min(e.speed * 0.4, 5));
            if (e.speed > 6) buzz(14);
          }
          break;
        case 'release':
          audio?.release();
          break;
        case 'settle':
          audio?.settle(e.stacked);
          sparkle(e.x, e.y - 0.6, 5);
          fx.popups.push({ x: e.x, y: e.y - 1, text: `+1`, color: '#ffd23f', life: 1.1, max: 1.1, size: 1.2, space: 'world' });
          if (fx.mood === 'idle') mood('cheer');
          break;
        case 'fall': {
          audio?.fall();
          stats.current.falls++;
          const by = view ? view.bottomY - 1.6 : 12;
          fx.particles.push({ space: 'world', kind: 'x', x: e.x, y: by, vx: 0, vy: 0, life: 1.1, max: 1.1, size: 0.7, color: '#e5303a', rot: 0, vr: 0, gravity: 0 });
          fx.hurt = Math.max(fx.hurt, 0.5);
          mood('scared');
          break;
        }
        case 'life': {
          if (e.delta < 0) {
            audio?.lifeLost();
            buzz(70);
            fx.hurt = 1;
            if (!calm) fx.shake = Math.max(fx.shake, 8);
            for (let i = e.lives; i < e.lives - e.delta; i++) {
              fx.heartBroke[i] = fx.time;
              const h = heartAt(i);
              for (const side of ['L', 'R'] as const) {
                fx.particles.push({
                  space: 'screen',
                  kind: 'halfheart',
                  x: h.x,
                  y: h.y,
                  vx: side === 'L' ? -70 : 70,
                  vy: -120,
                  life: 1.2,
                  max: 1.2,
                  size: h.hs,
                  color: side,
                  rot: 0,
                  vr: side === 'L' ? -3 : 3,
                  gravity: 700,
                });
              }
              fx.popups.push({ x: h.x, y: h.y + 4, text: '-1', color: '#e5303a', life: 1.2, max: 1.2, size: 1.1, space: 'screen' });
            }
            say('bad', e.lives > 0 ? 'PERDEU UMA VIDA' : 'SEM VIDAS', e.lives > 0 ? `${e.lives} ${e.lives === 1 ? 'vida' : 'vidas'}` : null, 1400);
            mood('scared');
          } else {
            audio?.lifeUp();
            for (let i = 0; i < MAX_LIVES; i++) fx.heartGain[i] = i === e.lives - 1 ? fx.time : fx.heartGain[i]!;
            const h = heartAt(e.lives - 1);
            for (let n = 0; n < 6; n++) {
              fx.particles.push({
                space: 'screen',
                kind: 'heart',
                x: h.x + (Math.random() - 0.5) * 30,
                y: h.y,
                vx: (Math.random() - 0.5) * 50,
                vy: -90 - Math.random() * 60,
                life: 1,
                max: 1,
                size: h.hs * 0.5,
                color: '#e5303a',
                rot: 0,
                vr: 0,
                gravity: 40,
              });
            }
            mood('cheer');
          }
          break;
        }
        case 'collapse':
          audio?.collapse();
          stats.current.collapses++;
          if (!calm) fx.shake = Math.max(fx.shake, 13);
          buzz(120);
          say('warn', 'CAIU TUDO!', null, 1700);
          if (view) for (let n = 0; n < 4; n++) dust((Math.random() - 0.5) * 8, 2 + Math.random() * 3, 8, 5);
          mood('scared');
          break;
        case 'spell':
          audio?.spell(e.good);
          stats.current.spells++;
          fx.glow = 1;
          fx.glowColor = e.good ? '#ffffff' : '#7a3cff';
          say(e.good ? 'good' : 'bad', e.good ? 'MAGIA BOA' : 'MAGIA RUIM', `${SPELL_LABEL[e.name].name}: ${SPELL_LABEL[e.name].text}`, 2300);
          mood(e.good ? 'cheer' : 'scared');
          break;
        case 'cast':
          audio?.cast(e.name);
          if (e.name === 'vinha') {
            if (!calm) burst(fx, 8, { x: e.x, y: e.y }, { kind: 'leaf', color: '#33c27f', size: 0.3, gravity: 3 }, 3);
          } else if (e.name === 'cimento') {
            dust(e.x, e.y, 10, 3);
          } else if (e.name === 'desfazer') {
            fx.particles.push({ space: 'world', kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, life: 0.7, max: 0.7, size: 0.6, color: '#7a3cff', rot: 0, vr: 0, gravity: 0 });
            fx.particles.push({ space: 'world', kind: 'swirl', x: e.x, y: e.y, vx: 0, vy: -2, life: 0.8, max: 0.8, size: 0.5, color: '#25c7e8', rot: 0, vr: 9, gravity: 0 });
          }
          fx.glow = 0.7;
          fx.glowColor = '#33c27f';
          break;
        case 'ivy':
          if (!calm) burst(fx, 12, { x: e.x, y: e.y }, { kind: 'leaf', color: '#33c27f', size: 0.3, gravity: 2 }, 4);
          say('good', 'VINHA!', 'As peças ficaram coladas', 1300);
          break;
        case 'petrify':
          dust(e.x, e.y, 14, 4);
          say('info', 'PEDRA!', null, 1000);
          break;
        case 'over':
          audio?.over();
          mood('faint');
          darkTarget = 1;
          setOver(true);
          endTimer = window.setTimeout(() => {
            onEndRef.current({
              score: game.peak,
              pieces: game.releasedCount,
              time: game.time,
              spells: stats.current.spells,
              falls: stats.current.falls,
              collapses: stats.current.collapses,
            });
          }, 2100);
          break;
      }
    };

    castRef.current = () => {
      if (paused.current || game.over) return;
      if (!game.castSpell()) audio?.blocked();
    };
    rotateRef.current = () => {
      if (paused.current || game.over) return;
      game.rotate();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!paused.current && !game.over && !document.hidden) {
        acc += dt;
        let guard = 0;
        while (acc >= TOWERS_DT && guard++ < 4) {
          game.step(input.current);
          acc -= TOWERS_DT;
          for (const e of game.drainEvents()) handle(e);
        }
        if (acc > TOWERS_DT * 4) acc = 0;
      }
      stepFx(fx, dt);
      fx.dark += (darkTarget - fx.dark) * Math.min(1, dt * 1.6);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      view = drawFrame(ctx, W, H, game, fx, dt);
      const s = snapshot(game);
      if (!sameHud(s, prevHud)) {
        prevHud = s;
        setHud(s);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Teclado: setas ou A/D movem, cima/W/espaço giram, baixo/S desce, E/Enter usam a magia.
    const keys = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') input.current.left = down;
      else if (k === 'arrowright' || k === 'd') input.current.right = down;
      else if (k === 'arrowdown' || k === 's') input.current.down = down;
      else if (down && !e.repeat && (k === 'arrowup' || k === 'w' || k === ' ')) rotateRef.current();
      else if (down && !e.repeat && (k === 'e' || k === 'enter')) castRef.current();
      else if (down && k === 'escape') setAsking(true);
      else return;
      e.preventDefault();
    };
    const onDown = (e: KeyboardEvent) => keys(e, true);
    const onUp = (e: KeyboardEvent) => keys(e, false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    const clear = () => {
      input.current = { left: false, right: false, down: false };
    };
    window.addEventListener('blur', clear);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(endTimer);
      ro.disconnect();
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', clear);
      audioRef.current = null;
    };
  }, [game, say]);

  const hold = (key: keyof TowersInput) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      input.current[key] = true;
    },
    onPointerUp: () => {
      input.current[key] = false;
    },
    onPointerCancel: () => {
      input.current[key] = false;
    },
    onLostPointerCapture: () => {
      input.current[key] = false;
    },
  });

  const heldFirst = hud.held[0];
  const chips = (Object.keys(hud.fx) as BadSpell[]).filter((k) => hud.fx[k] > 0);

  return (
    <div className="tw-play" ref={wrap} role="application" aria-label="Partida do Block Towers">
      <BlockDefs />
      <canvas ref={canvas} className="tw-canvas" />

      <header className="tw-top">
        <button type="button" className="tw-iconbtn" aria-label="Sair da partida" data-sfx="back" onClick={() => setAsking(true)}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className={`tw-next${hud.fog ? ' fog' : ''}`} aria-label="Próximas peças">
          <span className="mono tw-next-label">PRÓXIMA</span>
          <div className="tw-next-row">
            <div className="tw-next-main">{hud.fog ? <b>?</b> : hud.queue[0] !== undefined && <TinyPiece kind={hud.queue[0]} unit={15} />}</div>
            <div className="tw-next-sub">{hud.fog ? <b>?</b> : hud.queue[1] !== undefined && <TinyPiece kind={hud.queue[1]} unit={10} />}</div>
          </div>
        </div>
        <MuteButton />
      </header>

      <div className="tw-score" aria-label="Placar">
        <span className="mono tw-label">PEÇAS EMPILHADAS</span>
        <b key={hud.peak} className="tw-peak">
          {hud.peak}
        </b>
        <span className="mono tw-best">RECORDE {Math.max(best, hud.peak)}</span>
      </div>

      {chips.length > 0 && (
        <ul className="tw-chips" aria-label="Magias ruins ativas">
          {chips.map((k) => (
            <li key={k} className="tw-chip">
              <SpellIcon name={k} size={20} />
              <span className="mono">
                {SPELL_LABEL[k].name} x{hud.fx[k]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {banner && (
        <div key={banner.key} className={`tw-banner ${banner.tone}`} role="status">
          <b>{banner.title}</b>
          {banner.sub && <span className="mono">{banner.sub}</span>}
        </div>
      )}

      {over && (
        <div className="tw-over" role="status">
          <b>SEM VIDAS</b>
          <span className="mono">{hud.peak} PEÇAS EMPILHADAS</span>
        </div>
      )}

      <footer className="tw-controls">
        <div className="tw-cluster">
          <button type="button" className="tw-btn" aria-label="Mover para a esquerda" {...hold('left')}>
            <ArrowIcon dir="left" />
          </button>
          <button type="button" className="tw-btn" aria-label="Mover para a direita" {...hold('right')}>
            <ArrowIcon dir="right" />
          </button>
        </div>
        <button
          type="button"
          className="tw-btn rot"
          aria-label="Girar a peça"
          onPointerDown={(e) => {
            e.preventDefault();
            rotateRef.current();
          }}
        >
          <ArrowIcon dir="rotate" size={30} />
          <span className="mono">GIRAR</span>
        </button>
        <div className="tw-cluster">
          <button type="button" className="tw-btn down" aria-label="Descer mais rápido" {...hold('down')}>
            <ArrowIcon dir="down" />
          </button>
          <button
            type="button"
            className={`tw-btn spell${heldFirst ? ' ready' : ''}`}
            aria-label={heldFirst ? `Usar magia: ${SPELL_LABEL[heldFirst].name}` : 'Sem magia guardada'}
            disabled={!heldFirst}
            onPointerDown={(e) => {
              e.preventDefault();
              castRef.current();
            }}
          >
            {heldFirst ? <SpellIcon name={heldFirst} size={30} /> : <span className="tw-nospell" aria-hidden="true" />}
            {hud.held.length > 1 && <i className="tw-count mono">{hud.held.length}</i>}
          </button>
        </div>
      </footer>

      <ConfirmDialog
        open={asking}
        title="Sair da partida?"
        text="A partida em andamento não vale para o recorde."
        confirmLabel="Sair"
        confirmSfx="back"
        cancelLabel="Continuar jogando"
        onConfirm={() => {
          setAsking(false);
          onQuit();
        }}
        onCancel={() => setAsking(false)}
      />
    </div>
  );
}

