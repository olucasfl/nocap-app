import { PLAYER_R, PUSH_COOLDOWN_MS, PUSH_RANGE, SINAL_COLORS, type SinalSim } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { RoomError } from './color-room.engine';
import {
  SINAL_COUNTDOWN_MS,
  SINAL_FINISH_DELAY_MS,
  SinalRoomEngine,
} from './sinal-room.engine';

interface Racer {
  sim: SinalSim;
  input: [number, number];
}
const racersOf = (e: SinalRoomEngine) =>
  (e as unknown as { racers: Map<string, Racer> }).racers;
interface SinalSnap {
  colors: Record<string, string>;
  players: { id: string; x: number; y: number; dead: boolean; hidden: boolean; meters: number }[];
  target: string | null;
  view: {
    t: number;
    vigia: string;
    powers: unknown[];
    obstacles: { id: number }[];
  };
  push: { target: string | null; readyAt: number; range: number } | null;
}
const sinalOf = (e: SinalRoomEngine, viewer: string) =>
  (e.snapshot(viewer) as unknown as { sinal: SinalSnap }).sinal;

function setup(names = ['ana', 'beto']) {
  let clock = 1_000_000;
  const engine = new SinalRoomEngine({
    code: 'ABCD',
    now: () => clock,
    newSeed: () => 'seed-sinal',
  });
  names.forEach((n) => engine.join(n, n));
  return {
    engine,
    advance: (ms: number) => {
      // roda em passos de ~17 ms, como o relógio da sala
      for (let left = ms; left > 0; left -= 17) {
        clock += Math.min(17, left);
        engine.tick();
      }
    },
    now: () => clock,
  };
}

/** Todo mundo pronto, começa e passa da contagem: a corrida está valendo. */
function race(names = ['ana', 'beto']) {
  const ctx = setup(names);
  for (const n of names.slice(1)) ctx.engine.setReady(n, true);
  ctx.engine.start(names[0]!);
  ctx.advance(SINAL_COUNTDOWN_MS + 20);
  // a escuridão (uma só, da sala) fora do caminho: aqui só importam o Vigia, os empurrões e o resto
  (ctx.engine as unknown as { dark: number }).dark = -1e7;
  return ctx;
}

describe('SinalRoomEngine: lobby e cores', () => {
  it('é o jogo sinal, só com o modo infinito, e cada pessoa nasce com uma cor diferente', () => {
    const { engine } = setup(['ana', 'beto', 'caio']);
    expect(engine.game).toBe('sinal');
    const colors = sinalOf(engine, 'ana').colors;
    expect(new Set(Object.values(colors)).size).toBe(3);
    for (const hex of Object.values(colors)) expect(SINAL_COLORS.some((c) => c.hex === hex)).toBe(true);
    expect(() => engine.configure('ana', { mode: 'classico' })).toThrow(RoomError);
    expect(() => engine.configure('ana', { mode: 'infinito' })).not.toThrow();
  });

  it('escolher a cor: cada cor é de uma pessoa só, e só no lobby', () => {
    const { engine } = setup();
    const colors = () => sinalOf(engine, 'ana').colors;
    const beto = colors().beto!;
    expect(() => engine.setColor('ana', beto)).toThrow('já é de outra');
    expect(() => engine.setColor('ana', '#123456')).toThrow('inválida');
    const free = SINAL_COLORS.find((c) => !Object.values(colors()).includes(c.hex))!.hex;
    engine.setColor('ana', free);
    expect(colors().ana).toBe(free);
    // trocar de cor desmarca o "pronto" (as regras mudaram para quem confirmou)
    engine.setReady('ana', true);
    engine.setColor('ana', colors().ana!);
    expect(engine.snapshot('ana').members.find((m) => m.id === 'ana')!.ready).toBe(false);
  });

  it('precisa de 2 pessoas prontas para começar e a seed nunca vai aos aparelhos', () => {
    const solo = setup(['ana']);
    expect(() => solo.engine.start('ana')).toThrow('2 pessoas');
    const { engine } = setup();
    expect(() => engine.start('ana')).toThrow('pronto');
    engine.setReady('beto', true);
    engine.start('ana');
    expect(engine.currentPhase).toBe('show');
    expect(JSON.stringify(engine.snapshot('ana'))).not.toContain('seed-sinal');
  });
});

