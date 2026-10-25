import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DSM_DT,
  DSM_LAYERS,
  DsmWorld,
  botInput,
  newBotMemory,
  createRng,
  type DsmInput,
  type DsmPlayerInfo,
} from '@nocap/games';
import { dsmSfx } from '@/lib/desmorona-audio';
import { DsmControls, STICK_RADIUS } from './controls';
import { DsmScene } from './scene';

/** Cores de pelo das raposas (a primeira é a sua, laranja como no Atravessa). */
const FURS = [0xff7d26, 0xb98cff, 0x4fc3f7, 0x7be07b, 0xffd23f, 0xff6f91, 0xf5f5f5, 0x8d6e63];
const BOT_NAMES = ['Faísca', 'Pipoca', 'Trufa', 'Ruivo', 'Brisa', 'Nuvem', 'Cacau'];
const COUNTDOWN = 3.4;

export interface DsmResult {
  winnerId: string;
  standings: { id: string; name: string; you: boolean }[];
  seconds: number;
}

interface Hud {
  alive: number;
  total: number;
  layer: number;
  phase: 'ready' | 'play' | 'over';
  count: number;
  note: string;
  dead: boolean;
  watching: string;
}

const seedOf = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

/** Uma partida do Desmorona! (treino contra bots). Solta a raposa do ar, roda o motor e desenha a cena. */
export function DesmoronaPlay({ bots, onExit, onAgain }: { bots: number; onExit: () => void; onAgain: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const [hud, setHud] = useState<Hud>({ alive: bots + 1, total: bots + 1, layer: 1, phase: 'ready', count: 3, note: '', dead: false, watching: '' });
  const [stick, setStick] = useState<{ ox: number; oy: number; x: number; y: number } | null>(null);
  const [result, setResult] = useState<DsmResult | null>(null);
  const controls = useMemo(() => new DsmControls(), []);
  const spectate = useRef({ index: 0 });
  const api = useRef<{ next: (d: number) => void } | null>(null);
  const noteTimer = useRef<number | null>(null);

  useEffect(() => {
    const el = canvas.current;
    const zoneEl = zone.current;
    if (!el || !zoneEl) return undefined;
    const infos: DsmPlayerInfo[] = [
      { id: 'me', name: 'Você', color: FURS[0] as number },
      ...Array.from({ length: bots }, (_, i) => ({ id: `bot${i}`, name: BOT_NAMES[i] ?? `Raposa ${i + 1}`, color: FURS[(i + 1) % FURS.length] as number, bot: true })),
    ];
    const seed = seedOf();
    const world = new DsmWorld(seed, infos);
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new DsmScene(el, world, reduced);
    const mem = new Map(world.players.filter((p) => p.bot).map((p, i) => [p.id, newBotMemory((i % 4) * 0.15)]));
    const rng = createRng(`${seed}:bots`);
    controls.attach(zoneEl, setStick);

    let phase: Hud['phase'] = 'ready';
    const readyAt = performance.now();
    let lastCount = 4;
    let focus = 'me';
    let acc = 0;
    let last = performance.now();
    let hudAt = 0;
    let raf = 0;
    let note = '';
    const say = (text: string) => {
      note = text;
      if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
      noteTimer.current = window.setTimeout(() => {
        note = '';
      }, 2600);
    };

    const focusList = () => world.players.filter((p) => p.alive && p.id !== 'me');
    api.current = {
      next: (d) => {
        const list = focusList();
        if (list.length === 0) return;
        spectate.current.index = (spectate.current.index + d + list.length) % list.length;
        focus = (list[spectate.current.index] as { id: string }).id;
      },
    };

    const resize = () => {
      const r = el.getBoundingClientRect();
      scene.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const me = () => world.players.find((p) => p.id === 'me')!;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (phase === 'ready') {
        const left = COUNTDOWN - (now - readyAt) / 1000;
        const n = Math.ceil(left - 0.4);
        if (n !== lastCount && n >= 0 && n <= 3) {
          lastCount = n;
          dsmSfx.count(n === 0 ? 0 : n);
        }
        if (left <= 0) phase = 'play';
        else {
          // contagem: as raposas ficam paradas no ar
          scene.render(dt, focus);
          if (now - hudAt > 100) {
            hudAt = now;
            setHud((h) => ({ ...h, phase: 'ready', count: Math.max(0, n) }));
          }
          raf = requestAnimationFrame(frame);
          return;
        }
      }
      if (!document.hidden && !world.ended) {
        acc += dt;
        const m = me();
        const input = m.alive ? controls.read() : { mx: 0, mz: 0, jump: false };
        const wasJump = input.jump && m.grounded && m.alive;
        if (wasJump) dsmSfx.jump();
        while (acc >= DSM_DT) {
          acc -= DSM_DT;
          const inputs: Record<string, DsmInput> = { me: input };
          for (const p of world.players) if (p.bot) inputs[p.id] = botInput(world, p, mem.get(p.id)!, rng);
          world.step(DSM_DT, inputs);
          input.jump = false;
        }
        const events = world.drainEvents();
        if (events.length > 0) {
          scene.handle(events, focus);
          const mp = me();
          for (const e of events) {
            if (e.type === 'step' && e.id === 'me') dsmSfx.step();
            else if (e.type === 'break') {
              const t = world.tile(e.layer, e.q, e.r);
              if (t) dsmSfx.crumble(Math.max(0, 1 - Math.hypot(t.x - mp.x, t.z - mp.z) / 22));
            } else if (e.type === 'land' && e.id === 'me') dsmSfx.land(e.layer > 0);
            else if (e.type === 'fall' && e.id === 'me') {
              dsmSfx.fall();
              say(`Você caiu para a camada ${e.layer + 1}`);
            } else if (e.type === 'wave') {
              dsmSfx.wave();
              say('Onda de queda!');
            } else if (e.type === 'dead') {
              dsmSfx.dead(e.id === 'me');
              if (e.id === 'me') {
                say('Você foi eliminado. Assista os outros!');
                const list = focusList();
                focus = (list[0] as { id: string } | undefined)?.id ?? 'me';
                spectate.current.index = 0;
              } else if (e.id === focus) {
                const list = focusList();
                focus = (list[0] as { id: string } | undefined)?.id ?? 'me';
              }
            }
          }
        }
      }
      scene.render(dt, focus);
      if (world.ended && phase !== 'over') {
        phase = 'over';
        const st = world.standings();
        dsmSfx.win(world.winnerId === 'me');
        setResult({
          winnerId: world.winnerId ?? '',
          standings: st.map((p) => ({ id: p.id, name: p.name, you: p.id === 'me' })),
          seconds: world.t,
        });
      }
      if (now - hudAt > 120) {
        hudAt = now;
        const m = me();
        const watching = !m.alive ? (world.players.find((p) => p.id === focus)?.name ?? '') : '';
        setHud({
          alive: world.alivePlayers().length,
          total: world.players.length,
          layer: Math.max(1, (m.grounded ? m.layer : Math.max(0, m.deepest)) + 1),
          phase,
          count: 0,
          note,
          dead: !m.alive,
          watching,
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.detach();
      scene.dispose();
      if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    };
  }, [bots, controls]);

  const knob = stick
    ? (() => {
        const dx = stick.x - stick.ox;
        const dy = stick.y - stick.oy;
        const len = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, len / STICK_RADIUS);
        return { x: (dx / len) * k * STICK_RADIUS, y: (dy / len) * k * STICK_RADIUS };
      })()
    : null;

  return (
    <div className="dsm-play" data-testid="dsm-play">
      <canvas ref={canvas} className="dsm-canvas" aria-label="Arena do Desmorona!" />
      <div ref={zone} className="dsm-zone" aria-hidden="true">
        {stick && knob && (
          <div className="dsm-stick" style={{ left: stick.ox, top: stick.oy }}>
            <i className="dsm-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
          </div>
        )}
      </div>
      <div className="dsm-hud">
        <div className="dsm-pill" role="status">
          Vivos <b>{hud.alive}</b>/{hud.total}
        </div>
        <div className="dsm-pill is-layer">
          Camada <b>{hud.layer}</b>/{DSM_LAYERS}
        </div>
        <button type="button" className="dsm-exit" onClick={onExit}>
          Sair
        </button>
      </div>
      {hud.phase === 'ready' && (
        <div className="dsm-count" aria-live="assertive">
          {hud.count > 0 ? hud.count : 'Já!'}
        </div>
      )}
      {hud.note && hud.phase !== 'ready' && <div className="dsm-note">{hud.note}</div>}
      {hud.dead && !result && (
        <div className="dsm-spec">
          <button type="button" onClick={() => api.current?.next(-1)} aria-label="Raposa anterior">
            ‹
          </button>
          <span>
            Assistindo <b>{hud.watching}</b>
          </span>
          <button type="button" onClick={() => api.current?.next(1)} aria-label="Próxima raposa">
            ›
          </button>
        </div>
      )}
      {!hud.dead && hud.phase !== 'over' && (
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
      )}
      {result && (
        <div className="dsm-over" role="dialog" aria-modal="true" aria-label="Resultado">
          <div className="dsm-over-card">
            <h2>{result.winnerId === 'me' ? 'Você venceu!' : `${result.standings[0]?.name ?? 'Alguém'} venceu`}</h2>
            <ol>
              {result.standings.map((s, i) => (
                <li key={s.id} className={s.you ? 'is-you' : ''}>
                  <span>{i + 1}º</span> {s.name}
                  {s.you ? ' (você)' : ''}
                </li>
              ))}
            </ol>
            <div className="dsm-over-btns">
              <button type="button" className="dsm-btn" onClick={onAgain} data-testid="dsm-again">
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
