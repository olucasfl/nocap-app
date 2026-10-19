import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CONNECT_LIVES,
  classicTenths,
  dailyDate,
  guessKey,
  playConnect,
  type ConnectPuzzle,
  type ConnectResult,
  type ConnectState,
} from '@nocap/games';
import type { ScoredMatch } from '../matches/match-scoring';
import { MatchesRepository } from '../matches/matches.repository';
import { ConnectPuzzles } from './connect-puzzles';
import { WORDS_DAILY_EPOCH } from './word-lists';
import { WordsRepository, type WordRun } from './words.repository';

const GAME = 'wconnect';

interface GroupView {
  level: number;
  title: string;
  words: string[];
}

/** O que o aparelho recebe: as palavras soltas e os grupos já achados; os que faltam só aparecem no fim. */
export interface ConnectView {
  id: string;
  kind: 'daily' | 'archive';
  day: string | null;
  number: number;
  /** As palavras ainda soltas, na ordem embaralhada da partida. */
  words: string[];
  found: GroupView[];
  lives: number;
  errors: number;
  over: boolean;
  won: boolean;
  nota: number | null;
  reveal: GroupView[] | null;
}

export type ConnectMove =
  | { result: Exclude<ConnectResult, 'correct'>; run: ConnectView }
  | { result: 'correct'; group: GroupView; run: ConnectView };

/** Embaralhamento determinístico pela seed da partida (a mesma ordem a cada abertura). */
function shuffled<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rand = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const encode = (words: readonly string[]) => words.join('|');
const decode = (g: string) => g.split('|');

@Injectable()
export class ConnectService {
  readonly puzzles = new ConnectPuzzles();

  constructor(
    private readonly runs: WordsRepository,
    private readonly matches: MatchesRepository,
  ) {}

  private puzzleOf(run: WordRun): ConnectPuzzle {
    const p = this.puzzles.byId(run.answers[0]!);
    if (!p) throw new NotFoundException('Puzzle não encontrado');
    return p;
  }

  private state(run: WordRun): ConnectState {
    return playConnect(this.puzzleOf(run), run.guesses.map(decode));
  }

  private view(run: WordRun): ConnectView {
    const puzzle = this.puzzleOf(run);
    const state = this.state(run);
    const order = shuffled(puzzle.groups.flatMap((g) => g.words), run.seed);
    const left = new Set(state.left);
    const group = (g: { level: number; title: string; words: string[] }): GroupView => ({ level: g.level, title: g.title, words: g.words });
    const day = run.day ?? run.seed.split('@')[1] ?? null;
    return {
      id: run.id,
      kind: run.kind as 'daily' | 'archive',
      day: run.day,
      number: day ? ConnectPuzzles.dayIndex(day) + 1 : 0,
      words: order.filter((w) => left.has(w)),
      found: state.found.map(group),
      lives: state.lives,
      errors: state.errors,
      over: state.over,
      won: state.won,
      nota: state.over ? state.nota : null,
      reveal: state.over ? puzzle.groups.filter((g) => !state.found.includes(g)).map(group) : null,
    };
  }

  async dailyStatus(userId: string) {
    const day = dailyDate();
    const run = await this.runs.daily(userId, GAME, day);
    return { day, number: this.puzzles.of(day).number, run: run ? this.view(run) : null };
  }

