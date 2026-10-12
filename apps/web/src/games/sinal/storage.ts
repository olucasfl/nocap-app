import type { SinalMode } from '@nocap/games';

/** As 12 cores do boneco (a escolha fica guardada). Na sala, cada cor é de uma pessoa só. */
export const SINAL_COLORS: readonly { name: string; hex: string }[] = [
  { name: 'Laranja', hex: '#ff6a2b' },
  { name: 'Azul', hex: '#2f5bff' },
  { name: 'Amarelo', hex: '#ffd23f' },
  { name: 'Verde', hex: '#33c27f' },
  { name: 'Rosa', hex: '#ff9ecf' },
  { name: 'Roxo', hex: '#7a3cff' },
  { name: 'Ciano', hex: '#25c7e8' },
  { name: 'Vermelho', hex: '#e5303a' },
  { name: 'Branco', hex: '#f4f4ef' },
  { name: 'Grafite', hex: '#3a3a36' },
  { name: 'Marrom', hex: '#8b5a2b' },
  { name: 'Lima', hex: '#b6e83a' },
];

const COLOR_KEY = 'nocap-sinal-color';
const BEST_KEY = 'nocap-sinal-best';

export function getSinalColor(): string {
  try {
    const hex = localStorage.getItem(COLOR_KEY);
    return SINAL_COLORS.some((c) => c.hex === hex) ? hex! : SINAL_COLORS[0]!.hex;
  } catch {
    return SINAL_COLORS[0]!.hex;
  }
}
export function setSinalColor(hex: string) {
  try {
    localStorage.setItem(COLOR_KEY, hex);
  } catch {
    /* sem storage: escolhe de novo da próxima vez */
  }
}

/** O recorde (em metros) deste aparelho, até o ranking do servidor existir. */
export function getSinalBest(mode: SinalMode): number {
  try {
    const all = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as Record<string, number>;
    const n = Number(all[mode]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}
export function setSinalBest(mode: SinalMode, meters: number) {
  try {
    const all = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as Record<string, number>;
    all[mode] = Math.max(meters, Number(all[mode]) || 0);
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
  } catch {
    /* sem storage */
  }
}
