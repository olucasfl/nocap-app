import { describe, expect, it } from 'vitest';
import {
  ATR_BACK_ROWS,
  ATR_BIOMES,
  ATR_BIOME_LEN,
  ATR_SEGMENT_LEN,
  ATR_START_GRASS,
  ATR_COLS,
  ATR_CROC_OPEN,
  ATR_CROC_PERIOD,
  ATR_CROC_WARN,
  ATR_CYCLE_LEN,
  ATR_DT,
  ATR_FLOW_HALF,
  ATR_HALF_COLS,
  ATR_MIN_LOG_GAP,
  ATR_MIN_VEHICLE_GAP,
  ATR_STEP_TICKS,
  ATR_SWEEP_AHEAD,
  ATR_SWEEP_IDLE_TICKS,
  ATR_SWEEP_WARN_TICKS,
  ATR_TRAIN_SPEED_EASY,
  ATR_TURTLE_PERIOD,
  AtravessaSim,
  AtravessaWorld,
  atravessaMilestone,
  biomeAt,
  biomeSequence,
  crocState,
  difficultyAt,
  evaluateAtravessa,
  flowX,
  isSolid,
  laneItems,
  trainState,
  turtleState,
  validateAtravessaInputs,
  type AtravessaInput,
  type Dir,
  type Lane,
} from './index';

const SEEDS = Array.from({ length: 12 }, (_, i) => `semente-${i}`);
const ROWS = 400;

function findLane(w: AtravessaWorld, kind: Lane['kind'], pred: (l: Lane) => boolean = () => true, from = 3): Lane {
  for (let r = from; r < 900; r++) {
    const l = w.lane(r);
    if (l.kind === kind && pred(l)) return l;
  }
  throw new Error(`sem faixa ${kind}`);
}

const ANY = "qualquer-uma";

/** Um herói parado numa faixa de descanso com mais duas de descanso à frente (nada o atrapalha). */
function calmSim(seed = "calmo") {
  const w = new AtravessaWorld(seed);
  for (let r = 3; r < 900; r++) {
    if ([r, r + 1, r + 2].every((x) => w.lane(x).kind === "descanso")) {
      const sim = new AtravessaSim(seed, w);
      sim.row = r;
      sim.best = r;
      sim.hx = w.corridorAt(r);
      return { sim, r, w };
    }
  }
  throw new Error("sem trecho calmo");
}

/** Em que tick (a partir de `from`) o primeiro item da faixa está perto do centro. */
function itemNearCenter(lane: Lane, from = 300) {
  for (let t = from; t < from + 6000; t++) {
    for (const it of laneItems(lane, t)) if (Math.abs(it.x) < 2) return { t, it };
  }
  throw new Error('nenhum item');
}

describe('biomas', () => {
  it('a cada 150 linhas há uma transição de 6 linhas para o bioma seguinte', () => {
    const seq = biomeSequence('transicao', 6);
    // a largada é grama; depois da mistura vem o primeiro cenário sorteado
    expect(biomeAt('transicao', 0)).toMatchObject({ biome: 'horta', blend: 0 });
    expect(biomeAt('transicao', ATR_START_GRASS + 6)).toMatchObject({ biome: seq[0], blend: 0 });
    expect(biomeAt('transicao', ATR_BIOME_LEN - 1)).toMatchObject({ biome: seq[0], blend: 0 });
    const t = biomeAt('transicao', ATR_BIOME_LEN);
    expect(t).toMatchObject({ biome: seq[0], next: seq[1] });
    expect(t.blend).toBeGreaterThan(0);
    expect(biomeAt('transicao', ATR_SEGMENT_LEN - 1).blend).toBeLessThan(1);
    expect(biomeAt('transicao', ATR_SEGMENT_LEN)).toMatchObject({ biome: seq[1], blend: 0 });
    expect(biomeAt('transicao', ATR_SEGMENT_LEN * 2)).toMatchObject({ biome: seq[2], blend: 0 });
  });

  it('a ordem segue as regras: o 2º difere do 1º, o 3º é o que sobrou, o 4º difere do 3º, e assim por diante', () => {
    const firsts = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const seq = biomeSequence(`ordem-${i}`, 30);
      firsts.add(seq[0]!);
      for (let g = 0; g < 10; g++) {
        const [a, b, c] = [seq[g * 3]!, seq[g * 3 + 1]!, seq[g * 3 + 2]!];
        expect(new Set([a, b, c]).size).toBe(3); // 2º ≠ 1º e o 3º é o que sobrou
        if (g > 0) expect(a).not.toBe(seq[g * 3 - 1]); // o 1º do grupo novo ≠ o último do anterior
      }
    }
    // o primeiro bioma sorteado muda de partida para partida
    // o primeiro cenário sorteado nunca é a horta (a largada já é grama): só deserto ou noite
    expect([...firsts].sort()).toEqual(['deserto', 'neon']);
  });

  it('a ordem é a mesma para a mesma seed e muda com a seed', () => {
    expect(biomeSequence('igual', 12)).toEqual(biomeSequence('igual', 12));
    const all = new Set<string>();
    for (let i = 0; i < 60; i++) all.add(biomeSequence(`outra-${i}`, 6).join(','));
    expect(all.size).toBeGreaterThan(10);
  });

  it('o mundo usa a ordem da seed e as faixas ficam com o bioma certo', () => {
    const w = new AtravessaWorld('mundo-biomas');
    const seq = biomeSequence('mundo-biomas', 4);
    for (const [row, idx] of [[ATR_START_GRASS + 12, 0], [ATR_SEGMENT_LEN + 5, 1], [ATR_SEGMENT_LEN * 2 + 5, 2], [ATR_SEGMENT_LEN * 3 + 5, 3]] as const) {
      expect(w.lane(row).biome.biome).toBe(seq[idx]);
      expect(ATR_BIOMES).toContain(w.lane(row).biome.biome);
    }
  });

  it('a dificuldade sobe e as 15 primeiras linhas são fáceis', () => {
    expect(difficultyAt(15)).toBe(0);
    expect(difficultyAt(200)).toBeGreaterThan(difficultyAt(100));
    expect(difficultyAt(10_000)).toBe(1);
  });
});

