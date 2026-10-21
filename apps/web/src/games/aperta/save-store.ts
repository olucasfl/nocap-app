/**
 * Contrato de saves do Aperta! (spec 038, seções 3.2 e 10). As telas só conhecem esta interface:
 * a etapa 2 troca a versão local pela API (`/me/aperta/saves`) sem mexer nelas.
 */
export type SaveSlot = 1 | 2;
export const SAVE_SLOTS: readonly SaveSlot[] = [1, 2];

/** Quanto tempo um save apagado pode ser recuperado (decisão 14.13). */
export const RECOVERY_DAYS = 7;

/** O que a lista de saves mostra, sem abrir o JSON do jogo. */
export interface SaveSummary {
  slot: SaveSlot;
  name: string;
  collapses: number;
  atlasPages: number;
  /** ISO. Quando a pessoa jogou pela última vez. */
  lastPlayedAt: string;
  /** A história só passa no primeiro jogo de cada save. */
  storySeen: boolean;
}

export interface SaveStore {
  /** Sempre 2 posições: o índice 0 é o save 1; `null` é espaço vazio. */
  list(): Promise<(SaveSummary | null)[]>;
  /** Novo jogo no espaço. Falha se o espaço está ocupado. */
  create(slot: SaveSlot): Promise<SaveSummary>;
  /** Apaga com recuperação por `RECOVERY_DAYS` dias. */
  remove(slot: SaveSlot): Promise<void>;
  /** Desfaz o apagar, se ainda estiver no prazo e o espaço continuar vazio. */
  restore(slot: SaveSlot): Promise<SaveSummary | null>;
  markStorySeen(slot: SaveSlot): Promise<void>;
}

const DAY_MS = 86_400_000;
export const DEFAULT_SAVE_NAME = 'Missão Perigeu';

interface Stored {
  save: SaveSummary;
  /** ISO do apagar; ausente = save vivo. */
  deletedAt?: string;
}

/** Guarda tudo num mapa por espaço; o `persist` decide onde (memória, localStorage). */
function createStore(
  load: () => Partial<Record<SaveSlot, Stored>>,
  persist: (data: Partial<Record<SaveSlot, Stored>>) => void,
  now: () => number,
): SaveStore {
  const read = () => {
    const data = load();
    // Passou do prazo: some de vez.
    for (const s of SAVE_SLOTS) {
      const del = data[s]?.deletedAt;
      if (del && now() - Date.parse(del) > RECOVERY_DAYS * DAY_MS) delete data[s];
    }
    return data;
  };
  const live = (e: Stored | undefined) => (e && !e.deletedAt ? e.save : null);

  return {
    async list() {
      const data = read();
      return SAVE_SLOTS.map((s) => live(data[s]));
    },
    async create(slot) {
      const data = read();
      if (live(data[slot])) throw new Error('slot-taken');
      const save: SaveSummary = {
        slot,
        name: DEFAULT_SAVE_NAME,
        collapses: 0,
        atlasPages: 0,
        lastPlayedAt: new Date(now()).toISOString(),
        storySeen: false,
      };
      data[slot] = { save };
      persist(data);
      return save;
    },
    async remove(slot) {
      const data = read();
      const entry = data[slot];
      if (!entry || entry.deletedAt) return;
      entry.deletedAt = new Date(now()).toISOString();
      persist(data);
    },
    async restore(slot) {
      const data = read();
      const entry = data[slot];
      if (!entry?.deletedAt) return null;
      delete entry.deletedAt;
      persist(data);
      return entry.save;
    },
    async markStorySeen(slot) {
      const data = read();
      const entry = live(data[slot]);
      if (!entry) return;
      entry.storySeen = true;
      persist(data);
    },
  };
}

/** Só em memória: testes. */
export function createMemorySaveStore(now: () => number = Date.now): SaveStore {
  let data: Partial<Record<SaveSlot, Stored>> = {};
  return createStore(
    () => data,
    (d) => {
      data = d;
    },
    now,
  );
}

const KEY = 'nocap-aperta-dev-saves';

/**
 * Só para desenvolvimento, até a API da etapa 2: o save fica neste aparelho. A conta de quem
 * está logado entra na chave para dois jogadores no mesmo aparelho não dividirem saves.
 */
export function createLocalSaveStore(userId: string, now: () => number = Date.now): SaveStore {
  const key = `${KEY}:${userId}`;
  return createStore(
    () => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as Partial<Record<SaveSlot, Stored>>) : {};
      } catch {
        return {};
      }
    },
    (data) => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        /* storage indisponível: o save vale só até recarregar */
      }
    },
    now,
  );
}

/** "Jogado há 3 h", "há 2 dias", "agora há pouco". */
export function playedAgo(iso: string, nowMs: number = Date.now()): string {
  const min = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 60_000));
  if (min < 2) return 'Jogado agora há pouco';
  if (min < 60) return `Jogado há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Jogado há ${h} h`;
  const d = Math.floor(h / 24);
  return `Jogado há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

export function saveStats(s: SaveSummary): string {
  const c = `${s.collapses} ${s.collapses === 1 ? 'colapso' : 'colapsos'}`;
  const p = `${s.atlasPages} ${s.atlasPages === 1 ? 'página' : 'páginas'} no Atlas`;
  return `${c} · ${p}`;
}
