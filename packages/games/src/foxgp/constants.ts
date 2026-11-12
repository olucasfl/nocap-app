/**
 * Fox GP (spec 078): todos os números do jogo ficam aqui; o motor não tem número solto. Unidades: metros e segundos.
 * Os valores marcados [AJUSTAR] no documento de regras são chutes iniciais, para calibrar jogando.
 */

/** Passo fixo da simulação (s). */
export const GP_DT = 1 / 60;

export const GP_MIN_PLAYERS = 2;
/**
 * Cores do pelo na sala (spec 080, decisão 8): as 8 do Fox Cap! mais 2 (raposa-do-ártico e raposa prateada). Com mais de
 * 10 pessoas a cor pode repetir; a barra de cor da classificação usa a carroceria.
 */
export const GP_ROOM_COLORS: readonly { name: string; hex: string }[] = [
  { name: 'Laranja', hex: '#ff6a2b' },
  { name: 'Azul', hex: '#2f5bff' },
  { name: 'Amarelo', hex: '#ffd23f' },
  { name: 'Verde', hex: '#33c27f' },
  { name: 'Rosa', hex: '#ff9ecf' },
  { name: 'Roxo', hex: '#7a3cff' },
  { name: 'Ciano', hex: '#25c7e8' },
  { name: 'Vermelho', hex: '#e5303a' },
  { name: 'Branco', hex: '#f1ede4' },
  { name: 'Prata', hex: '#8b93a3' },
];
/** Até 12 carros (spec 081): na sala e no jogo contra bots (você mais 11). */
export const GP_MAX_PLAYERS = 12;

/**
 * Os dois modos de física (spec 080). Arcade é a física da spec 079 (velocidade em vetor, escorrega de lado); Realista é
 * o modelo do repositório de referência (a velocidade sempre aponta para o nariz e a curva é limitada pela aderência).
 * Só a física muda: pista, carros, regras e tela são os mesmos.
 */
export type GpPhysicsMode = 'arcade' | 'real';
export const GP_PHYSICS_MODES: readonly GpPhysicsMode[] = ['arcade', 'real'];
export const GP_PHYSICS_DEFAULT: GpPhysicsMode = 'arcade';
export const gpIsPhysicsMode = (v: unknown): v is GpPhysicsMode => v === 'arcade' || v === 'real';
/** Versão do protocolo da rede: sobe quando o formato da entrada ou do estado muda (aparelho antigo não entra). */
export const GP_NET_VERSION = 2;
export const GP_LAPS = 3;

// ---- pista ----

/** Meia largura do asfalto (m). */
export const GP_HALF_WIDTH = 7;
/** Largura da zebra, logo depois do asfalto, nas curvas (m). */
export const GP_KERB_W = 1.4;
/** Distância do centro da pista até a barreira de pneus (m). */
export const GP_LIMIT = 18;
/** Curvas com raio menor que este ganham zebra (m). */
export const GP_KERB_RADIUS = 95;
/** Curvas com raio menor que este ganham caixa de brita do lado de fora (m). */
export const GP_GRAVEL_RADIUS = 60;
/** Distância entre amostras da linha central (m). */
export const GP_SAMPLE = 1;

// ---- cenário (spec 081, Fase 13.4): onde arquibancadas, garagens, torres e placas cabem (só desenho) ----

/** Folga mínima (m) entre o cenário e o asfalto, a zebra, a faixa do box ou a barreira de qualquer trecho. */
export const GP_SCENERY_PAD = 0.6;
/** Trecho de arquibancada: comprimento, passo entre trechos e degraus (afastamento da barreira de cada degrau, m). */
export const GP_STAND_LEN = 11.6;
export const GP_STAND_STEP = 12;
export const GP_STAND_ROWS = 3;
export const GP_STAND_ROW0 = 3;
export const GP_STAND_ROW_STEP = 2.2;
export const GP_STAND_ROW_DEPTH = 2.2;
/** O telhado cobre da barreira + `FROM` até a barreira + `TO` (m). */
export const GP_STAND_ROOF_FROM = 1.5;
export const GP_STAND_ROOF_TO = 8.9;
/** Torres de luz: a cada tanto (m) nas retas, a esta distância atrás da barreira. */
export const GP_TOWER_EVERY = 85;
export const GP_TOWER_OFF = 2.5;
/** Garagens do box (atrás da barreira do lado do box): comprimento, fundo e passo (m). */
export const GP_GARAGE_LEN = 8.6;
export const GP_GARAGE_DEPTH = 3.8;
export const GP_GARAGE_STEP = 9;

