import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PP_BOT_LEVELS,
  PpBot,
  PpMatch,
  createRng,
  ppIdleInput,
  type PpBotName,
  type PpEvent,
  type PpInput,
} from '@nocap/games';
import { GameMenu, GearButton, Keycap } from '@/components/GameMenu';
import { GameTips, type TipRow } from '@/components/GameTips';
import { RotateHint } from '@/components/RotateHint';
import { pingSfx } from '@/lib/ping-audio';
import { PingFinal, type PingStats } from './PingFinal';
import { PingScene } from './PingScene';
import './ping.css';

const TIPS_KEY = 'nocap-ping-tips';
/** A raquete fica acima do dedo (celular) para o dedo não cobrir. */
const TOUCH_LIFT = 0.5;

const tipRows = (touch: boolean): TipRow[] =>
  touch
    ? [
        { keys: <b className="gm-tag">Arraste</b>, text: 'A raquete vai para onde o dedo está' },
        { keys: <b className="gm-tag">Toque</b>, text: 'Saca (quando for a sua vez)' },
        {
          keys: <b className="gm-tag">Smash</b>,
          text: 'Segure o botão na hora da batida: mais força, mais risco',
        },
        {
          keys: <b className="gm-tag">Dica</b>,
          text: 'O anel verde mostra por onde a bola vai passar',
        },
      ]
    : [
        { keys: <b className="gm-tag">Mouse</b>, text: 'A raquete vai para onde o mouse está' },
        { keys: <Keycap k="Clique" wide touchHide={false} />, text: 'Saca (ou Espaço)' },
        {
          keys: <Keycap k="Botão direito" wide touchHide={false} />,
          text: 'Segure na batida: smash (ou segure Espaço)',
        },
        {
          keys: <b className="gm-tag">Dica</b>,
          text: 'Bata com a borda para a bola ir para o lado; mexa a raquete para dar efeito',
        },
        { keys: <Keycap k="Esc" touchHide={false} />, text: 'Menu' },
      ];

interface Hud {
  phase: 'ready' | 'play' | 'over';
  count: number;
  score: [number, number];
  server: number;
  rally: number;
  matchPhase: string;
  banner: { text: string; sub?: string; id: number; tone: 'win' | 'lose' | 'info' } | null;
  speed: { kmh: number; id: number; mine: boolean; tag?: string } | null;
}

const BOT_NAMES: Record<PpBotName, string> = {
  facil: 'Raposa Fácil',
  medio: 'Raposa Média',
  dificil: 'Raposa Difícil',
};
const BOT_COLORS: Record<PpBotName, number> = {
  facil: 0x6fd3a0,
  medio: 0xff9bd0,
  dificil: 0x9a6bff,
};

