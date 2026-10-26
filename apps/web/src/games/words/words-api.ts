import { apiClient } from '@/lib/api-client';

export type ClassicMode = 'classic' | 'dueto' | 'quarteto';

/** A partida como o servidor mostra: cores por linha (h/n/m) e, só no fim, as respostas. */
export interface RunView {
  id: string;
  mode: ClassicMode;
  kind: 'daily' | 'solo';
  day: string | null;
  number: number | null;
  tries: number;
  used: number;
  state: 'open' | 'won' | 'lost';
  guesses: string[];
  boards: { rows: string[]; solvedAt: number | null }[];
  answers: string[] | null;
  nota: number | null;
}

export interface DailyStatus {
  day: string;
  number: number;
  run: RunView | null;
}

export const MODE_LABEL: Record<ClassicMode, { name: string; words: number; tries: number }> = {
  classic: { name: '1 palavra', words: 1, tries: 6 },
  dueto: { name: '2 palavras', words: 2, tries: 7 },
  quarteto: { name: '4 palavras', words: 4, tries: 9 },
};

export const fetchDaily = () => apiClient.get<DailyStatus>('/words/wclassic/daily');
export const startRun = (mode: ClassicMode, kind: 'daily' | 'solo') =>
  apiClient.post<RunView>('/words/wclassic/runs', { mode, kind });
export const sendGuess = (id: string, guess: string) =>
  apiClient.post<RunView>(`/words/wclassic/runs/${id}/moves`, { guess });
export const giveUpRun = (id: string) =>
  apiClient.post<RunView>(`/words/wclassic/runs/${id}/finish`, {});

let acceptedCache: Promise<Set<string>> | null = null;
/**
 * As palavras aceitas (sem acento, c e ç iguais) para conferir o palpite no aparelho, sem esperar o servidor.
 * Baixa uma vez só; se falhar, devolve null e o servidor continua sendo quem decide.
 */
export function fetchAccepted(): Promise<Set<string> | null> {
  acceptedCache ??= apiClient
    .get<{ keys: string[] }>('/words/wclassic/accepted')
    .then((r) => new Set(r.keys))
    .catch(() => {
      acceptedCache = null;
      return new Set<string>();
    });
  return acceptedCache.then((s) => (s.size > 0 ? s : null));
}

/** O resumo de cada modo livre: partidas, vitórias e a que está em andamento. */
export interface ModesSummary {
  [mode: string]: { played: number; won: number; open: { used: number; tries: number } | null };
}
export const fetchModes = () => apiClient.get<ModesSummary>('/words/wclassic/modes');
