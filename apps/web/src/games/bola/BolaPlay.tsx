import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BOL_DT,
  BOL_TEAM_COLORS,
  BOL_TEAM_NAMES,
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
import { GameChat } from '@/components/GameChat';
import { gameChatOpen, isTyping } from '@/lib/game-chat-state';
import { BolaNetSync } from '@/lib/bola-netsync';
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
  /** Quem venceu (-1 = empate): vale no fim da partida. */
  wn?: number;
  /** Medidor do servidor, uma vez por segundo: [quadros enviados, maior intervalo em ms]. */
  sv?: [number, number];
  /** Prorrogação: times que ficaram de fora. */
  go?: number[];
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
  banner: {
    title: string;
    sub: string;
    team: number;
    id: number;
    /** Prorrogação com times de fora: quem segue e quem vira espectador. */
    stay?: number[];
    out?: number[];
    /** Velocidade da bola no gol (km/h). */
    kmh?: number;
  } | null;
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
const hexOf = (t: number) => `#${(BOL_TEAM_COLORS[t] as number).toString(16).padStart(6, '0')}`;

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
  onOfflineInvite,
}: {
  setup: BolaSetup;
  /** Partida em sala: o servidor simula; aqui só desenha e manda a entrada. */
  online?: BolaOnline;
  onExit: () => void;
  onAgain?: () => void;
  /** Só o líder da sala: encerra a partida. */
  onEnd?: () => void;
  /** Partida offline: "Convidar" leva para criar uma sala com amigos. */
  onOfflineInvite?: () => void;
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
  const boardEl = useRef<HTMLDivElement>(null);
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
  const [net, setNet] = useState<{
    ping: number;
    fps: number;
    delay: number;
    draw: number;
    /** O servidor: quadros enviados no último segundo e o maior intervalo entre dois (ms). */
    srv: [number, number] | null;
  } | null>(null);
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
        if (!locked && !uiOpenRef.current && !gameChatOpen()) setMenu(true);
      });
    }
    // celular começa com a câmera na bola; computador com a câmera solta (F ou o botão alternam)
    let ballCam = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
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
      if (isTyping(e)) return;
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
        banner = {
          title,
          sub,
          team: e.scorerTeam,
          id: feedId++,
          kmh: Math.round(e.speed * 3.6),
        };
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
        scene.setClosedGoals(world.out);
        // o mundo já tirou os corpos dos times de fora: a cena também precisa tirar as raposas
        scene.sync();
        if (e.out.length > 0) {
          const stay = world.scores.map((_, t) => t).filter((t) => !e.out.includes(t));
          banner = {
            title: 'Prorrogação',
            sub: 'Só os gols de quem empatou continuam abertos. Quem marcar ganha',
            team: -1,
            id: feedId++,
            stay,
            out: e.out,
          };
          window.clearTimeout(bannerTimer);
          bannerTimer = window.setTimeout(() => {
            banner = null;
          }, 5200);
        } else {
          warn = 'Gol de ouro! Quem marcar ganha';
          window.clearTimeout(warnTimer);
          warnTimer = window.setTimeout(() => {
            warn = '';
          }, 4500);
        }
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
    const unsubs: (() => void)[] = [];
    const link = online?.link ?? roomLink;
    let lastEv = 0;
    let frames = 0;
    let draws = 0;
    let srv: [number, number] | null = null;
    let netTimer = 0;
    if (online) {
      netTimer = window.setInterval(() => {
        setNet({
          ping: Math.round(link.rtt()),
          fps: frames,
          delay: Math.round(sync.interpMs),
          draw: draws,
          srv,
        });
        frames = 0;
        draws = 0;
      }, 1000);
    }
    let ballT: { x: number; y: number; z: number; vx: number; vy: number; vz: number } | null =
      null;
    let slotId = new Map<number, string>();
    let slotOf = new Map<string, number>();
    let rosterKey = '';
    let rosterSeen: unknown = null;
    let jumps = 0;
    let seq = 0;
    let sentInput = { mx: 0, mz: 0 };
    const sync = new BolaNetSync(world, {
      meId,
      minDelay: link.minDelay,
      ballModel: 'replay',
      rollback: true,
      rtt: () => link.rtt(),
      now: () => performance.now(),
      slotOf: () => slotOf,
      onMove: (e) => {
        if (e === 'jump') bolaSfx.jump();
        else {
          bolaSfx.airjump(e === 'flip');
          scene.jumpFx(meId, e === 'flip');
        }
      },
    });
    if (import.meta.env.DEV) (window as unknown as { __bolaSync?: BolaNetSync }).__bolaSync = sync;
    const idOfSlot = (s: unknown) => (typeof s === 'number' ? (slotId.get(s) ?? null) : null);
    const syncRoster = () => {
      const all = rosterRef.current;
      // a lista só muda quando chega um estado novo da sala: o mesmo objeto não precisa ser comparado de novo
      if (all === rosterSeen) return;
      rosterSeen = all;
      // times que ficaram de fora da prorrogação não têm corpo em campo (a lista da sala pode ainda trazê-los)
      const roster = all.filter((r) => !world.out[r.team]);
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
            speed: typeof e.sp === 'number' ? e.sp : 0,
          };
        case 'nogoal':
          return { type: 'nogoal', goalTeam: e.gt as number, ownerId: idOfSlot(e.ow) };
        case 'warn':
          return { type: 'warn', left: e.l as number };
        case 'golden':
          return { type: 'golden', out: Array.isArray(e.out) ? (e.out as number[]) : [] };
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
          if (Array.isArray(f.sv)) srv = f.sv;
          syncRoster();
          const phases = { c: 'countdown', p: 'play', g: 'goal', o: 'over' } as const;
          world.phase = phases[f.ph] ?? world.phase;
          world.timer = f.tm;
          world.clock = f.ck;
          world.golden = f.gd === 1;
          if (typeof f.wn === 'number') world.winner = f.wn;
          {
            const out = f.go ?? [];
            let changed = false;
            for (let t = 0; t < world.out.length; t++) {
              const o = out.includes(t);
              if (world.out[t] !== o) {
                world.out[t] = o;
                changed = true;
              }
            }
            if (changed) {
              scene.setClosedGoals(world.out);
              // os times de fora saem do campo: tira os corpos deles e refaz a lista
              rosterSeen = null;
              syncRoster();
            }
          }
          world.goldenStart = f.gs ?? 0;
          world.scores.splice(0, world.scores.length, ...f.sc);
          sync.push(f);
          ballT = sync.lastBall;
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
      // previsão com rollback valendo: a entrada vai por passo (o líder a aplica no passo certo); só manda se há passo novo
      if (sync.rb?.active) {
        const pkt = sync.inputPacket();
        if (pkt) link.sendInput(pkt);
        return;
      }
      link.sendInput([
        Math.round(sentInput.mx * 100) / 100,
        Math.round(sentInput.mz * 100) / 100,
        jumps,
        ++seq,
      ]);
    };
    const inputTimer = online ? window.setInterval(sendInput, 25) : 0;
    const smoothOnline = (dt: number, input: { mx: number; mz: number }, pressed: boolean) => {
      syncRoster();
      sync.update(dt, input, pressed);
      if (sync.rb?.active) sendInput();
    };

    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    let lastCountN = 0;
    let prevPhase: string = world.phase;
    let jumpUntil = 0;
    let raf = 0;
    // O aparelho do líder simula e envia os estados aos outros pelo mesmo processador que desenha: em tela de 144 a 165 Hz
    // ele gastava tudo em desenhar e os envios saíam irregulares (os outros recebiam ~47 de 60 estados). Desenha no máximo ~80/s.
    const capDraw = !!online?.link?.local;
    let lastDrawAt = 0;
    const tick = (now: number) => {
      // quadro pulado: o laço de fora já agenda o próximo
      if (capDraw && now - lastDrawAt < 12) return;
      lastDrawAt = now;
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
  // avisos, cartaz de gol e placar de rede ficam sempre abaixo do placar, qualquer que seja a altura dele (2 a 4 times)
  useEffect(() => {
    const board = boardEl.current;
    const rootEl = root.current;
    if (!board || !rootEl) return undefined;
    const measure = () => {
      const b = board.getBoundingClientRect();
      const r = rootEl.getBoundingClientRect();
      rootEl.style.setProperty('--bola-board-bottom', `${Math.ceil(b.bottom - r.top)}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(board);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
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
        <div ref={boardEl} className="bola-board" role="status" aria-label="Placar e tempo">
          <div className="bola-board-row">
            <ScoreChip team={0} score={hud.scores[0] ?? 0} />
            <div
              className={`bola-clock${hud.golden ? ' is-ot' : ''}`}
              role="timer"
              aria-label={hud.golden ? 'Tempo da prorrogação' : 'Tempo que falta'}
            >
              {fmt(hud.clock)}
              {/* o aviso aparece só no começo da prorrogação e some (fica a cor laranja do relógio) */}
              {hud.golden && hud.clock < 5 && <small>Prorrogação · gol de ouro</small>}
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
          <span title="estados recebidos por segundo">{net.fps}/s</span>
          {net.srv && (
            <span title="servidor: estados enviados por segundo e maior intervalo entre dois">
              srv {net.srv[0]}/s · {net.srv[1]} ms
            </span>
          )}
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
          {hud.banner.kmh !== undefined && hud.banner.kmh > 0 && (
            <b className="bola-banner-speed">Bola a {hud.banner.kmh} km/h</b>
          )}
          {hud.banner.stay && hud.banner.out && (
            <div className="bola-ot" aria-label="Quem continua e quem espectou">
              <div className="bola-ot-row">
                <small>Continuam</small>
                {hud.banner.stay.map((t, i) => (
                  <i
                    key={t}
                    className="bola-ot-chip is-stay"
                    style={{ background: hexOf(t), animationDelay: `${0.25 + i * 0.12}s` }}
                  >
                    {BOL_TEAM_NAMES[t]}
                  </i>
                ))}
              </div>
              <div className="bola-ot-row">
                <small>Espectam</small>
                {hud.banner.out.map((t, i) => (
                  <i
                    key={t}
                    className="bola-ot-chip is-out"
                    style={{ background: hexOf(t), animationDelay: `${0.25 + i * 0.12}s` }}
                  >
                    {BOL_TEAM_NAMES[t]}
                  </i>
                ))}
              </div>
            </div>
          )}
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
      <GameChat enabled={!!online && !over} onClosed={(was) => was && controls.resumeLock()} />
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
          onClose={() => {
            setMenu(false);
            setTeamsOpen(false);
          }}
          onStats={() => {
            setMenu(false);
            setPinned(true);
          }}
          online={!!online}
          touch={touchDevice}
          onOfflineInvite={onOfflineInvite}
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
