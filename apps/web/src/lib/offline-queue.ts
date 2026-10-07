import { ApiError } from './api-client';

/** Armazenamento da fila. IndexedDB em produção; em memória nos testes. */
export interface QueueStore<T> {
  add(id: string, item: T): Promise<void>;
  all(): Promise<{ id: string; item: T }[]>;
  remove(id: string): Promise<void>;
}

/** Erro que vale tentar de novo depois: sem rede, timeout, 429 ou 5xx. */
export function isRetryable(err: unknown): boolean {
  // 401: a sessão expirou; a partida espera na fila até a pessoa entrar de novo.
  if (err instanceof ApiError) {
    return err.status >= 500 || err.status === 408 || err.status === 429 || err.status === 401;
  }
  return true;
}

export type SendResult = 'sent' | 'queued' | 'rejected';

export function createOfflineQueue<T extends { matchId: string }>(
  store: QueueStore<T>,
  send: (item: T) => Promise<unknown>,
) {
  let flushing: Promise<number> | null = null;

  async function submit(item: T): Promise<SendResult> {
    try {
      await send(item);
      return 'sent';
    } catch (err) {
      if (!isRetryable(err)) return 'rejected';
      // Mesmo matchId: se já estiver na fila, sobrescreve em vez de duplicar.
      await store.add(item.matchId, item);
      return 'queued';
    }
  }

  /** Reenvia em ordem; para no primeiro erro recuperável. Devolve quantas foram enviadas. */
  function flush(): Promise<number> {
    flushing ??= (async () => {
      let sent = 0;
      for (const { id, item } of await store.all()) {
        try {
          await send(item);
        } catch (err) {
          // A API recusou de vez (4xx): reenviar nunca vai funcionar, então descarta.
          if (isRetryable(err)) break;
        }
        await store.remove(id);
        sent += 1;
      }
      return sent;
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  return { submit, flush };
}

const DB_NAME = 'nocap-offline';
const STORE = 'matches';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<R>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<R>) {
  const db = await openDb();
  try {
    return await new Promise<R>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export function indexedDbStore<T>(): QueueStore<T> {
  return {
    async add(id, item) {
      await run('readwrite', (s) => s.put(item, id));
    },
    async all() {
      const db = await openDb();
      try {
        return await new Promise<{ id: string; item: T }[]>((resolve, reject) => {
          const out: { id: string; item: T }[] = [];
          const req = db.transaction(STORE).objectStore(STORE).openCursor();
          req.onsuccess = () => {
            const cur = req.result;
            if (!cur) return resolve(out);
            out.push({ id: String(cur.key), item: cur.value as T });
            cur.continue();
          };
          req.onerror = () => reject(req.error);
        });
      } finally {
        db.close();
      }
    },
    async remove(id) {
      await run('readwrite', (s) => s.delete(id));
    },
  };
}
