/**
 * Fut Fox (spec 046): futebol de raposas para 2, 3 ou 4 times. Todos os números do jogo estão aqui; o motor
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
export const BOL_FLOOR_E = 0.6;
/** Atrito do quique: a bola perde um pouco de velocidade lateral cada vez que bate no chão forte. */
export const BOL_BOUNCE_GRIP = 0.97;
export const BOL_WALL_E = 0.6;
/** Quique da bola na rampa entre o chão e a parede (só batidas fortes quicam; as leves deslizam). */
export const BOL_RAMP_E = 0.5;
/** Freio da bola rolando: proporcional à velocidade (rápida freia mais) mais um freio fixo (m/s²), para ela parar de verdade. */
export const BOL_ROLL_DRAG = 0.7;
export const BOL_ROLL_DECEL = 1.2;
export const BOL_AIR_DRAG = 0.03;
/** Atrito da bola na parede (Coulomb): a batida de lado perde parte da velocidade que corre ao longo dela. */
export const BOL_WALL_MU = 0.3;
/** Rolando pela rampa: freio proporcional e fixo (m/s²), um pouco menor que o do chão, para a bola ainda subir e curvar. */
export const BOL_RAMP_DRAG = 0.5;
export const BOL_RAMP_DECEL = 0.8;
export const BOL_BALL_MAX = 20;
/** Teto (m): a bola quica nele e as raposas podem andar nele (por baixo) por um tempo. */
export const BOL_CEILING = 9;
/** Parada de verdade: abaixo disto, no chão, a bola conta como "parada". */
export const BOL_REST_SPEED = 0.5;

/** Raposa (cápsula vertical). */
export const BOL_FOX_R = 0.5;
export const BOL_FOX_H = 1.3;
export const BOL_SPEED = 8;
export const BOL_ACCEL = 40;
export const BOL_AIR_ACCEL = 9;
export const BOL_JUMP = 7;
export const BOL_AIR_JUMP = 6.6;
/**
 * Corrida (spec 053): Shift/botão. Acima do mortal (10): o pulo duplo com direção é mais lento que correr, e vale pelo chute. Acelera mais devagar que
 * andar (a raposa leva mais tempo para virar e parar correndo).
 */
export const BOL_RUN_SPEED = 12.2;
export const BOL_RUN_ACCEL = 18;
/** Fôlego de 0 a 100: gasta correndo, fica parado `HOLD` s depois de correr e só então recarrega (devagar). */
export const BOL_STAM_MAX = 100;
export const BOL_STAM_DRAIN = 100 / 2.8;
export const BOL_STAM_HOLD = 2;
export const BOL_STAM_REGEN = 16;
/** Esgotou: só volta a correr com este tanto (senão a pessoa picotaria a corrida com 1 de fôlego) e demora a recarregar. */
export const BOL_STAM_MIN = 20;
export const BOL_STAM_TIRED_HOLD = 2.5;
export const BOL_FOX_GRAVITY = 24;

/**
 * Andar na parede e no teto (spec 052): correndo para a parede pela rampa a raposa "gruda" e sobe; no teto anda de cabeça
 * para baixo. O grude acaba em `BOL_STICK_MAX` s (gasta na parede e no teto, recarrega no chão) e ela cai. Pular solta.
 */
export const BOL_STICK_MAX = 3.2;
export const BOL_STICK_REGEN = 1.2;
/** Grude mínimo para poder colar na parede (evita colar e cair logo em seguida). */
export const BOL_STICK_MIN = 0.6;
/** Velocidade (m/s) contra a parede para colar: encostar devagar não gruda. */
export const BOL_STICK_ENTRY_SPEED = 3.5;
export const BOL_WALL_SPEED = 6.5;
export const BOL_WALL_ACCEL = 32;
export const BOL_CEIL_SPEED = 6;
/** Pulo da parede: empurrão para longe dela (m/s). */
export const BOL_WALL_JUMP = 8;

/** Mortal (pulo duplo com direção): impulso da raposa, janela em que o chute vale e alcance extra. */
export const BOL_FLIP_SEC = 0.5;
export const BOL_FLIP_WINDOW = 0.4;
export const BOL_FLIP_SPEED = 10;
export const BOL_FLIP_LIFT = 5.4;
export const BOL_FLIP_REACH = 0.35;
/** Velocidade mínima da bola, na direção do mortal, logo após o chute (m/s), mais esta fração da velocidade da raposa. */
export const BOL_FLIP_KICK = 14;
export const BOL_FLIP_KICK_CARRY = 0.6;
export const BOL_FLIP_KICK_LIFT = 3.5;

/** Contato: o quanto o corpo devolve a bola e a velocidade mínima de encontro para valer como toque. */
export const BOL_FOX_E = 0.2;
/** Abaixo desta velocidade de encontro (m/s) o contato é seco (sem quique nem chute extra): a bola repousa sem tremer. */
export const BOL_FOX_REST_SPEED = 1.5;
/** Atrito do contato raposa-bola (Coulomb): em cima da cabeça a bola acompanha a raposa em vez de deslizar. */
export const BOL_FOX_MU = 0.9;
/** Em cima da cabeça a normal é achatada por este fator (1 = esfera, 0 = chapa plana): dá para equilibrar a bola. */
export const BOL_HEAD_FLAT = 0.3;
/** Chute extra: velocidade de encontro x este fator é somada à bola (como o impulso extra do carro no rl-like); a subida pesa menos. */
export const BOL_HIT_BOOST = 0.4;
export const BOL_HIT_LIFT = 0.35;
export const BOL_TOUCH_MIN = 0.4;

/** Gol. */
export const BOL_GOAL_H = 4;
/** Quanto o gol se estende para trás da linha: a raposa pode entrar até aqui (e a rede é desenhada com esta fundura). */
export const BOL_GOAL_DEPTH = 3.8;
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
