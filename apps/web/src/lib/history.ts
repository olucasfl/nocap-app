import {
  colorDeltaE,
  colorPresets,
  decodeAnswer,
  generateColorRound,
  generateTimeRound,
  presetFor,
  scoreFromDeltaE,
  scoreTime,
  timePresets,
  type Hsb,
} from '@nocap/games';
import { apiClient } from './api-client';

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

/** Histórico da conta (todos os aparelhos), separado por jogo. */
export function fetchHistory(game: 'color' | 'time', cursor?: string) {
  const qs = new URLSearchParams({ limit: '20', game });
  if (cursor) qs.set('cursor', cursor);
  return apiClient.get<HistoryPage>(`/me/matches?${qs}`);
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
  // Partidas antigas (5 rodadas) têm outro preset: escolhe pelo número de respostas guardadas.
  const settings = item.answers ? presetFor(item.mode, item.answers.length) : undefined;
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
      ? (item.answers ? presetFor(item.mode, item.answers.length) : timePresets[item.mode])?.rounds
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

export type Tone = 'top' | 'good' | 'mid' | 'low';

/**
 * Classificação da partida: em sala, a colocação ("1º lugar"); jogando sozinho, a faixa da nota
 * (CRAVOU, QUASE, MEH, ERROU) em relação ao máximo de pontos.
 */
export function classifyMatch(
  item: Pick<HistoryItem, 'game' | 'mode' | 'answers' | 'placement' | 'totalScore'>,
): { label: string; tone: Tone } {
  if (item.placement !== null) {
    return { label: `${item.placement}º lugar`, tone: item.placement === 1 ? 'top' : 'mid' };
  }
  const ratio = item.totalScore / 10 / matchMax(item);
  if (ratio >= 0.95) return { label: 'CRAVOU', tone: 'top' };
  if (ratio >= 0.8) return { label: 'QUASE', tone: 'good' };
  if (ratio >= 0.5) return { label: 'MEH', tone: 'mid' };
  return { label: 'ERROU', tone: 'low' };
}
