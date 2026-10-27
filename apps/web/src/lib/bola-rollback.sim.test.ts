import { BOL_TEAM_COLORS, BolaMatch, BolWorld, type BolInfo } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { BolaNetSync } from './bola-netsync';
import { RB } from './bola-rollback';

/**
 * Simulação de rede do Fut Fox com previsão por rollback (spec 052): o líder roda a partida de verdade (laço de 8 ms,
 * entradas por passo), o outro aparelho roda a `BolaNetSync` do jogo com `rollback` ligado, e a rede tem atraso, variação e
 * perda nos dois sentidos. Relógio virtual e sorteio fixo: o mesmo número sai em qualquer máquina.
 */
interface Profile {
  name: string;
  rtt: number;
  jitter: number;
  spike: number;
  spikeMs: number;
  loss: number;
}

const PROFILES: Profile[] = [
  { name: 'mesma rede (LAN)', rtt: 4, jitter: 1, spike: 0, spikeMs: 0, loss: 0 },
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

interface Result {
  profile: string;
  seconds: number;
  jumps04: number;
  jumps1: number;
  maxStep: number;
  lagMean: number;
  rb: Record<string, number>;
  leadMean: number;
}

function simulate(p: Profile, seconds: number, seed: number, rollback: boolean, fps = 60): Result {
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
    minDelay: 45,
    ballModel: 'replay',
    rollback,
    rtt: () => p.rtt,
    now: () => T,
    slotOf: () => slotOf,
  });
  const oneWay = () => {
    let d = p.rtt / 2 + (rnd() * 2 - 1) * p.jitter;
    if (rnd() < p.spike) d += p.spikeMs;
    return Math.max(1, d);
  };
  const wire: { at: number; fn: () => void }[] = [];
  let lastFrameArrive = 0;
  const truth: { x: number; y: number; z: number }[] = [];
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
  const lags: number[] = [];
  let j04 = 0;
  let j1 = 0;
  let maxStep = 0;
  let started = 0;
  let leadSum = 0;
  let leadN = 0;
  while (T < end) {
    T += 1;
    for (let i = 0; i < wire.length; i++) {
      if ((wire[i] as { at: number }).at <= T) {
        (wire[i] as { fn: () => void }).fn();
        wire.splice(i, 1);
        i--;
      }
    }
    if (T % 8 === 0) {
      const n = match.tick();
      if (n > 0) {
        const f = match.drainFrame(true);
        if (f) {
          const b = match.world.ball;
          truth.push({ x: b.x, y: b.y, z: b.z });
          if (rnd() >= p.loss) {
            const arrive = Math.max(T + oneWay(), lastFrameArrive);
            lastFrameArrive = arrive;
            wire.push({
              at: arrive,
              fn: () =>
                sync.push(
                  f as unknown as { t?: number; k?: number; b: number[]; p: number[][] },
                  T,
                ),
            });
          }
        }
      }
    }
    // a outra pessoa (no aparelho do líder): entrada na hora
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
    }
    if (T >= nextDraw && sync.snaps.length > 0) {
      nextDraw += 1000 / fps;
      const phases = { countdown: 'countdown', play: 'play', goal: 'goal', over: 'over' } as const;
      world.phase = phases[match.world.phase];
      const bia = world.player('bia');
      let mi = { mx: 0, mz: 0 };
      if (bia && world.phase === 'play') mi = chase(bia, world.ball);
      const press =
        world.ball.y > 2 &&
        bia !== undefined &&
        Math.hypot(world.ball.x - bia.x, world.ball.z - bia.z) < 4 &&
        T - lastJumpBia > 1200;
      if (press) lastJumpBia = T;
      sync.update(1 / fps, mi, press);
      const pkt = sync.inputPacket();
      if (pkt && rnd() >= p.loss)
        wire.push({ at: T + oneWay(), fn: () => match.input('bia', pkt) });
      else if (!pkt && !rollback && bia && world.phase === 'play') {
        // sem previsão por passo: o formato antigo, a cada quadro
        if (press) jumpsBia++;
        const legacy = [
          Math.round(mi.mx * 100) / 100,
          Math.round(mi.mz * 100) / 100,
          jumpsBia,
          ++seq,
        ];
        if (rnd() >= p.loss) wire.push({ at: T + oneWay(), fn: () => match.input('bia', legacy) });
      }
      if (sync.rb?.active) {
        leadSum += sync.rb.lead;
        leadN++;
      }
      const b = world.ball;
      if (started === 0) started = T;
      const measuring = T - started > 3000 && match.world.phase === 'play';
      if (measuring) {
        if (prev) {
          const raw = Math.hypot(b.x - prev.x, b.y - prev.y, b.z - prev.z);
          const d = Math.abs(raw - Math.hypot(b.vx, b.vy, b.vz) / fps);
          if (d > maxStep) maxStep = d;
          if (d > 1) j1++;
          if (d > 0.4) j04++;
        }
        const tr = truth[truth.length - 1];
        if (tr) lags.push(Math.hypot(b.x - tr.x, b.y - tr.y, b.z - tr.z));
        prev = { x: b.x, y: b.y, z: b.z };
      } else prev = null;
    }
  }
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  return {
    profile: p.name,
    seconds,
    jumps04: j04,
    jumps1: j1,
    maxStep,
    lagMean: mean(lags),
    rb: sync.rb ? { ...sync.rb.stats } : {},
    leadMean: leadN ? leadSum / leadN : 0,
  };
}

