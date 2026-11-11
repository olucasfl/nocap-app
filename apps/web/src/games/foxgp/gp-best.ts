import type { GpPhysicsMode } from '@nocap/games';

/** Melhor volta do aparelho, uma por modo de física (spec 080, decisão 11): os tempos de um modo não se misturam. */
const key = (mode: GpPhysicsMode) => `nocap-gp-best-${mode}`;

export function loadBest(mode: GpPhysicsMode): number | null {
  try {
    const v = Number(localStorage.getItem(key(mode)));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Guarda se for melhor; devolve true quando é um recorde novo do aparelho. */
export function saveBest(mode: GpPhysicsMode, ms: number): boolean {
  const old = loadBest(mode);
  if (old !== null && old <= ms) return false;
  try {
    localStorage.setItem(key(mode), String(Math.round(ms)));
  } catch {
    /* sem armazenamento */
  }
  return true;
}

const PHYS_KEY = 'nocap-gp-physics';
/** O modo escolhido na tela inicial (guardado no aparelho). */
export function loadPhysics(): GpPhysicsMode {
  try {
    return localStorage.getItem(PHYS_KEY) === 'real' ? 'real' : 'arcade';
  } catch {
    return 'arcade';
  }
}
export function savePhysics(mode: GpPhysicsMode) {
  try {
    localStorage.setItem(PHYS_KEY, mode);
  } catch {
    /* sem armazenamento */
  }
}

export const PHYSICS_NAME: Record<GpPhysicsMode, string> = { arcade: 'Arcade', real: 'Realista' };
