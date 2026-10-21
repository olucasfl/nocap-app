import {
  GRIMOIRES,
  advanceTutorial,
  buyUpgrade,
  chooseGrimoire,
  finishTutorial,
  grantTutorialDust,
  grantTutorialGrimoire,
  newSave,
  press,
  rerollGrimoire,
  resumeClock,
  selectGrimoire,
  syncClock,
  tutorialAllows,
  type SaveState,
} from '@nocap/games';
import type { GameStore } from './game-store';
import type { SaveSlot } from './save-store';
import { BUY_GUARD_SEC } from './upgrades-logic';

/** Falhas de salvamento seguidas até o aviso persistente (spec 038, seção 11). */
export const SAVE_FAILURES_BEFORE_WARNING = 3;

export type GameEvent =
  | { type: 'press'; id: number; gain: number; combo: number }
  | { type: 'grimoire'; id: string; name: string; level: number }
  | { type: 'choice-open' };

export interface GameSnapshot {
  state: SaveState;
  /** Relógio do jogo, em segundos (não corre com a aba escondida). */
  now: number;
  paused: boolean;
  saveFailures: number;
}

interface Options {
  initial: SaveState;
  store: GameStore;
  slot: SaveSlot;
  /** Relógio do aparelho em ms; trocável nos testes. */
  perf?: () => number;
}

/**
 * Liga o motor (funções puras) ao tempo e ao salvamento, sem depender do React: o hook só assina.
 * O relógio do jogo parte do `clock` guardado no save e só avança com o jogo visível (spec 7.4):
 * enquanto `paused`, `now()` fica parado, e ao voltar o motor ainda congela objetos e combo.
 */
