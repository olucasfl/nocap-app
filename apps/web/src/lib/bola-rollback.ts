import {
  BOL_DT,
  BOL_SUBSTEPS,
  controlBody,
  moveBody,
  BolWorld,
  type BolBall,
  type BolInfo,
  type BolPhase,
  type BolPlayer,
} from '@nocap/games';

/**
 * Previsão com rollback do Fut Fox online (spec 052), no estilo do rl-like: o aparelho roda a própria cópia da partida
 * alguns passos À FRENTE do líder, então a raposa e a bola respondem na hora. Cada estado do líder (com o número do passo)
 * é comparado com o que o aparelho previu para aquele passo; se discordam, o aparelho volta ao estado do líder e refaz os
 * passos com as entradas que o líder ainda não confirmou. A diferença vira um deslocamento visual que some em ~0,1 s.
 *
 * Duas peças fazem isso certo (e faltavam antes):
 * - a entrada de cada passo vai carimbada com o número dele e o líder a aplica NO passo (repetindo a última se atrasar), então
 *   a conta do aparelho e a do líder partem das mesmas entradas;
 * - o relógio de simulação do aparelho se ajusta sozinho para o líder sempre ter ~3 passos de entrada de folga.
 *
 * É puro (sem tela nem relógio próprio): o jogo e a simulação de rede dos testes usam este mesmo código.
 */

/** Um estado do líder: `k` é o passo; as linhas são as do fluxo `[vaga, x, y, z, vx, vy, vz, h, flags, ack, ft, fdx, fdz]`. */
export interface RbFrame {
  k: number;
  b: number[];
  p: number[][];
}

export interface RbOptions {
  meId: string;
  /** Ida e volta até o líder (ms). */
  rtt: () => number;
  /** id do corpo -> vaga no fluxo. */
  slotOf: () => Map<string, number>;
  /** Som e efeito do pulo da própria raposa, na hora. */
  onMove?: (e: 'jump' | 'airjump' | 'flip') => void;
}

export interface RbStats {
  snapshots: number;
  agreed: number;
  replays: number;
  replayTicks: number;
  catchUps: number;
  resyncs: number;
  /** Entrada que o líder recebeu tarde demais (folga menor que zero). */
  lateInputs: number;
}

/** Ajustes (a simulação de rede os varia para achar o melhor par). */
export const RB = {
  /** Quantos passos de entrada o líder deve ter em mãos quando simula um passo. */
  targetLead: 2,
  /** Velocidade (1/s) com que o erro visual some. */
  smoothRate: 8,
  /**
   * A bola é desenhada mais perto do que o líder já fez do que a previsão (que anda à frente por metade da ida e volta + a
   * folga): quanto maior a ida e volta, mais ela fica para trás. `ping` é a ida e volta (ms) até a qual a bola é desenhada na
   * previsão inteira; de `ping` a `pingMax` ela volta para `minShare` da previsão. Perto do líder o toque na bola responde na
   * hora; longe, a bola não "pula" a cada toque de outra raposa que a previsão não viu.
   */
  ping: 30,
  pingMax: 150,
  minShare: 0.5,
};
/** Passada essa diferença (passos) por tempo demais, o relógio salta em vez de se ajustar. */
const HARD_RESYNC_TICKS = 40;
/** Correções maiores que isto (m) não são suavizadas (gol, reinício, empurrão enorme). */
const MAX_SMOOTH_M = 2.5;
/** Tolerância para "a previsão bateu com o líder". */
const POS_TOL = 0.04;
const VEL_TOL = 0.25;
/** Quantos passos de entrada seguem em cada pacote (a perda de um não custa um aperto de pulo). */
const PACKET_TICKS = 8;

interface Input {
  mx: number;
  mz: number;
  jump: boolean;
}

const NEUTRAL: Input = { mx: 0, mz: 0, jump: false };
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Corpo e bola de um passo: o que a tela desenha e o que a comparação com o líder usa. */
interface Rec {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  bx: number;
  by: number;
  bz: number;
  bvx: number;
  bvy: number;
  bvz: number;
}

