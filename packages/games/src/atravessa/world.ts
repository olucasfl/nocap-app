import { createRng, randInt } from '../core/rng';
import {
  ATR_BIOME_LEN,
  ATR_COLS,
  ATR_CYCLE_LEN,
  ATR_HALF_COLS,
  ATR_RIVER_LOOP,
  ATR_ROAD_LOOP,
  ATR_TPS,
  ATR_TRAIN_LEN,
  ATR_TRAIN_PASS_TICKS,
  ATR_TRAIN_SPEED,
  ATR_TRAIN_WARN_TICKS,
  ATR_TRANSITION_LEN,
  ATR_VEHICLE_LEN,
  type AtravessaBiome,
  type LaneKind,
  type VehicleKind,
} from './constants';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface BiomeInfo {
  /** Bioma de onde se vem. */
  biome: AtravessaBiome;
  /** Bioma para onde se vai (igual a `biome` fora das transições). */
  next: AtravessaBiome;
  /** 0 a 1 dentro da transição; 0 fora dela. */
  blend: number;
  /** Quantas voltas completas já foram dadas (cada volta fica mais difícil). */
  cycle: number;
}

/** Em que bioma (ou transição) está uma linha. Linha 0 = largada. */
export function biomeAt(row: number): BiomeInfo {
  const r = Math.max(0, Math.floor(row));
  const cycle = Math.floor(r / ATR_CYCLE_LEN);
  const pos = r % ATR_CYCLE_LEN;
  const span = ATR_BIOME_LEN + ATR_TRANSITION_LEN;
  const idx = Math.floor(pos / span) as 0 | 1 | 2;
  const into = pos - idx * span;
  const order: AtravessaBiome[] = ['horta', 'deserto', 'neon'];
  const biome = order[idx]!;
  const next = order[(idx + 1) % 3]!;
  if (into < ATR_BIOME_LEN) return { biome, next: biome, blend: 0, cycle };
  return { biome, next, blend: (into - ATR_BIOME_LEN + 0.5) / ATR_TRANSITION_LEN, cycle };
}

/** O bioma que manda nas regras da faixa (na transição, o mais próximo). */
export const laneBiome = (b: BiomeInfo): AtravessaBiome => (b.blend >= 0.5 ? b.next : b.biome);

/** 0 (fácil) a 1 (difícil): sobe devagar; as 15 primeiras linhas são sempre fáceis. */
export function difficultyAt(row: number): number {
  const b = biomeAt(row);
  return clamp((row - 15) / 335 + b.cycle * 0.2, 0, 1);
}

export interface MovingObj {
  /** Centro em casas no tempo 0. */
  x0: number;
  len: number;
  kind: VehicleKind | 'tora';
}

export interface TrainInfo {
  period: number; // ticks
  quiet: number; // ticks parado antes do aviso
  offset: number;
  len: number;
  speed: number;
}

export interface Pad {
  col: number;
  sinks: boolean;
}

export interface Lane {
  row: number;
  biome: BiomeInfo;
  kind: LaneKind;
  /** 1 = para a direita, -1 = para a esquerda. */
  dir: 1 | -1;
  /** Casas por segundo (estrada e tora). */
  speed: number;
  loop: number;
  objs: MovingObj[];
  /** Descanso: colunas bloqueadas (árvore, pedra, cacto). */
  blocked: number[];
  /** Rio de pedras paradas (em vez de toras): onde se pode pisar. */
  pads: Pad[] | null;
  train: TrainInfo | null;
}

const EMPTY_LANE = (row: number): Lane => ({
  row,
  biome: biomeAt(0),
  kind: 'descanso',
  dir: 1,
  speed: 0,
  loop: ATR_ROAD_LOOP,
  objs: [],
  blocked: [],
  pads: null,
  train: null,
});

const wrap = (v: number, loop: number) => ((((v + loop / 2) % loop) + loop) % loop) - loop / 2;

/** Centro de um objeto móvel da faixa no instante `tick`. */
export const objX = (lane: Lane, o: MovingObj, tick: number): number =>
  wrap(o.x0 + lane.dir * lane.speed * (tick / ATR_TPS), lane.loop);

