/**
 * Sinal Vermelho (spec 020): constantes e tipos. Tudo em metros e segundos. A simulação roda em
 * passo fixo (60 por segundo) e só usa contas que dão o mesmo resultado em qualquer aparelho
 * (soma, subtração, multiplicação, divisão, raiz quadrada): nada de exp, sin ou cos, para o
 * servidor refazer a corrida e chegar exatamente no mesmo lugar do jogo.
 */

export type SinalMapId = 'horta' | 'neon' | 'deserto';
export const SINAL_MAPS: readonly SinalMapId[] = ['horta', 'neon', 'deserto'];

export type SinalMode = 'infinito' | 'classico';
export const SINAL_MODES: readonly SinalMode[] = ['infinito', 'classico'];

export function isSinalMode(m: unknown): m is SinalMode {
  return m === 'infinito' || m === 'classico';
}
/** O modo guardado no servidor: `sinal-infinito` e `sinal-classico`. */
export const sinalMode = (m: SinalMode): string => `sinal-${m}`;

export const TPS = 60;
export const DT = 1 / TPS;

/** O boneco. */
export const MAX_SPEED = 4.2;
/** Abaixo disto o analógico conta como parado (o dedo tremendo não vale). */
export const DEADZONE = 0.12;
/** Andar mais devagar que isto (m/s) já conta como parado para o Vigia. */
export const MOVE_EPS = 0.2;
export const PLAYER_R = 0.45;
/** Meia largura do corredor (o corredor tem 15 m: espaço para desviar e escolher o caminho). */
export const HALF = 7.5;
/** Quanto o boneco pode voltar para trás da largada. */
export const BACK_LIMIT = -6;

/** Folga logo depois que o Vigia começa a olhar (quem já estava no embalo). */
export const LOOK_GRACE = 0.12;
/** A primeira volta do Vigia só começa depois deste tempo (a pessoa se situa). */
export const LEAD_IN_S = 2.5;

/** A escuridão nunca anda mais rápido que isto: 92% da velocidade do boneco. */
export const DARK_CAP_FRACTION = 0.92;
export const DARK_CAP = MAX_SPEED * DARK_CAP_FRACTION;

/** Esconderijo: o raio da zona, quanto aguenta (s) e quanto se recupera por segundo fora dele. */
export const COVER_ZONE_R = 1.3;
export const COVER_DURABILITY = 4.5;
export const COVER_FRAGILE = 2.5;
export const COVER_REGEN = 0.6;

/** A nota guardada é em décimos de metro e cabe num campo de 16 bits. */
export const SINAL_MAX_TENTHS = 32767;
/** Uma corrida mais longa que isto (uma hora) o servidor recusa. */
export const SINAL_MAX_TICKS = 60 * 60 * TPS;
export const SINAL_MAX_INPUTS = 40_000;

// ---- poderes -----------------------------------------------------------------

export type PowerKind =
  | 'corvos'
  | 'oleo'
  | 'poeira'
  | 'buzina'
  | 'farois'
  | 'vento'
  | 'atraso'
  | 'invertido'
  | 'cortina'
  | 'rajada'
  | 'lama'
  | 'apagao'
  | 'chuva';

export interface PowerSpec {
  /** Segundos de aviso (o poder ainda não faz efeito) e de efeito. */
  tele: number;
  effect: number;
}

export const POWER_SPECS: Record<PowerKind, PowerSpec> = {
  // dos Vigias comuns (três por mapa): atrapalham de verdade desde a primeira fase
  // O aviso dura uns 2 s: dá tempo de ler o quadro e decidir o que fazer.
  corvos: { tele: 2.0, effect: 2.2 },
  oleo: { tele: 1.9, effect: 3.0 },
  poeira: { tele: 2.0, effect: 2.4 },
  buzina: { tele: 2.0, effect: 1.2 },
  farois: { tele: 1.9, effect: 2.2 },
  vento: { tele: 2.0, effect: 2.4 },
  atraso: { tele: 2.0, effect: 2.6 },
  // dos chefes e do Infinito
  invertido: { tele: 2.0, effect: 2.5 },
  cortina: { tele: 1.9, effect: 2.8 },
  rajada: { tele: 2.0, effect: 2.0 },
  lama: { tele: 1.9, effect: 3.0 },
  apagao: { tele: 2.0, effect: 3.0 },
  chuva: { tele: 2.2, effect: 0.4 },
};

/** Os poderes do Vigia de cada mapa (cada Vigia tem três). */
export const OWN_POWERS: Record<SinalMapId, readonly PowerKind[]> = {
  horta: ['corvos', 'lama', 'chuva'],
  neon: ['oleo', 'buzina', 'farois'],
  deserto: ['poeira', 'vento', 'atraso'],
};

/** A reserva dos chefes. */
export const BOSS_POWERS: readonly PowerKind[] = [
  'invertido',
  'cortina',
  'rajada',
  'lama',
  'apagao',
  'chuva',
];

/** O efeito termina pelo menos isto antes de o Vigia olhar (sempre dá tempo de parar). */
export const POWER_RECOVERY_S = 1.2;
/** E termina antes de o aviso de olhar começar, com esta folga. */
export const POWER_AVISO_MARGIN_S = 0.2;

/** Valores dos poderes que mexem no boneco. */
export const RAJADA_SPEED = 2.0; // 2 s x 2 m/s = 4 m no máximo
export const LAMA_FACTOR = 0.4;
export const OLEO_SLICK = 0.012; // quanto da diferença para o alvo a velocidade corrige por passo (bem escorregadio: ~1,4 s para virar)
export const OLEO_RADIUS = 2.0;
export const VENTO_SPEED = 1.8; // 2,4 s x 1,8 m/s = 4,3 m no máximo
/** Atraso do analógico (passos): 0,4 s. */
export const ATRASO_TICKS = 24;
export const CHUVA_RADIUS = 1.8;
export const CHUVA_IMPULSE = 6.25; // 0,4 s x 6,25 m/s = 2,5 m
export const CHUVA_PUSH_S = 0.4;

// ---- entradas e resultado ----------------------------------------------------

/** O analógico mudou: instante (passo) e direção em inteiros de -100 a 100. */
export interface SinalInput {
  tick: number;
  x: number;
  y: number;
}

export type SinalEnd = 'vigia' | 'escuridao';

export interface SinalResult {
  mode: SinalMode;
  /** Pontos em décimos de metro, já limitados ao teto. */
  tenths: number;
  /** Distância total em metros (Clássico: soma das fases; Infinito: o ponto mais longe). */
  meters: number;
  /** Fases cumpridas (só no Clássico). */
  phases: number;
  /** Por que acabou (null = a corrida ainda não acabou). */
  ended: SinalEnd | null;
  endedTick: number;
}

export type SinalEvent =
  | { kind: 'aviso'; fake: boolean; variant: CycleKind }
  | { kind: 'olhando' }
  | { kind: 'voltando' }
  | { kind: 'poder-aviso'; power: PowerKind }
  | { kind: 'poder'; power: PowerKind }
  | { kind: 'poder-evitado'; power: PowerKind }
  | { kind: 'poder-fim'; power: PowerKind }
  | { kind: 'quebrou'; cover: number }
  | { kind: 'fase'; n: number; map: SinalMapId; boss: boolean; mapChanged: boolean }
  | { kind: 'fim'; reason: SinalEnd };

/** Os jeitos de o Vigia olhar: normal, rápido (pouco aviso), longo, espia (olhadinha) e duplo. */
export type CycleKind = 'normal' | 'rapido' | 'longo' | 'espia' | 'duplo';

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
