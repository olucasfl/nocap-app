const BEST_KEY = 'nocap-blocks-best';

/** O recorde (em pontos) deste aparelho, enquanto não há conta. O oficial vem do servidor. */
export function getBlocksBest(): number {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function setBlocksBest(score: number) {
  try {
    if (score > getBlocksBest()) localStorage.setItem(BEST_KEY, String(score));
  } catch {
    /* sem storage: sem recorde local */
  }
}

const TOWERS_KEY = 'nocap-towers-best';

/** O recorde do Block Towers (peças empilhadas), só neste aparelho por enquanto. */
export function getTowersBest(): number {
  try {
    const n = Number(localStorage.getItem(TOWERS_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function setTowersBest(pieces: number) {
  try {
    if (pieces > getTowersBest()) localStorage.setItem(TOWERS_KEY, String(pieces));
  } catch {
    /* sem storage: sem recorde local */
  }
}

const RUN_KEY = 'nocap-blocks-run';
/** A sessão assinada vale 7 dias no servidor; guardada por menos que isso, para ainda poder ser enviada. */
const RUN_MAX_AGE_MS = 6 * 24 * 3600_000;

/** A partida do Block Classic em andamento: o suficiente para refazê-la pela seed e seguir. */
export interface SavedRun {
  v: 1;
  userId: string;
  matchId: string;
  seed: string;
  session: string;
  moves: number[];
  thumbs: number;
  perfects: number;
  hintsUsed: number;
  /** O recorde de quando a partida começou (para a barra de recorde ao terminar). */
  before: number;
  savedAt: number;
}

export function loadSavedRun(userId: string | undefined, now = Date.now()): SavedRun | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as SavedRun;
    const ok =
      r.v === 1 &&
      r.userId === userId &&
      typeof r.seed === 'string' &&
      typeof r.matchId === 'string' &&
      typeof r.session === 'string' &&
      r.session !== '' &&
      Array.isArray(r.moves) &&
      r.moves.length > 0 &&
      now - r.savedAt < RUN_MAX_AGE_MS;
    return ok ? r : null;
  } catch {
    return null;
  }
}

export function saveRun(run: SavedRun) {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    /* sem storage: a partida só não poderá ser retomada */
  }
}

export function clearSavedRun() {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {
    /* nada a limpar */
  }
}