export function createGameController({ initial, store, slot, perf = () => performance.now() }: Options) {
  let state = initial;
  const origin = initial.clock;
  const startedAt = perf();
  let hiddenMs = 0;
  let pausedAt: number | null = null;
  let eventId = 0;
  let lastWholeSecond = -1;
  let saveFailures = 0;
  let lastBuyAt = -Infinity;
  let saving = false;
  let again = false;
  let dirty = false;

  const listeners = new Set<() => void>();
  const eventListeners = new Set<(e: GameEvent) => void>();

  const now = () => origin + ((pausedAt ?? perf()) - startedAt - hiddenMs) / 1000;
  const snapshot = (): GameSnapshot => ({ state, now: now(), paused: pausedAt !== null, saveFailures });
  let current = snapshot();

  function notify() {
    current = snapshot();
    for (const l of listeners) l();
  }
  function emit(e: GameEvent) {
    for (const l of eventListeners) l(e);
  }
  function commit(next: SaveState) {
    if (next === state) return;
    state = next;
    dirty = true;
    notify();
  }

  /** Guarda na cópia do aparelho na hora e sobe em seguida: para o que não pode se perder (escolha, compra, tutorial). */
  function saveNow() {
    store.stage?.(slot, state);
    void save();
  }

  /** Grava o estado atual. Três falhas seguidas ligam o aviso persistente. */
  async function save(force = false): Promise<boolean> {
    if (saving) {
      // Mudou durante a subida (passo do tutorial, compra): sobe de novo logo depois, sem esperar o autosave.
      if (dirty) again = true;
      return !saveFailures;
    }
    if (!dirty && !force) return !saveFailures;
    saving = true;
    const toSave = state;
    dirty = false;
    try {
      await store.save(slot, toSave);
      saveFailures = 0;
    } catch {
      saveFailures += 1;
      dirty = true;
    } finally {
      saving = false;
      notify();
    }
    if (again && dirty) {
      again = false;
      return save();
    }
    again = false;
    return saveFailures === 0;
  }

  return {
    getSnapshot: () => current,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    onEvent(fn: (e: GameEvent) => void) {
      eventListeners.add(fn);
      return () => void eventListeners.delete(fn);
    },
    now,
    save,

    /** Um toque. Devolve `false` se o motor ignorou (escolha aberta, rápido demais, pausado). */
    press(): boolean {
      if (pausedAt !== null || !tutorialAllows(state, 'press')) return false;
      const t = now();
      const before = state;
      let next = press(state, t);
      if (next.stats.clicks === before.stats.clicks) {
        commit(next);
        return false;
      }
      // Passo 1 do tutorial: o 1º toque entrega a Lua e abre o aviso do passo 2 (sem sorteio).
      const firstGrimoire = next.tutorial === 1;
      if (firstGrimoire) next = advanceTutorial(grantTutorialGrimoire(next), 1, 2);
      commit(next);
      if (firstGrimoire) saveNow();
      eventId += 1;
      emit({ type: 'press', id: eventId, gain: next.run.lastGain, combo: next.run.combo });
      if (!firstGrimoire && !before.run.pending && next.run.pending) emit({ type: 'choice-open' });
      return true;
    },

    /** 1º passo da escolha: marca a carta. */
    select(id: string) {
      if (pausedAt === null) commit(selectGrimoire(state, id, now()));
    },

    /** 2º passo: confirma a carta marcada. Devolve `true` se o motor aceitou. */
    choose(id: string): boolean {
      if (pausedAt !== null) return false;
      const before = state;
      const next = chooseGrimoire(state, id, now());
      if (next === before || next.run.picks === before.run.picks) {
        commit(next);
        return false;
      }
      commit(next);
      const def = GRIMOIRES.find((g) => g.id === id);
      emit({ type: 'grimoire', id, name: def?.name ?? id, level: next.run.build[id] ?? 1 });
      saveNow();
      return true;
    },

    /**
     * Compra um nível da melhoria. O motor confere saldo, trava e máximo; aqui só entra a trava de
     * toque duplo (spec 4.7), que vale para qualquer melhoria. Devolve `true` se comprou.
     */
    buy(index: number): boolean {
      if (pausedAt !== null || state.run.pending || !tutorialAllows(state, 'buy', index)) return false;
      const t = now();
      if (t - lastBuyAt < BUY_GUARD_SEC) return false;
      const next = buyUpgrade(state, index);
      if (next === state) return false;
      lastBuyAt = t;
      commit(advanceTutorial(next, 4, 5));
      saveNow();
      return true;
    },

    /**
     * Tutorial (spec 4.6): vai de `from` para `to` só se o save ainda está em `from`. Sair do passo 2
     * ("Entendi") entrega a poeira da 1ª compra. O progresso é salvo na hora para o passo sobreviver.
     */
    tutorialStep(from: number, to: number | 'done') {
      if (state.tutorial !== from) return;
      const moved = advanceTutorial(state, from, to);
      commit(from === 2 ? grantTutorialDust(moved) : moved);
      saveNow();
    },

    /** "Pular tutorial" e "Começar a jogar". */
    tutorialSkip() {
      if (state.tutorial === 'done') return;
      commit(finishTutorial(state));
      saveNow();
    },

    /** Betelgeuse / Voyager: troca uma carta oferecida. */
    reroll(id: string) {
      if (pausedAt === null) commit(rerollGrimoire(state, id, now()));
    },

    /** Avança o relógio: playSeconds, combo e a contagem das cartas. Notifica só quando a tela precisa. */
    tick() {
      if (pausedAt !== null) return;
      const t = now();
      const next = syncClock(state, t);
      if (next !== state) {
        state = next;
        dirty = true;
      }
      const whole = Math.floor(t);
      if (state.run.pending || state.run.combo > 0 || whole !== lastWholeSecond) {
        lastWholeSecond = whole;
        notify();
      }
    },

    /** Aba escondida ou app em segundo plano: o relógio do jogo para. */
    pause() {
      if (pausedAt !== null) return;
      pausedAt = perf();
      state = syncClock(state, origin + (pausedAt - startedAt - hiddenMs) / 1000);
      notify();
      void save();
    },

    resume() {
      if (pausedAt === null) return;
      hiddenMs += perf() - pausedAt;
      pausedAt = null;
      state = resumeClock(state, now());
      notify();
    },
  };
}

export type GameController = ReturnType<typeof createGameController>;

/** Carrega o save do espaço ou começa um novo jogo (o tutorial começa no passo 1 do save novo). */
export async function loadOrCreate(
  store: GameStore,
  slot: SaveSlot,
  seed: string,
  name: string,
  nowMs: number = Date.now(),
): Promise<SaveState> {
  const saved = await store.load(slot);
  if (!saved) return newSave(seed, nowMs, name);
  // Save de antes do tutorial: o passo 1 só salva depois do 1º toque, então toque com passo 1 = jogo antigo.
  return saved.tutorial === 1 && saved.stats.clicks > 0 ? finishTutorial(saved) : saved;
}
