import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { bolBotInput, newBolBotMemory } from './bots';
import { BOL_DT, BOL_STICK_MAX, BOL_TEAM_COLORS } from './constants';
import { BolWorld, type BolInfo, type BolInput } from './world';

/** Quantas janelas de 3 s um bot passou querendo andar (e podendo) mas quase sem sair do lugar. */
function stuckWindows(seed: string, teams: number, per: number, sec: number) {
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
    w.players.map((p, i) => [p.id, newBolBotMemory((p.team + 1) % teams, 0.2 + (i % 3) * 0.05)]),
  );
  const mark = new Map<string, { x: number; z: number; t: number; want: number }>();
  let stuck = 0;
  let windows = 0;
  const ticks = Math.round(sec / BOL_DT);
  for (let i = 0; i < ticks && w.phase !== 'over'; i++) {
    const inputs: Record<string, BolInput> = {};
    for (const p of w.players) inputs[p.id] = bolBotInput(w, p, mem.get(p.id)!, rng);
    w.step(BOL_DT, inputs);
    if (w.phase !== 'play') {
      mark.clear();
      continue;
    }
    for (const p of w.players) {
      const inp = inputs[p.id]!;
      const want = Math.hypot(inp.mx, inp.mz);
      const m = mark.get(p.id);
      if (!m) {
        mark.set(p.id, { x: p.x, z: p.z, t: w.clock, want });
        continue;
      }
      m.want = Math.min(m.want, want);
      if (w.clock - m.t >= 3) {
        windows++;
        // quis andar o tempo todo e andou menos de 1,2 m em 3 s (uma raposa anda ~24 m)
        if (m.want > 0.5 && p.surf === 0 && Math.hypot(p.x - m.x, p.z - m.z) < 1.2) stuck++;
        mark.set(p.id, { x: p.x, z: p.z, t: w.clock, want });
      }
    }
  }
  return { stuck, windows };
}

describe('bots do Fut Fox não ficam presos', () => {
  it('o plano de subir na parede vence mesmo se o bot não consegue colar (sem grude): ele para de empurrar o muro', () => {
    const infos: BolInfo[] = [0, 1].flatMap((t) => [
      { id: `t${t}`, name: `B${t}`, color: BOL_TEAM_COLORS[t] as number, team: t, bot: true },
    ]);
    const w = new BolWorld(infos, { teams: 2, perTeam: 1, durationSec: 120 });
    const rng = createRng('subir');
    const mem = new Map(w.players.map((p) => [p.id, newBolBotMemory((p.team + 1) % 2, 0.1)]));
    for (let i = 0; i < 400 && w.phase !== 'play'; i++) w.step(BOL_DT, {});
    const wall = w.field.edges.find((e) => e.goal < 0 && e.len > 10)!;
    const bot = w.players[0]!;
    const other = w.players[1]!;
    Object.assign(other, { x: -wall.nx * 14, z: -wall.nz * 14 });
    // bola alta e parada junto da parede, e o bot sem grude: o plano de subida não tem como dar certo
    const hold = () => {
      Object.assign(w.ball, {
        x: wall.mx + wall.nx * 1.5,
        y: 6,
        z: wall.mz + wall.nz * 1.5,
        vx: 0,
        vy: 3,
        vz: 0,
      });
      // com grude para planejar a subida; assim que há plano, sem grude (não tem como colar)
      bot.stick = mem.get(bot.id)!.plan ? 0 : BOL_STICK_MAX;
    };
    let pushedInto = 0;
    let planSeen = false;
    for (let i = 0; i < Math.round(14 / BOL_DT); i++) {
      hold();
      const inputs: Record<string, BolInput> = {
        [bot.id]: bolBotInput(w, bot, mem.get(bot.id)!, rng),
        [other.id]: { mx: 0, mz: 0, jump: false },
      };
      if (mem.get(bot.id)!.plan) planSeen = true;
      w.step(BOL_DT, inputs);
      const d = (bot.x - wall.mx) * wall.nx + (bot.z - wall.mz) * wall.nz;
      if (
        i > 8 / BOL_DT &&
        d < 0.9 &&
        Math.hypot(inputs[bot.id]!.mx * wall.nx + inputs[bot.id]!.mz * wall.nz) > 0.3
      )
        pushedInto++;
    }
    expect(planSeen).toBe(true);
    // depois de uns 8 s não passa o resto do tempo encostado no muro empurrando para ele
    expect(pushedInto).toBeLessThan(Math.round(2 / BOL_DT));
  }, 60_000);

  it('quase nunca passam 3 s querendo andar e sem sair do lugar (parede, canto, rede)', () => {
    let stuck = 0;
    let windows = 0;
    for (const [seed, teams, per] of [
      ['p1', 2, 3],
      ['p2', 2, 2],
      ['p3', 3, 2],
      ['p4', 4, 1],
    ] as const) {
      const r = stuckWindows(seed, teams, per, 150);
      stuck += r.stuck;
      windows += r.windows;
    }
    console.log('PRESO', stuck, 'de', windows);
    expect(stuck / Math.max(1, windows)).toBeLessThan(0.01);
  }, 180_000);
});
