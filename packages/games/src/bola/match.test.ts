import { describe, expect, it } from 'vitest';
import { BOL_DT, BOL_TEAM_COLORS } from './constants';
import { BolaMatch, bolPlacements } from './match';
import type { BolInfo } from './world';

const humans: BolInfo[] = [
  { id: 'ana', name: 'Ana', color: BOL_TEAM_COLORS[0] as number, team: 0 },
  { id: 'bia', name: 'Bia', color: BOL_TEAM_COLORS[1] as number, team: 1 },
];

function make(seed = 's') {
  let t = 1_000_000;
  const clock = { advance: (ms: number) => (t += ms) };
  const m = new BolaMatch({
    teams: 2,
    perTeam: 2,
    durationSec: 60,
    seed,
    humans,
    bots: [1, 1],
    now: () => t,
  });
  return { m, clock };
}

/** Roda a partida por `sec` segundos de relógio, um quadro a cada 16 ms. */
function run(
  s: ReturnType<typeof make>,
  sec: number,
  onFrame?: (f: Record<string, unknown>) => void,
) {
  for (let i = 0; i < Math.round((sec * 1000) / 16); i++) {
    s.clock.advance(16);
    s.m.tick();
    const f = s.m.drainFrame(true);
    if (f) onFrame?.(f);
  }
}

describe('BolaMatch', () => {
  it('monta os corpos (pessoas e bots) com vagas estáveis e a lista para os aparelhos', () => {
    const { m } = make();
    const r = m.roster();
    expect(r.map((x) => x.slot)).toEqual([0, 1, 2, 3]);
    expect(r.filter((x) => x.bot)).toHaveLength(2);
    expect(r.find((x) => x.id === 'ana')?.team).toBe(0);
  });

  it('duas partidas com a mesma semente e a mesma entrada dão o mesmo quadro (ponto a ponto e servidor casam)', () => {
    const a = make('igual');
    const b = make('igual');
    for (const s of [a, b]) {
      s.m.input('ana', [1, 0, 0, 1]);
    }
    run(a, 6);
    run(b, 6);
    expect(a.m.drainFrame(true)).toMatchObject({ ph: expect.any(String) });
    const fa = a.m.world.players.map((p) => [p.x, p.z]);
    const fb = b.m.world.players.map((p) => [p.x, p.z]);
    expect(fa).toEqual(fb);
  });

  it('entrada válida move a raposa e inválida é ignorada; o pulo conta só quando o contador sobe', () => {
    const s = make();
    run(s, 4);
    const ana = s.m.world.player('ana')!;
    const x0 = ana.x;
    s.m.input('ana', 'lixo');
    s.m.input('ana', [Number.NaN, 0, 0, 1]);
    run(s, 0.5);
    expect(ana.x).toBeCloseTo(x0, 1);
    s.m.input('ana', [1, 0, 0, 2]);
    run(s, 0.5);
    expect(ana.x).not.toBeCloseTo(x0, 1);
    s.m.input('ana', [0, 0, 1, 3]);
    run(s, 0.1);
    s.m.input('ana', [0, 0, 2, 4]);
    run(s, 0.05);
    expect(ana.airJumped || !ana.grounded).toBe(true);
  });

  it('quem sai vira bot no mesmo corpo e na mesma vaga', () => {
    const s = make();
    const slot = s.m.slotOf('bia');
    s.m.toBot('bia');
    const r = s.m.roster().find((x) => x.slot === slot);
    expect(r?.bot).toBe(true);
    expect(r?.id).not.toBe('bia');
    run(s, 1);
  });

  it('o quadro leva hora, bola, corpos e estatísticas; eventos têm número crescente', () => {
    const s = make();
    const seen: number[] = [];
    let first: Record<string, unknown> | null = null;
    run(s, 12, (f) => {
      first ??= f;
      for (const e of f.ev as { n: number }[]) seen.push(e.n);
    });
    expect(first).toMatchObject({
      t: expect.any(Number),
      b: expect.any(Array),
      p: expect.any(Array),
    });
    expect(first!.st).toBeTruthy();
    expect(seen.length).toBeGreaterThan(0);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('o líder encerra e a partida marca `over`', () => {
    const s = make();
    run(s, 5);
    expect(s.m.over).toBe(false);
    s.m.endNow();
    run(s, 0.5);
    expect(s.m.over).toBe(true);
  });

  it('o limite de recuperação evita uma rajada de passos depois de um engasgo', () => {
    const s = make();
    s.clock.advance(10_000);
    const t0 = s.m.world.clock;
    s.m.tick();
    expect(s.m.world.clock - t0).toBeLessThanOrEqual(8 * BOL_DT + 1e-6);
  });

  it('o quadro leva o vencedor quando a partida acaba (o aparelho online não tem outro jeito de saber)', () => {
    const s = make();
    s.m.world.scores.splice(0, 2, 1, 3);
    s.m.endNow();
    s.clock.advance(16);
    s.m.tick();
    const f = s.m.drainFrame(true) as { ph: string; wn: number };
    expect(f.ph).toBe('o');
    expect(f.wn).toBe(1);
  });

  it('bolPlacements divide a posição no empate', () => {
    const p = bolPlacements([2, 2, 0]);
    expect(p.get(0)).toBe(1);
    expect(p.get(1)).toBe(1);
    expect(p.get(2)).toBe(3);
  });
});