/** O trem: o que se vê no instante `tick` (aviso e posição). */
export function trainState(lane: Lane, tick: number): { warning: boolean; x: number | null } {
  const t = lane.train;
  if (!t) return { warning: false, x: null };
  const phase = (tick + t.offset) % t.period;
  if (phase < t.quiet) return { warning: false, x: null };
  if (phase < t.quiet + ATR_TRAIN_WARN_TICKS) return { warning: true, x: null };
  const s = ((phase - t.quiet - ATR_TRAIN_WARN_TICKS) / ATR_TPS) * t.speed;
  // x é o centro do trem; ele entra pelo lado de onde vem e sai pelo outro
  const x = lane.dir === 1 ? -ATR_HALF_COLS - 1 - t.len / 2 + s : ATR_HALF_COLS + 1 + t.len / 2 - s;
  return { warning: false, x };
}

const WEIGHTS: Record<AtravessaBiome, Partial<Record<LaneKind, number>>> = {
  horta: { descanso: 30, estrada: 40, rio: 30 },
  deserto: { descanso: 25, estrada: 35, trilho: 20, rio: 20 },
  neon: { descanso: 20, estrada: 45, rio: 35 },
};

const VEHICLES: Record<AtravessaBiome, VehicleKind[]> = {
  horta: ['carro', 'carro', 'trator'],
  deserto: ['carro', 'caminhao', 'carro'],
  neon: ['moto', 'carro', 'drone', 'moto'],
};

const TREE_DENSITY: Record<AtravessaBiome, number> = { horta: 0.28, deserto: 0.18, neon: 0.12 };
const PAD_CHANCE: Record<AtravessaBiome, number> = { horta: 0.45, deserto: 0.5, neon: 0.35 };
const SPEED_SCALE: Record<AtravessaBiome, number> = { horta: 1, deserto: 1.1, neon: 1.2 };

/**
 * O mundo: faixas geradas em ordem a partir da seed, sob demanda. Como as faixas só são geradas na
 * ordem (linha 0, 1, 2...), o resultado só depende da seed, não de quem pediu primeiro.
 *
 * Garantias (testadas): as 3 primeiras faixas são descanso livre; faixas de descanso ou de pedras
 * consecutivas compartilham uma coluna livre (o "corredor"); veículos têm vão mínimo; toras têm vão
 * mínimo; no máximo 3 rios e 4 estradas seguidos.
 */
export class AtravessaWorld {
  private lanes: Lane[] = [];
  private rng: () => number;
  private corridor = 0;
  private segKind: LaneKind = 'descanso';
  private segLeft = 0;
  private prevSegKind: LaneKind | null = null;

  constructor(readonly seed: string) {
    this.rng = createRng(`${seed}:atravessa`);
  }

  lane(row: number): Lane {
    if (row < 0) return EMPTY_LANE(row);
    while (this.lanes.length <= row) this.lanes.push(this.gen(this.lanes.length));
    return this.lanes[row]!;
  }

  /** A coluna livre que atravessa as faixas de descanso e de pedras seguidas. */
  corridorAt(row: number): number {
    this.lane(row);
    return this.corridors[row] ?? 0;
  }
  private corridors: number[] = [];

  private pickSegment(row: number, biome: AtravessaBiome, diff: number) {
    const w = { ...WEIGHTS[biome] };
    if (this.prevSegKind) delete w[this.prevSegKind];
    const kinds = Object.keys(w) as LaneKind[];
    let total = 0;
    for (const k of kinds) total += w[k]!;
    let r = this.rng() * total;
    let kind = kinds[0]!;
    for (const k of kinds) {
      r -= w[k]!;
      if (r <= 0) {
        kind = k;
        break;
      }
    }
    const max = {
      descanso: 3,
      estrada: 1 + Math.floor(1 + diff * 3),
      trilho: 2,
      rio: row < 40 ? 2 : 2 + Math.floor(diff * 1.5),
    }[kind];
    this.segKind = kind;
    this.segLeft = randInt(this.rng, 1, Math.min(max, kind === 'rio' ? 3 : kind === 'estrada' ? 4 : max));
  }

