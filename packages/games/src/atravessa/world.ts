import { createRng, randInt } from '../core/rng';
import {
  ATR_BIOME_LEN,
  ATR_CROC_LEN,
  ATR_CYCLE_LEN,
  ATR_FLOW_LEN,
  ATR_HALF_COLS,
  ATR_MIN_LOG_GAP,
  ATR_MIN_VEHICLE_GAP,
  ATR_TPS,
  ATR_TRAIN_LEN,
  ATR_TRAIN_SPEED_EASY,
  ATR_TRAIN_SPEED_HARD,
  ATR_TRAIN_WARN_EASY,
  ATR_TRAIN_WARN_HARD,
  ATR_TRANSITION_LEN,
  type AtravessaBiome,
  type LaneKind,
  type VehicleKind,
} from './constants';
import { LaneFlow, flowX, type FlowItem, type FlowPick } from './flow';

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

export interface TrainInfo {
  period: number; // ticks
  quiet: number; // ticks parado antes do aviso
  warn: number; // ticks de aviso (luz e sino)
  pass: number; // ticks que o trem leva para atravessar
  offset: number;
  len: number;
  speed: number;
}

export interface Pad {
  col: number;
  sinks: boolean;
}

export type RiverMode = 'tora' | 'tartaruga' | 'pedra';

export interface Lane {
  row: number;
  biome: BiomeInfo;
  kind: LaneKind;
  /** 1 = para a direita, -1 = para a esquerda. */
  dir: 1 | -1;
  /** Estrada, rio de toras e de tartarugas: o que anda na faixa (cada item com a sua velocidade). */
  flow: LaneFlow | null;
  riverMode: RiverMode | null;
  /** Descanso: colunas bloqueadas (árvore, pedra, cacto). */
  blocked: number[];
  /** Rio de pedras paradas: onde se pode pisar. */
  pads: Pad[] | null;
  train: TrainInfo | null;
}

const EMPTY_LANE = (row: number): Lane => ({
  row,
  biome: biomeAt(0),
  kind: 'descanso',
  dir: 1,
  flow: null,
  riverMode: null,
  blocked: [],
  pads: null,
  train: null,
});

/** O trem: o que se vê no instante `tick` (aviso e posição do centro). */
export function trainState(lane: Lane, tick: number): { warning: boolean; x: number | null } {
  const t = lane.train;
  if (!t) return { warning: false, x: null };
  const phase = (tick + t.offset) % t.period;
  if (phase < t.quiet) return { warning: false, x: null };
  if (phase < t.quiet + t.warn) return { warning: true, x: null };
  const s = ((phase - t.quiet - t.warn) / ATR_TPS) * t.speed;
  const edge = ATR_HALF_COLS + 1 + t.len / 2;
  const x = lane.dir === 1 ? -edge + s : edge - s;
  return { warning: false, x };
}

/** Os itens ativos da faixa com a posição de cada um. */
export function laneItems(lane: Lane, tick: number): (FlowItem & { x: number })[] {
  if (!lane.flow) return [];
  return lane.flow.active(tick).map((it) => ({ ...it, x: flowX(lane.dir, it, tick) }));
}

const WEIGHTS: Record<AtravessaBiome, Partial<Record<LaneKind, number>>> = {
  horta: { descanso: 30, estrada: 38, rio: 28, trilho: 10 },
  deserto: { descanso: 22, estrada: 32, rio: 18, trilho: 20 },
  neon: { descanso: 18, estrada: 40, rio: 30, trilho: 14 },
};

/**
 * Quantas faixas seguidas dura um trecho de cada tipo (pesos). Os curtos são os mais comuns; os
 * longos vêm, mas raros (spec 029). Com a dificuldade os longos ficam um pouco mais prováveis.
 */
const LEN_WEIGHTS: Record<LaneKind, number[]> = {
  descanso: [40, 40, 20],
  estrada: [30, 27, 19, 13, 7, 4],
  trilho: [45, 35, 12, 5, 3],
  rio: [34, 30, 18, 12, 6],
};

const VEHICLE_KINDS: Record<AtravessaBiome, Record<'slow' | 'mid' | 'fast', VehicleKind[]>> = {
  horta: {
    slow: ['trator', 'caminhao', 'onibus', 'betoneira'],
    mid: ['carro', 'taxi', 'perua', 'picape', 'scooter'],
    fast: ['moto', 'carro', 'taxi'],
  },
  deserto: {
    slow: ['caminhao', 'betoneira', 'onibus', 'picape'],
    mid: ['picape', 'carro', 'perua', 'taxi'],
    fast: ['moto', 'picape', 'carro'],
  },
  neon: {
    slow: ['onibus', 'caminhao', 'betoneira', 'scooter'],
    mid: ['carro', 'taxi', 'perua', 'scooter'],
    fast: ['moto', 'drone', 'carro'],
  },
};