describe('marcos', () => {
  it('a cada 50 linhas até a 500 e depois a cada 100', () => {
    const marks = Array.from({ length: 1001 }, (_, r) => r).filter(atravessaMilestone);
    expect(marks.slice(0, 11)).toEqual([50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600]);
    expect(marks.slice(-2)).toEqual([900, 1000]);
    expect(atravessaMilestone(0)).toBe(false);
    expect(atravessaMilestone(550)).toBe(false);
  });
});

/** Um resumo do que a seed gera (para comparar duas gerações sem comparar objetos com funções). */
function snapshot(w: AtravessaWorld, rows: number) {
  const out: unknown[] = [];
  for (let r = 0; r < rows; r++) {
    const l = w.lane(r);
    out.push([l.kind, l.dir, l.blocked, l.pads, l.riverMode, l.train?.speed]);
    for (const t of [0, 300, 1700]) out.push(laneItems(l, t).map((i) => [i.kind, i.speed.toFixed(3), i.x.toFixed(2)]));
  }
  return out;
}

describe('geração', () => {
  it('é determinística e não depende da ordem em que as faixas são pedidas', () => {
    const a = new AtravessaWorld('x');
    const b = new AtravessaWorld('x');
    b.lane(50);
    expect(snapshot(a, 60)).toEqual(snapshot(b, 60));
    expect(snapshot(new AtravessaWorld('y'), 20)).not.toEqual(snapshot(a, 20));
  });

  it('a linha 0 é grama livre; as seguintes podem ser qualquer coisa (começar com rio ou estrada)', () => {
    const first = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const w = new AtravessaWorld(`ini-${i}`);
      expect(w.lane(0)).toMatchObject({ kind: 'descanso', blocked: [] });
      first.add(w.lane(1).kind);
    }
    expect(first.has('rio')).toBe(true);
    expect(first.has('estrada')).toBe(true);
    expect(first.has('descanso')).toBe(false);
  });

  it('os trechos são balanceados: curtos comuns, longos raros, mas eles existem', () => {
    const runs: Record<string, number[]> = { trilho: [], estrada: [], rio: [] };
    for (let i = 0; i < 40; i++) {
      const w = new AtravessaWorld(`trechos-${i}`);
      let kind = '';
      let n = 0;
      const flush = () => {
        if (n > 0 && runs[kind]) runs[kind]!.push(n);
      };
      for (let r = 1; r < 700; r++) {
        const k = w.lane(r).kind;
        if (k === kind) n++;
        else {
          flush();
          kind = k;
          n = 1;
        }
      }
    }
    const share = (list: number[], pred: (n: number) => boolean) => list.filter(pred).length / list.length;
    // trem: 1 e 2 são o normal (~80%), 5 existe mas é raro
    expect(share(runs.trilho!, (n) => n <= 2)).toBeGreaterThan(0.65);
    expect(Math.max(...runs.trilho!)).toBeGreaterThanOrEqual(4);
    expect(share(runs.trilho!, (n) => n >= 4)).toBeLessThan(0.2);
    expect(Math.max(...runs.trilho!)).toBeLessThanOrEqual(5);
    expect(share(runs.estrada!, (n) => n <= 3)).toBeGreaterThan(0.5);
    expect(Math.max(...runs.estrada!)).toBeGreaterThanOrEqual(5);
    expect(Math.max(...runs.estrada!)).toBeLessThanOrEqual(6);
    expect(share(runs.rio!, (n) => n <= 3)).toBeGreaterThan(0.6);
    expect(Math.max(...runs.rio!)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...runs.rio!)).toBeLessThanOrEqual(5);
  });

  it('sempre existe caminho: corredor livre nas faixas de descanso e de pedras seguidas', () => {
    for (const s of SEEDS) {
      const w = new AtravessaWorld(s);
      for (let r = 0; r < ROWS; r++) {
        const l = w.lane(r);
        const prev = r > 0 ? w.lane(r - 1) : null;
        const cor = w.corridorAt(r);
        if (l.kind === 'descanso') {
          expect(l.blocked).not.toContain(cor);
          expect(ATR_COLS - l.blocked.length).toBeGreaterThanOrEqual(3);
          if (prev?.kind === 'rio') expect(l.blocked).toEqual([]);
        }
        if (l.pads) expect(l.pads.some((p) => p.col === cor && !p.sinks)).toBe(true);
        if (prev && (prev.kind === 'descanso' || prev.pads) && (l.kind === 'descanso' || l.pads)) {
          expect(w.corridorAt(r - 1)).toBe(cor);
        }
      }
    }
  });

  it('o trilho aparece em todos os biomas', () => {
    const seen = new Set<string>();
    for (const s of SEEDS) {
      const w = new AtravessaWorld(s);
      for (let r = 0; r < ATR_CYCLE_LEN; r++) {
        const l = w.lane(r);
        if (l.kind === 'trilho') seen.add(l.biome.blend >= 0.5 ? l.biome.next : l.biome.biome);
      }
    }
    expect(seen.size).toBe(3);
  });
});

