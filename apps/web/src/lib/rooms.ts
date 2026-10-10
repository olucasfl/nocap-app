import type { Room } from 'colyseus.js';
import type { Hsb, LeaderRule, TimeSettings } from '@nocap/games';
import { create } from 'zustand';
import { ApiError, apiBase, apiClient } from './api-client';
import { getToken, useAuth } from './auth';

export type RoomGame = 'color' | 'time' | 'impostor' | 'eco' | 'party';
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
export interface PartySettings {
  rounds: number;
}
/** As regras dependem do jogo da sala (`snapshot.game`). */
export type RoomSettings = ColorRoomSettings &
  TimeRoomSettings &
  ImpostorRoomSettings &
  PartySettings;

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
  rules?: LeaderRule[];
  timedOut?: boolean;
  /** Pódio do Siga o Líder: soma de acertos de cada pessoa como seguidora. */
  hits?: Record<string, number>;
}

export interface PartyShapeItem {
  id: number;
  kind:
    | 'circle'
    | 'triangle'
    | 'square'
    | 'rect'
    | 'diamond'
    | 'star'
    | 'hexagon'
    | 'cross'
    | 'pentagon'
    | 'heart';
  color: 'orange' | 'blue' | 'yellow' | 'green' | 'purple';
  at: number;
  life: number;
  cls: 'good' | 'bad' | 'neutral';
}

export interface PartyX1View {
  opponent: string;
  /** Meus pontos e os do adversário (nunca negativos). */
  myName: string;
  mine: number;
  theirs: number;
  /** Diferença do meu ponto de vista (+2 = estou 2 na frente). */
  lead: number;
  round: number;
  state: 'wait' | 'go' | 'between' | 'done';
  shot: { x: number; y: number } | null;
  goAt: number | null;
  last: {
    mine: number | null;
    theirs: number | null;
    won: boolean | null;
    /** Quanto MEU placar mudou no último disparo: +1, -1 ou 0 (já estava em zero). */
    delta: number;
    early: 'me' | 'them' | null;
  } | null;
  result: 'win' | 'tie' | 'loss' | null;
  duels: number;
  finished: number;
}

/** O que o aparelho precisa para mostrar o desafio (cada jogo usa os seus campos). */
export interface PartyChallenge {
  // Mesmíssima
  target?: Hsb;
  start?: Hsb;
  showMs?: number;
  blind?: boolean;
  // Já Deu?
  targetMs?: number;
  // Ecooo
  sequence?: number[];
  pads?: number;
  stepMs?: number;
  length?: number;
  // Digitação
  word?: string;
  /** Palavra solta ou frase (a tela mostra qual é). */
  kind?: 'palavra' | 'frase';
}

export interface PartySnapshot {
  totals: Record<string, number>;
  round: number;
  rounds: number;
  index: number;
  count: number;
  kind?: 'micro' | 'big';
  game?: 'color' | 'time' | 'eco' | 'typing' | 'shapes' | 'x1';
  variant?: string;
  position?: number;
  command?: string;
  info?: { title: string; lines: string[] };
  times?: { showAt: number; pickAt: number; endsAt: number };
  challenge?: PartyChallenge;
  submitted?: string[];
  ready?: string[];
  mine?: boolean;
  started?: boolean;
  delta?: Record<string, number>;
  /** Mesmíssima: a cor alvo e a que cada um travou (aparece no placar). */
  reveal?: { target: Hsb; answers: Record<string, Hsb> } | null;
  /** Digitação: texto mostrado, o que era para digitar (null na Mão Boba) e o que cada um enviou. */
  typingReveal?: {
    word: string;
    expected: string | null;
    kind: 'palavra' | 'frase';
    answers: Record<string, string>;
  } | null;
  /** Já Deu?: tempo certo, alvo mostrado e o tempo medido de cada um (em ms). */
  timeReveal?: { expectedMs: number; targetMs: number; answers: Record<string, number> } | null;
  autoStartAt?: number | null;
  shapes?: { items: PartyShapeItem[]; simSeed: string } | null;
  x1?: PartyX1View | null;
}

export interface RoomSnapshot {
  code: string;
  game: RoomGame;
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
  party?: PartySnapshot;
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
/**
 * Muda a cada saída ou nova conexão. Uma reconexão que começou antes disso é de uma sala que a
 * pessoa já deixou, e não pode puxá-la de volta quando finalmente conectar.
 */
let epoch = 0;
let offsets: number[] = [];
let lastRtt = 0;

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

function attach(r: Room) {
  room = r;
  remember(r.reconnectionToken);
  set({ status: 'connected', message: '' });

  r.onMessage('snapshot', (s: RoomSnapshot) =>
    set({ snapshot: s, status: 'connected', lastGame: s.game }),
  );
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

export async function createRoom(game: RoomGame = 'color') {
  assertFree();
  await connect((c) => c.create(game, { token: getToken() }));
}

export async function joinRoom(code: string) {
  const wanted = code.trim().toUpperCase();
  if (room && useRoom.getState().snapshot?.code === wanted) return; // já estou nela
  assertFree(wanted);
  await connect((c) => c.joinById(wanted, { token: getToken() }));
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

export function sendRoom(type: string, payload?: unknown) {
  set({ message: '' });
  room?.send(type, payload);
}

export const CODE_RE = /^[A-HJ-NP-Z]{4}$/;
