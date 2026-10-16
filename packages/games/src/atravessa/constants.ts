/**
 * Atravessa! (specs 028 e 029). Tudo em grade: cada faixa é uma linha (`row`) de 9 casas (colunas -4 a 4);
 * o herói pula uma casa por passo. Nomes com prefixo ATR_ porque o pacote exporta tudo junto.
 */

export const ATR_TPS = 60;
export const ATR_DT = 1 / ATR_TPS;

/** Colunas -4 a 4 (9 casas). Com 13 casas tudo ficava pequeno demais no celular. */
export const ATR_HALF_COLS = 4;
export const ATR_COLS = ATR_HALF_COLS * 2 + 1;

/** Um pulo dura ~0,17 s (spec 029: o ritmo subiu a pedido do Lucas). */
export const ATR_STEP_TICKS = 10;
/** Passos esperando na fila (além do que está em andamento). */
export const ATR_QUEUE_MAX = 2;
/** Meia largura do herói para colisão (em casas). */
export const ATR_HERO_R = 0.3;
/** Até onde a tora pode levar o herói de lado antes de ele sair do mapa. */
export const ATR_RIVER_EDGE = ATR_HALF_COLS + 0.5;
/** Folga na borda da tora ao pousar. */
export const ATR_LOG_SLACK = 0.25;
/** A pedra que afunda (com o herói em cima) leva 2 s. */
export const ATR_SINK_TICKS = 120;

/** Linhas de descanso atrás da largada onde se pode recuar; além delas há só mata fechada. */
export const ATR_BACK_ROWS = 4;

export type AtravessaBiome ='horta' | 'deserto' | 'neon';
export const ATR_BIOMES: readonly AtravessaBiome[] = ['horta', 'deserto', 'neon'];
/** A largada de toda partida é em grama por este tanto de linhas; depois a grama se mistura ao bioma sorteado. */
export const ATR_START_GRASS = 16;

export type LaneKind = 'descanso' | 'estrada' | 'trilho' | 'rio';

/** Veículos (spec 029): o tipo depende da velocidade que ele sorteou. */
export type VehicleKind =
  | 'carro'
  | 'esportivo'
  | 'taxi'
  | 'perua'
  | 'picape'
  | 'trator'
  | 'caminhao'
  | 'betoneira'
  | 'onibus'
  | 'moto'
  | 'scooter'
  | 'drone'
  | 'ambulancia';
/** O que boia ou carrega o herói no rio. */
export type PlatformKind = 'tora' | 'croc' | 'tartaruga';
export type FlowKind = VehicleKind | PlatformKind;

/** Comprimento de cada coisa que anda na faixa, em casas. */
export const ATR_FLOW_LEN: Record<VehicleKind, number> = {
  carro: 1.4,
  esportivo: 1.5,
  taxi: 1.4,
  perua: 1.7,
  picape: 1.7,
  trator: 1.8,
  caminhao: 2.8,
  betoneira: 2.6,
  onibus: 3.2,
  moto: 0.9,
  scooter: 0.8,
  drone: 1.1,
  ambulancia: 1.9,
};

/** Distância mínima (borda a borda) entre dois veículos da mesma faixa: sempre dá para passar. */
export const ATR_MIN_VEHICLE_GAP = 2.0;
export const ATR_MIN_LOG_GAP = 1.4;

/** Tudo que anda numa faixa entra pela borda a esta distância do centro (fora de qualquer tela). */
export const ATR_FLOW_HALF = 14;

export const ATR_TRAIN_LEN = 12;
/** O aviso do trem e a velocidade dele variam com a dificuldade (spec 029). */
export const ATR_TRAIN_WARN_EASY = 72; // 1,2 s
export const ATR_TRAIN_WARN_HARD = 52; // 0,87 s
export const ATR_TRAIN_SPEED_EASY = 28; // casas por segundo
export const ATR_TRAIN_SPEED_HARD = 44;