describe('tráfego: cada veículo com a sua velocidade', () => {
  it('nunca dois itens se sobrepõem e o vão mínimo vale em qualquer instante', () => {
    for (const s of SEEDS.slice(0, 6)) {
      const w = new AtravessaWorld(s);
      for (let r = 3; r < 160; r++) {
        const l = w.lane(r);
        if (!l.flow) continue;
        const min = l.kind === 'estrada' ? ATR_MIN_VEHICLE_GAP : ATR_MIN_LOG_GAP;
        for (let t = 0; t < 5000; t += 11) {
          const items = laneItems(l, t).sort((a, b) => a.x - b.x);
          for (let i = 1; i < items.length; i++) {
            const gap = items[i]!.x - items[i - 1]!.x - (items[i]!.len + items[i - 1]!.len) / 2;
            expect(gap).toBeGreaterThanOrEqual(min - 1e-6);
          }
        }
      }
    }
  });

  it('na mesma faixa aparecem veículos lentos e rápidos, não uma velocidade só', () => {
    let mixed = 0;
    let lanes = 0;
    for (const s of SEEDS) {
      const w = new AtravessaWorld(s);
      for (let r = 3; r < 200; r++) {
        const l = w.lane(r);
        if (l.kind !== 'estrada') continue;
        lanes++;
        const speeds = new Set<number>();
        for (let t = 0; t < 12_000; t += 30) for (const it of laneItems(l, t)) speeds.add(it.speed);
        const list = [...speeds];
        if (Math.max(...list) / Math.min(...list) > 1.8) mixed++;
      }
    }
    expect(mixed / lanes).toBeGreaterThan(0.5);
  });

  it('há vários modelos, e o rápido tem cara de rápido', () => {
    const speeds = new Map<string, number[]>();
    for (const s of SEEDS) {
      const w = new AtravessaWorld(s);
      for (let r = 3; r < 300; r++) {
        const l = w.lane(r);
        if (l.kind !== 'estrada') continue;
        for (let t = 0; t < 6000; t += 60) {
          for (const it of laneItems(l, t)) {
            const list = speeds.get(it.kind) ?? [];
            list.push(it.speed);
            speeds.set(it.kind, list);
          }
        }
      }
    }
    expect(speeds.size).toBeGreaterThanOrEqual(11);
    const max = (k: string) => Math.max(...(speeds.get(k) ?? [0]));
    const min = (k: string) => Math.min(...(speeds.get(k) ?? [1e9]));
    // o esportivo é quase na velocidade do trem (28 a 44), nunca devagar
    expect(min('esportivo')).toBeGreaterThan(20);
    expect(max('esportivo')).toBeGreaterThan(ATR_TRAIN_SPEED_EASY * 0.9);
    // a ambulância vem depois, e os pesados são os mais lentos
    expect(min('ambulancia')).toBeGreaterThan(9);
    expect(max('ambulancia')).toBeLessThan(min('esportivo') + 8);
    expect(max('trator')).toBeLessThan(6);
    expect(max('onibus')).toBeLessThan(6.5);
    expect(min('moto')).toBeGreaterThan(5);
  });

  it('a ambulância é rara, rápida e só aparece depois dos primeiros metros', () => {
    let amb = 0;
    let total = 0;
    for (const s of SEEDS) {
      const w = new AtravessaWorld(s);
      for (let r = 3; r < 400; r++) {
        const l = w.lane(r);
        if (l.kind !== 'estrada') continue;
        for (let t = 0; t < 8000; t += 40) {
          for (const it of laneItems(l, t)) {
            total++;
            if (it.kind === 'ambulancia') {
              amb++;
              expect(r).toBeGreaterThanOrEqual(30);
              expect(it.speed).toBeGreaterThan(9);
            }
          }
        }
      }
    }
    expect(amb).toBeGreaterThan(0);
    expect(amb / total).toBeLessThan(0.12);
  });
});

