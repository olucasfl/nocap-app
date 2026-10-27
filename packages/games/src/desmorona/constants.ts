/**
 * Desmorona! (spec 044): arena de hexágonos em 6 camadas. Todos os números do jogo estão aqui; o motor
 * (`world.ts`) não tem número solto. Unidades de mundo: 1 = tamanho de um ladrilho aproximado.
 */

/**
 * Raio (em ladrilhos) de cada camada, de cima para baixo. O formato é de losango (decisão do Lucas, 26/10/2026): a de
 * cima é um pouco menor, as camadas crescem até a do meio, que é a maior, e depois diminuem até a última, a menor. A
 * arena cresce com o número de jogadores (cada um gasta chão andando), em tamanho parecido com o do Fall Guys
 * (hex-a-gone): arena pequena, partida de cerca de 1 minuto com bots.
 */
export function dsmLayerRadii(players: number): readonly number[] {
  const big = 6 + Math.max(2, Math.min(8, Math.round(players)));
  return DSM_LAYER_SCALE.map((f) => Math.max(3, Math.round(big * f)));
}
/** Tamanho de cada camada em relação à maior (a do meio): sobe até a metade e desce até a última, que é a menor. */
/** Seis camadas (uma a menos que antes, 26/10/2026): o mesmo losango, refeito em proporção com uma camada a menos. */
const DSM_LAYER_SCALE = [0.72, 0.88, 1, 0.92, 0.72, 0.5] as const;
export const DSM_LAYERS = 6;
/** Distância do centro de um hexágono até o canto (hexágono "pointy-top"). */
export const DSM_HEX_SIZE = 1.15;
/** Altura entre uma camada e a de baixo. */
export const DSM_LAYER_GAP = 6;
/** Espessura visual de um ladrilho (só desenho; a física usa a superfície). */
export const DSM_TILE_THICK = 0.5;

/** Quanto tempo um ladrilho pisado aguenta (s), por camada: cada uma de baixo é um pouco mais rápida (curto de propósito: o chão some quase na hora, 25/10). */
export const DSM_TILE_LIFE = [0.85, 0.79, 0.74, 0.7, 0.65, 0.6] as const;
/** Nos últimos tantos segundos o ladrilho "racha" (treme e muda de cor): é o aviso. */
export const DSM_CRACK_SEC = 0.35;

/** Movimento da raposa. */
export const DSM_SPEED = 6.2;
export const DSM_ACCEL = 46;
export const DSM_JUMP = 8.2;
/** Pulo duplo: um por voo, no ar, logo depois de sair do chão ou durante a queda. */
export const DSM_AIR_JUMP = 8.4;
/** Tolerância de borda: o corpo ainda se apoia em um ladrilho até esta distância do centro dele ao lado (mundo). */
export const DSM_EDGE_GRACE = 0.3;
/** "Tempo de coiote": logo depois de andar para fora do chão ainda vale o pulo normal (s). */
export const DSM_COYOTE_SEC = 0.12;
export const DSM_GRAVITY = 26;
export const DSM_MAX_FALL = 38;
export const DSM_RADIUS = 0.34;
/** Altura de onde todo mundo cai no começo, acima da primeira camada. */
export const DSM_SPAWN_Y = 13;
/** Só vale pisar depois de pousar; a queda inicial (~1 s) já protege, então isto é só uma folga mínima. */
export const DSM_GRACE_SEC = 0.4;
/** Abaixo da última camada por tanto, a lava pega a raposa e ela é eliminada. */
export const DSM_LAVA_DEPTH = 6;

/**
 * Ondas de queda (27/10/2026): com a partida andando, a onda marca ladrilhos da camada de cima e eles caem depois de um
 * aviso longo (as áreas ficam vermelhas e piscam cada vez mais rápido): dá tempo de sobra para fugir, então ninguém
 * morre de sorte ou azar. Cada onda tem um formato (fatia, metade, anel, chuva ou borda), nunca marca a camada toda
 * e, a cada onda, o aviso encurta um pouco e o intervalo também. Passado `ALL_AFTER` toda onda leva a camada inteira
 * e a partida nunca passa de ~4 minutos.
 */
export const DSM_WAVE_FIRST = 32;
export const DSM_WAVE_EVERY = 24;
export const DSM_WAVE_MIN_EVERY = 12;
export const DSM_WAVE_SHRINK = 0.92;
/** Aviso (s) antes do primeiro ladrilho cair: a 1ª onda avisa mais, e a cada onda o aviso encurta até o mínimo. */
export const DSM_WAVE_WARN = 3.4;
export const DSM_WAVE_WARN_MIN = 2.2;
export const DSM_WAVE_WARN_STEP = 0.25;
/** Os ladrilhos marcados não caem todos juntos: caem em sequência durante este tempo (s), como uma ondulação. */
export const DSM_WAVE_RIPPLE = 0.8;
/** Uma onda comum marca no máximo esta parte dos ladrilhos que sobram na camada: sempre sobra chão. */
export const DSM_WAVE_MAX_SHARE = 0.62;
/** A fatia começa com 90° e cresce a cada onda. */
export const DSM_WAVE_ARC0 = 90;
export const DSM_WAVE_ARC_GROW = 25;
/** Passado este tempo toda onda derruba a camada inteira: a partida nunca passa de ~4 minutos. */
export const DSM_WAVE_ALL_AFTER = 130;

export const DSM_MIN_PLAYERS = 2;
export const DSM_MAX_PLAYERS = 8;
/** Passo fixo da simulação (s). */
export const DSM_DT = 1 / 60;

/** Sala online: contagem da largada, tempo máximo e quanto tempo sem relato conta como desconectado. */
export const DSM_ROOM_COUNTDOWN_MS = 4500;
export const DSM_ROOM_MAX_SEC = 300;
export const DSM_ROOM_STALL_MS = 12_000;

/** Colisão entre raposas (spec 044, fase 3): o corpo ocupa espaço e quem corre contra o outro o empurra. */
export const DSM_BODY_R = 0.42;
/** Só empurra quem chega com pelo menos esta velocidade (m/s) em direção ao outro. */
export const DSM_PUSH_MIN_SPEED = 2.4;
/** Força do empurrão: base + parte da velocidade de quem empurra (m/s). */
export const DSM_PUSH = 6.5;
export const DSM_PUSH_GAIN = 0.55;
export const DSM_PUSH_MAX = 13;
/** Tempo mínimo entre dois empurrões do mesmo par (s). */
export const DSM_PUSH_CD = 0.7;
/** Quão rápido o impulso do empurrão se apaga (por segundo). */
export const DSM_KNOCK_DECAY = 5.5;
/** Quanto de empurrão volta para quem empurrou (recuo). */
export const DSM_RECOIL = 0.25;