// ---- box ----

/** O box fica do lado de dentro da reta (lado direito de quem corre). */
export const GP_PIT_SIDE = 1;
/** Centro da faixa do box em relação ao centro da pista (m). */
export const GP_PIT_OFFSET = 13;
export const GP_PIT_HALF = 3;
/** A faixa do box: começa a se abrir, fica paralela, e volta para a pista (distâncias do traçado, a linha de chegada é 0). */
export const GP_PIT_IN_START = -95;
export const GP_PIT_IN_END = -65;
export const GP_PIT_OUT_START = 20;
export const GP_PIT_OUT_END = 50;
/** A vaga do box (distância do traçado) e o tamanho dela (m). */
export const GP_PIT_BOX = -18;
export const GP_PIT_BOX_LEN = 7;
/** [AJUSTAR] Velocidade limitada na faixa do box (m/s). */
export const GP_PIT_LIMIT = 17;
/** [AJUSTAR] Tempo parado na vaga (s). */
export const GP_PIT_STOP_SEC = 3;

// ---- carro ----

/** Velocidade máxima no asfalto (m/s). Na tela vira km/h vezes 10 (32 m/s = 320 km/h). */
export const GP_VMAX = 32;
export const GP_ACCEL = 15;
export const GP_BRAKE = 30;
export const GP_REVERSE_MAX = 7;
export const GP_REVERSE_ACCEL = 9;
/** Desaceleração sem acelerar nem frear (por segundo, proporcional à velocidade). */
export const GP_COAST = 0.35;
/** Acima da máxima da superfície (entrou na grama a 300 km/h), o carro perde velocidade com esta força (m/s²). */
export const GP_OVER_DECEL = 20;
/** Giro do volante (rad/s) até `GP_STEER_FULL_V`; depois cai devagar com a velocidade. */
export const GP_STEER_RATE = 2.7;
export const GP_STEER_FULL_V = 9;
export const GP_STEER_FALL = 26;
/** Aceleração lateral máxima com pneu novo no asfalto (m/s²): o que a curva aguenta sem escorregar. */
export const GP_LAT_ACC = 24;
/** Parte do escorregão que some sozinha por segundo (amortece a derrapagem). */
export const GP_SLIP_DAMP = 1.6;
/** Escorregando de lado o carro perde velocidade para a frente (por m/s de lado, por segundo). */
export const GP_SLIDE_DRAG = 0.12;

/** Cada superfície: aderência e velocidade máxima (parte da máxima do asfalto). */
export const GP_SURFACE = {
  asphalt: { grip: 1, vmax: 1 },
  kerb: { grip: 0.94, vmax: 1 },
  /** [AJUSTAR] grama: 60 % da máxima. */
  grass: { grip: 0.62, vmax: 0.6 },
  /** [AJUSTAR] brita: 40 % da máxima. */
  gravel: { grip: 0.5, vmax: 0.4 },
  pit: { grip: 1, vmax: GP_PIT_LIMIT / GP_VMAX },
} as const;
export type GpSurface = keyof typeof GP_SURFACE;

/** Corpo do carro para colisão: dois círculos (frente e trás). */
export const GP_CAR_R = 0.95;
export const GP_CAR_HALF = 0.8;
/**
 * Batida entre carros (spec 081, Fase 13.3): caixa do carro (OBB) e um impulso de corpo rígido com massas iguais **uma vez
 * por contato**. Nos passos seguintes do mesmo contato os carros só se separam pela posição (sem perder velocidade), e
 * um novo impulso só vem se a aproximação voltar a passar de `GP_BUMP_REARM`. Assim a perda não se acumula a 60 Hz.
 */
/** Quanto do choque volta (0 = gruda, 1 = quica). */
export const GP_BUMP_E = 0.2;
/**
 * Parte do impulso de corpo rígido que vira velocidade (o resto sai como separação de posição): numa batida de traseira
 * com 8 m/s de diferença quem bate perde ~3 m/s e o da frente ganha o mesmo (a quantidade de movimento se conserva).
 */
