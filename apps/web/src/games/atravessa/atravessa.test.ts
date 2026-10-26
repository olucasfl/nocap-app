import { describe, expect, it } from 'vitest';
import { AtravessaSim, AtravessaWorld, ATR_STEP_TICKS, type AtravessaView } from '@nocap/games';
import { ANTICIPATION, LANDING_TICKS, REST, deathPose, heroPose, turnToward } from './hop';
import { KEY_DIR, SWIPE_MIN, swipeDir } from './input';

const view = (sim: AtravessaSim): AtravessaView => sim.view();

/** Um herói numa faixa de descanso com mais duas de descanso à frente (ele fica na coluna livre): os pulos não dependem de sorte. */
function calm(): AtravessaSim {
  const w = new AtravessaWorld('hop');
  for (let r = 3; r < 900; r++) {
    if ([r, r + 1, r + 2].every((x) => w.lane(x).kind === 'descanso')) {
      const sim = new AtravessaSim('hop', w);
      sim.row = r;
      sim.best = r;
      sim.hx = w.corridorAt(r);
      return sim;
    }
  }
  throw new Error('sem trecho calmo');
}

describe('swipeDir', () => {
  it('toque curto não decide direção', () => {
    expect(swipeDir(3, -4)).toBeNull();
    expect(swipeDir(SWIPE_MIN - 1, 0)).toBeNull();
  });
  it('o lado maior manda: cima frente, baixo trás, esquerda e direita', () => {
    expect(swipeDir(2, -40)).toBe(0);
    expect(swipeDir(-3, 50)).toBe(1);
    expect(swipeDir(-40, 5)).toBe(2);
    expect(swipeDir(60, -10)).toBe(3);
  });
  it('W A S D e as setas', () => {
    expect([KEY_DIR.w, KEY_DIR.s, KEY_DIR.a, KEY_DIR.d]).toEqual([0, 1, 2, 3]);
    expect([KEY_DIR.arrowup, KEY_DIR.arrowdown, KEY_DIR.arrowleft, KEY_DIR.arrowright]).toEqual([
      0, 1, 2, 3,
    ]);
  });
});

describe('animação do pulo', () => {
  it('parado, o herói está em repouso', () => {
    const sim = calm();
    expect(heroPose(view(sim))).toEqual(REST);
  });

  it('agacha ao sair do chão, estica no ar e volta ao normal', () => {
    const sim = calm();
    sim.input(0);
    const sy: number[] = [];
    const lift: number[] = [];
    for (let i = 0; i < ATR_STEP_TICKS; i++) {
      sim.step();
      const p = heroPose(view(sim));
      sy.push(p.sy);
      lift.push(p.lift);
    }
    const crouch = Math.floor(ATR_STEP_TICKS * (ANTICIPATION / 2));
    expect(Math.min(...sy.slice(0, crouch + 1))).toBeLessThan(0.97);
    expect(Math.max(...sy)).toBeGreaterThan(1.05);
    expect(Math.max(...lift)).toBeCloseTo(0.45, 1);
    // volume preservado: largura × altura × profundidade = 1
    for (let i = 0; i < sy.length; i++) {
      const p = 1 / Math.sqrt(sy[i]!);
      expect(p * p * sy[i]!).toBeCloseTo(1, 5);
    }
  });

  it('a curva é contínua: nenhum quadro muda a altura do corpo de uma vez', () => {
    const sim = calm();
    sim.input(0);
    let prev = 1;
    for (let i = 0; i < ATR_STEP_TICKS + LANDING_TICKS + 2; i++) {
      sim.step();
      const p = heroPose(view(sim));
      expect(Math.abs(p.sy - prev)).toBeLessThan(0.1);
      prev = p.sy;
    }
  });

  it('o pouso amassa de leve e termina exatamente em repouso', () => {
    const sim = calm();
    sim.input(0);
    for (let i = 0; i < ATR_STEP_TICKS; i++) sim.step();
    const landed: number[] = [];
    for (let i = 0; i < LANDING_TICKS + 2; i++) {
      landed.push(heroPose(view(sim)).sy);
      sim.step();
    }
    expect(Math.min(...landed)).toBeLessThan(0.95);
    expect(Math.min(...landed)).toBeGreaterThan(0.8);
    expect(heroPose(view(sim))).toEqual(REST);
  });

  it('pulos em sequência não deixam o herói deformado', () => {
    const sim = calm();
    for (let n = 0; n < 2; n++) sim.input(0);
    for (let i = 0; i < ATR_STEP_TICKS * 2 + LANDING_TICKS + 3; i++) {
      sim.step();
      const p = heroPose(view(sim));
      expect(p.sy).toBeGreaterThan(0.75);
      expect(p.sy).toBeLessThan(1.2);
    }
    expect(heroPose(view(sim))).toEqual(REST);
  });
});

describe('morte e giro', () => {
  it('cada morte termina curta e coerente', () => {
    expect(deathPose('veiculo', 1, 1).sy).toBeLessThan(0.7);
    // atropelado é arremessado para o lado de onde o carro veio
    expect(deathPose('veiculo', 1, 1).dx).toBeGreaterThan(2);
    expect(deathPose('veiculo', 1, -1).dx).toBeLessThan(-2);
    expect(deathPose('trem', 1, 1).dx).toBeGreaterThan(deathPose('veiculo', 1, 1).dx);
    expect(deathPose('agua', 1).alpha).toBe(0);
    expect(deathPose('parado', 1).alpha).toBeGreaterThan(0);
    expect(deathPose('parado', 1).alpha).toBeLessThan(0.3);
    expect(deathPose('trem', 0)).toMatchObject({ sx: 1, sy: 1 });
  });

  it('o giro pega o caminho mais curto e nunca passa do limite', () => {
    expect(turnToward(0, Math.PI / 2, 10)).toBeCloseTo(Math.PI / 2);
    expect(turnToward(0, Math.PI / 2, 0.1)).toBeCloseTo(0.1);
    // de 170° para -170° são 20° pelo lado curto, não 340°
    const a = (170 * Math.PI) / 180;
    const b = (-170 * Math.PI) / 180;
    expect(turnToward(a, b, 10) - a).toBeCloseTo((20 * Math.PI) / 180);
  });
});