/** Crocodilo: ciclo de 3 s; aviso de 0,5 s e boca aberta por 0,67 s; a cabeça é a ponta da frente. */
export const ATR_CROC_PERIOD = 180;
export const ATR_CROC_WARN = 30;
export const ATR_CROC_OPEN = 40;
export const ATR_CROC_LEN = 3.4;
export const ATR_CROC_HEAD = 1.2;
/** Tartaruga: ciclo de 5 s: na superfície, aviso de 0,67 s e 1 s submersa. */
export const ATR_TURTLE_PERIOD = 300;
export const ATR_TURTLE_UP = 190;
export const ATR_TURTLE_WARN = 40;
export const ATR_TURTLE_DOWN = 60;

/**
 * Os biomas (spec 029): a cada 150 linhas há uma transição para o bioma seguinte (as últimas 6 linhas
 * misturam os dois). A ordem é sorteada pela seed: o primeiro é sempre sorteado; de três em três os
 * biomas formam uma sequência dos três (sem repetir, o terceiro é o que sobrou); o primeiro de cada
 * grupo novo é sorteado de novo, só que nunca igual ao último do grupo anterior.
 */
export const ATR_SEGMENT_LEN = 150;
export const ATR_TRANSITION_LEN = 6;
export const ATR_BIOME_LEN = ATR_SEGMENT_LEN - ATR_TRANSITION_LEN;
/** Três biomas = um grupo; a dificuldade sobe a cada grupo concluído. */
export const ATR_CYCLE_LEN = ATR_SEGMENT_LEN * 3;

/** Pressão por trás: a escuridão (spec 028). Velocidades em linhas por segundo. */
export const ATR_REF_PACE = 2.9; // ritmo de quem não para de avançar
export const ATR_DARK_CAP_FRACTION = 0.85;
export const ATR_DARK_CAP = ATR_REF_PACE * ATR_DARK_CAP_FRACTION;
export const ATR_DARK_BASE = 0.85;
export const ATR_DARK_GROWTH = 0.0045; // por linha avançada
export const ATR_DARK_START_GAP = 8; // linhas atrás do herói na largada (as 4 de recuo ficam à frente dela)
export const ATR_DARK_LEAD_IN_TICKS = 90; // parada nos primeiros 1,5 s
export const ATR_DARK_MAX_GAP = 8; // quem corre não deixa a escuridão ficar mais longe que isso
export const ATR_DARK_KILL_GAP = 0.6;

/**
 * Varridas de aviso (spec 029): quem fica parado numa faixa de descanso vê uma linha e um "!" descerem
 * pela **coluna** em que está, e logo depois um perigo vem por essa mesma coluna, de frente. Para
 * escapar é só pular para o lado.
 */
export const ATR_SWEEP_IDLE_TICKS = 180; // 3 s parado
export const ATR_SWEEP_MIN_ROW = 20;
export const ATR_SWEEP_WARN_TICKS = 84; // 1,4 s de aviso: o "!" desce e para onde o herói está
export const ATR_SWEEP_COOLDOWN_TICKS = 300; // 5 s depois que ele passa
/** O perigo nasce tantas linhas à frente do herói e termina tantas atrás dele. */
export const ATR_SWEEP_AHEAD = 14;
export const ATR_SWEEP_BEHIND = 8;
export type SweepKind = 'barril' | 'feno' | 'redemoinho' | 'laser';
/** Velocidade (linhas/s) e meia largura (casas) de cada varrida; um passo para o lado sempre escapa. */
export const ATR_SWEEP: Record<SweepKind, { speed: number; r: number }> = {
  barril: { speed: 8, r: 0.5 },
  feno: { speed: 10, r: 0.45 },
  redemoinho: { speed: 5.5, r: 0.6 },
  laser: { speed: 14, r: 0.3 },
};

/** Marcos: a cada 50 linhas até a 500, depois a cada 100. */
export const atravessaMilestone = (row: number): boolean =>
  row > 0 && (row <= 500 ? row % 50 === 0 : row % 100 === 0);

/**
 * Sala online (spec 031). 1 metro = 1 linha. O servidor espelha cada herói pelas entradas que o
 * aparelho informa; nada aqui depende de colisão entre jogadores.
 */
