import { describe, expect, it } from 'vitest';
import {
  ATR_BIOME_LEN,
  ATR_COLS,
  ATR_CYCLE_LEN,
  ATR_DARK_CAP,
  ATR_DARK_MAX_GAP,
  ATR_DT,
  ATR_MIN_LOG_GAP,
  ATR_MIN_VEHICLE_GAP,
  ATR_STEP_TICKS,
  ATR_TRAIN_WARN_TICKS,
  AtravessaSim,
  AtravessaWorld,
  biomeAt,
  atravessaDarkSpeed,
  difficultyAt,
  evaluateAtravessa,
  laneObjects,
  trainState,
  validateAtravessaInputs,
  type AtravessaInput,
  type Dir,
  type Lane,
} from './index';

const SEEDS = Array.from({ length: 10 }, (_, i) => `semente-${i}`);
const ROWS = 400;

function findLane(w: AtravessaWorld, kind: Lane['kind'], pred: (l: Lane) => boolean = () => true): Lane {
  for (let r = 3; r < 600; r++) {
    const l = w.lane(r);
    if (l.kind === kind && pred(l)) return l;
  }
  throw new Error(`sem faixa ${kind}`);
}

describe('biomas', () => {
  it('começam na horta, passam por transições de 6 linhas e dão a volta', () => {
    expect(biomeAt(0).biome).toBe('horta');
    expect(biomeAt(ATR_BIOME_LEN - 1)).toMatchObject({ biome: 'horta', blend: 0 });
    const t = biomeAt(ATR_BIOME_LEN);
    expect(t).toMatchObject({ biome: 'horta', next: 'deserto' });
    expect(t.blend).toBeGreaterThan(0);
    expect(biomeAt(86).biome).toBe('deserto');
    expect(biomeAt(176).biome).toBe('neon');
    expect(biomeAt(ATR_CYCLE_LEN)).toMatchObject({ biome: 'horta', cycle: 1 });
  });

  it('a dificuldade sobe e as 15 primeiras linhas são fáceis', () => {
    expect(difficultyAt(15)).toBe(0);
    expect(difficultyAt(200)).toBeGreaterThan(difficultyAt(100));
    expect(difficultyAt(10_000)).toBe(1);
  });
});