describe('rio: toras, crocodilos e tartarugas', () => {
  it('o crocodilo avisa antes de abrir a boca, e a boca abre por pouco tempo', () => {
    const w = new AtravessaWorld('croc');
    const l = findLane(w, 'rio', (x) => x.riverMode === 'tora' && !!laneItems(x, 0).concat(laneItems(x, 900), laneItems(x, 2500)).find((i) => i.kind === 'croc'), 40);
    const it = [0, 900, 2500].flatMap((t) => laneItems(l, t)).find((i) => i.kind === 'croc')!;
    const states: string[] = [];
    for (let t = it.t0; t < it.t0 + ATR_CROC_PERIOD * 2; t++) states.push(crocState(it, t));
    const firstOpen = states.indexOf('open');
    expect(states.slice(firstOpen - ATR_CROC_WARN, firstOpen).every((s) => s === 'warn')).toBe(true);
    expect(states.filter((s) => s === 'open').length).toBe(ATR_CROC_OPEN * 2);
  });

  it('a tartaruga sobe, avisa e mergulha em ciclo, e a mergulhada não segura ninguém', () => {
    const w = new AtravessaWorld('tart');
    const l = findLane(w, 'rio', (x) => x.riverMode === 'tartaruga', 10);
    const it = laneItems(l, 600)[0] ?? laneItems(l, 1500)[0]!;
    const seen = new Set<string>();
    for (let t = 0; t < ATR_TURTLE_PERIOD; t++) {
      const st = turtleState(it, it.t0 + t);
      seen.add(st);
      expect(isSolid(it, it.t0 + t)).toBe(st !== 'down');
    }
    expect([...seen].sort()).toEqual(['down', 'up', 'warn']);
  });

  it('rios de tartarugas e de pedras aparecem junto com os de toras', () => {
    const modes = new Set<string>();
    for (const s of SEEDS) {
      const w = new AtravessaWorld(s);
      for (let r = 1; r < 300; r++) if (w.lane(r).riverMode) modes.add(w.lane(r).riverMode!);
    }
    expect([...modes].sort()).toEqual(['pedra', 'tartaruga', 'tora']);
  });
});

describe('trem', () => {
  it('é muito rápido e avisa antes de passar', () => {
    const w = new AtravessaWorld('trem');
    const l = findLane(w, 'trilho', () => true, 8);
    expect(l.train!.speed).toBeGreaterThanOrEqual(ATR_TRAIN_SPEED_EASY * 0.9);
    let warnTicks = 0;
    let sawTrain = false;
    let passing = false;
    for (let t = 0; t < l.train!.period * 3; t++) {
      const st = trainState(l, t);
      if (st.warning) warnTicks++;
      const now = st.x !== null;
      // o primeiro aviso pode ter começado antes do tick 0: só vale conferir a partir do segundo trem
      if (now && !passing && warnTicks > 0) {
        if (sawTrain) expect(warnTicks).toBeGreaterThanOrEqual(l.train!.warn);
        sawTrain = true;
      }
      if (now) warnTicks = 0;
      passing = now;
    }
    expect(sawTrain).toBe(true);
  });

  it('com a dificuldade fica mais rápido e o aviso mais curto, mas nunca some', () => {
    let easy: Lane | null = null;
    let hard: Lane | null = null;
    for (const s of SEEDS) {
      const w = new AtravessaWorld(s);
      for (let r = 8; r < 4000; r++) {
        const l = w.lane(r);
        if (l.kind !== 'trilho') continue;
        if (!easy && difficultyAt(r) < 0.1) easy = l;
        if (!hard && difficultyAt(r) > 0.9) hard = l;
      }
    }
    expect(hard!.train!.speed).toBeGreaterThan(easy!.train!.speed);
    expect(hard!.train!.warn).toBeLessThan(easy!.train!.warn);
    expect(hard!.train!.warn).toBeGreaterThanOrEqual(50);
  });
});

