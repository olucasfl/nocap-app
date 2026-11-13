/**
 * Fox GP (spec 078): todos os números do jogo ficam aqui; o motor não tem número solto. Unidades: metros e segundos.
 * Os valores marcados [AJUSTAR] no documento de regras são chutes iniciais, para calibrar jogando.
 */

/** Passo fixo da simulação (s). */
export const GP_DT = 1 / 60;

export const GP_MIN_PLAYERS = 2;
/** Até 12 carros (spec 081): na sala e no jogo contra bots (você mais 11). */
export const GP_MAX_PLAYERS = 12;

/**
 * Os dois modos de física. Arcade (spec 081, Fase 5) é o kart estilo Mario Kart: direção rápida, drift que enche a barra
 * de turbo e turbo de 3 níveis; sem vácuo, desgaste de pneu, box nem DRS. Realista (specs 080 e 081, Fase 4) é o F1: a
 * velocidade sempre para o nariz, a curva limitada pela aderência, câmbio, freio, DRS, vácuo, pneu e box.
 */
export type GpPhysicsMode = 'arcade' | 'real';
export const GP_PHYSICS_MODES: readonly GpPhysicsMode[] = ['arcade', 'real'];
export const GP_PHYSICS_DEFAULT: GpPhysicsMode = 'arcade';
export const gpIsPhysicsMode = (v: unknown): v is GpPhysicsMode => v === 'arcade' || v === 'real';
/** Versão do protocolo da rede: sobe quando o formato da entrada ou do estado muda (aparelho antigo não entra). */
export const GP_NET_VERSION = 3;
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
export const GP_PIT_HALF = 3.5;
/** A faixa do box: começa a se abrir, fica paralela, e volta para a pista (distâncias do traçado, a linha de chegada é 0). */
export const GP_PIT_IN_START = -95;
export const GP_PIT_IN_END = -65;
export const GP_PIT_OUT_START = 20;
export const GP_PIT_OUT_END = 50;
/** A vaga do box (distância do traçado) e o tamanho dela (m). */
export const GP_PIT_BOX = -18;
export const GP_PIT_BOX_LEN = 9;
/** [AJUSTAR] Velocidade limitada na faixa do box (m/s): 170 km/h na tela (spec 081). */
export const GP_PIT_LIMIT = 20;
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

/**
 * Tamanho do carro (spec 081, Fase 3): ~2× o de antes, o mesmo para o kart e o F1 (grid, box, batidas e bots são
 * comuns). Na pista de 14 m cabem 3 lado a lado com 0,6 m entre eles (3 × 3,6 + 2 × 0,6 = 12 m) e 4 não (14,4 m).
 */
export const GP_CAR_LEN = 6.5;
export const GP_CAR_WID = 3.6;
/** Folga entre carros lado a lado que o teste "3 cabem" usa (m). */
export const GP_CAR_SIDE_GAP = 0.6;
/** Corpo do carro para a barreira do Arcade antigo: dois círculos (frente e trás) do tamanho da caixa. */
export const GP_CAR_R = GP_CAR_WID / 2;
export const GP_CAR_HALF = GP_CAR_LEN / 2 - GP_CAR_R;
/** O carro encosta na barreira com esta parte da meia largura dentro do limite (o resto é a borracha da barreira). */
export const GP_CAR_WALL_IN = 0.9;
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
export const GP_WEAR_SLIP = 0.0008;
export const GP_WEAR_BRAKE = 0.0016;
export const GP_WEAR_OFF = 0.006;
/** [AJUSTAR] Pneu totalmente gasto: aderência mínima (parte da do pneu novo). Freio idem. */
export const GP_GRIP_MIN = 0.4;
export const GP_BRAKE_MIN = 0.55;

// ---- vácuo e DRS (spec 080) ----