describe('SinalRoomEngine: a corrida', () => {
  it('conta, larga e todos veem o mesmo Vigia e os mesmos poderes', () => {
    const { engine, advance } = setup();
    engine.setReady('beto', true);
    engine.start('ana');
    advance(SINAL_COUNTDOWN_MS - 100);
    expect(engine.currentPhase).toBe('show');
    advance(200);
    expect(engine.currentPhase).toBe('play');
    advance(8000);
    const a = sinalOf(engine, 'ana').view;
    const b = sinalOf(engine, 'beto').view;
    expect(a.t).toBeCloseTo(b.t, 6);
    expect(a.vigia).toBe(b.vigia);
    expect(a.powers).toEqual(b.powers);
    expect(a.obstacles.map((o) => o.id)).toEqual(b.obstacles.map((o) => o.id));
    // mas a escuridão (e a posição) é de cada um
    expect(sinalOf(engine, 'ana').players).toHaveLength(2);
  });

  it('o analógico move só o seu boneco, e a corrida só aceita durante o jogo', () => {
    const { engine, advance } = race();
    engine.move('ana', 0, 100);
    advance(1000);
    const ana = racersOf(engine).get('ana')!.sim;
    const beto = racersOf(engine).get('beto')!.sim;
    expect(ana.y).toBeGreaterThan(2);
    expect(beto.y).toBeCloseTo(0, 5);
    // valores absurdos são limitados
    engine.move('ana', 1e9, -1e9);
    expect(racersOf(engine).get('ana')!.input).toEqual([100, -100]);
    engine.move('ana', NaN, 0);
    expect(racersOf(engine).get('ana')!.input).toEqual([100, -100]);
  });

  it('os bonecos não se sobrepõem', () => {
    const { engine, advance } = race();
    const [a, b] = [...racersOf(engine).values()].map((r) => r.sim);
    a!.x = 0;
    a!.y = 5;
    b!.x = 0.1;
    b!.y = 5.05;
    advance(100);
    expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeGreaterThanOrEqual(PLAYER_R * 2 - 0.02);
  });

  it('quem caiu assiste: vê o mapa de quem ainda corre', () => {
    const { engine, advance } = race(['ana', 'beto', 'caio']);
    // ana anda direto e é vista pelo Vigia; os outros ficam parados
    engine.move('ana', 0, 100);
    let guard = 0;
    while (!racersOf(engine).get('ana')!.sim.dead && guard++ < 60 * 40) advance(100);
    expect(racersOf(engine).get('ana')!.sim.dead).toBe(true);
    const s = sinalOf(engine, 'ana');
    expect(s.target).not.toBe('ana');
    expect(['beto', 'caio']).toContain(s.target);
    engine.watch('ana', 'caio');
    expect(sinalOf(engine, 'ana').target).toBe('caio');
  });

  it('acaba quando todos caem, e a classificação é por distância', () => {
    const { engine, advance } = race();
    engine.move('ana', 0, 100);
    engine.move('beto', 0, 100);
    let guard = 0;
    while (engine.currentPhase === 'play' && guard++ < 60 * 40) advance(100);
    advance(SINAL_FINISH_DELAY_MS + 200);
    expect(engine.currentPhase).toBe('final');
    const rows = engine.finalRows();
    expect(rows.map((r) => r.placement)[0]).toBe(1);
    expect(rows[0]!.totalTenths).toBeGreaterThanOrEqual(rows[1]!.totalTenths);
    expect(rows).toHaveLength(2);
  });

  it('quando alguém cai a corrida continua para quem ainda corre, e só acaba quando todos caem', () => {
    const { engine, advance } = race();
    // beto cai logo, parado no meio do caminho do olhar? não: derrubamos na marra
    const beto = racersOf(engine).get('beto')!.sim;
    const ana = racersOf(engine).get('ana')!.sim;
    (beto as unknown as { dead: boolean }).dead = true;
    (beto as unknown as { maxY: number }).maxY = 3;
    ana.y = 20;
    (ana as unknown as { maxY: number }).maxY = 20;
    advance(200);
    advance(SINAL_FINISH_DELAY_MS + 200);
    // ana ainda corre (e já passou o beto): a partida NÃO acaba
    expect(engine.currentPhase).toBe('play');
    expect(sinalOf(engine, 'beto').target).toBe('ana'); // o beto assiste
    engine.move('ana', 0, 100);
    let guard = 0;
    while (engine.currentPhase === 'play' && guard++ < 60 * 40) advance(100);
    advance(SINAL_FINISH_DELAY_MS + 200);
    expect(engine.currentPhase).toBe('final');
    expect(engine.finalRows()[0]!.userId).toBe('ana');
  });

  it('sair no meio deixa a sala sem corrida quando falta gente', () => {
    const { engine } = race();
    engine.leave('beto');
    expect(engine.currentPhase).toBe('lobby');
    expect(racersOf(engine).size).toBe(0);
  });

  it('quem perde a conexão fica parado', () => {
    const { engine, advance } = race();
    engine.move('beto', 0, 100);
    engine.disconnect('beto');
    advance(1500);
    expect(racersOf(engine).get('beto')!.sim.y).toBeLessThan(0.5);
  });
});

