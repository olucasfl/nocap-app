import type { Room } from 'colyseus.js';
import type {
  AtravessaRoomMode,
  AtravessaRoomSize,
  Hsb,
  LeaderRule,
  TimeSettings,
} from '@nocap/games';
import { create } from 'zustand';
import { ApiError, apiBase, apiClient } from './api-client';
import { getToken, useAuth } from './auth';

export type RoomGame =
  | 'color'
  | 'time'
  | 'impostor'
  | 'eco'
  | 'atravessa'
  | 'desmorona'
  | 'foxgp'
  | 'bola'
  | 'pingpong'
  | 'foxshot'
  | 'foxcap';
export type Phase =
  | 'lobby'
  | 'intro'
  | 'micro'
  | 'ranking'
  | 'tutorial'
  | 'big'
  | 'create'
  | 'show'
  | 'pick'
  | 'play'
  | 'vote'
  | 'reveal'
  | 'final';

export interface ColorRoomSettings {
  rounds: number;
  showMs: number;
  pickMs: number;
}
export type TimeRoomSettings = TimeSettings;
/** Intruso: tempo de votar, quantos intrusos o host pediu e se o voto é anônimo. */
export interface ImpostorRoomSettings {
  voteMs: number;
  impostors: number;
  anonymous: boolean;
}
/** Atravessa!: rodadas do Infinito e o tamanho do mapa do Checkpoint. */
export interface AtravessaSettings {
  rounds: number;
  size: AtravessaRoomSize;
}
/** As regras dependem do jogo da sala (`snapshot.game`). */
export type RoomSettings = ColorRoomSettings &
  TimeRoomSettings &
  ImpostorRoomSettings &
  AtravessaSettings;

export interface RoomMember {
  id: string;
  username: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  locked: boolean;
  /** Votou em jogar de novo (pódio). */
  rematch: boolean;
  /** Topou a revanche: o lobby só espera o líder começar. */
  committed: boolean;
  /** Entrou sem conta: o nome é só um apelido desta sala. */
  guest?: boolean;
}

export interface RoundResult {
  id: string;
  /** Cor: o HSB. Tempo: a duração em ms. */
  answer: Hsb | number | null;
  score: number;
}

export interface FinalRow {
  userId: string;
  username: string;
  totalTenths: number;
  placement: number;
}

export interface ChatMessage {
  id: number;
  userId: string;
  username: string;
  text: string;
  at: number;
}

/** Corrida do Ecooo: a sequência e quem ainda está na disputa. */
export interface EcoRoomState {
  round: number;
  length: number;
  pads: number;
  stepMs: number;
  reverse: boolean;
  /** A sequência da rodada (some no lobby e no pódio). */
  sequence: number[] | null;
  participants: string[];
  alive: string[];
  progress: number;
  /** Quando eu perco por ficar parado; null fora da minha vez. */
  tapDeadline: number | null;
  /** Siga o Líder: quem cria a rodada, as regras e se o tempo dele acabou. */
  leader?: string | null;
  /** Corrida por vez: de quem é a vez, a fila e o tempo do aviso "VEZ DE ...". */
  turn?: string | null;
  queue?: string[];
  announceMs?: number;
  /** Número da vez (muda a cada vez, mesmo quando a sequência não cresce). */
  turnNo?: number;
  /** Quem joga depois da vez atual. */
  next?: string | null;
  /** Como terminou a última vez (só durante o resultado, por cima do tabuleiro). */
  result?: { who: string; passed: boolean; taps: number } | null;
  rules?: LeaderRule[];
  timedOut?: boolean;
  /** Pódio do Siga o Líder: soma de acertos de cada pessoa como seguidora. */
  hits?: Record<string, number>;
}

/** O Atravessa! em sala (spec 031): cores, hora da largada e os placares. As posições vêm no fluxo "pos". */
export interface AtravessaRoomState {
  /** O id desta pessoa na sala (vale também para convidados). */
  me: string | null;
  mode: AtravessaRoomMode;
  size: AtravessaRoomSize;
  /** Metros do mapa (Checkpoint); null no Infinito. */
  length: number | null;
  checkpoints: number[];
  colors: Record<string, string>;
  /** Largada, no relógio do servidor (ms); null no lobby. */
  startAt: number | null;
  /** A posição de cada pessoa nos relatos "pos". */
  slots: Record<string, number>;
  /** Placar da rodada e soma até agora (placar da rodada e pódio). */
  roundMeters: Record<string, number> | null;
  totals: Record<string, number> | null;
  results: Record<
    string,
    { meters: number; ms: number | null; deaths: number; finished: boolean }
  > | null;
}

