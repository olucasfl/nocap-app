/** Ping Fox! (spec 055). Unidades em metros e segundos; x é a largura, y a altura, z o comprimento da mesa. */

/** Comprimento (z) e largura (x) da mesa e altura do tampo. */
export const PP_L = 4.2;
export const PP_W = 2.3;
export const PP_TOP = 1.0;
/** A rede fica em z = 0 e sobe isto acima do tampo. */
export const PP_NET_H = 0.3;
/** A rede passa um pouco dos lados da mesa (os postes). */
export const PP_NET_OVER = 0.15;
export const PP_R = 0.075;
export const PP_G = 9.0;

/** Passo fixo: 4 subpassos por tick de 60 Hz (a bola rápida não atravessa nada). */
export const PP_TICK = 1 / 60;
export const PP_SUB = 4;
export const PP_DT = PP_TICK / PP_SUB;

/** Arrasto do ar (a = -k |v| v) e efeito Magnus (a = k (w x v)). */
export const PP_DRAG = 0.018;
export const PP_MAGNUS = 0.005;
/** Efeito máximo (rad/s). */
export const PP_SPIN_MAX = 140;

/** Quique na mesa: restituição vertical e atrito (areia da mesa). */
export const PP_TABLE_E = 0.88;
export const PP_TABLE_MU = 0.33;
/** Borracha da raquete. */
export const PP_PAD_E = 0.62;
export const PP_PAD_MU = 0.9;
/** Rede: o que sobra de velocidade depois de bater. */
export const PP_NET_KEEP = 0.25;

/** Raquete: raio do disco, distância do plano atrás da ponta, alcance do ponteiro. */
export const PP_PAD_R = 0.32;
export const PP_PAD_Z = PP_L / 2 + 0.35;
export const PP_PAD_X = 1.9;
export const PP_PAD_Y_MIN = 0.55;
export const PP_PAD_Y_MAX = 2.3;
/** Velocidade máxima e rigidez com que a raquete persegue o ponteiro. */
export const PP_PAD_SPEED = 11;
export const PP_PAD_STIFF = 30;

/** Empurrão para a frente na batida normal e no smash (m/s). */
export const PP_PUSH = 2.2;
export const PP_PUSH_SMASH = 8;
/** O saque: empurrão maior, face mais aberta e ajuda de mira mais larga (a bola sai de trás da linha). */
export const PP_PUSH_SERVE = 4.6;
export const PP_TILT_SERVE = 0.3;
export const PP_ASSIST_SERVE = 1.9;
/** Inclinação da face: desvio pelo ponto de contato, abertura fixa e efeito do movimento vertical. */
export const PP_TILT_X = 0.3;
export const PP_TILT_Y = 0.15;
export const PP_TILT_UP = 0.08;
/** Levantada da raquete (m/s) que acompanha toda batida que não é smash: a bola que desce sai com um arco. */
export const PP_LIFT = 0.8;
export const PP_TILT_SMASH = -0.24;
/** Velocidade máxima da bola depois da batida. */
export const PP_V_MAX = 19;

/** Ajuda de mira: o quanto ela alcança (graus) com a ajuda cheia, e a força padrão. */
export const PP_ASSIST_PITCH = 20;
export const PP_ASSIST_YAW = 10;
export const PP_ASSIST = 1;
export const PP_ASSIST_SMASH = 0.5;

/** Saque: impulso para cima do lançamento e altura da mão. */
export const PP_TOSS_V = 4.3;
export const PP_TOSS_Y = 1.25;

/** Placar. */
export const PP_POINTS = 11;
/** Pausa depois do ponto e rally máximo antes de anular (s). */
export const PP_POINT_PAUSE = 1.5;
export const PP_RALLY_MAX = 14;
/** Saque automático se quem saca não faz nada (s). */
export const PP_SERVE_AUTO = 6;
