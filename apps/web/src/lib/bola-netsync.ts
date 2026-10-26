import {
  BOL_DT,
  BOL_SUBSTEPS,
  BolPredictor,
  type BolBall,
  type BolPlayer,
  type BolWorld,
} from '@nocap/games';

/**
 * Como o aparelho que NÃO simula a partida desenha o Fut Fox online (spec 046/048): guarda os estados que chegam, desenha
 * os outros jogadores e a bola um instante no passado (interpolando entre dois estados), roda a própria raposa na hora
 * com a mesma física de quem simula (previsão) e mostra o contato dela com a bola sem esperar a rede (bola "fantasma").
 * É puro (sem tela nem relógio próprio): o jogo e a simulação de rede dos testes usam este mesmo código.
 */

export interface NetTgt {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  h: number;
  fl: number;
  /** Quando chegou (ms do relógio local). */
  at: number;
}

export interface NetSnap {
  /** Hora de quem simula (ms) deste estado. */
  t: number;
  ball: NetTgt;
  rows: Map<number, NetTgt>;
}

/** O que do quadro do fluxo interessa ao movimento: hora, bola e corpos. */
export interface NetMotion {
  t?: number;
  b: number[];
  p: number[][];
}

export interface NetSyncOptions {
  meId: string;
  /**
   * Como a bola é desenhada: `interp` = estados do líder interpolados (+ bola de mentira só depois de um toque);
   * `local` = a bola anda sempre numa física própria no aparelho e é puxada, sem salto, para onde o líder diz que ela está.
   */
  ballModel?: 'interp' | 'local';
  /** O menor atraso de desenho (ms) que o caminho aguenta. */
  minDelay: number;
  /** Ida e volta até quem simula (ms). */
  rtt: () => number;
  /** Relógio local (ms). */
  now: () => number;
  /** Vaga do corpo no fluxo (id → vaga). */
  slotOf: () => Map<string, number>;
  /** A previsão da própria raposa pulou (som e efeito na hora). */
  onMove?: (e: 'jump' | 'airjump' | 'flip') => void;
}