/** O Desmorona! em sala (spec 044): vagas, cores, hora da largada e quem já caiu. As posições vêm no fluxo "pos". */
export interface DesmoronaRoomState {
  me: string | null;
  startAt: number | null;
  slots: Record<string, number>;
  /** A cor de cada pessoa (hex da paleta do Atravessa!). */
  colors: Record<string, string>;
  /** Quem já caiu (id → hora da queda em ms de jogo). */
  dead: Record<string, number>;
  winnerId: string | null;
}

/** O Fox GP em sala (spec 078): fases, horas, vagas, cores, grid, chegadas e quem saiu. As posições vêm no fluxo "pos". */
export interface FoxGpRoomState {
  me: string | null;
  /** Quem simula a partida (o líder quando ela começou). */
  host: string | null;
  /** A pintura de cada um (garagem). */
  paints: Record<string, { body: string; accent: string; pattern: string; number: number }>;
  stage: 'quali' | 'grid' | 'race' | null;
  qualiAt: number | null;
  raceAt: number | null;
  slots: Record<string, number>;
  colors: Record<string, string>;
  quali: Record<string, number | null>;
  grid: string[];
  finish: Record<string, number>;
  best: Record<string, number>;
  passes: Record<string, number>;
  gone: string[];
  fastest: { id: string; ms: number } | null;
  firstFinishAt: number | null;
  order: string[] | null;
  dnf: string[];
}

/** O Ping Fox! em sala (spec 055, fase 3): quem joga, quem saca primeiro e a hora da largada. As batidas vêm em "pev". */
export interface PingRoomState {
  me: string | null;
  startAt: number | null;
  firstServer: number;
  /** Quem joga: [vaga 0 (perto da câmera no motor), vaga 1]. Null no lobby. */
  players: [string, string] | null;
  score: [number, number];
  /** Quem saiu no meio (perdeu). */
  forfeit: string | null;
  /** Os dois lados da mesa no lobby: quem senta em cada um e o bot (o do outro lado). */
  lobby?: {
    slots: [string | null, string | null];
    bot: { slot: 0 | 1; level: 'facil' | 'medio' | 'dificil' } | null;
    botName: string;
  };
  /** Números da partida, depois do fim. */
  stats?: {
    seconds: number;
    longest: number;
    fastest: number;
    smashes: [number, number];
    hits: [number, number];
  };
}

/** O Fut Fox em sala (spec 046): formato, times, bots e quem está em campo. O fluxo da partida vem em "bs". */
export interface BolaRoomState {
  me: string | null;
  format: { teams: number; perTeam: number; auto: boolean; minutes: number };
  /** O formato que combina com a quantidade de pessoas da sala. */
  suggested: { teams: number; perTeam: number };
  /** Time de cada pessoa; quem não está aqui é espectador. */
  teamOf: Record<string, number>;
  /** Bots pedidos por time (lobby). */
  bots: number[];
  roster: { slot: number; id: string; name: string; team: number; bot: boolean; away: boolean }[];
  scores: number[];
  winner: number | null;
  durationSec: number;
  /** Quem simula a partida: o servidor, o aparelho do líder (`p2p`), ou `pending` enquanto os aparelhos conectam (spec 048). */
  net: 'server' | 'pending' | 'p2p';
  /** O aparelho que simula no modo ponto a ponto. */
  p2pHost: string | null;
  /** O que o aparelho que simula precisa para montar a partida. */
  setup: {
    teams: number;
    perTeam: number;
    durationSec: number;
    seed: string;
    humans: { id: string; name: string; team: number }[];
    bots: number[];
    away: string[];
  } | null;
}