describe('simulação', () => {
  const advance = (sim: AtravessaSim, n: number) => {
    for (let i = 0; i < n; i++) sim.step();
  };

  it('um passo para a frente leva 12 ticks, com arco de pulo e pouso', () => {
    const { sim, r } = calmSim();
    sim.input(0);
    advance(sim, 1);
    expect(sim.view().step).toMatchObject({ dir: 0 });
    advance(sim, ATR_STEP_TICKS / 2 - 1);
    const mid = sim.view();
    expect(mid.hop).toBeCloseTo(0.45, 1);
    expect(mid.y).toBeCloseTo(r + 0.5, 1);
    advance(sim, ATR_STEP_TICKS / 2);
    const end = sim.view();
    expect(end).toMatchObject({ step: null, score: r + 1, hop: 0 });
    expect(end.y).toBe(r + 1);
    expect(end.landed).toMatchObject({ age: 0, dir: 0 });
    advance(sim, 3);
    expect(sim.view().landed!.age).toBe(3);
  });

  it('voltar e andar de lado não mudam a nota; só a maior linha conta', () => {
    const { sim, r } = calmSim();
    for (const d of [0, 0, 1, 2, 3] as Dir[]) {
      sim.input(d);
      advance(sim, ATR_STEP_TICKS + 1);
    }
    expect(sim.score).toBe(r + 2);
    expect(sim.row).toBe(r + 1);
  });

  it('a fila guarda no máximo 2 passos além do atual', () => {
    const { sim, r } = calmSim();
    for (let i = 0; i < 6; i++) sim.input(0);
    advance(sim, 1);
    expect(sim.view().queued).toBe(1);
    advance(sim, ATR_STEP_TICKS * 4);
    expect(sim.score).toBe(r + 2);
  });

  it('não sai pelos lados e recua no máximo 4 linhas atrás da largada', () => {
    const sim = new AtravessaSim(ANY);
    // a coluna 0 é livre em todas as linhas de trás: dá para recuar por ela
    for (let i = 0; i < ATR_BACK_ROWS + 3; i++) {
      sim.input(1);
      advance(sim, ATR_STEP_TICKS + 1);
    }
    expect(sim.row).toBe(-ATR_BACK_ROWS);
    expect(sim.view().bumps).toBe(3);
    expect(sim.score).toBe(0);
    sim.row = 0;
    sim.hx = 0;
    for (let i = 0; i < 12; i++) {
      sim.input(3);
      advance(sim, ATR_STEP_TICKS + 1);
    }
    expect(sim.hx).toBe(ATR_HALF_COLS);
  });

  it('atrás da largada há descanso com árvores (coluna 0 livre) e mata fechada além do limite', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const w = new AtravessaWorld(seed);
      for (let r = -1; r >= -ATR_BACK_ROWS; r--) {
        const lane = w.lane(r);
        expect(lane.kind).toBe('descanso');
        expect(lane.blocked).not.toContain(0);
        expect(lane.biome.biome).toBe('horta');
      }
      expect(Array.from({ length: ATR_BACK_ROWS }, (_, i) => w.lane(-1 - i).blocked.length).some((n) => n > 0)).toBe(true);
      expect(w.lane(-ATR_BACK_ROWS - 1).blocked).toHaveLength(ATR_COLS);
      // o mesmo mundo sempre dá as mesmas árvores
      expect(new AtravessaWorld(seed).lane(-2).blocked).toEqual(w.lane(-2).blocked);
    }
  });

  it('a largada é sempre na grama, em qualquer seed, e depois o cenário muda de partida para partida', () => {
    const later = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const w = new AtravessaWorld(`largada-${i}`);
      for (const r of [0, 1, 5, ATR_START_GRASS - 1]) expect(w.lane(r).biome.biome, `linha ${r}`).toBe('horta');
      later.add(w.lane(ATR_START_GRASS + 12).biome.biome);
    }
    // depois da largada o mapa sempre muda: deserto ou noite, nunca a mesma grama
    expect([...later].sort()).toEqual(['deserto', 'neon']);
  });

  it('a mistura da grama com o cenário sorteado leva 6 linhas e termina no bioma da seed', () => {
    for (let i = 0; i < 40; i++) {
      const seed = `mistura-${i}`;
      const real = biomeSequence(seed, 2)[0]!;
      const w = new AtravessaWorld(seed);
      expect(w.biomeAt(ATR_START_GRASS - 1).blend).toBe(0);
      const mid = w.biomeAt(ATR_START_GRASS + 2);
      expect(mid).toMatchObject({ biome: 'horta', next: real });
      expect(mid.blend).toBeGreaterThan(0);
      expect(mid.blend).toBeLessThan(1);
      expect(w.biomeAt(ATR_START_GRASS + 6)).toMatchObject({ biome: real, blend: 0 });
    }
  });

  it('casa bloqueada recusa o passo sem gastar tempo', () => {
    const w = new AtravessaWorld('arv');
    let r = 3;
    while (!(w.lane(r).kind === 'descanso' && w.lane(r).blocked.length && w.lane(r - 1).kind === 'descanso')) r++;
    const col = w.lane(r).blocked[0]!;
    const sim = new AtravessaSim('arv', w);
    sim.row = r - 1;
    sim.best = r - 1;
    sim.hx = col;
    sim.input(0);
    advance(sim, 1);
    expect(sim.view().step).toBeNull();
    expect(sim.row).toBe(r - 1);
    expect(sim.view().bumps).toBe(1);
  });

  it('veículo mata e a tela sabe de que lado ele veio', () => {
    const w = new AtravessaWorld('carro');
    const lane = findLane(w, 'estrada');
    const { t, it } = itemNearCenter(lane);
    const sim = new AtravessaSim('carro', w);
    sim.row = lane.row;
    sim.tick = t - 1;
    sim.hx = Math.round(flowX(lane.dir, it, t));
    advance(sim, 1);
    expect(sim.alive).toBe(false);
    expect(sim.end).toBe('veiculo');
    expect(sim.view().killer).toBe(lane.dir);
  });

  it('a tora carrega o herói na velocidade dela e, passando da borda, ele é arrastado', () => {
    const w = new AtravessaWorld('tora');
    const lane = findLane(w, 'rio', (l) => l.riverMode === 'tora');
    const { t, it } = itemNearCenter(lane);
    const sim = new AtravessaSim('tora', w);
    sim.row = lane.row;
    sim.best = lane.row;
    sim.tick = t - 1;
    sim.hx = flowX(lane.dir, it, t);
    const x0 = sim.hx;
    advance(sim, 30);
    expect(sim.alive).toBe(true);
    expect(sim.hx - x0).toBeCloseTo(lane.dir * it.speed * 30 * ATR_DT, 1);
    advance(sim, 60 * 60);
    expect(sim.alive).toBe(false);
  });

  it('pousar na água afoga', () => {
    const w = new AtravessaWorld('agua');
    const lane = findLane(w, 'rio', (x) => !!x.pads);
    const bad = Array.from({ length: ATR_HALF_COLS * 2 + 1 }, (_, i) => i - ATR_HALF_COLS).find((c) => !lane.pads!.some((p) => p.col === c))!;
    const sim = new AtravessaSim('agua', w);
    sim.row = lane.row - 1;
    sim.best = lane.row - 1;
    sim.hx = bad;
    sim.input(0);
    advance(sim, ATR_STEP_TICKS + 1);
    expect(sim.end).toBe('agua');
  });

  it('em cima da tartaruga que mergulha o herói afunda', () => {
    const w = new AtravessaWorld('tart2');
    const lane = findLane(w, 'rio', (l) => l.riverMode === 'tartaruga', 10);
    const { t, it } = itemNearCenter(lane);
    const sim = new AtravessaSim('tart2', w);
    sim.row = lane.row;
    sim.best = lane.row;
    // começa no instante em que ela acabou de subir e fica em cima até o mergulho
    const period = ATR_TURTLE_PERIOD;
    let start = t;
    while (turtleState(it, start) !== 'up' || turtleState(it, start - 1) === 'up') start++;
    expect(start - t).toBeLessThan(period);
    sim.tick = start - 1;
    sim.hx = flowX(lane.dir, it, start);
    for (let i = 0; i < period && sim.alive; i++) sim.step();
    expect(sim.alive).toBe(false);
    expect(['afundou', 'arrastado']).toContain(sim.end);
  });

  it('crocodilo: a boca aberta na cabeça morde', () => {
    const w = new AtravessaWorld('croc2');
    const lane = findLane(w, 'rio', (l) => l.riverMode === 'tora' && [0, 900, 2500, 5000].some((t) => laneItems(l, t).some((i) => i.kind === 'croc')), 40);
    const it = [0, 900, 2500, 5000].flatMap((t) => laneItems(lane, t)).find((i) => i.kind === 'croc')!;
    let open = it.t0 + 1;
    // a boca aberta num instante em que o crocodilo está perto do centro da tela
    // (busca limitada à vida do item: o ciclo da boca e a travessia são independentes)
    const end = it.t0 + it.dur;
    while (open < end && !(crocState(it, open) === 'open' && Math.abs(flowX(lane.dir, it, open)) < 3.2)) open++;
    expect(open).toBeLessThan(end);
    const sim = new AtravessaSim('croc2', w);
    sim.row = lane.row;
    sim.best = lane.row;
    sim.tick = open - 1;
    const head = flowX(lane.dir, it, open) + lane.dir * (it.len / 2 - 0.6);
    sim.hx = head;
    advance(sim, 1);
    expect(sim.end).toBe('mordido');
  });
});

