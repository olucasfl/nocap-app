import { useSyncExternalStore } from 'react';

export type ThemePref = 'light' | 'dark';

const KEY = 'nocap-theme';

/** O chip alterna entre Claro e Escuro. */
export function nextTheme(pref: ThemePref): ThemePref {
  return pref === 'light' ? 'dark' : 'light';
}

/** Valor salvo (ou, na primeira vez, o tema do sistema como ponto de partida). */
export function parseTheme(raw: string | null, systemDark = false): ThemePref {
  if (raw === 'light' || raw === 'dark') return raw;
  return systemDark ? 'dark' : 'light';
}

const listeners = new Set<() => void>();
let pref: ThemePref = 'light';

function read(): ThemePref {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  try {
    return parseTheme(localStorage.getItem(KEY), systemDark);
  } catch {
    return parseTheme(null, systemDark);
  }
}

/** Põe `data-theme` e alinha o `theme-color` ao papel do tema. */
function apply() {
  const root = document.documentElement;
  root.setAttribute('data-theme', pref);
  // O papel vem do próprio token, então a cor literal fica só em tokens.css.
  const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
  if (paper) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paper);
}

/** Chamar uma vez na inicialização (o script do index.html já evitou o flash). */
export function installTheme() {
  pref = read();
  apply();
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
