import { apiClient } from './api-client';

export type GameId = 'color' | 'time' | 'eco';

export interface ModeStats {
  game: string;
  mode: string;
  matches: number;
  /** Décimos (500 = 50.0). */
  best: number;
  /** Média do total, em décimos. */
  average: number;
}

/** O Daily de um jogo: sequência própria e a nota de hoje (em décimos), se já jogou. */
export interface DailyInfo {
  current: number;
  best: number;
  playedToday: boolean;
  totalScore: number | null;
}

export interface Stats {
  modes: ModeStats[];
  daily: Record<GameId, DailyInfo>;
  /** Dias seguidos entrando no NoCap (não depende de jogar). */
  visit: { current: number; best: number; visitedToday: boolean };
}

/** Só com conta: convidado não tem recordes. */
export const fetchStats = () => apiClient.get<Stats>('/me/stats');

/** Avisa o servidor que o app foi aberto hoje e devolve a sequência de dias seguidos. */
export const recordVisit = () =>
  apiClient.post<{ current: number; best: number; visitedToday: boolean }>('/me/visit', {});

/** Máximo de pontos de uma partida: 10 por rodada. Cor e Tempo têm 3 rodadas (o Daily da Cor tem 5). */
const MODE_MAX_BY_GAME: Record<GameId, Record<string, number>> = {
  color: { classic: 30, flash: 30, quick: 10, blind: 50, survival: 0 },
  time: { classic: 30, quick: 10, strict: 30, sequence: 50, survival: 0 },
  // Eco: a nota é o número de passos, sem máximo de pontos.
  eco: {
    classic: 0,
    escalada: 0,
    velocidade: 0,
    reverso: 0,
    'batida-passo': 0,
    'batida-mare': 0,
    'batida-frenesi': 0,
  },
};

/** Sobrevivência: a nota é o número de rodadas jogadas (não tem máximo). */
export const isSurvival = (mode: string) => mode === 'survival';

export function modeMax(game: string, mode: string): number | undefined {
  return MODE_MAX_BY_GAME[game as GameId]?.[mode];
}

/** Máximo do Daily de um jogo: 5 rodadas na Cor, 3 no Tempo. */
export const dailyMax = (game: string) => (game === 'color' ? 50 : game === 'eco' ? 0 : 30);

/**
 * Jogos e modos cuja nota é uma contagem, não pontos de 0 a 10 por rodada: a Sobrevivência conta
 * rodadas e o Eco conta passos. `null` quando a nota é em pontos.
 */
export type CountUnit = 'rodadas' | 'passos' | 'pontos';

/** O Eco Hero conta pontos (guardados em décimos, como os outros: 10 = 1 ponto). */
export const countUnit = (game: string, mode?: string): CountUnit | null =>
  game === 'eco'
    ? mode?.startsWith('batida-')
      ? 'pontos'
      : 'passos'
    : mode === 'survival'
      ? 'rodadas'
      : null;

/** "7 rodadas", "12 passos" (e o singular com 1). `tenths` é a nota guardada (7 = 70). */
export function formatCount(tenths: number, unit: CountUnit): string {
  const n = Math.round(tenths / 10);
  const one = unit === 'rodadas' ? 'rodada' : unit === 'passos' ? 'passo' : 'ponto';
  return `${n} ${n === 1 ? one : unit}`;
}

/** A nota do Daily de hoje para mostrar: "21.4/30" ou, no Eco, "12 passos". */
export function dailyScoreText(game: string, tenths: number): string {
  return game === 'eco'
    ? formatCount(tenths, 'passos')
    : `${(tenths / 10).toFixed(1)}/${dailyMax(game)}`;
}

const ORDER = [
  'classic',
  'flash',
  'quick',
  'strict',
  'blind',
  'sequence',
  'survival',
  'escalada',
  'velocidade',
  'reverso',
  'batida-passo',
  'batida-mare',
  'batida-frenesi',
];

/** Só os modos conhecidos de um jogo, na ordem da tela de início. */
export function gameModes(stats: Stats, game: string): ModeStats[] {
  return stats.modes
    .filter((m) => m.game === game && modeMax(game, m.mode) !== undefined)
    .sort((a, b) => ORDER.indexOf(a.mode) - ORDER.indexOf(b.mode));
}

/** Todos os modos de um jogo (jogados ou não), na ordem da tela de início. */
export function knownModes(game: string): string[] {
  return Object.keys(MODE_MAX_BY_GAME[game as GameId] ?? {}).sort(
    (x, y) => ORDER.indexOf(x) - ORDER.indexOf(y),
  );
}

export function streakLabel(days: number): string {
  return days === 1 ? '1 dia' : `${days} dias`;
}

/** Melhor nota do modo, em décimos (0 = nunca jogou). */
export function bestTenths(stats: Stats | undefined, game: string, mode: string): number {
  return stats?.modes.find((m) => m.game === game && m.mode === mode)?.best ?? 0;
}

/** O recorde só vale quando já havia um (o primeiro jogo cria o recorde, não o bate). */
export function isNewRecord(previous: number | undefined, now: number): boolean {
  return previous !== undefined && previous > 0 && now > previous;
}

/** "3.5/50" ou, na Sobrevivência, "7 rodadas": o valor de uma nota de modo, para mostrar. */
export function formatBest(game: string, mode: string, tenths: number): string {
  const unit = countUnit(game, mode);
  if (unit) return formatCount(tenths, unit);
  return `${(tenths / 10).toFixed(1)}/${modeMax(game, mode) ?? ''}`;
}

/** Frase do recorde de um modo, na ficha dele. `null` para convidado (sem estatísticas). */
export function recordText(stats: Stats | undefined, game: string, mode: string): string | null {
  if (!stats) return null;
  const best = bestTenths(stats, game, mode);
  if (best <= 0) return 'Você ainda não tem recorde neste modo';
  return `Seu recorde aqui é de ${formatBest(game, mode, best)}`;
}