describe('geração', () => {
  it('é determinística e não depende da ordem em que as faixas são pedidas', () => {
    const a = new AtravessaWorld('x');
    const b = new AtravessaWorld('x');
    b.lane(50);
    for (let r = 0; r < 60; r++) expect(a.lane(r)).toEqual(b.lane(r));
    expect(new AtravessaWorld('y').lane(20)).not.toEqual(a.lane(20));
  });

  it('as 3 primeiras faixas são descanso livre', () => {
    for (const s of SEEDS) {
      const w = new AtravessaWorld(s);
      for (let r = 0; r < 3; r++) expect(w.lane(r)).toMatchObject({ kind: 'descanso', blocked: [] });
    }
  });

  it('sempre existe caminho: corredor livre, vãos mínimos e limites de rio e estrada', () => {
    for (const s of SEEDS) {
      const w = new AtravessaWorld(s);
      let rios = 0;
      let estradas = 0;
      for (let r = 0; r < ROWS; r++) {
        const l = w.lane(r);
        const prev = r > 0 ? w.lane(r - 1) : null;
        rios = l.kind === 'rio' ? rios + 1 : 0;
        estradas = l.kind === 'estrada' ? estradas + 1 : 0;
        expect(rios).toBeLessThanOrEqual(3);
        expect(estradas).toBeLessThanOrEqual(4);
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
        if (l.kind === 'estrada') {
          const o = [...l.objs].sort((p, q) => p.x0 - q.x0);
          for (let i = 0; i < o.length; i++) {
            const n = o[(i + 1) % o.length]!;
            const p = o[i]!;
            let d = n.x0 - p.x0;
            if (d <= 0) d += l.loop;
            if (o.length > 1) expect(d - (p.len + n.len) / 2).toBeGreaterThanOrEqual(ATR_MIN_VEHICLE_GAP);
          }
        }
        if (l.kind === 'rio' && !l.pads) {
          const o = [...l.objs].sort((p, q) => p.x0 - q.x0);
          for (let i = 0; i < o.length; i++) {
            const n = o[(i + 1) % o.length]!;
            const p = o[i]!;
            let d = n.x0 - p.x0;
            if (d <= 0) d += l.loop;
            expect(d - (p.len + n.len) / 2).toBeGreaterThanOrEqual(ATR_MIN_LOG_GAP - 1e-9);
          }
        }
      }
    }
  });

  it('cada bioma usa suas faixas: trilho só no deserto', () => {
    for (const s of SEEDS) {
      const w = new AtravessaWorld(s);
      for (let r = 0; r < ATR_CYCLE_LEN; r++) {
        const l = w.lane(r);
        if (l.kind === 'trilho') expect(l.biome.biome === 'deserto' || l.biome.next === 'deserto').toBe(true);
      }
    }
  });

  it('o trem avisa 1,2 s antes de passar', () => {
    const w = new AtravessaWorld('trem');
    const l = findLane(w, 'trilho');
    let warnTicks = 0;
    let sawTrain = false;
    let passing = false;
    for (let t = 0; t < l.train!.period * 3; t++) {
      const st = trainState(l, t);
      if (st.warning) warnTicks++;
      const now = st.x !== null;
      // o primeiro trem pode já estar passando (a fase da faixa é sorteada): só vale quem teve aviso
      if (now && !passing && warnTicks > 0) {
        expect(warnTicks).toBeGreaterThanOrEqual(ATR_TRAIN_WARN_TICKS);
        sawTrain = true;
      }
      if (now) warnTicks = 0;
      passing = now;
    }
    expect(sawTrain).toBe(true);
  });
});

