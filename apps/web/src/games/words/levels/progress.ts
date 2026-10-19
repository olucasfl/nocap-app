import { useSyncExternalStore } from 'react';

/**
 * O progresso das fases, salvo no aparelho (localStorage). Sem conta, sem rede: o jogo funciona offline e
 * o que a pessoa fez em cada fase fica guardado para continuar depois.
 */
export interface ProgressStore<T> {
  all(): Record<string, T>;
  get(level: number): T | undefined;
  set(level: number, value: T): void;
  clear(): void;
  subscribe(fn: () => void): () => void;
  version(): number;
}

export function createProgress<T>(storageKey: string): ProgressStore<T> {
  let cache: Record<string, T> | null = null;
  let v = 0;
  const listeners = new Set<() => void>();
  const read = (): Record<string, T> => {
    if (cache) return cache;
    try {
      cache = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Record<string, T>;
    } catch {
      cache = {};
    }
    return cache;
  };
  const notify = () => {
    v += 1;
    listeners.forEach((l) => l());
  };
  return {
    all: read,
    get: (level) => read()[String(level)],
    set(level, value) {
      cache = { ...read(), [String(level)]: value };
      try {
        localStorage.setItem(storageKey, JSON.stringify(cache));
      } catch {
        /* sem armazenamento: o progresso vale só até fechar a aba */
      }
      notify();
    },
    clear() {
      cache = {};
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* nada a fazer */
      }
      notify();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    version: () => v,
  };
}

/** Faz o componente reagir quando o progresso muda. */
export function useProgress<T>(store: ProgressStore<T>): Record<string, T> {
  useSyncExternalStore(store.subscribe, store.version);
  return store.all();
}

export interface BeeProgress {
  found: string[];
  closed: boolean;
  at: number;
}
export interface ConnectProgress {
  guesses: string[][];
  at: number;
}

export const beeProgress = createProgress<BeeProgress>('nocap-words-bee-v1');
export const connectProgress = createProgress<ConnectProgress>('nocap-words-connect-v1');

export type LevelStatus = 'new' | 'open' | 'done';