describe('varridas de aviso', () => {
  /** Uma faixa de descanso com vizinhas de descanso (o herói fica na coluna livre). */
  const calmRow = (seed: string) => {
    const w = new AtravessaWorld(seed);
    for (let r = 24; r < 400; r++) {
      if (w.lane(r - 1).kind === 'descanso' && w.lane(r).kind === 'descanso' && w.lane(r + 1).kind === 'descanso') {
        return { w, r };
      }
    }
    throw new Error('sem trecho calmo');
  };
  const place = (seed: string) => {
    const { w, r } = calmRow(seed);
    const sim = new AtravessaSim(seed, w);
    sim.row = r;
    sim.best = r;
    sim.hx = w.corridorAt(r);
    return { sim, w, r };
  };

  it('quem fica parado numa faixa de descanso leva um aviso na própria coluna, antes de o perigo vir', () => {
    for (const seed of ['barril-1', 'barril-2', 'barril-3']) {
      const { sim, r } = place(seed);
      const col = sim.hx;
      for (let i = 0; i < ATR_SWEEP_IDLE_TICKS - 5; i++) sim.step();
      expect(sim.view().sweep).toBeNull();
      for (let i = 0; i < 12; i++) sim.step();
      expect(sim.view().sweep).toMatchObject({ col, row0: r, from: r + ATR_SWEEP_AHEAD, phase: 'warn', at: null });
      expect(sim.alive).toBe(true);
    }
  });

  it('o aviso dura 1,4 s; depois o perigo desce pela coluna (da frente para trás) e atinge quem não saiu', () => {
    const { sim, r } = place('barril-9');
    while (!sim.view().sweep) sim.step();
    for (let i = 0; i < ATR_SWEEP_WARN_TICKS - 1; i++) {
      sim.step();
      expect(sim.alive).toBe(true);
    }
    const seen: number[] = [];
    for (let i = 0; i < 400 && sim.alive; i++) {
      sim.step();
      const at = sim.view().sweep?.at;
      if (typeof at === 'number') seen.push(at);
    }
    expect(seen[0]).toBeLessThanOrEqual(r + ATR_SWEEP_AHEAD);
    expect(seen.every((x, i) => i === 0 || x < seen[i - 1]!)).toBe(true);
    expect(sim.end).toBe('atingido');
  });

  it('quem sai da coluna durante o aviso (um passo para o lado) sobrevive e o perigo passa', () => {
    const { sim, w, r } = place('barril-9');
    const lane = w.lane(r);
    // uma coluna livre com a vizinha da direita também livre (árvores podem fechar o lado)
    let col = sim.hx;
    if (lane.blocked.includes(col + 1) || col + 1 > ATR_HALF_COLS) {
      col = Array.from({ length: ATR_HALF_COLS * 2 }, (_, i) => i - ATR_HALF_COLS).find((c) => !lane.blocked.includes(c) && !lane.blocked.includes(c + 1))!;
      sim.hx = col;
    }
    const dir: Dir = 3;
    while (!sim.view().sweep) sim.step();
    for (let i = 0; i < 10; i++) sim.step();
    sim.input(dir);
    let passed = false;
    for (let i = 0; i < 360; i++) {
      sim.step();
      expect(sim.alive).toBe(true);
      if (!sim.view().sweep && i > 100) passed = true;
    }
    expect(passed).toBe(true);
    expect(Math.round(sim.hx)).toBe(col + (dir === 3 ? 1 : -1));
  });

  it('ir para a frente não adianta: o perigo vem pela mesma coluna', () => {
    const { sim } = place('barril-9');
    while (!sim.view().sweep) sim.step();
    for (let i = 0; i < 10; i++) sim.step();
    sim.input(0);
    for (let i = 0; i < 600 && sim.alive; i++) sim.step();
    expect(sim.alive).toBe(false);
  });

  it('o perigo muda com o bioma e só vem depois da linha 20', () => {
    const kinds = new Set<string>();
    for (const seed of ['b1', 'b2', 'b3']) {
      const w = new AtravessaWorld(seed);
      const found = new Set<string>();
      for (let r = 24; r < ATR_SEGMENT_LEN * 4 && found.size < 3; r++) {
        const lb = w.lane(r).biome;
        const biome = lb.blend >= 0.5 ? lb.next : lb.biome;
        if (found.has(biome) || lb.blend > 0) continue;
        if (!(w.lane(r - 1).kind === 'descanso' && w.lane(r).kind === 'descanso' && w.lane(r + 1).kind === 'descanso')) continue;
        found.add(biome);
        const sim = new AtravessaSim(seed, w);
        sim.row = r;
        sim.best = r;
        sim.hx = w.corridorAt(r);
        for (let i = 0; i < ATR_SWEEP_IDLE_TICKS + 10; i++) sim.step();
        const sw = sim.view().sweep;
        if (sw) kinds.add(sw.kind);
      }
    }
    expect(kinds.has('barril')).toBe(true);
    expect(kinds.has('laser')).toBe(true);
    expect(kinds.has('feno') || kinds.has('redemoinho')).toBe(true);
    // no começo ninguém é varrido
    const early = new AtravessaSim(ANY);
    for (let i = 0; i < 300; i++) early.step();
    expect(early.view().sweep).toBeNull();
  });
});

