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
  /** Atraso de cada trecho do aparelho A (o líder) até a sala; `hop` é o do aparelho B (quem desenha). */
  hopA?: number;
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
  const delay = (link: 'A' | 'B' = 'B') =>
    Math.max(
      1,
      Math.round(
        (link === 'A' ? (opts.hopA ?? opts.hop) : opts.hop) + (rng() - 0.5) * 2 * opts.jitter,
      ),
    );
  const sims = { A, B, S };
  let last: { x: number; y: number; z: number } | null = null;
  let frames = 0;
  let jumps = 0;
  let backs = 0;
  let worst = 0;
  let lastAbsorb = -999;
  let afterHit = 0;
  let postGap = 0;
  let postGapN = 0;
  let postGapMax = 0;
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
          q.push({ at: n + delay(m.from === 0 ? 'B' : 'A'), to: m.from === 0 ? 'B' : 'A', ev });
        } else
          q.push({
            at: n + delay(m.from === 0 ? 'A' : 'B'),
            to: m.from === 0 ? 'A' : 'B',
            rej: ev,
          });
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
    for (const ev of A.outgoing()) q.push({ at: n + delay('A'), to: 'S', ev, from: 0 });
    for (const ev of B.outgoing()) {
      if (ev.k === 'hit') {
        const bb = B.match.ball;
        const g = Math.hypot(view.shown.x - bb.x, view.shown.y - bb.y, view.shown.z - bb.z);
        hitGap += g;
        hitGapN++;
        hitGapMax = Math.max(hitGapMax, g);
        view.localHit();
        afterHit = 4;
      }
      q.push({ at: n + delay('B'), to: 'S', ev, from: 1 });
    }
    for (const ev of S.outgoing()) {
      q.push({ at: n + delay('A'), to: 'A', ev });
      q.push({ at: n + delay('B'), to: 'B', ev });
    }
    const b = B.match.ball;
    const p = view.update(dt, { x: b.x, y: b.y, z: b.z }, 1);
    if (afterHit > 0 && --afterHit === 0) {
      const g = Math.hypot(p.x - b.x, p.y - b.y, p.z - b.z);
      postGap += g;
      postGapN++;
      postGapMax = Math.max(postGapMax, g);
    }
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
    post: Math.round((postGap / Math.max(1, postGapN)) * 100) / 100,
    postMax: Math.round(postGapMax * 100) / 100,
  };
}

describe('bola desenhada em rede (simulação)', () => {
  it('a bola sai da sua raquete (4 quadros depois da batida já está na da partida) e quase não pula, nem em rede ruim e assimétrica', () => {
    const nets = [
      { name: 'boa', hop: 2, hopA: 2, jitter: 1 },
      { name: 'média', hop: 5, hopA: 5, jitter: 2 },
      { name: 'ruim', hop: 9, hopA: 9, jitter: 4 },
      // o líder perto da sala e o outro longe (é o caso de quem não é líder travar mais)
      { name: 'assimétrica', hop: 9, hopA: 3, jitter: 4 },
    ];
    for (const p of nets) {
      const r = measure({
        seed: 'bv-' + p.name,
        hop: p.hop,
        hopA: p.hopA,
        jitter: p.jitter,
        ticks: 9000,
      });
      expect(r.postMax, p.name).toBeLessThan(0.45);
      expect(r.post, p.name).toBeLessThan(0.05);
      expect(r.backs, p.name).toBeLessThanOrEqual(8);
      expect(r.worst, p.name).toBeLessThan(0.4);
    }
  });
});

describe('afinação (só para olhar os números)', () => {
  it.skipIf(!process.env.BV_SWEEP)('varre as opções', () => {
    const base = DEFAULT_BALL_VIEW;
    const variants: [string, Partial<BallViewTuning>][] = [
      ['antes-39 (sem deslize rápido)', { errDecay: 9, holdMax: 0.2, hitDecay: 9 }],
      ['39 (err 3, sem deslize rápido)', { hitDecay: 3 }],
      ['err 3 + batida rápida 30', {}],
      ['err 6 + batida 30', { errDecay: 6 }],
      ['err 6 + batida 30 frac .3 max48', { errDecay: 6, catchFrac: 0.3, catchMax: 48 }],
      [
        'err 5 + batida 40 frac .4 max40',
        { errDecay: 5, hitDecay: 40, catchFrac: 0.4, catchMax: 40 },
      ],
    ];

    const lines: string[] = [];
    for (const [name, t] of variants) {
      let j = 0;
      let b = 0;
      let w = 0;
      let gm = 0;
      let ga = 0;
      let pm = 0;
      let pa = 0;
      for (const p of [
        { s: 'a', hop: 2, jitter: 1, hopA: 2 },
        { s: 'b', hop: 5, jitter: 2, hopA: 5 },
        { s: 'c', hop: 9, jitter: 4, hopA: 3 },
        { s: 'd', hop: 7, jitter: 5, hopA: 2 },
      ]) {
        const r = measure({
          seed: 'sw-' + p.s,
          hop: p.hop,
          hopA: p.hopA,
          jitter: p.jitter,
          ticks: 9000,
          tune: { ...base, ...t },
        });
        j += r.jumps;
        b += r.backs;
        w = Math.max(w, r.worst);
        gm = Math.max(gm, r.gapMax);
        pm = Math.max(pm, r.postMax);
        pa += r.post / 4;
        ga += r.gap / 4;
      }
      lines.push(
        `${name.padEnd(26)} saltos=${j} voltas=${b} pior=${w} naBatida=${Math.round(ga * 100) / 100}/${gm} 4quadrosDepois(média/máx)=${Math.round(pa * 100) / 100}/${pm}`,
      );
    }
    console.log('SWEEP\n' + lines.join('\n'));
  });
});
