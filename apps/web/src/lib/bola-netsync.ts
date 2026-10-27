import { BolaRollback } from './bola-rollback';
import {
  BOL_BALL_R,
  BOL_DT,
  BOL_GRAVITY,
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
  /** Grude que resta e normal da parede em que está colada (spec 052). */
  st: number;
  wx: number;
  wz: number;
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
  /** Passo da simulação deste estado (spec 052). */
  k?: number;
  b: number[];
  p: number[][];
}

export interface NetSyncOptions {
  meId: string;
  /**
   * Como a bola é desenhada: `interp` = estados do líder interpolados (+ bola de mentira só depois de um toque);
   * `local` = a bola anda sempre numa física própria no aparelho e é puxada, sem salto, para onde o líder diz que ela está;
   * `replay` = a cada quadro a bola volta ao último estado do líder e a conta é refeita até agora, com todas as raposas
   * onde estão agora (a própria pela previsão, as outras estendidas pela velocidade); o erro que sobra some em ~0,1 s.
   */
  ballModel?: 'interp' | 'local' | 'replay';
  /** Previsão com rollback da própria raposa e da bola, com entrada por passo (spec 052). Vale só com líder que manda `k`. */
  rollback?: boolean;
  /** Bola local: as outras raposas empurram a bola na posição de agora (estimada), não na de desenho (atrasada). Padrão: desligado (a simulação não mostrou ganho). */
  presentOthers?: boolean;
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

/** Onde a própria raposa (prevista) esteve, para refazer a conta da bola com ela no lugar certo. */
interface OwnSample {
  /** Relógio local (ms) do fim do passo. */
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  flipT: number;
  flipDx: number;
  flipDz: number;
}

/** Quanto tempo (s) o erro de uma correção leva para sumir (a bola desenhada = refeita + erro que encolhe). */
const FADE_S = 0.1;
/** Acima disto (m) a correção não é suavizada: a bola foi para outro lugar (gol, reinício). */
const SNAP_M = 4;

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
  /** Menor (chegada - hora do estado) visto: o caminho "limpo" da rede; o que passa disso é variação (jitter). */
  private offset: number | null = null;
  /** A maior variação recente (ms), que decai devagar: o atraso de desenho cobre ela. */
  private dvPeak = 0;
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
  private lastDt = 1 / 60;
  /** A previsão com rollback (quando ligada). */
  readonly rb: BolaRollback | null;
  private readonly ownHist: OwnSample[] = [];
  /** O estado do líder de onde a bola refeita partiu no quadro anterior. */
  private rpSnap: NetSnap | null = null;
  private readonly rpOff = { x: 0, y: 0, z: 0 };
  private readonly rpA: BolBall = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0 };
  private readonly rpB: BolBall = { x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0 };

  constructor(
    private readonly world: BolWorld,
    private readonly o: NetSyncOptions,
  ) {
    this.interpMs = Math.max(o.minDelay, 80);
    this.pred = new BolPredictor(world.field);
    this.rb = o.rollback
      ? new BolaRollback(world, { meId: o.meId, rtt: o.rtt, slotOf: o.slotOf, onMove: o.onMove })
      : null;
  }

  /** O pacote de entrada por passo a mandar ao líder (`null` se não há nada novo ou a previsão não está valendo). */
  inputPacket(): number[] | null {
    return this.rb?.inputPacket() ?? null;
  }

  /** A bola desenhada neste instante é a "de mentira" (toque previsto ainda não confirmado). */
  get ghostActive(): boolean {
    if (this.o.ballModel === 'replay') return false;
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
      st: 0,
      wx: 0,
      wz: 0,
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
        st: r[15] ?? 3.2,
        wx: r[16] ?? 0,
        wz: r[17] ?? 0,
        at,
      });
    }
    const stamp = typeof f.t === 'number' ? f.t : Date.now();
    const d = at - stamp;
    // o relógio do aparelho x o de quem simula: o menor atraso medido é o "limpo"; sobe só um tiquinho por estado (deriva)
    this.offset = this.offset === null ? d : Math.min(this.offset + 0.01, d);
    const dv = d - this.offset;
    this.dvPeak = Math.max(dv, this.dvPeak * 0.994);
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
    this.snaps.push({ t: stamp, ball, rows });
    if (this.snaps.length > 24) this.snaps.shift();
    if (this.rb && typeof f.k === 'number') this.rb.onFrame({ k: f.k, b: f.b, p: f.p });
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
    this.lastDt = dt;
    const { world } = this;
    const { meId } = this.o;
    const last = this.snaps[this.snaps.length - 1];
    if (!last) return;
    const now = this.o.now();
    // alvo: o último estado + o que passou desde que chegou - o atraso; o relógio de desenho o persegue suave
    // hora de quem simula agora (estimada pelo caminho limpo da rede, não pela última chegada) menos o atraso de desenho
    const target = now - (this.offset ?? last.ball.at - last.t) - this.interpMs;
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
      p.surf = (ra.fl & 16) === 16 ? 1 : (ra.fl & 32) === 32 ? 2 : 0;
      p.stick = ra.st;
      p.wnx = ra.wx;
      p.wnz = ra.wz;
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
    if (this.rb) {
      this.rb.update(dt, input, pressed, world.phase, !!me && !!row);
      if (this.rb.active) {
        this.rb.apply();
        return;
      }
    }
    if (!me || !row) {
      this.predReady = false;
      if (this.o.ballModel === 'local') this.stepLocal(dt, null, last);
      else if (this.o.ballModel === 'replay') this.stepReplay(null, last);
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
      this.ownHist.length = 0;
      if (this.o.ballModel === 'local') this.stepLocal(dt, null, last);
      else if (this.o.ballModel === 'replay') this.stepReplay(null, last);
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
      if (this.o.ballModel === 'replay') {
        this.ownHist.push({
          t: now - this.predAcc * 1000,
          x: me.x,
          y: me.y,
          z: me.z,
          vx: me.vx,
          vy: me.vy,
          vz: me.vz,
          heading: me.heading,
          flipT: me.flipT,
          flipDx: me.flipDx,
          flipDz: me.flipDz,
        });
        if (this.ownHist.length > 90) this.ownHist.shift();
      } else if (world.phase === 'play') {
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
    if (this.o.ballModel === 'replay') {
      this.stepReplay(me, last);
      return;
    }
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

  /** A própria raposa prevista no relógio local `tl` (ms), entre as duas amostras mais próximas. */
  private ownAt(tl: number, into: BolPlayer): boolean {
    const h = this.ownHist;
    if (h.length === 0) return false;
    let hi = h.length - 1;
    while (hi > 0 && (h[hi - 1] as OwnSample).t >= tl) hi--;
    const b = h[hi] as OwnSample;
    const a = (h[Math.max(0, hi - 1)] as OwnSample) ?? b;
    const u = b.t > a.t ? Math.min(1, Math.max(0, (tl - a.t) / (b.t - a.t))) : 1;
    into.x = lerp(a.x, b.x, u);
    into.y = lerp(a.y, b.y, u);
    into.z = lerp(a.z, b.z, u);
    into.vx = b.vx;
    into.vy = b.vy;
    into.vz = b.vz;
    into.heading = b.heading;
    into.flipT = b.flipT;
    into.flipDx = b.flipDx;
    into.flipDz = b.flipDz;
    into.flipHit = false;
    return true;
  }

  /**
   * Refaz a conta da bola: parte do estado do líder `from` e anda até agora, passo a passo, com as raposas onde estão
   * agora e não onde foram desenhadas (as outras estendidas pela própria velocidade, a nossa pela previsão). É o que
   * faltava no modelo local: lá a bola "local" era tocada por raposas atrasadas e depois puxada de volta ao líder.
   */
  private replayFrom(from: NetSnap, me: BolPlayer | null, now: number, out: BolBall) {
    const { world } = this;
    const offset = this.offset ?? from.ball.at - from.t;
    const t0 = from.t + offset;
    const span = Math.min(0.6, Math.max(0, (now - t0) / 1000));
    out.x = from.ball.x;
    out.y = from.ball.y;
    out.z = from.ball.z;
    out.vx = from.ball.vx;
    out.vy = from.ball.vy;
    out.vz = from.ball.vz;
    if (span <= 0) return;
    const slotOf = this.o.slotOf();
    const saved = world.players.map((p) => ({
      p,
      x: p.x,
      y: p.y,
      z: p.z,
      vx: p.vx,
      vy: p.vy,
      vz: p.vz,
      heading: p.heading,
      flipT: p.flipT,
      flipDx: p.flipDx,
      flipDz: p.flipDz,
      flipHit: p.flipHit,
    }));
    const n = Math.max(1, Math.ceil(span / (BOL_DT / BOL_SUBSTEPS)));
    const h = span / n;
    for (let i = 0; i < n; i++) {
      const el = (i + 0.5) * h;
      for (const p of world.players) {
        if (p === me && this.ownAt(t0 + el * 1000, p)) continue;
        const slot = slotOf.get(p.id);
        const row = slot === undefined ? undefined : from.rows.get(slot);
        if (!row) continue;
        const air = (row.fl & 1) === 0;
        p.x = row.x + row.vx * el;
        p.z = row.z + row.vz * el;
        p.y = air ? Math.max(0, row.y + row.vy * el - 0.5 * BOL_GRAVITY * el * el) : row.y;
        p.vx = row.vx;
        p.vy = row.vy;
        p.vz = row.vz;
        p.heading = row.h;
        p.flipT = (row.fl & 2) === 2 ? 0.3 : 0;
        const sp = Math.hypot(row.vx, row.vz);
        p.flipDx = sp > 0.5 ? row.vx / sp : Math.sin(row.h);
        p.flipDz = sp > 0.5 ? row.vz / sp : Math.cos(row.h);
        p.flipHit = false;
      }
      world.ghostBall(out, undefined, h);
    }
    for (const s of saved)
      Object.assign(s.p, {
        x: s.x,
        y: s.y,
        z: s.z,
        vx: s.vx,
        vy: s.vy,
        vz: s.vz,
        heading: s.heading,
        flipT: s.flipT,
        flipDx: s.flipDx,
        flipDz: s.flipDz,
        flipHit: s.flipHit,
      });
  }

  /**
   * Bola "refeita" (rollback): a cada quadro a bola volta ao último estado do líder e a conta é refeita até agora. Quando
   * chega um estado novo, a diferença entre a conta antiga e a nova no instante de agora vira um erro que encolhe em
   * ~0,1 s: a bola não anda "até" o lugar certo, só deixa de estar errada aos poucos.
   */
  private stepReplay(me: BolPlayer | null, last: NetSnap) {
    const { world } = this;
    const ball = world.ball;
    if (world.phase !== 'play') {
      this.rpSnap = null;
      this.rpOff.x = this.rpOff.y = this.rpOff.z = 0;
      return;
    }
    const now = this.o.now();
    const off = this.rpOff;
    if (this.rpSnap && this.rpSnap !== last) {
      // estado novo: quanto a conta nova muda a bola de agora em relação à conta anterior
      this.replayFrom(this.rpSnap, me, now, this.rpA);
      this.replayFrom(last, me, now, this.rpB);
      off.x += this.rpA.x - this.rpB.x;
      off.y += this.rpA.y - this.rpB.y;
      off.z += this.rpA.z - this.rpB.z;
      if (Math.hypot(off.x, off.y, off.z) > SNAP_M) off.x = off.y = off.z = 0;
    } else if (!this.rpSnap) {
      off.x = off.y = off.z = 0;
    }
    this.rpSnap = last;
    this.replayFrom(last, me, now, this.rpB);
    const k = Math.exp(-this.lastDt / FADE_S);
    off.x *= k;
    off.y *= k;
    off.z *= k;
    ball.x = this.rpB.x + off.x;
    ball.y = Math.max(BOL_BALL_R, this.rpB.y + off.y);
    ball.z = this.rpB.z + off.z;
    ball.vx = this.rpB.vx;
    ball.vy = this.rpB.vy;
    ball.vz = this.rpB.vz;
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
      // as outras raposas são desenhadas atrasadas; quem empurra a bola de verdade (no servidor) está no presente
      const moved: { p: BolPlayer; x: number; z: number }[] = [];
      if (this.o.presentOthers === true) {
        const slotOf = this.o.slotOf();
        for (const p of world.players) {
          if (p === me) continue;
          const slot = slotOf.get(p.id);
          const row = slot === undefined ? undefined : last.rows.get(slot);
          if (!row) continue;
          moved.push({ p, x: p.x, z: p.z });
          p.x = row.x + row.vx * lead;
          p.z = row.z + row.vz * lead;
        }
      }
      while (acc > 1e-9) {
        const s = Math.min(h, acc);
        acc -= s;
        // todas as raposas (como desenhadas aqui) empurram a bola local; o toque da própria guarda o chute
        if (world.ghostBall(L, undefined, s) && me && Math.hypot(me.x - L.x, me.z - L.z) < 2.4) {
          this.touchHold = 0.35;
          this.stats.ghostHits++;
        }
      }
      for (const m of moved) {
        m.p.x = m.x;
        m.p.z = m.z;
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