describe('Fut Fox online: tela lenta', () => {
  it('a 30 e a 20 quadros por segundo a folga sobe sozinha e as entradas não chegam tarde', () => {
    RB.targetLead = 2;
    RB.smoothRate = 8;
    RB.minShare = 0.5;
    for (const fps of [60, 30, 20]) {
      const p = PROFILES[1] as Profile;
      const rs = [1, 2].map((sd) => simulate(p, 60, sd, true, fps));
      const late = rs.reduce((s, r) => s + (r.rb.lateInputs ?? 0), 0);
      const snaps = rs.reduce((s, r) => s + (r.rb.snapshots ?? 0), 0);
      const lead = rs.reduce((s, r) => s + r.leadMean, 0) / rs.length;
      const j1 = rs.reduce((s, r) => s + r.jumps1, 0);
      console.log(
        `fps ${fps}: folga ${lead.toFixed(1)} passos, entradas tardias ${((late / snaps) * 100).toFixed(1)}%, saltos>1m ${j1}`,
      );
      expect(late / snaps, `fps ${fps}`).toBeLessThan(0.2);
    }
  });
});

describe('Fut Fox online: previsão com rollback e entrada por passo', () => {
  it('mede saltos da bola por perfil de rede (com e sem rollback)', () => {
    const SEEDS = [1, 2, 3];
    for (const rollback of [false, true]) {
      RB.targetLead = 2;
      RB.smoothRate = 8;
      RB.minShare = 0.5;
      const rows: Record<string, number | string>[] = PROFILES.map((p) => {
        const rs = SEEDS.map((sd) => simulate(p, 90, sd, rollback));
        const sum = (f: (r: Result) => number) => rs.reduce((s, r) => s + f(r), 0);
        const secs = sum((r) => r.seconds);
        const rb: Record<string, number> = {};
        for (const r of rs) for (const [k, v] of Object.entries(r.rb)) rb[k] = (rb[k] ?? 0) + v;
        return {
          rede: p.name,
          'saltos>0,4m/min': +((sum((r) => r.jumps04) * 60) / secs).toFixed(2),
          'saltos>1m/min': +((sum((r) => r.jumps1) * 60) / secs).toFixed(2),
          'maior passo (m)': +Math.max(...rs.map((r) => r.maxStep)).toFixed(2),
          'defasagem média (m)': +(sum((r) => r.lagMean) / rs.length).toFixed(2),
          'folga média (passos)': +(sum((r) => r.leadMean) / rs.length).toFixed(1),
          ...rb,
        };
      });
      console.log(rollback ? 'COM rollback (spec 052)' : 'SEM rollback (bola refeita)');
      console.table(rows);
      expect(rows).toHaveLength(PROFILES.length);
      if (rollback) {
        // mesma rede e Wi-Fi: sem salto grande; internet boa: raro (a bola ficou mais viva com rampa e chute forte); e a previsão precisa estar valendo
        for (const [i, r] of rows.slice(0, 3).entries()) {
          expect(r['saltos>1m/min'] as number, r.rede as string).toBeLessThan(i < 2 ? 0.6 : 1.2);
          expect(r.snapshots as number, r.rede as string).toBeGreaterThan(1000);
          expect(r.agreed as number, r.rede as string).toBeGreaterThan(r.replays as number);
        }
      }
    }
  });
});
