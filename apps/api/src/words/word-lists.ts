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
export const WORDS_DAILY_EPOCH = '2026-10-20';

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

  /** O número do Daily (1 no primeiro dia) e a palavra dele. */
  daily(day: string): { number: number; word: string } {
    const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${WORDS_DAILY_EPOCH}T00:00:00Z`)) / 86_400_000);
    const n = Math.max(0, diff);
    return { number: n + 1, word: this.order[n % this.order.length]! };
  }
}