/**
 * Procura, por busca em largura (de 6 em 6 ticks), uma sequência de passos que leve o herói até a
 * linha `target` sem morrer. Se existe, o mundo é passável: sempre há caminho.
 */
function canReach(seed: string, target: number, maxTicks: number): { ok: boolean; best: number; tick: number } {
  // quem fica parado 6 s sai da busca (sem a escuridão, os estados parados nunca morreriam)
  let frontier: AtravessaSim[] = [new AtravessaSim(seed, undefined, { idleKillTicks: 360 })];
  let best = 0;
  for (let tick = 0; tick < maxTicks && frontier.length; tick += 6) {
    const next = new Map<string, AtravessaSim>();
    for (const s of frontier) {
      for (const act of [null, 0, 2, 3] as (Dir | null)[]) {
        const c = s.clone();
        if (act !== null) c.input(act);
        for (let i = 0; i < 6 && c.alive; i++) c.step();
        if (!c.alive) continue;
        if (c.score > best) best = c.score;
        if (c.score >= target) return { ok: true, best, tick: c.tick };
        const v = c.view();
        next.set(`${c.row}|${c.hx.toFixed(1)}|${v.step ? v.step.dir + v.step.progress.toFixed(2) : "-"}|${v.queued}|${c.best}`, c);
      }
    }
    frontier = [...next.values()];
    // basta um caminho, não todos: segue um punhado de estados por linha (os mais avançados primeiro).
    // Cortar só pelos mais avançados mataria quem espera parado, que é justamente quem sobrevive.
    if (frontier.length > 900) {
      const perRow = new Map<number, number>();
      frontier = frontier
        .sort((x, y) => y.best - x.best || y.row - x.row)
        .filter((c) => {
          const n = (perRow.get(c.row) ?? 0) + 1;
          perRow.set(c.row, n);
          return n <= 70;
        })
        .slice(0, 900);
    }
  }
  return { ok: false, best, tick: maxTicks };
}