export class BolaRollback {
  readonly stats: RbStats = {
    snapshots: 0,
    agreed: 0,
    replays: 0,
    replayTicks: 0,
    catchUps: 0,
    resyncs: 0,
    lateInputs: 0,
  };
  /** A previsão está valendo (sincronizada e a própria raposa em campo). */
  active = false;
  /** O passo que a previsão já simulou. */
  tick = 0;
  /** Folga atual de entrada no líder (passos): o que o relógio tenta manter em RB.targetLead. */
  lead: number = RB.targetLead;
  private pw: BolWorld | null = null;
  /** Quem não tem entrada conhecida (líder antigo): segue a própria velocidade em vez de ser simulado. */
  private remote = new Set<string>();
  /** A última entrada de cada outra raposa (vem no quadro): a previsão as simula acelerando e virando. */
  private readonly remoteIn = new Map<string, Input>();
  private synced = false;
  private phase: BolPhase = 'countdown';
  private snap: RbFrame | null = null;
  private lastK = -1;
  private acc = 0;
  private scale = 1;
  private leadStreak = 0;
  private ackTick = -1;
  private pressLatch = false;
  private lastIn: Input = NEUTRAL;
  private readonly pending = new Map<number, Input>();
  private readonly hist = new Map<number, Rec>();
  private readonly off = { mx: 0, my: 0, mz: 0, bx: 0, by: 0, bz: 0 };
  private rosterKey = '';
  /** A folga de agora: sobe quando entradas chegam tarde (rede com variação) e desce de volta quando a rede se acalma. */
  private leadTarget: number = RB.targetLead;
  private cleanSnaps = 0;
  /** Passos por quadro de tela (média): tela lenta simula em rajadas e precisa de mais folga. */
  private frameTicks = 1;

  constructor(
    private readonly draw: BolWorld,
    private readonly o: RbOptions,
  ) {}