/** O vácuo vale até esta distância atrás do outro carro (m) e nesta largura para cada lado (m). */
export const GP_SLIP_LEN = 30;
export const GP_SLIP_W = 3.2;
/** Mais perto que isto (m, de centro a centro) já é encostar, não vácuo. */
export const GP_SLIP_MIN = GP_CAR_LEN * 0.9;
/** Só no vácuo com pelo menos esta velocidade (m/s). */
export const GP_SLIP_MIN_V = 12;
/**
 * [AJUSTAR] Vácuo passivo: colado no outro carro o arrasto cai até 42 % (menos conforme a distância). Subiu de 25 % em
 * 13/11/2026 junto com o arrasto base menor (0,002 → 0,0012), para o ganho em m/s² continuar o mesmo.
 */
export const GP_SLIP_DRAG = 0.42;
/** [AJUSTAR] DRS aberto: arrasto 25 % menor (sem ganho de aderência; era 15 % com o arrasto antigo). Multiplica com o vácuo. */
export const GP_DRS_DRAG = 0.25;
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
export const GP_GRID_FIRST = -14;
/** 8 m entre um lugar e o seguinte (lados alternados, 16 m na mesma fila): os 12 carros cabem em ~102 m antes da linha. */
export const GP_GRID_GAP = 8;
/** Afastamento do centro de cada fila: os carros de 3,6 m ficam com 3 m entre eles e 1,9 m de asfalto para fora. */
export const GP_GRID_SIDE = 3.3;
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

/**
 * Velocidade na tela (spec 081, seção 4): ×7 (52 m/s do Realista ≈ 364 km/h; 34 m/s do kart ≈ 238). Mais rápido desde que os carros dobraram de tamanho (pedido do Italo, 12/11/2026).
 */
export const GP_KMH_PER_MS = 7;
export const gpKmh = (v: number) => Math.round(Math.abs(v) * GP_KMH_PER_MS);
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
/** Corpo rígido do carro (massa 1): momento de inércia em torno do eixo vertical (caixa do carro). */
export const GP_INERTIA = (GP_CAR_LEN * GP_CAR_LEN + GP_CAR_WID * GP_CAR_WID) / 12;
/** Atrito entre carros e com a barreira (impulso tangente máximo, parte do normal). */
export const GP_BUMP_MU = 0.15;
export const GP_WALL_E = 0.2;
export const GP_WALL_MU = 0.45;
/** O giro solto (de uma batida) some com a aderência: por segundo, multiplicado pela aderência. */
export const GP_SPIN_DAMP = 3.2;

// ---- modo Realista (spec 080): o modelo do repositório de referência, recalculado para a escala do Fox GP ----
// A referência anda em escala real (96 m/s, entre-eixos 3,6 m num carro de 5,6 m); aqui a máxima é ~32 m/s e o carro tem
// 3,4 m. Os números abaixo dão a mesma cara de pilotagem nesta escala e uma volta da Marina parecida com a do Arcade.

/**
 * Entre-eixos efetivo da pilotagem (m): com o esterço, dá o raio da curva pedida. É número de pilotagem, não a medida do
 * desenho: o carro ficou 2× maior (spec 081, Fase 3) sem mudar a curva; a Fase 4 recalibra a pilotagem do Realista.
 */
export const GP_REAL_WHEELBASE = 2.4;
/** Esterço máximo das rodas (rad) e quanto ele cai com a velocidade: `ângulo = volante * MAX / (1 + v / FADE)`. */
export const GP_REAL_STEER_MAX = 0.6;
export const GP_REAL_STEER_FADE = 11;
/**
 * Volante proporcional ao pneu (pedido do Italo, 13/11/2026): todo virado pede no máximo `HEADROOM` vezes o que o pneu
 * aguenta naquela velocidade. Um toque leve na reta pede pouca curva e não freia; a curva rápida segura a velocidade.
 */
