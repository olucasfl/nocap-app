import { BOL_TEAM_COLORS, BolaMatch, BolWorld, type BolInfo } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { BolaNetSync } from './bola-netsync';

/**
 * Simulação de rede do Fut Fox online: quem simula (líder) roda a partida de verdade, o outro aparelho recebe os
 * estados por uma rede com atraso e variação, e o desenho dele (a mesma BolaNetSync do jogo) é medido quadro a quadro.
 * Tudo com relógio virtual e sorteio fixo: o mesmo número sai em qualquer máquina.
 */

interface Profile {
  name: string;
  /** Ida e volta média (ms). */
  rtt: number;
  /** Variação de cada pacote (ms, +-). */
  jitter: number;
  /** Chance de um pacote atrasar `spikeMs` a mais. */
  spike: number;
  spikeMs: number;
  /** Chance de perder o pacote. */
  loss: number;
}

export const PROFILES: Profile[] = [
  { name: 'mesma rede (LAN)', rtt: 6, jitter: 2, spike: 0, spikeMs: 0, loss: 0 },
  { name: 'Wi-Fi bom', rtt: 30, jitter: 10, spike: 0.005, spikeMs: 80, loss: 0.005 },
  { name: 'internet boa', rtt: 70, jitter: 20, spike: 0.01, spikeMs: 120, loss: 0.01 },
  { name: 'internet ruim', rtt: 140, jitter: 45, spike: 0.02, spikeMs: 200, loss: 0.03 },
];

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface SimResult {
  profile: string;
  seconds: number;
  /** Quadros de desenho em que a bola andou mais do que cabe em 1/60 s. */
  teleports: number;
  /** Saltos grandes: a bola "anda" mais de 1 m num quadro além da velocidade dela. */
  big: number;
  /** Maior deslocamento da bola em um quadro (m). */
  maxStep: number;
  /** Maior mudança brusca de velocidade desenhada (m/s) em um quadro. */
  p99Step: number;
  /** Distância média/p95 da bola desenhada até a bola de verdade do líder, no mesmo instante (m). */
  lagMean: number;
  lagP95: number;
  /** Atraso de desenho médio (ms). */
  delayMean: number;
  stats: Record<string, number>;
  /** Por que a bola saltou: bola de mentira ativa / acabou de nascer / relógio refeito / só extrapolação / sem causa clara. */
  causes: Record<string, number>;
}

