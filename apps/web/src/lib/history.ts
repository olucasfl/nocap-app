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
import { gradeOf, gradeWord } from './grade';

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

export interface RoomPlayer {
  username: string | null;
  placement: number | null;
  totalScore: number;
  isMe: boolean;
}

/** Quem jogou uma partida de sala em que estive, em ordem de colocação. */
export const fetchRoomPlayers = (matchId: string) =>
  apiClient.get<{ players: RoomPlayer[] }>(`/me/matches/${matchId}/room`);

export interface HistoryPage {
  items: HistoryItem[];
  nextCursor: string | null;
}

/** Histórico da conta (todos os aparelhos), separado por jogo. */
export interface HistoryFilters {
  /** Modo (classic, flash, quick...); `undefined` = todos. */
  mode?: string;
  /** Tipo de partida; `undefined` = todos. */
  kind?: 'solo' | 'daily' | 'room';
  period: 'all' | 'day' | 'week';
}

export const NO_FILTERS: HistoryFilters = { period: 'all' };

/** Quantos filtros estão ligados (para o contador e o botão de limpar). */
export const activeFilters = (f: HistoryFilters) =>
  (f.mode ? 1 : 0) + (f.kind ? 1 : 0) + (f.period !== 'all' ? 1 : 0);

export function fetchHistory(
  game: 'color' | 'time' | 'eco',
  cursor?: string,
  filters: HistoryFilters = NO_FILTERS,
) {
  const qs = new URLSearchParams({ limit: '20', game, period: filters.period });
  if (filters.mode) qs.set('mode', filters.mode);
  if (filters.kind) qs.set('kind', filters.kind);
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
        ? // O Daily da Cor tem 5 rodadas, o Clássico 3: vale o número de respostas guardadas.
          (item.answers?.length ?? colorPresets[item.mode]?.rounds)
        : undefined;
  return (rounds ?? item.answers?.length ?? 5) * 10;
}

/** Nota para mostrar: pontos/máximo, ou "N rodadas" na Sobrevivência. */
export function scoreParts(item: Pick<HistoryItem, 'game' | 'mode' | 'answers' | 'totalScore'>): {
  main: string;
  unit: string;
} {
  if (item.mode === 'impostor' || item.mode === 'leader')
    return { main: (item.totalScore / 10).toFixed(1), unit: ' pts' };
  if (item.game === 'eco')
    return { main: String(Math.round(item.totalScore / 10)), unit: ' passos' };
  if (item.mode === 'survival')
    return { main: String(Math.round(item.totalScore / 10)), unit: ' rodadas' };
  return { main: (item.totalScore / 10).toFixed(1), unit: `/${matchMax(item)}` };
}

const MODE_NAME: Record<string, string> = {
  classic: 'Clássico',
  flash: 'Flash',
  quick: 'Rápido',
  strict: 'Sem estourar',
  blind: 'Às cegas',
  sequence: 'Sequência',
  survival: 'Sobrevivência',
  escalada: 'Escalada',
  velocidade: 'Velocidade',
  reverso: 'Reverso',
  impostor: 'Intruso',
  leader: 'Siga o Líder',
  room: 'Sala',
};
const GAME_NAME: Record<string, string> = { color: 'Mesmíssima', time: 'Já Deu?', eco: 'Ecooo' };
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
  if (item.game === 'eco') {
    const n = Math.round(item.totalScore / 10);
    if (n >= 30) return { label: 'LENDÁRIO', tone: 'top' };
    if (n >= 16) return { label: 'FORTE', tone: 'good' };
    if (n >= 8) return { label: 'MEH', tone: 'mid' };
    return { label: 'CEDO DEMAIS', tone: 'low' };
  }
  if (item.mode === 'survival') {
    const n = Math.round(item.totalScore / 10);
    if (n >= 15) return { label: 'LENDÁRIO', tone: 'top' };
    if (n >= 9) return { label: 'FORTE', tone: 'good' };
    if (n >= 5) return { label: 'MEH', tone: 'mid' };
    return { label: 'CEDO DEMAIS', tone: 'low' };
  }
  // A faixa da partida é a da nota média por rodada (0 a 10): CRAVOU só com tudo perfeito.
  const grade = gradeOf((item.totalScore / 10 / matchMax(item)) * 10);
  const tone: Tone =
    grade.id === 'perfect' || grade.id === 'near'
      ? 'top'
      : grade.id === 'great' || grade.id === 'good'
        ? 'good'
        : grade.id === 'pass' || grade.id === 'meh'
          ? 'mid'
          : 'low';
  return { label: gradeWord(grade, item.game).toUpperCase(), tone };
}
