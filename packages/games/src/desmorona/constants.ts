/**
 * Desmorona! (spec 044): arena de hexágonos em 7 camadas. Todos os números do jogo estão aqui; o motor
 * (`world.ts`) não tem número solto. Unidades de mundo: 1 = tamanho de um ladrilho aproximado.
 */

/**
 * Raio (em ladrilhos) de cada camada, de cima para baixo: a de cima é a maior. A arena cresce com o número de
 * jogadores (cada um gasta chão andando), para a partida durar de 3 a 4 minutos com 2 ou com 8.
 */
export function dsmLayerRadii(players: number): readonly number[] {
  const top = 11 + Math.max(2, Math.min(8, Math.round(players)));
  const out: number[] = [];
  DSM_LAYER_SCALE.forEach((f, i) => {
    const r = Math.max(5, Math.round(top * f));
    out.push(i === 0 ? r : Math.min(r, (out[i - 1] as number) - 0));
  });
  return out;
}
/** Tamanho de cada camada em relação à de cima: as de baixo continuam grandes o bastante para jogar. */
const DSM_LAYER_SCALE = [1, 0.88, 0.76, 0.65, 0.55, 0.46, 0.38] as const;
export const DSM_LAYERS = 7;
/** Distância do centro de um hexágono até o canto (hexágono "pointy-top"). */
export const DSM_HEX_SIZE = 1.15;
/** Altura entre uma camada e a de baixo. */
export const DSM_LAYER_GAP = 6;
/** Espessura visual de um ladrilho (só desenho; a física usa a superfície). */
export const DSM_TILE_THICK = 0.5;

/** Quanto tempo um ladrilho pisado aguenta (s), por camada: cada uma de baixo é um pouco mais rápida. */
export const DSM_TILE_LIFE = [1.8, 1.7, 1.5, 1.4, 1.2, 1.1, 1] as const;
/** Nos últimos tantos segundos o ladrilho "racha" (treme e muda de cor): é o aviso. */
export const DSM_CRACK_SEC = 0.45;

/** Movimento da raposa. */
export const DSM_SPEED = 6.2;
export const DSM_ACCEL = 46;
export const DSM_JUMP = 8.2;
export const DSM_GRAVITY = 26;
export const DSM_MAX_FALL = 38;
export const DSM_RADIUS = 0.34;
/** Altura de onde todo mundo cai no começo, acima da primeira camada. */
export const DSM_SPAWN_Y = 13;
/** Só vale pisar depois de pousar; a queda inicial (~1 s) já protege, então isto é só uma folga mínima. */
export const DSM_GRACE_SEC = 0.4;
/** Abaixo da última camada por tanto, a lava pega a raposa e ela é eliminada. */
export const DSM_LAVA_DEPTH = 6;

/** Ondas: derrubam uma fatia da camada de cima, avisadas com tremida. Garantem o fim em 3 a 4 minutos. */
export const DSM_WAVE_FIRST = 55;
export const DSM_WAVE_EVERY = 36;
export const DSM_WAVE_MIN_EVERY = 16;
export const DSM_WAVE_SHRINK = 0.9;
/** A fatia começa com 70° e cresce a cada onda. */
export const DSM_WAVE_ARC0 = 70;
export const DSM_WAVE_ARC_GROW = 40;
export const DSM_WAVE_LIFE = 1.1;
/** Passado este tempo toda onda derruba a camada inteira: a partida nunca passa de ~4 minutos. */
export const DSM_WAVE_ALL_AFTER = 150;

export const DSM_MIN_PLAYERS = 2;
export const DSM_MAX_PLAYERS = 8;
/** Passo fixo da simulação (s). */
export const DSM_DT = 1 / 60;
