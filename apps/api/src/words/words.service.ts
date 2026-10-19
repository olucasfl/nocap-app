import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import {
  CLASSIC_MODE_INFO,
  CLASSIC_RECENT_WORDS,
  CLASSIC_WORD_LENGTH,
  classicTenths,
  dailyDate,
  encodePattern,
  isClassicMode,
  playClassic,
  wordKey,
  type ClassicMode,
  type ClassicState,
} from '@nocap/games';
import type { ScoredMatch } from '../matches/match-scoring';
import { MatchesRepository } from '../matches/matches.repository';
import { WordLists } from './word-lists';
import { WordsRepository, type WordRun } from './words.repository';

export const WORD_GAMES = ['wclassic'] as const;
export type WordGame = (typeof WORD_GAMES)[number];
export const isWordGame = (g: string): g is WordGame => (WORD_GAMES as readonly string[]).includes(g);

/** O que o aparelho recebe: nunca a resposta, até a partida acabar. */
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
  /** Só depois de acabar. */
  answers: string[] | null;
  nota: number | null;
}

/** Os palpites em inteiros (base 27, a=1) para a coluna `answers` de `match_players`. */
const encodeGuess = (guess: string): number =>
  [...wordKey(guess)].reduce((n, ch) => n * 27 + (ch.charCodeAt(0) - 96), 0);

@Injectable()
export class WordsService {
  readonly lists = new WordLists();

  constructor(
    private readonly runs: WordsRepository,
    private readonly matches: MatchesRepository,
  ) {}

  private view(run: WordRun): RunView {
    const mode = run.mode as ClassicMode;
    const state: ClassicState = playClassic(mode, run.answers, run.guesses);
    const over = run.state !== 'open';
    return {
      id: run.id,
      mode,
      kind: run.kind as 'daily' | 'solo',
      day: run.day,
      number: run.day ? this.lists.daily(run.day).number : null,
      tries: state.tries,
      used: state.used,
      state: run.state as RunView['state'],
      guesses: state.guesses,
      boards: state.boards.map((b) => ({ rows: b.rows.map(encodePattern), solvedAt: b.solvedAt })),
      answers: over ? run.answers : null,
      nota: over ? state.nota : null,
    };
  }

  /** Daily de hoje: ainda não começou, em andamento ou terminado. */
  async dailyStatus(game: WordGame, userId: string) {
    const day = dailyDate();
    const run = await this.runs.daily(userId, game, day);
    return { day, number: this.lists.daily(day).number, run: run ? this.view(run) : null };
  }

  async start(game: WordGame, userId: string, mode: unknown, kind: 'daily' | 'solo'): Promise<RunView> {
    if (!isClassicMode(mode)) throw new BadRequestException('Modo inválido');
    if (kind === 'daily') {
      if (mode !== 'classic') throw new BadRequestException('O Daily só existe com 1 palavra');
      const day = dailyDate();
      const existing = await this.runs.daily(userId, game, day);
      // Recomeçar o Daily aberto devolve a mesma partida; o que já terminou não volta.
      if (existing) {
        if (existing.state !== 'open') throw new ConflictException('Você já jogou o Daily de hoje');
        return this.view(existing);
      }
      const created = await this.runs.create({
        userId,
        game,
        mode,
        kind,
        day,
        seed: `${game}:${day}`,
        answers: [this.lists.daily(day).word],
      });
      if (!created) throw new ConflictException('Você já jogou o Daily de hoje');
      return this.view(created);
    }
    const recent = new Set((await this.runs.recentAnswers(userId, game, CLASSIC_RECENT_WORDS)).map(wordKey));
    const pool = this.lists.answers.filter((w) => !recent.has(wordKey(w)));
    const words = CLASSIC_MODE_INFO[mode].words;
    const source = pool.length >= words ? pool : this.lists.answers;
    const picked = new Set<string>();
    while (picked.size < words) picked.add(source[randomInt(source.length)]!);
    const created = await this.runs.create({
      userId,
      game,
      mode,
      kind,
      seed: randomUUID(),
      answers: [...picked],
    });
    return this.view(created!);
  }

  async get(userId: string, id: string): Promise<RunView> {
    return this.view(await this.mine(userId, id));
  }

  private async mine(userId: string, id: string): Promise<WordRun> {
    const run = await this.runs.byId(id, userId);
    if (!run) throw new NotFoundException('Partida não encontrada');
    return run;
  }

  async move(userId: string, id: string, guess: string): Promise<RunView> {
    const run = await this.mine(userId, id);
    if (run.state !== 'open') throw new ConflictException('A partida já acabou');
    if ([...wordKey(guess)].length !== CLASSIC_WORD_LENGTH) {
      throw new BadRequestException('A palavra tem 5 letras');
    }
    const word = this.lists.canonical(guess);
    if (!word) throw new BadRequestException('Essa palavra não está na lista');
    const guesses = [...run.guesses, word];
    const state = playClassic(run.mode as ClassicMode, run.answers, guesses);
    if (!state.over) {
      await this.runs.update(run.id, { guesses });
      return this.view({ ...run, guesses });
    }
    return this.finish(run, guesses, state, false);
  }

  /** Desistir: a partida acaba como derrota (nota 0) e as respostas aparecem. */
  async giveUp(userId: string, id: string): Promise<RunView> {
    const run = await this.mine(userId, id);
    if (run.state !== 'open') return this.view(run);
    const state = playClassic(run.mode as ClassicMode, run.answers, run.guesses);
    return this.finish(run, run.guesses, state, true);
  }

  private async finish(run: WordRun, guesses: string[], state: ClassicState, gaveUp: boolean): Promise<RunView> {
    const won = state.won && !gaveUp;
    const nota = gaveUp ? 0 : state.nota;
    const finishedAt = new Date();
    const next: WordRun = { ...run, guesses, state: won ? 'won' : 'lost', finishedAt, matchId: run.id };
    const scored: ScoredMatch = {
      rounds: state.boards.map((b) => ({ score: gaveUp || b.solvedAt === null ? 0 : nota })),
      total: nota,
      totalTenths: classicTenths(nota),
      encodedAnswers: guesses.map(encodeGuess),
      settings: { won, tries: guesses.length, answers: run.answers.join(',') },
    };
    await this.runs.update(run.id, { guesses, state: next.state, finishedAt, matchId: run.id });
    // A partida usa o id da run: reenviar não duplica. Só o Daily vai para o ranking.
    await this.matches.save({
      matchId: run.id,
      guestId: await this.matches.playerOfUser(run.userId!),
      game: run.game,
      mode: run.mode,
      kind: run.kind as 'daily' | 'solo',
      seed: run.seed,
      ranked: run.kind === 'daily',
      scored,
    });
    return { ...this.view(next), nota };
  }
}