/** Counter Fox em sala (spec 057): regras, quem joga e a tabela de pontos (o quadro rápido vem por `fss`). */
export interface FoxShotRoomState {
  minutes: number;
  bots: number;
  /** 'bomb' = modo Bomba (spec 059); times escolhidos no lobby (0 contra-terrorista, 1 terrorista). */
  kind?: 'none' | 'dm' | 'bomb';
  botsCt?: number;
  botsTr?: number;
  winRounds?: number;
  roundSec?: number;
  /** O mapa da sala: a Duna, ou a arena de blocos no PvP. */
  map?: 'duna' | 'pvp';
  /** Modo PvP (variante do Bomba: sem bomba, dinheiro infinito, mapa próprio). */
  pvp?: boolean;
  /** Time de cada pessoa no modo Bomba: 0 contra-terrorista, 1 terrorista, 2 espectando. */
  teams?: Record<string, 0 | 1 | 2>;
  startAt: number | null;
  roster: { id: string; name: string; bot: boolean }[] | null;
  hz: number;
  over: boolean;
  score: { id: string; name: string; points: number; kills: number; assists: number; deaths: number }[] | null;
  /** Modo Bomba: rounds ganhos por lado e o lado de cada um. */
  bomb?: { tr: number; ct: number; winner: 'tr' | 'ct' | null; sides: Record<string, 'tr' | 'ct'> } | null;
  /** Quem simula (spec 060): a sala (`server`), os aparelhos tentando ligar no do líder (`pending`) ou o do líder (`p2p`). */
  net?: 'server' | 'pending' | 'p2p';
  p2pHost?: string | null;
  setup?: Record<string, unknown> | null;
}

export interface RoomSnapshot {
  code: string;
  game: RoomGame;
  /** Sala do Fox Cap!: o líder escolhe e troca o jogo no lobby (spec 049). */
  flex: boolean;
  /** Modo da sala (Cor: classic, flash, blind; Tempo: classic, strict, sequence). */
  mode: string;
  phase: Phase;
  hostId: string | null;
  settings: RoomSettings;
  maxPlayers: number;
  members: RoomMember[];
  round: {
    index: number;
    total: number;
    seed: string;
    endsAt: number | null;
    results: RoundResult[] | null;
  } | null;
  final: FinalRow[] | null;
  /** Chat da sala: aberto agora? e quem o líder silenciou. */
  chat: { open: boolean; muted: string[] };
  /** Pausa do jogo (só o líder): `at` = hora (do servidor) em que parou, `resumeAt` = fim da contagem de volta, `total` = pausado até aqui. */
  pause?: RoomPause | null;
  /** O id desta pessoa na sala (vale também para convidados). */
  me?: string | null;
  impostor?: ImpostorState;
  eco?: EcoRoomState;
  atravessa?: AtravessaRoomState;
  desmorona?: DesmoronaRoomState;
  foxgp?: FoxGpRoomState;
  bola?: BolaRoomState;
  pingpong?: PingRoomState;
  foxshot?: FoxShotRoomState;
}

/** Estado do Intruso, por pessoa: cor, dica e papéis só chegam a quem pode vê-los. */
export interface ImpostorState {
  /** Quantos intrusos há (no lobby: quantos haveria com a sala de agora). */
  count: number;
  anonymous?: boolean;
  participants?: string[];
  /** Seu papel na rodada; `null` fora dela. */
  role?: 'crew' | 'impostor' | null;
  /** A cor: só para a tripulação ao decorar, e para todos na revelação. */
  color?: Hsb | null;
  /** A dica: só para os intrusos, e para todos na revelação. */
  hint?: string | null;
  colorName?: string | null;
  /** Cor em que os controles começam (a mesma para todos). */
  start?: Hsb;
  /** Quem já votou (sem dizer em quem). */
  voted?: string[];
  myVote?: string | null;
  reveal?: {
    impostors: string[];
    caught: string[];
    counts: Record<string, number>;
    points: Record<string, number>;
    /** `null` quando o voto é anônimo. */
    votes: { voter: string; target: string }[] | null;
  } | null;
}

export type RoomStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';

interface RoomState {
  status: RoomStatus;
  snapshot: RoomSnapshot | null;
  /** @usuários que convidei há pouco (o botão fica "Enviado" por alguns segundos e volta). */
  invited: string[];
  /** Quem já convidei alguma vez nesta sala (o botão vira "Convidar de novo"). */
  invitedEver: string[];
  /** Último erro de regra (ex.: "Falta gente marcar pronto") ou motivo de ter saído. */
  message: string;
  /** De qual jogo era a última sala: ao sair, a pessoa volta para a página dele. */
  lastGame: RoomGame | null;
  chat: ChatMessage[];
  /** Mensagens de outras pessoas que ainda não vi (chat fechado). */
  unread: number;
  /** Aviso rápido da sala (alguém saiu): some sozinho. */
  notice: { text: string; id: number } | null;
}

