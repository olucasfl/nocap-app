import { emptySave, type NhSave } from '@nocap/games';

const KEY = 'nighthunt:save:v1';

/** Save do aparelho (a conta ganha a mesma estrutura depois, como no Mini Golf). */
export function loadSave(): NhSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<NhSave>;
      const base = emptySave();
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
      };
    }
  } catch {
    /* save corrompido ou sem acesso: começa do zero */
  }
  return emptySave();
}

export function writeSave(s: NhSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sem armazenamento: o progresso vale só nesta sessão */
  }
}
