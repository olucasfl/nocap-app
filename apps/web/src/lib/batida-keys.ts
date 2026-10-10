/**
 * Teclas das 5 pistas do Batida no computador. O padrão é 1, 2, 3, 4 e 5; a pessoa muda no menu
 * de pausa (ou na abertura) e a escolha fica guardada no aparelho.
 */
const KEY = 'nocap-batida-keys';

export const DEFAULT_KEYS: readonly string[] = ['1', '2', '3', '4', '5'];

/** Teclas que o jogo usa para outra coisa e por isso não podem ser de pista. */
const RESERVED = new Set(['escape', 'tab', 'enter', 'meta', 'control', 'alt', 'shift', 'capslock']);

/** Valor interno de uma tecla: minúscula, com `espaço` no lugar do " ". */
export function normalizeKey(key: string): string {
  if (key === ' ') return 'espaço';
  return key.length === 1 ? key.toLowerCase() : key.toLowerCase();
}

/** Como a tecla aparece no botão: "A", "5", "ESPAÇO", "↑". */
export function keyLabel(key: string): string {
  const k = normalizeKey(key);
  const names: Record<string, string> = {
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    espaço: 'ESPAÇO',
  };
  return names[k] ?? k.toUpperCase();
}

/** A tecla pode ser de pista? Só as que o jogo não usa para sair, pausar ou navegar. */
export function isAssignable(key: string): boolean {
  const k = normalizeKey(key);
  return k.length > 0 && !RESERVED.has(k) && !/^f\d{1,2}$/.test(k);
}

/**
 * Põe `key` na pista `lane`. Se outra pista já usava essa tecla, as duas trocam de tecla (assim
 * nunca há duas pistas com a mesma). Devolve `null` se a tecla não pode ser usada.
 */
export function assignKey(keys: readonly string[], lane: number, key: string): string[] | null {
  if (!isAssignable(key) || lane < 0 || lane >= keys.length) return null;
  const k = normalizeKey(key);
  const next = [...keys];
  const other = next.findIndex((x, i) => i !== lane && x === k);
  if (other !== -1) next[other] = next[lane]!;
  next[lane] = k;
  return next;
}

/** Valida o que veio do armazenamento: 5 teclas diferentes e usáveis, ou o padrão. */
export function sanitizeKeys(raw: unknown): string[] {
  if (
    Array.isArray(raw) &&
    raw.length === DEFAULT_KEYS.length &&
    raw.every((k) => typeof k === 'string' && isAssignable(k)) &&
    new Set(raw.map((k: string) => normalizeKey(k))).size === raw.length
  ) {
    return raw.map((k: string) => normalizeKey(k));
  }
  return [...DEFAULT_KEYS];
}

export function getBatidaKeys(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return sanitizeKeys(raw ? JSON.parse(raw) : null);
  } catch {
    return [...DEFAULT_KEYS];
  }
}

export function setBatidaKeys(keys: readonly string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitizeKeys(keys)));
  } catch {
    /* sem storage: vale o padrão na próxima vez */
  }
}

/** A pista de uma tecla apertada (ou `undefined` se não é de nenhuma). */
export function laneOfKey(keys: readonly string[], key: string): number | undefined {
  const i = keys.indexOf(normalizeKey(key));
  return i === -1 ? undefined : i;
}