export const GP_BUMP_SOFT = 0.65;
/** Aproximação (m/s) que, num contato que já existe, dá um impulso novo. */
export const GP_BUMP_REARM = 10;
/** Separação máxima por passo (m): um carro que aparece encostado (rede) não dá um tranco. */
export const GP_BUMP_PUSH = 0.35;
/** Giro solto máximo por batida (rad/s) e quanto dele some por segundo (some em ~0,5 s). */
export const GP_BUMP_SPIN_MAX = 0.6;
export const GP_BUMP_SPIN_DAMP = 6;
/**
 * Realista e kart (velocidade sempre para o nariz): a parte do impulso que é de lado vira um "empurrão" de lado (m/s) que
 * some nesta taxa por segundo, sem fazer o carro escorregar.
 */
export const GP_BUMP_KNOCK_DAMP = 5;
/** Na barreira o carro perde quase toda a velocidade. */
export const GP_WALL_KEEP = 0.25;

// ---- pneus ----

/** [AJUSTAR] Desgaste por metro andado, por escorregão (por m/s de lado, por s), por freada forte (por s) e fora da pista (por s). */
export const GP_WEAR_DIST = 0.00015;
export const GP_WEAR_SLIP = 0.0011;
export const GP_WEAR_BRAKE = 0.0024;
export const GP_WEAR_OFF = 0.006;
/** [AJUSTAR] Pneu totalmente gasto: aderência mínima (parte da do pneu novo). Freio idem. */
export const GP_GRIP_MIN = 0.4;
export const GP_BRAKE_MIN = 0.55;

// ---- vácuo e DRS (spec 080) ----

/** O vácuo vale até esta distância atrás do outro carro (m) e nesta largura para cada lado (m). */
export const GP_SLIP_LEN = 24;
export const GP_SLIP_W = 2.8;
/** Só no vácuo com pelo menos esta velocidade (m/s). */
export const GP_SLIP_MIN_V = 12;
/** [AJUSTAR] Vácuo passivo: colado no outro carro o arrasto cai até 25 % (menos conforme a distância). */
export const GP_SLIP_DRAG = 0.25;
/** [AJUSTAR] DRS aberto: arrasto 15 % menor (sem ganho de aderência). Multiplica com o vácuo. */
export const GP_DRS_DRAG = 0.15;
/**
 * Zonas de DRS, calculadas uma vez por pista: trecho com curvatura abaixo de `GP_DRS_CURV_MAX` (raio acima de 150 m) por
 * pelo menos `GP_DRS_MIN_STRAIGHT`; a zona começa um pouco depois da curva e acaba antes da freada. Calibrado na Marina
 * (~1,5 km): dá a reta norte (~210 m de zona) e a reta seguinte (~100 m).
 */
export const GP_DRS_CURV_MAX = 1 / 150;
export const GP_DRS_MIN_STRAIGHT = 150;
export const GP_DRS_START_OFFSET = 20;
export const GP_DRS_END_OFFSET = 40;
/** Na corrida o DRS só abre depois de completar esta quantidade de voltas (como na F1). */
export const GP_DRS_FROM_LAP = 1;

// ---- corte de caminho ----

/** Se o carro aparece mais perto de um trecho que está esta distância à frente (m), cortou caminho. */
export const GP_CUT_JUMP = 40;
/** Nos trechos marcados como "sem corte" (chicane), sair do asfalto e da zebra por mais que isto volta o carro (m). */
export const GP_CUT_OFF = 3;
/** O último ponto válido é guardado a cada tanto tempo (s), só com o carro no asfalto ou na zebra. */
export const GP_VALID_EVERY = 0.25;

// ---- classificação, largada e chegada ----

/** Tempo máximo da classificação (s): cada um aquece e começa a volta quando quiser (spec 081: 5 min, 1 volta). */
export const GP_QUALI_MAX_SEC = 300;
/**
 * Volta lançada manual (spec 080, Fase 11): ao apertar, o carro vai para a linha de largada (distância do traçado),
 * parado e alinhado, e espera esta contagem (s); o tempo começa quando ela acaba. Não há mais início automático.
 */