export function simulate(
  p: Profile,
  seconds: number,
  seed = 7,
  ballModel: 'interp' | 'local' = 'interp',
  minDelay = 45,
): SimResult {
  const rnd = lcg(seed);
  let T = 1_000_000;
  const humans: BolInfo[] = [
    { id: 'ana', name: 'Ana', color: BOL_TEAM_COLORS[0] as number, team: 0 },
    { id: 'bia', name: 'Bia', color: BOL_TEAM_COLORS[1] as number, team: 1 },
  ];
  const match = new BolaMatch({
    teams: 2,
    perTeam: 2,
    durationSec: seconds + 30,
    seed: 'sim',
    humans,
    bots: [1, 1],
    now: () => T,
  });
  const infos: BolInfo[] = match.world.players.map((q) => ({
    id: q.id,
    name: q.name,
    color: q.color,
    team: q.team,
    bot: q.bot || undefined,
  }));
  const world = new BolWorld(infos, { teams: 2, perTeam: 2, durationSec: seconds + 30 });
  const slotOf = new Map(match.world.players.map((q) => [q.id, match.slotOf(q.id)]));
  const sync = new BolaNetSync(world, {
    meId: 'bia',
    minDelay,
    ballModel,
    rtt: () => p.rtt,
    now: () => T,
    slotOf: () => slotOf,
  });
  const oneWay = () => {
    let d = p.rtt / 2 + (rnd() * 2 - 1) * p.jitter;
    if (rnd() < p.spike) d += p.spikeMs;
    return Math.max(1, d);
  };
  // pacotes em trânsito: [chegada, ação]
  const wire: { at: number; fn: () => void }[] = [];
  let lastFrameArrive = 0;
  const truth: { t: number; x: number; y: number; z: number }[] = [];

  const chase = (me: { x: number; z: number }, b: { x: number; z: number }) => {
    const dx = b.x - me.x;
    const dz = b.z - me.z;
    const d = Math.hypot(dx, dz) || 1;
    return { mx: dx / d, mz: dz / d };
  };
  let jumpsBia = 0;
  let jumpsAna = 0;
  let seq = 0;
  let lastJumpBia = -1e9;
  let lastJumpAna = -1e9;
  let nextInput = T;
  let nextDraw = T;
  const end = T + seconds * 1000;
  let prev: { x: number; y: number; z: number } | null = null;
  const steps: number[] = [];
  const lags: number[] = [];
  const causes: Record<string, number> = {
    ghost: 0,
    'ghost-nasce': 0,
    'relogio-refeito': 0,
    'outra-causa': 0,
  };
  let hitsPrev = 0;
  let snapsPrev = 0;
  let ghostPrev = false;
  let teleports = 0;
  let big = 0;
  let maxStep = 0;
  let delaySum = 0;
  let draws = 0;
  let started = 0;
  // o relógio anda de 1 em 1 ms: o desenho cai em 16/17 ms, como num aparelho de 60 Hz
  while (T < end) {
    T += 1;
    // entrega o que chegou
    for (let i = 0; i < wire.length; i++) {
      if ((wire[i] as { at: number }).at <= T) {
        (wire[i] as { fn: () => void }).fn();
        wire.splice(i, 1);
        i--;
      }
    }
    // líder: simula; a cada 8 ms vê se há passo novo
    if (T % 8 === 0) {
      const n = match.tick();
      if (n > 0) {
        const f = match.drainFrame(true);
        if (f) {
          const b = match.world.ball;
          truth.push({ t: T, x: b.x, y: b.y, z: b.z });
          if (rnd() >= p.loss) {
            const arrive = Math.max(T + oneWay(), lastFrameArrive);
            lastFrameArrive = arrive;
            wire.push({
              at: arrive,
              fn: () => sync.push(f as unknown as { t?: number; b: number[]; p: number[][] }, T),
            });
          }
        }
      }
    }
    // entradas a cada 25 ms: o líder usa a bola de verdade, o outro a bola que ele vê
    if (T >= nextInput) {
      nextInput += 25;
      const ana = match.world.player('ana');
      if (ana && match.world.phase === 'play') {
        const m = chase(ana, match.world.ball);
        if (
          match.world.ball.y > 2 &&
          Math.hypot(match.world.ball.x - ana.x, match.world.ball.z - ana.z) < 4 &&
          T - lastJumpAna > 1200
        ) {
          jumpsAna++;
          lastJumpAna = T;
        }
        match.input('ana', [m.mx, m.mz, jumpsAna, ++seq]);
      }
      const bia = world.player('bia');
      if (bia && world.phase === 'play') {
        const m = chase(bia, world.ball);
        if (
          world.ball.y > 2 &&
          Math.hypot(world.ball.x - bia.x, world.ball.z - bia.z) < 4 &&
          T - lastJumpBia > 1200
        ) {
          jumpsBia++;
          lastJumpBia = T;
        }
        const pkt = [Math.round(m.mx * 100) / 100, Math.round(m.mz * 100) / 100, jumpsBia, ++seq];
        if (rnd() >= p.loss) wire.push({ at: T + oneWay(), fn: () => match.input('bia', pkt) });
      }
    }
    // desenho a ~60 quadros por segundo
    if (T >= nextDraw && sync.snaps.length > 0) {
      nextDraw += 1000 / 60;
      const phases = { countdown: 'countdown', play: 'play', goal: 'goal', over: 'over' } as const;
      world.phase = phases[match.world.phase];
      const bia = world.player('bia');
      let mi = { mx: 0, mz: 0 };
      if (bia && world.phase === 'play') mi = chase(bia, world.ball);
      const press =
        world.ball.y > 2 &&
        bia !== undefined &&
        Math.hypot(world.ball.x - bia.x, world.ball.z - bia.z) < 4 &&
        T - lastJumpBia < 30 &&
        T - lastJumpBia >= 0;
      sync.update(1 / 60, mi, press);
      draws++;
      delaySum += sync.interpMs;
      const b = world.ball;
      if (started === 0) started = T;
      // mede só a partir do segundo 3 (contagem e início)
      if (T - started > 3000 && match.world.phase === 'play') {
        if (prev) {
          const raw = Math.hypot(b.x - prev.x, b.y - prev.y, b.z - prev.z);
          // salto = deslocamento que a velocidade desenhada não explica (a bola andando rápido não é salto)
          const d = Math.abs(raw - Math.hypot(b.vx, b.vy, b.vz) / 60);
          steps.push(d);
          if (d > maxStep) maxStep = d;
          if (d > 1) big++;
          if (d > 0.4) {
            teleports++;
            if (sync.stats.ghostHits !== hitsPrev) causes['ghost-nasce']!++;
            else if (sync.stats.renderSnaps !== snapsPrev) causes['relogio-refeito']!++;
            else if (sync.ghostActive || ghostPrev) causes.ghost!++;
            else causes['outra-causa']!++;
          }
        }
        // a bola de verdade do líder no instante do desenho
        const tr = truth[truth.length - 1];
        if (tr) lags.push(Math.hypot(b.x - tr.x, b.y - tr.y, b.z - tr.z));
      }
      if (!(T - started > 3000 && match.world.phase === 'play')) prev = null;
      hitsPrev = sync.stats.ghostHits;
      snapsPrev = sync.stats.renderSnaps;
      ghostPrev = sync.ghostActive;
      if (T - started > 3000 && match.world.phase === 'play') prev = { x: b.x, y: b.y, z: b.z };
    }
  }
  steps.sort((a, b) => a - b);
  lags.sort((a, b) => a - b);
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  return {
    profile: p.name,
    seconds,
    teleports,
    big,
    maxStep,
    p99Step: steps[Math.floor(steps.length * 0.99)] ?? 0,
    lagMean: mean(lags),
    lagP95: lags[Math.floor(lags.length * 0.95)] ?? 0,
    delayMean: delaySum / Math.max(1, draws),
    stats: { ...sync.stats },
    causes,
  };
}

