/** Ping Fox! (spec 055). Unidades em metros e segundos; x é a largura, y a altura, z o comprimento da mesa. */

/** Comprimento (z) e largura (x) da mesa e altura do tampo. */
export const PP_L = 7.25;
export const PP_W = 4;
export const PP_TOP = 1.0;
/** A rede fica em z = 0 e sobe isto acima do tampo. */
export const PP_NET_H = 0.36;
/** A rede passa um pouco dos lados da mesa (os postes). */
export const PP_NET_OVER = 0.15;
export const PP_R = 0.09;
export const PP_G = 8;

/** Passo fixo: 4 subpassos por tick de 60 Hz (a bola rápida não atravessa nada). */
export const PP_TICK = 1 / 60;
export const PP_SUB = 4;
export const PP_DT = PP_TICK / PP_SUB;

/** Arrasto do ar (a = -k |v| v) e efeito Magnus (a = k (w x v)). */
export const PP_DRAG = 0.07;
export const PP_MAGNUS = 0.0095;
/** Efeito máximo (rad/s). */
export const PP_SPIN_MAX = 170;

/** Quique na mesa: restituição vertical e atrito (areia da mesa). */
export const PP_TABLE_E = 0.88;
export const PP_TABLE_MU = 0.33;
/** Borracha da raquete. */
export const PP_PAD_E = 0.62;
export const PP_PAD_MU = 0.9;
/** Rede: o que sobra de velocidade depois de bater. */
export const PP_NET_KEEP = 0.25;

/** Raquete: raio do disco, distância do plano atrás da ponta, alcance do ponteiro. */
export const PP_PAD_R = 0.5;
export const PP_PAD_Z = PP_L / 2 + 0.2;
export const PP_PAD_X = 3.1;
export const PP_PAD_Y_MIN = 0.55;
export const PP_PAD_Y_MAX = 3.0;
/** Quanto uma bola pode ter passado do plano da raquete (m) e ainda ser alcançada. */
export const PP_CATCH = 3;
/** Velocidade máxima e rigidez com que a raquete persegue o ponteiro (uma mão que acompanha, sem teletransportar). */
export const PP_PAD_SPEED = 13;
export const PP_PAD_STIFF = 36;

/**
 * A raquete é uma peça física: além de x e y ela tem um alcance para a frente (`reach`, em direção à rede) que cresce
 * com a rapidez com que a mão se mexe, então "jogar a raquete" é mexer o mouse (ou o dedo) rápido. A velocidade da
 * raquete (x, y e para a frente) entra inteira na batida.
 */
export const PP_REACH_MAX = 0.2;
/** Rapidez (m/s) abaixo da qual a raquete fica parada em z, e quanto de alcance cada m/s a mais dá. */
export const PP_REACH_DEAD = 0.8;
/** Velocidade para a frente por m/s de mão (acima da zona morta) e quanto de alcance cada m/s para a frente dá. */
export const PP_Z_GAIN = 1;
export const PP_REACH_PER_VZ = 0.1;
/** Com que rapidez o alcance sobe (rápido: a raquete "dispara") e desce (mais devagar: a raquete recolhe). */
export const PP_REACH_RISE = 20;
export const PP_REACH_FALL = 8;
/** Velocidade máxima para a frente (m/s). */
export const PP_VZ_MAX = 7.5;
/** Quem vai sacar já estende a raquete um pouco, para a bola estar ao alcance de um golpe curto. */
/** Alcance de espera de quem vai rebater: a raquete já fica um pouco à frente do plano de espera. */
export const PP_REACH_WAIT = 0.15;
export const PP_REACH_SERVE = 0.1;

/**
 * Inclinação da face. A abertura vem do movimento vertical da mão: subir abre a face (a bola sobe, lob), descer a
 * fecha (a bola desce, e pode ir na rede). O movimento lateral vira a face para o lado. O ponto de contato desvia um
 * pouco (a borracha é levemente curva).
 */
export const PP_TILT_BASE = 0.26;
export const PP_TILT_VY = 0.05;
export const PP_TILT_VX = 0.012;
/** Quanto a face se fecha com a força para a frente (quem bate forte bate mais reto): mantém a bola na mesa. */
export const PP_TILT_VZ = 0.04;
export const PP_TILT_OFF = 0.05;
/** O quanto da velocidade da mão passa para a bola (a raquete é leve e a bola escapa): menos sensível, mais perdoa. */
export const PP_PAD_COUPLE = 0.7;
/** Velocidade máxima da bola depois da batida (impossível de devolver acima disto). */
export const PP_V_MAX = 22;
/** A bola que sai mais rápido que isto, descendo, conta como smash (só para o efeito e o som). */
export const PP_SMASH_SPEED = 10.5;

