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
  'color' | 'time' | 'impostor' | 'eco' | 'atravessa' | 'desmorona' | 'bola' | 'foxcap';
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
  impostor?: ImpostorState;
  eco?: EcoRoomState;
  atravessa?: AtravessaRoomState;
  desmorona?: DesmoronaRoomState;
  bola?: BolaRoomState;
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
type LiveType = 'pos' | 'ack' | 'dsteps' | 'dpushed' | 'bs' | 'rtc' | 'bswitch';
const live: Record<LiveType, Set<(m: unknown) => void>> = {
  pos: new Set(),
  ack: new Set(),
  dsteps: new Set(),
  dpushed: new Set(),
  bs: new Set(),
  rtc: new Set(),
  bswitch: new Set(),
};
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

/** Última ida e volta medida até o servidor (ms). */
export const currentRtt = (): number => lastRtt;

export function serverNow(): number {
  const median =
    offsets.length > 0 ? [...offsets].sort((a, b) => a - b)[Math.floor(offsets.length / 2)]! : 0;
  return Date.now() + median;
}

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
    // sala do Fox Cap!: ao sair, a pessoa volta ao Fox Cap! (e não à página do jogo que estava no lobby)
    set({ snapshot: s, status: 'connected', lastGame: s.flex ? 'foxcap' : s.game });
  });
  r.onMessage('pong', (m: { t0?: number; ts?: number }) => {
    if (typeof m?.t0 === 'number' && typeof m?.ts === 'number') {
      lastRtt = Math.max(0, Date.now() - m.t0);
      const offset = m.ts - (m.t0 + Date.now()) / 2;
      offsets = [...offsets, offset].slice(-5);
    }
  });
  offsets = [];
  lastRtt = 0;
  r.send('ping', { t0: Date.now(), rtt: lastRtt });
  // Logo depois, de novo: o primeiro já leva o tempo de ida e volta que o servidor usa na Arena.
  setTimeout(() => room === r && r.send('ping', { t0: Date.now(), rtt: lastRtt }), 1500);
  const pingInterval = setInterval(() => {
    if (room !== r) {
      clearInterval(pingInterval);
      return;
    }
    r.send('ping', { t0: Date.now(), rtt: lastRtt });
  }, 20_000);

  for (const type of ['pos', 'ack', 'dsteps', 'dpushed', 'bs', 'rtc', 'bswitch'] as const)
    r.onMessage(type, (m: unknown) => live[type].forEach((fn) => fn(m)));
  r.onMessage('chat', (m: ChatMessage) =>
    useRoom.setState((s) => ({
      chat: [...s.chat, m].slice(-50),
      unread: s.unread + (m.userId === useAuth.getState().user?.id ? 0 : 1),
    })),
  );
  r.onMessage('chatHistory', (list: ChatMessage[]) => set({ chat: list, unread: 0 }));
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
    void reconnect();
  });
}

function finish(message: string) {
  room = null;
  epoch++;
  remember(null);
  set({
    status: 'closed',
    snapshot: null,
    invited: [],
    invitedEver: [],
    message,
    chat: [],
    unread: 0,
  });
}

/**
 * Queda de conexão (tela bloqueada, rede): tenta voltar por até ~1 minuto. Ao recarregar a
 * página a sala pode já ter sumido (servidor reiniciou), então lá são poucas tentativas.
 */
async function reconnect(tries = 30) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) return finish('A conexão com a sala caiu.');
  const mine = epoch;
  set({ status: 'reconnecting' });
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
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (room || epoch !== mine) return;
  finish(tries < 30 ? '' : 'Não deu para voltar para a sala.');
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
function entryOptions(): { token: string } | { guest: true; nickname: string } {
  const token = getToken();
  return token ? { token } : { guest: true, nickname: getGuestNickname() };
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
  finish('');
  const viaSocket = r
    ? Promise.race([r.leave(true), new Promise((ok) => setTimeout(ok, 1500))]).catch(
        () => undefined,
      )
    : Promise.resolve();
  await Promise.all([viaSocket, leaveRoomOnServer().catch(() => undefined)]);
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

// só no desenvolvimento: os testes de ponta a ponta injetam estado para ver telas que dependem de uma sala
if (import.meta.env.DEV && typeof window !== 'undefined')
  (window as unknown as { __room?: unknown }).__room = useRoom;
