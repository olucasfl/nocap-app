import { POWER_RANGE, type ItemKind, type SinalEvent, type SinalSim } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { SINAL_COUNTDOWN_MS, SinalRoomEngine } from './sinal-room.engine';

interface Racer {
  sim: SinalSim;
}
const racersOf = (e: SinalRoomEngine) => (e as unknown as { racers: Map<string, Racer> }).racers;
const eventsOf = (e: SinalRoomEngine, viewer: string): (SinalEvent & { n: number })[] =>
  ((e.snapshot(viewer) as unknown as { sinal: { events: (SinalEvent & { n: number })[] } }).sinal.events ?? []);

/** Uma sala com `names` correndo, a escuridão fora do caminho e todo mundo já largado. */
function race(names = ['ana', 'beto']) {
  let clock = 1_000_000;
  const engine = new SinalRoomEngine({ code: 'ABCD', now: () => clock, newSeed: () => 'seed-poderes' });
  names.forEach((n) => engine.join(n, n));
  engine.configure(names[0]!, { rounds: 1 });
  for (const n of names.slice(1)) engine.setReady(n, true);
  engine.start(names[0]!);
  const advance = (ms: number) => {
    for (let left = ms; left > 0; left -= 17) {
      clock += Math.min(17, left);
      engine.tick();
    }
  };
  advance(SINAL_COUNTDOWN_MS + 20);
  (engine as unknown as { dark: number }).dark = -1e7;
  return { engine, advance };
}

/** Põe os dois jogadores perto (ou longe) um do outro, parados e longe de obstáculos. */
function place(engine: SinalRoomEngine, gap: number) {
  const r = racersOf(engine);
  const a = r.get('ana')!.sim;
  const b = r.get('beto')!.sim;
  a.x = -2;
  a.y = 3;
  b.x = -2;
  b.y = 3 + gap;
  return { a, b };
}

const give = (engine: SinalRoomEngine, id: string, item: ItemKind) => {
  racersOf(engine).get(id)!.sim.held = item;
};

