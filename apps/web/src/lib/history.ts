import {
  colorDeltaE,
  colorPresets,
  decodeAnswer,
  generateColorRound,
  generateTimeRound,
  scoreFromDeltaE,
  scoreTime,
  timePresets,
  type Hsb,
} from '@nocap/games';
import { apiClient } from './api-client';
import { getToken } from './auth';
import { getGuestId } from './guest';

export interface HistoryItem {
  matchId: string;
  game: string;
  mode: string;
  kind: string;
  seed: string;
  playedAt: string;
  /** Décimos (500 = 50.0). */
  totalScore: number;
  placement: number | null;
  answers: number[] | null;
}

export interface HistoryPage {
  items: HistoryItem[];
  nextCursor: string | null;
}

export function fetchHistory(cursor?: string) {
  const qs = new URLSearchParams({ limit: '20' });
  if (cursor) qs.set('cursor', cursor);
  // Com conta: histórico de todos os aparelhos vinculados. Sem conta: só deste aparelho.
  const path = getToken() ? '/me/matches' : `/players/${getGuestId()}/matches`;
  return apiClient.get<HistoryPage>(`${path}?${qs}`);
}

export interface HistoryRound {
  target: Hsb;
  guess: Hsb;
  score: number;
}

/**
 * Rodadas de uma partida de Cor: o alvo é regenerado pela seed e a nota recalculada.
 * `null` quando o detalhe já expirou (retenção das últimas 200) ou o modo é desconhecido.
 */
export function colorRounds(item: HistoryItem): HistoryRound[] | null {
  const settings = colorPresets[item.mode];
  if (!item.answers || !settings) return null;
  return item.answers.map((raw, index) => {
    const guess = decodeAnswer(raw);
    const target = generateColorRound(item.seed, settings, index);
    return { target, guess, score: scoreFromDeltaE(colorDeltaE(target, guess)) };
  });
}

export interface TimeHistoryRound {
  target: number;
  answer: number;
  score: number;
}

/** Rodadas de uma partida do Tempo: o alvo é regenerado pela seed e a nota recalculada. */
export function timeRounds(item: HistoryItem): TimeHistoryRound[] | null {
  const settings = timePresets[item.mode];
  if (!item.answers || !settings) return null;
  return item.answers.map((answer, index) => {
    const target = generateTimeRound(item.seed, settings, index);
    return { target, answer, score: scoreTime(target, answer, settings) };
  });
}

/** Máximo de pontos da partida (10 por rodada); sala usa o número de respostas guardadas. */
export function matchMax(item: Pick<HistoryItem, 'game' | 'mode' | 'answers'>): number {
  const rounds =
    item.game === 'time'
      ? timePresets[item.mode]?.rounds
      : item.game === 'color'
        ? colorPresets[item.mode]?.rounds
        : undefined;
  return (rounds ?? item.answers?.length ?? 5) * 10;
}

const MODE_NAME: Record<string, string> = {
  classic: 'Clássico',
  flash: 'Flash',
  quick: 'Rápido',
  strict: 'Sem estourar',
};
const GAME_NAME: Record<string, string> = { color: 'Cor', time: 'Tempo' };
const KIND_NAME: Record<string, string> = { solo: 'Solo', daily: 'Daily', room: 'Sala' };

export const gameLabel = (game: string) => GAME_NAME[game] ?? game;
export const modeLabel = (mode: string) => MODE_NAME[mode] ?? mode;
export const kindLabel = (kind: string) => KIND_NAME[kind] ?? kind;

/** dd/mm HH:mm em horário de São Paulo, montado à mão para não depender do locale do aparelho. */
export function formatPlayedAt(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')} ${get('hour')}:${get('minute')}`;
}