describe("jogabilidade", () => {
  it("existe sempre um caminho: dá para chegar à linha 30 em todas as sementes testadas", () => {
    for (const s of SEEDS.slice(0, 4)) {
      const r = canReach(s, 30, 60 * 60);
      expect(r, `semente ${s}`).toMatchObject({ ok: true });
    }
  }, 120_000);

  it("e mais longe (linha 70), passando por trem, rio e as primeiras ambulâncias", () => {
    for (const s of SEEDS.slice(6, 8)) {
      const r = canReach(s, 70, 60 * 120);
      expect(r, `semente ${s}`).toMatchObject({ ok: true });
    }
  }, 300_000);
});

describe('servidor', () => {
  it('sem escuridão, quem não faz nada na largada não morre: a partida só acaba no limite de tempo', () => {
    expect(evaluateAtravessa(ANY, [], 600)).toMatchObject({ score: 0, end: null, ticks: 600 });
    expect(evaluateAtravessa(ANY, [], 600)).toEqual(evaluateAtravessa(ANY, [], 600));
  });

  it('uma partida que termina em morte tem sempre a mesma nota e o mesmo fim', () => {
    const inputs: AtravessaInput[] = [];
    for (let t = 1; t < 60 * 20; t += 14) inputs.push({ t, d: 0 });
    const a = evaluateAtravessa(ANY, inputs);
    expect(a.end).not.toBeNull();
    expect(evaluateAtravessa(ANY, inputs)).toEqual(a);
  });

  it('o servidor reproduz a partida de um robô, varridas e tráfego incluídos', () => {
    const seed = SEEDS[3]!;
    const live = new AtravessaSim(seed);
    const inputs: AtravessaInput[] = [];
    // um jogador simples: vai para a frente a cada 14 ticks e deixa o resto com a sorte
    while (live.alive && live.tick < 60 * 40) {
      if (live.tick % 14 === 0) {
        inputs.push({ t: live.tick + 1, d: 0 });
        live.input(0);
      }
      live.step();
    }
    // sem escuridão o herói pode estar vivo aos 40 s: o servidor refaz até o mesmo instante
    const r = evaluateAtravessa(seed, inputs, live.tick);
    expect(r).toMatchObject({ score: live.score, end: live.end, ticks: live.tick });
  });

  it('valida a lista de passos', () => {
    expect(validateAtravessaInputs([{ t: 1, d: 0 }, { t: 5, d: 3 }])).toBe(true);
    expect(validateAtravessaInputs([{ t: 5, d: 0 }, { t: 1, d: 0 }])).toBe(false);
    expect(validateAtravessaInputs([{ t: 0, d: 0 }])).toBe(false);
    expect(validateAtravessaInputs([{ t: 1, d: 4 }])).toBe(false);
    expect(validateAtravessaInputs([{ t: 1.5, d: 0 }])).toBe(false);
    expect(validateAtravessaInputs('x')).toBe(false);
  });
});
