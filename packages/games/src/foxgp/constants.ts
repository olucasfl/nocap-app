/**
 * Fox GP (spec 078): todos os números do jogo ficam aqui; o motor não tem número solto. Unidades: metros e segundos.
 * Os valores marcados [AJUSTAR] no documento de regras são chutes iniciais, para calibrar jogando.
 */

/** Passo fixo da simulação (s). */
export const GP_DT = 1 / 60;

export const GP_MIN_PLAYERS = 2;
export const GP_MAX_PLAYERS = 8;
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
/** Quanto do choque volta (0 = gruda, 1 = quica). */
export const GP_BUMP_E = 0.25;
/** Na barreira o carro perde quase toda a velocidade. */
export const GP_WALL_KEEP = 0.25;

// ---- pneus ----

/** [AJUSTAR] Desgaste por metro andado, por escorregão (por m/s de lado, por s), por freada forte (por s) e fora da pista (por s). */
export const GP_WEAR_DIST = 0.000215;
export const GP_WEAR_SLIP = 0.0016;
export const GP_WEAR_BRAKE = 0.0035;
export const GP_WEAR_OFF = 0.006;
/** [AJUSTAR] Pneu totalmente gasto: aderência mínima (parte da do pneu novo). Freio idem. */
export const GP_GRIP_MIN = 0.4;
export const GP_BRAKE_MIN = 0.55;

// ---- vácuo e turbo da cauda ----

/** O vácuo vale até esta distância atrás do outro carro (m) e nesta largura para cada lado (m). */
export const GP_SLIP_LEN = 24;
export const GP_SLIP_W = 2.8;
/** Só no vácuo com pelo menos esta velocidade (m/s). */
export const GP_SLIP_MIN_V = 12;
/** [AJUSTAR] Quanto da barra enche por segundo: colado (máximo) e no fim do vácuo (mínimo). */
export const GP_SLIP_FILL_NEAR = 0.42;
export const GP_SLIP_FILL_FAR = 0.12;
/** [AJUSTAR] Turbo: duração (s) e ganho na velocidade máxima. */
export const GP_TURBO_SEC = 2.5;
export const GP_TURBO_GAIN = 0.15;
export const GP_TURBO_ACCEL = 6;
/** Ultrapassagem "com o turbo": durante o turbo ou até este tempo depois (s). */
export const GP_TURBO_PASS_GRACE = 1;

// ---- corte de caminho ----

/** Se o carro aparece mais perto de um trecho que está esta distância à frente (m), cortou caminho. */
export const GP_CUT_JUMP = 40;
/** Nos trechos marcados como "sem corte" (chicane), sair do asfalto e da zebra por mais que isto volta o carro (m). */
export const GP_CUT_OFF = 3;
/** O último ponto válido é guardado a cada tanto tempo (s), só com o carro no asfalto ou na zebra. */
export const GP_VALID_EVERY = 0.25;

// ---- classificação, largada e chegada ----

/** [AJUSTAR] Tempo máximo da classificação (s). */
export const GP_QUALI_MAX_SEC = 60;
/** Onde cada um começa a volta lançada: antes da linha (m de traçado). */
export const GP_QUALI_SPAWN = -70;
/** Volta mais curta que isto é impossível (validação leve da sala). */
export const GP_MIN_LAP_SEC = 22;
/** Grid: o primeiro lugar a esta distância antes da linha; cada fila mais para trás; lados alternados. */
export const GP_GRID_FIRST = -12;
export const GP_GRID_GAP = 7;
export const GP_GRID_SIDE = 3;
/** [AJUSTAR] Depois que o primeiro cruza a linha, os outros têm este tempo (s); depois é DNF. */
export const GP_DNF_SEC = 30;
/** Semáforo: 5 luzes acendendo uma por segundo e a espera antes de apagar (s). */
export const GP_LIGHTS = 5;
export const GP_LIGHT_SEC = 0.9;
export const GP_LIGHTS_HOLD = 0.8;

// ---- sala ----

/** Contagem antes da classificação (ms). */
export const GP_ROOM_QUALI_COUNT_MS = 4000;
/** Grid mostrado antes das luzes (ms). */
export const GP_ROOM_GRID_MS = 4500;
/** Tempo das luzes (ms): acendem e apagam. */
export const GP_ROOM_LIGHTS_MS = Math.round((GP_LIGHTS * GP_LIGHT_SEC + GP_LIGHTS_HOLD) * 1000);
/** Corrida mais longa que isto acaba sozinha (s). */
export const GP_ROOM_MAX_RACE_SEC = 420;
/** Sem relatar posição por tanto tempo conta como desconectado (ms). */
export const GP_ROOM_STALL_MS = 12_000;

/** Velocidade na tela: km/h de mentira, como num jogo de F1 (32 m/s = 320). */
export const gpKmh = (v: number) => Math.round(Math.abs(v) * 10);
/** Marcha de 1 a 8 pela velocidade (só desenho). */
export function gpGear(v: number): number {
  if (v < -0.5) return 0;
  return Math.max(1, Math.min(8, 1 + Math.floor((Math.abs(v) / (GP_VMAX * 1.12)) * 8)));
}
