import { useSyncExternalStore } from 'react';

export type ThemePref = 'auto' | 'light' | 'dark';

const KEY = 'nocap-theme';
const ORDER: ThemePref[] = ['auto', 'light', 'dark'];

/** Ciclo do chip: Automático → Claro → Escuro → Automático. */
export function nextTheme(pref: ThemePref): ThemePref {
  return ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]!;
}

export function parseTheme(raw: string | null): ThemePref {
  return raw === 'light' || raw === 'dark' ? raw : 'auto';
}

/** Tema efetivo: a escolha manual vence; no Automático vale o sistema. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): 'light' | 'dark' {
  return pref === 'auto' ? (systemDark ? 'dark' : 'light') : pref;
}

const listeners = new Set<() => void>();
let pref: ThemePref = 'auto';

function read(): ThemePref {
  try {
    return parseTheme(localStorage.getItem(KEY));
  } catch {
    return 'auto';
  }
}

/** Põe `data-theme` (só nas escolhas manuais) e alinha o `theme-color` ao papel do tema. */
function apply() {
  const root = document.documentElement;
  if (pref === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  // O papel vem do próprio token, então a cor literal fica só em tokens.css.
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
  if (paper) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper);
}

/** Chamar uma vez na inicialização (o script do index.html já evitou o flash). */
export function installTheme() {
  pref = read();
  apply();
  // No Automático o sistema pode mudar com o app aberto.
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => pref === 'auto' && apply());
}

export function setTheme(next: ThemePref) {
  pref = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage indisponível: vale só nesta sessão */
  }
  apply();
  listeners.forEach((l) => l());
}

export function useTheme(): ThemePref {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pref,
  );
}
