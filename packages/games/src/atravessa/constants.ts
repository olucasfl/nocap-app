/**
 * Atravessa! (spec 028). Tudo em grade: cada faixa é uma linha (`row`) de 9 casas (colunas -4 a 4);
 * o herói pula uma casa por passo. Nomes com prefixo ATR_ porque o pacote exporta tudo junto.
 */

export const ATR_TPS = 60;
export const ATR_DT = 1 / ATR_TPS;

/** Colunas -4 a 4. */
export const ATR_HALF_COLS = 4;
export const ATR_COLS = ATR_HALF_COLS * 2 + 1;

/** Um pulo dura 0,2 s. */
export const ATR_STEP_TICKS = 12;
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

export type AtravessaBiome = 'horta' | 'deserto' | 'neon';
export const ATR_BIOMES: readonly AtravessaBiome[] = ['horta', 'deserto', 'neon'];

export type LaneKind = 'descanso' | 'estrada' | 'trilho' | 'rio';
export type VehicleKind = 'carro' | 'trator' | 'caminhao' | 'moto' | 'drone';
/** Comprimento de cada veículo, em casas. */
export const ATR_VEHICLE_LEN: Record<VehicleKind, number> = {
  carro: 1.4,
  trator: 1.8,
  caminhao: 2.8,
  moto: 0.9,
  drone: 1.1,
};

/** Distância mínima (borda a borda) entre dois veículos da mesma faixa: sempre dá para passar. */
export const ATR_MIN_VEHICLE_GAP = 2.0;
export const ATR_MIN_LOG_GAP = 1.4;

/** Volta do mundo de cada faixa móvel (casas); fora da tela dos dois lados. */
export const ATR_ROAD_LOOP = ATR_COLS + 8;
export const ATR_RIVER_LOOP = 18;

export const ATR_TRAIN_LEN = 12;
export const ATR_TRAIN_SPEED = 18; // casas por segundo
export const ATR_TRAIN_WARN_TICKS = 72; // 1,2 s de luz e sino antes do trem
export const ATR_TRAIN_PASS_TICKS = Math.ceil(((ATR_TRAIN_LEN + ATR_COLS + 1) / ATR_TRAIN_SPEED) * ATR_TPS);

/** Ciclo dos biomas (spec 028): três biomas de ~80 linhas, com 6 de transição entre eles. */
export const ATR_BIOME_LEN = 80;
export const ATR_TRANSITION_LEN = 6;
export const ATR_CYCLE_LEN = (ATR_BIOME_LEN + ATR_TRANSITION_LEN) * 3;

/** Pressão por trás: a escuridão (spec 028). Velocidades em linhas por segundo. */
export const ATR_REF_PACE = 2.4; // ritmo de quem não para de avançar
export const ATR_DARK_CAP_FRACTION = 0.85;
export const ATR_DARK_CAP = ATR_REF_PACE * ATR_DARK_CAP_FRACTION;
export const ATR_DARK_BASE = 0.7;
export const ATR_DARK_GROWTH = 0.004; // por linha avançada
export const ATR_DARK_START_GAP = 6; // linhas atrás do herói na largada
export const ATR_DARK_LEAD_IN_TICKS = 90; // parada nos primeiros 1,5 s
export const ATR_DARK_MAX_GAP = 8; // quem corre não deixa a escuridão ficar mais longe que isso
export const ATR_DARK_KILL_GAP = 0.6;

/** Limites que o servidor aceita. */
export const ATR_MAX_TICKS = 30 * 60 * ATR_TPS;
export const ATR_MAX_INPUTS = 20_000;
export const ATR_MAX_SCORE = 3000;

export type Dir = 0 | 1 | 2 | 3; // frente, trás, esquerda, direita
export const ATR_DIRS: readonly Dir[] = [0, 1, 2, 3];

export type AtravessaEnd = 'veiculo' | 'trem' | 'agua' | 'arrastado' | 'afundou' | 'escuridao';

/** Só o Infinito por enquanto (spec 028). */
export type AtravessaMode = 'infinito';
export const ATR_MODES: readonly AtravessaMode[] = ['infinito'];
export const isAtravessaMode = (m: unknown): m is AtravessaMode => m === 'infinito';
