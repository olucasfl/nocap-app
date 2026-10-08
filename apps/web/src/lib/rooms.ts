import type { Room } from 'colyseus.js';
import type { Hsb, LeaderRule, TimeSettings } from '@nocap/games';
import { create } from 'zustand';
import { apiBase } from './api-client';
import { getToken, useAuth } from './auth';

export type RoomGame = 'color' | 'time' | 'impostor' | 'eco';
export type Phase = 'lobby' | 'create' | 'show' | 'pick' | 'play' | 'vote' | 'reveal' | 'final';

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
/** As regras dependem do jogo da sala (`snapshot.game`). */
export type RoomSettings = ColorRoomSettings & TimeRoomSettings & ImpostorRoomSettings;

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
  /** @usuários que já convidei para esta sala (some o botão e mostra "Convite enviado"). */
  invited: string[];
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
  message: '',
  lastGame: null,
  chat: [],
  unread: 0,
}));

const TOKEN_KEY = 'nocap-room-token';
const wsUrl = () => apiBase.replace(/^http/, 'ws');
/** O cliente Colyseus é pesado: só carrega quando alguém entra numa sala (o aviso de convite não precisa dele). */
async function client() {
  const { Client } = await import('colyseus.js');
  return new Client(wsUrl());
}

let room: Room | null = null;

const set = (patch: Partial<RoomState>) => useRoom.setState(patch);

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
  r.onMessage('chat', (m: ChatMessage) =>
    useRoom.setState((s) => ({
      chat: [...s.chat, m].slice(-50),
      unread: s.unread + (m.userId === useAuth.getState().user?.id ? 0 : 1),
    })),
  );
  r.onMessage('chatHistory', (list: ChatMessage[]) => set({ chat: list, unread: 0 }));
  r.onMessage('closed', () => finish('A sala foi encerrada pelo líder.'));
  r.onMessage('error', (m: string) => set({ message: m }));
  r.onMessage('invited', (m: { username: string }) =>
    set({ invited: [...new Set([...useRoom.getState().invited, m.username])], message: '' }),
  );
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
  remember(null);
  set({ status: 'closed', snapshot: null, invited: [], message, chat: [], unread: 0 });
}

/**
 * Queda de conexão (tela bloqueada, rede): tenta voltar por até ~1 minuto. Ao recarregar a
 * página a sala pode já ter sumido (servidor reiniciou), então lá são poucas tentativas.
 */
async function reconnect(tries = 30) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) return finish('A conexão com a sala caiu.');
  set({ status: 'reconnecting' });
  for (let i = 0; i < tries; i++) {
    if (room) return; // outra tentativa já conectou
    try {
      attach(await (await client()).reconnect(token));
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (room) return;
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

export async function createRoom(game: RoomGame = 'color') {
  set({ status: 'connecting', message: '', snapshot: null, lastGame: null });
  try {
    attach(await (await client()).create(game, { token: getToken() }));
  } catch (e) {
    set({ status: 'idle' });
    throw new Error(joinErrorMessage(e));
  }
}

export async function joinRoom(code: string) {
  set({ status: 'connecting', message: '', snapshot: null, lastGame: null });
  try {
    attach(await (await client()).joinById(code.trim().toUpperCase(), { token: getToken() }));
  } catch (e) {
    set({ status: 'idle' });
    throw new Error(joinErrorMessage(e));
  }
}

export function clearLastGame() {
  useRoom.setState({ lastGame: null });
}

export function leaveRoom() {
  const r = room;
  finish('');
  void r?.leave(true);
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