describe('simulação', () => {
  const advance = (sim: AtravessaSim, n: number) => {
    for (let i = 0; i < n; i++) sim.step();
  };

  it('um passo para a frente leva 12 ticks, com arco de pulo e pouso', () => {
    const sim = new AtravessaSim('a');
    sim.input(0);
    advance(sim, 1);
    expect(sim.view().step).toMatchObject({ dir: 0 });
    advance(sim, ATR_STEP_TICKS / 2 - 1);
    const mid = sim.view();
    expect(mid.hop).toBeCloseTo(0.45, 1);
    expect(mid.y).toBeCloseTo(0.5, 1);
    advance(sim, ATR_STEP_TICKS / 2);
    const end = sim.view();
    expect(end).toMatchObject({ step: null, score: 1, hop: 0 });
    expect(end.y).toBe(1);
    expect(end.landed).toMatchObject({ age: 0, dir: 0 });
    advance(sim, 3);
    expect(sim.view().landed!.age).toBe(3);
  });

  it('voltar e andar de lado não mudam a nota; só a maior linha conta', () => {
    const sim = new AtravessaSim('a');
    for (const d of [0, 0, 1, 2, 3] as Dir[]) {
      sim.input(d);
      advance(sim, ATR_STEP_TICKS + 1);
    }
    expect(sim.score).toBe(2);
    expect(sim.row).toBe(1);
  });

  it('a fila guarda no máximo 2 passos além do atual', () => {
    const sim = new AtravessaSim('a');
    for (let i = 0; i < 6; i++) sim.input(0);
    advance(sim, 1);
    expect(sim.view().queued).toBe(1);
    advance(sim, ATR_STEP_TICKS * 4);
    expect(sim.score).toBe(2);
  });

  it('não sai pelos lados nem volta antes da largada', () => {
    const sim = new AtravessaSim('a');
    sim.input(1);
    advance(sim, ATR_STEP_TICKS + 1);
    expect(sim.row).toBe(0);
    for (let i = 0; i < 6; i++) {
      sim.input(2);
      advance(sim, ATR_STEP_TICKS + 1);
    }
    expect(sim.hx).toBe(-4);
  });

  it('casa bloqueada recusa o passo sem gastar tempo', () => {
    const w = new AtravessaWorld('arv');
    let r = 3;
    while (!(w.lane(r).kind === 'descanso' && w.lane(r).blocked.length && w.lane(r - 1).kind === 'descanso')) r++;
    const col = w.lane(r).blocked[0]!;
    const sim = new AtravessaSim('arv', w);
    sim.row = r - 1;
    sim.best = r - 1;
    sim.dark = r - 20;
    sim.hx = col;
    sim.input(0);
    advance(sim, 1);
    expect(sim.view().step).toBeNull();
    expect(sim.row).toBe(r - 1);
  });

  it('veículo mata', () => {
    const w = new AtravessaWorld('carro');
    const lane = findLane(w, 'estrada');
    const sim = new AtravessaSim('carro', w);
    sim.row = lane.row;
    sim.dark = lane.row - 20;
    const o = lane.objs[0]!;
    sim.hx = Math.round(objX0(lane, o, 1));
    advance(sim, 1);
    expect(sim.alive).toBe(false);
    expect(sim.end).toBe('veiculo');
  });

  it('a tora carrega o herói e, passando da borda, ele é arrastado', () => {
    const w = new AtravessaWorld('tora');
    const lane = findLane(w, 'rio', (l) => !l.pads);
    const sim = new AtravessaSim('tora', w);
    sim.row = lane.row;
    sim.best = lane.row;
    sim.dark = lane.row - 20;
    sim.hx = 0;
    const x0 = sim.hx;
    advance(sim, 30);
    expect(Math.sign(sim.hx - x0)).toBe(lane.dir);
    advance(sim, 60 * 60);
    expect(sim.end).toBe('arrastado');
  });

  it('pousar na água afoga', () => {
    const w = new AtravessaWorld('agua');
    const lane = findLane(w, 'rio', (l) => !!l.pads);
    const bad = [-4, -3, -2, -1, 0, 1, 2, 3, 4].find((c) => !lane.pads!.some((p) => p.col === c))!;
    const sim = new AtravessaSim('agua', w);
    sim.row = lane.row - 1;
    sim.best = lane.row - 1;
    sim.dark = lane.row - 20;
    sim.hx = bad;
    sim.input(0);
    advance(sim, ATR_STEP_TICKS + 1);
    expect(sim.end).toBe('agua');
  });

  it('parado, a escuridão alcança; ela nunca passa do teto de velocidade nem fica mais longe que o limite', () => {
    const sim = new AtravessaSim('parado');
    let prev = sim.dark;
    while (sim.alive && sim.tick < 60 * 120) {
      sim.step();
      expect((sim.dark - prev) / ATR_DT).toBeLessThanOrEqual(ATR_DARK_CAP + 1e-6);
      prev = sim.dark;
    }
    expect(sim.end).toBe('escuridao');
    expect(atravessaDarkSpeed(100_000)).toBe(ATR_DARK_CAP);
    const run = new AtravessaSim('corre');
    run.best = 50;
    run.row = 50;
    run.hx = 0;
    run.step();
    expect(run.row - run.dark).toBeLessThanOrEqual(ATR_DARK_MAX_GAP + 1e-9);
  });

  it('o perigo da escuridão sobe de forma contínua, de 0 a 1', () => {
    const sim = new AtravessaSim('perigo');
    sim.best = 20;
    sim.row = 20;
    sim.dark = 20 - ATR_DARK_MAX_GAP;
    expect(sim.view().danger).toBe(0);
    sim.dark = 20 - 4;
    const mid = sim.view().danger;
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
    sim.dark = 20 - 0.7;
    expect(sim.view().danger).toBeGreaterThan(0.9);
  });
});

function objX0(lane: Lane, o: Lane['objs'][number], tick: number) {
  return laneObjects(lane, tick).find((x) => x.len === o.len)!.x;
}

