import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  GP_DNF_SEC,
  GP_DT,
  GP_LAPS,
  GP_LIGHTS,
  GP_LIGHTS_HOLD,
  GP_LIGHT_SEC,
  GP_QUALI_MAX_SEC,
  GP_ROOM_LIGHTS_MS,
  GP_VMAX,
  GpWorld,
  createRng,
  gpBotInput,
  gpGear,
  gpKmh,
  newGpBotMemory,
  type GpBotMemory,
  type GpInput,
  type GpPlayerInfo,
} from '@nocap/games';
import { GameChat } from '@/components/GameChat';
import { GameMenu, GearButton, Keycap, NetBadge } from '@/components/GameMenu';
import { GameTips, type TipRow } from '@/components/GameTips';
import { PauseOverlay } from '@/components/PauseOverlay';
import { RotateHint } from '@/components/RotateHint';
import { gameChatOpen } from '@/lib/game-chat-state';
import { gpSfx } from '@/lib/foxgp-audio';
import { currentRtt, gameNow, sendRoom, sendRoomQuiet, serverNow, subscribeRoom } from '@/lib/rooms';
import { GpFinal, type GpFinalRow } from './GpFinal';
import { GpControls } from './gp-controls';
import { GpScene } from './GpScene';
import { css, gapText, lapClock, raceClock } from './format';
import './foxgp.css';

/** Cores das raposas no treino (a primeira é a sua, se você não escolher outra). */
export const GP_FURS = [0xff7d26, 0xb98cff, 0x4fc3f7, 0x7be07b, 0xffd23f, 0xff6f91, 0xf5f5f5, 0x8d6e63];
const BOT_NAMES = ['Faísca', 'Pipoca', 'Trufa', 'Ruivo', 'Brisa', 'Nuvem', 'Cacau'];
const COUNT_SEC = 3.2;
const GRID_SEC = 3.6;
const TIPS_KEY = 'nocap-gp-tips';
const POS_EVERY_MS = 66;
const SMOOTH = 12;

const tipRows = (touch: boolean): TipRow[] =>
  touch
    ? [
        { keys: <b className="gm-tag">‹ ›</b>, text: 'Botões da esquerda: virar' },
        { keys: <b className="gm-tag">Acelera</b>, text: 'Botão grande da direita; o Freio fica ao lado (segure parado para dar ré)' },
        { keys: <b className="gm-tag">Turbo</b>, text: 'Ande no vácuo de outro carro até a barra encher e toque em Turbo' },
        { keys: <b className="gm-tag">Box</b>, text: 'Entre na faixa do box e pare na vaga amarela: pneus novos em 3 s' },
        { keys: <b className="gm-tag">Menu</b>, text: 'Botão Menu: comandos, som e sair' },
      ]
    : [
        {
          keys: (
            <>
              <Keycap k="W" touchHide={false} />
              <Keycap k="S" touchHide={false} />
            </>
          ),
          text: 'Acelerar e frear (parado, S dá ré). Setas também valem',
        },
        {
          keys: (
            <>
              <Keycap k="A" touchHide={false} />
              <Keycap k="D" touchHide={false} />
            </>
          ),
          text: 'Virar',
        },
        {
          keys: <Keycap k="Espaço" wide touchHide={false} />,
          text: 'Turbo da cauda: enche no vácuo de outro carro',
        },
        { keys: <b className="gm-tag">Box</b>, text: 'Pare na vaga amarela do box: pneus novos em 3 s' },
        { keys: <Keycap k="Esc" touchHide={false} />, text: 'Menu: comandos, som e sair' },
        { keys: <Keycap k="T" touchHide={false} />, text: 'Chat da sala (em sala)' },
      ];

type Stage = 'count' | 'quali' | 'grid' | 'lights' | 'race' | 'over';

/** Partida em sala: a seed, quem corre (na ordem das vagas) e quem sou eu (vazio = só assistindo). */
export interface GpOnline {
  seed: string;
  meId: string;
  infos: GpPlayerInfo[];
}

/** O que a sala diz agora (muda a cada estado novo). */
export interface GpRoomLive {
  stage: 'quali' | 'grid' | 'race' | null;
  qualiAt: number | null;
  raceAt: number | null;
  grid: string[];
  quali: Record<string, number | null>;
  finish: Record<string, number>;
  gone: string[];
  firstFinishAt: number | null;
}