export const GP_REAL_STEER_HEADROOM = 1.3;
/**
 * Aderência lateral máxima: `GRIP0 + DOWNFORCE * v²` (m/s²). Spec 081, Fase 4: a curva lenta fica limitada pelo pneu e a
 * asa ajuda só em alta. Máxima sem escorregar: grampo de 15 m ~11,9 m/s (≈100 km/h na tela), curva fechada de 25 m
 * ~15,5 m/s, curva média de 60 m ~25 m/s, curva rápida de 120 m ~40 m/s.
 */
export const GP_REAL_GRIP0 = 11;
export const GP_REAL_DOWNFORCE = 0.0028;
/**
 * Pedir mais curva do que o pneu aguenta: o carro abre e perde velocidade, esta força (m/s²) vezes o excesso (até
 * `GP_REAL_SCRUB_MAX` vezes o que o pneu aguenta): quanto mais passa do ponto, mais perde.
 */
export const GP_REAL_SCRUB = 5;
export const GP_REAL_SCRUB_MAX = 2;
/** Folga antes de começar a arrastar: até `SCRUB_FREE` além do limite o carro só abre a trajetória. */
export const GP_REAL_SCRUB_FREE = 0.15;
/**
 * Perda natural na curva (m/s²): `CORNER_DRAG × carga²`, com a carga = aceleração lateral usada / a que o pneu aguenta.
 * Curva leve quase não perde; no limite perde `CORNER_DRAG`.
 */
export const GP_REAL_CORNER_DRAG = 1.6;
/**
 * Motor com câmbio de verdade (spec 081, Fase 4): a força é `ENGINE × torque(giro) / máxima da marcha` (marcha curta
 * empurra mais), limitada a `ACC_MAX` (o pneu). Alvos: 0→15 m/s em ~1,9 s, subindo até a máxima
 * de ~52 m/s no limitador da 8ª. Arrasto (por (m/s)²) e rolagem (m/s²).
 */
export const GP_REAL_ENGINE = 270;
export const GP_REAL_ACC_MAX = 12;
export const GP_REAL_DRAG = 0.0012;
export const GP_REAL_ROLL = 0.3;
/** Velocidade (m/s) em que cada marcha chega ao giro máximo; a 8ª corta no limitador (a máxima do Realista). */
export const GP_REAL_VMAX = 52;
export const GP_REAL_GEAR_TOP = [13.5, 19.3, 25, 30.8, 36.6, 42.4, 47.5, GP_REAL_VMAX] as const;
/** Troca para cima perto do giro máximo e reduz com folga; na troca, a força corta por este tempo (s). */
export const GP_REAL_SHIFT_UP = 0.97;
export const GP_REAL_SHIFT_DOWN = 0.62;
export const GP_REAL_SHIFT_CUT = 0.12;
/**
 * Freio: `BRAKE0 + BRAKE_V2 * v²` (m/s²), um pouco mais em alta (asa). Calibrado pelos alvos da Fase 4 (40→12 m/s em
 * ~80 m e menos de 4,2 s; 25→12 em menos de 35 m): a freada dura o bastante para dar para errar o ponto. (As ordens
 * sugeriam `BRAKE0` 14 a 15, mas com ele a freada de 40 a 12 levaria ~1,5 s e ~38 m, longe do próprio alvo.)
 */
export const GP_REAL_BRAKE0 = 6;
export const GP_REAL_BRAKE_V2 = 0.0015;
/** Ré: força para sair dela acelerando (m/s² por acelerador) e o mínimo, como na referência. */
export const GP_REAL_REVERSE_OUT = 10;
export const GP_REAL_REVERSE_OUT0 = 4;
/** Entradas suavizadas (por segundo): acelerador sobe/desce, freio, volante (subir, inverter, voltar ao centro). */
export const GP_REAL_THR_RISE = 6;
export const GP_REAL_THR_FALL = 8;
export const GP_REAL_BRK_RATE = 10;
export const GP_REAL_STEER_RISE = 4.5;
export const GP_REAL_STEER_FLIP = 10;
export const GP_REAL_STEER_CENTER = 7;
/** Barreira: guarda esta parte da velocidade, alinha esta parte da direção com a pista e espera este tempo (s). */
export const GP_REAL_WALL_KEEP = 0.7;
export const GP_REAL_WALL_ALIGN = 0.25;
export const GP_REAL_WALL_CD = 0.3;


