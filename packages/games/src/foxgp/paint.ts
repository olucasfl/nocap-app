/**
 * Pinturas do Fox GP (spec 081, Fases 6.4, 7.1 e 8): as listas fechadas (a sala só aceita o que está aqui) e os
 * validadores. O F1 e o kart têm pinturas separadas; a raposa (pelo) é a mesma nos dois.
 */
import type { GpPaint } from './world';

/** 24 cores de carroceria e de detalhe, em 3 grupos: vivas, escuras e metálicas. */
export const GP_PALETTE: readonly { name: string; hex: number; group: 'viva' | 'escura' | 'metal' }[] = [
  { name: 'Laranja', hex: 0xff7d26, group: 'viva' },
  { name: 'Vermelho', hex: 0xe8343c, group: 'viva' },
  { name: 'Amarelo', hex: 0xffd23a, group: 'viva' },
  { name: 'Verde-limão', hex: 0x8ee03a, group: 'viva' },
  { name: 'Verde', hex: 0x1f8a5a, group: 'viva' },
  { name: 'Ciano', hex: 0x25c7e8, group: 'viva' },
  { name: 'Azul', hex: 0x2f5bff, group: 'viva' },
  { name: 'Roxo', hex: 0x8b5cff, group: 'viva' },
  { name: 'Rosa', hex: 0xd94a8c, group: 'viva' },
  { name: 'Branco', hex: 0xf4f6fb, group: 'viva' },
  { name: 'Preto', hex: 0x1b1535, group: 'escura' },
  { name: 'Grafite', hex: 0x3a3f4b, group: 'escura' },
  { name: 'Azul-marinho', hex: 0x1b2a5c, group: 'escura' },
  { name: 'Vinho', hex: 0x6e1a2c, group: 'escura' },
  { name: 'Verde-escuro', hex: 0x173d2b, group: 'escura' },
  { name: 'Marrom', hex: 0x5a3a22, group: 'escura' },
  { name: 'Berinjela', hex: 0x3d1f4f, group: 'escura' },
  { name: 'Petróleo', hex: 0x0f4650, group: 'escura' },
  { name: 'Prata', hex: 0xa9b2c7, group: 'metal' },
  { name: 'Ouro', hex: 0xd4a93a, group: 'metal' },
  { name: 'Bronze', hex: 0xa8663a, group: 'metal' },
  { name: 'Cromo azul', hex: 0x5b7fc4, group: 'metal' },
  { name: 'Grafite metálico', hex: 0x5c6170, group: 'metal' },
  { name: 'Champanhe', hex: 0xe6d3a8, group: 'metal' },
];

export type GpPattern = GpPaint['pattern'];
/** Os 12 desenhos do F1 (7.2), na ordem da garagem. */
export const GP_PATTERN_IDS: readonly GpPattern[] = [
  'solida',
  'faixa',
  'listras',
  'chevron',
  'duas',
  'diagonal',
  'flecha',
  'metades',
  'xadrez',
  'ondas',
  'raio',
  'pegadas',
];
export const GP_FINISHES = ['brilho', 'fosco', 'metal', 'perola'] as const;
export type GpFinish = (typeof GP_FINISHES)[number];
export const GP_NUM_STYLES = ['cheio', 'contorno', 'circulo'] as const;
export const GP_RIM_STYLES = ['liso', 'raios', 'furado', 'turbina'] as const;
/** 12 cores do aro. */
export const GP_RIM_COLORS: readonly number[] = [
  0x2c2c30, 0xa9b2c7, 0xd4a93a, 0xf4f6fb, 0x15131c, 0xe8343c, 0x2f5bff, 0xffd23a, 0x1f8a5a, 0xff7d26, 0xd94a8c, 0x8b5cff,
];
/** Faixa do pneu: vermelho (macio), amarelo, branco, azul, verde, rosa, ou nenhuma (−1). */
export const GP_TYRE_BANDS: readonly number[] = [0xe8343c, 0xffd23a, 0xf4f6fb, 0x2f5bff, 0x1f8a5a, 0xd94a8c, -1];

/** A pintura do kart (6.4): uma cor por peça, acabamento, número e o capacete (plano B da cabeça de raposa). */
export interface GpKartPaint {
  body: number;
  stripe: number;
  chassis: number;
  engine: number;
  tank: number;
  rim: number;
  steer: number;
  pedal: number;
  suit: number;
  suit2: number;
  glove: number;
  /** Capacete: sem (cabeça de raposa) ou com. */
  helmet: boolean;
  helmetColor: number;
  finish: GpFinish;
  number: number;
}

export function gpDefaultKartPaint(body = 0xff7d26, accent = 0x2f5bff): GpKartPaint {
  return {
    body,
    stripe: accent,
    chassis: 0x3a3f4b,
    engine: 0xa9b2c7,
    tank: 0xf4f6fb,
    rim: 0xa9b2c7,
    steer: 0x1b1535,
    pedal: 0xa9b2c7,
    suit: accent,
    suit2: 0xffd23a,
    glove: body,
    helmet: false,
    helmetColor: body,
    finish: 'brilho',
    number: 7,
  };
}

const PALETTE = new Set(GP_PALETTE.map((c) => c.hex));
const isColor = (v: unknown) => typeof v === 'number' && PALETTE.has(v);
const isNum = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 99;
const oneOf = <T>(list: readonly T[], v: unknown): v is T => list.includes(v as T);