/**
 * As classes de velocidade (casas/s). O carro de corrida (esportivo) quase não aparece, mas quando
 * vem é um raio: perto da velocidade do trem (28 a 44) ou mais. A ambulância é a segunda mais rápida.
 */
type SpeedClass = 'slow' | 'mid' | 'fast' | 'vfast' | 'racer';
const SPEED_RANGE: Record<SpeedClass, [number, number]> = {
  slow: [2.0, 3.2],
  mid: [3.6, 5.5],
  fast: [6.5, 9.5],
  vfast: [11, 15],
  racer: [24, 38],
};
/** Cada faixa tem um perfil de tráfego: o que é comum nela (mas qualquer velocidade pode aparecer). */
const PROFILES: Record<'calma' | 'normal' | 'rush', Record<SpeedClass, number>> = {
  calma: { slow: 0.38, mid: 0.52, fast: 0.1, vfast: 0, racer: 0 },
  normal: { slow: 0.22, mid: 0.45, fast: 0.25, vfast: 0.03, racer: 0.05 },
  rush: { slow: 0.08, mid: 0.3, fast: 0.42, vfast: 0.1, racer: 0.1 },
};
const SPEED_SCALE: Record<AtravessaBiome, number> = { horta: 1, deserto: 1.05, neon: 1.1 };

const TREE_DENSITY: Record<AtravessaBiome, number> = { horta: 0.28, deserto: 0.18, neon: 0.12 };
const PAD_CHANCE: Record<AtravessaBiome, number> = { horta: 0.4, deserto: 0.45, neon: 0.3 };
const TURTLE_CHANCE: Record<AtravessaBiome, number> = { horta: 0.3, deserto: 0.22, neon: 0.34 };

function weighted(rng: () => number, ws: number[]): number {
  let total = 0;
  for (const w of ws) total += w;
  let r = rng() * total;
  for (let i = 0; i < ws.length; i++) {
    r -= ws[i]!;
    if (r <= 0) return i;
  }
  return ws.length - 1;
}

/**
 * O mundo: faixas geradas em ordem a partir da seed, sob demanda. Como as faixas só são geradas na
 * ordem (linha 0, 1, 2...), o resultado só depende da seed, não de quem pediu primeiro. O tráfego
 * de cada faixa tem a sua própria sequência (seed da faixa), gerada conforme o tempo passa.
 *
 * Garantias (testadas): a linha 0 é descanso livre; faixas de descanso ou de pedras consecutivas
 * compartilham uma coluna livre (o "corredor"); veículos e toras nunca se sobrepõem e têm vão mínimo;
 * trechos longos de trilho, estrada e rio existem mas são raros.
 */
export class AtravessaWorld {
  private lanes: Lane[] = [];
  private rng: () => number;
  private corridor = 0;
  private segKind: LaneKind = 'descanso';
  private segLeft = 0;
  private prevSegKind: LaneKind | null = null;
  private corridors: number[] = [];

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

  private pickSegment(row: number, biome: AtravessaBiome, diff: number) {
    const w = { ...WEIGHTS[biome] };
    if (this.prevSegKind) delete w[this.prevSegKind];
    // o trem só aparece depois dos primeiros metros
    if (row < 6) delete w.trilho;
    const kinds = Object.keys(w) as LaneKind[];
    const kind = kinds[weighted(this.rng, kinds.map((k) => w[k]!))]!;
    const base = LEN_WEIGHTS[kind].map((x, i) => (i >= 3 ? x * (1 + diff) : x));
    // no começo os trechos longos de perigo ficam de fora
    const cap = row < 25 && kind !== 'descanso' ? 2 : base.length;
    this.segKind = kind;
    this.segLeft = 1 + weighted(this.rng, base.slice(0, cap));
  }