describe('SinalRoomEngine: o botão de empurrar', () => {
  const place = (engine: SinalRoomEngine, dist: number) => {
    const ana = racersOf(engine).get('ana')!.sim;
    const beto = racersOf(engine).get('beto')!.sim;
    ana.x = 0;
    ana.y = 4;
    beto.x = 0;
    beto.y = 4 + dist;
    return { ana, beto };
  };

  it('só aparece ao alcance: perto mostra quem dá para empurrar, longe não', () => {
    const { engine } = race();
    place(engine, PUSH_RANGE - 0.3);
    expect(sinalOf(engine, 'ana').push!.target).toBe('beto');
    place(engine, PUSH_RANGE + 0.5);
    expect(sinalOf(engine, 'ana').push!.target).toBeNull();
  });

  it('empurra o outro (que se desloca) e não mexe em quem empurrou', () => {
    const { engine, advance } = race();
    const { ana, beto } = place(engine, 1.2);
    const before = { ax: ana.x, ay: ana.y, bx: beto.x, by: beto.y };
    engine.push('ana');
    advance(500);
    expect(ana.x).toBeCloseTo(before.ax, 1);
    expect(ana.y).toBeCloseTo(before.ay, 1);
    expect(beto.y - before.by).toBeGreaterThan(0.6); // foi empurrado para longe
  });

  it('fora do alcance não faz nada e tem pausa entre os usos', () => {
    const { engine, advance, now } = race();
    const { beto } = place(engine, PUSH_RANGE + 1);
    const y0 = beto.y;
    engine.push('ana');
    advance(300);
    expect(beto.y).toBeCloseTo(y0, 1);
    // perto: o primeiro vale, o segundo logo depois não
    place(engine, 1.1);
    engine.push('ana');
    const readyAt = sinalOf(engine, 'ana').push!.readyAt;
    expect(readyAt).toBeGreaterThan(now());
    expect(readyAt - now()).toBeLessThanOrEqual(PUSH_COOLDOWN_MS);
    advance(400);
    const { beto: again } = place(engine, 1.1);
    const y1 = again.y;
    engine.push('ana');
    advance(300);
    expect(again.y).toBeCloseTo(y1, 1);
  });

  it('empurrar conta como movimento só para quem é empurrado: sob o olhar do Vigia ele cai e você não', () => {
    const { engine, advance } = race();
    const ana = racersOf(engine).get('ana')!.sim;
    // espera um olhar de verdade
    const cycle = ana.vigiaTimeline.upTo(120).find((c) => !c.fake && c.lookEnd - c.lookStart > 1.1)!;
    let guard = 0;
    while (ana.view.t < cycle.lookStart + 0.25 && guard++ < 60 * 100) {
      // parados (mas fora de qualquer esconderijo e longe de obstáculos)
      advance(100);
      if (ana.dead) break;
    }
    expect(ana.dead).toBe(false);
    const { beto } = place(engine, 1.2);
    // o jogo posicionou os dois à mão: limpa o que estiver em volta
    expect(ana.isHidden).toBe(false);
    engine.push('ana');
    advance(200);
    expect(beto.dead).toBe(true);
    expect(beto.result.ended).toBe('vigia');
    expect(ana.dead).toBe(false);
  });
});

describe('SinalRoomEngine: a névoa é uma só', () => {
  const darkOf = (e: SinalRoomEngine, id: string) =>
    (e.snapshot(id) as unknown as { sinal: { view: { darkY: number } } }).sinal.view.darkY;

  it('todos veem a mesma névoa, e ela anda', () => {
    const { engine, advance } = setup();
    engine.setReady('beto', true);
    engine.start('ana');
    advance(SINAL_COUNTDOWN_MS + 20);
    const d0 = darkOf(engine, 'ana');
    advance(5000);
    expect(darkOf(engine, 'ana')).toBeGreaterThan(d0 + 0.5);
    expect(darkOf(engine, 'ana')).toBeCloseTo(darkOf(engine, 'beto'), 6);
  });

  it('quem fica para trás é pego primeiro; quem está na frente continua', () => {
    const { engine, advance } = setup();
    engine.setReady('beto', true);
    engine.start('ana');
    advance(SINAL_COUNTDOWN_MS + 20);
    const ana = racersOf(engine).get('ana')!.sim;
    const beto = racersOf(engine).get('beto')!.sim;
    // ana corre à frente (teleporte para fora do alcance); beto fica na largada
    ana.y = 60;
    (ana as unknown as { maxY: number }).maxY = 60;
    let guard = 0;
    while (!beto.dead && guard++ < 60 * 90) advance(100);
    expect(beto.dead).toBe(true);
    expect(beto.result.ended).toBe('escuridao');
    expect(ana.dead).toBe(false);
  });

  it('a névoa nunca é mais rápida que o boneco, mesmo com quem está na frente parado', () => {
    const { engine, advance } = race();
    (engine as unknown as { dark: number }).dark = 0;
    advance(10_000);
    const dark = (engine as unknown as { dark: number }).dark;
    expect(dark / 10).toBeLessThan(4.2); // m/s médios
  });
});