/** A pintura do F1, se toda ela vem das listas (campos novos são opcionais: pinturas antigas continuam valendo). */
export function gpValidPaint(v: unknown): GpPaint | null {
  const p = v as Partial<GpPaint> | null;
  if (!p || typeof p !== 'object') return null;
  if (!isColor(p.body) || !isColor(p.accent) || !oneOf(GP_PATTERN_IDS, p.pattern) || !isNum(p.number)) return null;
  const out: GpPaint = { body: p.body!, accent: p.accent!, pattern: p.pattern, number: p.number! };
  if (p.third !== undefined) {
    if (!isColor(p.third)) return null;
    out.third = p.third;
  }
  if (p.finish !== undefined) {
    if (!oneOf(GP_FINISHES, p.finish)) return null;
    out.finish = p.finish;
  }
  if (p.numStyle !== undefined) {
    if (!oneOf(GP_NUM_STYLES, p.numStyle)) return null;
    out.numStyle = p.numStyle;
  }
  if (p.rim !== undefined) {
    if (!GP_RIM_COLORS.includes(p.rim)) return null;
    out.rim = p.rim;
  }
  if (p.rimStyle !== undefined) {
    if (!oneOf(GP_RIM_STYLES, p.rimStyle)) return null;
    out.rimStyle = p.rimStyle;
  }
  if (p.band !== undefined) {
    if (!GP_TYRE_BANDS.includes(p.band)) return null;
    out.band = p.band;
  }
  for (const k of ['helmet', 'glove', 'wing'] as const) {
    if (p[k] !== undefined) {
      if (!isColor(p[k])) return null;
      out[k] = p[k];
    }
  }
  return out;
}

export function gpValidKartPaint(v: unknown): GpKartPaint | null {
  const p = v as Partial<GpKartPaint> | null;
  if (!p || typeof p !== 'object') return null;
  const cols = ['body', 'stripe', 'chassis', 'engine', 'tank', 'rim', 'steer', 'pedal', 'suit', 'suit2', 'glove', 'helmetColor'] as const;
  for (const k of cols) if (!isColor(p[k])) return null;
  if (typeof p.helmet !== 'boolean' || !oneOf(GP_FINISHES, p.finish) || !isNum(p.number)) return null;
  const out = {} as GpKartPaint;
  for (const k of cols) out[k] = p[k] as number;
  out.helmet = p.helmet;
  out.finish = p.finish;
  out.number = p.number as number;
  return out;
}

/** A cor do pelo: as da garagem (as 8 do Fox Cap! mais raposa-do-ártico e prateada). */
export const GP_FUR_COLORS: readonly number[] = [
  0xff7d26, 0xb98cff, 0x4fc3f7, 0x7be07b, 0xffd23f, 0xff6f91, 0xf5f5f5, 0x8d6e63, 0xf1ede4, 0x8b93a3,
];
export const gpValidFur = (v: unknown): v is number => typeof v === 'number' && GP_FUR_COLORS.includes(v);

/** O carro de cada pessoa na sala (spec 081, Fase 8): o pelo e as duas pinturas (a sala usa a do veículo do modo). */
export interface GpRoomCar {
  fur: number;
  f1: GpPaint;
  kart: GpKartPaint;
}

export function gpValidRoomCar(v: unknown): GpRoomCar | null {
  const p = v as Partial<GpRoomCar> | null;
  if (!p || typeof p !== 'object' || !gpValidFur(p.fur)) return null;
  const f1 = gpValidPaint(p.f1);
  const kart = gpValidKartPaint(p.kart);
  return f1 && kart ? { fur: p.fur, f1, kart } : null;
}

/** Os nomes dos bots (treino e sala). */
export const GP_BOT_NAMES: readonly string[] = [
  'Faísca',
  'Pipoca',
  'Trufa',
  'Ruivo',
  'Brisa',
  'Nuvem',
  'Cacau',
  'Pimenta',
  'Gengibre',
  'Raposão',
  'Ventania',
];

/** O carro do bot `k` da sala (sempre o mesmo para a mesma vaga): pelo, F1 e kart das listas. */
export function gpBotCar(k: number): GpRoomCar {
  const body = GP_PALETTE[(k * 5 + 1) % 10]!.hex;
  const accent = GP_PALETTE[(k * 3 + 6) % 10]!.hex;
  return {
    fur: GP_FUR_COLORS[(k + 1) % GP_FUR_COLORS.length]!,
    f1: { body, accent, pattern: GP_PATTERN_IDS[k % GP_PATTERN_IDS.length]!, number: (k * 7 + 11) % 99 },
    kart: { ...gpDefaultKartPaint(body, accent), number: (k * 7 + 11) % 99 },
  };
}

/** Dificuldade dos bots da sala (12.4): mexe no talento do perfil. */
export const GP_BOT_LEVELS = ['facil', 'medio', 'dificil'] as const;
export type GpBotLevel = (typeof GP_BOT_LEVELS)[number];
export const GP_BOT_LEVEL_SKILL: Record<GpBotLevel, number> = { facil: -0.08, medio: 0, dificil: 0.05 };
/** Total de carros da sala com bots (0 = só gente). */
export const GP_FILL_OPTIONS: readonly number[] = [0, 4, 6, 8, 10, 12];
