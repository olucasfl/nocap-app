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

/** As 12 cores do boneco no online: cada pessoa da sala tem uma, e ninguém repete. */
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
  | 'chuva'
  // as brincadeiras: efeitos que mexem com a cabeça de quem joga
  | 'espelho'
  | 'bebado'
  | 'soluco'
  | 'turbo'
  | 'patins'
  | 'bolhas'
  | 'pixelado'
  | 'negativo'
  | 'lupa';

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
  // os de visão (poeira, faróis, cortina, apagão) duram bem mais: ficar às escuras é o castigo
  poeira: { tele: 2.0, effect: 5.0 },
  buzina: { tele: 2.0, effect: 1.2 },
  farois: { tele: 1.9, effect: 5.0 },
  vento: { tele: 2.0, effect: 2.4 },
  atraso: { tele: 2.0, effect: 2.6 },
  // dos chefes e do Infinito
  invertido: { tele: 2.0, effect: 2.5 },
  cortina: { tele: 1.9, effect: 5.0 },
  rajada: { tele: 2.0, effect: 2.0 },
  lama: { tele: 1.9, effect: 3.0 },
  apagao: { tele: 2.0, effect: 5.5 },
  chuva: { tele: 2.2, effect: 0.4 },
  // as brincadeiras
  espelho: { tele: 1.8, effect: 3.0 },
  bebado: { tele: 1.9, effect: 3.4 },
  soluco: { tele: 1.8, effect: 3.3 },
  turbo: { tele: 1.8, effect: 2.8 },
  patins: { tele: 1.9, effect: 3.4 },
  bolhas: { tele: 1.7, effect: 3.8 },
  pixelado: { tele: 1.8, effect: 3.0 },
  negativo: { tele: 1.8, effect: 3.0 },
  lupa: { tele: 1.8, effect: 2.8 },
};

/** Os poderes do Vigia de cada mapa (cada Vigia tem três). */
export const OWN_POWERS: Record<SinalMapId, readonly PowerKind[]> = {
  horta: ['corvos', 'lama', 'chuva'],
  neon: ['oleo', 'buzina', 'farois'],
  deserto: ['poeira', 'vento', 'atraso'],
};

/** Os poderes que vão sendo liberados para qualquer Vigia conforme a fase avança (nível mínimo). */
export const UNLOCKED_POWERS: readonly { level: number; kinds: readonly PowerKind[] }[] = [
  { level: 2, kinds: ['espelho', 'bolhas'] },
  { level: 3, kinds: ['rajada', 'cortina'] },
  { level: 4, kinds: ['soluco', 'negativo'] },
  { level: 5, kinds: ['lama', 'invertido'] },
  { level: 6, kinds: ['bebado', 'pixelado', 'patins'] },
  { level: 7, kinds: ['apagao', 'chuva'] },
  { level: 8, kinds: ['turbo', 'lupa'] },
];

/** O efeito termina pelo menos isto antes de o Vigia olhar (sempre dá tempo de parar). */
export const POWER_RECOVERY_S = 1.2;
/** E termina antes de o aviso de olhar começar, com esta folga. */
export const POWER_AVISO_MARGIN_S = 0.2;
/** Nos ciclos "de emboscada" o Vigia vira logo depois do poder: o efeito acaba só esta folga antes do aviso. */
export const POWER_TIGHT_MARGIN_S = 0.15;

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

/** Obstáculos que fazem coisas (ficam parados no chão e agem em quem passa por cima ou encosta). */
export const MUD_FACTOR = 0.45; // lamaçal: anda a 45% da velocidade
export const ESTEIRA_SPEED = 2.0; // esteira: empurra de lado
export const IMA_PULL = 1.6; // ímã: puxa para o centro
export const MOLA_IMPULSE = 7; // mola: joga para trás (0,3 s x 7 m/s = 2,1 m)
export const MOLA_PUSH_S = 0.3;
export const GELO_SLICK = 0.02; // gelo: escorrega quase tanto quanto o óleo
export const TURBINA_SPEED = 2.4; // turbina: empurra para a frente ou para trás
/** Bater em qualquer sólido joga o boneco para trás: quanto maior o obstáculo, mais forte (m/s por 0,25 s). */
export const BUMP_BASE = 3.0;
export const BUMP_PER_R = 3.2;
export const BUMP_TICKS = 15;
/** Atordoado depois de bater: sem controle e, se o Vigia olhar, perde. Mais tempo quanto maior o obstáculo. */
export const STUN_BASE_TICKS = 42;
export const STUN_PER_R_TICKS = 30;
export const STUN_MOVER_TICKS = 72;
export const STUN_SERRA_TICKS = 90;
export const STUN_SHOVE_TICKS = 50;
/** Sala: o botão de empurrar aparece a esta distância (m) de outro jogador e dá este empurrão (m/s). */
export const PUSH_RANGE = 1.9;
export const PUSH_POWER = 7.5;
export const PUSH_COOLDOWN_MS = 2200;
export const MOVER_BUMP = 5.5; // quem se mexe bate mais forte
export const SERRA_BUMP = 9;

/** As brincadeiras. */
export const BEBADO_AMP = 1.9; // balanço de lado (m/s)
export const BEBADO_PERIOD_TICKS = 72;
export const SOLUCO_EVERY = 66; // um soluço a cada 1,1 s
export const SOLUCO_PUSH_TICKS = 9;
export const SOLUCO_SPEED = 3.8;
export const TURBO_FACTOR = 1.6;
export const PATINS_SLICK = 0.03;
export const BOLHAS_SLICK = 0.018; // bolhas de sabão: o chão ensaboado, ainda mais escorregadio que o gelo
/** Os efeitos de visão: já são longos, então crescem menos com a fase (60% do aumento). */
export const VISION_POWERS: readonly PowerKind[] = ['poeira', 'farois', 'cortina', 'apagao'];

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
  /** Bateu num obstáculo: `size` de 0 a 1 é a força da pancada. */
  | { kind: 'choque'; size: number }
  | { kind: 'soluco' }
  /** Sala: você empurrou alguém (o botão de empurrar). */
  | { kind: 'empurrou' }
  | { kind: 'fase'; n: number; map: SinalMapId; mapChanged: boolean }
  | { kind: 'fim'; reason: SinalEnd };

/** Os jeitos de o Vigia olhar: normal, rápido (pouco aviso), longo, espia (olhadinha) e duplo. */
export type CycleKind = 'normal' | 'rapido' | 'longo' | 'espia' | 'duplo';

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
