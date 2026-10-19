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
export const giveUpRun = (id: string) => apiClient.post<RunView>(`/words/wclassic/runs/${id}/finish`, {});

/** Texto para compartilhar: sem emoji, e sem revelar a palavra (as letras de cada casa viram símbolos). */
export function shareText(run: RunView): string {
  const title =
    run.kind === 'daily'
      ? `Classic Word's #${run.number}`
      : `Classic Word's · ${MODE_LABEL[run.mode].name}`;
  const score = run.state === 'won' ? `${run.used}/${run.tries}` : `X/${run.tries}`;
  const sym: Record<string, string> = { h: '#', n: '+', m: '.' };
  const grids = run.boards.map((b) => b.rows.map((r) => [...r].map((c) => sym[c]).join('')).join('\n'));
  return `${title}  ${score}  nota ${run.nota?.toFixed(1).replace('.', ',') ?? '0,0'}\n\n${grids.join('\n\n')}`;
}
