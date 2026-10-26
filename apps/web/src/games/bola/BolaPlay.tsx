import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BOL_DT,
  BOL_TEAM_COLORS,
  BOL_TEAM_NAMES,
  BolWorld,
  bolBotInput,
  createRng,
  newBolBotMemory,
  type BolInfo,
  type BolInput,
} from '@nocap/games';
import { DsmControls, STICK_RADIUS } from '../desmorona/controls';
import '../desmorona/desmorona.css';
import './bola.css';
import { BolaScene } from './BolaScene';

const BOT_NAMES = [
  'Faísca',
  'Pipoca',
  'Trufa',
  'Ruivo',
  'Brisa',
  'Nuvem',
  'Cacau',
  'Fumaça',
  'Jujuba',
  'Mingau',
  'Biscoito',
];
/** Quanto tempo um toque de pulo espera uma chance de valer (pousar, ou o pulo duplo estar livre). */
const JUMP_BUFFER_MS = 140;

export interface BolaSetup {
  teams: number;
  perTeam: number;
  /** Minutos de partida no treino. */
  minutes: number;
}

interface Hud {
  phase: 'countdown' | 'play' | 'goal' | 'over';
  count: number;
  clock: number;
  scores: number[];
  golden: boolean;
  feed: { id: number; text: string; team: number }[];
  warn: string;
  winner: number;
  ballCam: boolean;
  banner: { title: string; sub: string; team: number; id: number } | null;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Monta o elenco: você no time vermelho e bots em todas as outras vagas. */
export function bolaRoster(setup: BolaSetup): BolInfo[] {
  const out: BolInfo[] = [];
  let b = 0;
  for (let t = 0; t < setup.teams; t++) {
    for (let i = 0; i < setup.perTeam; i++) {
      if (t === 0 && i === 0)
        out.push({ id: 'me', name: 'Você', color: BOL_TEAM_COLORS[0], team: 0 });
      else {
        out.push({
          id: `bot${b}`,
          name: BOT_NAMES[b % BOT_NAMES.length] as string,
          color: BOL_TEAM_COLORS[t] as number,
          team: t,
          bot: true,
        });
        b++;
      }
    }
  }
  return out;
}

/** Treino do Bola Maluca!: você contra bots. O motor roda no aparelho; a sala online usa o mesmo motor no servidor. */
export function BolaPlay({
  setup,
  onExit,
  onAgain,
}: {
  setup: BolaSetup;
  onExit: () => void;
  onAgain: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const controls = useMemo(() => new DsmControls(), []);
  const camToggle = useRef<() => void>(() => undefined);
  const [stick, setStick] = useState<{ ox: number; oy: number; x: number; y: number } | null>(null);
  const [hud, setHud] = useState<Hud>({
    phase: 'countdown',
    count: 3,
    clock: 0,
    scores: [],
    golden: false,
    feed: [],
    warn: '',
    winner: -1,
    ballCam: true,
    banner: null,
  });

  useEffect(() => {
    const el = canvas.current;
    const zoneEl = zone.current;
    if (!el || !zoneEl) return undefined;
    const infos = bolaRoster(setup);
    const world = new BolWorld(infos, {
      teams: setup.teams,
      perTeam: setup.perTeam,
      durationSec: setup.minutes * 60,
    });
    if (import.meta.env.DEV) (window as unknown as { __bola?: BolWorld }).__bola = world;
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new BolaScene(el, world, reduced);
    const rng = createRng(`bola:${Math.random()}`);
    const mem = new Map(
      world.players
        .filter((p) => p.bot)
        .map((p, i) => [
          p.id,
          newBolBotMemory(
            (p.team + 1 + (i % Math.max(1, setup.teams - 1))) % setup.teams,
            0.2 + (i % 3) * 0.05,
          ),
        ]),
    );
    controls.turnKeys = false;
    controls.attach(zoneEl, setStick);
    if (root.current) controls.attachLook(root.current);
    let ballCam = true;
    let yaw = 0;
    let camYaw = 0;
    camToggle.current = () => {
      ballCam = !ballCam;
      if (!ballCam) yaw = camYaw;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && !e.repeat) camToggle.current();
    };
    window.addEventListener('keydown', onKey);

    let feedId = 0;
    let feed: Hud['feed'] = [];
    let warn = '';
    let warnTimer = 0;
    let bannerTimer = 0;
    let banner: Hud['banner'] = null;
    const push = (text: string, team: number) => {
      feed = [...feed.slice(-3), { id: feedId++, text, team }];
      window.setTimeout(() => {
        feed = feed.filter((f) => f.text !== text);
      }, 4200);
    };
    const nameOf = (id: string | null) => world.players.find((p) => p.id === id)?.name ?? 'Alguém';

    const resize = () => {
      const r = el.getBoundingClientRect();
      scene.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    let jumpUntil = 0;
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const me = world.player('me');
      if (!document.hidden && me) {
        acc += dt;
        const input = controls.read();
        if (input.jump) jumpUntil = now + JUMP_BUFFER_MS;
        input.jump = false;
        // a câmera segue a bola por padrão (E troca para câmera livre com o mouse)
        const manual = controls.takeYaw(dt);
        if (!ballCam) yaw += manual;
        else {
          const dx = world.ball.x - me.x;
          const dz = world.ball.z - me.z;
          if (Math.hypot(dx, dz) > 1.2) {
            const want = Math.atan2(-dx, -dz);
            let d = want - camYaw;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            camYaw += d * (1 - Math.exp(-dt * 4));
          }
          yaw = camYaw;
        }
        if (!ballCam) camYaw = yaw;
        scene.setYaw(yaw);
        if (input.mx !== 0 || input.mz !== 0) {
          const sy = Math.sin(yaw);
          const cy = Math.cos(yaw);
          const mx = input.mx * cy + input.mz * sy;
          const mz = -input.mx * sy + input.mz * cy;
          input.mx = mx;
          input.mz = mz;
        }
        while (acc >= BOL_DT) {
          acc -= BOL_DT;
          const inputs: Record<string, BolInput> = {};
          for (const p of world.players)
            if (p.bot)
              inputs[p.id] = bolBotInput(
                world,
                p,
                mem.get(p.id) as ReturnType<typeof newBolBotMemory>,
                rng,
              );
          const jumpNow = jumpUntil > now && (me.grounded || !me.airJumped);
          if (jumpNow) jumpUntil = 0;
          inputs.me = { mx: input.mx, mz: input.mz, jump: jumpNow };
          world.step(BOL_DT, inputs);
          for (const e of world.drainEvents()) {
            if (e.type === 'goal') {
              const who = nameOf(e.scorerId);
              const tn = (t: number) => BOL_TEAM_NAMES[t] ?? '';
              let title = 'GOL!';
              let sub = `${who} · time ${tn(e.scorerTeam)}`;
              if (e.noTouch) {
                title = `GOL CONTRA DO TIME ${tn(e.goalTeam).toUpperCase()}`;
                sub = `Ninguém tocou na bola · ponto para o time ${tn(e.scorerTeam)}`;
              } else if (e.own) {
                title = 'GOL CONTRA';
                sub = `${who} (${tn(e.scorerTeam)}) · ponto para o time ${tn(e.scorerTeam)}`;
              }
              push(`${title} · ${sub}`, e.scorerTeam);
              banner = { title, sub, team: e.scorerTeam, id: feedId++ };
              window.clearTimeout(bannerTimer);
              bannerTimer = window.setTimeout(() => {
                banner = null;
              }, 2800);
              scene.shakeNow(0.6);
            } else if (e.type === 'nogoal') {
              banner = {
                title: 'SEM GOL',
                sub: 'Ninguém tocou na bola: a bola volta ao centro',
                team: -1,
                id: feedId++,
              };
              window.clearTimeout(bannerTimer);
              bannerTimer = window.setTimeout(() => {
                banner = null;
              }, 2800);
            } else if (e.type === 'warn') {
              warn = e.left >= 60 ? `Faltam ${Math.round(e.left / 60)} min` : 'Falta 1 minuto';
              window.clearTimeout(warnTimer);
              warnTimer = window.setTimeout(() => {
                warn = '';
              }, 3500);
            } else if (e.type === 'golden') {
              warn = 'Gol de ouro! Quem marcar ganha';
            } else if (e.type === 'ballreset') {
              warn = 'Bola parada: de volta ao centro';
              window.clearTimeout(warnTimer);
              warnTimer = window.setTimeout(() => {
                warn = '';
              }, 3000);
            }
          }
        }
      }
      scene.render(dt, 'me');
      if (now - hudAt > 100) {
        hudAt = now;
        setHud({
          phase: world.phase,
          count: Math.max(0, Math.ceil(world.timer)),
          clock: world.clock,
          scores: [...world.scores],
          golden: world.golden,
          feed,
          warn,
          winner: world.winner,
          ballCam,
          banner,
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(warnTimer);
      window.clearTimeout(bannerTimer);
      window.removeEventListener('keydown', onKey);
      ro.disconnect();
      controls.detach();
      scene.dispose();
    };
  }, [setup, controls]);

  const knob = stick
    ? (() => {
        const dx = stick.x - stick.ox;
        const dy = stick.y - stick.oy;
        const len = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, len / STICK_RADIUS);
        return { x: (dx / len) * k * STICK_RADIUS, y: (dy / len) * k * STICK_RADIUS };
      })()
    : null;
  const over = hud.phase === 'over';

  return (
    <div ref={root} className="dsm-play" data-testid="bola-play">
      <canvas ref={canvas} className="dsm-canvas" aria-label="Campo do Bola Maluca!" />
      <div ref={zone} className="dsm-zone" aria-hidden="true">
        {stick && knob && (
          <div className="dsm-stick" style={{ left: stick.ox, top: stick.oy }}>
            <i className="dsm-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
          </div>
        )}
      </div>
      <div className="dsm-hud bola-hud">
        <div className="bola-score" role="status" aria-label="Placar">
          {hud.scores.map((s, i) => (
            <span
              key={i}
              className="bola-team"
              style={{
                background: `#${(BOL_TEAM_COLORS[i] as number).toString(16).padStart(6, '0')}`,
              }}
            >
              {s}
            </span>
          ))}
        </div>
        <div className="bola-clock" role="timer" aria-label="Tempo de jogo">
          {fmt(hud.clock)}
          {hud.golden && <small>Gol de ouro</small>}
        </div>
        <button type="button" className="dsm-exit" onClick={onExit}>
          Sair
        </button>
      </div>
      {hud.banner && (
        <div
          key={hud.banner.id}
          className="bola-banner"
          role="status"
          style={{
            borderColor:
              hud.banner.team >= 0
                ? `#${(BOL_TEAM_COLORS[hud.banner.team] as number).toString(16).padStart(6, '0')}`
                : '#1b1535',
          }}
        >
          <strong>{hud.banner.title}</strong>
          <span>{hud.banner.sub}</span>
        </div>
      )}
      {hud.warn && <div className="dsm-note bola-warn">{hud.warn}</div>}
      <ul className="bola-feed" aria-live="polite">
        {hud.feed.map((f) => (
          <li
            key={f.id}
            style={{
              borderColor: `#${(BOL_TEAM_COLORS[f.team] ?? 0xffffff).toString(16).padStart(6, '0')}`,
            }}
          >
            {f.text}
          </li>
        ))}
      </ul>
      {hud.phase === 'countdown' && (
        <div className="dsm-count" aria-live="assertive">
          {hud.count > 0 ? hud.count : 'Já!'}
        </div>
      )}
      {!over && (
        <>
          <button
            type="button"
            className="dsm-jump"
            aria-label="Pular"
            onPointerDown={(e) => {
              e.preventDefault();
              controls.pressJump();
            }}
          >
            Pular
          </button>
          <button
            type="button"
            className="bola-cam"
            onClick={() => camToggle.current()}
            aria-pressed={!hud.ballCam}
          >
            <kbd aria-hidden="true">E</kbd>
            {hud.ballCam ? 'Câmera na bola' : 'Câmera livre'}
          </button>
        </>
      )}
      {over && (
        <div className="dsm-over" role="dialog" aria-modal="true" aria-label="Resultado">
          <div className="dsm-over-card">
            <h2>
              {hud.winner < 0
                ? 'Empate'
                : hud.winner === 0
                  ? 'Você venceu!'
                  : `Time ${BOL_TEAM_NAMES[hud.winner]} venceu`}
            </h2>
            <ol>
              {hud.scores.map((s, i) => (
                <li key={i} className={i === 0 ? 'is-you' : ''}>
                  <span>{s}</span> {BOL_TEAM_NAMES[i]}
                  {i === 0 ? ' (seu time)' : ''}
                </li>
              ))}
            </ol>
            <div className="dsm-over-btns">
              <button type="button" className="dsm-btn" onClick={onAgain} data-testid="bola-again">
                Jogar de novo
              </button>
              <button type="button" className="dsm-btn is-ghost" onClick={onExit}>
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
