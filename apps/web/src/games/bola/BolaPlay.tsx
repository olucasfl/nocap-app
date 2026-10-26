import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BOL_DT,
  BOL_TEAM_COLORS,
  BOL_TEAM_NAMES,
  BolPredictor,
  BOL_SUBSTEPS,
  type BolBall,
  BolWorld,
  bolBotInput,
  createRng,
  newBolBotMemory,
  type BolEvent,
  type BolInfo,
  type BolInput,
} from '@nocap/games';
import { bolaGain, bolaSfx, crowdStart, crowdStop, crowdSwell } from '@/lib/bola-audio';
import { sendRoom, useRoom } from '@/lib/rooms';
import { DsmControls, STICK_RADIUS } from '../desmorona/controls';
import '../desmorona/desmorona.css';
import './bola.css';
import { roomLink, type BolaLink } from '@/lib/bola-link';
import { BUILD_ID } from '@/lib/build-id';
import { BolaMenu } from './BolaMenu';
import { BolaTips } from './BolaTips';
import { IcBall, IcCamera, IcEye, IcGear, IcJump, Key } from './BolaIcons';
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
  /** Por onde a partida chega e a entrada sai; sem isto, o servidor da sala (o jeito de sempre). */
  link?: BolaLink;
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
/** O placar de um time: a cor, o número e o nome pequeno (some no celular). O número dá um pulinho quando muda. */
function ScoreChip({ team, score }: { team: number; score: number }) {
  const name = BOL_TEAM_NAMES[team] ?? '';
  return (
    <span
      key={`${team}-${score}`}
      className={score > 0 ? 'bola-team bump' : 'bola-team'}
      style={{
        background: `#${(BOL_TEAM_COLORS[team] as number).toString(16).padStart(6, '0')}`,
      }}
      aria-label={`${name}: ${score}`}
    >
      <b>{score}</b>
      <small>{name}</small>
    </span>
  );
}

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
  /** Espectador: -1 / 1 troca de jogador, 'ball' segue a bola. */
  const specNav = useRef<(to: number | 'ball') => void>(() => undefined);
  const [spec, setSpec] = useState<{ id: string; name: string; team: number }>({
    id: 'ball',
    name: 'Bola',
    team: -1,
  });
  const switchTeam = useRef<(team: number, botId?: string | null) => string | null>(() => null);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [crash, setCrash] = useState<string | null>(null);
  const [tabHeld, setTabHeld] = useState(false);
  const [pinned, setPinned] = useState(false);
  /** Painel de rede (ping e estados por segundo): só online, ligado e desligado nas configurações. */
  const [showNet, setShowNet] = useState(() => {
    try {
      return localStorage.getItem('nocap-bola-net') === '1';
    } catch {
      return false;
    }
  });
  const [net, setNet] = useState<{ ping: number; fps: number; delay: number; draw: number } | null>(
    null,
  );
  const toggleNet = () =>
    setShowNet((v) => {
      try {
        localStorage.setItem('nocap-bola-net', v ? '0' : '1');
      } catch {
        /* sem armazenamento: vale só nesta partida */
      }
      return !v;
    });
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
    ballCam: false,
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
    // a partida começa com a câmera solta; quem quiser prende na bola (F ou o botão)
    let ballCam = false;
    let aimed = false;
    let yaw = 0;
    let camYaw = 0;
    let pitch = 0.5;
    let turnKick = 0;
    if (import.meta.env.DEV)
      (window as unknown as { __bolaTurn?: (d: number) => void }).__bolaTurn = (d) =>
        (turnKick += d);
    let specId = 'ball';
    specNav.current = (to) => {
      if (to === 'ball') specId = 'ball';
      else {
        // a volta passa pela bola e por todos os jogadores, na ordem da lista
        const ids = ['ball', ...world.players.map((p) => p.id)];
        const at = Math.max(0, ids.indexOf(specId));
        specId = ids[(at + to + ids.length) % ids.length] as string;
      }
      const p = world.player(specId);
      setSpec({ id: specId, name: p ? p.name : 'Bola', team: p ? p.team : -1 });
    };
    camToggle.current = () => {
      ballCam = !ballCam;
      if (!ballCam) yaw = camYaw;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyF' && !e.repeat) camToggle.current();
      if (!e.repeat && !world.player(meId)) {
        if (e.code === 'KeyQ' || e.code === 'ArrowLeft') specNav.current(-1);
        if (e.code === 'KeyE' || e.code === 'ArrowRight') specNav.current(1);
      }
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
    const link = online?.link ?? roomLink;
    let lastEv = 0;
    let frames = 0;
    let draws = 0;
    let netTimer = 0;
    if (online) {
      netTimer = window.setInterval(() => {
        setNet({
          ping: Math.round(link.rtt()),
          fps: frames,
          delay: Math.round(interpMs),
          draw: draws,
        });
        frames = 0;
        draws = 0;
      }, 1000);
    }
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
        link.onFrame((m) => {
          const f = m as unknown as NetFrame;
          if (!f || !Array.isArray(f.p)) return;
          frames++;
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
          if (prevAt > 0) {
            // o maior intervalo recente entre estados diz quanto de atraso é preciso para nunca faltar dado
            const gap = at - prevAt;
            gapAvg += (gap - gapAvg) * 0.05;
            gapDev += (Math.abs(gap - gapAvg) - gapDev) * 0.08;
            // atraso = dois estados de folga + a variação medida; sobe depressa quando a rede piora e desce devagar
            const want = Math.min(260, Math.max(INTERP_MIN_MS, gapAvg * 2 + gapDev * 3.5 + 10));
            interpMs += (want - interpMs) * (want > interpMs ? 0.2 : 0.015);
          }
          prevAt = at;
          snaps.push({ t: typeof f.t === 'number' ? f.t : Date.now(), ball, rows });
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
            // o canal pode repetir eventos (e o quadro perdido não pode perdê-los): cada um vale uma vez só
            const n = (raw as { n?: number }).n;
            if (typeof n === 'number') {
              if (n <= lastEv) continue;
              lastEv = n;
            }
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
      link.sendInput([
        Math.round(sentInput.mx * 100) / 100,
        Math.round(sentInput.mz * 100) / 100,
        jumps,
        ++seq,
      ]);
    };
    const inputTimer = online ? window.setInterval(sendInput, 25) : 0;
    /** Atraso de desenho dos outros e da bola (ms): cobre a variação (jitter) da rede sem engasgar. */
    /** Atraso mínimo; sobe sozinho quando a rede ou o aparelho entregam os estados em rajadas. */
    const INTERP_MIN_MS = link.minDelay;
    let interpMs = Math.max(INTERP_MIN_MS, 80);
    let gapAvg = 16;
    let gapDev = 0;
    let prevAt = 0;
    /** A bola é desenhada este tanto (ms) mais perto do presente que as outras raposas. */
    const BALL_AHEAD_MS = 55;
    /** Relógio de desenho no tempo do servidor: anda com o relógio local e só é ajustado devagar, então a rede irregular não vira tranco. */
    let renderT = 0;
    const pred = new BolPredictor(world.field);
    let predReady = false;
    let predAcc = 0;
    const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
    /** A bola "de mentira" perto da própria raposa: o contato aparece na hora, sem esperar a ida e volta do servidor. */
    const lb: BolBall = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0 };
    const probe: BolBall = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0 };
    let touchHold = 0;
    let lbFade = 0;
    const smoothOnline = (dt: number, input: { mx: number; mz: number }, pressed: boolean) => {
      syncRoster();
      const last = snaps[snaps.length - 1];
      if (!last) return;
      // alvo: o último estado + o que passou desde que chegou - o atraso; o relógio de desenho o persegue suave
      const target = last.t + (performance.now() - last.ball.at) - interpMs;
      // o relógio de desenho nunca volta para trás: se está adiantado só anda mais devagar, se atrasado anda mais rápido
      // (mexer no atraso de uma vez faria a bola "voltar" no tempo e parecer um teletransporte)
      if (renderT === 0 || Math.abs(target - renderT) > 700) renderT = target;
      else renderT += dt * 1000 * Math.min(1.35, Math.max(0.6, 1 + (target - renderT) / 400));
      const rt = renderT;
      // entre quais dois estados estamos (ou, se faltar estado novo, o último com um pouco de extrapolação)
      const bracket = (t: number) => {
        let lo = last;
        let hi = last;
        let k = 0;
        let ex = 0;
        if (t >= last.t) ex = Math.min(0.05, (t - last.t) / 1000);
        else {
          lo = hi = snaps[0] as NetSnap;
          for (let i = snaps.length - 1; i >= 1; i--) {
            const l2 = snaps[i - 1] as NetSnap;
            const h2 = snaps[i] as NetSnap;
            if (l2.t <= t) {
              lo = l2;
              hi = h2;
              k = h2.t > l2.t ? Math.min(1, (t - l2.t) / (h2.t - l2.t)) : 0;
              break;
            }
          }
        }
        return { a: lo, b: hi, u: k, extra: ex };
      };
      const { a, b, u, extra } = bracket(rt);
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
      // a bola é desenhada mais perto do "agora" que as outras raposas: é nela que a sua raposa (já no presente) encosta
      const bb = bracket(rt + BALL_AHEAD_MS);
      const ball = world.ball;
      ball.x = lerp(bb.a.ball.x, bb.b.ball.x, bb.u) + bb.a.ball.vx * bb.extra;
      ball.y = Math.max(0.9, lerp(bb.a.ball.y, bb.b.ball.y, bb.u) + bb.a.ball.vy * bb.extra);
      ball.z = lerp(bb.a.ball.z, bb.b.ball.z, bb.u) + bb.a.ball.vz * bb.extra;
      ball.vx = bb.a.ball.vx;
      ball.vy = bb.a.ball.vy;
      ball.vz = bb.a.ball.vz;

      // a própria raposa: roda a mesma conta do servidor aqui (responde na hora) e é puxada de volta se o servidor discordar
      const me = world.player(meId);
      const slot = slotOf.get(meId);
      const row = slot === undefined ? undefined : last.rows.get(slot);
      if (!me || !row) {
        predReady = false;
        return;
      }
      // onde o servidor deve estar agora: o estado + o tempo desde que chegou + a ida da rede (metade do RTT)
      const syncMe = () => {
        const bd = pred.body;
        me.x = bd.x;
        me.y = bd.y;
        me.z = bd.z;
        me.vx = bd.vx;
        me.vy = bd.vy;
        me.vz = bd.vz;
        me.heading = bd.heading;
        me.grounded = bd.grounded;
        me.airJumped = bd.airJumped;
        me.flipT = bd.flipT;
        me.flipDx = bd.flipDx;
        me.flipDz = bd.flipDz;
        me.flipHit = bd.flipHit;
      };
      const lead = Math.min(
        0.35,
        Math.max(0, (performance.now() - last.ball.at + Math.min(40, link.rtt() / 2)) / 1000),
      );
      const sx = row.x + row.vx * lead;
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
        syncMe();
        // não atravessa as outras raposas: o corpo previsto sai de dentro delas já neste passo
        world.pushOutOfFoxes(me);
        pred.body.x = me.x;
        pred.body.z = me.z;
        if (world.phase === 'play') {
          if (touchHold <= 0 && lbFade <= 0) {
            // sem toque recente só se testa o contato: a bola desenhada não anda um passo à frente, e só vira "de mentira" se foi tocada
            Object.assign(probe, ball);
            let hit = false;
            for (let i = 0; i < BOL_SUBSTEPS; i++) {
              if (world.ghostBall(probe, me, BOL_DT / BOL_SUBSTEPS)) hit = true;
            }
            if (hit) {
              Object.assign(lb, probe);
              touchHold = 0.35;
              lbFade = 1;
            }
          } else {
            for (let i = 0; i < BOL_SUBSTEPS; i++) {
              if (world.ghostBall(lb, me, BOL_DT / BOL_SUBSTEPS)) touchHold = 0.35;
            }
          }
        }
        pred.body.flipHit = me.flipHit;
      }
      const body = pred.body;
      const ex = sx - body.x;
      const ez = sz - body.z;
      const err = Math.hypot(ex, ez);
      if (err > 3.5) {
        pred.reset({ x: row.x, y: row.y, z: row.z, vx: row.vx, vy: row.vy, vz: row.vz, ...flags });
      } else if (err > 0.7) {
        // dentro de 0,7 m é só atraso da rede e a raposa responde como no offline; passando disso (empurrão, bola, parede) volta devagar
        const k = 1 - Math.exp(-dt * 3);
        body.x += ex * k;
        body.z += ez * k;
      }
      syncMe();
      // a bola de mentira volta ao que o servidor diz (devagar logo depois de um toque, para o chute não ser desfeito) e aparece perto da raposa
      if (world.phase !== 'play') {
        touchHold = 0;
        lbFade = 0;
      } else if (lbFade > 0) {
        // logo depois do toque a bola desenhada é a de mentira; ela volta à do servidor aos poucos, sem salto
        if (touchHold > 0) touchHold = Math.max(0, touchHold - dt);
        else {
          // passada a espera, a bola de mentira desliza até a do servidor (se o servidor tocou igual, quase não se mexe).
          // A velocidade do deslize é limitada: um erro grande vira um movimento rápido, nunca um teletransporte.
          lbFade = Math.max(0, lbFade - dt / 1.2);
          const kb = 1 - Math.exp(-dt * 8);
          let sx = (ball.x - lb.x) * kb;
          let sy = (ball.y - lb.y) * kb;
          let sz = (ball.z - lb.z) * kb;
          const len = Math.hypot(sx, sy, sz);
          const cap = 22 * dt;
          if (len > cap) {
            sx *= cap / len;
            sy *= cap / len;
            sz *= cap / len;
          }
          lb.x += sx;
          lb.y += sy;
          lb.z += sz;
          lb.vx += (ball.vx - lb.vx) * kb;
          lb.vy += (ball.vy - lb.vy) * kb;
          lb.vz += (ball.vz - lb.vz) * kb;
          // chegou perto: acabou, a bola desenhada volta a ser a do servidor
          if (Math.hypot(ball.x - lb.x, ball.y - lb.y, ball.z - lb.z) < 0.25) lbFade = 0;
        }
        const w = lbFade > 0 ? 1 : 0;
        ball.x = lerp(ball.x, lb.x, w);
        ball.y = lerp(ball.y, lb.y, w);
        ball.z = lerp(ball.z, lb.z, w);
        ball.vx = lerp(ball.vx, lb.vx, w);
        ball.vy = lerp(ball.vy, lb.vy, w);
        ball.vz = lerp(ball.vz, lb.vz, w);
      }
    };

    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    let lastCountN = 0;
    let prevPhase: string = world.phase;
    let jumpUntil = 0;
    let raf = 0;
    const tick = (now: number) => {
      draws++;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const me = world.player(meId);
      if (!document.hidden) {
        if (!online) acc += dt;
        const input = me ? controls.read() : { mx: 0, mz: 0, jump: false };
        const pressed = input.jump;
        if (input.jump) jumpUntil = now + JUMP_BUFFER_MS;
        input.jump = false;
        // a câmera começa solta (mouse gira); F prende na bola
        // um quadro nunca gira a câmera mais que isso (um pico do mouse ou um engasgo não vira um giro seco)
        const cap = 0.3 * Math.max(1, dt * 60);
        const manual = Math.max(-cap, Math.min(cap, controls.takeYaw(dt))) + turnKick;
        turnKick = 0;
        const manualPitch = Math.max(-0.2, Math.min(0.2, controls.takePitch()));
        if (!aimed && me) {
          // começa olhando da raposa para a bola, em vez de uma direção qualquer
          aimed = true;
          camYaw = yaw = Math.atan2(-(world.ball.x - me.x), -(world.ball.z - me.z));
        }
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
            // nunca gira mais rápido que isso: a bola cruzando perto da raposa não vira a câmera de repente
            const step = d * (1 - Math.exp(-dt * rate));
            const cap = 2.2 * dt;
            camYaw += Math.max(-cap, Math.min(cap, step));
          }
          yaw = camYaw;
        }
        if (free) camYaw = yaw;
        scene.setPitch(free ? pitch : null);
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
      scene.render(dt, me ? meId : specId);
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
      window.clearInterval(netTimer);
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
        <div className="bola-board" role="status" aria-label="Placar e tempo">
          <div className="bola-board-row">
            <ScoreChip team={0} score={hud.scores[0] ?? 0} />
            <div
              className={`bola-clock${hud.golden ? ' is-ot' : ''}`}
              role="timer"
              aria-label={hud.golden ? 'Tempo da prorrogação' : 'Tempo que falta'}
            >
              {fmt(hud.clock)}
              {hud.golden && <small>Prorrogação · gol de ouro</small>}
            </div>
            <ScoreChip team={1} score={hud.scores[1] ?? 0} />
          </div>
          {hud.scores.length > 2 && (
            <div className="bola-board-extra">
              {hud.scores.slice(2).map((sc, i) => (
                <ScoreChip key={i + 2} team={i + 2} score={sc} />
              ))}
            </div>
          )}
        </div>
        <div className="bola-tools">
          <button
            type="button"
            className="bola-tool bola-gear"
            onClick={() => setMenu(true)}
            aria-label="Configurações"
            data-testid="bola-gear"
          >
            <IcGear size={20} />
            <span>Config.</span>
            <Key k="Esc" className="bola-hide-touch" />
          </button>
        </div>
      </div>
      {online && showNet && net && !over && (
        <div className="bola-net" data-testid="bola-net" aria-label="Rede">
          <b>{online.link?.local ? 'líder' : online.link ? 'p2p' : 'servidor'}</b>
          {!online.link?.local && <span>{net.ping} ms</span>}
          <span>{net.fps}/s</span>
          <span title="atraso de desenho dos outros jogadores">{net.delay} ms</span>
          <span title="quadros desenhados por segundo neste aparelho">{net.draw} fps</span>
          <span title="versão do app">v{BUILD_ID}</span>
        </div>
      )}
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
      {hud.myTeam < 0 && !over && (
        <div
          className="bola-spec"
          data-testid="bola-spec"
          role="group"
          aria-label="Quem acompanhar"
        >
          <button
            type="button"
            className="bola-spec-step"
            onClick={() => specNav.current(-1)}
            aria-label="Anterior"
          >
            <Key k="Q" className="bola-hide-touch" />
            <span aria-hidden="true">‹</span>
          </button>
          <div className="bola-spec-now" aria-live="polite">
            <small>
              <IcEye size={14} /> Espectando
            </small>
            <strong>
              {spec.id === 'ball' ? (
                <>
                  <IcBall size={16} /> Bola
                </>
              ) : (
                <>
                  <i
                    style={{
                      background: `#${(BOL_TEAM_COLORS[spec.team] ?? 0xffffff).toString(16).padStart(6, '0')}`,
                    }}
                  />
                  {spec.name}
                </>
              )}
            </strong>
          </div>
          <button
            type="button"
            className="bola-spec-step"
            onClick={() => specNav.current(1)}
            aria-label="Próximo"
          >
            <span aria-hidden="true">›</span>
            <Key k="E" className="bola-hide-touch" />
          </button>
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
            <IcJump size={22} />
            Pular
          </button>
          <button
            type="button"
            className="bola-cam"
            onClick={() => camToggle.current()}
            aria-pressed={!hud.ballCam}
          >
            <Key k="F" className="bola-hide-touch" />
            <IcCamera size={18} />
            {hud.ballCam ? 'Câmera solta' : 'Câmera na bola'}
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
          netPanel={online ? { on: showNet, toggle: toggleNet } : undefined}
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
