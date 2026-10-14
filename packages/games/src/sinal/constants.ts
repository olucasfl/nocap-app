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
export const COVER_DURABILITY = 5.5;
export const COVER_FRAGILE = 3.2;
/** Moita comprida (5 a 14 m): dá para correr dentro dela com o Vigia olhando, mas ela gasta mais rápido. */
export const COVER_LONG_DURABILITY = 6.5;
export const COVER_LONG_DRAIN = 1.6;
export const COVER_LONG_MIN = 5;
export const COVER_LONG_MAX = 14;
/** Prêmios de se esconder: o atordoamento passa 3x mais rápido, a escuridão anda a 25% e, ao sair, vem o fôlego. */
export const COVER_STUN_FACTOR = 3;
export const COVER_DARK_FACTOR = 0.25;
export const FOLEGO_MIN_HIDDEN_TICKS = 60; // pelo menos 1 s escondido
export const FOLEGO_TICKS = 84; // 1,4 s mais rápido
export const FOLEGO_FACTOR = 1.3;
export const COVER_REGEN = 0.6;

/** A nota guardada é em décimos de metro e cabe num campo de 16 bits. */
export const SINAL_MAX_TENTHS = 32767;
/** Uma corrida mais longa que isto (uma hora) o servidor recusa. */
export const SINAL_MAX_TICKS = 60 * 60 * TPS;
export const SINAL_MAX_INPUTS = 40_000;

// ---- obstáculos ---------------------------------------------------------------

/** Obstáculos que fazem coisas (ficam no chão e agem em quem passa por cima ou encosta). */
export const MUD_FACTOR = 0.45; // lamaçal: anda a 45% da velocidade
export const ESTEIRA_SPEED = 2.0; // esteira: empurra de lado
export const IMA_PULL = 1.6; // ímã: puxa para o centro
export const MOLA_IMPULSE = 7; // mola: joga para trás (0,3 s x 7 m/s = 2,1 m)
export const MOLA_PUSH_S = 0.3;
export const GELO_SLICK = 0.02; // gelo: escorrega muito (~1,4 s para virar)
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

// ---- a cantiga do Vigia (spec 026) --------------------------------------------

/** As sílabas de um verso: "SI-NAL-VER-ME-LHO". */
export const SYLLABLES = 5;
/** O compasso (duração de uma sílaba, em segundos): de fácil a difícil. */
export const BEAT_EASY = 0.62;
export const BEAT_HARD = 0.34;
/** O último LHO (o aviso) dura 2 compassos, nunca menos nem mais que isto (s). */
export const HOLD_MIN = 0.55;
export const HOLD_MAX = 1.3;
/** Pausa entre dois versos (respiro) e depois do olhar (s). */
export const VERSE_BREATH = 0.12;
export const COME_BACK_S = 0.35;
/** A largura do corredor: normal, mínimo (desfiladeiro) e máximo (clareira), em meia largura (m). */
export const HALF_MIN = 3.5;
export const HALF_MAX = 9;
/** O vão mínimo que um obstáculo deixa em qualquer ponto (m): cabe o boneco com folga. */
export const MIN_GAP = 1.7;

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
  /** Uma sílaba da cantiga começou (`syl` de 0 a 4; `hold` é o último LHO esticado, o aviso). */
  | { kind: 'nota'; syl: number; hold: boolean }
  | { kind: 'aviso' }
  | { kind: 'olhando' }
  | { kind: 'voltando' }
  | { kind: 'quebrou'; cover: number }
  /** Bateu num obstáculo: `size` de 0 a 1 é a força da pancada. */
  | { kind: 'choque'; size: number }
  | { kind: 'soluco' }
  /** Sala: você empurrou alguém (o botão de empurrar). */
  | { kind: 'empurrou' }
  /** Sala: cruzou a linha de chegada da fase (`meters` é o comprimento dela). */
  | { kind: 'chegou'; meters: number }
  /** Saiu do esconderijo descansado: um sprint curto. */
  | { kind: 'folego' }
  | { kind: 'fase'; n: number; map: SinalMapId; mapChanged: boolean }
  | { kind: 'fim'; reason: SinalEnd };

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
