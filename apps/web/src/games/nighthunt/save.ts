import { MAP_IDS, NH_EPOCH, emptySave, type NhSave } from '@nocap/games';

const KEY = 'nighthunt:save:v1';
/** Avisa a sincronização com a conta que o save mudou no aparelho / que a conta mandou um save mais novo. */
export const NH_CHANGED = 'nighthunt:changed';
export const NH_REMOTE = 'nighthunt:remote';

function normalize(s: Partial<NhSave>): NhSave {
  const base = emptySave();
  // save de outra geração (antes do reset): começa do zero
  if (s.epoch !== NH_EPOCH) return base;
  return {
    ...base,
    ...s,
    meta: { ...base.meta, ...s.meta },
    stats: {
      ...base.stats,
      ...s.stats,
      upgradeBest: { ...base.stats.upgradeBest, ...s.stats?.upgradeBest },
    },
    achievements: s.achievements ?? {},
    seen: s.seen ?? [],
    heroes: s.heroes?.length ? s.heroes : base.heroes,
    pick: {
      ...base.pick,
      ...s.pick,
      // um mapa que saiu do jogo volta para o primeiro
      map: MAP_IDS.includes(s.pick?.map ?? '') ? s.pick!.map : 'campo',
    },
  };
}

/** Save do aparelho. Conta logada: a sincronização (nighthunt-account.ts) troca com `user_prefs`, sem migration. */
export function loadSave(): NhSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NhSave>;
      if (parsed.epoch !== NH_EPOCH) localStorage.removeItem(KEY);
      return normalize(parsed);
    }
  } catch {
    /* save corrompido ou sem acesso: começa do zero */
  }
  return emptySave();
}

function store(s: NhSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sem armazenamento: o progresso vale só nesta sessão */
  }
}

export function writeSave(s: NhSave): void {
  s.rev = (s.rev ?? 0) + 1;
  store(s);
  window.dispatchEvent(new Event(NH_CHANGED));
}

/** Aplica um save que veio da conta (já com o `rev` dela) e avisa o jogo aberto. */
export function applyRemote(remote: Partial<NhSave>): void {
  store(normalize(remote));
  window.dispatchEvent(new Event(NH_REMOTE));
}
