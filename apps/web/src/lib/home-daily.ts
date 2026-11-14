/**
 * Desafio do dia na tela inicial (14/11/2026): mostra um Daily que a pessoa ainda não fez. Prefere o jogo que ela mais joga;
 * sem histórico, sorteia pelo dia (o mesmo o dia todo, para não mudar a cada visita). Se já fez um, mostra o próximo; se fez
 * todos, devolve `null` ("você cumpriu todos os dailys de hoje").
 */
export interface DailyCandidate {
  game: string;
  /** Partidas já jogadas nesse jogo (qualquer modo). */
  plays: number;
  done: boolean;
}

/** Número estável de 0 a 1 a partir de um texto (o dia + o jogo). */
function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export function pickDaily<T extends DailyCandidate>(list: readonly T[], day: string): T | null {
  const open = list.filter((d) => !d.done);
  if (open.length === 0) return null;
  return [...open].sort((a, b) => b.plays - a.plays || hash01(`${day}:${a.game}`) - hash01(`${day}:${b.game}`))[0]!;
}

/** O dia local como texto (AAAA-MM-DD). */
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Tira acento e caixa: a busca de jogos acha "memoria" em "Memória". */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