/** Aderência lateral máxima do Realista na velocidade dada (m/s²), com pneu novo no asfalto. */
export const gpRealLatMax = (v: number) => GP_REAL_GRIP0 + GP_REAL_DOWNFORCE * v * v;
/** Máxima no asfalto (m/s) de cada modo. */
export const gpVmaxOf = (mode: GpPhysicsMode) => (mode === 'real' ? GP_REAL_VMAX : GP_ARC_VMAX);
/** Freio do Realista na velocidade dada (m/s²). */
export const gpRealBrake = (v: number) => GP_REAL_BRAKE0 + GP_REAL_BRAKE_V2 * v * v;

// ---- Arcade: o kart (spec 081, Fase 5). Valores iniciais [AJUSTAR], para calibrar jogando ----

/** Máxima normal do kart (m/s): ~238 km/h na tela (×7); calibrada pela volta de 50 a 65 s na Bala Track. */
export const GP_ARC_VMAX = 34;
/** Aceleração sem marchas: `K × (máxima − v)`, chega a 90 % da máxima em ~3,5 s (ln 10 / K). */
export const GP_ARC_ACC_K = 0.75;
/** Freio forte e curto (m/s²), ré e o quanto perde sem acelerar (por segundo, proporcional à velocidade). */
export const GP_ARC_BRAKE = 30;
export const GP_ARC_REVERSE_MAX = 7;
export const GP_ARC_REVERSE_ACCEL = 9;
export const GP_ARC_COAST = 0.35;
/** Acima da máxima da hora (zebra, grama, fim do turbo) perde velocidade até ela com esta força (m/s²). */
export const GP_ARC_OVER_DECEL = 14;
/**
 * Direção muito rápida: giro máximo (rad/s) em baixa e na máxima; abaixo de `YAW_FULL_V` o giro cresce com a velocidade
 * (não gira parado). Curvando, quase não perde velocidade (`TURN_LOSS` por segundo com o volante todo virado).
 */
export const GP_ARC_YAW_LOW = 2.8;
export const GP_ARC_YAW_HIGH = 1.7;
export const GP_ARC_YAW_FULL_V = 4;
export const GP_ARC_TURN_LOSS = 0.005;
/**
 * Escorregão de lado, como no arcade antigo (pedido do Italo, 13/11/2026): o nariz vira na hora e a velocidade vem
 * atrás; o pneu corrige o lado com `LAT_GRIP` m/s² (`LAT_GRIP_DRIFT` no drift, que desliza mais) e o resto some aos
 * poucos (`LAT_DAMP` por segundo). Virada brusca em alta passa do pneu: o kart escorrega, solta fumaça e perde
 * `SLIDE_LOSS` × o escorregão (m/s²). O lado nunca passa de `LAT_MAX` da velocidade.
 */
export const GP_ARC_LAT_GRIP = 34;
export const GP_ARC_LAT_GRIP_DRIFT = 14;
export const GP_ARC_LAT_DAMP = 3;
export const GP_ARC_LAT_MAX = 0.4;
export const GP_ARC_SLIDE_LOSS = 0.15;
/** Máxima em cada superfície (parte da normal): zebra tira um pouco, grama e brita bem mais. */
export const GP_ARC_KERB_VMAX = 0.88;
export const GP_ARC_GRASS_VMAX = 0.55;
export const GP_ARC_GRAVEL_VMAX = 0.4;
/** Muro de metal: batida normal, guarda esta parte da velocidade (espera entre batidas, s). */
export const GP_ARC_WALL_KEEP = 0.65;
export const GP_ARC_WALL_CD = 0.3;
/** Pilha de pneus: a velocidade para a frente vira de volta (esta parte da de chegada). */
export const GP_ARC_TYRE_REBOUND = 0.5;

