import {
  GP_FUR_COLORS,
  GP_PALETTE,
  GP_PATTERN_IDS,
  gpDefaultKartPaint,
  gpValidFur,
  gpValidKartPaint,
  gpValidPaint,
  type GpKartPaint,
  type GpPaint,
  type GpPattern,
  type GpRoomCar,
} from '@nocap/games';
import { defaultPaint } from './car-model';

/**
 * A garagem salva no aparelho (spec 081, Fase 8): a raposa (pelo, a mesma nos dois carros) e uma pintura por veículo.
 * Versão 2: `{ v: 2, fur, paint (F1), kart }`. O que já estava salvo (`fur` e `paint`) continua valendo: o kart entra
 * com a pintura padrão nas cores do F1.
 */
export interface GpGarageSave {
  v: 2;
  fur: number;
  /** A pintura do F1 (Realista). */
  paint: GpPaint;
  /** A pintura do kart (Arcade). */
  kart: GpKartPaint;
}

const KEY = 'nocap-gp-garage';

const FUR_NAMES = ['Laranja', 'Lilás', 'Azul', 'Verde', 'Amarelo', 'Rosa', 'Branco', 'Café', 'Ártica', 'Prateada'];
/** Cores do pelo (a sala aceita só estas). */
export const GP_FUR_OPTIONS: { name: string; hex: number }[] = GP_FUR_COLORS.map((hex, i) => ({
  name: FUR_NAMES[i] ?? 'Raposa',
  hex,
}));

/** As 24 cores da pintura, em 3 grupos (vivas, escuras, metálicas). */
export const GP_PAINT_COLORS = GP_PALETTE;

const PATTERN_NAMES: Record<GpPattern, string> = {
  solida: 'Lisa',
  faixa: 'Faixa central',
  listras: 'Listras laterais',
  chevron: 'Chevron',
  duas: 'Duas faixas',
  diagonal: 'Diagonais',
  flecha: 'Ponta de flecha',
  metades: 'Metades',
  xadrez: 'Xadrez no bico',
  ondas: 'Ondas',
  raio: 'Relâmpago',
  pegadas: 'Pegadas de raposa',
};
export const GP_PATTERNS: { id: GpPattern; name: string }[] = GP_PATTERN_IDS.map((id) => ({
  id,
  name: PATTERN_NAMES[id],
}));

function fresh(fur = 0xff7d26): GpGarageSave {
  const paint = defaultPaint(fur);
  return { v: 2, fur, paint, kart: gpDefaultKartPaint(paint.body, paint.accent) };
}

export function loadGarage(): GpGarageSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<GpGarageSave>;
      const fur = gpValidFur(v.fur) ? v.fur : 0xff7d26;
      const paint = gpValidPaint(v.paint) ?? defaultPaint(fur);
      const kart = gpValidKartPaint(v.kart) ?? gpDefaultKartPaint(paint.body, paint.accent);
      return { v: 2, fur, paint, kart };
    }
  } catch {
    /* sem armazenamento ou estragado: começa do padrão */
  }
  return fresh();
}

export function saveGarage(g: GpGarageSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(g));
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
}

export const hex6 = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** O carro no formato que a sala aceita (o pelo e as duas pinturas: a sala usa a do veículo do modo). */
export const carForRoom = (g: GpGarageSave): GpRoomCar => ({ fur: g.fur, f1: g.paint, kart: g.kart });

/** O carro que veio da sala (já validado pelo servidor). */
export function carFromRoom(v: unknown): GpRoomCar | null {
  const c = v as Partial<GpRoomCar> | null;
  if (!c || typeof c !== 'object') return null;
  const f1 = gpValidPaint(c.f1);
  const kart = gpValidKartPaint(c.kart);
  if (!f1 || !kart || !gpValidFur(c.fur)) return null;
  return { fur: c.fur, f1, kart };
}
