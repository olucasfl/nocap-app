import { describe, expect, it } from 'vitest';
import { FsNetSim } from './netsim';

describe('proteção do nascimento (mata-mata)', () => {
  const mk = () => {
    return new FsNetSim({ minutes: 5, humans: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], bots: 0 });
  };
  it('quem nasce não leva dano parado; ao andar perde a proteção', () => {
    const sim = mk();
    sim.damage('a', 'b', 50, 0, false, 'ak', false);
    expect(sim.selfState('a')!.hp).toBe(100);
    expect(sim.selfState('a')!.shield).toBeGreaterThan(0.9);
    const p = (sim as unknown as { players: Map<string, { mover: { x: number }; shieldUntil: number }> }).players.get('a')!;
    p.mover.x += 1;
    sim.step();
    expect(p.shieldUntil).toBe(0);
    sim.damage('a', 'b', 50, 0, false, 'ak', false);
    expect(sim.selfState('a')!.hp).toBe(50);
  });
  it('parado, a proteção dura 8 segundos', () => {
    const sim = mk();
    for (let i = 0; i < 60 * 7; i++) sim.step();
    expect(sim.selfState('a')!.shield).toBeGreaterThan(0);
    for (let i = 0; i < 60 * 2; i++) sim.step();
    expect(sim.selfState('a')!.shield).toBe(0);
  });
});
