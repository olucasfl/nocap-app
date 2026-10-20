import { mergeProgress, PROGRESS_GAMES, sameProgress, sanitizeProgress, type ProgressGame } from '@nocap/games';
import { apiClient } from '@/lib/api-client';
import { beeProgress, classicProgress, connectProgress, type ProgressStore } from './progress';

/**
 * Sincroniza o progresso das fases (Bee, Connect e Classic) com a conta (spec 037). O aparelho continua
 * guardando tudo (joga offline); com a conta ligada, cada fase também vai para o servidor e o que está lá
 * volta para o aparelho. Juntar sempre fica com o mais adiantado, então **nada se perde**.
 */

type AnyStore = ProgressStore<unknown>;
export const STORES: Record<ProgressGame, AnyStore> = {
  bee: beeProgress as AnyStore,
  connect: connectProgress as AnyStore,
  'classic-c': classicProgress.classic as AnyStore,
  'classic-d': classicProgress.dueto as AnyStore,
  'classic-q': classicProgress.quarteto as AnyStore,
};

const OWNER_KEY = 'nocap-words-owner';
const backupKey = (userId: string) => `nocap-words-backup-${userId}`;
const BATCH = 400;

type Snapshot = Record<ProgressGame, Record<string, unknown>>;
type Remote = Partial<Record<string, Record<string, unknown>>>;

const readLocal = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeLocal = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* sem armazenamento: segue sem o marcador */
  }
};

const emptySnapshot = (): Snapshot => Object.fromEntries(PROGRESS_GAMES.map((g) => [g, {}])) as Snapshot;
const copyAll = (): Snapshot => Object.fromEntries(PROGRESS_GAMES.map((g) => [g, { ...STORES[g].all() }])) as Snapshot;

/** Junta duas listas de fases de um jogo (`a` e `b` por número da fase). */
function mergeLevels(game: ProgressGame, a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [level, raw] of Object.entries(b)) {
    const incoming = sanitizeProgress(game, raw);
    if (!incoming) continue;
    const current = sanitizeProgress(game, out[level]);
    out[level] = current ? mergeProgress(game, current as never, incoming as never) : incoming;
  }
  return out;
}

export interface SyncState {
  userId: string | null;
  /** O que o servidor já tem (para só enviar o que mudou). */
  server: Snapshot;
  timer: ReturnType<typeof setTimeout> | undefined;
  running: Promise<void> | null;
}
export const state: SyncState = { userId: null, server: emptySnapshot(), timer: undefined, running: null };

/** O que falta enviar: fases do aparelho que o servidor não tem igual. */
export function pending(): { game: ProgressGame; level: number; data: unknown }[] {
  const out: { game: ProgressGame; level: number; data: unknown }[] = [];
  for (const game of PROGRESS_GAMES) {
    for (const [level, data] of Object.entries(STORES[game].all())) {
      if (!sameProgress(state.server[game][level], data)) out.push({ game, level: Number(level), data });
    }
  }
  return out;
}

/** Envia em lotes; só marca como enviado o que o servidor aceitou. */
export async function push(): Promise<void> {
  if (!state.userId) return;
  const todo = pending();
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    await apiClient.put('/me/words-progress', { entries: batch });
    for (const e of batch) state.server[e.game][String(e.level)] = e.data;
  }
}

/** Agenda o envio logo depois que o progresso muda (junta várias jogadas num só pedido). */
export function schedulePush(): void {
  if (!state.userId) return;
  clearTimeout(state.timer);
  state.timer = setTimeout(() => void push().catch(() => undefined), 1200);
}

/**
 * Troca de conta no mesmo aparelho: o progresso local é de quem estava antes. Ele fica guardado de lado (volta
 * se aquela conta entrar de novo) e a conta nova começa só com o que está na própria conta.
 */
function switchOwner(userId: string): void {
  const previous = readLocal(OWNER_KEY);
  if (previous && previous !== userId) {
    writeLocal(backupKey(previous), JSON.stringify(copyAll()));
    for (const g of PROGRESS_GAMES) STORES[g].replaceAll({});
  }
  writeLocal(OWNER_KEY, userId);
  // se esta conta já tinha um progresso guardado de lado neste aparelho, ele volta agora
  const backup = readLocal(backupKey(userId));
  if (backup) {
    try {
      const saved = JSON.parse(backup) as Partial<Snapshot>;
      for (const g of PROGRESS_GAMES) STORES[g].replaceAll(mergeLevels(g, STORES[g].all(), saved[g] ?? {}));
    } catch {
      /* backup ilegível: ignora */
    }
    writeLocal(backupKey(userId), null);
  }
}

/** Baixa o progresso da conta, junta com o do aparelho e envia o que o servidor ainda não tem. */
export async function syncNow(userId: string): Promise<void> {
  if (state.running) return state.running;
  state.running = (async () => {
    const remote = await apiClient.get<Remote>('/me/words-progress');
    if (state.userId !== userId) {
      state.userId = userId;
      state.server = emptySnapshot();
      switchOwner(userId);
    }
    for (const game of PROGRESS_GAMES) {
      const theirs = remote[game] ?? {};
      state.server[game] = { ...theirs };
      STORES[game].replaceAll(mergeLevels(game, STORES[game].all(), theirs));
    }
    await push();
  })().finally(() => {
    state.running = null;
  });
  return state.running;
}

/** Sai da conta: para de enviar (o progresso fica no aparelho). */
export function stopSync(): void {
  clearTimeout(state.timer);
  state.userId = null;
  state.server = emptySnapshot();
}

let wired = false;
/** Liga uma vez: cada mudança de progresso agenda o envio. */
export function wireStores(): void {
  if (wired) return;
  wired = true;
  for (const g of PROGRESS_GAMES) STORES[g].subscribe(schedulePush);
}