export const useRoom = create<RoomState>(() => ({
  status: 'idle',
  snapshot: null,
  invited: [],
  invitedEver: [],
  message: '',
  lastGame: null,
  chat: [],
  unread: 0,
  notice: null,
}));

/** Quanto tempo o botão Convidar fica em "Enviado" antes de poder chamar a pessoa de novo. */
export const INVITE_COOLDOWN_MS = 8_000;
const TOKEN_KEY = 'nocap-room-token';
const wsUrl = () => apiBase.replace(/^http/, 'ws');
/** O cliente Colyseus é pesado: só carrega quando alguém entra numa sala (o aviso de convite não precisa dele). */
async function client() {
  const { Client } = await import('colyseus.js');
  return new Client(wsUrl());
}

let room: Room | null = null;

/** Mensagens frequentes da sala (as posições do Atravessa!) não passam pelo estado: quem quer, assina. */
type LiveType =
  | 'pos'
  | 'ack'
  | 'dsteps'
  | 'dpushed'
  | 'bs'
  | 'rtc'
  | 'bswitch'
  | 'fin'
  | 'pev'
  | 'prej'
  | 'ppads'
  | 'fss'
  | 'grin'
  | 'grsnap'
  | 'grev';
const live: Record<LiveType, Set<(m: unknown) => void>> = {
  pos: new Set(),
  ack: new Set(),
  dsteps: new Set(),
  dpushed: new Set(),
  bs: new Set(),
  rtc: new Set(),
  bswitch: new Set(),
  fin: new Set(),
  pev: new Set(),
  prej: new Set(),
  ppads: new Set(),
  fss: new Set(),
  grin: new Set(),
  grsnap: new Set(),
  grev: new Set(),
};
/** Só no desenvolvimento e nos testes de tela: injeta uma mensagem como se tivesse vindo da sala. */
if (import.meta.env.DEV && typeof window !== 'undefined')
  (window as unknown as { __emitLive?: (t: LiveType, m: unknown) => void }).__emitLive = (t, m) =>
    live[t].forEach((fn) => fn(m));
export function subscribeRoom(type: LiveType, fn: (m: unknown) => void): () => void {
  live[type].add(fn);
  return () => void live[type].delete(fn);
}
/**
 * Muda a cada saída ou nova conexão. Uma reconexão que começou antes disso é de uma sala que a
 * pessoa já deixou, e não pode puxá-la de volta quando finalmente conectar.
 */
let epoch = 0;
let offsets: number[] = [];
let lastRtt = 0;
/** As últimas idas e voltas medidas (ms): a mediana delas é o que se mostra, para uma medida isolada (a página ocupada, um pico) não valer. */
let rtts: number[] = [];

/** Ida e volta até o servidor (ms): a mediana das últimas medidas. */
export const currentRtt = (): number => {
  if (rtts.length === 0) return lastRtt;
  const sorted = [...rtts].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};

export interface RoomPause {
  at: number | null;
  resumeAt: number | null;
  total: number;
}

export function serverNow(): number {
  const median =
    offsets.length > 0 ? [...offsets].sort((a, b) => a - b)[Math.floor(offsets.length / 2)]! : 0;
  return Date.now() + median;
}

/**
 * Quanto tempo de jogo já foi "comido" por pausas (ms): cresce em tempo real enquanto pausado e fica parado depois. O
 * relógio do jogo é a hora do servidor menos isto, então tudo que anda por ele congela na pausa e continua de onde parou.
 */
export function pausedMs(): number {
  const p = useRoom.getState().snapshot?.pause;
  if (!p) return 0;
  const now = serverNow();
  if (p.at === null) return p.total;
  // a contagem de volta acabou: vale já, sem esperar o estado novo chegar
  if (p.resumeAt !== null && now >= p.resumeAt) return p.total + (p.resumeAt - p.at);
  return p.total + (now - p.at);
}

/** O jogo está parado agora? (pausado e a contagem de volta ainda não acabou) */
export function gameFrozen(): boolean {
  const p = useRoom.getState().snapshot?.pause;
  if (!p || p.at === null) return false;
  return !(p.resumeAt !== null && serverNow() >= p.resumeAt);
}

