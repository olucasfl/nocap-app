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
