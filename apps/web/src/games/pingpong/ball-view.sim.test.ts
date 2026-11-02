import { PpBot, PP_BOT_LEVELS, PpNetSim, createRng, type PpNetEvent } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALL_VIEW, PpBallView, type BallViewTuning } from './ball-view';

/**
 * Simulação de rede do Ping Fox! só da bola desenhada: A e B jogam com bots, a sala (S) arbitra, os eventos viajam com
 * atraso e variação (cada trecho), e no aparelho B a `PpBallView` desenha a bola quadro a quadro. Mede dois defeitos:
 * "salto" (a bola anda mais por quadro do que qualquer bola anda) e "vai e volta" (a bola desenhada anda contra o sentido
 * em que a bola da partida vai).
 */
interface Msg {
  at: number;
  to: 'A' | 'B' | 'S';
  ev?: PpNetEvent;
  rej?: PpNetEvent;
  from?: number;
}

function measure(opts: {
  seed: string;
  hop: number;
  jitter: number;
  ticks: number;
  tune?: BallViewTuning;
}) {
  const rng = createRng(opts.seed);
  const A = new PpNetSim(0, 0);
  const B = new PpNetSim(0, 1);
  const S = new PpNetSim(0, -1, true);
  const botA = new PpBot(PP_BOT_LEVELS.medio, rng);
  const botB = new PpBot(PP_BOT_LEVELS.medio, rng);
  const view = new PpBallView(B.match, 1, opts.tune ?? DEFAULT_BALL_VIEW);
  view.sim = B;
  const q: Msg[] = [];
  const delay = () => Math.max(1, Math.round(opts.hop + (rng() - 0.5) * 2 * opts.jitter));
  const sims = { A, B, S };
  let last: { x: number; y: number; z: number } | null = null;
  let frames = 0;
  let jumps = 0;
  let backs = 0;
  let worst = 0;
  let lastAbsorb = -999;
  let hitGap = 0;
  let hitGapN = 0;
  let hitGapMax = 0;
  const dt = 1 / 60;
  for (let n = 1; n <= opts.ticks; n++) {
    for (let i = q.length - 1; i >= 0; i--) {
      const m = q[i]!;
      if (m.at > n) continue;
      q.splice(i, 1);
      if (m.rej) {
        sims[m.to].remove(m.rej);
        continue;
      }
      const ev = m.ev!;
      if (m.to === 'S') {
        if (S.validate(ev, m.from!)) {
          S.add(ev);
          q.push({ at: n + delay(), to: m.from === 0 ? 'B' : 'A', ev });
        } else q.push({ at: n + delay(), to: m.from === 0 ? 'A' : 'B', rej: ev });
      } else if (m.to === 'B') {
        const late = ev.t <= B.tick;
        B.add(ev);
        if (late) {
          view.absorb(B.tick - ev.t);
          lastAbsorb = n;
        }
      } else A.add(ev);
    }
    A.advanceTo(n, botA.input(A.match, 0));
    B.advanceTo(n, botB.input(B.match, 1));
    S.advanceTo(n);
    for (const ev of A.outgoing()) q.push({ at: n + delay(), to: 'S', ev, from: 0 });
    for (const ev of B.outgoing()) {
      if (ev.k === 'hit') {
        const bb = B.match.ball;
        const g = Math.hypot(view.shown.x - bb.x, view.shown.y - bb.y, view.shown.z - bb.z);
        hitGap += g;
        hitGapN++;
        hitGapMax = Math.max(hitGapMax, g);
        view.localHit();
      }
      q.push({ at: n + delay(), to: 'S', ev, from: 1 });
    }
    for (const ev of S.outgoing()) {
      q.push({ at: n + delay(), to: 'A', ev });
      q.push({ at: n + delay(), to: 'B', ev });
    }
    const b = B.match.ball;
    const p = view.update(dt, { x: b.x, y: b.y, z: b.z }, 1);
    if (B.match.phase === 'rally' && last) {
      frames++;
      const d = Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z);
      // nenhuma bola anda mais que ~26 m/s: acima disso em 1/60 s é salto
      const over = d - 26 * dt;
      if (over > 0.12) {
        jumps++;
        if (process.env.BV_DEBUG)
          console.log(
            'JUMP n=' + n,
            'over=' + over.toFixed(2),
            'lag=' + view.lag.toFixed(1),
            'sinceAbsorb=' + (n - lastAbsorb),
            'phase=' + B.match.phase,
            'expect=' + B.match.expect,
            'rally=' + B.match.rally,
            'holdT=' + view.holdT.toFixed(2),
            'last=' + B.match.lastHitter,
            'bounces=' + B.match.bounces.join(','),
            'z=' + b.z.toFixed(2),
            'vz=' + b.vz.toFixed(1),
            'tickA=' + A.tick + ' tickB=' + B.tick,
            'dz=' + (p.z - last.z).toFixed(2),
          );
      }
      worst = Math.max(worst, over);
      // anda contra o sentido da bola por mais de 12 cm: "vai e volta"
      const vz = b.vz;
      if (Math.abs(vz) > 3 && Math.sign(vz) * (p.z - last.z) < -0.1) {
        backs++;
        if (process.env.BV_DEBUG)
          console.log(
            'BACK n=' + n,
            'dz=' + (p.z - last.z).toFixed(2),
            'vz=' + vz.toFixed(1),
            'lag=' + view.lag.toFixed(1),
            'sinceAbsorb=' + (n - lastAbsorb),
            'expect=' + B.match.expect,
            'holdT=' + view.holdT.toFixed(2),
            'bounces=' + B.match.bounces.join(','),
            'z=' + b.z.toFixed(2),
            'shownZ=' + p.z.toFixed(2),
          );
      }
    }
    last = { x: p.x, y: p.y, z: p.z };
  }
  return {
    frames,
    jumps,
    backs,
    worst: Math.round(worst * 100) / 100,
    gap: Math.round((hitGap / Math.max(1, hitGapN)) * 100) / 100,
    gapMax: Math.round(hitGapMax * 100) / 100,
  };
}

