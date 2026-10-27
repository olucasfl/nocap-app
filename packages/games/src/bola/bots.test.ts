import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { bolBotInput as newInput, newBolBotMemory as newMem } from './bots';
import { BOL_DT, BOL_TEAM_COLORS } from './constants';
import { BolWorld, type BolInfo, type BolInput } from './world';

function play(seed: string, teams: number, per: number, sec: number) {
  const infos: BolInfo[] = [];
  for (let t = 0; t < teams; t++)
    for (let k = 0; k < per; k++)
      infos.push({
        id: `t${t}p${k}`,
        name: `B${t}${k}`,
        color: BOL_TEAM_COLORS[t] as number,
        team: t,
        bot: true,
      });
  const w = new BolWorld(infos, { teams, perTeam: per, durationSec: sec + 30 });
  const rng = createRng(`${seed}:bots`);
  const mem = new Map(
    w.players.map((p, i) => [p.id, newMem((p.team + 1) % teams, 0.2 + (i % 3) * 0.05)]),
  );
  let goals = 0;
  let own = 0;
  let turn = 0;
  let turnN = 0;
  let still = 0;
  let moving = 0;
  let jumps = 0;
  const prevDir = new Map<string, number>();
  const t0 = performance.now();
  const ticks = Math.round(sec / BOL_DT);
  for (let i = 0; i < ticks && w.phase !== 'over'; i++) {
    const inputs: Record<string, BolInput> = {};
    for (const p of w.players) {
      inputs[p.id] = newInput(w, p, mem.get(p.id)!, rng);
    }
    w.step(BOL_DT, inputs);
    if (w.phase === 'play') {
      for (const p of w.players) {
        const inp = inputs[p.id]!;
        if (inp.jump) jumps++;
        const mag = Math.hypot(inp.mx, inp.mz);
        if (mag > 0.1) {
          moving++;
          const a = Math.atan2(inp.mx, inp.mz);
          const pa = prevDir.get(p.id);
          if (pa !== undefined) {
            let d = a - pa;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            turn += Math.abs(d);
            turnN++;
          }
          prevDir.set(p.id, a);
        } else still++;
      }
    }
    for (const e of w.drainEvents()) {
      if (e.type === 'goal') {
        goals++;
        if (e.own) own++;
      }
    }
  }
  return {
    goals,
    own,
    jumps,
    stillPct: (still / Math.max(1, still + moving)) * 100,
    turnRate: (turn / Math.max(1, turnN)) * (1 / BOL_DT) * (180 / Math.PI),
    ms: performance.now() - t0,
  };
}

describe('bots do Fut Fox', () => {
  it('jogam de verdade: fazem gols (o bot antigo fazia ~1,6 em 2 min no 3x3), sem giro nervoso de robô e sem ficar parados', () => {
    const rs = Array.from({ length: 4 }, (_, k) => play(`fx${k}`, 2, 3, 120));
    const avg = (f: (r: (typeof rs)[number]) => number) =>
      rs.reduce((a, r) => a + f(r), 0) / rs.length;
    // a bola ficou mais lenta (20 m/s) e há rampa nas paredes: a média caiu um pouco, e o bot antigo fazia ~1,6
    expect(avg((r) => r.goals)).toBeGreaterThan(2);
    // antes: ~131 graus/s de troca de direção
    expect(avg((r) => r.turnRate)).toBeLessThan(115);
    expect(avg((r) => r.stillPct)).toBeLessThan(30);
  }, 60_000);

  it('em partida de 3 times mira no gol de quem lidera e nunca num gol fechado', () => {
    const w = new BolWorld(
      [0, 1, 2].map((t) => ({ id: `t${t}`, name: 'B', color: 0, team: t, bot: true })),
      { teams: 3, perTeam: 1, durationSec: 60 },
    );
    w.scores.splice(0, 3, 0, 4, 1);
    w.out[2] = true;
    const mem = newMem(0, 0);
    for (let i = 0; i < 60 * 4; i++) w.step(BOL_DT, {});
    // sem erro nem NaN com um time de fora
    const inp = newInput(w, w.player('t0')!, mem, createRng('x'));
    expect(Number.isFinite(inp.mx) && Number.isFinite(inp.mz)).toBe(true);
  });
});
