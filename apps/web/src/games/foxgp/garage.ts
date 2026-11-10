import type { GpPaint } from '@nocap/games';
import { defaultPaint } from './car-model';

/** A garagem salva no aparelho: cor do pelo e pintura do carro (só visual). */
export interface GpGarageSave {
  fur: number;
  paint: GpPaint;
}

const KEY = 'nocap-gp-garage';

/** Cores do pelo (a mesma paleta das salas do Atravessa!, que a sala aceita). */
export const GP_FUR_OPTIONS: { name: string; hex: number }[] = [
  { name: 'Laranja', hex: 0xff7d26 },
  { name: 'Lilás', hex: 0xb98cff },
  { name: 'Azul', hex: 0x4fc3f7 },
  { name: 'Verde', hex: 0x7be07b },
  { name: 'Amarelo', hex: 0xffd23f },
  { name: 'Rosa', hex: 0xff6f91 },
  { name: 'Branco', hex: 0xf5f5f5 },
  { name: 'Café', hex: 0x8d6e63 },
];

/** Cores de carroceria e de detalhe da pintura. */
export const GP_PAINT_COLORS: { name: string; hex: number }[] = [
  { name: 'Laranja', hex: 0xff7d26 },
  { name: 'Azul', hex: 0x2f5bff },
  { name: 'Vermelho', hex: 0xe8343c },
  { name: 'Verde', hex: 0x1f8a5a },
  { name: 'Amarelo', hex: 0xffd23a },
  { name: 'Roxo', hex: 0x8b5cff },
  { name: 'Branco', hex: 0xf4f6fb },
  { name: 'Preto', hex: 0x1b1535 },
  { name: 'Prata', hex: 0xa9b2c7 },
  { name: 'Rosa', hex: 0xd94a8c },
];

export const GP_PATTERNS: { id: GpPaint['pattern']; name: string }[] = [
  { id: 'faixa', name: 'Faixa central' },
  { id: 'listras', name: 'Listras laterais' },
  { id: 'chevron', name: 'Chevron' },
  { id: 'solida', name: 'Lisa' },
];

export function loadGarage(): GpGarageSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as GpGarageSave;
      if (
        typeof v.fur === 'number' &&
        v.paint &&
        typeof v.paint.body === 'number' &&
        typeof v.paint.accent === 'number' &&
        GP_PATTERNS.some((p) => p.id === v.paint.pattern) &&
        Number.isInteger(v.paint.number)
      )
        return v;
    }
  } catch {
    /* sem armazenamento ou estragado: começa do padrão */
  }
  return { fur: 0xff7d26, paint: defaultPaint(0xff7d26) };
}

export function saveGarage(g: GpGarageSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(g));
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
}

export const hex6 = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** A pintura no formato que a sala aceita (cores em texto). */
export const paintForRoom = (p: GpPaint) => ({
  body: hex6(p.body),
  accent: hex6(p.accent),
  pattern: p.pattern,
  number: p.number,
});

/** A pintura que veio da sala (cores em texto) no formato do jogo. */
export function paintFromRoom(v: unknown): GpPaint | null {
  const p = v as { body?: unknown; accent?: unknown; pattern?: unknown; number?: unknown } | null;
  if (!p || typeof p.body !== 'string' || typeof p.accent !== 'string') return null;
  const pattern = GP_PATTERNS.find((x) => x.id === p.pattern)?.id;
  if (!pattern || typeof p.number !== 'number') return null;
  return {
    body: Number.parseInt(p.body.replace('#', ''), 16),
    accent: Number.parseInt(p.accent.replace('#', ''), 16),
    pattern,
    number: p.number,
  };
}
