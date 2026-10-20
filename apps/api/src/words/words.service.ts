import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import {
  CLASSIC_MODE_INFO,
  CLASSIC_RECENT_WORDS,
  CLASSIC_WORD_LENGTH,
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

/** O maior número de palpites de qualquer modo (o Quarteto): o banco não grava além disso. */
const MAX_GUESSES = Math.max(...Object.values(CLASSIC_MODE_INFO).map((m) => m.tries));

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
    // Modo livre: se já tem uma partida aberta neste modo, continua nela (a sessão fica salva).
    const open = (await this.runs.runsOf(userId, game)).find((r) => r.kind === 'solo' && r.mode === mode && r.state === 'open');
    if (open) return this.view(open);
    return this.view(await this.createSolo(game, userId, mode));
  }

  /** Sorteia as palavras de uma partida livre (só do pool dos modos livres, sem repetir as últimas jogadas). */
  private async createSolo(game: WordGame, userId: string, mode: ClassicMode): Promise<WordRun> {
    const recent = new Set((await this.runs.recentAnswers(userId, game, CLASSIC_RECENT_WORDS)).map(wordKey));
    const pool = this.lists.freeAnswers.filter((w) => !recent.has(wordKey(w)));
    const words = CLASSIC_MODE_INFO[mode].words;
    const source = pool.length >= words ? pool : this.lists.freeAnswers;
    const picked = new Set<string>();
    while (picked.size < words) picked.add(source[randomInt(source.length)]!);
    const created = await this.runs.create({
      userId,
      game,
      mode,
      kind: 'solo',
      seed: randomUUID(),
      answers: [...picked],
    });
    return created!;
  }

  /** O resumo de cada modo livre: quantas partidas, quantas vitórias e a que está em andamento. */
  async modes(game: WordGame, userId: string) {
    const runs = await this.runs.runsOf(userId, game);
    const out: Record<string, { played: number; won: number; open: { used: number; tries: number } | null }> = {};
    for (const mode of ['classic', 'dueto', 'quarteto'] as const) {
      const mine = runs.filter((r) => r.kind === 'solo' && r.mode === mode);
      const open = mine.find((r) => r.state === 'open');
      out[mode] = {
        played: mine.filter((r) => r.state !== 'open').length,
        won: mine.filter((r) => r.state === 'won').length,
        open: open ? { used: open.guesses.length, tries: CLASSIC_MODE_INFO[mode].tries } : null,
      };
    }
    return out;
  }

  async get(userId: string, id: string): Promise<RunView> {
    return this.view(await this.mine(userId, id));
  }

  private async mine(userId: string, id: string): Promise<WordRun> {
    const run = await this.runs.byId(id, userId);
    if (!run) throw new NotFoundException('Partida não encontrada');
    return run;
  }

  /**
   * Um palpite. A conferência da palavra não precisa do banco, e o palpite é gravado e a partida lida de
   * volta numa só ida ao banco (é o que deixa o envio rápido); só o fim da partida faz mais uma.
   */
  async move(userId: string, id: string, guess: string): Promise<RunView> {
    if ([...wordKey(guess)].length !== CLASSIC_WORD_LENGTH) {
      throw new BadRequestException('A palavra tem 5 letras');
    }
    const word = this.lists.canonical(guess);
    if (!word) throw new BadRequestException('Essa palavra não está na lista');
    const run = await this.runs.appendGuess(id, userId, word, MAX_GUESSES);
    if (!run) {
      // não gravou: a partida não existe, acabou ou chegou no limite (o erro certo vem da leitura)
      const current = await this.mine(userId, id);
      throw new ConflictException(current.state !== 'open' ? 'A partida já acabou' : 'Não deu para enviar o palpite');
    }
    const state = playClassic(run.mode as ClassicMode, run.answers, run.guesses);
    if (!state.over) return this.view(run);
    return this.finish(run, state.guesses, state, false);
  }

  /** Tudo o que vale como palpite, sem acento: o aparelho confere a palavra na hora, sem esperar o servidor. */
  accepted(): string[] {
    this.acceptedKeys ??= [...this.lists.accepted.keys()].sort();
    return this.acceptedKeys;
  }
  private acceptedKeys: string[] | null = null;

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
    // O que vale é em quantas tentativas acertou (guardado em décimos, como os outros jogos: 3 tentativas = 30).
    // Quem não acertou fica com "tentativas + 1", depois de todo mundo que acertou.
    const lost = CLASSIC_MODE_INFO[run.mode as ClassicMode].tries + 1;
    const attempts = won ? guesses.length : lost;
    const scored: ScoredMatch = {
      rounds: state.boards.map((b) => ({ score: gaveUp || b.solvedAt === null ? lost : b.solvedAt })),
      total: attempts,
      totalTenths: attempts * 10,
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
    // Modo livre: a próxima palavra já fica sorteada, esperando a pessoa voltar.
    if (run.kind === 'solo') await this.createSolo(run.game as WordGame, run.userId!, run.mode as ClassicMode);
    return { ...this.view(next), nota };
  }
}
