import type { GpPhysicsMode } from '@nocap/games';

import { gpNotify } from './gp-bus';

/**
 * Melhor volta de cada pista (14/11/2026): os tempos de pistas e modos diferentes não se misturam, então a chave é a pista
 * (Marina e Interlagos são do Realista; a Bala Track é do Arcade). Chave nova: os recordes antigos (um por modo) foram zerados
 * para todo mundo e os de agora também sobem para a conta.
 */
const BEST_KEY = 'nocap-gp-best2';
const OLD_KEYS = ['nocap-gp-best-arcade', 'nocap-gp-best-real'];

function readBest(): Record<string, number> {
  try {
    for (const k of OLD_KEYS) localStorage.removeItem(k);
    const raw = localStorage.getItem(BEST_KEY);
    const v = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const out: Record<string, number> = {};
    for (const [k, ms] of Object.entries(v)) if (typeof ms === 'number' && ms > 0 && Number.isFinite(ms)) out[k] = ms;
    return out;
  } catch {
    return {};
  }
}

export const loadAllBest = readBest;

export function loadBest(trackId: string): number | null {
  return readBest()[trackId] ?? null;
}

/** Grava as melhores voltas vindas da conta: fica a menor de cada pista. */
export function mergeBest(remote: Record<string, number>) {
  const all = readBest();
  for (const [k, ms] of Object.entries(remote)) if (ms > 0 && (all[k] === undefined || ms < all[k]!)) all[k] = Math.round(ms);
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
  } catch {
    /* sem armazenamento */
  }
}

/** Guarda se for melhor; devolve true quando é um recorde novo. */
export function saveBest(trackId: string, ms: number): boolean {
  const all = readBest();
  const old = all[trackId];
  if (old !== undefined && old <= ms) return false;
  all[trackId] = Math.round(ms);
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
  } catch {
    /* sem armazenamento */
  }
  gpNotify();
  return true;
}

const PHYS_KEY = 'nocap-gp-physics';
/** O modo escolhido em "Antes de correr" (guardado no aparelho e na conta). Padrão: Realista. */
export function loadPhysics(): GpPhysicsMode {
  try {
    return localStorage.getItem(PHYS_KEY) === 'arcade' ? 'arcade' : 'real';
  } catch {
    return 'real';
  }
}
export function savePhysics(mode: GpPhysicsMode) {
  try {
    localStorage.setItem(PHYS_KEY, mode);
  } catch {
    /* sem armazenamento */
  }
  gpNotify();
}

const VEH_KEY = 'nocap-gp-vehicle';
export type GpVehicleId = 'kart' | 'f1';
/** O carro que ficou na tela inicial da última vez: volta o mesmo. Padrão: F1. */
export function loadVehicle(): GpVehicleId {
  try {
    return localStorage.getItem(VEH_KEY) === 'kart' ? 'kart' : 'f1';
  } catch {
    return 'f1';
  }
}
export function saveVehicle(v: GpVehicleId) {
  try {
    localStorage.setItem(VEH_KEY, v);
  } catch {
    /* sem armazenamento */
  }
  gpNotify();
}

const TRACK_KEY = 'nocap-gp-track';
/** A pista escolhida do Realista (a do Arcade é só uma). */
export function loadTrack(): string {
  try {
    return localStorage.getItem(TRACK_KEY) === 'interlagos' ? 'interlagos' : 'marina';
  } catch {
    return 'marina';
  }
}
export function saveTrack(id: string) {
  try {
    localStorage.setItem(TRACK_KEY, id);
  } catch {
    /* sem armazenamento */
  }
  gpNotify();
}

export const PHYSICS_NAME: Record<GpPhysicsMode, string> = { arcade: 'Arcade', real: 'Realista' };

const BACK_KEY = 'nocap-gp-back';

/**
 * Saída de uma partida (spec 081, Fase 1.5): marca que a tela do Fox GP vai aparecer de volta, para ela abrir já pronta,
 * sem a animação de entrada.
 */
export function gpMarkBack() {
  try {
    sessionStorage.setItem(BACK_KEY, '1');
  } catch {
    /* sem armazenamento: só mostra a animação */
  }
}

/** Leu e apagou o sinal de volta de uma partida. */
export function gpTakeBack(): boolean {
  try {
    const v = sessionStorage.getItem(BACK_KEY) === '1';
    sessionStorage.removeItem(BACK_KEY);
    return v;
  } catch {
    return false;
  }
}
