import type { Room } from 'colyseus.js';
import type { Hsb, TimeSettings } from '@nocap/games';
import { create } from 'zustand';
import { apiBase } from './api-client';
import { getToken } from './auth';

export type RoomGame = 'color' | 'time';
export type Phase = 'lobby' | 'show' | 'pick' | 'play' | 'reveal' | 'final';

export interface ColorRoomSettings {
  rounds: number;
  showMs: number;
  pickMs: number;
}
export type TimeRoomSettings = TimeSettings;
/** As regras dependem do jogo da sala (`snapshot.game`). */
export type RoomSettings = ColorRoomSettings & TimeRoomSettings;

export interface RoomMember {
  id: string;
  username: string;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  locked: boolean;
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

export interface RoomSnapshot {
  code: string;
  game: RoomGame;
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
}

export type RoomStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';

interface RoomState {
  status: RoomStatus;
  snapshot: RoomSnapshot | null;
  /** @usuários que já convidei para esta sala (some o botão e mostra "Convite enviado"). */
  invited: string[];
  /** Último erro de regra (ex.: "Falta gente marcar pronto") ou motivo de ter saído. */
  message: string;
}

export const useRoom = create<RoomState>(() => ({
  status: 'idle',
  snapshot: null,
  invited: [],
  message: '',
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

  r.onMessage('snapshot', (s: RoomSnapshot) => set({ snapshot: s, status: 'connected' }));
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
  set({ status: 'closed', snapshot: null, invited: [], message });
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
  set({ status: 'connecting', message: '', snapshot: null });
  try {
    attach(await (await client()).create(game, { token: getToken() }));
  } catch (e) {
    set({ status: 'idle' });
    throw new Error(joinErrorMessage(e));
  }
}

export async function joinRoom(code: string) {
  set({ status: 'connecting', message: '', snapshot: null });
  try {
    attach(await (await client()).joinById(code.trim().toUpperCase(), { token: getToken() }));
  } catch (e) {
    set({ status: 'idle' });
    throw new Error(joinErrorMessage(e));
  }
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

export function sendRoom(type: string, payload?: unknown) {
  set({ message: '' });
  room?.send(type, payload);
}

export const CODE_RE = /^[A-HJ-NP-Z]{4}$/;
