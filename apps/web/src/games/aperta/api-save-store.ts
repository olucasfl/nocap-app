/**
 * Saves do Aperta! na conta (spec 038, seção 10). O servidor é a fonte da verdade; o aparelho guarda uma
 * cópia local para jogar sem internet e sobe o que mudou: a cada 30 s, ao esconder a aba, ao voltar a
 * conexão e quando o jogo pede (`flush`). As telas só conhecem `SaveStore`; o jogo usa também
 * `open`, `update`, `flush`, `resolveConflict` e `subscribe`.
 */
import { mergeSaves, newSave, type SaveState } from '@nocap/games';
import { ApiError, apiClient } from '@/lib/api-client';
import { isNetworkError } from '@/lib/network';
import type { SaveSlot, SaveStore, SaveSummary } from './save-store';
import { SAVE_SLOTS } from './save-store';

export const AUTOSAVE_MS = 30_000;
/** O servidor aceita 1 gravação a cada 5 s por save; o aparelho respeita para não levar 429. */
export const MIN_UPLOAD_GAP_MS = 5_000;

export type SyncState = 'saved' | 'saving' | 'offline' | 'conflict' | 'error' | 'signed-out';

/** O save da conta e o do aparelho divergiram: a pessoa escolhe (spec 10.4). */
export interface Conflict {
  /** O que a conta tem agora. */
  account: SaveState;
  accountRevision: number;
  /** O que este aparelho tem. */
  local: SaveState;
  /** A junção recomendada (nada permanente se perde). */
  merged: SaveState;
}
export type ConflictChoice = 'merge' | 'account' | 'device';

export interface SyncEvent {
  slot: SaveSlot;
  sync: SyncState;
  /** Presente quando o store trocou o estado do jogo (junção, correção do servidor, escolha de conflito). */
  game?: SaveState;
}

export interface OpenedSave {
  state: SaveState;
  sync: SyncState;
  conflict: Conflict | null;
}

export interface SyncedSaveStore extends SaveStore {
  /** Baixa o save da conta, compara com a cópia do aparelho e começa o autosave. Sem internet, abre a cópia local. */
  open(slot: SaveSlot): Promise<OpenedSave>;
  /** O jogo avisa a cada mudança: a cópia local é gravada na hora; a subida vem no autosave. */
  update(slot: SaveSlot, state: SaveState): void;
  /** Sobe já (escolher grimório, comprar melhoria cara, colapsar, sair da tela). Nunca lança: falha vira `sync`. */
  flush(slot: SaveSlot): Promise<void>;
  /** Resolve o aviso "Este save mudou em outro aparelho" e devolve o estado para jogar. */
  resolveConflict(slot: SaveSlot, choice: ConflictChoice): Promise<SaveState>;
  sync(slot: SaveSlot): SyncState;
  conflict(slot: SaveSlot): Conflict | null;
  subscribe(listener: (e: SyncEvent) => void): () => void;
  /** Sobe o que falta, para o autosave e solta os ouvintes do navegador. */
  close(slot: SaveSlot): Promise<void>;
}

/** Só o que o store precisa do ambiente, para testar sem rede nem relógio de verdade. */
export interface Env {
  api: Pick<typeof apiClient, 'get' | 'put' | 'post' | 'delete'>;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  now: () => number;
}

const realEnv = (): Env => ({ api: apiClient, storage: localStorage, now: Date.now });

interface SlotInfo {
  slot: number;
  save: (SaveSummary & { revision: number }) | null;
  recoverableUntil: string | null;
}
interface SaveFull {
  slot: number;
  revision: number;
  data: SaveState;
}
interface PutResult {
  revision: number;
  flagged: string[];
  data?: SaveState;
}
interface ConflictBody {
  code?: string;
  reason?: 'stale' | 'regress' | 'slot-taken';
  current?: SaveFull;
  merged?: { data: SaveState; conflict: boolean };
}
interface LocalCopy {
  /** Revisão da conta em que esta cópia se baseia. */
  revision: number;
  state: SaveState;
  /** Mudou depois da última subida. */
  dirty: boolean;
}