/** A hora do jogo (servidor, sem pausas). */
export const gameNow = (): number => serverNow() - pausedMs();

/** Converte um instante do relógio do servidor para o relógio deste aparelho. */
export const toLocal = (serverMs: number): number => serverMs - (serverNow() - Date.now());

const set = (patch: Partial<RoomState>) => useRoom.setState(patch);

/** A conta já está em uma sala (outra que a pedida): só entra depois de sair dela. */
export class RoomConflictError extends Error {
  constructor(readonly code: string | null) {
    super(code ? `Você já está na sala ${code}.` : 'Você já está em outra sala.');
  }
}

/** Erro do servidor "Você já está na sala ABCD" vira `RoomConflictError` (com o código, se veio). */
function asConflict(e: unknown): RoomConflictError | null {
  if (e instanceof RoomConflictError) return e;
  const message = e instanceof Error ? e.message : '';
  if (!/já está (na sala|em outra sala)/i.test(message)) return null;
  return new RoomConflictError(/sala ([A-Z]{4})/.exec(message)?.[1] ?? null);
}

/** Mensagem em pt-BR para erro de entrada (sala inexistente, cheia, sem login...). */
export function joinErrorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : '';
  // Erros do apelido já vêm prontos do servidor (repetido, inválido, de uma conta).
  if (/apelido|Muitas tentativas/i.test(message)) return message;
  if (/not found|no rooms|invalid room/i.test(message))
    return 'Não achamos essa sala. Confira o código.';
  if (/cheia/i.test(message)) return 'A sala está cheia.';
  if (/começou/i.test(message)) return 'A partida dessa sala já começou.';
  if (/conta|sessão/i.test(message)) return 'Entre na sua conta para jogar em sala.';
  return message || 'Não foi possível entrar na sala.';
}

function remember(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* sem storage: não reconecta depois de recarregar */
  }
}

/** Apelidos de quem entrou sem conta nesta sala: aparecem sem o @ (que é de conta). */
const guestNames = new Set<string>();

/** Como mostrar um nome da sala: `@usuario` para conta, o apelido puro para visitante. */
export const at = (username?: string | null): string =>
  !username ? '?' : guestNames.has(username) ? username : `@${username}`;

function attach(r: Room) {
  room = r;
  guestNames.clear();
  remember(r.reconnectionToken);
  set({ status: 'connected', message: '' });

  r.onMessage('snapshot', (s: RoomSnapshot) => {
    for (const m of s.members) if (m.guest) guestNames.add(m.username);
    // sala do Fox Cap!: ao sair, volta para a tela do jogo escolhido (e para a lista só se ainda não havia jogo)
    lastAlive = Date.now();
    set({ snapshot: s, status: 'connected', lastGame: s.game });
  });
  r.onMessage('pong', (m: { t0?: number; ts?: number }) => {
    lastAlive = Date.now();
    if (typeof m?.t0 === 'number' && typeof m?.ts === 'number') {
      lastRtt = Math.max(0, Date.now() - m.t0);
      rtts = [...rtts, lastRtt].slice(-5);
      const offset = m.ts - (m.t0 + Date.now()) / 2;
      offsets = [...offsets, offset].slice(-5);
    }
  });
  offsets = [];
  lastRtt = 0;
  rtts = [];
  r.send('ping', { t0: Date.now(), rtt: lastRtt });
  // Logo depois, de novo: o primeiro já leva o tempo de ida e volta que o servidor usa na Arena.
  setTimeout(() => room === r && r.send('ping', { t0: Date.now(), rtt: lastRtt }), 1500);
  // a cada 2 s (antes 20 s): o ping do painel e o relógio da partida acompanham a rede de agora, não a de 20 s atrás
  const pingInterval = setInterval(() => {
    if (room !== r) {
      clearInterval(pingInterval);
      return;
    }
    r.send('ping', { t0: Date.now(), rtt: lastRtt });
  }, 2_000);

  for (const type of [
    'pos',
    'ack',
    'dsteps',
    'dpushed',
    'bs',
    'rtc',
    'bswitch',
    'fin',
    'pev',
    'prej',
    'ppads',
    'fss',
    'grin',
    'grsnap',
    'grev',
  ] as const)
    r.onMessage(type, (m: unknown) => live[type].forEach((fn) => fn(m)));
  r.onMessage('chat', (m: ChatMessage) =>
    useRoom.setState((s) => ({
      chat: [...s.chat, m].slice(-50),
      unread: s.unread + (m.userId === useAuth.getState().user?.id ? 0 : 1),
    })),
  );
  r.onMessage('chatHistory', (list: ChatMessage[]) => set({ chat: list, unread: 0 }));
  r.onMessage('notice', (m: { text?: unknown }) => {
    if (typeof m?.text === 'string') showNotice(m.text);
  });
  r.onMessage('closed', () => finish('A sala foi encerrada pelo líder.'));
  r.onMessage('error', (m: string) => set({ message: m }));
  r.onMessage('invited', (m: { username: string }) => {
    const s = useRoom.getState();
    set({
      invited: [...new Set([...s.invited, m.username])],
      invitedEver: [...new Set([...s.invitedEver, m.username])],
      message: '',
    });
    // Convite enviado não trava o botão para sempre: dá para chamar a pessoa de novo.
    setTimeout(() => {
      if (room !== r) return;
      set({ invited: useRoom.getState().invited.filter((u) => u !== m.username) });
    }, INVITE_COOLDOWN_MS);
  });
  r.onLeave((code) => {
    if (room !== r) return;
    // 4000: saí por conta própria; 4001: fui expulso; 4002: entrei por outro aparelho.
    if (code === 4000) return finish('');
    if (code === 4001) return finish('Você foi removido da sala.');
    if (code === 4002) return finish('Você entrou nessa sala por outro aparelho.');
    // 4003: o líder encerrou a sala (chega junto do aviso `closed`, e vale se o aviso se perder)
    if (code === 4003) return finish('A sala foi encerrada pelo líder.');
    // A conexão morreu: a referência velha sai (senão a reconexão achava que "já estava conectado" e nunca tentava).
    room = null;
    void reconnect();
  });
  watch(r);
}

