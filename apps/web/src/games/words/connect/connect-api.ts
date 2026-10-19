import { apiClient } from '@/lib/api-client';

export interface ConnectGroup {
  level: number;
  title: string;
  words: string[];
}

/** A partida como o servidor mostra: palavras soltas e grupos achados; os que faltam só aparecem no fim. */
export interface ConnectView {
  id: string;
  kind: 'daily' | 'archive';
  day: string | null;
  number: number;
  words: string[];
  found: ConnectGroup[];
  lives: number;
  errors: number;
  over: boolean;
  won: boolean;
  nota: number | null;
  reveal: ConnectGroup[] | null;
}

export type ConnectMove =
  | { result: 'one_away' | 'wrong' | 'repeat'; run: ConnectView }
  | { result: 'correct'; group: ConnectGroup; run: ConnectView };

export interface ConnectDaily {
  day: string;
  number: number;
  run: ConnectView | null;
}

export const LIVES = 5;

export const fetchConnectDaily = () => apiClient.get<ConnectDaily>('/words/wconnect/daily');
export const startConnect = (kind: 'daily' | 'free' = 'daily') =>
  apiClient.post<ConnectView>('/words/wconnect/runs', { kind });
export const sendConnect = (id: string, words: string[]) =>
  apiClient.post<ConnectMove>(`/words/wconnect/runs/${id}/moves`, { words });

/** Texto de compartilhar, sem emoji e sem revelar palavras: só a ordem em que os níveis foram achados. */
export function connectShareText(run: ConnectView): string {
  const sym = ['', 'A', 'V', 'Z', 'R'];
  const order = run.found.map((g) => sym[g.level]).join(' ');
  return `Connect Word's #${run.number}  ${run.won ? `${run.errors} erro(s)` : 'não deu'}  nota ${(run.nota ?? 0).toFixed(1).replace('.', ',')}\n${order}`;
}