describe('Fut Fox online: bola desenhada no aparelho do outro jogador', () => {
  it('mede teletransportes por perfil de rede', () => {
    const SEEDS = [1, 2, 3, 4, 5];
    for (const model of ['interp', 'local'] as const) {
      const rows = PROFILES.map((p) => {
        const rs = SEEDS.map((sd) => simulate(p, 120, sd, model));
        const sum = (f: (r: SimResult) => number) => rs.reduce((s, r) => s + f(r), 0);
        const causes: Record<string, number> = {};
        for (const r of rs)
          for (const [k, v] of Object.entries(r.causes)) causes[k] = (causes[k] ?? 0) + v;
        const stats: Record<string, number> = {};
        for (const r of rs)
          for (const [k, v] of Object.entries(r.stats)) stats[k] = (stats[k] ?? 0) + v;
        return {
          profile: p.name,
          seconds: sum((r) => r.seconds),
          teleports: sum((r) => r.teleports),
          big: sum((r) => r.big),
          maxStep: Math.max(...rs.map((r) => r.maxStep)),
          p99Step: sum((r) => r.p99Step) / rs.length,
          lagMean: sum((r) => r.lagMean) / rs.length,
          lagP95: sum((r) => r.lagP95) / rs.length,
          delayMean: sum((r) => r.delayMean) / rs.length,
          stats,
          causes,
        } satisfies SimResult;
      });
      console.table(
        rows.map((r) => ({
          rede: r.profile,
          'saltos>0,4m/min': +((r.teleports * 60) / r.seconds).toFixed(2),
          'saltos>1m/min': +((r.big * 60) / r.seconds).toFixed(2),
          'maior passo (m)': +r.maxStep.toFixed(2),
          'p99 passo (m)': +r.p99Step.toFixed(2),
          'defasagem média (m)': +r.lagMean.toFixed(2),
          'defasagem p95 (m)': +r.lagP95.toFixed(2),
          'atraso (ms)': Math.round(r.delayMean),
          ...r.stats,
          ...Object.fromEntries(Object.entries(r.causes).map(([k, v]) => ['salto:' + k, v])),
        })),
      );
      console.log('modelo da bola:', model);
      if (model === 'local')
        for (const r of rows) expect((r.big * 60) / r.seconds, r.profile).toBeLessThan(1);
      expect(rows).toHaveLength(PROFILES.length);
    }
  });
});

describe('pulo no online', () => {
  it.each([60, 144, 240])(
    'o aperto de pulo não se perde com tela de %i Hz (pulo e pulo duplo)',
    (hz) => {
      let T = 1_000_000;
      const humans: BolInfo[] = [
        { id: 'ana', name: 'Ana', color: BOL_TEAM_COLORS[0] as number, team: 0 },
        { id: 'bia', name: 'Bia', color: BOL_TEAM_COLORS[1] as number, team: 1 },
      ];
      const match = new BolaMatch({
        teams: 2,
        perTeam: 1,
        durationSec: 60,
        seed: 'j',
        humans,
        bots: [0, 0],
        now: () => T,
      });
      const infos: BolInfo[] = match.world.players.map((q) => ({
        id: q.id,
        name: q.name,
        color: q.color,
        team: q.team,
      }));
      const world = new BolWorld(infos, { teams: 2, perTeam: 1, durationSec: 60 });
      const slotOf = new Map(match.world.players.map((q) => [q.id, match.slotOf(q.id)]));
      const sync = new BolaNetSync(world, {
        meId: 'bia',
        minDelay: 45,
        rtt: () => 20,
        now: () => T,
        slotOf: () => slotOf,
      });
      const moves: string[] = [];
      (sync as unknown as { o: { onMove: (e: string) => void } }).o.onMove = (e) => moves.push(e);
      const frame = () => {
        match.tick();
        const f = match.drainFrame(true);
        if (f) sync.push(f as unknown as { t?: number; b: number[]; p: number[][] }, T);
      };
      for (let i = 0; i < 400; i++) {
        T += 16;
        frame();
      }
      world.phase = 'play';
      let maxY = 0;
      const dt = 1 / hz;
      const press = new Set([Math.round(hz * 0.2), Math.round(hz * 0.55)]);
      for (let i = 0; i < hz * 1.5; i++) {
        T += 1000 * dt;
        if (Math.floor(T / 16) !== Math.floor((T - 1000 * dt) / 16)) frame();
        sync.update(dt, { mx: 0, mz: 0 }, press.has(i));
        maxY = Math.max(maxY, world.player('bia')!.y);
      }
      expect(moves).toEqual(['jump', 'airjump']);
      expect(maxY).toBeGreaterThan(1);
    },
  );
});
