/**
 * Bola Maluca! (spec 046): futebol de raposas para 2, 3 ou 4 times. Todos os números do jogo estão aqui; o motor
 * (`world.ts`) não tem número solto. Unidades de mundo: metros. Eixos: x e z no chão, y para cima.
 */

export const BOL_DT = 1 / 60;
/** A bola e as raposas andam em passos menores que o quadro: nada atravessa nada, nem a 30 m/s. */
export const BOL_SUBSTEPS = 4;

/** Quem joga (3x3x3x3) e quantos cabem na sala, contando espectadores. */
export const BOL_MAX_PLAYERS = 12;
export const BOL_ROOM_MAX = 15;
export const BOL_MAX_TEAMS = 4;

/** Vermelho, azul, amarelo e verde. O verde só existe com 4 times. */
export const BOL_TEAM_NAMES = ['Vermelho', 'Azul', 'Amarelo', 'Verde'] as const;
export const BOL_TEAM_COLORS = [0xe5484d, 0x3e7bfa, 0xf5c518, 0x30a46c] as const;

/** Bola. */
export const BOL_BALL_R = 0.9;
export const BOL_GRAVITY = 14;
export const BOL_FLOOR_E = 0.55;
/** Atrito do quique: a bola perde um pouco de velocidade lateral cada vez que bate no chão forte. */
export const BOL_BOUNCE_GRIP = 0.97;
export const BOL_WALL_E = 0.6;
/** Freio da bola rolando: proporcional à velocidade (rápida freia mais) mais um freio fixo (m/s²), para ela parar de verdade. */
export const BOL_ROLL_DRAG = 0.7;
export const BOL_ROLL_DECEL = 1.2;
export const BOL_AIR_DRAG = 0.03;
export const BOL_BALL_MAX = 32;
export const BOL_CEILING = 14;
/** Parada de verdade: abaixo disto, no chão, a bola conta como "parada". */
export const BOL_REST_SPEED = 0.5;

/** Raposa (cápsula vertical). */
export const BOL_FOX_R = 0.5;
export const BOL_FOX_H = 1.3;
export const BOL_SPEED = 8;
export const BOL_ACCEL = 40;
export const BOL_AIR_ACCEL = 9;
export const BOL_JUMP = 8.6;
export const BOL_AIR_JUMP = 8.2;
export const BOL_FOX_GRAVITY = 24;

/** Mortal (pulo duplo com direção): impulso da raposa, janela em que o chute vale e alcance extra. */
export const BOL_FLIP_SEC = 0.5;
export const BOL_FLIP_WINDOW = 0.4;
export const BOL_FLIP_SPEED = 11;
export const BOL_FLIP_LIFT = 4.2;
export const BOL_FLIP_REACH = 0.35;
/** Velocidade mínima da bola, na direção do mortal, logo após o chute (m/s), mais esta fração da velocidade da raposa. */
export const BOL_FLIP_KICK = 14;
export const BOL_FLIP_KICK_CARRY = 0.6;
export const BOL_FLIP_KICK_LIFT = 3.5;

/** Contato: o quanto o corpo devolve a bola e a velocidade mínima de encontro para valer como toque. */
export const BOL_FOX_E = 0.2;
export const BOL_TOUCH_MIN = 0.4;

/** Gol. */
export const BOL_GOAL_H = 3.4;
export const BOL_POST_R = 0.15;
/** Raio do travessão. */
export const BOL_BAR_R = 0.22;

/** Partida. */
export const BOL_COUNTDOWN = 3;
/** Pausa depois do gol, para comemorar (s); depois vem a contagem de 3 s. */
export const BOL_GOAL_PAUSE = 5;
export const BOL_DURATION = 30 * 60;
/** Quanto falta para cada aviso de fim (s). */
export const BOL_WARN_LEFT = [300, 60] as const;
export const BOL_GOLDEN_MAX = 5 * 60;
/** Bola parada por tanto tempo volta para o centro (s). */
export const BOL_STILL_SEC = 30;
