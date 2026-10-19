import { wordKey } from '../text';

/**
 * Bee Word's (spec 035): regras puras. O servidor guarda os favos e as listas de palavras; o aparelho
 * só recebe as 7 letras e o resultado de cada palavra enviada.
 */

export const BEE_MIN_LENGTH = 4;
/** Quantas das 7 letras formam um pangrama e o bônus dele. */
export const BEE_LETTERS = 7;
export const BEE_PANGRAM_BONUS = 7;
/** A partir desta fração do máximo de pontos do dia a nota é 10 (patente Gênio). */
export const BEE_GENIUS = 0.7;

export interface BeePuzzle {
  id: string;
  center: string;
  /** As 6 letras de fora, sem acento. */
  letters: string[];
  /** Todas as palavras do favo, na forma correta (com acento). */
  words: { w: string; pangram?: boolean }[];
}

/** Patentes: fração mínima do máximo de pontos. */
export const BEE_RANKS = [
  { id: 'iniciante', name: 'Iniciante', min: 0 },
  { id: 'bom-comeco', name: 'Bom começo', min: 0.02 },
  { id: 'pegando-o-jeito', name: 'Pegando o jeito', min: 0.05 },
  { id: 'zunindo', name: 'Zunindo', min: 0.08 },
  { id: 'solida', name: 'Sólida', min: 0.15 },
  { id: 'otima', name: 'Ótima', min: 0.25 },
  { id: 'incrivel', name: 'Incrível', min: 0.4 },
  { id: 'genio', name: 'Gênio', min: BEE_GENIUS },
  { id: 'rainha', name: 'Rainha das Abelhas', min: 1 },
] as const;
export type BeeRank = (typeof BEE_RANKS)[number];

/** Pontos de uma palavra: 4 letras valem 1, as maiores o número de letras; pangrama ganha o bônus. */
export function beePoints(word: string, pangram: boolean): number {
  const n = [...wordKey(word)].length;
  return (n === BEE_MIN_LENGTH ? 1 : n) + (pangram ? BEE_PANGRAM_BONUS : 0);
}

/** A palavra usa as 7 letras do favo? */
export function isBeePangram(word: string, puzzle: Pick<BeePuzzle, 'center' | 'letters'>): boolean {
  const used = new Set(wordKey(word));
  return [puzzle.center, ...puzzle.letters].every((l) => used.has(l));
}

export const beeMaxPoints = (puzzle: BeePuzzle): number =>
  puzzle.words.reduce((sum, x) => sum + beePoints(x.w, !!x.pangram), 0);

/** A patente de quem tem `points` de um máximo `max`. */
export function beeRank(points: number, max: number): BeeRank {
  if (max <= 0) return BEE_RANKS[0];
  const all = points >= max;
  const ratio = points / max;
  let best: BeeRank = BEE_RANKS[0];
  for (const r of BEE_RANKS) if (r.id === 'rainha' ? all : ratio >= r.min) best = r;
  return best;
}

/** Nota de 0 a 10 (1 casa): chegar ao Gênio (70% do máximo) dá 10. */
export function beeNota(points: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round(10 * Math.min(1, points / (BEE_GENIUS * max)) * 10) / 10;
}

export type BeeReject = 'short' | 'center' | 'letters' | 'dup' | 'notlisted';

export type BeeCheck =
  | { ok: true; shown: string; points: number; pangram: boolean }
  | { ok: false; reason: BeeReject };

/** Confere uma palavra enviada (com ou sem acento) contra o favo e as já achadas. */
export function checkBeeWord(puzzle: BeePuzzle, found: readonly string[], input: string): BeeCheck {
  const key = wordKey(input);
  if (key.length < BEE_MIN_LENGTH) return { ok: false, reason: 'short' };
  const allowed = new Set([puzzle.center, ...puzzle.letters]);
  if ([...key].some((ch) => !allowed.has(ch))) return { ok: false, reason: 'letters' };
  if (!key.includes(puzzle.center)) return { ok: false, reason: 'center' };
  const entry = puzzle.words.find((x) => wordKey(x.w) === key);
  if (!entry) return { ok: false, reason: 'notlisted' };
  if (found.some((f) => wordKey(f) === key)) return { ok: false, reason: 'dup' };
  const pangram = !!entry.pangram;
  return { ok: true, shown: entry.w, points: beePoints(entry.w, pangram), pangram };
}

/** Pontos de uma lista de palavras achadas (palavras fora do favo valem 0). */
export function beeScore(puzzle: BeePuzzle, found: readonly string[]): number {
  const keys = new Set(found.map(wordKey));
  return puzzle.words.reduce((s, x) => (keys.has(wordKey(x.w)) ? s + beePoints(x.w, !!x.pangram) : s), 0);
}

/** As dicas sem entregar palavras: quantas faltam, quantos pangramas, por tamanho e por inicial. */
export function beeHints(puzzle: BeePuzzle, found: readonly string[]) {
  const keys = new Set(found.map(wordKey));
  const left = puzzle.words.filter((x) => !keys.has(wordKey(x.w)));
  const bySize: Record<number, number> = {};
  const byInitial: Record<string, number> = {};
  for (const x of left) {
    const k = wordKey(x.w);
    bySize[k.length] = (bySize[k.length] ?? 0) + 1;
    byInitial[k[0]!] = (byInitial[k[0]!] ?? 0) + 1;
  }
  return {
    total: puzzle.words.length,
    left: left.length,
    pangramsLeft: left.filter((x) => x.pangram).length,
    pangrams: puzzle.words.filter((x) => x.pangram).length,
    bySize,
    byInitial,
    /** O mesmo, em listas ordenadas para a tela: "começa com T: 6", "4 letras: 14". */
    initials: Object.entries(byInitial)
      .map(([letter, count]) => ({ letter, count }))
      .sort((a, b) => a.letter.localeCompare(b.letter)),
    sizes: Object.entries(bySize)
      .map(([size, count]) => ({ size: Number(size), count }))
      .sort((a, b) => a.size - b.size),
  };
}

/** Regras de um favo novo (o script gerador e os testes usam a mesma conferência). */
export function validateBeePuzzle(p: BeePuzzle): string[] {
  const errors: string[] = [];
  const letters = [p.center, ...p.letters];
  if (new Set(letters).size !== BEE_LETTERS) errors.push('precisa de 7 letras diferentes');
  if (letters.some((l) => !/^[a-z]$/.test(l) || l === 's')) errors.push('letra inválida (sem S, sem acento)');
  if (letters.filter((l) => 'aeiou'.includes(l)).length < 2) errors.push('menos de 2 vogais');
  const pangrams = p.words.filter((x) => x.pangram);
  if (pangrams.length < 1 || pangrams.length > 2) errors.push('precisa de 1 ou 2 pangramas');
  if (p.words.some((x) => !!x.pangram !== isBeePangram(x.w, p))) errors.push('pangrama marcado errado');
  if (p.words.length < 25 || p.words.length > 80) errors.push('lista fora de 25 a 80 palavras');
  const keys = p.words.map((x) => wordKey(x.w));
  if (new Set(keys).size !== keys.length) errors.push('palavra repetida');
  for (const k of keys) {
    if (k.length < BEE_MIN_LENGTH) errors.push(`${k}: curta`);
    if (!k.includes(p.center)) errors.push(`${k}: sem a letra do centro`);
    if ([...k].some((ch) => !letters.includes(ch))) errors.push(`${k}: letra fora do favo`);
  }
  const max = beeMaxPoints(p);
  if (max < 60 || max > 300) errors.push(`máximo de pontos fora de 60 a 300 (${max})`);
  return errors;
}