/** O app limpa o registro da sala da conta (o aviso "Você está na sala"): `false` = já some da tela; `true` = confirma com o servidor. */
let onRoomGone: ((settled: boolean) => void) | null = null;
export function setOnRoomGone(fn: ((settled: boolean) => void) | null) {
  onRoomGone = fn;
}

/**
 * Conexão "meio morta" (troca de rede, aparelho que dormiu): o navegador demora a notar. Se a sala não responde
 * ao ping, fecha a conexão na hora para a reconexão começar, e ao voltar para o app ou à internet confere já.
 */
let lastAlive = 0;
let watching = false;
function checkAlive(r: Room, wait = 4000) {
  if (room !== r) return;
  const sent = Date.now();
  r.send('ping', { t0: sent, rtt: lastRtt });
  setTimeout(() => {
    if (room !== r || lastAlive >= sent) return;
    // sem resposta: fecha; o `onLeave` assume daqui
    try {
      r.connection.close(4999, 'sem resposta');
    } catch {
      /* já fechada */
    }
  }, wait);
}
function watch(r: Room) {
  lastAlive = Date.now();
  if (watching || typeof document === 'undefined') return;
  watching = true;
  const check = () => {
    if (room) checkAlive(room);
    else nudge?.();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('online', check);
  window.addEventListener('pageshow', check);
  // e de vez em quando, com a aba aberta
  setInterval(() => {
    if (room && Date.now() - lastAlive > 25_000) checkAlive(room);
  }, 10_000);
  void r;
}
/** Acorda a espera entre tentativas de reconexão (a pessoa voltou para o app ou a internet voltou). */
let nudge: (() => void) | null = null;

function finish(message: string, voluntary = false) {
  room = null;
  epoch++;
  remember(null);
  set({
    status: 'closed',
    snapshot: null,
    invited: [],
    invitedEver: [],
    message,
    notice: null,
    chat: [],
    unread: 0,
  });
  // Saída da pessoa: o registro do servidor só é confirmado depois do HTTP de saída (`leaveRoom`).
  onRoomGone?.(false);
  if (!voluntary) onRoomGone?.(true);
}

/** Só uma reconexão por vez (a conexão pode cair de novo, ou vários gatilhos chamarem juntos). */
let reconnecting: Promise<void> | null = null;

/**
 * Queda de conexão (tela bloqueada, rede): tenta voltar por até ~1 minuto, logo de cara e depois com pausas que
 * crescem; voltar para o app ou à internet acorda a espera. Ao recarregar a página a sala pode já ter sumido
 * (servidor reiniciou), então lá são poucas tentativas.
 */
function reconnect(tries = 30): Promise<void> {
  reconnecting ??= doReconnect(tries).finally(() => {
    reconnecting = null;
  });
  return reconnecting;
}

async function doReconnect(tries: number) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) return finish('A conexão com a sala caiu.');
  const mine = epoch;
  set({ status: 'reconnecting' });
  const started = Date.now();
  for (let i = 0; i < tries; i++) {
    if (room || epoch !== mine) return; // conectou por outro caminho, ou a pessoa já saiu
    try {
      const back = await (await client()).reconnect(token);
      if (epoch !== mine) {
        // Saiu enquanto a conexão se refazia: não fica na sala escondida.
        void back.leave(true);
        return;
      }
      attach(back);
      return;
    } catch (e) {
      // A sala não existe mais (servidor reiniciou ou a vaga expirou): insistir só deixa a tela travada.
      const gone = /expired|not found|invalid|disposed|4212|4202/i.test(
        e instanceof Error ? e.message : String(e),
      );
      if (gone && (tries < 30 || i >= 3 || Date.now() - started > 8000)) break;
      await new Promise<void>((ok) => {
        const t = setTimeout(ok, Math.min(3000, 800 + i * 400));
        nudge = () => {
          clearTimeout(t);
          ok();
        };
      });
      nudge = null;
    }
  }
  if (room || epoch !== mine) return;
  finish(tries < 30 ? '' : 'Não deu para voltar para a sala. Entre de novo pelo código.');
}