/** Uma partida do Ping Fox! contra um bot (treino): roda o motor num passo fixo de 60 Hz e desenha com interpolação. */
export function PingPlay({
  level,
  onExit,
  onAgain,
  onOfflineInvite,
}: {
  level: PpBotName;
  onExit: () => void;
  onAgain?: () => void;
  onOfflineInvite?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<Hud>({
    phase: 'ready',
    count: 3,
    score: [0, 0],
    server: 0,
    rally: 0,
    matchPhase: 'serve',
    banner: null,
    speed: null,
  });
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(false);
  menuRef.current = menu;
  const [result, setResult] = useState<{
    winner: number;
    score: [number, number];
    stats: PingStats;
  } | null>(null);
  const touchDevice = useMemo(
    () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    [],
  );
  const smashRef = useRef(false);
  const [smashOn, setSmashOn] = useState(false);
  const closeMenu = () => setMenu(false);

  useEffect(() => {
    const cv = canvas.current;
    const zn = zone.current;
    if (!cv || !zn) return undefined;
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seed = crypto.randomUUID();
    const rng = createRng(seed);
    const match = new PpMatch(rng() < 0.5 ? 0 : 1);
    const bot = new PpBot(PP_BOT_LEVELS[level], rng);
    const scene = new PingScene(cv, match, {
      oppColor: BOT_COLORS[level],
      oppName: BOT_NAMES[level],
      reduced,
    });

    const me: PpInput = ppIdleInput();
    let serveUntil = 0;
    let mouseSmash = false;
    let keySmash = false;
    const keys = { l: false, r: false, u: false, d: false };
    let ready = 3;
    const readyAt = performance.now();
    let phase: Hud['phase'] = 'ready';
    let acc = 0;
    let slow = 1;
    let slowUntil = 0;
    let bannerId = 0;
    let speedId = 0;
    const stats: PingStats = {
      seconds: 0,
      longest: 0,
      fastest: 0,
      smashes: 0,
      points: [0, 0],
      hits: [0, 0],
    };
    let finished = false;

    // ---- entrada: a raquete segue o ponteiro (projetado no plano da raquete) ----
    const toPlane = (e: PointerEvent) => {
      const r = zn.getBoundingClientRect();
      const p = scene.pointerToPlane(
        (e.clientX - r.left) / r.width,
        (e.clientY - r.top) / r.height,
        e.pointerType === 'touch' ? TOUCH_LIFT : 0,
      );
      me.x = p.x;
      me.y = p.y;
    };
    let downAt = 0;
    let downX = 0;
    let downY = 0;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current) return;
      zn.setPointerCapture?.(e.pointerId);
      toPlane(e);
      if (e.pointerType === 'mouse') {
        if (e.button === 2) mouseSmash = true;
        else serveUntil = performance.now() + 120;
      } else {
        downAt = performance.now();
        downX = e.clientX;
        downY = e.clientY;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (menuRef.current) return;
      toPlane(e);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 2) mouseSmash = false;
        return;
      }
      // toque curto e parado = sacar
      if (
        performance.now() - downAt < 280 &&
        Math.hypot(e.clientX - downX, e.clientY - downY) < 16
      ) {
        serveUntil = performance.now() + 120;
      }
    };
    const onCtx = (e: Event) => e.preventDefault();
    zn.addEventListener('pointerdown', onDown);
    zn.addEventListener('pointermove', onMove);
    zn.addEventListener('pointerup', onUp);
    zn.addEventListener('contextmenu', onCtx);

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (e.key === 'Escape' && down && !e.repeat) {
        setMenu((v) => !v);
        return;
      }
      if (menuRef.current) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (down && !e.repeat) serveUntil = performance.now() + 120;
        keySmash = down;
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') keys.l = down;
      else if (k === 'arrowright' || k === 'd') keys.r = down;
      else if (k === 'arrowup' || k === 'w') keys.u = down;
      else if (k === 'arrowdown' || k === 's') keys.d = down;
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const ro = new ResizeObserver(() => {
      const r = zn.getBoundingClientRect();
      scene.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
    });
    ro.observe(zn);
    const r0 = zn.getBoundingClientRect();
    scene.resize(Math.max(1, Math.round(r0.width)), Math.max(1, Math.round(r0.height)));

    const react = (events: PpEvent[]) => {
      for (const e of events) {
        if (e.type === 'toss') pingSfx.toss();
        else if (e.type === 'hit') {
          const power = Math.max(0, Math.min(1, (e.kmh - 20) / 80));
          pingSfx.hit(power, e.smash, e.p === 0);
          stats.hits[e.p === 0 ? 0 : 1]++;
          if (e.smash && e.p === 0) stats.smashes++;
          if (e.kmh > stats.fastest) stats.fastest = e.kmh;
          setHud((h) => ({
            ...h,
            rally: match.rally,
            speed: {
              kmh: e.kmh,
              id: ++speedId,
              mine: e.p === 0,
              tag: e.smash ? 'SMASH' : e.quality === 'sweet' ? 'PERFEITA' : undefined,
            },
          }));
        } else if (e.type === 'bounce') pingSfx.bounce(e.impact);
        else if (e.type === 'net') pingSfx.net();
        else if (e.type === 'fault') {
          pingSfx.fault();
          setHud((h) => ({
            ...h,
            banner: {
              text: 'Falta de saque',
              sub: e.p === 0 ? 'Mais uma e o ponto é dele' : 'Ele errou o saque',
              id: ++bannerId,
              tone: 'info',
            },
          }));
        } else if (e.type === 'point') {
          const won = e.winner === 0;
          pingSfx.point(won);
          stats.points[e.winner === 0 ? 0 : 1]++;
          if (e.rally > stats.longest) stats.longest = e.rally;
          const near = Math.max(e.score[0], e.score[1]) >= 10;
          if (near && !reduced) {
            slow = 0.35;
            slowUntil = performance.now() + 900;
          }
          const who = won ? 'você' : BOT_NAMES[level];
          setHud((h) => ({
            ...h,
            score: e.score,
            rally: 0,
            banner: {
              text: `Ponto de ${who}`,
              sub: e.best > 0 ? `${e.best} km/h na melhor batida` : undefined,
              id: ++bannerId,
              tone: won ? 'win' : 'lose',
            },
          }));
        } else if (e.type === 'game') {
          pingSfx.win(e.winner === 0);
          finished = true;
          stats.seconds = match.tick / 60;
          window.setTimeout(() => {
            phase = 'over';
            setHud((h) => ({ ...h, phase: 'over' }));
            setResult({ winner: e.winner, score: e.score, stats: { ...stats } });
          }, 1500);
        }
      }
      scene.handle(events, 0);
    };

    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const paused = menuRef.current;
      if (phase === 'ready') {
        const left = 3 - Math.floor((now - readyAt) / 700);
        if (left !== ready) {
          ready = left;
          if (left >= 0) pingSfx.count(left);
          setHud((h) => ({ ...h, count: Math.max(0, left) }));
        }
        if (left < 0) {
          phase = 'play';
          setHud((h) => ({ ...h, phase: 'play' }));
        }
      }
      if (phase === 'play' && !paused && !finished) {
        // setas e WASD movem a raquete (alternativa ao mouse)
        const kx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
        const ky = (keys.u ? 1 : 0) - (keys.d ? 1 : 0);
        if (kx || ky) {
          me.x = Math.max(-1.9, Math.min(1.9, me.x + kx * 3.2 * dt));
          me.y = Math.max(0.55, Math.min(2.3, me.y + ky * 3.2 * dt));
        }
        if (slow < 1 && now > slowUntil) slow = 1;
        acc += dt * slow;
        let guard = 0;
        while (acc >= 1 / 60 && guard++ < 6) {
          me.serve = now < serveUntil;
          me.smash = mouseSmash || keySmash || smashRef.current;
          scene.snap();
          match.step([me, bot.input(match, 1)]);
          const ev = match.drain();
          if (ev.length) react(ev);
          acc -= 1 / 60;
        }
        if (guard >= 6) acc = 0;
      }
      scene.render(dt, phase === 'play' && !paused ? acc * 60 : 1);
      if (now - hudAt > 120) {
        hudAt = now;
        setHud((h) =>
          h.server === match.server && h.matchPhase === match.phase && h.rally === match.rally
            ? h
            : { ...h, server: match.server, matchPhase: match.phase, rally: match.rally },
        );
      }
    };
    raf = requestAnimationFrame(frame);

    (window as unknown as { __ping?: unknown }).__ping = { match, scene };
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      zn.removeEventListener('pointerdown', onDown);
      zn.removeEventListener('pointermove', onMove);
      zn.removeEventListener('pointerup', onUp);
      zn.removeEventListener('contextmenu', onCtx);
      ro.disconnect();
      scene.dispose();
      delete (window as unknown as { __ping?: unknown }).__ping;
    };
  }, [level]);

  // botão de smash do celular (segurar): o laço do jogo lê `smashRef` a cada tick
  const smashDown = () => {
    smashRef.current = true;
    setSmashOn(true);
  };
  const smashUp = () => {
    smashRef.current = false;
    setSmashOn(false);
  };

  const myServe = hud.matchPhase === 'serve' && hud.server === 0 && hud.phase === 'play';
  const names = ['Você', BOT_NAMES[level]];

  return (
    <div ref={root} className="png-play" data-testid="png-play">
      <canvas ref={canvas} className="png-canvas" aria-label="Mesa de pingue-pongue" />
      <div ref={zone} className="png-zone" aria-hidden="true" />
      <div className="png-hud">
        <div className="png-score" role="status" aria-label="Placar" data-testid="png-score">
          <span className={`png-side${hud.server === 0 ? ' is-serving' : ''}`}>
            <i aria-hidden="true" />
            <small>{names[0]}</small>
            <b>{hud.score[0]}</b>
          </span>
          <span className="png-sep" aria-hidden="true">
            :
          </span>
          <span className={`png-side is-right${hud.server === 1 ? ' is-serving' : ''}`}>
            <b>{hud.score[1]}</b>
            <small>{names[1]}</small>
            <i aria-hidden="true" />
          </span>
        </div>
        <div className="png-hud-end">
          <GearButton onClick={() => setMenu(true)} testId="png-menu-btn" />
        </div>
      </div>
      {hud.rally >= 4 && hud.matchPhase === 'rally' && (
        <div className="png-rally" key={hud.rally} aria-hidden="true">
          Troca <b>{hud.rally}</b>
        </div>
      )}
      {hud.speed && (
        <div
          className={`png-speed${hud.speed.mine ? ' is-mine' : ''}`}
          key={hud.speed.id}
          aria-hidden="true"
        >
          {hud.speed.tag && <em>{hud.speed.tag}</em>}
          <b>{hud.speed.kmh}</b> km/h
        </div>
      )}
      {hud.banner && (
        <div className={`png-banner is-${hud.banner.tone}`} key={hud.banner.id} role="status">
          <b>{hud.banner.text}</b>
          {hud.banner.sub && <span>{hud.banner.sub}</span>}
        </div>
      )}
      {hud.phase === 'ready' && (
        <div className="png-count" aria-live="assertive">
          {hud.count > 0 ? hud.count : 'Já!'}
        </div>
      )}
      {myServe && !hud.banner && (
        <div className="png-serve-hint" data-testid="png-serve-hint">
          <b>Sua vez de sacar</b>
          <span>{touchDevice ? 'Toque na tela' : 'Clique ou aperte Espaço'}</span>
        </div>
      )}
      {hud.matchPhase === 'serve' && hud.server === 1 && hud.phase === 'play' && !hud.banner && (
        <div className="png-serve-hint is-them">
          <b>{BOT_NAMES[level]} vai sacar</b>
          <span>Prepare a raquete</span>
        </div>
      )}
      {touchDevice && hud.phase !== 'over' && (
        <button
          type="button"
          className={`png-smash${smashOn ? ' is-on' : ''}`}
          aria-label="Smash"
          data-testid="png-smash"
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture?.(e.pointerId);
            smashDown();
          }}
          onPointerUp={smashUp}
          onPointerCancel={smashUp}
        >
          Smash
        </button>
      )}
      <RotateHint />
      {hud.phase === 'ready' && (
        <GameTips storageKey={TIPS_KEY} rows={tipRows(touchDevice)} testId="png-tips" markOnShow />
      )}
      {menu && !result && (
        <GameMenu
          title="Menu"
          testPrefix="png-menu"
          tipsKey={TIPS_KEY}
          tips={tipRows(touchDevice)}
          online={false}
          onClose={closeMenu}
          onExit={onExit}
          onOfflineInvite={onOfflineInvite}
          actions={[]}
        />
      )}
      {result && (
        <PingFinal
          winner={result.winner}
          score={result.score}
          names={[names[0] as string, names[1] as string]}
          stats={result.stats}
          mode={{ kind: 'training', onAgain, onExit }}
        />
      )}
    </div>
  );
}