export const GP_QUALI_START_S = 0;
export const GP_QUALI_HOLD_SEC = 3;
/** Onde cada um começa a classificação: na vaga do box (saindo para aquecer). */
export const GP_QUALI_FROM_BOX = true;
/** Volta mais curta que isto é impossível (validação leve da sala). */
export const GP_MIN_LAP_SEC = 22;
/** Grid: o primeiro lugar a esta distância antes da linha; cada fila mais para trás; lados alternados. */
export const GP_GRID_FIRST = -12;
/** 6 m entre um lugar e o seguinte (lados alternados): os 12 carros cabem em ~78 m antes da linha. */
export const GP_GRID_GAP = 6;
export const GP_GRID_SIDE = 3;
/** [AJUSTAR] Depois que o primeiro cruza a linha, os outros têm este tempo (s); depois é DNF (spec 081: 2 min). */
export const GP_DNF_SEC = 120;
/** Semáforo: 5 luzes acendendo uma por segundo e a espera antes de apagar (s). */
export const GP_LIGHTS = 5;
export const GP_LIGHT_SEC = 0.9;
/**
 * Espera com as 5 luzes acesas antes de apagar (s): sorteada entre o mínimo e o máximo. Na sala quem sorteia é o servidor
 * (todos largam juntos); contra bots, a seed da partida (`gpLightsHold`).
 */
export const GP_LIGHTS_HOLD_MIN = 0.6;
export const GP_LIGHTS_HOLD_MAX = 1.8;
/** "Vai!" fica na tela este tempo depois que as luzes apagam (s). */
export const GP_GO_SEC = 1;

// ---- sala ----

/** Contagem antes da classificação (ms). */
export const GP_ROOM_QUALI_COUNT_MS = 4000;
/** Grid mostrado antes das luzes (ms). */
export const GP_ROOM_GRID_MS = 4500;
/** Tempo das luzes até a última acender (ms); a espera sorteada vem depois. */
export const GP_ROOM_LIGHTS_MS = Math.round(GP_LIGHTS * GP_LIGHT_SEC * 1000);
/** Espera sorteada com as luzes acesas (s), a partir de um número de 0 a 1 (seed da partida ou sorteio da sala). */
export const gpLightsHold = (u: number) =>
  GP_LIGHTS_HOLD_MIN + (GP_LIGHTS_HOLD_MAX - GP_LIGHTS_HOLD_MIN) * Math.max(0, Math.min(1, u));
/**
 * Corrida mais longa que isto acaba sozinha (s). Com 3 voltas (~3 min) e o DNF de 2 min depois do primeiro (spec 081),
 * a corrida normal fica bem abaixo: o limite só corta a sala travada, nunca antes do DNF.
 */
export const GP_ROOM_MAX_RACE_SEC = 600;
/** Sem relatar posição por tanto tempo conta como desconectado (ms). */
export const GP_ROOM_STALL_MS = 12_000;

/** Velocidade na tela: km/h de mentira, como num jogo de F1 (32 m/s = 320). */
export const gpKmh = (v: number) => Math.round(Math.abs(v) * 10);
/** Marcha de 1 a 8 pela velocidade (só desenho). */
export function gpGear(v: number): number {
  if (v < -0.5) return 0;
  return Math.max(1, Math.min(8, 1 + Math.floor((Math.abs(v) / (GP_VMAX * 1.12)) * 8)));
}

// ---- física (spec 079): motor, câmbio, arrasto e corpo rígido ----

/** Relações do câmbio automático (multiplicam a força do motor); a 8ª é a de reta. */
export const GP_GEARS = [3.2, 2.35, 1.85, 1.5, 1.27, 1.1, 0.98, 0.9] as const;
/** Velocidade (m/s) em que cada marcha chega ao giro máximo: troca para cima perto daqui. */
export const GP_GEAR_TOP = [9, 13, 17, 21, 25, 29, 33, 38] as const;
/** Força do motor por relação (m/s²) no pico da curva de torque. */
export const GP_ENGINE = 5.2;
/** Arrasto aerodinâmico (por (m/s)²) e resistência de rolagem (por m/s e fixa). Com o motor, dão a máxima de ~32 m/s. */
export const GP_DRAG = 0.0028;
export const GP_ROLL = 0.025;
export const GP_ROLL0 = 0.2;
/** Aderência total do pneu novo no asfalto (m/s²): o círculo de atrito divide entre acelerar, frear e virar. */
export const GP_GRIP_TOTAL = 26;
/** O pedal de freio não é tudo ou nada: a força sobe até o pedido nesta taxa (por segundo). */
export const GP_BRAKE_RAMP = 7;
/** Corpo rígido do carro (massa 1): momento de inércia em torno do eixo vertical (comprimento 3,4 m, largura 1,8 m). */
export const GP_INERTIA = (3.4 * 3.4 + 1.8 * 1.8) / 12;
/** Atrito entre carros e com a barreira (impulso tangente máximo, parte do normal). */
export const GP_BUMP_MU = 0.15;
export const GP_WALL_E = 0.2;
export const GP_WALL_MU = 0.45;
/** O giro solto (de uma batida) some com a aderência: por segundo, multiplicado pela aderência. */
export const GP_SPIN_DAMP = 3.2;

