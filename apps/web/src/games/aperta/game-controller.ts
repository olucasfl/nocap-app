import {
  GRIMOIRES,
  buyUpgrade,
  chooseGrimoire,
  newSave,
  press,
  rerollGrimoire,
  resumeClock,
  selectGrimoire,
  syncClock,
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

  /** Grava o estado atual. Três falhas seguidas ligam o aviso persistente. */
  async function save(force = false): Promise<boolean> {
    if (saving || (!dirty && !force)) return !saveFailures;
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
      if (pausedAt !== null) return false;
      const t = now();
      const before = state;
      const next = press(state, t);
      if (next.stats.clicks === before.stats.clicks) {
        commit(next);
        return false;
      }
      commit(next);
      eventId += 1;
      emit({ type: 'press', id: eventId, gain: next.run.lastGain, combo: next.run.combo });
      if (!before.run.pending && next.run.pending) emit({ type: 'choice-open' });
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
      void save();
      return true;
    },

    /**
     * Compra um nível da melhoria. O motor confere saldo, trava e máximo; aqui só entra a trava de
     * toque duplo (spec 4.7), que vale para qualquer melhoria. Devolve `true` se comprou.
     */
    buy(index: number): boolean {
      if (pausedAt !== null || state.run.pending) return false;
      const t = now();
      if (t - lastBuyAt < BUY_GUARD_SEC) return false;
      const next = buyUpgrade(state, index);
      if (next === state) return false;
      lastBuyAt = t;
      commit(next);
      void save();
      return true;
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

/** Carrega o save do espaço ou começa um novo jogo (sem tutorial por enquanto: é da etapa 8). */
export async function loadOrCreate(
  store: GameStore,
  slot: SaveSlot,
  seed: string,
  name: string,
  nowMs: number = Date.now(),
): Promise<SaveState> {
  const saved = await store.load(slot);
  return saved ?? newSave(seed, nowMs, name);
}
