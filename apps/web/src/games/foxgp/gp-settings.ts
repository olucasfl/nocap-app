import { create } from 'zustand';
import { bindLabel } from '../foxshot/fs-settings';

/**
 * Comandos do Fox GP (spec 080, Fase 9): o mesmo jeito de guardar do Counter Fox (`fs-settings.ts`), com chave própria
 * (`nocap-gp-controls`) porque as ações são outras. Cada ação tem tecla principal e secundária (`event.code`). O menu
 * (Esc) é fixo: nunca fica sem função.
 */
export const GP_ACTIONS = [
  { id: 'gas', label: 'Acelerar' },
  { id: 'brake', label: 'Frear (parado, ré)' },
  { id: 'left', label: 'Virar à esquerda' },
  { id: 'right', label: 'Virar à direita' },
  { id: 'drs', label: 'Abrir a asa (DRS)' },
  { id: 'cam', label: 'Trocar a câmera' },
  { id: 'lap', label: 'Iniciar a volta lançada' },
] as const;
export type GpAction = (typeof GP_ACTIONS)[number]['id'];
export type GpBinds = Record<GpAction, [string, string]>;

export const GP_DEFAULT_BINDS: GpBinds = {
  gas: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  drs: ['KeyE', ''],
  cam: ['KeyC', ''],
  lap: ['KeyL', ''],
};

const KEY = 'nocap-gp-controls';
const copy = (b: GpBinds): GpBinds =>
  Object.fromEntries(Object.entries(b).map(([k, v]) => [k, [...v]])) as unknown as GpBinds;

function load(): GpBinds {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return copy(GP_DEFAULT_BINDS);
    const p = JSON.parse(raw) as Partial<Record<GpAction, unknown>>;
    const out = copy(GP_DEFAULT_BINDS);
    for (const a of GP_ACTIONS) {
      const v = p[a.id];
      if (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'string'))
        out[a.id] = [v[0] as string, v[1] as string];
    }
    return out;
  } catch {
    return copy(GP_DEFAULT_BINDS);
  }
}

function persist(binds: GpBinds) {
  try {
    localStorage.setItem(KEY, JSON.stringify(binds));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}

/** Onde uma tecla já está em uso (outra ação ou o outro lugar da mesma), ou null. */
export function gpBindOwner(
  binds: GpBinds,
  code: string,
  except?: { action: GpAction; slot: 0 | 1 },
) {
  if (!code) return null;
  for (const a of GP_ACTIONS)
    for (const slot of [0, 1] as const) {
      if (except && except.action === a.id && except.slot === slot) continue;
      if (binds[a.id][slot] === code) return { action: a.id, slot };
    }
  return null;
}

interface Store {
  binds: GpBinds;
  /** Põe `code` na ação. Com `swap`, quem já usava a tecla fica com a tecla antiga desta ação (trocam). */
  bind: (action: GpAction, slot: 0 | 1, code: string, swap?: boolean) => void;
  reset: () => void;
}

export const useGpControls = create<Store>((set, get) => ({
  binds: load(),
  bind: (action, slot, code, swap = false) => {
    const binds = copy(get().binds);
    const old = binds[action][slot];
    const owner = gpBindOwner(binds, code, { action, slot });
    if (owner && swap) binds[owner.action][owner.slot] = old;
    binds[action][slot] = code;
    set({ binds });
    persist(binds);
  },
  reset: () => {
    const binds = copy(GP_DEFAULT_BINDS);
    set({ binds });
    persist(binds);
  },
}));

export const gpBinds = (): GpBinds => useGpControls.getState().binds;

/** A ação de uma tecla agora (lida a cada tecla: a troca no menu vale na hora). */
export function gpActionOf(code: string): GpAction | null {
  const b = gpBinds();
  for (const a of GP_ACTIONS) if (b[a.id][0] === code || b[a.id][1] === code) return a.id;
  return null;
}

/** O nome da tecla principal de uma ação (a que a HUD mostra), ou a secundária se a principal estiver vazia. */
export function gpKeyName(action: GpAction, binds: GpBinds = gpBinds()): string {
  const [a, b] = binds[action];
  return a ? bindLabel(a) : b ? bindLabel(b) : '—';
}

export { bindLabel };
