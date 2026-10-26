import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BOL_DT,
  BOL_TEAM_COLORS,
  BOL_TEAM_NAMES,
  BolPredictor,
  BolWorld,
  bolBotInput,
  createRng,
  newBolBotMemory,
  type BolEvent,
  type BolInfo,
  type BolInput,
} from '@nocap/games';
import { bolaGain, bolaSfx, crowdStart, crowdStop, crowdSwell } from '@/lib/bola-audio';
import { sendRoom, sendRoomQuiet, serverNow, subscribeRoom, useRoom } from '@/lib/rooms';
import { DsmControls, STICK_RADIUS } from '../desmorona/controls';
import '../desmorona/desmorona.css';
import './bola.css';
import { BolaMenu } from './BolaMenu';
import { BolaTips } from './BolaTips';
import { BolaTeams } from './BolaTeams';
import { BolaScene } from './BolaScene';
import { BolaStats, type StatRow } from './BolaStats';

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

/** Quem está em campo (vem do estado da sala): a vaga no fluxo, o corpo e o time. */
export interface BolaRosterRow {
  slot: number;
  id: string;
  name: string;
  team: number;
  bot: boolean;
  away: boolean;
}

export interface BolaOnline {
  meId: string;
  roster: BolaRosterRow[];
}

/** Um quadro do fluxo "bs" da sala (ver `BolaRoomEngine.drainFrame`). */
interface NetFrame {
  /** Hora do servidor (ms) do estado. */
  t?: number;
  ph: 'c' | 'p' | 'g' | 'o';
  tm: number;
  ck: number;
  sc: number[];
  gd: number;
  gs?: number;
  b: number[];
  p: number[][];
  ev: Record<string, unknown>[];
  st?: { r: number[][]; po: number[]; ce: number };
}

