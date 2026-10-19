import { apiClient } from '@/lib/api-client';

export interface BeeHints {
  total: number;
  left: number;
  pangramsLeft: number;
  pangrams: number;
  bySize: Record<string, number>;
  byInitial: Record<string, number>;
}

/** A partida como o servidor mostra: as letras e o que já foi achado, nunca as palavras que faltam. */
export interface BeeView {
  id: string;
  kind: 'daily' | 'archive';
  day: string | null;
  number: number;
  center: string;
  letters: string[];
  found: string[];
  points: number;
  max: number;
  rank: { id: string; name: string };
  nota: number;
  closed: boolean;
  hints: BeeHints;
  all: string[] | null;
}

export type BeeReject = 'short' | 'center' | 'letters' | 'dup' | 'notlisted';
export type BeeMove =
  | { result: 'ok'; shown: string; points: number; pangram: boolean; run: BeeView }
  | { result: 'rejected'; reason: BeeReject };

export interface BeeDaily {
  day: string;
  number: number;
  run: BeeView | null;
}

/** As patentes e a fração do máximo em que cada uma começa (as mesmas do servidor, só para a barra). */
export const BEE_RANK_STEPS = [
  { id: 'iniciante', name: 'Iniciante' },
  { id: 'bom-comeco', name: 'Bom começo' },
  { id: 'pegando-o-jeito', name: 'Pegando o jeito' },
  { id: 'zunindo', name: 'Zunindo' },
  { id: 'solida', name: 'Sólida' },
  { id: 'otima', name: 'Ótima' },
  { id: 'incrivel', name: 'Incrível' },
  { id: 'genio', name: 'Gênio' },
  { id: 'rainha', name: 'Rainha das Abelhas' },
] as const;

export const REJECT_TEXT: Record<BeeReject, string> = {
  short: 'Muito curta',
  center: 'Falta a letra do centro',
  letters: 'Tem letra fora do favo',
  dup: 'Já achada',
  notlisted: 'Não está na lista',
};

export const fetchBeeDaily = () => apiClient.get<BeeDaily>('/words/wbee/daily');
export const startBee = (kind: 'daily' | 'free' = 'daily') =>
  apiClient.post<BeeView>('/words/wbee/runs', { kind });
export const sendBeeWord = (id: string, word: string) =>
  apiClient.post<BeeMove>(`/words/wbee/runs/${id}/moves`, { word });
export const finishBee = (id: string) => apiClient.post<BeeView>(`/words/wbee/runs/${id}/finish`, {});
export const fetchBeeRun = (id: string) => apiClient.get<BeeView>(`/words/wbee/runs/${id}`);