/**
 * Drift: liberado a partir desta parte da máxima, com o volante virado (|volante| acima de `DRIFT_STEER`), no asfalto ou
 * na zebra, fora da largada. Ao apertar: pulinho e drift para o lado do volante, travado até soltar.
 */
export const GP_ARC_DRIFT_MIN = 0.4;
export const GP_ARC_DRIFT_STEER = 0.1;
/** Depois de apertar o drift, ele ainda entra se ficar liberado neste tempo (s): apertar e virar juntos funciona. */
export const GP_ARC_DRIFT_GRACE = 0.3;
/** Pulinho do drift (s) e altura (m, só desenho). */
export const GP_ARC_HOP_SEC = 0.18;
export const GP_ARC_HOP_H = 0.25;
/**
 * No drift o kart gira pelo raio médio (`DRIFT_BASE` do giro máximo) e o volante muda o raio: para dentro fecha (até
 * ×`DRIFT_IN`), para fora abre (até ×`DRIFT_OUT`).
 */
export const GP_ARC_DRIFT_BASE = 0.8;
export const GP_ARC_DRIFT_IN = 1.6;
export const GP_ARC_DRIFT_OUT = 0.4;
/** Um pouco mais de velocidade enquanto derrapa (decisão 2 do Lucas: pouco). */
export const GP_ARC_DRIFT_SPEED = 1.06;
/** Ângulo extra do corpo do kart no drift (rad, só desenho), com o nariz para dentro da curva: ~11°. */
export const GP_ARC_DRIFT_YAW = 0.2;

/**
 * Barra de turbo de 0 a 3 (três terços: azul, laranja, rosa). Enche sozinha andando (cheia em `BAR_FULL_SEC` na
 * máxima) e `DRIFT_FILL`× mais rápido derrapando, com bônus de até ×`DRIFT_FILL_IN` com o volante todo para dentro.
 */
export const GP_ARC_BAR_MAX = 3;
export const GP_ARC_BAR_FULL_SEC = 45;
export const GP_ARC_DRIFT_FILL = 3.5;
export const GP_ARC_DRIFT_FILL_IN = 1.4;
/**
 * Turbo: gasta a barra toda e o nível é o terço atingido. Duração (s) e quanto a máxima sobe em cada nível; chega à
 * velocidade do turbo em ~`BOOST_RISE` s e volta à normal numa rampa de `BOOST_FADE` s. Fora do asfalto, metade do ganho.
 */
export const GP_ARC_BOOST: readonly { sec: number; extra: number }[] = [
  { sec: 0.9, extra: 0.35 },
  { sec: 1.8, extra: 0.45 },
  { sec: 3, extra: 0.55 },
];
export const GP_ARC_BOOST_RISE = 0.35;
export const GP_ARC_BOOST_FADE = 0.4;
export const GP_ARC_BOOST_OFFROAD = 0.5;

/**
 * Placas de turbo da Bala Track (spec 081, 6B.4): passar por cima dá o turbo de nível 1 na hora, sem gastar a barra
 * (passar de novo só renova a duração). Comprimento e meia largura da placa (m).
 */
export const GP_PAD_LEN = 9;
export const GP_PAD_HALF = 2.6;

/**
 * Avisos de pneu do Realista (spec 081, Fase 10) [AJUSTAR]: desgastado (aviso), no limite (entre no box) e acabando
 * (crítico, repete a cada volta). E a sinalização do box pela distância até a entrada (m): à frente, placa e "entre".
 */
export const GP_TYRE_WARN = 0.55;
export const GP_TYRE_ALERT = 0.75;
export const GP_TYRE_CRIT = 0.9;
export const GP_BOX_SIGN_FAR = 350;
export const GP_BOX_SIGN_MID = 150;
export const GP_BOX_SIGN_NEAR = 60;
