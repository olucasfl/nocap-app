import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  beeHints,
  beeMaxPoints,
  beeNota,
  beeRank,
  beeScore,
  checkBeeWord,
  classicTenths,
  dailyDate,
  wordKey,
  type BeePuzzle,
  type BeeReject,
} from '@nocap/games';
import type { ScoredMatch } from '../matches/match-scoring';
import { MatchesRepository } from '../matches/matches.repository';
import { BeePuzzles } from './bee-puzzles';
import { WORDS_DAILY_EPOCH } from './word-lists';
import { WordsRepository, type WordRun } from './words.repository';

const GAME = 'wbee';

/** O que o aparelho recebe: as letras e as palavras já achadas; nunca as que faltam. */
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
  hints: ReturnType<typeof beeHints>;
  /** Só depois de fechar: todas as palavras do favo. */
  all: string[] | null;
}

export type BeeMove = { result: 'ok'; shown: string; points: number; pangram: boolean; run: BeeView } | { result: 'rejected'; reason: BeeReject };

@Injectable()
export class BeeService {
  readonly puzzles = new BeePuzzles();

  constructor(
    private readonly runs: WordsRepository,
    private readonly matches: MatchesRepository,
  ) {}

  private puzzleOf(run: WordRun): BeePuzzle {
    const p = this.puzzles.byId(run.answers[0]!);
    if (!p) throw new NotFoundException('Favo não encontrado');
    return p;
  }

  private view(run: WordRun): BeeView {
    const puzzle = this.puzzleOf(run);
    const points = beeScore(puzzle, run.guesses);
    const max = beeMaxPoints(puzzle);
    const closed = run.state !== 'open';
    const rank = beeRank(points, max);
    return {
      id: run.id,
      kind: run.kind as 'daily' | 'archive',
      day: run.day,
      number: run.day ? this.puzzles.of(run.day).number : BeePuzzles.dayIndex(run.seed.split('@')[1] ?? dailyDate()) + 1,
      center: puzzle.center,
      letters: puzzle.letters,
      found: run.guesses,
      points,
      max,
      rank: { id: rank.id, name: rank.name },
      nota: beeNota(points, max),
      closed,
      hints: beeHints(puzzle, run.guesses),
      all: closed ? puzzle.words.map((x) => x.w) : null,
    };
  }

  private scored(run: WordRun, found: string[]): ScoredMatch {
    const puzzle = this.puzzleOf(run);
    const points = beeScore(puzzle, found);
    const max = beeMaxPoints(puzzle);
    const nota = beeNota(points, max);
    return {
      rounds: [{ score: nota }],
      total: nota,
      totalTenths: classicTenths(nota),
      encodedAnswers: [points],
      settings: { puzzle: puzzle.id, words: found.length, points, rank: beeRank(points, max).id, scoreVersion: 1 },
    };
  }

  /** O dia virou: o que ficou aberto de dias anteriores fecha com os pontos que tinha. */
  private async closeStale(userId: string) {
    for (const run of await this.runs.openBefore(userId, GAME, dailyDate())) {
      await this.runs.update(run.id, { state: 'closed', finishedAt: new Date() });
    }
  }

  async dailyStatus(userId: string) {
    await this.closeStale(userId);
    const day = dailyDate();
    const run = await this.runs.daily(userId, GAME, day);
    return { day, number: this.puzzles.of(day).number, run: run ? this.view(run) : null };
  }

  async start(userId: string, kind: 'daily' | 'archive', archiveDay?: string): Promise<BeeView> {
    await this.closeStale(userId);
    const today = dailyDate();
    if (kind === 'daily') {
      const existing = await this.runs.daily(userId, GAME, today);
      if (existing) return this.view(existing);
      const created = await this.runs.create({
        userId,
        game: GAME,
        mode: 'classic',
        kind: 'daily',
        day: today,
        seed: `${GAME}:${today}`,
        answers: [this.puzzles.of(today).puzzle.id],
      });
      if (!created) throw new ConflictException('Você já começou o Daily de hoje');
      return this.view(created);
    }
    if (!archiveDay || !/^\d{4}-\d{2}-\d{2}$/.test(archiveDay) || archiveDay >= today || archiveDay < WORDS_DAILY_EPOCH) {
      throw new BadRequestException('O arquivo só tem dias que já passaram');
    }
    const { puzzle } = this.puzzles.of(archiveDay);
    const seed = `${GAME}-archive:${puzzle.id}@${archiveDay}`;
    const existing = await this.runs.bySeed(userId, GAME, seed);
    if (existing) return this.view(existing);
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
    await this.closeStale(userId);
    const run = await this.runs.byId(id, userId);
    if (!run || run.game !== GAME) throw new NotFoundException('Partida não encontrada');
    return run;
  }

  async get(userId: string, id: string): Promise<BeeView> {
    return this.view(await this.mine(userId, id));
  }

  async move(userId: string, id: string, word: string): Promise<BeeMove> {
    const run = await this.mine(userId, id);
    if (run.state !== 'open') throw new ConflictException('A partida já fechou');
    const check = checkBeeWord(this.puzzleOf(run), run.guesses, word);
    if (!check.ok) return { result: 'rejected', reason: check.reason };
    const found = [...run.guesses, check.shown];
    const next: WordRun = { ...run, guesses: found, matchId: run.id };
    await this.runs.update(run.id, { guesses: found, matchId: run.id });
    const scored = this.scored(run, found);
    const playerId = await this.matches.playerOfUser(userId);
    // A primeira palavra cria a partida; as outras sobem a nota (o ranking do dia anda ao vivo).
    if (run.guesses.length === 0) {
      await this.matches.save({
        matchId: run.id,
        guestId: playerId,
        game: GAME,
        mode: run.mode,
        kind: run.kind === 'daily' ? 'daily' : 'solo',
        seed: run.seed,
        ranked: run.kind === 'daily',
        scored,
      });
    } else {
      await this.matches.updateScore(run.id, playerId, scored);
    }
    return { result: 'ok', shown: check.shown, points: check.points, pangram: check.pangram, run: this.view(next) };
  }

  /** Encerrar: a partida fecha com os pontos de agora. */
  async finish(userId: string, id: string): Promise<BeeView> {
    const run = await this.mine(userId, id);
    if (run.state !== 'open') return this.view(run);
    await this.runs.update(run.id, { state: 'closed', finishedAt: new Date() });
    return this.view({ ...run, state: 'closed' });
  }

  /** Para o painel de dicas: as mesmas contagens, sem palavras. */
  async hints(userId: string, id: string) {
    const run = await this.mine(userId, id);
    return beeHints(this.puzzleOf(run), run.guesses);
  }

  /** Chave de uma palavra (usada pelos testes). */
  static key = wordKey;
}