let resuming: Promise<boolean> | null = null;

/**
 * Ao reabrir a página no meio de uma partida. Execução única: o React pode chamar duas vezes
 * (modo dev) e uma segunda tentativa não pode derrubar a conexão que a primeira conseguiu.
 */
export function resumeRoom(): Promise<boolean> {
  if (room) return Promise.resolve(true);
  if (!sessionStorage.getItem(TOKEN_KEY)) return Promise.resolve(false);
  // O servidor leva alguns segundos para notar que a aba antiga fechou.
  resuming ??= reconnect(6)
    .then(() => !!room)
    .finally(() => {
      resuming = null;
    });
  return resuming;
}

/**
 * Entrar ou criar com a conta já numa sala: só depois de sair dela. Quem está conectado aqui
 * recebe o conflito direto; o resto o servidor responde (409) e `asConflict` traduz.
 */
function assertFree(code?: string) {
  const live = useRoom.getState().snapshot?.code;
  if (room && live && live !== code) throw new RoomConflictError(live);
}

async function connect(open: (c: Awaited<ReturnType<typeof client>>) => Promise<Room>) {
  set({ status: 'connecting', message: '' });
  try {
    const r = await open(await client());
    set({ snapshot: null, lastGame: null });
    attach(r);
  } catch (e) {
    // Falhou: se ainda há sala viva aqui, ela continua sendo a sala da pessoa.
    set({ status: room ? 'connected' : 'idle' });
    const conflict = asConflict(e);
    if (conflict) throw conflict;
    throw new Error(joinErrorMessage(e));
  }
}

const NICK_KEY = 'nocap-room-nick';

/** O apelido de quem joga sem conta: vale só na sala e só nesta aba (some ao fechar). */
export function getGuestNickname(): string {
  try {
    return sessionStorage.getItem(NICK_KEY) ?? '';
  } catch {
    return nickMemory;
  }
}
let nickMemory = '';
export function setGuestNickname(nick: string) {
  nickMemory = nick;
  try {
    sessionStorage.setItem(NICK_KEY, nick);
  } catch {
    /* sem storage: o apelido vale até recarregar */
  }
}

/** Como a pessoa se apresenta à sala: pela conta ou, sem conta, só pelo apelido. */
function entryOptions(): { token: string; q: 1 } | { guest: true; nickname: string; q: 1 } {
  const token = getToken();
  // `q: 1` = este site entende o quadro compacto do Fut Fox (menor e mais rápido de mandar)
  return token ? { token, q: 1 } : { guest: true, nickname: getGuestNickname(), q: 1 };
}

export async function createRoom(game: RoomGame = 'color') {
  assertFree();
  const options = entryOptions();
  await connect((c) => c.create(game, options));
}