interface Hud {
  phase: 'countdown' | 'play' | 'goal' | 'over';
  count: number;
  /** Segundos mostrados: o que falta (regressivo) ou, na prorrogação, o tempo desde o início dela. */
  clock: number;
  scores: number[];
  golden: boolean;
  feed: { id: number; text: string; team: number }[];
  warn: string;
  winner: number;
  ballCam: boolean;
  banner: { title: string; sub: string; team: number; id: number } | null;
  /** Sobe a cada gol: reinicia o brilho da tela. */
  flash: number;
  myTeam: number;
  rows: StatRow[];
  possession: number[];
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

/** Treino do Fut Fox: você contra bots. O motor roda no aparelho; a sala online usa o mesmo motor no servidor. */
export function BolaPlay({
  setup,
  online,
  onExit,
  onAgain,
  onEnd,
}: {
  setup: BolaSetup;
  /** Partida em sala: o servidor simula; aqui só desenha e manda a entrada. */
  online?: BolaOnline;
  onExit: () => void;
  onAgain?: () => void;
  /** Só o líder da sala: encerra a partida. */
  onEnd?: () => void;
}) {
  const rosterRef = useRef<BolaRosterRow[]>(online?.roster ?? []);
  rosterRef.current = online?.roster ?? rosterRef.current;
  const meId = online?.meId ?? 'me';
  const canvas = useRef<HTMLCanvasElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const controls = useMemo(() => new DsmControls(), []);
  const camToggle = useRef<() => void>(() => undefined);
  const switchTeam = useRef<(team: number, botId?: string | null) => string | null>(() => null);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [crash, setCrash] = useState<string | null>(null);
  const [tabHeld, setTabHeld] = useState(false);
  const [pinned, setPinned] = useState(false);
  const statsOn = useRef(false);
  statsOn.current = tabHeld || pinned || menu || teamsOpen;
  const uiOpenRef = useRef(false);
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
    flash: 0,
    myTeam: 0,
    rows: [],
    possession: [],
  });

  useEffect(() => {
    const el = canvas.current;
    const zoneEl = zone.current;
    if (!el || !zoneEl) return undefined;
    const infos: BolInfo[] = online
      ? rosterRef.current.map((r) => ({
          id: r.id,
          name: r.name,
          color: BOL_TEAM_COLORS[r.team] as number,
          team: r.team,
          bot: r.bot || undefined,
        }))
      : bolaRoster(setup);
    const world = new BolWorld(infos, {
      teams: setup.teams,
      perTeam: setup.perTeam,
      durationSec: setup.minutes * 60,
    });
    // pacote de jogos antigo (sem o motor novo): avisa em vez de travar
    if (!Array.isArray(world.possession) || typeof world.becomeBot !== 'function') {
      setCrash('O pacote de jogos está desatualizado. Rode pnpm build e reinicie o pnpm dev.');
      return undefined;
    }
    if (import.meta.env.DEV) (window as unknown as { __bola?: BolWorld }).__bola = world;
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new BolaScene(el, world, reduced);
    if (import.meta.env.DEV) (window as unknown as { __bolaScene?: BolaScene }).__bolaScene = scene;
    const rng = createRng(`bola:${Math.random()}`);
    crowdStart();
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
    if (root.current) {
      // Esc solta o mouse: abre as configurações, onde ficam os botões
      controls.attachLook(root.current, (locked) => {
        if (!locked && !uiOpenRef.current) setMenu(true);
      });
    }
    let ballCam = true;
    let yaw = 0;
    let camYaw = 0;
    let pitch = 0.5;
    let turnKick = 0;
    if (import.meta.env.DEV)
      (window as unknown as { __bolaTurn?: (d: number) => void }).__bolaTurn = (d) =>
        (turnKick += d);
    camToggle.current = () => {
      ballCam = !ballCam;
      if (!ballCam) yaw = camYaw;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && !e.repeat) camToggle.current();
      if (e.code === 'Tab') {
        // Tab mostra as estatísticas enquanto estiver apertado
        e.preventDefault();
        if (!e.repeat) setTabHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') setTabHeld(false);
    };
    const onBlur = () => setTabHeld(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    let feedId = 0;
    let feed: Hud['feed'] = [];
    let warn = '';
    let warnTimer = 0;
    let bannerTimer = 0;
    let flashId = 0;
    let banner: Hud['banner'] = null;
    const push = (text: string, team: number) => {
      feed = [...feed.slice(-3), { id: feedId++, text, team }];
      window.setTimeout(() => {
        feed = feed.filter((f) => f.text !== text);
      }, 4200);
    };
    const nameOf = (id: string | null) => world.players.find((p) => p.id === id)?.name ?? 'Alguém';

    /** Volume de um som pela distância até a sua raposa (ou até a bola, se você só assiste). */
    const gainAt = (x: number, z: number) => {
      const m = world.player(meId);
      const ref = m ?? world.ball;
      return bolaGain(Math.hypot(x - ref.x, z - ref.z));
    };
    const onEvent = (e: BolEvent) => {
      switch (e.type) {
        case 'kick': {
          const g = gainAt(world.ball.x, world.ball.z);
          bolaSfx.kick(g);
          scene.kickFx(e.id, online ? (ballT ?? undefined) : undefined, e.id === meId);
          break;
        }
        case 'touch':
          if (e.power >= 3) bolaSfx.touch(e.power, gainAt(world.ball.x, world.ball.z));
          break;
        case 'bounce':
          bolaSfx.bounce(e.power, gainAt(world.ball.x, world.ball.z));
          break;
        case 'wall':
          bolaSfx.wall(e.power, gainAt(world.ball.x, world.ball.z));
          break;
        case 'jump':
          // online, o seu próprio pulo já soou na hora em que você apertou
          if (!(online && e.id === meId)) {
            const p = world.player(e.id);
            bolaSfx.jump(p ? gainAt(p.x, p.z) * (e.id === meId ? 1 : 0.6) : 0.5);
          }
          break;
        case 'airjump':
          if (!(online && e.id === meId)) {
            const p = world.player(e.id);
            bolaSfx.airjump(e.flip, p ? gainAt(p.x, p.z) * (e.id === meId ? 1 : 0.6) : 0.5);
            scene.jumpFx(e.id, e.flip);
          }
          break;
        case 'goal':
          bolaSfx.goal(e.own);
          crowdSwell(e.own ? 0.1 : 0.3);
          break;
        case 'nogoal':
          bolaSfx.noGoal();
          break;
        case 'warn':
          bolaSfx.warn();
          break;
        case 'golden':
          bolaSfx.golden();
          break;
        case 'ballreset':
          bolaSfx.reset();
          break;
        default:
          break;
      }
      if (e.type === 'goal') {
        const tn = (t: number) => BOL_TEAM_NAMES[t] ?? '';
        let title = 'GOL!';
        let sub = `${nameOf(e.scorerId)} · time ${tn(e.scorerTeam)}`;
        if (e.noTouch) {
          title = `GOL CONTRA DO TIME ${tn(e.goalTeam).toUpperCase()}`;
          sub = `Ninguém tocou na bola · ponto para o time ${tn(e.scorerTeam)}`;
        } else if (e.own) {
          title = 'GOL CONTRA';
          sub = `${nameOf(e.ownerId)} (${tn(e.goalTeam)}) · ponto para o time ${tn(e.scorerTeam)}`;
        }
        push(`${title} · ${sub}`, e.scorerTeam);
        banner = { title, sub, team: e.scorerTeam, id: feedId++ };
        window.clearTimeout(bannerTimer);
        bannerTimer = window.setTimeout(() => {
          banner = null;
        }, 4800);
        scene.shakeNow(0.6);
        scene.celebrate(e.goalTeam, BOL_TEAM_COLORS[e.scorerTeam] as number);
        flashId++;
      } else if (e.type === 'nogoal') {
        banner = {
          title: 'SEM GOL',
          sub: e.ownerId
            ? `Gol contra de ${nameOf(e.ownerId)} e ninguém de outro time tocou na bola: a bola volta ao centro`
            : 'Ninguém tocou na bola: a bola volta ao centro',
          team: -1,
          id: feedId++,
        };
        window.clearTimeout(bannerTimer);
        bannerTimer = window.setTimeout(() => {
          banner = null;
        }, 3500);
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
    };

    let botN = world.players.length;
    const botMemory = (p: { team: number }, i: number) =>
      newBolBotMemory(
        (p.team + 1 + (i % Math.max(1, setup.teams - 1))) % setup.teams,
        0.2 + (i % 3) * 0.05,
      );
    /** Troca de time (ou vira espectador): o corpo antigo vira bot e, no time novo, você assume o lugar de um bot. */
    switchTeam.current = (team, botId = null) => {
      if (online) {
        // a sala decide; erros (time cheio, bot que já saiu) voltam como aviso
        sendRoom('bteam', { team, bot: botId ?? undefined });
        return null;
      }
      const cur = world.player(meId);
      if (cur && cur.team === team) return null;
      if (!cur && team < 0) return null;
      if (team >= 0) {
        if (botId) {
          if (!world.players.some((p) => p.bot && p.team === team && p.id === botId))
            return 'Esse bot já saiu do lugar: escolha outro';
        } else if (world.players.filter((p) => p.team === team).length >= setup.perTeam) {
          return `O time ${BOL_TEAM_NAMES[team]} não tem vaga livre: entre no lugar de um bot`;
        }
      }
      if (cur) {
        const id = `bot${botN}`;
        world.becomeBot(meId, id, BOT_NAMES[botN % BOT_NAMES.length] as string);
        mem.set(id, botMemory(cur, botN));
        botN++;
      }
      if (team >= 0) {
        const info: BolInfo = {
          id: meId,
          name: 'Você',
          color: BOL_TEAM_COLORS[team] as number,
          team,
        };
        const bot = botId
          ? world.players.find((p) => p.bot && p.team === team && p.id === botId)
          : undefined;
        if (bot) {
          mem.delete(bot.id);
          world.takeOver(bot.id, info);
        } else world.addPlayer(info);
      }
      scene.sync();
      return null;
    };

    const resize = () => {
      const r = el.getBoundingClientRect();
      scene.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // ---- online: o servidor simula; aqui o estado dele é suavizado e a entrada é enviada ----
    interface Tgt {
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      h: number;
      fl: number;
      at: number;
    }
    const unsubs: (() => void)[] = [];
    /** Estados recentes do servidor: os outros e a bola são desenhados um instante no passado, entre dois deles. */
    interface NetSnap {
      t: number;
      ball: Tgt;
      rows: Map<number, Tgt>;
    }
    const snaps: NetSnap[] = [];
    let ballT: Tgt | null = null;
    let slotId = new Map<number, string>();
    let slotOf = new Map<string, number>();
    let rosterKey = '';
    let rosterSeen: unknown = null;
    let jumps = 0;
    let seq = 0;
    let sentInput = { mx: 0, mz: 0 };
    const idOfSlot = (s: unknown) => (typeof s === 'number' ? (slotId.get(s) ?? null) : null);
    const syncRoster = () => {
      const roster = rosterRef.current;
      // a lista só muda quando chega um estado novo da sala: o mesmo objeto não precisa ser comparado de novo
      if (roster === rosterSeen) return;
      rosterSeen = roster;
      const key = JSON.stringify(roster.map((r) => [r.slot, r.id, r.team, r.bot]));
      if (key === rosterKey) return;
      rosterKey = key;
      const saved = new Map(world.players.map((p) => [p.id, [p.x, p.y, p.z] as const]));
      const ids = new Set(roster.map((r) => r.id));
      for (const p of [...world.players]) if (!ids.has(p.id)) world.removePlayer(p.id);
      for (const r of roster) {
        const cur = world.player(r.id);
        if (cur) {
          cur.name = r.name;
          cur.team = r.team;
          cur.bot = r.bot;
        } else {
          world.addPlayer({
            id: r.id,
            name: r.name,
            color: BOL_TEAM_COLORS[r.team] as number,
            team: r.team,
            bot: r.bot || undefined,
          });
        }
      }
      // entrar na lista reposiciona o time no motor: devolve cada corpo onde estava
      for (const p of world.players) {
        const pos = saved.get(p.id);
        if (pos) [p.x, p.y, p.z] = pos;
      }
      slotId = new Map(roster.map((r) => [r.slot, r.id]));
      slotOf = new Map(roster.map((r) => [r.id, r.slot]));
      scene.sync();
    };
    const toEvent = (e: Record<string, unknown>): BolEvent | null => {
      switch (e.t) {
        case 'goal':
          return {
            type: 'goal',
            goalTeam: e.gt as number,
            scorerId: idOfSlot(e.sc),
            scorerTeam: e.st as number,
            own: !!e.own,
            ownerId: idOfSlot(e.ow),
            noTouch: !!e.nt,
            assistId: idOfSlot(e.as),
          };
        case 'nogoal':
          return { type: 'nogoal', goalTeam: e.gt as number, ownerId: idOfSlot(e.ow) };
        case 'warn':
          return { type: 'warn', left: e.l as number };
        case 'golden':
          return { type: 'golden' };
        case 'ballreset':
          return { type: 'ballreset' };
        case 'kick': {
          const id = idOfSlot(e.s);
          return id ? { type: 'kick', id } : null;
        }
        case 'touch': {
          const id = idOfSlot(e.s);
          return id ? { type: 'touch', id, power: e.p as number } : null;
        }
        case 'bounce':
        case 'wall':
          return { type: e.t, power: e.p as number };
        case 'jump': {
          const id = idOfSlot(e.s);
          return id ? { type: 'jump', id } : null;
        }
        case 'airjump': {
          const id = idOfSlot(e.s);
          return id ? { type: 'airjump', id, flip: !!e.f } : null;
        }
        default:
          return null;
      }
    };
    if (online) {
      syncRoster();
      unsubs.push(
        subscribeRoom('bs', (m) => {
          const f = m as NetFrame;
          if (!f || !Array.isArray(f.p)) return;
          syncRoster();
          const at = performance.now();
          const phases = { c: 'countdown', p: 'play', g: 'goal', o: 'over' } as const;
          world.phase = phases[f.ph] ?? world.phase;
          world.timer = f.tm;
          world.clock = f.ck;
          world.golden = f.gd === 1;
          world.goldenStart = f.gs ?? 0;
          world.scores.splice(0, world.scores.length, ...f.sc);
          const ball: Tgt = {
            x: f.b[0]!,
            y: f.b[1]!,
            z: f.b[2]!,
            vx: f.b[3]!,
            vy: f.b[4]!,
            vz: f.b[5]!,
            h: 0,
            fl: 0,
            at,
          };
          ballT = ball;
          const rows = new Map<number, Tgt>();
          for (const r of f.p) {
            rows.set(r[0]!, {
              x: r[1]!,
              y: r[2]!,
              z: r[3]!,
              vx: r[4]!,
              vy: r[5]!,
              vz: r[6]!,
              h: r[7]!,
              fl: r[8]!,
              at,
            });
          }
          snaps.push({ t: typeof f.t === 'number' ? f.t : serverNow(), ball, rows });
          if (snaps.length > 24) snaps.shift();
          if (f.st) {
            world.celebrating = f.st.ce;
            world.possession.splice(0, world.possession.length, ...f.st.po);
            for (const r of f.st.r) {
              const p = world.player(idOfSlot(r[0]) ?? '');
              if (p)
                p.stats = {
                  goals: r[1]!,
                  assists: r[2]!,
                  ownGoals: r[3]!,
                  touches: r[4]!,
                  kicks: r[5]!,
                };
            }
          }
          for (const raw of f.ev) {
            const e = toEvent(raw);
            if (e) onEvent(e);
          }
        }),
      );
      // erros do servidor (time cheio, bot que já saiu...) viram aviso na tela
      unsubs.push(
        useRoom.subscribe((st, prev) => {
          if (st.message && st.message !== prev.message) {
            warn = st.message;
            window.clearTimeout(warnTimer);
            warnTimer = window.setTimeout(() => {
              warn = '';
            }, 3500);
            useRoom.setState({ message: '' });
          }
        }),
      );
    }
    const sendInput = () => {
      if (!online || !world.player(meId)) return;
      sendRoomQuiet('bin', [
        Math.round(sentInput.mx * 100) / 100,
        Math.round(sentInput.mz * 100) / 100,
        jumps,
        ++seq,
      ]);
    };
    const inputTimer = online ? window.setInterval(sendInput, 25) : 0;
    /** Atraso de desenho dos outros e da bola (ms): com um estado a cada 16 ms sobram sempre dois para interpolar. */
    const INTERP_MS = 70;
    const pred = new BolPredictor(world.field);
    let predReady = false;
    let predAcc = 0;
    /** Depois de um aperto o servidor ainda não sabe do pulo: nesse tempo ele não corrige a altura (senão cancelaria o pulo e o mortal). */
    let jumpHold = 0;
    const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
    const smoothOnline = (dt: number, input: { mx: number; mz: number }, pressed: boolean) => {
      syncRoster();
      const last = snaps[snaps.length - 1];
      if (!last) return;
      const rt = serverNow() - INTERP_MS;
      // entre quais dois estados estamos (ou, se faltar estado novo, o último com um pouco de extrapolação)
      let a = last;
      let b = last;
      let u = 0;
      let extra = 0;
      if (rt >= last.t) extra = Math.min(0.12, (rt - last.t) / 1000);
      else {
        a = b = snaps[0] as NetSnap;
        for (let i = snaps.length - 1; i >= 1; i--) {
          const lo = snaps[i - 1] as NetSnap;
          const hi = snaps[i] as NetSnap;
          if (lo.t <= rt) {
            a = lo;
            b = hi;
            u = hi.t > lo.t ? Math.min(1, (rt - lo.t) / (hi.t - lo.t)) : 0;
            break;
          }
        }
      }
      for (const p of world.players) {
        if (p.id === meId && predReady && world.phase !== 'countdown') continue;
        const slot = slotOf.get(p.id);
        const ra = slot === undefined ? undefined : a.rows.get(slot);
        if (!ra) continue;
        const rb = b.rows.get(slot as number) ?? ra;
        p.x = lerp(ra.x, rb.x, u) + ra.vx * extra;
        p.y = Math.max(0, lerp(ra.y, rb.y, u) + ra.vy * extra);
        p.z = lerp(ra.z, rb.z, u) + ra.vz * extra;
        p.vx = ra.vx;
        p.vy = ra.vy;
        p.vz = ra.vz;
        let dh = rb.h - ra.h;
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        p.heading = ra.h + dh * u;
        p.grounded = (ra.fl & 1) === 1;
        p.flipT = (ra.fl & 2) === 2 ? 0.3 : 0;
        p.airJumped = (ra.fl & 4) === 4;
      }
      const ball = world.ball;
      ball.x = lerp(a.ball.x, b.ball.x, u) + a.ball.vx * extra;
      ball.y = Math.max(0.9, lerp(a.ball.y, b.ball.y, u) + a.ball.vy * extra);
      ball.z = lerp(a.ball.z, b.ball.z, u) + a.ball.vz * extra;
      ball.vx = a.ball.vx;
      ball.vy = a.ball.vy;
      ball.vz = a.ball.vz;

      // a própria raposa: roda a mesma conta do servidor aqui (responde na hora) e é puxada de volta se o servidor discordar
      const me = world.player(meId);
      const slot = slotOf.get(meId);
      const row = slot === undefined ? undefined : last.rows.get(slot);
      if (!me || !row) {
        predReady = false;
        return;
      }
      const lead = Math.min(0.25, Math.max(0, (serverNow() - last.t) / 1000));
      const sx = row.x + row.vx * lead;
      const sy = Math.max(0, row.y + row.vy * lead);
      const sz = row.z + row.vz * lead;
      const flags = {
        grounded: (row.fl & 1) === 1,
        flipT: (row.fl & 2) === 2 ? 0.3 : 0,
        airJumped: (row.fl & 4) === 4,
      };
      if (!predReady || world.phase === 'countdown') {
        pred.reset({
          x: row.x,
          y: row.y,
          z: row.z,
          vx: row.vx,
          vy: row.vy,
          vz: row.vz,
          heading: row.h,
          ...flags,
        });
        predReady = world.phase !== 'countdown';
        predAcc = 0;
        return;
      }
      predAcc += dt;
      jumpHold = pressed ? 0.7 : Math.max(0, jumpHold - dt);
      let press = pressed;
      while (predAcc >= BOL_DT) {
        predAcc -= BOL_DT;
        pred.step(BOL_DT, { mx: input.mx, mz: input.mz, jump: press }, (e) => {
          if (e === 'jump') bolaSfx.jump();
          else if (e === 'airjump' || e === 'flip') {
            bolaSfx.airjump(e === 'flip');
            scene.jumpFx(meId, e === 'flip');
          }
        });
        press = false;
      }
      const body = pred.body;
      const ex = sx - body.x;
      const ez = sz - body.z;
      const ey = sy - body.y;
      if (Math.hypot(ex, ez) > 3 || (jumpHold <= 0 && Math.abs(ey) > 1.6)) {
        pred.reset({ x: row.x, y: row.y, z: row.z, vx: row.vx, vy: row.vy, vz: row.vz, ...flags });
      } else {
        // correção suave; logo depois de um pulo só a posição no chão é puxada, e devagar
        const k = 1 - Math.exp(-dt * (jumpHold > 0 ? 2 : 6));
        body.x += ex * k;
        body.z += ez * k;
        if (jumpHold <= 0) {
          body.y += ey * k * 0.7;
          const kv = 1 - Math.exp(-dt * 3);
          body.vx += (row.vx - body.vx) * kv;
          body.vz += (row.vz - body.vz) * kv;
          if (flags.airJumped) body.airJumped = true;
        }
      }
      me.x = body.x;
      me.y = body.y;
      me.z = body.z;
      me.vx = body.vx;
      me.vy = body.vy;
      me.vz = body.vz;
      me.heading = body.heading;
      me.grounded = body.grounded;
      me.airJumped = body.airJumped;
      me.flipT = body.flipT;
    };

    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    let lastCountN = 0;
    let prevPhase: string = world.phase;
    let jumpUntil = 0;
    let raf = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const me = world.player(meId);
      if (!document.hidden) {
        if (!online) acc += dt;
        const input = me ? controls.read() : { mx: 0, mz: 0, jump: false };
        const pressed = input.jump;
        if (input.jump) jumpUntil = now + JUMP_BUFFER_MS;
        input.jump = false;
        // a câmera segue a bola por padrão (E troca para câmera livre com o mouse)
        const manual = controls.takeYaw(dt) + turnKick;
        turnKick = 0;
        const manualPitch = controls.takePitch();
        const free = !ballCam || !me;
        if (free) {
          yaw += manual;
          // altura da câmera livre: do quase rente ao chão até quase de cima
          pitch = Math.min(1.25, Math.max(0.12, pitch + manualPitch));
        } else {
          const dx = world.ball.x - me.x;
          const dz = world.ball.z - me.z;
          const dist = Math.hypot(dx, dz);
          // com a bola colada na raposa o giro quase para (senão a câmera rodopia ao driblar)
          if (dist > 1.4) {
            const want = Math.atan2(-dx, -dz);
            let d = want - camYaw;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            // giro mais rápido quanto maior o desvio, e mais calmo quando a bola está perto
            const rate =
              (6 + 9 * Math.min(1, Math.abs(d) / 1.4)) *
              Math.min(1, Math.max(0.25, (dist - 1.4) / 4));
            camYaw += d * (1 - Math.exp(-dt * rate));
          }
          yaw = camYaw;
        }
        if (free) camYaw = yaw;
        scene.setPitch(free ? pitch : null);
        if (world.phase === 'goal') {
          // na comemoração a câmera gira devagar em volta da raposa
          yaw += dt * 0.5;
          camYaw = yaw;
        }
        scene.setYaw(yaw);
        if (input.mx !== 0 || input.mz !== 0) {
          const sy = Math.sin(yaw);
          const cy = Math.cos(yaw);
          const mx = input.mx * cy + input.mz * sy;
          const mz = -input.mx * sy + input.mz * cy;
          input.mx = mx;
          input.mz = mz;
        }
        if (online) {
          sentInput = { mx: input.mx, mz: input.mz };
          if (pressed) {
            // o aperto sai na hora, já com a direção desta tela (o mortal usa a direção no instante do pulo)
            jumps++;
            sendInput();
          }
          smoothOnline(dt, input, pressed);
        }
        while (!online && acc >= BOL_DT) {
          acc -= BOL_DT;
          const inputs: Record<string, BolInput> = {};
          for (const p of world.players) {
            if (!p.bot) continue;
            let m = mem.get(p.id);
            if (!m) {
              m = botMemory(p, botN++);
              mem.set(p.id, m);
            }
            inputs[p.id] = bolBotInput(world, p, m, rng);
          }
          const jumpNow = !!me && jumpUntil > now && (me.grounded || !me.airJumped);
          if (jumpNow) jumpUntil = 0;
          inputs[meId] = { mx: input.mx, mz: input.mz, jump: jumpNow };
          world.step(BOL_DT, inputs);
          for (const e of world.drainEvents()) onEvent(e);
        }
      }
      // apitos e contagem
      if (world.phase === 'countdown') {
        const n = Math.ceil(world.timer);
        if (n !== lastCountN && n >= 1 && n <= 3) bolaSfx.count(n);
        lastCountN = n;
      } else lastCountN = 0;
      if (prevPhase === 'countdown' && world.phase === 'play') bolaSfx.whistle();
      if (prevPhase !== 'over' && world.phase === 'over') bolaSfx.fullTime();
      prevPhase = world.phase;
      scene.render(dt, meId);
      if (now - hudAt > 100) {
        hudAt = now;
        setHud({
          phase: world.phase,
          count: Math.max(0, Math.ceil(world.timer)),
          clock: world.golden
            ? Math.max(0, world.clock - world.goldenStart)
            : Math.max(0, world.durationSec - world.clock),
          scores: [...world.scores],
          golden: world.golden,
          feed,
          warn,
          winner: world.winner,
          ballCam,
          banner,
          flash: flashId,
          myTeam: world.player(meId)?.team ?? -1,
          // a tabela só é montada quando aparece: sem custo no resto da partida
          rows: statsOn.current
            ? world.players.map((p) => ({
                id: p.id,
                name: p.name,
                team: p.team,
                bot: !!p.bot,
                ...p.stats,
              }))
            : [],
          possession: [...world.possession],
        });
      }
    };
    const frame = (now: number) => {
      try {
        tick(now);
      } catch (err) {
        // um erro no quadro não pode deixar a tela parada sem explicação
        console.error(err);
        setCrash(`Algo deu errado no jogo: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(warnTimer);
      window.clearTimeout(bannerTimer);
      window.clearInterval(inputTimer);
      crowdStop();
      for (const off of unsubs) off();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      ro.disconnect();
      controls.detach();
      scene.dispose();
    };
  }, [setup, controls, online?.meId]);

  // o mouse só fica preso à câmera durante a partida: tabela, configurações e fim de jogo soltam o cursor
  const finished = hud.phase === 'over';
  const uiOpen = menu || pinned || tabHeld || finished;
  uiOpenRef.current = uiOpen;
  useEffect(() => {
    controls.allowLock = !uiOpen;
    if (uiOpen) controls.releaseLock();
  }, [uiOpen, controls]);

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
  const touchDevice = useMemo(
    () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    [],
  );

  return (
    <div ref={root} className="dsm-play" data-testid="bola-play">
      <canvas ref={canvas} className="dsm-canvas" aria-label="Campo do Fut Fox" />
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
              key={`${i}-${s}`}
              className={s > 0 ? 'bola-team bump' : 'bola-team'}
              style={{
                background: `#${(BOL_TEAM_COLORS[i] as number).toString(16).padStart(6, '0')}`,
              }}
            >
              {s}
            </span>
          ))}
        </div>
        <div
          className={`bola-clock${hud.golden ? ' is-ot' : ''}`}
          role="timer"
          aria-label={hud.golden ? 'Tempo da prorrogação' : 'Tempo que falta'}
        >
          {fmt(hud.clock)}
          {hud.golden && <small>Prorrogação · gol de ouro</small>}
        </div>
        <button
          type="button"
          className="bola-gear"
          onClick={() => setMenu(true)}
          aria-label="Configurações"
          data-testid="bola-gear"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              fill="currentColor"
              d="M19.4 13a7.7 7.7 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.4a.5.5 0 0 0-.6-.2l-2.5 1a7.6 7.6 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6c-.6.3-1.2.6-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.4a.5.5 0 0 0 .1.6L4.6 11a7.7 7.7 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.4c.1.2.4.3.6.2l2.5-1c.5.4 1.1.7 1.7 1l.4 2.6c0 .2.2.4.5.4h4c.3 0 .5-.2.5-.4l.4-2.6c.6-.3 1.2-.6 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.4a.5.5 0 0 0-.1-.6L19.4 13ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
            />
          </svg>
          <span>Config.</span>
        </button>
      </div>
      {crash && (
        <div className="dsm-over" role="alert">
          <div className="dsm-over-card">
            <h2>Não deu para continuar</h2>
            <p>{crash}</p>
            <div className="dsm-over-btns">
              <button type="button" className="dsm-btn is-ghost" onClick={onExit}>
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
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
      {hud.myTeam >= 0 && !over && <BolaTips touch={touchDevice} />}
      {!over && hud.myTeam >= 0 && (
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
      {(tabHeld || pinned) && !menu && (
        <BolaStats
          rows={hud.rows}
          scores={hud.scores}
          possession={hud.possession}
          clock={fmt(hud.clock)}
          meId={meId}
          pinned={pinned}
          onClose={() => setPinned(false)}
        />
      )}
      {menu && !over && !teamsOpen && (
        <BolaMenu
          myTeam={hud.myTeam}
          ballCam={hud.ballCam}
          onClose={() => {
            setMenu(false);
            setTeamsOpen(false);
          }}
          onStats={() => {
            setMenu(false);
            setPinned(true);
          }}
          onCam={() => camToggle.current()}
          onTeams={() => setTeamsOpen(true)}
          onEnd={onEnd}
          onExit={onExit}
        />
      )}
      {menu && !over && teamsOpen && (
        <BolaTeams
          teams={setup.teams}
          perTeam={setup.perTeam}
          rows={hud.rows}
          meId={meId}
          spectating={hud.myTeam < 0}
          onTake={(t, botId) => {
            const err = switchTeam.current(t, botId);
            if (!err) {
              setHud((h) => ({ ...h, myTeam: t }));
              setTeamsOpen(false);
              setMenu(false);
            }
            return err;
          }}
          onSpectate={() => {
            const err = switchTeam.current(-1);
            if (!err) {
              setHud((h) => ({ ...h, myTeam: -1 }));
              setTeamsOpen(false);
              setMenu(false);
            }
            return err;
          }}
          onBack={() => setTeamsOpen(false)}
        />
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