/** Um jogador que procura a casa livre da próxima faixa e só pula quando sobrevive aos próximos 18 ticks. */
function bot(seed: string, maxTicks: number): number {
  const sim = new AtravessaSim(seed);
  let goal: number | null = null;
  const survives = (s: AtravessaSim, n: number) => {
    for (let i = 0; i < n && s.alive; i++) s.step();
    return s.alive;
  };
  while (sim.alive && sim.tick < maxTicks) {
    const next = sim.world.lane(sim.row + 1);
    const logs = (l: Lane) => l.kind === 'rio' && !l.pads;
    // antes de entrar num rio de toras, alinha com a coluna livre da faixa que vem depois dele
    let target = next;
    if (logs(next) && !logs(sim.world.lane(sim.row))) {
      let j = sim.row + 1;
      while (logs(sim.world.lane(j))) j++;
      target = sim.world.lane(j);
    }
    const free = (c: number) =>
      target.kind === 'descanso' ? !target.blocked.includes(c) : target.pads ? target.pads.some((p) => p.col === c) : true;
    const here = Math.round(sim.hx);
    const cur = sim.world.lane(sim.row);
    const open = (c: number) =>
      Math.abs(c) <= 4 &&
      !(cur.kind === "descanso" && cur.blocked.includes(c)) &&
      !(cur.pads && !cur.pads.some((p) => p.col === c));
    // encurralado: volta uma faixa e vai para o corredor livre antes de tentar de novo
    if (goal !== null && here === goal) goal = null;
    let want: Dir | null = null;
    if (goal !== null) {
      const dirStep = goal < here ? 2 : 3;
      want = open(here + (goal < here ? -1 : 1)) ? dirStep : 1;
    } else if (free(here) || logs(sim.world.lane(sim.row))) want = 0;
    else {
      let leftOk = true;
      let rightOk = true;
      for (let k = 1; k <= 8 && want === null; k++) {
        leftOk = leftOk && open(here - k);
        rightOk = rightOk && open(here + k);
        if (leftOk && free(here - k)) want = 2;
        else if (rightOk && free(here + k)) want = 3;
      }
      if (want === null) {
        goal = sim.world.corridorAt(sim.row + 1);
        want = 1;
      }
    }
    // escolhe a primeira ação que sobrevive; se nenhuma, a que dura mais (esquivar também vale)
    const options: (Dir | null)[] = [want, null, 2, 3, 1];
    let pick: Dir | null | undefined;
    let bestLife = -1;
    for (const o of options) {
      if (o === undefined) continue;
      if (o === want && want === null) continue;
      const c = sim.clone();
      if (o !== null) c.input(o);
      let life = 0;
      while (life < 24 && c.alive) {
        c.step();
        life++;
      }
      if (life > bestLife) {
        bestLife = life;
        pick = o;
      }
      if (life >= 24) break;
    }
    if (pick !== null && pick !== undefined) {
      sim.input(pick);
      for (let i = 0; i < 12 && sim.alive; i++) sim.step();
      continue;
    }
    sim.step();
  }
  return sim.score;
}

describe('jogabilidade', () => {
  it('um jogador cuidadoso passa de 80 linhas em todas as sementes (sempre há passagem)', () => {
    for (const s of SEEDS.slice(0, 5)) expect(bot(s, 60 * 240)).toBeGreaterThanOrEqual(80);
  });
});

describe('servidor', () => {
  it('refaz a partida pelos passos e calcula a mesma nota', () => {
    const inputs: AtravessaInput[] = [];
    const sim = new AtravessaSim('refaz');
    for (let n = 0; n < 2; n++) {
      inputs.push({ t: sim.tick + 1, d: 0 });
      sim.input(0);
      for (let i = 0; i < 12; i++) sim.step();
    }
    const r = evaluateAtravessa('refaz', inputs);
    expect(r.score).toBe(sim.score);
    expect(r.end).toBe('escuridao');
    expect(evaluateAtravessa('refaz', inputs)).toEqual(r);
    expect(evaluateAtravessa('refaz', [])).toMatchObject({ score: 0, end: 'escuridao' });
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