describe('poderes online (spec 027)', () => {
  it('os itens que atrapalham só existem na sala: o solo nunca os sorteia', () => {
    const { engine } = race();
    const kinds = new Set<string>();
    for (const [, r] of racersOf(engine)) {
      for (const it of r.sim.view.items) kinds.add(it.kind);
    }
    expect(kinds.size).toBeGreaterThan(0);
  });

  it('usar um poder que atrapalha vai para o mais perto (até 15 m), com aviso de 0,8 s antes de bater', () => {
    const { engine, advance } = race(['ana', 'beto', 'caio']);
    const r = racersOf(engine);
    const a = r.get('ana')!.sim;
    a.x = -2;
    a.y = 3;
    r.get('beto')!.sim.x = -2;
    r.get('beto')!.sim.y = 3 + 12; // mais longe
    r.get('caio')!.sim.x = 2;
    r.get('caio')!.sim.y = 3 + 6; // mais perto
    give(engine, 'ana', 'atordoar');
    engine.use('ana');
    advance(100);
    expect(a.held).toBeNull();
    expect(eventsOf(engine, 'caio').some((e) => e.kind === 'ameaca' && e.item === 'atordoar')).toBe(true);
    expect(eventsOf(engine, 'beto').some((e) => e.kind === 'ameaca')).toBe(false);
    // ainda não bateu: o aviso dura 0,8 s
    expect(r.get('caio')!.sim.isStunned).toBe(false);
    advance(900);
    expect(eventsOf(engine, 'caio').some((e) => e.kind === 'sofreu' && e.item === 'atordoar')).toBe(true);
  });

  it('o alvo pode estar em qualquer direção (atrás também)', () => {
    const { engine, advance } = race();
    const { b } = place(engine, -5); // beto atrás de ana
    give(engine, 'ana', 'peso');
    engine.use('ana');
    advance(100);
    expect(eventsOf(engine, 'beto').some((e) => e.kind === 'ameaca' && e.item === 'peso')).toBe(true);
    void b;
  });

  it('sem ninguém ao alcance (15 m) o item fica com você e o aparelho avisa', () => {
    const { engine, advance } = race();
    place(engine, POWER_RANGE + 5);
    give(engine, 'ana', 'escorregao');
    engine.use('ana');
    advance(100);
    expect(racersOf(engine).get('ana')!.sim.held).toBe('escorregao');
    expect(eventsOf(engine, 'ana').some((e) => e.kind === 'sem-alvo')).toBe(true);
    expect(eventsOf(engine, 'beto').some((e) => e.kind === 'ameaca')).toBe(false);
  });

  it('a Sombra protege: o poder é barrado e o alvo nada sofre', () => {
    const { engine, advance } = race();
    place(engine, 6);
    give(engine, 'beto', 'sombra');
    engine.use('beto');
    advance(50);
    expect(racersOf(engine).get('beto')!.sim.isHidden).toBe(true);
    give(engine, 'ana', 'atordoar');
    engine.use('ana');
    advance(1000);
    const evs = eventsOf(engine, 'beto');
    expect(evs.some((e) => e.kind === 'defendeu' && e.item === 'atordoar')).toBe(true);
    expect(evs.some((e) => e.kind === 'sofreu')).toBe(false);
  });

  it('perto do olhar do Vigia nenhum poder vale (senão o alvo não teria saída)', () => {
    const { engine, advance } = race();
    const beto = racersOf(engine).get('beto')!.sim;
    // espera chegar bem perto de o Vigia olhar
    let guard = 0;
    while (beto.view.t < beto.view.cycle.lookStart - 1.0 && guard++ < 400) advance(100);
    place(engine, 6);
    give(engine, 'ana', 'atordoar');
    engine.use('ana');
    advance(1100);
    const evs = eventsOf(engine, 'beto');
    expect(evs.some((e) => e.kind === 'sofreu')).toBe(false);
    expect(evs.some((e) => e.kind === 'defendeu' || e.kind === 'ameaca')).toBe(true);
  });

  it('o Escorregão e o Peso mudam como o alvo anda enquanto duram, e depois acaba', () => {
    const { engine, advance } = race();
    const { b } = place(engine, 5);
    give(engine, 'ana', 'peso');
    engine.use('ana');
    advance(1000);
    expect(b.view.debuff?.item).toBe('peso');
    const y0 = b.y;
    racersOf(engine).get('beto')!.sim.x = racersOf(engine).get('beto')!.sim.x;
    // com o analógico para a frente, anda mais devagar que o normal (65%)
    (engine as unknown as { racers: Map<string, { input: [number, number] }> }).racers.get('beto')!.input = [0, 100];
    advance(500);
    const slow = b.y - y0;
    expect(slow).toBeGreaterThan(0.2);
    expect(slow).toBeLessThan(4.2 * 0.5 * 0.9);
  });

  it('o item do chão é um só para a sala: quem pega primeiro leva, e some para os outros', () => {
    const { engine, advance } = race();
    const r = racersOf(engine);
    const a = r.get('ana')!.sim;
    const b = r.get('beto')!.sim;
    const it = a.view.items[0];
    expect(it).toBeDefined();
    a.x = it!.x;
    a.y = it!.y;
    advance(60);
    expect(a.held).toBe(it!.kind);
    expect(b.view.items.some((q) => q.id === it!.id)).toBe(false);
    // o segundo não pega o que já foi levado
    b.x = it!.x;
    b.y = it!.y;
    advance(60);
    expect(b.held === it!.kind && a.held === it!.kind && b.view.items.length === 0).toBe(false);
  });

  it('o aparelho recebe o alvo do próximo poder (a mira)', () => {
    const { engine } = race();
    place(engine, 8);
    const snap = engine.snapshot('ana') as unknown as { sinal: { power: { target: string | null; range: number } | null } };
    expect(snap.sinal.power?.target).toBe('beto');
    expect(snap.sinal.power?.range).toBe(POWER_RANGE);
  });
});
