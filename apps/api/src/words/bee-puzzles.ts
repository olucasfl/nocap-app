import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateBeePuzzle, type BeePuzzle } from '@nocap/games';
import { WORDS_DAILY_EPOCH } from './word-lists';

const FILE = join(__dirname, '..', '..', 'data', 'words', 'bee', 'favos.json');

/** Os favos do Bee Word's (spec 035). O calendário só cresce no fim; o dia N nunca muda de favo. */
export class BeePuzzles {
  readonly puzzles: BeePuzzle[];

  constructor(puzzles: BeePuzzle[] = JSON.parse(readFileSync(FILE, 'utf8')) as BeePuzzle[]) {
    this.puzzles = puzzles;
  }

  /** Dias desde o primeiro Daily (0 no primeiro dia; datas antes dele valem 0). */
  static dayIndex(day: string): number {
    const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${WORDS_DAILY_EPOCH}T00:00:00Z`)) / 86_400_000);
    return Math.max(0, diff);
  }

  /** O favo do dia e o número dele (1 no primeiro dia). Passando do último, recomeça do primeiro. */
  of(day: string): { number: number; puzzle: BeePuzzle } {
    const n = BeePuzzles.dayIndex(day);
    return { number: n + 1, puzzle: this.puzzles[n % this.puzzles.length]! };
  }

  byId(id: string): BeePuzzle | null {
    return this.puzzles.find((p) => p.id === id) ?? null;
  }

  /** Erros de todos os favos (vazio quando está tudo certo). */
  problems(): string[] {
    return this.puzzles.flatMap((p) => validateBeePuzzle(p).map((e) => `${p.id}: ${e}`));
  }
}