  private gen(row: number): Lane {
    const info = biomeAt(row);
    const biome = laneBiome(info);
    const diff = difficultyAt(row);
    const prev = this.lanes[row - 1];
    if (row <= 2) {
      this.segKind = 'descanso';
      this.corridors[row] = 0;
      return { ...EMPTY_LANE(row), biome: info };
    }
    if (this.segLeft <= 0) {
      this.prevSegKind = this.segKind;
      this.pickSegment(row, biome, diff);
    }
    this.segLeft--;
    const kind = this.segKind;
    const base: Lane = { ...EMPTY_LANE(row), biome: info, kind };
    const rng = this.rng;

    if (kind === 'descanso') {
      // depois de um rio o primeiro descanso é livre: dá para pousar em qualquer coluna
      if (prev && prev.kind !== 'rio') {
        const density = TREE_DENSITY[biome];
        for (let c = -ATR_HALF_COLS; c <= ATR_HALF_COLS; c++) {
          if (c !== this.corridor && base.blocked.length < 5 && rng() < density) base.blocked.push(c);
        }
      }
      this.corridors[row] = this.corridor;
      return base;
    }

    base.dir = rng() < 0.5 ? 1 : -1;
    if (prev && prev.kind === kind) base.dir = (prev.dir * -1) as 1 | -1;

    if (kind === 'rio' && rng() < PAD_CHANCE[biome]) {
      // rio de pedras paradas: o corredor sempre tem pedra firme; as outras podem afundar
      const pads: Pad[] = [{ col: this.corridor, sinks: false }];
      for (let c = -ATR_HALF_COLS; c <= ATR_HALF_COLS; c++) {
        if (c !== this.corridor && rng() < 0.4) pads.push({ col: c, sinks: biome !== 'horta' && rng() < 0.5 });
      }
      base.pads = pads;
      this.corridors[row] = this.corridor;
      return base;
    }
    // faixa móvel: o próximo descanso/pedras pode ter corredor novo (a estrada deixa andar de lado)
    this.corridor = randInt(rng, -3, 3);
    this.corridors[row] = this.corridor;

    if (kind === 'estrada') {
      base.loop = ATR_ROAD_LOOP;
      base.speed = lerp(1.4, 3.2, diff) * SPEED_SCALE[biome] * lerp(0.85, 1.15, rng());
      const n = randInt(rng, 1, diff > 0.5 ? 3 : 2);
      const spacing = base.loop / n;
      const shift = rng() * spacing * 0.3;
      const kinds = VEHICLES[biome];
      for (let i = 0; i < n; i++) {
        const vk = kinds[randInt(rng, 0, kinds.length - 1)]!;
        const jitter = (rng() - 0.5) * 0.6;
        base.objs.push({ x0: wrap(-base.loop / 2 + i * spacing + shift + jitter, base.loop), len: ATR_VEHICLE_LEN[vk], kind: vk });
      }
    } else if (kind === 'trilho') {
      const quiet = randInt(rng, 2 * ATR_TPS, Math.round(4.5 * ATR_TPS));
      const period = quiet + ATR_TRAIN_WARN_TICKS + ATR_TRAIN_PASS_TICKS;
      base.train = {
        period,
        quiet,
        offset: Math.floor(rng() * period),
        len: ATR_TRAIN_LEN,
        speed: ATR_TRAIN_SPEED,
      };
    } else {
      base.loop = ATR_RIVER_LOOP;
      base.speed = lerp(0.8, 1.8, diff) * lerp(0.85, 1.15, rng());
      const n = randInt(rng, 3, 4);
      const lens = Array.from({ length: n }, () => (n === 3 ? randInt(rng, 2, 4) : randInt(rng, 2, 3)));
      const gap = (base.loop - lens.reduce((a, b) => a + b, 0)) / n;
      const shift = rng() * base.loop;
      let cursor = 0;
      for (let i = 0; i < n; i++) {
        base.objs.push({ x0: wrap(cursor + lens[i]! / 2 + shift, base.loop), len: lens[i]!, kind: 'tora' });
        cursor += lens[i]! + gap;
      }
    }
    return base;
  }
}

/** Posição e tamanho de todos os objetos móveis de uma faixa no instante `tick`. */
export function laneObjects(lane: Lane, tick: number): { x: number; len: number; kind: MovingObj['kind'] }[] {
  return lane.objs.map((o) => ({ x: objX(lane, o, tick), len: o.len, kind: o.kind }));
}