interface Row {
  id: string;
  name: string;
  color: string;
  gap: string;
  you: boolean;
  done: boolean;
  out: boolean;
}

interface Hud {
  stage: Stage;
  count: number;
  lit: number;
  pos: number;
  total: number;
  lap: number;
  raceMs: number;
  lapMs: number;
  best: number | null;
  kmh: number;
  gear: number;
  bar: number;
  turbo: boolean;
  wear: number;
  pit: number;
  rows: Row[];
  note: string;
  qualiLeft: number;
  qualiMs: number | null;
  qualiRun: number | null;
  done: number | null;
  dnfLeft: number | null;
  watching: string;
  grid: { id: string; name: string; color: string; ms: number | null; you: boolean }[];
}

const seedOf = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

/** Uma partida do Fox GP: treino contra bots ou corrida em sala. */
export function GpPlay({
  bots = 0,
  color = GP_FURS[0]!,
  online,
  live,
  onExit,
  onAgain,
  onOfflineInvite,
}: {
  bots?: number;
  /** Cor do seu pelo no treino. */
  color?: number;
  online?: GpOnline;
  live?: GpRoomLive;
  onExit: () => void;
  onAgain?: () => void;
  onOfflineInvite?: () => void;
}) {
  const liveRef = useRef<GpRoomLive | undefined>(live);
  liveRef.current = live;
  const canvas = useRef<HTMLCanvasElement>(null);
  const mini = useRef<HTMLCanvasElement>(null);
  const controls = useMemo(() => new GpControls(), []);
  const [hud, setHud] = useState<Hud | null>(null);
  const [result, setResult] = useState<GpFinalRow[] | null>(null);
  const [extra, setExtra] = useState<{ fastest: string; passes: string } | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(false);
  menuRef.current = menu;
  const api = useRef<{ next: (d: number) => void } | null>(null);
  const touchDevice = useMemo(
    () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    [],
  );
  const [showNet, setShowNet] = useState(() => {
    try {
      return localStorage.getItem('nocap-gp-net') !== '0';
    } catch {
      return true;
    }
  });
  const [ping, setPing] = useState(0);
  useEffect(() => {
    if (!online || !showNet) return undefined;
    const t = window.setInterval(() => setPing(Math.round(currentRtt())), 1000);
    return () => window.clearInterval(t);
  }, [online, showNet]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && !menuRef.current && !gameChatOpen()) setMenu(true);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return undefined;
    const meId = online ? online.meId : 'me';
    const infos: GpPlayerInfo[] = online?.infos ?? [
      { id: 'me', name: 'Você', color },
      ...Array.from({ length: bots }, (_, i) => ({
        id: `bot${i}`,
        name: BOT_NAMES[i] ?? `Raposa ${i + 1}`,
        color: GP_FURS.filter((c) => c !== color)[i % (GP_FURS.length - 1)]!,
        bot: true,
      })),
    ];
    const seed = online?.seed ?? seedOf();
    const world = new GpWorld(seed, infos);
    if (online) world.goOnline(meId);
    if (import.meta.env.DEV) (window as unknown as { __gp?: GpWorld }).__gp = world;
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new GpScene(el, world, meId, reduced);
    const rng = createRng(`${seed}:bots`);
    const mem = new Map<string, GpBotMemory>(
      world.cars.filter((c) => c.bot).map((c, i) => [c.id, newGpBotMemory(0.83 + ((i * 37) % 13) / 100)]),
    );
    controls.attach();
    gpSfx.engine.start();

    const resize = () => {
      const r = el.getBoundingClientRect();
      scene.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const me = () => world.car(meId);
    const spectator = !me();
    let focus = spectator ? (world.cars[0]?.id ?? '') : meId;
    let stage: Stage = 'count';
    const mountAt = performance.now();
    let gridUntil = 0;
    let lightsAt = 0;
    let litShown = -1;
    let acc = 0;
    let last = performance.now();
    let hudAt = 0;
    let miniAt = 0;
    let raf = 0;
    let note = '';
    let noteUntil = 0;
    let lastPasses = 0;
    let lastCount = 9;
    const say = (text: string, ms = 2600) => {
      note = text;
      noteUntil = performance.now() + ms;
    };
    const others = () => world.cars.filter((c) => !c.gone && c.id !== meId);
    api.current = {
      next: (d) => {
        const list = others();
        if (list.length === 0) return;
        const i = list.findIndex((c) => c.id === focus);
        focus = list[(i + d + list.length) % list.length]!.id;
      },
    };

    // ---- online: posições dos outros ----
    const targets = new Map<
      string,
      { x: number; z: number; h: number; speed: number; prog: number; flags: number; slip: number; wear: number; steer: number; at: number }
    >();
    const unsubs: (() => void)[] = [];
    let posTimer = 0;
    if (online) {
      const idOfSlot = new Map(infos.map((p, i) => [i, p.id]));
      unsubs.push(
        subscribeRoom('pos', (m) => {
          if (!Array.isArray(m)) return;
          for (const row of m as number[][]) {
            const id = idOfSlot.get(row[0] as number);
            if (!id || id === meId) continue;
            targets.set(id, {
              x: row[1]!,
              z: row[2]!,
              h: row[3]!,
              speed: row[4]!,
              prog: row[5]!,
              flags: row[6]!,
              slip: row[7]!,
              wear: row[8]!,
              steer: row[9]!,
              at: performance.now(),
            });
          }
        }),
      );
      posTimer = window.setInterval(() => {
        const c = me();
        if (!c || (stage !== 'quali' && stage !== 'race')) return;
        sendRoomQuiet('gpos', [
          c.x,
          c.z,
          c.h,
          c.speed,
          c.prog,
          (c.turbo > 0 ? 1 : 0) + (c.surface === 'pit' ? 2 : 0),
          c.slip,
          c.wear,
          c.steer,
        ]);
      }, POS_EVERY_MS);
    }
    const driveRemotes = (dt: number, now: number) => {
      const k = 1 - Math.exp(-dt * SMOOTH);
      for (const c of world.cars) {
        if (!c.remote || c.gone) continue;
        const t = targets.get(c.id);
        if (!t) continue;
        const age = Math.min(0.15, (now - t.at) / 1000);
        const tx = t.x + Math.sin(t.h) * t.speed * age;
        const tz = t.z - Math.cos(t.h) * t.speed * age;
        const far = Math.hypot(c.x - tx, c.z - tz) > 8;
        const f = far ? 1 : k;
        const dh = Math.atan2(Math.sin(t.h - c.h), Math.cos(t.h - c.h));
        world.setRemote(c.id, {
          x: c.x + (tx - c.x) * f,
          z: c.z + (tz - c.z) * f,
          h: c.h + dh * (far ? 1 : k),
          speed: t.speed,
          prog: t.prog,
          turbo: (t.flags & 1) === 1,
          pit: (t.flags & 2) === 2,
          slip: t.slip,
          wear: t.wear,
          steer: t.steer,
        });
      }
    };

    /** A fase em que a partida está, e quanto tempo de jogo já passou nela (s). */
    const where = (now: number): { st: Stage; target: number; count: number; lit: number } => {
      if (!online) {
        if (stage === 'count') {
          const left = COUNT_SEC - (now - mountAt) / 1000;
          if (left > 0) return { st: 'count', target: 0, count: Math.ceil(left - 0.2), lit: 0 };
          return { st: 'quali', target: 0, count: 0, lit: 0 };
        }
        if (stage === 'lights') {
          const e = (now - lightsAt) / 1000;
          const out = GP_LIGHTS * GP_LIGHT_SEC + GP_LIGHTS_HOLD;
          if (e >= out) return { st: 'race', target: 0, count: 0, lit: 0 };
          return { st: 'lights', target: 0, count: 0, lit: Math.min(GP_LIGHTS, Math.floor(e / GP_LIGHT_SEC) + 1) };
        }
        return { st: stage, target: 0, count: 0, lit: 0 };
      }
      const l = liveRef.current;
      const gn = gameNow();
      if (!l || l.stage === null || l.qualiAt === null) return { st: 'count', target: 0, count: 3, lit: 0 };
      if (l.stage === 'quali') {
        const left = (l.qualiAt - serverNow()) / 1000;
        if (left > 0) return { st: 'count', target: 0, count: Math.ceil(left - 0.2), lit: 0 };
        return { st: 'quali', target: (gn - l.qualiAt) / 1000, count: 0, lit: 0 };
      }
      const raceAt = l.raceAt ?? gn;
      if (gn < raceAt - GP_ROOM_LIGHTS_MS) return { st: 'grid', target: 0, count: 0, lit: 0 };
      if (gn < raceAt) {
        const e = (gn - (raceAt - GP_ROOM_LIGHTS_MS)) / 1000;
        return { st: 'lights', target: 0, count: 0, lit: Math.min(GP_LIGHTS, Math.floor(e / GP_LIGHT_SEC) + 1) };
      }
      return { st: 'race', target: (gn - raceAt) / 1000, count: 0, lit: 0 };
    };

    const gridRows = () =>
      world.gridOrder().map((id) => {
        const c = world.car(id)!;
        return { id, name: c.name, color: css(c.color), ms: c.qualiMs, you: id === meId };
      });
    let gridShown: Hud['grid'] = [];

    const startRace = () => {
      const l = liveRef.current;
      // online o grid é o da sala (os tempos dos outros só ela tem)
      if (online && l) {
        for (const [id, ms] of Object.entries(l.quali)) {
          const c = world.car(id);
          if (c && id !== meId) c.qualiMs = ms;
        }
      }
      gridShown = gridRows();
      const order = online && l ? l.grid : world.gridOrder();
      if (online && l) {
        const pos = new Map(order.map((id, i) => [id, i]));
        gridShown.sort((a, b) => (pos.get(a.id) ?? 99) - (pos.get(b.id) ?? 99));
      }
      world.beginRace(order);
      scene.setLights(0);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = where(now);
      // ---- troca de fase ----
      const enter = (next: Stage) => {
        if (next === 'quali') {
          gpSfx.go();
          say('Classificação: uma volta lançada. Vale o tempo da linha até a linha.', 3600);
        }
        if ((next === 'grid' || next === 'lights' || next === 'race') && world.phase !== 'race') startRace();
        if (next === 'grid') gridUntil = now + GRID_SEC * 1000;
        if (next === 'lights') {
          lightsAt = now;
          litShown = -1;
        }
        if (next === 'race') {
          scene.setLights(GP_LIGHTS, true);
          gpSfx.go();
          say('Valendo!', 1400);
        }
        stage = next;
      };
      if (online) {
        if (w.st !== stage) enter(w.st);
      } else if (stage === 'count' && w.st === 'quali') enter('quali');
      else if (stage === 'quali' && world.qualiDone()) enter('grid');
      else if (stage === 'grid' && now >= gridUntil) enter('lights');
      else if (stage === 'lights' && w.st === 'race') enter('race');
      if (w.st === 'count' && w.count !== lastCount) {
        lastCount = w.count;
        if (w.count >= 1 && w.count <= 3) gpSfx.count(w.count);
      }
      if (stage === 'lights' && w.lit !== litShown) {
        litShown = w.lit;
        scene.setLights(w.lit);
        if (w.lit > 0) gpSfx.light();
      }

      // ---- simulação ----
      const driving = stage === 'quali' || stage === 'race';
      if (driving && !world.ended && !document.hidden) {
        if (online) {
          acc = Math.min(Math.max(0, w.target - world.t), 1);
          driveRemotes(dt, now);
          const l = liveRef.current;
          if (l) {
            for (const id of l.gone) world.markGone(id);
            if (world.phase === 'race')
              for (const [id, ms] of Object.entries(l.finish)) if (id !== meId) world.applyFinish(id, ms);
          }
        } else if (!menuRef.current) acc += dt;
        const mine = me();
        const input: GpInput =
          mine && !menuRef.current ? controls.read(dt) : { throttle: 0, brake: 0, steer: 0, turbo: false };
        let first = true;
        while (acc >= GP_DT) {
          acc -= GP_DT;
          const inputs: Record<string, GpInput> = {};
          if (mine) inputs[meId] = first ? input : { ...input, turbo: false };
          first = false;
          for (const c of world.cars) if (c.bot) inputs[c.id] = gpBotInput(world, c, mem.get(c.id)!, rng);
          world.step(GP_DT, inputs);
        }
        controls.takeTurbo();
        const events = world.drainEvents();
        if (events.length > 0) {
          scene.handle(events);
          for (const e of events) {
            const mineE = 'id' in e && e.id === meId;
            if (e.type === 'qtime' && mineE) {
              gpSfx.lap(true);
              say(`Seu tempo: ${lapClock(e.ms)}`, 4000);
              if (online) sendRoom('gq', { ms: e.ms });
            } else if (e.type === 'lap' && mineE) {
              const c = me()!;
              gpSfx.lap(c.bestLap === e.ms);
              if (e.lap < GP_LAPS) say(`Volta ${e.lap}: ${lapClock(e.ms)}${c.bestLap === e.ms ? ' · melhor volta' : ''}`);
              if (online) sendRoom('glap', { lap: e.lap, ms: e.ms });
            } else if (e.type === 'finish' && mineE) {
              const c = me()!;
              gpSfx.finish(e.place);
              say(`Você terminou em ${e.place}º! Agora assista os outros.`, 5000);
              controls.enabled = false;
              if (online) sendRoom('gfin', { ms: e.ms, laps: c.laps, passes: c.passes });
              const list = others().filter((o) => !o.finished);
              if (list[0]) focus = list[0].id;
            } else if (e.type === 'turbo' && mineE) gpSfx.turbo();
            else if (e.type === 'ready' && mineE) {
              gpSfx.ready();
              say(touchDevice ? 'Turbo pronto: toque em Turbo' : 'Turbo pronto: aperte Espaço');
            } else if (e.type === 'pitin' && mineE) {
              gpSfx.pitIn();
              say('Box: trocando os pneus...', 3000);
            } else if (e.type === 'pitout' && mineE) {
              gpSfx.pitOut();
              say('Pneus novos!');
            } else if (e.type === 'cut' && mineE) {
              gpSfx.cut();
              say('Cortou caminho: de volta ao último ponto válido');
            } else if (e.type === 'wall' && mineE) gpSfx.wall();
            else if (e.type === 'bump' && (e.a === meId || e.b === meId)) gpSfx.bump(true);
            else if (e.type === 'pass' && mineE) {
              gpSfx.pass();
              say('Ultrapassagem com o turbo!', 1800);
            }
          }
          const c = me();
          if (online && c && c.passes !== lastPasses) {
            lastPasses = c.passes;
            sendRoomQuiet('gstat', { passes: c.passes });
          }
        }
      }
      // o motor do seu carro (ou de quem você assiste)
      const heard = world.car(focus);
      if (heard) {
        const v = Math.abs(heard.speed);
        const gear = gpGear(heard.speed);
        const band = (v / (GP_VMAX * 1.12)) * 8 - (gear - 1);
        gpSfx.engine.update(Math.max(0, Math.min(1, (gear - 1) / 7 * 0.5 + band * 0.5)), heard.braking ? 0 : Math.min(1, v / 8), heard.turbo > 0);
      }
      scene.render(dt, focus);

      // ---- fim (treino) ----
      if (!online && world.ended && stage !== 'over') {
        stage = 'over';
        controls.enabled = false;
        const st = world.standings();
        const fastest = world.fastest;
        const topPass = [...world.cars].sort((a, b) => b.passes - a.passes)[0];
        setExtra({
          fastest: fastest ? `${world.car(fastest.id)?.name ?? ''} · ${lapClock(fastest.ms)}` : '—',
          passes: topPass && topPass.passes > 0 ? `${topPass.name} · ${topPass.passes}` : 'ninguém',
        });
        setResult(
          st.map((r) => ({
            id: r.car.id,
            name: r.car.name,
            color: css(r.car.color),
            you: r.car.id === meId,
            bot: r.car.bot,
            ms: r.car.finishMs,
            best: r.car.bestLap,
            passes: r.car.passes,
            dnf: !r.car.finished,
          })),
        );
      }

      // ---- minimapa ----
      if (now - miniAt > 100 && mini.current) {
        miniAt = now;
        drawMini(mini.current, world, meId, focus);
      }

      // ---- HUD ----
      if (now - hudAt > 110) {
        hudAt = now;
        if (note && now > noteUntil) note = '';
        const c = me();
        const seen = world.car(focus) ?? c;
        const st = world.standings();
        const myRow = st.find((r) => r.car.id === (c ? meId : focus));
        const l = liveRef.current;
        let dnfLeft: number | null = null;
        if (world.phase === 'race') {
          const first = online && l?.firstFinishAt ? (serverNow() - l.firstFinishAt) / 1000 : world.firstFinishT !== null ? world.t - world.firstFinishT : null;
          if (first !== null && first >= 0) dnfLeft = Math.max(0, GP_DNF_SEC - first);
        }
        if (stage === 'grid' && gridShown.length === 0) gridShown = gridRows();
        setHud({
          stage,
          count: w.count,
          lit: w.lit,
          pos: myRow?.pos ?? 0,
          total: world.cars.filter((x) => !x.gone).length,
          lap: Math.min(GP_LAPS, (seen?.laps.length ?? 0) + 1),
          raceMs: world.phase === 'race' && stage === 'race' ? world.t * 1000 : 0,
          lapMs:
            world.phase === 'race'
              ? Math.max(0, (world.t - (seen?.lapStartT ?? 0)) * 1000)
              : seen?.qualiStartT != null && seen.qualiMs === null
                ? (world.t - seen.qualiStartT) * 1000
                : 0,
          best: seen?.bestLap ?? null,
          kmh: gpKmh(seen?.speed ?? 0),
          gear: gpGear(seen?.speed ?? 0),
          bar: c?.bar ?? 0,
          turbo: (c?.turbo ?? 0) > 0,
          wear: c?.wear ?? 0,
          pit: c?.pitHold ?? 0,
          rows: st.map((r) => ({
            id: r.car.id,
            name: r.car.name,
            color: css(r.car.color),
            gap: r.car.gone ? 'fora' : r.pos === 1 ? 'líder' : gapText(r.gap),
            you: r.car.id === meId,
            done: r.car.finished,
            out: r.car.gone || r.car.dnf,
          })),
          note,
          qualiLeft: Math.max(0, GP_QUALI_MAX_SEC - (world.phase === 'quali' ? world.t : 0)),
          qualiMs: c?.qualiMs ?? null,
          qualiRun: c?.qualiStartT != null && c.qualiMs === null ? (world.t - c.qualiStartT) * 1000 : null,
          done: c?.finished ? (st.find((r) => r.car.id === meId)?.pos ?? null) : null,
          dnfLeft,
          watching: focus !== meId ? (world.car(focus)?.name ?? '') : '',
          grid: gridShown,
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(posTimer);
      for (const off of unsubs) off();
      ro.disconnect();
      controls.detach();
      gpSfx.engine.stop();
      scene.dispose();
    };
  }, [bots, color, controls, online, touchDevice]);

  const pad = (k: 'gas' | 'brake' | 'left' | 'right') => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      controls.press(k, true);
    },
    onPointerUp: () => controls.press(k, false),
    onPointerCancel: () => controls.press(k, false),
    onLostPointerCapture: () => controls.press(k, false),
  });

  const h = hud;
  const racing = h?.stage === 'race' || h?.stage === 'over';
  const driving = h && (h.stage === 'quali' || h.stage === 'race') && h.done === null && !result;
  return (
    <div className="gp-play" data-testid="gp-play">
      <canvas ref={canvas} className="gp-canvas" aria-label="Pista do Fox GP" />
      {h && (
        <>
          <div className="gp-top">
            {racing || h.stage === 'grid' || h.stage === 'lights' ? (
              <div className="gp-pill gp-pos" role="status" data-testid="gp-pos">
                <small>POS</small>
                <b>P{h.pos || '-'}</b>/{h.total}
              </div>
            ) : (
              <div className="gp-pill gp-pos" role="status">
                <small>CLASSIFICAÇÃO</small>
                <b>{Math.ceil(h.qualiLeft)}s</b>
              </div>
            )}
            {racing && (
              <div className="gp-pill" data-testid="gp-lap">
                <small>VOLTA</small>
                <b>{h.lap}</b>/{GP_LAPS}
              </div>
            )}
            <div className="gp-pill gp-clock">
              <small>{racing ? 'TEMPO' : 'VOLTA LANÇADA'}</small>
              <b className="mono">
                {racing
                  ? raceClock(h.raceMs)
                  : h.qualiMs !== null
                    ? lapClock(h.qualiMs)
                    : h.qualiRun !== null
                      ? lapClock(h.qualiRun)
                      : '--:--.---'}
              </b>
            </div>
            <div className="gp-top-end">
              <GearButton onClick={() => setMenu(true)} testId="gp-menu-btn" />
            </div>
          </div>

          {(racing || h.stage === 'quali') && h.rows.length > 1 && (
            <ol className="gp-board" aria-label="Classificação ao vivo" data-testid="gp-board">
              {h.rows.map((r, i) => (
                <li key={r.id} className={`${r.you ? 'is-you' : ''}${r.out ? ' is-out' : ''}`}>
                  <span className="gp-board-pos">{i + 1}</span>
                  <i style={{ background: r.color }} aria-hidden="true" />
                  <span className="gp-board-name">{r.you ? 'Você' : r.name}</span>
                  {racing && <span className="gp-board-gap mono">{r.done ? 'chegou' : r.gap}</span>}
                </li>
              ))}
            </ol>
          )}

          <canvas ref={mini} className="gp-mini" width={180} height={150} aria-hidden="true" />

          {h.stage === 'count' && (
            <div className="gp-center" aria-live="assertive">
              <small>Classificação</small>
              <b>{h.count > 0 ? h.count : 'Já!'}</b>
            </div>
          )}
          {h.stage === 'grid' && (
            <div className="gp-grid" data-testid="gp-grid">
              <h2>Grid de largada</h2>
              <ol>
                {h.grid.map((g, i) => (
                  <li key={g.id} className={g.you ? 'is-you' : ''}>
                    <span>{i + 1}º</span>
                    <i style={{ background: g.color }} aria-hidden="true" />
                    <b>{g.you ? 'Você' : g.name}</b>
                    <span className="mono">{g.ms !== null ? lapClock(g.ms) : 'sem tempo'}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {h.stage === 'lights' && (
            <div className="gp-lights" aria-label={`${h.lit} luzes acesas`} data-testid="gp-lights">
              {Array.from({ length: GP_LIGHTS }, (_, i) => (
                <i key={i} className={i < h.lit ? 'is-on' : ''} />
              ))}
            </div>
          )}
          {h.note && h.stage !== 'count' && <div className="gp-note">{h.note}</div>}
          {h.dnfLeft !== null && h.done === null && racing && (
            <div className="gp-dnf" role="status">
              O primeiro já chegou: <b>{Math.ceil(h.dnfLeft)}s</b> para cruzar a linha
            </div>
          )}
          {h.pit > 0 && (
            <div className="gp-pit" role="status">
              Box: <b>{h.pit.toFixed(1)}s</b>
            </div>
          )}

          {(h.done !== null || h.watching) && !result && (
            <div className="gp-spec">
              <button type="button" onClick={() => api.current?.next(-1)} aria-label="Carro anterior">
                ‹
              </button>
              <span>
                {h.done !== null ? `Você chegou em ${h.done}º · ` : ''}Assistindo <b>{h.watching || '...'}</b>
              </span>
              <button type="button" onClick={() => api.current?.next(1)} aria-label="Próximo carro">
                ›
              </button>
            </div>
          )}

          {driving && (
            <div className="gp-dash" data-testid="gp-dash">
              <div className="gp-speed">
                <b className="mono" data-testid="gp-kmh">{h.kmh}</b>
                <small>km/h</small>
                <span className="gp-gear mono">{h.gear === 0 ? 'R' : h.gear}</span>
              </div>
              <div className="gp-meter" data-full={h.bar >= 1 ? '1' : '0'} data-on={h.turbo ? '1' : '0'}>
                <small>{h.turbo ? 'TURBO!' : h.bar >= 1 ? 'TURBO PRONTO' : 'TURBO DA CAUDA'}</small>
                <span>
                  <i style={{ transform: `scaleX(${h.turbo ? 1 : h.bar})` }} />
                </span>
              </div>
              <div className="gp-meter is-tyre" data-low={h.wear > 0.7 ? '1' : '0'}>
                <small>PNEUS {Math.round((1 - h.wear) * 100)}%</small>
                <span>
                  <i style={{ transform: `scaleX(${1 - h.wear})` }} />
                </span>
              </div>
            </div>
          )}

          {touchDevice && driving && (
            <div className="gp-pads">
              <div className="gp-pads-l">
                <button type="button" className="gp-pad" aria-label="Virar para a esquerda" {...pad('left')}>
                  ‹
                </button>
                <button type="button" className="gp-pad" aria-label="Virar para a direita" {...pad('right')}>
                  ›
                </button>
              </div>
              <div className="gp-pads-r">
                <button
                  type="button"
                  className="gp-pad is-turbo"
                  data-ready={h.bar >= 1 ? '1' : '0'}
                  aria-label="Turbo"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    controls.pressTurbo();
                  }}
                >
                  Turbo
                </button>
                <button type="button" className="gp-pad is-brake" aria-label="Frear" {...pad('brake')}>
                  Freio
                </button>
                <button type="button" className="gp-pad is-gas" aria-label="Acelerar" {...pad('gas')}>
                  Acelera
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {online && showNet && !result && (
        <NetBadge mode="servidor" items={[{ text: `${ping} ms`, title: 'ida e volta até o servidor' }]} />
      )}
      {!result && <RotateHint />}
      {h?.stage === 'count' && !result && (
        <GameTips storageKey={TIPS_KEY} rows={tipRows(touchDevice)} testId="gp-tips" markOnShow />
      )}
      <GameChat enabled={!!online && !result} />
      {online && !result && <PauseOverlay />}
      {menu && !result && (
        <GameMenu
          title="Menu"
          testPrefix="gp-menu"
          tipsKey={TIPS_KEY}
          tips={tipRows(touchDevice)}
          online={!!online}
          net={
            online
              ? {
                  on: showNet,
                  toggle: () =>
                    setShowNet((v) => {
                      try {
                        localStorage.setItem('nocap-gp-net', v ? '0' : '1');
                      } catch {
                        /* sem armazenamento: vale só nesta partida */
                      }
                      return !v;
                    }),
                }
              : undefined
          }
          onClose={() => setMenu(false)}
          onExit={onExit}
          onOfflineInvite={onOfflineInvite}
          endMatch={{ label: 'Encerrar a partida', onClick: () => sendRoom('gend'), testId: 'gp-menu-end' }}
          actions={[]}
        />
      )}
      {result && !online && (
        <GpFinal
          rows={result}
          fastest={extra?.fastest ?? '—'}
          passes={extra?.passes ?? '—'}
          mode={{ kind: 'training', onAgain, onExit }}
        />
      )}
    </div>
  );
}

/** O minimapa: a pista inteira em linha e um ponto por carro (o seu maior, com anel). */
function drawMini(cv: HTMLCanvasElement, world: GpWorld, meId: string, focus: string) {
  const g = cv.getContext('2d');
  if (!g) return;
  const tr = world.track;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < tr.n; i += 4) {
    minX = Math.min(minX, tr.x[i]!);
    maxX = Math.max(maxX, tr.x[i]!);
    minZ = Math.min(minZ, tr.z[i]!);
    maxZ = Math.max(maxZ, tr.z[i]!);
  }
  const pad = 10;
  const k = Math.min((cv.width - pad * 2) / (maxX - minX), (cv.height - pad * 2) / (maxZ - minZ));
  const ox = (cv.width - (maxX - minX) * k) / 2;
  const oz = (cv.height - (maxZ - minZ) * k) / 2;
  const X = (x: number) => ox + (x - minX) * k;
  const Z = (z: number) => oz + (z - minZ) * k;
  g.clearRect(0, 0, cv.width, cv.height);
  g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i <= tr.n; i += 3) {
    const j = i % tr.n;
    if (i === 0) g.moveTo(X(tr.x[j]!), Z(tr.z[j]!));
    else g.lineTo(X(tr.x[j]!), Z(tr.z[j]!));
  }
  g.closePath();
  g.strokeStyle = '#1b1535';
  g.lineWidth = 9;
  g.stroke();
  g.strokeStyle = '#f4f1ff';
  g.lineWidth = 5;
  g.stroke();
  // linha de chegada
  g.fillStyle = '#1b1535';
  g.fillRect(X(tr.x[0]!) - 1.5, Z(tr.z[0]!) - 6, 3, 12);
  for (const c of world.cars) {
    if (c.gone) continue;
    const big = c.id === meId || c.id === focus;
    g.beginPath();
    g.arc(X(c.x), Z(c.z), big ? 5.5 : 4, 0, Math.PI * 2);
    g.fillStyle = css(c.color);
    g.fill();
    g.lineWidth = big ? 2.5 : 1.5;
    g.strokeStyle = c.id === meId ? '#ff2a5a' : '#1b1535';
    g.stroke();
  }
}