/** Saque: impulso do lançamento (a bola sobe pouco e desce), altura da mão e quanto a bola fica à frente da raquete. */
export const PP_TOSS_V = 3.2;
/** O saque escolhe a altura do lançamento (0 a 1, pela barra): velocidade de subida da bola. */
export const PP_TOSS_V_MIN = 3.0;
export const PP_TOSS_V_MAX = 6.6;
export const ppTossSpeed = (v: number): number =>
  PP_TOSS_V_MIN + (PP_TOSS_V_MAX - PP_TOSS_V_MIN) * Math.max(0, Math.min(1, v));
/** Alcance extra (m) para a bola curta, que morre antes do plano normal da raquete. */
export const PP_REACH_DEEP = 0.65;
/** Quanto o movimento lateral da mão desvia a bola (pontaria). */
export const PP_AIM = 0.42;
export const PP_TOSS_Y = 1.25;
export const PP_SERVE_FRONT = 0.8;
/** A bola do saque fica parada na frente da raquete (altura) e o saque começa depois deste tempo (s). */
export const PP_SERVE_Y = 1.5;
export const PP_SERVE_WAIT = 0.9;
/** A altura padrão do lançamento do saque (0 a 1, em `ppTossSpeed`): a bola sobe uns 1 m e cai na raquete. */
export const PP_TOSS_DEFAULT = 0.5;
/** Alcance até a rede: a raquete passeia por cima da mesa (reach 0 = plano de espera; NET = quase na rede). */
export const PP_REACH_NET = PP_PAD_Z - 0.4;
/** E para trás: a raquete pode ficar atrás do plano de espera (m). */
export const PP_REACH_BACK = 1.7;
/** Batida com a mão acima disto (0 a 1) é de força: sem ajuda, e pode sair da mesa ou ir na rede. */
export const PP_ASSIST_MAX_POWER = 0.62;
/** Abaixo disto a ajuda também fecha o ângulo para os lados; entre os dois só corrige a altura. */
export const PP_ASSIST_LATERAL_POWER = 0.45;
/** A raquete (jogo de verdade) segue a mão: rapidez máxima (m/s) e rigidez (1/s; com o passo de 1/60 s, 55 é quase colar). */
export const PP_FOLLOW_SPEED = 45;
export const PP_FOLLOW_STIFF = 55;
/** Altura de espera da raquete (a altura acompanha a bola que vem). */
export const PP_REST_Y = 1.45;
/** A mão passa no máximo isto para a frente na batida (m/s). */
export const PP_HAND_VZ_MAX = 11;

/** Placar. */
export const PP_POINTS = 11;
/** Pausa depois do ponto e rally máximo antes de anular (s). */
export const PP_POINT_PAUSE = 1.5;
export const PP_RALLY_MAX = 30;
/** Saque automático se quem saca não faz nada (s). */
export const PP_SERVE_AUTO = 9;

/** Sala (fase 3): quantas pessoas cabem (2 jogam, as outras assistem), contagem do começo e tempo para voltar da queda. */
export const PP_ROOM_MAX = 8;
export const PP_ROOM_COUNTDOWN_MS = 4000;
export const PP_ROOM_AWAY_MS = 25_000;
/** Depois do último ponto a sala espera isto antes de mostrar o pódio. */
export const PP_ROOM_OVER_MS = 2500;

/** Bola mal pegada (pegou na borda da raquete uma bola forte): sobe, o jogo vai em câmera lenta e quem recebe pode dar smash. */
export const PP_SLOW = 0.4;
/** Velocidade mínima (m/s) da bola que chega para uma pegada na borda virar "subida". */
export const PP_POPUP_VIN = 7.5;
/** A barra de tempo do smash vai e volta neste tempo (ticks de 1/60 s). */
export const PP_SMASH_PERIOD = 50;
/** Velocidade (m/s) do smash por nível de acerto: 1 = vermelho (fraco), 2 = verde (forte), 3 = verde perfeito. */
export const PP_SMASH_V = [0, 12, 17, 24] as const;

/**
 * O ritmo do jogo: o mundo anda a esta fração do tempo real (bola mais lenta, mais tempo para ler a jogada), como nos
 * níveis fáceis do Online Pingpang. A trajetória é a mesma, só passa mais devagar.
 */
export const PP_WORLD_SPEED = 1.2;
