import { create } from 'zustand';
import { BUILD_ID } from './build-id';

/**
 * Esta versão do app é a mais nova no ar? O build grava o próprio commit em `/version.json` (sempre buscado na rede,
 * sem cache nem service worker); quem abre o app velho e tenta entrar numa sala vê "Atualize antes de entrar".
 * Sem conseguir checar (offline, desenvolvimento) não bloqueia ninguém.
 */
export async function appOutdated(): Promise<boolean> {
  if (BUILD_ID === 'dev') return false;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { id?: unknown };
    return typeof data.id === 'string' && data.id.length > 0 && data.id !== BUILD_ID;
  } catch {
    return false;
  }
}

/** O que a pessoa estava fazendo ao ser parada: depois de atualizar, o app continua daí. */
export type EntryAttempt = { kind: 'create'; game: string } | { kind: 'join'; code: string };

const RESUME_KEY = 'nocap-resume-entry';
const RESUME_MAX_AGE_MS = 5 * 60_000;

export function saveResume(a: EntryAttempt) {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ a, at: Date.now() }));
  } catch {
    /* sem storage: a pessoa repete o toque depois de atualizar */
  }
}

/** A tentativa guardada antes de atualizar (uma vez só, e só se for recente). */
export function takeResume(): EntryAttempt | null {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    sessionStorage.removeItem(RESUME_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { a?: EntryAttempt; at?: number };
    if (!v.a || typeof v.at !== 'number' || Date.now() - v.at > RESUME_MAX_AGE_MS) return null;
    return v.a;
  } catch {
    return null;
  }
}

/** O aviso "Atualize antes de entrar" (um só para o app inteiro). */
export const useEnterGate = create<{ pending: EntryAttempt | null }>(() => ({ pending: null }));