interface Runtime {
  state: SaveState;
  revision: number;
  dirty: boolean;
  /** Sobe a cada `update`: uma subida que termina depois de uma mudança não apaga o "sujo". */
  version: number;
  sync: SyncState;
  conflict: Conflict | null;
  lastPut: number;
  inflight: Promise<void> | null;
  timer: ReturnType<typeof setTimeout> | undefined;
  /** Última versão que o servidor recusou como inválida (não adianta reenviar igual). */
  rejected: number;
  overwrite: boolean;
}

const path = (slot: SaveSlot) => `/me/aperta/saves/${slot}`;

function summaryOf(slot: SaveSlot, state: SaveState, lastPlayedAt: string): SaveSummary {
  return {
    slot,
    name: state.name,
    collapses: state.collapses,
    vaultCount: Object.keys(state.vault).length,
    lastPlayedAt,
    storySeen: state.storySeen,
  };
}

const seedOf = (now: number): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${now}-${Math.random().toString(36).slice(2)}`;

export function createApiSaveStore(userId: string, env: Env = realEnv()): SyncedSaveStore {
  const { api, storage, now } = env;
  const runtimes = new Map<SaveSlot, Runtime>();
  const listeners = new Set<(e: SyncEvent) => void>();
  let interval: ReturnType<typeof setInterval> | undefined;
  let attached = false;

  const key = (what: string, slot?: SaveSlot) =>
    `nocap-aperta:${userId}:${what}${slot ? `:${slot}` : ''}`;
  const read = <T>(k: string): T | null => {
    try {
      const raw = storage.getItem(k);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  };
  const write = (k: string, value: unknown) => {
    try {
      storage.setItem(k, JSON.stringify(value));
    } catch {
      /* armazenamento cheio ou bloqueado: a conta continua sendo a fonte da verdade */
    }
  };
  const drop = (k: string) => {
    try {
      storage.removeItem(k);
    } catch {
      /* ignora */
    }
  };
  const readLocal = (slot: SaveSlot): LocalCopy | null => {
    const c = read<LocalCopy>(key('save', slot));
    return c && typeof c.revision === 'number' && c.state && typeof c.state === 'object' ? c : null;
  };
  const persist = (slot: SaveSlot, rt: Runtime) =>
    write(key('save', slot), {
      revision: rt.revision,
      state: rt.state,
      dirty: rt.dirty,
    } satisfies LocalCopy);
  const emit = (slot: SaveSlot, rt: Runtime, game?: SaveState) => {
    const e: SyncEvent = game ? { slot, sync: rt.sync, game } : { slot, sync: rt.sync };
    listeners.forEach((l) => l(e));
  };
  const setSync = (slot: SaveSlot, rt: Runtime, sync: SyncState) => {
    if (rt.sync === sync) return;
    rt.sync = sync;
    emit(slot, rt);
  };

  // --- Subida ---

  async function upload(slot: SaveSlot, rt: Runtime): Promise<void> {
    if (rt.inflight) return rt.inflight;
    if (!rt.dirty || rt.conflict || rt.sync === 'signed-out' || rt.rejected === rt.version) return;
    const sentVersion = rt.version;
    const body = {
      data: rt.state,
      baseRevision: rt.revision,
      ...(rt.overwrite ? { overwrite: true } : {}),
    };
    setSync(slot, rt, 'saving');
    rt.lastPut = now();
    rt.inflight = (async () => {
      try {
        const r = await api.put<PutResult>(path(slot), body);
        rt.revision = r.revision;
        rt.overwrite = false;
        // Se o jogo mudou enquanto subia, o que subiu já é velho: continua sujo para a próxima subida.
        if (rt.version === sentVersion) {
          rt.dirty = false;
          if (r.data) {
            rt.state = r.data;
            persist(slot, rt);
            rt.sync = 'saved';
            emit(slot, rt, r.data);
            return;
          }
        }
        persist(slot, rt);
        setSync(slot, rt, rt.dirty ? 'saving' : 'saved');
      } catch (e) {
        handleFailure(slot, rt, e, sentVersion);
      } finally {
        rt.inflight = null;
      }
    })();
    return rt.inflight;
  }

  function handleFailure(slot: SaveSlot, rt: Runtime, e: unknown, sentVersion: number) {
    if (!(e instanceof ApiError)) {
      setSync(slot, rt, isNetworkError(e) ? 'offline' : 'error');
      return;
    }
    const body = (e.body ?? {}) as ConflictBody;
    if (e.status === 409 && body.code === 'conflict' && body.current && body.merged) {
      const current = body.current;
      // Quem só estava atrasado (a vida dele cabe na da conta) junta sem perguntar.
      if (!body.merged.conflict && body.reason !== 'regress') {
        rt.state = body.merged.data;
        rt.revision = current.revision;
        rt.dirty = true;
        rt.version++;
        persist(slot, rt);
        rt.sync = 'saving';
        emit(slot, rt, rt.state);
        scheduleUpload(slot, rt);
        return;
      }
      rt.conflict = {
        account: current.data,
        accountRevision: current.revision,
        local: rt.state,
        merged: body.merged.data,
      };
      persist(slot, rt);
      setSync(slot, rt, 'conflict');
      return;
    }
    if (e.status === 401) return setSync(slot, rt, 'signed-out');
    if (e.status === 400) {
      rt.rejected = sentVersion;
      return setSync(slot, rt, 'error');
    }
    // 404 (apagado em outro aparelho), 429 e 5xx: continua sujo e tenta de novo no autosave
    setSync(slot, rt, e.status === 429 || e.status >= 500 ? 'offline' : 'error');
  }

  function scheduleUpload(slot: SaveSlot, rt: Runtime) {
    if (rt.timer) return;
    const wait = Math.max(0, MIN_UPLOAD_GAP_MS - (now() - rt.lastPut));
    rt.timer = setTimeout(() => {
      rt.timer = undefined;
      void upload(slot, rt);
    }, wait);
  }

  // --- Ouvintes do navegador (um só par por store, enquanto houver save aberto) ---

  const flushAll = () => {
    for (const [slot, rt] of runtimes) void upload(slot, rt);
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flushAll();
  };
  function attach() {
    if (attached) return;
    attached = true;
    interval = setInterval(flushAll, AUTOSAVE_MS);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushAll);
    window.addEventListener('online', flushAll);
  }
  function detach() {
    if (!attached || runtimes.size > 0) return;
    attached = false;
    clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', flushAll);
    window.removeEventListener('online', flushAll);
  }

  function start(
    slot: SaveSlot,
    state: SaveState,
    revision: number,
    dirty: boolean,
    sync: SyncState,
    conflict: Conflict | null = null,
  ): OpenedSave {
    const old = runtimes.get(slot);
    if (old?.timer) clearTimeout(old.timer);
    const rt: Runtime = {
      state,
      revision,
      dirty,
      version: 0,
      sync: conflict ? 'conflict' : sync,
      conflict,
      lastPut: 0,
      inflight: null,
      timer: undefined,
      rejected: -1,
      overwrite: false,
    };
    runtimes.set(slot, rt);
    persist(slot, rt);
    attach();
    if (dirty && !conflict) scheduleUpload(slot, rt);
    return { state, sync: rt.sync, conflict };
  }

  // --- SaveStore (o que as telas usam) ---

  const toSummary = (info: SlotInfo): SaveSummary | null => {
    if (!info.save) return null;
    const { revision, ...summary } = info.save;
    void revision;
    return summary;
  };

  return {
    async list() {
      try {
        const { slots } = await api.get<{ slots: SlotInfo[] }>('/me/aperta/saves');
        const list = SAVE_SLOTS.map((s) => {
          const info = slots.find((x) => x.slot === s);
          return info ? toSummary(info) : null;
        });
        write(key('list'), list);
        return list;
      } catch (e) {
        // Sem internet: a última lista conhecida (e, na falta dela, as cópias locais) deixa abrir o jogo.
        if (!isNetworkError(e)) throw e;
        const cached = read<(SaveSummary | null)[]>(key('list'));
        if (cached && cached.length === 2) return cached;
        return SAVE_SLOTS.map((s) => {
          const local = readLocal(s);
          return local ? summaryOf(s, local.state, new Date(now()).toISOString()) : null;
        });
      }
    },

    async create(slot) {
      const state = newSave(seedOf(now()), now());
      try {
        const r = await api.put<PutResult>(path(slot), { data: state, baseRevision: 0 });
        const saved = r.data ?? state;
        write(key('save', slot), {
          revision: r.revision,
          state: saved,
          dirty: false,
        } satisfies LocalCopy);
        return summaryOf(slot, saved, new Date(now()).toISOString());
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) throw new Error('slot-taken');
        throw e;
      }
    },

    async remove(slot) {
      await api.delete(path(slot));
      const rt = runtimes.get(slot);
      if (rt?.timer) clearTimeout(rt.timer);
      runtimes.delete(slot);
      drop(key('save', slot));
      detach();
    },

    async restore(slot) {
      try {
        const summary = await api.post<SaveSummary & { revision: number }>(
          `${path(slot)}/restore`,
          {},
        );
        const { revision, ...rest } = summary;
        void revision;
        return rest;
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },

    async markStorySeen(slot) {
      if (!runtimes.has(slot)) await this.open(slot);
      const rt = runtimes.get(slot);
      if (!rt || rt.state.storySeen) return;
      this.update(slot, { ...rt.state, storySeen: true });
      // Só a marca local é esperada (a tela de jogo abre em seguida e lê a cópia do aparelho); a subida segue sozinha.
      void this.flush(slot).catch(() => undefined);
    },

    // --- Jogo ---

    async open(slot) {
      const local = readLocal(slot);
      let remote: SaveFull;
      try {
        remote = await api.get<SaveFull>(path(slot));
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          drop(key('save', slot));
          throw new Error('gone');
        }
        // Sem internet (ou servidor fora): joga a cópia do aparelho e sobe quando der.
        if (local && (isNetworkError(e) || (e instanceof ApiError && e.status >= 500))) {
          return start(slot, local.state, local.revision, local.dirty, 'offline');
        }
        throw e;
      }
      // Vale o de maior revisão: a cópia local só ganha se foi mexida e a conta não mudou desde então.
      if (!local || !local.dirty) return start(slot, remote.data, remote.revision, false, 'saved');
      if (local.revision === remote.revision)
        return start(slot, local.state, remote.revision, true, 'saving');
      const merged = mergeSaves(local.state, remote.data);
      if (!merged.conflict) return start(slot, merged.save, remote.revision, true, 'saving');
      return start(slot, merged.save, remote.revision, true, 'conflict', {
        account: remote.data,
        accountRevision: remote.revision,
        local: local.state,
        merged: merged.save,
      });
    },

    update(slot, state) {
      const rt = runtimes.get(slot);
      if (!rt) return;
      rt.state = state;
      rt.dirty = true;
      rt.version++;
      persist(slot, rt);
    },

    async flush(slot) {
      const rt = runtimes.get(slot);
      if (!rt) return;
      const wait = rt.lastPut + MIN_UPLOAD_GAP_MS - now();
      if (wait > 0 && !rt.inflight) await new Promise((r) => setTimeout(r, wait));
      await upload(slot, rt);
    },

    async resolveConflict(slot, choice) {
      const rt = runtimes.get(slot);
      const c = rt?.conflict;
      if (!rt || !c) throw new Error('no-conflict');
      // A versão que perde fica guardada neste aparelho (a conta só guarda a que vence).
      const loser = choice === 'account' ? c.local : choice === 'device' ? c.account : null;
      if (loser) write(key('backup', slot), { at: now(), state: loser });
      rt.conflict = null;
      rt.revision = c.accountRevision;
      rt.rejected = -1;
      if (choice === 'account') {
        rt.state = c.account;
        rt.dirty = false;
      } else {
        rt.state = choice === 'merge' ? c.merged : c.local;
        rt.dirty = true;
        rt.overwrite = choice === 'device';
      }
      rt.version++;
      persist(slot, rt);
      rt.sync = rt.dirty ? 'saving' : 'saved';
      emit(slot, rt, rt.state);
      if (rt.dirty) await upload(slot, rt);
      return rt.state;
    },

    sync: (slot) => runtimes.get(slot)?.sync ?? 'saved',
    conflict: (slot) => runtimes.get(slot)?.conflict ?? null,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async close(slot) {
      const rt = runtimes.get(slot);
      if (!rt) return;
      await upload(slot, rt);
      if (rt.timer) clearTimeout(rt.timer);
      runtimes.delete(slot);
      detach();
    },
  };
}