// ---- modo Realista (spec 080): o modelo do repositório de referência, recalculado para a escala do Fox GP ----
// A referência anda em escala real (96 m/s, entre-eixos 3,6 m num carro de 5,6 m); aqui a máxima é ~32 m/s e o carro tem
// 3,4 m. Os números abaixo dão a mesma cara de pilotagem nesta escala e uma volta da Marina parecida com a do Arcade.

/** Entre-eixos (m): 3,4 m de carro, a mesma proporção da referência. */
export const GP_REAL_WHEELBASE = 2.4;
/** Esterço máximo das rodas (rad) e quanto ele cai com a velocidade: `ângulo = volante * MAX / (1 + v / FADE)`. */
export const GP_REAL_STEER_MAX = 0.6;
export const GP_REAL_STEER_FADE = 9;
/**
 * Aderência lateral máxima: `GRIP0 + DOWNFORCE * v²` (m/s²). Embaixo vale o pneu (curva lenta exige frear); em alta o
 * ganho da asa deixa fazer curva rápida cheia (~30 m/s² a 32 m/s).
 */
export const GP_REAL_GRIP0 = 18;
export const GP_REAL_DOWNFORCE = 0.012;
/** Pedir mais curva do que o pneu aguenta: o carro abre e perde velocidade até este tanto por segundo (m/s²). */
export const GP_REAL_SCRUB = 7;
/** Motor: aceleração máxima embaixo (m/s²) e potência por massa (m²/s³); arrasto (por (m/s)²) e rolagem (m/s²). */
export const GP_REAL_ACC_MAX = 9;
export const GP_REAL_POWER = 120;
export const GP_REAL_DRAG = 0.0034;
export const GP_REAL_ROLL = 0.25;
/** Freio: `BRAKE0 + BRAKE_V2 * v²` (m/s²): o carro freia mais em alta (asa). */
export const GP_REAL_BRAKE0 = 22;
export const GP_REAL_BRAKE_V2 = 0.008;
/** Ré: força para sair dela acelerando (m/s² por acelerador) e o mínimo, como na referência. */
export const GP_REAL_REVERSE_OUT = 10;
export const GP_REAL_REVERSE_OUT0 = 4;
/** Entradas suavizadas (por segundo): acelerador sobe/desce, freio, volante (subir, inverter, voltar ao centro). */
export const GP_REAL_THR_RISE = 6;
export const GP_REAL_THR_FALL = 8;
export const GP_REAL_BRK_RATE = 10;
export const GP_REAL_STEER_RISE = 2.6;
export const GP_REAL_STEER_FLIP = 7;
export const GP_REAL_STEER_CENTER = 5;
/** Barreira: guarda esta parte da velocidade, alinha esta parte da direção com a pista e espera este tempo (s). */
export const GP_REAL_WALL_KEEP = 0.7;
export const GP_REAL_WALL_ALIGN = 0.25;
export const GP_REAL_WALL_CD = 0.3;
/** Caixa do carro para a batida entre carros (comprimento e largura, m), a mesma nos dois modos. */
export const GP_REAL_CAR_LEN = 3.4;
export const GP_REAL_CAR_WID = 1.8;

/** Aderência lateral máxima do Realista na velocidade dada (m/s²), com pneu novo no asfalto. */
export const gpRealLatMax = (v: number) => GP_REAL_GRIP0 + GP_REAL_DOWNFORCE * v * v;
/** Freio do Realista na velocidade dada (m/s²). */
export const gpRealBrake = (v: number) => GP_REAL_BRAKE0 + GP_REAL_BRAKE_V2 * v * v;