/** Contadores para o diagnóstico: o que o aparelho precisou corrigir e quantas vezes. */
export interface NetSyncStats {
  /** Reposicionamentos da própria raposa (erro grande demais). */
  predResets: number;
  /** Puxões suaves da própria raposa. */
  predPulls: number;
  /** Bola "de mentira" que nasceu de um toque previsto. */
  ghostHits: number;
  /** Vezes em que o relógio de desenho foi refeito de uma vez (rede parou por mais de 0,7 s). */
  renderSnaps: number;
  /** Vezes em que faltou estado novo e o desenho precisou extrapolar. */
  extrapolations: number;
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** A bola é desenhada este tanto (ms) mais perto do presente que as outras raposas. */
const BALL_AHEAD_MS = 55;

export class BolaNetSync {
  readonly snaps: NetSnap[] = [];
  readonly stats: NetSyncStats = {
    predResets: 0,
    predPulls: 0,
    ghostHits: 0,
    renderSnaps: 0,
    extrapolations: 0,
  };
  /** O atraso de desenho atual (ms). */
  interpMs: number;
  private gapAvg = 16;
  private gapDev = 0;
  private prevAt = 0;
  private renderT = 0;
  private readonly pred: BolPredictor;
  private predReady = false;
  private predAcc = 0;
  /** Um aperto de pulo que ainda não coube em um passo de física (com tela de 120/144 Hz o quadro é menor que o passo). */
  private pressLatch = false;
  private readonly lb: BolBall = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0 };
  private readonly probe: BolBall = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0 };
  private touchHold = 0;
  private lbFade = 0;
  private readonly local: BolBall = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0 };
  private readonly auth: BolBall = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0 };
  private localReady = false;

  constructor(
    private readonly world: BolWorld,
    private readonly o: NetSyncOptions,
  ) {
    this.interpMs = Math.max(o.minDelay, 80);
    this.pred = new BolPredictor(world.field);
  }

  /** A bola desenhada neste instante é a "de mentira" (toque previsto ainda não confirmado). */
  get ghostActive(): boolean {
    return this.o.ballModel === 'local' ? this.touchHold > 0 : this.lbFade > 0;
  }

  /** A bola do último estado recebido (o chute do efeito usa a velocidade dela). */
  get lastBall(): NetTgt | null {
    return this.snaps[this.snaps.length - 1]?.ball ?? null;
  }

  /** Guarda um estado que chegou e ajusta o atraso de desenho ao intervalo medido entre estados. */
  push(f: NetMotion, at: number = this.o.now()) {
    const ball: NetTgt = {
      x: f.b[0]!,
      y: f.b[1]!,
      z: f.b[2]!,
      vx: f.b[3]!,
      vy: f.b[4]!,
      vz: f.b[5]!,
      h: 0,
      fl: 0,
      at,
    };
    const rows = new Map<number, NetTgt>();
    for (const r of f.p) {
      rows.set(r[0]!, {
        x: r[1]!,
        y: r[2]!,
        z: r[3]!,
        vx: r[4]!,
        vy: r[5]!,
        vz: r[6]!,
        h: r[7]!,
        fl: r[8]!,
        at,
      });
    }
    if (this.prevAt > 0) {
      const gap = at - this.prevAt;
      this.gapAvg += (gap - this.gapAvg) * 0.05;
      this.gapDev += (Math.abs(gap - this.gapAvg) - this.gapDev) * 0.08;
      // atraso = dois estados de folga + a variação medida; sobe depressa quando a rede piora e desce devagar
      const want = Math.min(
        260,
        Math.max(this.o.minDelay, this.gapAvg * 2 + this.gapDev * 3.5 + 10),
      );
      this.interpMs += (want - this.interpMs) * (want > this.interpMs ? 0.2 : 0.015);
    }
    this.prevAt = at;
    this.snaps.push({ t: typeof f.t === 'number' ? f.t : Date.now(), ball, rows });
    if (this.snaps.length > 24) this.snaps.shift();
  }

  /** Entre quais dois estados estamos em `t` (ou, se faltar estado novo, o último com um pouco de extrapolação). */
  private bracket(t: number) {
    const snaps = this.snaps;
    const last = snaps[snaps.length - 1] as NetSnap;
    let lo = last;
    let hi = last;
    let k = 0;
    let ex = 0;
    if (t >= last.t) {
      ex = Math.min(0.05, (t - last.t) / 1000);
      if (t > last.t) this.stats.extrapolations++;
    } else {
      lo = hi = snaps[0] as NetSnap;
      for (let i = snaps.length - 1; i >= 1; i--) {
        const l2 = snaps[i - 1] as NetSnap;
        const h2 = snaps[i] as NetSnap;
        if (l2.t <= t) {
          lo = l2;
          hi = h2;
          k = h2.t > l2.t ? Math.min(1, (t - l2.t) / (h2.t - l2.t)) : 0;
          break;
        }
      }
    }
    return { a: lo, b: hi, u: k, extra: ex };
  }

  /** Um quadro de desenho: põe no mundo os outros, a bola e a própria raposa. */
  update(dt: number, input: { mx: number; mz: number }, pressed: boolean) {
    const { world } = this;
    const { meId } = this.o;
    const last = this.snaps[this.snaps.length - 1];
    if (!last) return;
    const now = this.o.now();
    // alvo: o último estado + o que passou desde que chegou - o atraso; o relógio de desenho o persegue suave
    const target = last.t + (now - last.ball.at) - this.interpMs;
    // o relógio de desenho nunca volta para trás: se está adiantado só anda mais devagar, se atrasado anda mais rápido
    // (mexer no atraso de uma vez faria a bola "voltar" no tempo e parecer um teletransporte)
    if (this.renderT === 0 || Math.abs(target - this.renderT) > 700) {
      if (this.renderT !== 0) this.stats.renderSnaps++;
      this.renderT = target;
    } else {
      this.renderT += dt * 1000 * Math.min(1.35, Math.max(0.6, 1 + (target - this.renderT) / 400));
    }
    const rt = this.renderT;
    const { a, b, u, extra } = this.bracket(rt);
    const slotOf = this.o.slotOf();
    for (const p of world.players) {
      if (p.id === meId && this.predReady && world.phase !== 'countdown') continue;
      const slot = slotOf.get(p.id);
      const ra = slot === undefined ? undefined : a.rows.get(slot);
      if (!ra) continue;
      const rb = b.rows.get(slot as number) ?? ra;
      p.x = lerp(ra.x, rb.x, u) + ra.vx * extra;
      p.y = Math.max(0, lerp(ra.y, rb.y, u) + ra.vy * extra);
      p.z = lerp(ra.z, rb.z, u) + ra.vz * extra;
      p.vx = ra.vx;
      p.vy = ra.vy;
      p.vz = ra.vz;
      let dh = rb.h - ra.h;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      p.heading = ra.h + dh * u;
      p.grounded = (ra.fl & 1) === 1;
      p.flipT = (ra.fl & 2) === 2 ? 0.3 : 0;
      p.airJumped = (ra.fl & 4) === 4;
    }
    // a bola é desenhada mais perto do "agora" que as outras raposas: é nela que a sua raposa (já no presente) encosta
    const bb = this.bracket(rt + BALL_AHEAD_MS);
    const ball = world.ball;
    ball.x = lerp(bb.a.ball.x, bb.b.ball.x, bb.u) + bb.a.ball.vx * bb.extra;
    ball.y = Math.max(0.9, lerp(bb.a.ball.y, bb.b.ball.y, bb.u) + bb.a.ball.vy * bb.extra);
    ball.z = lerp(bb.a.ball.z, bb.b.ball.z, bb.u) + bb.a.ball.vz * bb.extra;
    ball.vx = bb.a.ball.vx;
    ball.vy = bb.a.ball.vy;
    ball.vz = bb.a.ball.vz;

    // a própria raposa: roda a mesma conta de quem simula aqui (responde na hora) e é puxada de volta se ele discordar
    const me = world.player(meId);
    const slot = slotOf.get(meId);
    const row = slot === undefined ? undefined : last.rows.get(slot);
    if (!me || !row) {
      this.predReady = false;
      if (this.o.ballModel === 'local') this.stepLocal(dt, null, last);
      return;
    }
    const pred = this.pred;
    const syncMe = () => {
      const bd = pred.body;
      me.x = bd.x;
      me.y = bd.y;
      me.z = bd.z;
      me.vx = bd.vx;
      me.vy = bd.vy;
      me.vz = bd.vz;
      me.heading = bd.heading;
      me.grounded = bd.grounded;
      me.airJumped = bd.airJumped;
      me.flipT = bd.flipT;
      me.flipDx = bd.flipDx;
      me.flipDz = bd.flipDz;
      me.flipHit = bd.flipHit;
    };
    // onde quem simula deve estar agora: o estado + o tempo desde que chegou + a ida da rede (no máximo 40 ms)
    const lead = Math.min(
      0.35,
      Math.max(0, (now - last.ball.at + Math.min(40, this.o.rtt() / 2)) / 1000),
    );
    const sx = row.x + row.vx * lead;
    const sz = row.z + row.vz * lead;
    const flags = {
      grounded: (row.fl & 1) === 1,
      flipT: (row.fl & 2) === 2 ? 0.3 : 0,
      airJumped: (row.fl & 4) === 4,
    };
    if (!this.predReady || world.phase === 'countdown') {
      pred.reset({
        x: row.x,
        y: row.y,
        z: row.z,
        vx: row.vx,
        vy: row.vy,
        vz: row.vz,
        heading: row.h,
        ...flags,
      });
      this.predReady = world.phase !== 'countdown';
      this.predAcc = 0;
      if (this.o.ballModel === 'local') this.stepLocal(dt, null, last);
      return;
    }
    this.predAcc += dt;
    if (pressed) this.pressLatch = true;
    while (this.predAcc >= BOL_DT) {
      this.predAcc -= BOL_DT;
      pred.step(BOL_DT, { mx: input.mx, mz: input.mz, jump: this.pressLatch }, (e) => {
        if (e === 'jump' || e === 'airjump' || e === 'flip') this.o.onMove?.(e);
      });
      this.pressLatch = false;
      syncMe();
      // não atravessa as outras raposas: o corpo previsto sai de dentro delas já neste passo
      world.pushOutOfFoxes(me);
      pred.body.x = me.x;
      pred.body.z = me.z;
      if (world.phase === 'play') {
        if (this.touchHold <= 0 && this.lbFade <= 0) {
          // sem toque recente só se testa o contato: a bola desenhada não anda um passo à frente, e só vira "de mentira" se foi tocada
          Object.assign(this.probe, ball);
          let hit = false;
          for (let i = 0; i < BOL_SUBSTEPS; i++) {
            if (world.ghostBall(this.probe, me, BOL_DT / BOL_SUBSTEPS)) hit = true;
          }
          if (hit) {
            Object.assign(this.lb, this.probe);
            this.touchHold = 0.35;
            this.lbFade = 1;
            this.stats.ghostHits++;
          }
        } else {
          for (let i = 0; i < BOL_SUBSTEPS; i++) {
            if (world.ghostBall(this.lb, me, BOL_DT / BOL_SUBSTEPS)) this.touchHold = 0.35;
          }
        }
      }
      pred.body.flipHit = me.flipHit;
    }
    const body = pred.body;
    const ex = sx - body.x;
    const ez = sz - body.z;
    const err = Math.hypot(ex, ez);
    if (err > 3.5) {
      pred.reset({ x: row.x, y: row.y, z: row.z, vx: row.vx, vy: row.vy, vz: row.vz, ...flags });
      this.stats.predResets++;
    } else if (err > 0.7) {
      // dentro de 0,7 m é só atraso da rede e a raposa responde como no offline; passando disso (empurrão, bola, parede) volta devagar
      const k = 1 - Math.exp(-dt * 3);
      body.x += ex * k;
      body.z += ez * k;
      this.stats.predPulls++;
    }
    syncMe();
    if (this.o.ballModel === 'local') {
      this.stepLocal(dt, me, last);
      return;
    }
    // a bola de mentira volta ao que quem simula diz (devagar logo depois de um toque, para o chute não ser desfeito)
    const lb = this.lb;
    if (world.phase !== 'play') {
      this.touchHold = 0;
      this.lbFade = 0;
    } else if (this.lbFade > 0) {
      // logo depois do toque a bola desenhada é a de mentira; ela volta à de quem simula aos poucos, sem salto
      if (this.touchHold > 0) this.touchHold = Math.max(0, this.touchHold - dt);
      else {
        // passada a espera, a bola de mentira desliza até a dele. A velocidade do deslize é limitada: um erro grande vira
        // um movimento rápido, nunca um teletransporte.
        this.lbFade = Math.max(0, this.lbFade - dt / 1.2);
        const kb = 1 - Math.exp(-dt * 8);
        let dx = (ball.x - lb.x) * kb;
        let dy = (ball.y - lb.y) * kb;
        let dz = (ball.z - lb.z) * kb;
        const len = Math.hypot(dx, dy, dz);
        const cap = 22 * dt;
        if (len > cap) {
          dx *= cap / len;
          dy *= cap / len;
          dz *= cap / len;
        }
        lb.x += dx;
        lb.y += dy;
        lb.z += dz;
        lb.vx += (ball.vx - lb.vx) * kb;
        lb.vy += (ball.vy - lb.vy) * kb;
        lb.vz += (ball.vz - lb.vz) * kb;
        // chegou perto: acabou, a bola desenhada volta a ser a de quem simula
        if (Math.hypot(ball.x - lb.x, ball.y - lb.y, ball.z - lb.z) < 0.25) this.lbFade = 0;
      }
      const w = this.lbFade > 0 ? 1 : 0;
      ball.x = lerp(ball.x, lb.x, w);
      ball.y = lerp(ball.y, lb.y, w);
      ball.z = lerp(ball.z, lb.z, w);
      ball.vx = lerp(ball.vx, lb.vx, w);
      ball.vy = lerp(ball.vy, lb.vy, w);
      ball.vz = lerp(ball.vz, lb.vz, w);
    }
  }

  /**
   * Bola "local": anda sempre numa física própria (a mesma de quem simula, tocada só pela própria raposa) e é puxada para
   * onde o líder diz que ela está agora. A posição nunca salta: o erro some deslizando, com velocidade limitada.
   */
  private stepLocal(dt: number, me: BolPlayer | null, last: NetSnap) {
    const { world } = this;
    const ball = world.ball;
    const A = this.auth;
    const L = this.local;
    if (world.phase !== 'play') {
      this.localReady = false;
      this.touchHold = 0;
      return;
    }
    // onde o líder deve ter a bola agora: o último estado andado, pela mesma física, até o presente (+ a ida da rede)
    const lead = Math.min(
      0.35,
      Math.max(0, (this.o.now() - last.ball.at + this.o.rtt() / 2) / 1000),
    );
    const n = Math.max(1, Math.ceil(lead * 240));
    Object.assign(A, {
      x: last.ball.x,
      y: last.ball.y,
      z: last.ball.z,
      vx: last.ball.vx,
      vy: last.ball.vy,
      vz: last.ball.vz,
    });
    for (let i = 0; i < n; i++) world.ghostBall(A, null, lead / n);
    if (!this.localReady || Math.hypot(A.x - L.x, A.y - L.y, A.z - L.z) > 14) {
      Object.assign(L, A);
      this.localReady = true;
    } else {
      const h = BOL_DT / BOL_SUBSTEPS;
      let acc = dt;
      while (acc > 1e-9) {
        const s = Math.min(h, acc);
        acc -= s;
        // todas as raposas (como desenhadas aqui) empurram a bola local; o toque da própria guarda o chute
        if (world.ghostBall(L, undefined, s) && me && Math.hypot(me.x - L.x, me.z - L.z) < 2.4) {
          this.touchHold = 0.35;
          this.stats.ghostHits++;
        }
      }
      // logo depois de um toque próprio a bola quase não é puxada: o chute aparece inteiro até o líder confirmar
      if (this.touchHold > 0) this.touchHold = Math.max(0, this.touchHold - dt);
      const kp = this.touchHold > 0 ? 0.5 : 8;
      const kv = this.touchHold > 0 ? 0.5 : 10;
      const k = 1 - Math.exp(-dt * kp);
      let dx = (A.x - L.x) * k;
      let dy = (A.y - L.y) * k;
      let dz = (A.z - L.z) * k;
      const len = Math.hypot(dx, dy, dz);
      const cap = 28 * dt * (1 + len / (6 * Math.max(dt, 1e-3) * 60));
      if (len > cap) {
        dx *= cap / len;
        dy *= cap / len;
        dz *= cap / len;
      }
      L.x += dx;
      L.y += dy;
      L.z += dz;
      const kk = 1 - Math.exp(-dt * kv);
      L.vx += (A.vx - L.vx) * kk;
      L.vy += (A.vy - L.vy) * kk;
      L.vz += (A.vz - L.vz) * kk;
    }
    Object.assign(ball, L);
  }
}