  /** O mundo de previsão: mesma lista de corpos do mundo que a tela desenha. */
  private world(): BolWorld {
    const infos: BolInfo[] = this.draw.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      team: p.team,
      bot: p.bot,
    }));
    const key = infos.map((i) => `${i.id}:${i.team}`).join(',');
    if (!this.pw || key !== this.rosterKey) {
      this.rosterKey = key;
      const pw = new BolWorld(infos, {
        teams: this.draw.field.teams,
        perTeam: this.draw.field.perTeam,
      });
      // a lista mudou (entrou ou saiu alguém, trocou de time): o corpo novo nasce do próximo estado do líder
      if (this.pw) for (const p of pw.players) this.copyBody(this.pw.player(p.id), p);
      this.pw = pw;
      this.remote = new Set(infos.filter((i) => i.id !== this.o.meId).map((i) => i.id));
      if (this.synced && this.snap) this.load(this.snap);
    }
    return this.pw as BolWorld;
  }

  private copyBody(from: BolPlayer | undefined, to: BolPlayer) {
    if (!from || from.team !== to.team) return;
    Object.assign(to, {
      x: from.x,
      y: from.y,
      z: from.z,
      vx: from.vx,
      vy: from.vy,
      vz: from.vz,
      heading: from.heading,
      grounded: from.grounded,
      airJumped: from.airJumped,
      flipT: from.flipT,
      flipDx: from.flipDx,
      flipDz: from.flipDz,
      flipHit: from.flipHit,
    });
  }

  /** Põe no mundo de previsão o estado do líder: corpos e bola. */
  private load(f: RbFrame) {
    const pw = this.world();
    const slotOf = this.o.slotOf();
    const rows = new Map<number, number[]>();
    for (const r of f.p) rows.set(r[0] as number, r);
    for (const p of pw.players) {
      const slot = slotOf.get(p.id);
      const r = slot === undefined ? undefined : rows.get(slot);
      if (!r) continue;
      const fl = r[8] as number;
      p.x = r[1] as number;
      p.y = r[2] as number;
      p.z = r[3] as number;
      p.vx = r[4] as number;
      p.vy = r[5] as number;
      p.vz = r[6] as number;
      p.heading = r[7] as number;
      p.grounded = (fl & 1) === 1;
      p.airJumped = (fl & 4) === 4;
      p.flipHit = (fl & 8) === 8;
      p.flipT = (r[10] as number) ?? 0;
      p.flipDx = (r[11] as number) ?? 0;
      p.flipDz = (r[12] as number) ?? 0;
      p.surf = (fl & 16) === 16 ? 1 : (fl & 32) === 32 ? 2 : 0;
      p.stick = (r[15] as number) ?? 3.2;
      p.wnx = (r[16] as number) ?? 0;
      p.wnz = (r[17] as number) ?? 0;
      this.noteInput(p.id, r);
    }
    pw.ball.x = f.b[0] as number;
    pw.ball.y = f.b[1] as number;
    pw.ball.z = f.b[2] as number;
    pw.ball.vx = f.b[3] as number;
    pw.ball.vy = f.b[4] as number;
    pw.ball.vz = f.b[5] as number;
  }

  /** Guarda a entrada da outra raposa vinda do quadro (ou marca que não há, para ela seguir a velocidade). */
  private noteInput(id: string, r: number[]) {
    if (id === this.o.meId) return;
    if (typeof r[13] === 'number' && typeof r[14] === 'number') {
      this.remoteIn.set(id, { mx: r[13] / 100, mz: r[14] / 100, jump: false });
      this.remote.delete(id);
    } else {
      this.remoteIn.delete(id);
      this.remote.add(id);
    }
  }

  private record(): Rec {
    const pw = this.world();
    const me = pw.player(this.o.meId) as BolPlayer;
    const b = pw.ball;
    return {
      x: me.x,
      y: me.y,
      z: me.z,
      vx: me.vx,
      vy: me.vy,
      vz: me.vz,
      bx: b.x,
      by: b.y,
      bz: b.z,
      bvx: b.vx,
      bvy: b.vy,
      bvz: b.vz,
    };
  }

  /** Um passo da previsão com a entrada dada; `emit`: toca o som do pulo (só nos passos ao vivo, nunca no refazer). */
  private stepOnce(input: Input, emit: boolean) {
    const pw = this.world();
    pw.phase = this.phase;
    const inputs: Record<string, Input> = { [this.o.meId]: input };
    for (const [id, i] of this.remoteIn) inputs[id] = i;
    pw.stepPredict(BOL_DT, inputs, this.remote);
    this.pending.set(this.tick, input);
    this.tick++;
    this.hist.set(this.tick, this.record());
    if (emit && this.o.onMove) {
      for (const e of pw.predEvents) {
        if (e.type === 'jump' && e.id === this.o.meId) this.o.onMove('jump');
        else if (e.type === 'airjump' && e.id === this.o.meId)
          this.o.onMove(e.flip ? 'flip' : 'airjump');
      }
    }
  }

  /** Adota o estado do líder e anda à frente dele por metade da ida e volta mais a folga. */
  private resync(f: RbFrame) {
    this.stats.resyncs++;
    this.load(f);
    this.pending.clear();
    this.hist.clear();
    this.tick = f.k;
    const rttTicks = Math.ceil((this.o.rtt() / 1000) * 60);
    const target = f.k + Math.ceil(rttTicks / 2) + Math.ceil(this.wantLead());
    while (this.tick < target && this.tick < f.k + 120) this.stepOnce(NEUTRAL, false);
    this.hist.set(this.tick, this.record());
    this.lastIn = NEUTRAL;
    this.acc = 0;
    this.scale = 1;
    this.leadStreak = 0;
    this.ackTick = -1;
    this.synced = true;
    this.off.mx = this.off.my = this.off.mz = this.off.bx = this.off.by = this.off.bz = 0;
  }

  /** Chegou um estado do líder. */
  onFrame(f: RbFrame) {
    if (f.k <= this.lastK) return;
    this.lastK = f.k;
    this.snap = f;
    this.stats.snapshots++;
    if (!this.synced || !this.pw) return;
    this.reconcile(f);
  }

  private reconcile(f: RbFrame) {
    const slot = this.o.slotOf().get(this.o.meId);
    const row = slot === undefined ? undefined : f.p.find((r) => r[0] === slot);
    if (!row) {
      this.synced = false;
      return;
    }
    // relógio: o líder deve ter ~RB.targetLead passos da minha entrada em mãos
    const ack = row[9] as number;
    if (ack > 0) {
      this.ackTick = Math.max(this.ackTick, ack);
      this.lead = ack - f.k;
      if (this.lead < 0) {
        this.stats.lateInputs++;
        this.cleanSnaps = 0;
        this.leadTarget = Math.min(RB.targetLead + 3, this.leadTarget + 0.5);
      } else if (++this.cleanSnaps >= 120) {
        this.cleanSnaps = 0;
        this.leadTarget = Math.max(RB.targetLead, this.leadTarget - 0.5);
      }
      const err = this.wantLead() - this.lead;
      if (Math.abs(err) > HARD_RESYNC_TICKS) {
        if (++this.leadStreak > 30) {
          this.resync(f);
          return;
        }
      } else this.leadStreak = 0;
      this.scale = Math.max(0.9, Math.min(1.15, 1 + 0.02 * err));
    }
    // o líder passou do que eu simulei (quadro de tela atrasado): anda os passos que faltam com a última entrada
    if (f.k > this.tick) {
      const gap = f.k - this.tick;
      if (gap > HARD_RESYNC_TICKS) {
        this.resync(f);
        return;
      }
      this.stats.catchUps++;
      while (this.tick < f.k) this.stepOnce(this.lastIn, false);
      this.acc = Math.max(0, this.acc - gap * BOL_DT);
    }
    const h = this.hist.get(f.k);
    const pw = this.world();
    const dp = h
      ? Math.max(
          Math.hypot(h.x - (row[1] as number), h.y - (row[2] as number), h.z - (row[3] as number)),
          Math.hypot(h.bx - f.b[0]!, h.by - f.b[1]!, h.bz - f.b[2]!),
        )
      : Infinity;
    const dv = h
      ? Math.max(
          Math.hypot(
            h.vx - (row[4] as number),
            h.vy - (row[5] as number),
            h.vz - (row[6] as number),
          ),
          Math.hypot(h.bvx - f.b[3]!, h.bvy - f.b[4]!, h.bvz - f.b[5]!),
        )
      : Infinity;
    if (dp <= POS_TOL && dv <= VEL_TOL) {
      this.stats.agreed++;
      // minha raposa e a bola bateram: só as outras raposas são refeitas (o líder sabe onde estão), levadas até o meu passo
      this.refreshRemotes(f);
    } else {
      this.stats.replays++;
      const alpha = Math.min(1, this.acc / BOL_DT);
      const delay = this.ballDelay();
      const before = this.shown(alpha, false, delay);
      const oldTick = this.tick;
      pw.phase = this.phase;
      this.load(f);
      this.tick = f.k;
      this.hist.set(f.k, this.record());
      for (let t = f.k; t < oldTick; t++) {
        this.stepOnce(this.pending.get(t) ?? this.lastIn, false);
        this.stats.replayTicks++;
      }
      const after = this.shown(alpha, true, delay);
      const dx = before.mx - after.mx;
      const dy = before.my - after.my;
      const dz = before.mz - after.mz;
      const bx = before.bx - after.bx;
      const by = before.by - after.by;
      const bz = before.bz - after.bz;
      const o = this.off;
      if (Math.hypot(dx, dy, dz) < MAX_SMOOTH_M) {
        o.mx = dx;
        o.my = dy;
        o.mz = dz;
      } else o.mx = o.my = o.mz = 0;
      if (Math.hypot(bx, by, bz) < MAX_SMOOTH_M) {
        o.bx = bx;
        o.by = by;
        o.bz = bz;
      } else o.bx = o.by = o.bz = 0;
    }
    for (const t of this.pending.keys()) if (t < f.k) this.pending.delete(t);
    for (const t of this.hist.keys()) if (t < f.k - 1) this.hist.delete(t);
  }

  /** As outras raposas voltam ao estado do líder, andadas até o passo da previsão (com a entrada que o líder mandou). */
  private refreshRemotes(f: RbFrame) {
    const pw = this.world();
    const slotOf = this.o.slotOf();
    const steps = Math.max(0, this.tick - f.k);
    const h = BOL_DT / BOL_SUBSTEPS;
    for (const p of pw.players) {
      if (p.id === this.o.meId) continue;
      const slot = slotOf.get(p.id);
      const r = slot === undefined ? undefined : f.p.find((q) => q[0] === slot);
      if (!r) continue;
      const fl = r[8] as number;
      p.x = r[1] as number;
      p.y = r[2] as number;
      p.z = r[3] as number;
      p.vx = r[4] as number;
      p.vy = r[5] as number;
      p.vz = r[6] as number;
      p.heading = r[7] as number;
      p.grounded = (fl & 1) === 1;
      p.airJumped = (fl & 4) === 4;
      p.flipHit = (fl & 8) === 8;
      p.flipT = (r[10] as number) ?? 0;
      p.flipDx = (r[11] as number) ?? 0;
      p.flipDz = (r[12] as number) ?? 0;
      p.surf = (fl & 16) === 16 ? 1 : (fl & 32) === 32 ? 2 : 0;
      p.stick = (r[15] as number) ?? 3.2;
      p.wnx = (r[16] as number) ?? 0;
      p.wnz = (r[17] as number) ?? 0;
      this.noteInput(p.id, r);
      const inp = this.remoteIn.get(p.id);
      for (let i = 0; i < steps; i++) {
        // com entrada conhecida a raposa acelera e vira como no líder; sem ela segue a própria velocidade
        if (inp) controlBody(p, inp, BOL_DT);
        for (let k = 0; k < BOL_SUBSTEPS; k++) moveBody(p, h, pw.field);
      }
    }
  }

  /** A folga que o relógio persegue: a base, o que a rede pediu e os passos que a tela lenta simula de uma vez. */
  private wantLead(): number {
    return Math.min(RB.targetLead + 8, this.leadTarget + Math.max(0, this.frameTicks - 1));
  }

  /** Quantos passos a bola é desenhada atrás da previsão (a previsão anda à frente do líder por metade da ida e volta + a folga). */
  private ballDelay(): number {
    const rtt = this.o.rtt();
    const ahead = rtt / 2 / (1000 / 60) + this.wantLead();
    const t = Math.min(1, Math.max(0, (rtt - RB.ping) / (RB.pingMax - RB.ping)));
    const share = 1 - t * (1 - RB.minShare);
    return Math.min(Math.max(0, this.tick - this.snapK() - 1), ahead * (1 - share));
  }

  private snapK(): number {
    return this.snap ? this.snap.k : this.tick;
  }

  /** O registro no passo `i` (um número fora do que se guardou usa o mais perto). */
  private at(i: number): Rec | undefined {
    return this.hist.get(i) ?? this.hist.get(i + 1) ?? this.hist.get(i - 1);
  }

  /** Onde a raposa e a bola aparecem agora: entre dois passos, mais o erro que ainda está sumindo. A bola vem `delay` passos atrás. */
  private shown(alpha: number, noOffset = false, delay = 0) {
    const a = this.hist.get(this.tick - 1) ?? this.hist.get(this.tick);
    const b = this.hist.get(this.tick);
    const o = noOffset ? { mx: 0, my: 0, mz: 0, bx: 0, by: 0, bz: 0 } : this.off;
    if (!a || !b) return { mx: 0, my: 0, mz: 0, bx: 0, by: 0, bz: 0 };
    // a bola: o mesmo "entre dois passos", só que `delay` passos antes
    const u = this.tick - 1 + alpha - delay;
    const i0 = Math.floor(u);
    const ba = this.at(i0) ?? a;
    const bb = this.at(i0 + 1) ?? b;
    const f = u - i0;
    return {
      mx: lerp(a.x, b.x, alpha) + o.mx,
      my: lerp(a.y, b.y, alpha) + o.my,
      mz: lerp(a.z, b.z, alpha) + o.mz,
      bx: lerp(ba.bx, bb.bx, f) + o.bx,
      by: lerp(ba.by, bb.by, f) + o.by,
      bz: lerp(ba.bz, bb.bz, f) + o.bz,
    };
  }

  /** Um quadro de tela: anda a previsão no ritmo do relógio ajustado e deixa o erro visual sumir. */
  update(
    dt: number,
    input: { mx: number; mz: number },
    pressed: boolean,
    phase: BolPhase,
    inGame: boolean,
  ) {
    this.phase = phase;
    this.frameTicks += (Math.min(0.5, dt) * 60 - this.frameTicks) * 0.1;
    if (pressed) this.pressLatch = true;
    this.active = false;
    if (!inGame || phase === 'over') {
      this.synced = false;
      return;
    }
    if (!this.synced) {
      if (!this.snap) return;
      this.world();
      this.resync(this.snap);
    }
    // a mesma quantização que o líder vai ler (centésimos): a conta dos dois parte das mesmas entradas
    const q: Input = {
      mx: Math.round(input.mx * 100) / 100,
      mz: Math.round(input.mz * 100) / 100,
      jump: false,
    };
    this.acc += dt * this.scale;
    let steps = 0;
    // tela lenta: anda todos os passos do quadro (até meio segundo) em vez de perder tempo e ficar para trás do líder
    const maxSteps = Math.max(12, Math.ceil(Math.min(0.5, dt) / BOL_DT) + 2);
    while (this.acc >= BOL_DT && steps < maxSteps) {
      const step: Input = { ...q, jump: this.pressLatch };
      this.pressLatch = false;
      this.lastIn = { ...q, jump: false };
      this.stepOnce(step, true);
      this.acc -= BOL_DT;
      steps++;
    }
    if (steps === maxSteps) this.acc = 0;
    // o erro visual some
    const k = Math.exp(-RB.smoothRate * dt);
    const o = this.off;
    o.mx *= k;
    o.my *= k;
    o.mz *= k;
    o.bx *= k;
    o.by *= k;
    o.bz *= k;
    this.active = true;
  }

  /** Põe no mundo da tela a própria raposa e, em jogo, a bola. */
  apply() {
    const pw = this.pw;
    if (!pw) return;
    const me = this.draw.player(this.o.meId);
    const mine = pw.player(this.o.meId);
    if (!me || !mine) return;
    const s = this.shown(Math.min(1, this.acc / BOL_DT), false, this.ballDelay());
    me.x = s.mx;
    me.y = Math.max(0, s.my);
    me.z = s.mz;
    me.vx = mine.vx;
    me.vy = mine.vy;
    me.vz = mine.vz;
    me.heading = mine.heading;
    me.grounded = mine.grounded;
    me.airJumped = mine.airJumped;
    me.flipT = mine.flipT;
    me.flipDx = mine.flipDx;
    me.flipDz = mine.flipDz;
    me.flipHit = mine.flipHit;
    me.surf = mine.surf;
    me.stick = mine.stick;
    me.wnx = mine.wnx;
    me.wnz = mine.wnz;
    if (this.phase === 'play') {
      const b: BolBall = this.draw.ball;
      b.x = s.bx;
      b.y = Math.max(0.9, s.by);
      b.z = s.bz;
      b.vx = pw.ball.vx;
      b.vy = pw.ball.vy;
      b.vz = pw.ball.vz;
    }
  }

  /** O pacote de entrada dos últimos passos ainda não confirmados pelo líder (ou `null` se não há). */
  inputPacket(): number[] | null {
    if (!this.synced || this.tick === 0) return null;
    const last = this.tick - 1;
    const first = Math.max(this.ackTick + 1, last - (PACKET_TICKS - 1), 0);
    const out: number[] = [];
    let n = 0;
    for (let t = first; t <= last; t++) {
      const i = this.pending.get(t);
      if (!i) {
        // buraco (depois de um salto do relógio): recomeça do próximo passo com entrada
        out.length = 0;
        n = 0;
        continue;
      }
      if (n === 0) out.push(t, 0);
      out.push(Math.round(i.mx * 100), Math.round(i.mz * 100), i.jump ? 1 : 0);
      n++;
    }
    if (n === 0) return null;
    out[1] = n;
    return out;
  }
}