  private roadFlow(row: number, dir: 1 | -1, biome: AtravessaBiome, diff: number): { flow: LaneFlow } {
    const rng = createRng(`${this.seed}:lane:${row}`);
    const roll = rng();
    const profile = roll < lerp(0.5, 0.12, diff) ? 'calma' : roll < lerp(0.92, 0.6, diff) ? 'normal' : 'rush';
    const weights = { ...PROFILES[profile] };
    // a ambulância e o carro de corrida só aparecem depois dos primeiros metros
    if (row < 30) {
      weights.mid += weights.vfast + weights.racer;
      weights.vfast = 0;
      weights.racer = 0;
    }
    const classes: SpeedClass[] = ['slow', 'mid', 'fast', 'vfast', 'racer'];
    const speedMul = SPEED_SCALE[biome] * lerp(0.95, 1.12, diff);
    const density = rng();
    const pick = (r: () => number): FlowPick => {
      const cls = classes[weighted(r, classes.map((c) => weights[c]))]!;
      const [lo, hi] = SPEED_RANGE[cls];
      const speed = lerp(lo, hi, r()) * speedMul;
      let kind: VehicleKind = cls === 'racer' ? 'esportivo' : 'ambulancia';
      if (cls === 'slow' || cls === 'mid' || cls === 'fast') {
        const list = VEHICLE_KINDS[biome][cls];
        kind = list[Math.floor(r() * list.length)]!;
      }
      return { kind, len: ATR_FLOW_LEN[kind], speed, variant: r() };
    };
    const flow = new LaneFlow(
      {
        dir,
        minGap: ATR_MIN_VEHICLE_GAP,
        extraMean: lerp(2.6, 0.7, density),
        extraMax: 6,
        pick,
      },
      rng,
    );
    return { flow };
  }

  private riverFlow(row: number, dir: 1 | -1, mode: 'tora' | 'tartaruga', diff: number): LaneFlow {
    const rng = createRng(`${this.seed}:lane:${row}`);
    const crocChance = diff > 0.12 ? lerp(0.08, 0.22, diff) : 0;
    const pick = (r: () => number): FlowPick => {
      const speed = lerp(1.7, 4.0, r()) * lerp(0.95, 1.2, diff);
      if (mode === 'tartaruga') {
        const len = r() < 0.5 ? 1.7 : 2.6;
        return { kind: 'tartaruga', len, speed: speed * 0.92, variant: r() };
      }
      if (r() < crocChance) return { kind: 'croc', len: ATR_CROC_LEN, speed: speed * 0.88, variant: r() };
      return { kind: 'tora', len: randInt(r, 2, 4), speed, variant: r() };
    };
    return new LaneFlow(
      { dir, minGap: ATR_MIN_LOG_GAP, extraMean: lerp(1.0, 0.35, diff), extraMax: 1.8, pick },
      rng,
    );
  }

  private gen(row: number): Lane {
    const info = biomeAt(row);
    const biome = laneBiome(info);
    const diff = difficultyAt(row);
    const prev = this.lanes[row - 1];
    if (row === 0) {
      this.corridors[row] = 0;
      return { ...EMPTY_LANE(row), biome: info };
    }
    if (this.segLeft <= 0) {
      this.prevSegKind = row === 1 ? 'descanso' : this.segKind;
      this.pickSegment(row, biome, diff);
    }
    this.segLeft--;
    const kind = this.segKind;
    const base: Lane = { ...EMPTY_LANE(row), biome: info, kind };
    const rng = this.rng;

    if (kind === 'descanso') {
      // depois de um rio o primeiro descanso é livre: dá para pousar em qualquer coluna
      if (prev && prev.kind !== 'rio' && row >= 3) {
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
      base.riverMode = 'pedra';
      this.corridors[row] = this.corridor;
      return base;
    }
    // faixa móvel: o próximo descanso/pedras pode ter corredor novo (a estrada deixa andar de lado)
    this.corridor = randInt(rng, -3, 3);
    this.corridors[row] = this.corridor;

    if (kind === 'estrada') {
      base.flow = this.roadFlow(row, base.dir, biome, diff).flow;
    } else if (kind === 'trilho') {
      const quiet = randInt(rng, 2 * ATR_TPS, Math.round(4.5 * ATR_TPS));
      const speed = lerp(ATR_TRAIN_SPEED_EASY, ATR_TRAIN_SPEED_HARD, diff) * lerp(0.95, 1.05, rng());
      const warn = Math.round(lerp(ATR_TRAIN_WARN_EASY, ATR_TRAIN_WARN_HARD, diff));
      const pass = Math.ceil(((ATR_TRAIN_LEN + 2 * (ATR_HALF_COLS + 1)) / speed) * ATR_TPS);
      const period = quiet + warn + pass;
      base.train = { period, quiet, warn, pass, offset: Math.floor(rng() * period), len: ATR_TRAIN_LEN, speed };
    } else {
      const mode: 'tora' | 'tartaruga' = rng() < TURTLE_CHANCE[biome] ? 'tartaruga' : 'tora';
      base.riverMode = mode;
      base.flow = this.riverFlow(row, base.dir, mode, diff);
    }
    return base;
  }
}
