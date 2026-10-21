import type { SaveState } from '@nocap/games';
import type { SyncedSaveStore } from './api-save-store';
import type { SaveSlot } from './save-store';

/**
 * Onde o estado completo de um save mora (spec 038, seção 10). O `SaveStore` só guarda o resumo da
 * lista de saves; este contrato guarda o `SaveState` do motor. A etapa 2 troca a versão local pela
 * API (`GET/PUT /me/aperta/saves/:slot`) sem mexer na tela nem no hook.
 */
export interface GameStore {
  /** `null` = save sem partida ainda (novo jogo). */
  load(slot: SaveSlot): Promise<SaveState | null>;
  save(slot: SaveSlot, state: SaveState): Promise<void>;
}

/** Só em memória: testes. */
export function createMemoryGameStore(initial: Partial<Record<SaveSlot, SaveState>> = {}): GameStore & {
  saved: Partial<Record<SaveSlot, SaveState>>;
  saves: number;
  failNext: boolean;
} {
  const store = {
    saved: { ...initial },
    saves: 0,
    failNext: false,
    async load(slot: SaveSlot) {
      const s = store.saved[slot];
      return s ? structuredClone(s) : null;
    },
    async save(slot: SaveSlot, state: SaveState) {
      if (store.failNext) {
        store.failNext = false;
        throw new Error('save-failed');
      }
      store.saves += 1;
      store.saved[slot] = structuredClone(state);
    },
  };
  return store;
}

const KEY = 'nocap-aperta-dev-game';

/**
 * Só para desenvolvimento, até a API da etapa 2: o estado fica neste aparelho. A conta entra na
 * chave para dois jogadores no mesmo aparelho não dividirem partidas.
 */
export function createLocalGameStore(userId: string): GameStore {
  const key = (slot: SaveSlot) => `${KEY}:${userId}:${slot}`;
  return {
    async load(slot) {
      try {
        const raw = localStorage.getItem(key(slot));
        return raw ? (JSON.parse(raw) as SaveState) : null;
      } catch {
        return null;
      }
    },
    async save(slot, state) {
      // Falha de armazenamento sobe para o controlador contar as tentativas (spec 11).
      localStorage.setItem(key(slot), JSON.stringify(state));
    },
  };
}

/**
 * Estado da partida na conta: delega ao `SyncedSaveStore` (cópia local, autosave, subida ao voltar a
 * internet). `open` já devolve o estado juntado quando há conflito; o aviso de escolha vem de `conflict()`.
 */
export function createSyncedGameStore(saves: SyncedSaveStore): GameStore {
  return {
    async load(slot) {
      return (await saves.open(slot)).state;
    },
    async save(slot, state) {
      saves.update(slot, state);
      await saves.flush(slot);
      // Offline não é falha (a cópia local guarda); só erro de verdade conta para o aviso.
      if (saves.sync(slot) === 'error') throw new Error('save-failed');
    },
  };
}