describe('bola desenhada em rede (simulação)', () => {
  const profiles = [
    { name: 'boa', hop: 2, jitter: 1 },
    { name: 'média', hop: 5, jitter: 2 },
    { name: 'ruim', hop: 9, jitter: 4 },
  ];
  it('a bola desenhada quase não pula nem volta, nem em rede ruim', () => {
    for (const p of profiles) {
      const r = measure({ seed: 'bv-' + p.name, hop: p.hop, jitter: p.jitter, ticks: 9000 });
      // nenhuma "teleportada" (passo maior que o de qualquer bola) e quase nenhuma volta
      expect(r.jumps, p.name).toBeLessThanOrEqual(1);
      expect(r.backs, p.name).toBeLessThanOrEqual(3);
      expect(r.worst, p.name).toBeLessThan(0.3);
    }
  });
});

describe('afinação (só para olhar os números)', () => {
  it.skipIf(!process.env.BV_SWEEP)('varre as opções', () => {
    const base = DEFAULT_BALL_VIEW;
    const variants: [string, Partial<BallViewTuning>][] = [
      ['atual (err 9)', {}],
      ['err 4', { errDecay: 4 }],
      ['err 3', { errDecay: 3 }],
      ['err 3 hold .3', { errDecay: 3, holdMax: 0.3 }],
      ['err 2.5 hold .3', { errDecay: 2.5, holdMax: 0.3 }],
      ['err 3.5 hold .3', { errDecay: 3.5, holdMax: 0.3 }],
    ];

    const lines: string[] = [];
    for (const [name, t] of variants) {
      let j = 0;
      let b = 0;
      let w = 0;
      let gm = 0;
      let ga = 0;
      for (const p of [
        { s: 'a', hop: 2, jitter: 1 },
        { s: 'b', hop: 5, jitter: 2 },
        { s: 'c', hop: 9, jitter: 4 },
        { s: 'd', hop: 7, jitter: 5 },
      ]) {
        const r = measure({
          seed: 'sw-' + p.s,
          hop: p.hop,
          jitter: p.jitter,
          ticks: 9000,
          tune: { ...base, ...t },
        });
        j += r.jumps;
        b += r.backs;
        w = Math.max(w, r.worst);
        gm = Math.max(gm, r.gapMax);
        ga += r.gap / 4;
      }
      lines.push(
        `${name.padEnd(26)} saltos=${j} voltas=${b} pior=${w} naBatida(média/máx)=${Math.round(ga * 100) / 100}/${gm}`,
      );
    }
    console.log('SWEEP\n' + lines.join('\n'));
  });
});
