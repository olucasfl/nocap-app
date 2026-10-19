import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateConnectPuzzle, wordKey, type ConnectPuzzle } from '@nocap/games';
import { WORDS_DAILY_EPOCH } from './word-lists';

const FILE = join(__dirname, '..', '..', 'data', 'words', 'connect', 'puzzles.json');

/** Quantos dias sem repetir palavra (spec 034). */
export const CONNECT_NO_REPEAT_DAYS = 14;

/** Os puzzles do Connect Word's. O calendário só cresce no fim: o dia N sempre usa o puzzle N. */
export class ConnectPuzzles {
  readonly puzzles: ConnectPuzzle[];

  constructor(puzzles: ConnectPuzzle[] = JSON.parse(readFileSync(FILE, 'utf8')) as ConnectPuzzle[]) {
    this.puzzles = puzzles;
  }

  static dayIndex(day: string): number {
    const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${WORDS_DAILY_EPOCH}T00:00:00Z`)) / 86_400_000);
    return Math.max(0, diff);
  }

  /** O puzzle do dia e o número dele (1 no primeiro dia). Passando do último, recomeça do primeiro. */
  of(day: string): { number: number; puzzle: ConnectPuzzle } {
    const n = ConnectPuzzles.dayIndex(day);
    return { number: n + 1, puzzle: this.puzzles[n % this.puzzles.length]! };
  }

  byId(id: string): ConnectPuzzle | null {
    return this.puzzles.find((p) => p.id === id) ?? null;
  }

  /** Erros de todos os puzzles e da sequência (vazio quando está tudo certo). */
  problems(): string[] {
    const out: string[] = [];
    const ids = new Set<string>();
    this.puzzles.forEach((p, i) => {
      if (ids.has(p.id)) out.push(`${p.id}: id repetido`);
      ids.add(p.id);
      for (const e of validateConnectPuzzle(p)) out.push(`${p.id}: ${e}`);
      // nenhuma palavra repete dentro de 14 dias
      const mine = new Set(p.groups.flatMap((g) => g.words.map((w) => wordKey(w))));
      for (let j = Math.max(0, i - CONNECT_NO_REPEAT_DAYS); j < i; j++) {
        for (const g of this.puzzles[j]!.groups) {
          for (const w of g.words) if (mine.has(wordKey(w))) out.push(`${p.id}: ${w} repete de ${this.puzzles[j]!.id}`);
        }
      }
      // o mesmo tema não repete em dias seguidos
      const prev = this.puzzles[i - 1];
      if (prev) {
        const shared = (p.themes ?? []).filter((t) => (prev.themes ?? []).length > 0 && (prev.themes ?? []).includes(t));
        if (shared.length >= 2) out.push(`${p.id}: temas iguais aos de ${prev.id} (${shared.join(', ')})`);
      }
    });
    return out;
  }
}