  async start(userId: string, kind: 'daily' | 'archive', archiveDay?: string): Promise<ConnectView> {
    const today = dailyDate();
    if (kind === 'daily') {
      const existing = await this.runs.daily(userId, GAME, today);
      if (existing) {
        if (existing.state !== 'open') throw new ConflictException('Você já jogou o Daily de hoje');
        return this.view(existing);
      }
      // Puzzle que a conta já jogou não volta (vale quando a lista dá a volta e repete um puzzle).
      const todays = this.puzzles.of(today).puzzle;
      if (await this.runs.puzzleRun(userId, GAME, todays.id)) {
        throw new ConflictException('Você já jogou o puzzle de hoje');
      }
      const created = await this.runs.create({
        userId,
        game: GAME,
        mode: 'classic',
        kind: 'daily',
        day: today,
        seed: `${GAME}:${today}`,
        answers: [todays.id],
      });
      if (!created) throw new ConflictException('Você já jogou o Daily de hoje');
      return this.view(created);
    }
    if (!archiveDay || !/^\d{4}-\d{2}-\d{2}$/.test(archiveDay) || archiveDay >= today || archiveDay < WORDS_DAILY_EPOCH) {
      throw new BadRequestException('O arquivo só tem dias que já passaram');
    }
    const { puzzle } = this.puzzles.of(archiveDay);
    const seed = `${GAME}-archive:${puzzle.id}@${archiveDay}`;
    // Um puzzle só pode ser jogado uma vez por conta: aberto retoma, terminado não volta.
    const existing = await this.runs.puzzleRun(userId, GAME, puzzle.id);
    if (existing) {
      if (existing.state !== 'open') throw new ConflictException('Você já jogou este puzzle');
      return this.view(existing);
    }
    const created = await this.runs.create({
      userId,
      game: GAME,
      mode: 'archive',
      kind: 'archive',
      seed,
      answers: [puzzle.id],
    });
    return this.view(created!);
  }

  private async mine(userId: string, id: string): Promise<WordRun> {
    const run = await this.runs.byId(id, userId);
    if (!run || run.game !== GAME) throw new NotFoundException('Partida não encontrada');
    return run;
  }

  async get(userId: string, id: string): Promise<ConnectView> {
    return this.view(await this.mine(userId, id));
  }

  async move(userId: string, id: string, words: string[]): Promise<ConnectMove> {
    const run = await this.mine(userId, id);
    if (run.state !== 'open') throw new ConflictException('A partida já acabou');
    const before = this.state(run);
    let after: ConnectState;
    // Só palavras que ainda estão soltas, 4 diferentes: o resto é pedido inválido.
    const loose = new Set(before.left.map((w) => guessKey([w])));
    if (words.length !== 4 || new Set(words.map((w) => guessKey([w]))).size !== 4 || words.some((w) => !loose.has(guessKey([w])))) {
      throw new BadRequestException('Escolha 4 palavras que ainda estão soltas');
    }
    const canonical = words.map((w) => before.left.find((x) => guessKey([x]) === guessKey([w]))!);
    const guesses = [...run.guesses, encode(canonical)];
    try {
      after = playConnect(this.puzzleOf(run), guesses.map(decode));
    } catch {
      throw new BadRequestException('Palpite inválido');
    }
    const result = after.results[after.results.length - 1]!;
    const next: WordRun = { ...run, guesses };
    if (result === 'repeat') {
      // Repetido não custa vida e não precisa ficar guardado.
      return { result: 'repeat', run: this.view(run) };
    }
    if (after.over) {
      const closed: WordRun = { ...next, state: after.won ? 'won' : 'lost', finishedAt: new Date(), matchId: run.id };
      await this.runs.update(run.id, { guesses, state: closed.state, finishedAt: closed.finishedAt, matchId: run.id });
      await this.save(closed, after);
      return this.answer(result, after, closed);
    }
    await this.runs.update(run.id, { guesses });
    return this.answer(result, after, next);
  }

  private answer(result: ConnectResult, after: ConnectState, run: WordRun): ConnectMove {
    const view = this.view(run);
    if (result === 'correct') {
      const g = after.found[after.found.length - 1]!;
      return { result, group: { level: g.level, title: g.title, words: g.words }, run: view };
    }
    return { result, run: view };
  }

  private async save(run: WordRun, state: ConnectState) {
    const scored: ScoredMatch = {
      rounds: [{ score: state.nota }],
      total: state.nota,
      totalTenths: classicTenths(state.nota),
      encodedAnswers: [state.errors, state.found.length],
      settings: { puzzle: run.answers[0]!, errors: state.errors, groups: state.found.length, scoreVersion: 1 },
    };
    await this.matches.save({
      matchId: run.id,
      guestId: await this.matches.playerOfUser(run.userId!),
      game: GAME,
      mode: run.mode,
      kind: run.kind === 'daily' ? 'daily' : 'solo',
      seed: run.seed,
      ranked: run.kind === 'daily',
      scored,
    });
  }

  /** Vidas do jogo (usado nas telas e testes). */
  static lives = CONNECT_LIVES;
}
