import { buildDictionary, encodePattern, playClassic, wordKey, type ClassicMode } from '@nocap/games';
import { ApiError } from '@/lib/api-client';
import { classicProgress, type ClassicProgress } from './levels/progress';
import { loadClassicAccepted, type ClassicLevel } from './levels/levels';
import { fetchAccepted, giveUpRun, sendGuess, startRun, type RunView } from './words-api';

/**
 * De onde vem a partida do Classic: o servidor (Daily) ou o próprio aparelho (as fases). A tela de jogo
 * (`ClassicPlay`) só conhece esta interface, então as duas fontes usam exatamente a mesma tela.
 */
export interface ClassicEngine {
  start(): Promise<RunView>;
  send(run: RunView, guess: string): Promise<RunView>;
  giveUp(run: RunView): Promise<RunView>;
  /** As chaves (sem acento) de todas as palavras que valem como palpite; `null` se ainda não dá para saber. */
  accepted(): Promise<Set<string> | null>;
  canGiveUp: boolean;
}

/** O Daily: tudo no servidor (ele guarda a palavra, confere e dá a nota do ranking). */
export const dailyEngine = (mode: ClassicMode): ClassicEngine => ({
  start: () => startRun(mode, 'daily'),
  send: (run, guess) => sendGuess(run.id, guess),
  giveUp: (run) => giveUpRun(run.id),
  accepted: fetchAccepted,
  canGiveUp: false,
});

export { classicProgress };

/** O modo de cada conjunto de fases (as chaves de `classic-levels.json`). */
export const CLASSIC_KEYS = { classic: 'c', dueto: 'd', quarteto: 'q' } as const;

/** A partida de uma fase, montada só com as palavras da fase, os palpites e se desistiu. */
export function levelView(mode: ClassicMode, level: ClassicLevel, num: number, guesses: readonly string[], gaveUp: boolean): RunView {
  const state = playClassic(mode, level.w, guesses);
  const over = state.over || gaveUp;
  return {
    id: level.id,
    mode,
    kind: 'solo',
    day: null,
    number: num,
    tries: state.tries,
    used: state.used,
    state: state.won ? 'won' : over ? 'lost' : 'open',
    guesses: state.guesses,
    boards: state.boards.map((b) => ({ rows: b.rows.map(encodePattern), solvedAt: b.solvedAt })),
    answers: over ? level.w : null,
    nota: null,
  };
}

let dictionary: Promise<Map<string, string>> | null = null;
/** O dicionário dos palpites (chave sem acento -> forma certa), baixado uma vez só. */
export function loadDictionary(): Promise<Map<string, string>> {
  dictionary ??= loadClassicAccepted().then((words) => buildDictionary(words));
  return dictionary;
}

/** A fase `num` do `mode`: tudo roda no aparelho e o progresso fica salvo a cada palpite. */
export function levelEngine(mode: ClassicMode, level: ClassicLevel, num: number): ClassicEngine {
  const store = classicProgress[mode];
  const save = (guesses: string[], gaveUp: boolean): ClassicProgress => {
    const done = levelView(mode, level, num, guesses, gaveUp).state !== 'open';
    const value: ClassicProgress = { guesses, at: Date.now(), ...(gaveUp ? { gaveUp: true } : {}), ...(done ? { done: true } : {}) };
    store.set(num, value);
    return value;
  };
  return {
    canGiveUp: true,
    start: async () => {
      const saved = store.get(num);
      return levelView(mode, level, num, saved?.guesses ?? [], saved?.gaveUp ?? false);
    },
    send: async (run, guess) => {
      // se o palpite é uma das palavras da fase, mostra com a grafia dela (com acento)
      const form = level.w.find((w) => wordKey(w) === wordKey(guess)) ?? (await loadDictionary()).get(wordKey(guess));
      if (!form) throw new ApiError(400, 'Palavra não aceita');
      const saved = save([...run.guesses, form], false);
      return levelView(mode, level, num, saved.guesses, false);
    },
    giveUp: async (run) => {
      const saved = save([...run.guesses], true);
      return levelView(mode, level, num, saved.guesses, true);
    },
    accepted: async () => new Set((await loadDictionary()).keys()),
  };
}
