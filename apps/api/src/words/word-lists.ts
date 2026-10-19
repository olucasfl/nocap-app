import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDictionary, wordKey } from '@nocap/games';

/** Pasta das listas: `src/words` e `dist/words` ficam os dois a dois níveis de `apps/api`. */
const DATA_DIR = join(__dirname, '..', '..', 'data', 'words');

const readLines = (file: string): string[] =>
  readFileSync(join(DATA_DIR, file), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

/** Primeiro dia do Daily (palavra 1). Mudar depois do lançamento embaralha o número de todos os dias. */
export const WORDS_DAILY_EPOCH = '2026-10-19';

export class WordLists {
  /** Palavras que o jogo pode sortear como resposta (formas corretas, com acento). */
  readonly answers: string[];
  /** Ordem fixa do Daily (só cresce no fim). */
  readonly order: string[];
  /** Chave sem acento -> forma correta, de tudo o que vale como palpite. */
  readonly accepted: Map<string, string>;

  constructor(answers = readLines('respostas5.txt'), order = readLines('ordem5.txt'), accepted = readLines('aceitas5.txt')) {
    this.answers = answers;
    this.order = order;
    this.accepted = buildDictionary([...accepted, ...answers]);
  }

  /** Forma correta de um palpite, ou `null` se a palavra não existe na lista. */
  canonical(guess: string): string | null {
    return this.accepted.get(wordKey(guess)) ?? null;
  }

  /**
   * O número do Daily (1 no primeiro dia) e a palavra dele. Na primeira volta segue a ordem fixa;
   * quando a lista acaba, cada nova volta repete as palavras numa ordem embaralhada (sempre a mesma
   * para a mesma volta, então todo mundo recebe a mesma palavra no mesmo dia).
   */
  daily(day: string): { number: number; word: string } {
    const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${WORDS_DAILY_EPOCH}T00:00:00Z`)) / 86_400_000);
    const n = Math.max(0, diff);
    const size = this.order.length;
    const lap = Math.floor(n / size);
    return { number: n + 1, word: this.lap(lap)[n % size]! };
  }

  private readonly laps = new Map<number, string[]>();

  /** A ordem da volta `lap`: a 0 é a ordem fixa; as outras são embaralhadas pela volta. */
  private lap(lap: number): string[] {
    if (lap === 0) return this.order;
    let order = this.laps.get(lap);
    if (!order) {
      order = [...this.order];
      const rand = mulberry32(lap * 7919 + 17);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      // A volta nova não começa com a palavra com que a anterior terminou.
      const last = this.lap(lap - 1)[order.length - 1]!;
      if (order[0] === last) [order[0], order[1]] = [order[1]!, order[0]!];
      this.laps.set(lap, order);
    }
    return order;
  }
}

/** Gerador pseudoaleatório pequeno e determinístico (o mesmo `seed` dá a mesma sequência). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