export const ATR_ROOM_MAX_PLAYERS = 8;
/** Modos da sala: Infinito (rodadas, sem checkpoint, sem escuridão) e Checkpoint (corrida até o fim). */
export type AtravessaRoomMode = 'infinito' | 'checkpoint';
export const ATR_ROOM_MODES: readonly AtravessaRoomMode[] = ['infinito', 'checkpoint'];
/** Tamanhos de mapa do checkpoint, em metros. */
export const ATR_ROOM_SIZES = { pequeno: 50, medio: 100, grande: 250, gigante: 500 } as const;
export type AtravessaRoomSize = keyof typeof ATR_ROOM_SIZES;
export const ATR_ROOM_SIZE_IDS = Object.keys(ATR_ROOM_SIZES) as AtravessaRoomSize[];
/** Quem fica parado tanto tempo no Infinito (que não tem escuridão) é engolido. */
export const ATR_IDLE_KILL_TICKS = 12 * ATR_TPS;
/** No checkpoint, a pausa entre a morte e voltar ao último checkpoint. */
export const ATR_RESPAWN_TICKS = 75;
/** Contagem de largada da sala, em ms (3-2-1 e a largada). */
export const ATR_ROOM_COUNTDOWN_MS = 3500;
/** Folga (ticks) que o relógio do aparelho pode estar na frente do relógio do servidor. */
export const ATR_ROOM_TICK_SLACK = 90;

/** A coluna da largada de cada posição na sala: do meio para fora, sempre numa casa livre da linha 0. */
export const atravessaStartCol = (slot: number): number => [0, -1, 1, -2, 2, -3, 3, -4][slot % 8]!;

/** As cores das raposas na sala; cada cor é de uma pessoa só. */
export const ATR_ROOM_COLORS: readonly { name: string; hex: string }[] = [
  { name: 'Laranja', hex: '#ff6a2b' },
  { name: 'Azul', hex: '#2f5bff' },
  { name: 'Amarelo', hex: '#ffd23f' },
  { name: 'Verde', hex: '#33c27f' },
  { name: 'Rosa', hex: '#ff9ecf' },
  { name: 'Roxo', hex: '#7a3cff' },
  { name: 'Ciano', hex: '#25c7e8' },
  { name: 'Vermelho', hex: '#e5303a' },
];

/**
 * Os checkpoints de cada tamanho de mapa (pedido do Lucas, 15/10/2026). A linha do fim do mapa não é
 * checkpoint.
 * - pequeno (50 m): 25
 * - médio (100 m): 25 e 50
 * - grande (250 m): 25, 50, 100, 150 e 200
 * - gigante (500 m): 25, 50, 100, 150, 200, 250, 300, 350 e 400
 */
export const ATR_ROOM_CHECKPOINTS: Record<AtravessaRoomSize, readonly number[]> = {
  pequeno: [25],
  medio: [25, 50],
  grande: [25, 50, 100, 150, 200],
  gigante: [25, 50, 100, 150, 200, 250, 300, 350, 400],
};

/** Os checkpoints do mapa que tem `length` metros (lista vazia se não for um dos tamanhos da sala). */
export function atravessaCheckpoints(length: number): number[] {
  const size = ATR_ROOM_SIZE_IDS.find((id) => ATR_ROOM_SIZES[id] === length);
  return size ? [...ATR_ROOM_CHECKPOINTS[size]] : [];
}

/** Limites que o servidor aceita. */
export const ATR_MAX_TICKS = 30 * 60 * ATR_TPS;
export const ATR_MAX_INPUTS = 20_000;
export const ATR_MAX_SCORE = 3000;

export type Dir = 0 | 1 | 2 | 3; // frente, trás, esquerda, direita
export const ATR_DIRS: readonly Dir[] = [0, 1, 2, 3];

export type AtravessaEnd =
  | 'veiculo'
  | 'trem'
  | 'agua'
  | 'arrastado'
  | 'afundou'
  | 'mordido'
  | 'atingido'
  | 'escuridao'
  /** Parado demais num modo sem escuridão (sala Infinito). */
  | 'parado';

/** Só o Infinito por enquanto (spec 028). */
export type AtravessaMode = 'infinito';
export const ATR_MODES: readonly AtravessaMode[] = ['infinito'];
export const isAtravessaMode = (m: unknown): m is AtravessaMode => m === 'infinito';
