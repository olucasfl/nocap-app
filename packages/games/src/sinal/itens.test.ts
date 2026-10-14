import { describe, expect, it } from 'vitest';
import {
  IMPULSO_FACTOR,
  ITEM_USE,
  MAX_SPEED,
  SOMBRA_TICKS,
  CoverField,
  ItemField,
  ObstacleField,
  SinalSim,
  WidthField,
  evaluateSinal,
  infinitoCourse,
  isSolid,
  validateSinalInputs,
  type SinalEvent,
} from './index';

const SEEDS = Array.from({ length: 12 }, (_, i) => `semente-${i}`);

/** Anda até aparecer um item perto e põe o boneco em cima dele. */
function atItem(seed: string, kind?: 'sombra' | 'impulso') {
  const sim = new SinalSim(seed, 'infinito');
  for (let i = 0; i < 60 * 5; i++) sim.step(0, 100);
  for (let i = 0; i < 60 * 3; i++) {
    const it = sim.view.items.find((q) => !kind || q.kind === kind);
    if (it) return { sim, it };
    sim.x = 0;
    sim.y += 15;
    sim.step(0, 0);
  }
  return null;
}

describe('itens do jogador', () => {
  const field = (seed: string, to: number) => {
    const course = infinitoCourse(seed);
    const width = new WidthField(course, `${seed}:w`);
    const obstacles = new ObstacleField(course, `${seed}:o`, new CoverField(course, `${seed}:c`, width), width);
    const f = new ItemField(`${seed}:i`, width, obstacles);
    f.ensure(to);
    return { f, obstacles, width };
  };

  it('são determinísticos, espaçados, dentro do corredor e nunca dentro de um obstáculo', () => {
    for (const seed of SEEDS) {
      const { f, obstacles, width } = field(seed, 900);
      expect(f.list.length).toBeGreaterThan(5);
      expect(f.list[0]!.y).toBeGreaterThanOrEqual(22);
      for (let i = 0; i < f.list.length; i++) {
        const it = f.list[i]!;
        expect(Math.abs(it.x)).toBeLessThanOrEqual(width.halfAt(it.y));
        if (i) expect(it.y - f.list[i - 1]!.y).toBeGreaterThanOrEqual(58 - 1e-9);
        for (const o of obstacles.list) {
          if (!isSolid(o.kind)) continue;
          expect(Math.hypot(o.x - it.x, o.y - it.y)).toBeGreaterThan(o.r + 0.8);
        }
      }
      expect(field(seed, 900).f.list).toEqual(f.list);
    }
    const kinds = new Set(SEEDS.flatMap((s) => field(s, 900).f.list.map((q) => q.kind)));
    expect(kinds).toEqual(new Set(['sombra', 'impulso']));
  });

  it('passar por cima pega o item (um por vez) e a sala não usa itens', () => {
    const got = atItem('semente-1');
    expect(got).not.toBeNull();
    const { sim, it } = got!;
    sim.x = it.x;
    sim.y = it.y;
    const ev = sim.step(0, 0);
    expect(ev.some((e) => e.kind === 'item' && e.item === it.kind)).toBe(true);
    expect(sim.held).toBe(it.kind);
    // com um item na mão, o próximo do chão fica onde está
    const other = sim.view.items.find((q) => q.id !== it.id);
    if (other) {
      sim.x = other.x;
      sim.y = other.y;
      sim.step(0, 0);
      expect(sim.held).toBe(it.kind);
    }
    const room = new SinalSim('semente-1', 'classico');
    room.itemsEnabled = false;
    expect(room.view.items).toHaveLength(0);
  });

  it('a Sombra esconde em qualquer lugar por 2 s e protege do Vigia', () => {
    const sim = new SinalSim('sombra', 'infinito');
    sim.held = 'sombra';
    const ev = sim.step(0, 0, true);
    expect(ev.some((e) => e.kind === 'usou' && e.item === 'sombra')).toBe(true);
    expect(sim.isHidden).toBe(true);
    expect(sim.held).toBeNull();
    const events: SinalEvent[] = [];
    let ticks = 0;
    // anda o tempo todo, mesmo com o Vigia olhando: escondido, não perde
    while (sim.isHidden && ticks < 400) {
      events.push(...sim.step(0, 100));
      ticks++;
    }
    expect(ticks).toBeGreaterThanOrEqual(SOMBRA_TICKS - 2);
    expect(ticks).toBeLessThanOrEqual(SOMBRA_TICKS + 2);
    expect(events.some((e) => e.kind === 'item-fim' && e.item === 'sombra')).toBe(true);
  });

  it('o Impulso deixa 1,6x mais rápido por 2 s e depois volta ao normal', () => {
    const sim = new SinalSim('impulso', 'infinito');
    sim.held = 'impulso';
    sim.step(0, 0, true);
    const y0 = sim.y;
    for (let i = 0; i < 30; i++) sim.step(0, 100);
    expect((sim.y - y0) / 0.5).toBeCloseTo(MAX_SPEED * IMPULSO_FACTOR, 1);
    for (let i = 0; i < 100; i++) sim.step(0, 100);
    const y1 = sim.y;
    for (let i = 0; i < 30; i++) sim.step(0, 100);
    expect((sim.y - y1) / 0.5).toBeCloseTo(MAX_SPEED, 1);
  });

  it('sem item na mão, usar não faz nada', () => {
    const sim = new SinalSim('nada', 'infinito');
    const ev = sim.step(0, 0, true);
    expect(ev.some((e) => e.kind === 'usou')).toBe(false);
  });

  it('o servidor refaz a corrida com o uso do item gravado nos movimentos', () => {
    let used = 0;
    for (const seed of SEEDS) {
      const sim = new SinalSim(seed, 'infinito');
      const inputs: { tick: number; x: number; y: number }[] = [];
      let last = '';
      for (let i = 0; i < 60 * 50 && !sim.dead; i++) {
        const v = sim.view;
        const stop = v.t >= v.cycle.avisoStart - 0.02 && v.t < v.cycle.lookEnd + 0.01;
        const it = v.items[0];
        const ax = stop ? 0 : it ? Math.round(Math.max(-100, Math.min(100, (it.x - v.x) * 60))) : 0;
        const ay = stop ? 0 : 100;
        const key = `${ax},${ay}`;
        if (key !== last) {
          inputs.push({ tick: i, x: ax, y: ay });
          last = key;
        }
        const use = sim.held !== null;
        if (use) {
          inputs.push({ tick: i, x: ITEM_USE, y: 0 });
          used++;
        }
        sim.step(ax, ay, use);
      }
      expect(validateSinalInputs(inputs)).toBeNull();
      expect(evaluateSinal(seed, 'infinito', inputs, sim.tick)).toEqual(sim.result);
    }
    expect(used).toBeGreaterThan(3);
  });

  it('valida o uso do item: pode dividir o instante com o analógico, dois movimentos não', () => {
    expect(
      validateSinalInputs([
        { tick: 10, x: 50, y: 50 },
        { tick: 10, x: ITEM_USE, y: 0 },
        { tick: 20, x: 0, y: 0 },
      ]),
    ).toBeNull();
    expect(
      validateSinalInputs([
        { tick: 10, x: ITEM_USE, y: 0 },
        { tick: 10, x: 5, y: 5 },
      ]),
    ).toBeNull();
    expect(
      validateSinalInputs([
        { tick: 10, x: 50, y: 50 },
        { tick: 10, x: 5, y: 5 },
      ]),
    ).toMatch(/ordem/);
    expect(validateSinalInputs([{ tick: 1, x: 126, y: 0 }])).toMatch(/faixa/);
    expect(validateSinalInputs([{ tick: 1, x: ITEM_USE, y: 5 }])).toMatch(/faixa/);
  });

  it('na sala entram os itens que atrapalham, nas mesmas posições do solo', () => {
    const course = infinitoCourse('sala');
    const build = (online: boolean) => {
      const width = new WidthField(course, 'sala:w');
      const obstacles = new ObstacleField(course, 'sala:o', new CoverField(course, 'sala:c', width), width);
      const f = new ItemField('sala:i', width, obstacles, online);
      f.ensure(1500);
      return f.list;
    };
    const solo = build(false);
    const online = build(true);
    expect(online.map((i) => [i.x, i.y])).toEqual(solo.map((i) => [i.x, i.y]));
    expect(new Set(solo.map((i) => i.kind))).toEqual(new Set(['sombra', 'impulso']));
    expect(new Set(online.map((i) => i.kind))).toEqual(new Set(['sombra', 'impulso', 'escorregao', 'peso', 'atordoar']));
  });

  it('um poder recebido bate depois do aviso: Atordoar atordoa, Peso e Escorregão duram e acabam', () => {
    const run = (item: 'atordoar' | 'peso' | 'escorregao') => {
      const sim = new SinalSim('recebe', 'infinito', 1, true);
      sim.receive(item, 48);
      const evs: SinalEvent[] = [];
      for (let i = 0; i < 30; i++) evs.push(...sim.step(0, 0));
      expect(sim.view.incoming).toHaveLength(1);
      expect(evs.some((e) => e.kind === 'sofreu')).toBe(false);
      for (let i = 0; i < 30; i++) evs.push(...sim.step(0, 0));
      return { sim, evs };
    };
    const a = run('atordoar');
    expect(a.evs.some((e) => e.kind === 'sofreu' && e.item === 'atordoar')).toBe(true);
    expect(a.sim.isStunned).toBe(true);
    const p = run('peso');
    expect(p.sim.view.debuff?.item).toBe('peso');
    const y0 = p.sim.y;
    for (let i = 0; i < 30; i++) p.sim.step(0, 100);
    expect((p.sim.y - y0) / 0.5).toBeLessThan(MAX_SPEED * 0.7);
    const e = run('escorregao');
    expect(e.sim.view.debuff?.item).toBe('escorregao');
    for (let i = 0; i < 160; i++) e.sim.step(0, 0);
    expect(e.sim.view.debuff).toBeNull();
  });

  it('quem está escondido (Sombra) não sofre o poder', () => {
    const sim = new SinalSim('recebe2', 'infinito', 1, true);
    sim.held = 'sombra';
    sim.step(0, 0, true);
    sim.receive('atordoar', 10);
    const evs: SinalEvent[] = [];
    for (let i = 0; i < 20; i++) evs.push(...sim.step(0, 0));
    expect(evs.some((e) => e.kind === 'defendeu')).toBe(true);
    expect(evs.some((e) => e.kind === 'sofreu')).toBe(false);
    expect(sim.isStunned).toBe(false);
  });
});