export async function joinRoom(code: string) {
  const wanted = code.trim().toUpperCase();
  if (room && (room.roomId === wanted || useRoom.getState().snapshot?.code === wanted)) return; // já estou nela
  assertFree(wanted);
  const options = entryOptions();
  await connect((c) => c.joinById(wanted, options));
}

/** O código da sala em que este aparelho está conectado (vale já na conexão, antes do primeiro estado). */
export const currentRoomCode = (): string | null => room?.roomId ?? null;

/** Aviso rápido por cima de qualquer tela (quem saiu, sala encerrada): some sozinho. */
export function showNotice(text: string) {
  const id = Date.now();
  useRoom.setState({ notice: { text, id } });
  setTimeout(() => {
    if (useRoom.getState().notice?.id === id) useRoom.setState({ notice: null });
  }, 4500);
}

export function clearLastGame() {
  useRoom.setState({ lastGame: null });
}

/** O servidor responde "saiu" mesmo que a conexão da sala já tenha caído. */
export const leaveRoomOnServer = () =>
  apiClient.post<{ left: boolean }>('/me/room/leave', {}).catch((e: unknown) => {
    // Sem sessão não há o que desfazer lá; qualquer outro erro, quem chamou decide.
    if (e instanceof ApiError && e.status === 401) return { left: false };
    throw e;
  });

/**
 * Sair da sala. A tela já fica livre na hora; por baixo, avisa a sala pela conexão e também o
 * servidor pelo HTTP, que vale mesmo quando a conexão caiu (senão a conta ficaria "dentro" por
 * até um minuto, sem ninguém dizer isso).
 */
export async function leaveRoom(): Promise<void> {
  const r = room;
  finish('', true);
  const viaSocket = r
    ? Promise.race([r.leave(true), new Promise((ok) => setTimeout(ok, 1500))]).catch(
        () => undefined,
      )
    : Promise.resolve();
  await Promise.all([viaSocket, leaveRoomOnServer().catch(() => undefined)]);
  onRoomGone?.(true);
}

/** Convida um amigo para a sala em que estou (só no lobby). */
export function inviteFriend(username: string) {
  sendRoom('invite', { username });
}

/** Líder: encerra a sala e tira todo mundo dela. */
export function closeRoom() {
  sendRoom('close');
}

export function sendChat(text: string) {
  sendRoom('chat', { text });
}

/** Líder: silencia ou libera alguém no chat. */
export function muteMember(id: string) {
  sendRoom('mute', { id });
}

export function markChatRead() {
  if (useRoom.getState().unread) set({ unread: 0 });
}

/** Mensagem que não limpa o aviso da tela nem mexe no estado (o analógico, muitas vezes por segundo). */
export function sendRoomQuiet(type: string, payload?: unknown) {
  room?.send(type, payload);
}

export function sendRoom(type: string, payload?: unknown) {
  set({ message: '' });
  room?.send(type, payload);
}

export const CODE_RE = /^[A-HJ-NP-Z]{4}$/;

// só no desenvolvimento: derruba a conexão da sala como se a rede tivesse caído (teste da reconexão)
if (import.meta.env.DEV && typeof window !== 'undefined')
  (window as unknown as { __dropRoom?: () => void }).__dropRoom = () => {
    room?.connection.close(4998, 'teste');
  };

// só no desenvolvimento: os testes de ponta a ponta injetam estado para ver telas que dependem de uma sala
if (import.meta.env.DEV && typeof window !== 'undefined')
  (window as unknown as { __room?: unknown }).__room = useRoom;

/**
 * O id desta pessoa na sala. Quem tem conta usa o da conta; convidado (só apelido) não tem conta no aparelho, então o
 * servidor manda o id dele dentro do estado do jogo (`me`). Sem isso um convidado era tratado como espectador.
 */
export function meOf(snapshot: RoomSnapshot | null, userId?: string): string | undefined {
  return (
    userId ??
    snapshot?.me ??
    snapshot?.bola?.me ??
    snapshot?.desmorona?.me ??
    snapshot?.foxgp?.me ??
    snapshot?.atravessa?.me ??
    undefined
  );
}

export function useMeId(): string | undefined {
  const userId = useAuth((st) => st.user?.id);
  const snapshot = useRoom((st) => st.snapshot);
  return meOf(snapshot, userId);
}
