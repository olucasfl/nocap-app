import {
  PP_EV_FLOOR,
  PP_EV_NET,
  PP_EV_TABLE,
  ppCopyBall,
  ppNewBall,
  ppNewStepOut,
  ppStepBall,
  type PpBall,
} from './ball';
import {
  PP_PAD_R,
  PP_PAD_SPEED,
  PP_PAD_STIFF,
  PP_PAD_X,
  PP_PAD_Y_MAX,
  PP_PAD_Y_MIN,
  PP_PAD_Z,
  PP_POINT_PAUSE,
  PP_POINTS,
  PP_R,
  PP_TOP,
  PP_L,
  PP_RALLY_MAX,
  PP_REACH_DEAD,
  PP_REACH_FALL,
  PP_REACH_PER_VZ,
  PP_Z_GAIN,
  PP_REACH_MAX,
  PP_REACH_RISE,
  PP_REACH_SERVE,
  PP_REACH_WAIT,
  PP_CATCH,
  PP_SERVE_AUTO,
  PP_SERVE_FRONT,
  PP_SUB,
  PP_TICK,
  ppTossSpeed,
  PP_SERVE_Y,
  PP_SERVE_WAIT,
  PP_REACH_NET,
  PP_Z_SPEED,
  PP_Z_STIFF,
  PP_REST_Y,
  PP_HAND_VZ_MAX,
  PP_VZ_MAX,
} from './constants';
import { ppPaddleHit, type PpHitQuality } from './paddle';
import { ppGuideHit } from './assist';

/**
 * Uma batida "pronta" (só para os bots): a velocidade que a mão teria na hora do contato. Uma pessoa não manda isto: a
 * velocidade da raquete dela vem do movimento do ponteiro.
 */
export interface PpSwing {
  vx: number;
  vy: number;
  /** Para a frente, em direção à rede. */
  vz: number;
  /** Se vier, o alcance da raquete neste tick (no saque o bot estende a raquete até a bola). */
  reach?: number;
}

/** O que cada jogador manda por tick: para onde a raquete vai (plano x, y) e saque (borda de subida). */
export interface PpInput {
  x: number;
  y: number;
  serve: boolean;
  /** Altura do lançamento escolhida na barra (0 a 1), lida na hora em que `serve` sobe. */
  tossV?: number;
  /** Sem ajuda de posição (quem não joga, e os testes): a raquete só vai aonde o ponteiro manda. */
  manual?: boolean;
  /** Alcance pedido (m, 0 a PP_REACH_NET): onde a raquete está entre o fundo e a rede. Sem isso vale o modo antigo (bots, testes). */
  z?: number;
  swing?: PpSwing;
}

export const ppIdleInput = (): PpInput => ({ x: 0, y: 1.3, serve: false, manual: true });

export interface PpPaddle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Quanto a raquete avançou para a frente do plano de espera (m); cresce com a rapidez da mão. */
  reach: number;
  /** Velocidade para a frente (m/s). */
  vz: number;
  /** 0 a 1: pulso depois de uma batida (só para desenhar). */
  swing: number;
}

/** Velocidade para a frente (m/s) que a raquete leva para a bola, pela rapidez da mão (m/s). */
export function ppForwardSpeed(handSpeed: number): number {
  return Math.max(0, Math.min(PP_VZ_MAX, (handSpeed - PP_REACH_DEAD) * PP_Z_GAIN));
}

/**
 * A mão segue o ponteiro como uma mola com velocidade limitada, e o alcance para a frente acompanha a rapidez dela:
 * parada, a raquete fica no plano de espera; mexida rápido, ela avança e leva a bola junto. `minReach` mantém a raquete
 * um pouco adiantada (quem vai sacar). Usada pela partida e para suavizar a raquete do outro jogador na rede.
 */
export function ppPadStep(pad: PpPaddle, tx: number, ty: number, dt: number, minReach = 0): void {
  const cx = Math.max(-PP_PAD_X, Math.min(PP_PAD_X, tx));
  const cy = Math.max(PP_PAD_Y_MIN, Math.min(PP_PAD_Y_MAX, ty));
  let vx = (cx - pad.x) * PP_PAD_STIFF;
  let vy = (cy - pad.y) * PP_PAD_STIFF;
  const sp = Math.hypot(vx, vy);
  if (sp > PP_PAD_SPEED) {
    vx *= PP_PAD_SPEED / sp;
    vy *= PP_PAD_SPEED / sp;
  }
  pad.vx = vx;
  pad.vy = vy;
  pad.x += vx * dt;
  pad.y += vy * dt;
  // a velocidade para a frente vem da rapidez da mão, na hora (quanto mais rápido a mão, mais forte a batida); o alcance
  // (onde a raquete está em z) acompanha essa velocidade
  pad.vz = ppForwardSpeed(Math.hypot(vx, vy));
  const want = Math.max(minReach, Math.min(PP_REACH_MAX, pad.vz * PP_REACH_PER_VZ));
  const rate = want > pad.reach ? PP_REACH_RISE : PP_REACH_FALL;
  pad.reach += (want - pad.reach) * Math.min(1, rate * dt);
  pad.swing = Math.max(0, pad.swing - dt * 6);
}

/**
 * Raquete do jogo de verdade: x segue a mão, a altura acompanha a bola (ou fica em repouso) e o alcance (z) vai de onde está
 * até onde a mão pede, em velocidade limitada. A velocidade para a frente (`vz`) é a do próprio avanço: a força da batida
 * vem do impulso de quem joga a raquete para a frente.
 */
export function ppPadStepZ(pad: PpPaddle, tx: number, ty: number, tz: number, dt: number): void {
  const cx = Math.max(-PP_PAD_X, Math.min(PP_PAD_X, tx));
  const cy = Math.max(PP_PAD_Y_MIN, Math.min(PP_PAD_Y_MAX, ty));
  let vx = (cx - pad.x) * PP_PAD_STIFF;
  let vy = (cy - pad.y) * PP_PAD_STIFF;
  const sp = Math.hypot(vx, vy);
  if (sp > PP_PAD_SPEED) {
    vx *= PP_PAD_SPEED / sp;
    vy *= PP_PAD_SPEED / sp;
  }
  pad.x += vx * dt;
  pad.y += vy * dt;
  pad.vx = vx;
  // a altura é automática: a subida e descida dela não conta como golpe
  pad.vy = Math.max(-1, Math.min(1, vy * 0.2));
  const goal = Math.max(0, Math.min(PP_REACH_NET, tz));
  const vz = Math.max(-PP_Z_SPEED, Math.min(PP_Z_SPEED, (goal - pad.reach) * PP_Z_STIFF));
  pad.reach += vz * dt;
  pad.vz = Math.max(0, Math.min(PP_HAND_VZ_MAX, vz));
  pad.swing = Math.max(0, pad.swing - dt * 6);
}

export type PpPhase = 'serve' | 'toss' | 'rally' | 'point' | 'over';

/** Uma batida já resolvida: quem bateu e a bola logo depois (para mandar pela rede ou aplicar de novo). */
export interface PpHitRecord {
  p: number;
  serve: boolean;
  smash: boolean;
  kmh: number;
  quality: PpHitQuality;
  spin: number;
  /** x, y, z, vx, vy, vz, wx, wy, wz da bola depois da batida. */
  b: number[];
}

/** O estado que a partida precisa para voltar no tempo (a raquete não entra: só serve para detectar batida). */
export interface PpSnapshot {
  tick: number;
  b: number[];
  phase: PpPhase;
  server: number;
  lastHitter: number;
  bounces: [number, number];
  serveFaults: number;
  rally: number;
  bestKmh: number;
  t: number;
  winner: number;
  score: [number, number];
  firstServer: number;
}
export type PpReason = 'miss' | 'own' | 'out' | 'net' | 'serve';

export type PpEvent =
  | { type: 'toss'; p: number }
  | {
      type: 'hit';
      p: number;
      /** km/h (a bola tem escala de jogo; o número é o que a pessoa lê). */
      kmh: number;
      smash: boolean;
      quality: PpHitQuality;
      spin: number;
      serve: boolean;
    }
  | { type: 'bounce'; side: number; x: number; z: number; impact: number }
  | { type: 'net' }
  | { type: 'fault'; p: number }
  | {
      type: 'point';
      winner: number;
      reason: PpReason;
      score: [number, number];
      rally: number;
      best: number;
    }
  | { type: 'game'; winner: number; score: [number, number] };

/** Hora do saque: 2 pontos cada um; a partir de 10-10 cada ponto troca. */
export function ppServerFor(first: number, a: number, b: number): number {
  const total = a + b;
  if (a >= PP_POINTS - 1 && b >= PP_POINTS - 1) return first ^ ((total - 2 * (PP_POINTS - 1)) & 1);
  return first ^ (Math.floor(total / 2) & 1);
}

/** m/s do jogo em km/h do número que se mostra (a bola é maior que a real, então multiplica). */
export const ppKmh = (ms: number) => Math.round(ms * 3.6 * 1.7);

/**
 * A partida: raquetes, bola, regras e placar (Ping Fox!, spec 055). Um `tick` = 1/60 s com 4 subpassos de física.
 * Determinística: mesma sequência de entradas, mesmo resultado.
 */
export class PpMatch {
  readonly ball: PpBall = ppNewBall();
  readonly pads: [PpPaddle, PpPaddle] = [
    { x: 0, y: 1.3, vx: 0, vy: 0, reach: 0, vz: 0, swing: 0 },
    { x: 0, y: 1.3, vx: 0, vy: 0, reach: 0, vz: 0, swing: 0 },
  ];
  readonly score: [number, number] = [0, 0];
  phase: PpPhase = 'serve';
  firstServer: number;
  server: number;
  /** Quem bateu por último (-1 = ninguém ainda). */
  lastHitter = -1;
  /** Quiques na mesa de cada lado desde a última batida. */
  bounces: [number, number] = [0, 0];
  /** Faltas de saque seguidas de quem saca. */
  serveFaults = 0;
  rally = 0;
  /** Melhor velocidade (km/h) do ponto atual. */
  bestKmh = 0;
  /** Tempo do estado atual (s). */
  t = 0;
  tick = 0;
  winner = -1;
  events: PpEvent[] = [];
  private out = ppNewStepOut();
  private prev = ppNewBall();
  /** A raquete de cada um no começo do tick (x, y, alcance): os subpassos da bola interpolam daqui até o fim do tick. */
  private before: [number, number, number][] = [
    [0, 1.3, 0],
    [0, 1.3, 0],
  ];
  /** Batida pronta que um bot pediu para este tick. */
  private swingNow: [PpSwing | null, PpSwing | null] = [null, null];
  private serveWas: [boolean, boolean] = [false, false];
  /**
   * Modo rede (spec 055, fase 3): as batidas e o lançamento chegam como eventos (`applyHit`, `tossReq`); só o jogador
   * `localPlayer` detecta a própria batida. Fora disso a partida é uma função dos eventos e do tick.
   */
  net = false;
  localPlayer = -1;
  /** Reaplicando o passado (depois de voltar no tempo): nada é detectado, tudo vem do registro de eventos. */
  replay = false;
  /** Pedido de lançamento para este tick (x da bola), vindo de um evento ou da entrada de quem saca. */
  tossReq: number | null = null;
  tossReqV = 0.5;
  /** Batidas e lançamentos deste jogador que a rede ainda não mandou (esvaziados por quem usa o modo rede). */
  hitOut: (PpHitRecord & { t: number })[] = [];
  tossOut: { t: number; x: number; v: number }[] = [];
  private pendingHit: PpHitRecord | null = null;

  constructor(firstServer = 0) {
    this.firstServer = firstServer;
    this.server = firstServer;
    this.holdBall();
  }

  /** A raquete de um jogador (0 ou 1). */
  pad(p: number): PpPaddle {
    return p === 0 ? this.pads[0] : this.pads[1];
  }

  /** Lado (sinal de z) de cada jogador: 0 = perto da câmera (z > 0). */
  static sign(p: number): number {
    return p === 0 ? 1 : -1;
  }

  /** Quem deve rebater agora. */
  get expect(): number {
    return this.lastHitter < 0 ? this.server : 1 - this.lastHitter;
  }

  /** Onde a bola fica na mão de quem saca: um pouco à frente da raquete (z). */
  handZ(p: number): number {
    return PpMatch.sign(p) * (PP_PAD_Z - PP_SERVE_FRONT);
  }

  private holdBall(): void {
    const b = this.ball;
    const p = this.server;
    b.x = 0;
    b.y = PP_SERVE_Y;
    b.z = this.handZ(p);
    b.vx = b.vy = b.vz = 0;
    b.wx = b.wy = b.wz = 0;
  }

  private movePad(p: number, inp: PpInput): void {
    const pad = this.pad(p);
    if (inp.z !== undefined && !inp.swing) {
      // jogo de verdade: a mão manda x e o alcance (z); a altura acompanha a bola
      const b = this.ball;
      const s = PpMatch.sign(p);
      const planeZ = s * (PP_PAD_Z - pad.reach);
      let ty = PP_REST_Y;
      if (p === this.server && (this.phase === 'serve' || this.phase === 'toss')) ty = b.y;
      else if (
        this.phase === 'rally' &&
        this.expect === p &&
        b.vz * s > 0 &&
        Math.abs(b.z - planeZ) < 3
      )
        ty = b.y;
      // no saque a bola está no meio: a raquete só pode sair um pouco dele (dá para escolher o lado pelo golpe)
      const serving = p === this.server && (this.phase === 'serve' || this.phase === 'toss');
      ppPadStepZ(pad, serving ? Math.max(-0.3, Math.min(0.3, inp.x)) : inp.x, ty, inp.z, PP_TICK);
      this.swingNow[p === 0 ? 0 : 1] = null;
      return;
    }
    // quem vai sacar já estende a raquete um pouco: a bola fica ao alcance de um golpe curto
    const serving = p === this.server && (this.phase === 'serve' || this.phase === 'toss');
    // e quem vai rebater também: com a bola vindo, a raquete já espera um pouco à frente (alcança bola curta)
    const b0 = this.ball;
    // saque fácil: a bola descendo bem na frente da raquete é rebatida mesmo com a mão parada
    const serveReady =
      serving &&
      this.phase === 'toss' &&
      b0.vy < 0 &&
      b0.y < pad.y + 0.12 &&
      Math.hypot(b0.x - pad.x, b0.y - pad.y) < PP_PAD_R * 0.8;
    const stance = serving
      ? serveReady
        ? PP_SERVE_FRONT + 0.12
        : PP_REACH_SERVE
      : this.phase === 'rally' && this.expect === p
        ? PP_REACH_WAIT
        : 0;
    // A raquete vai só aonde a mão da pessoa manda: nada de ir sozinha até a bola.
    const tx = inp.x;
    const ty = inp.y;
    ppPadStep(pad, tx, ty, PP_TICK, stance);
    // um bot pede a batida pronta: a velocidade da mão no contato vem dele
    const sw = inp.swing ?? null;
    this.swingNow[p === 0 ? 0 : 1] = sw;
    if (sw) {
      pad.vx = sw.vx;
      pad.vy = sw.vy;
      pad.vz = sw.vz;
      // o bot não "dispara" a raquete pela rapidez do cursor: o alcance é o de espera, ou o que ele mandar
      pad.reach = sw.reach ?? stance;
    }
  }

  /** Um tick (1/60 s) com as entradas dos dois jogadores. */
  step(inputs: [PpInput, PpInput]): void {
    this.tick++;
    this.t += PP_TICK;
    for (let p = 0; p < 2; p++) {
      const inp = p === 0 ? inputs[0] : inputs[1];
      const pad = this.pad(p);
      this.before[p === 0 ? 0 : 1] = [pad.x, pad.y, pad.reach];
      // na rede só a raquete de quem joga aqui se mexe pela entrada; a do outro vem do fluxo de raquetes
      if (!this.net || p === this.localPlayer) this.movePad(p, inp);
    }
    if (this.phase === 'point') {
      this.ballFall();
      if (this.t >= PP_POINT_PAUSE) this.nextServe();
      return;
    }
    if (this.phase === 'over') {
      this.ballFall();
      return;
    }
    if (this.phase === 'serve') {
      this.holdBall();
      // a bola fica parada na frente da raquete de quem saca; depois de um instante já dá para bater
      if (this.t >= PP_SERVE_WAIT) this.startToss(0);
      return;
    }
    this.serveWas[0] = inputs[0].serve;
    this.serveWas[1] = inputs[1].serve;
    this.tossReq = null;
    for (let i = 0; i < PP_SUB; i++) {
      if (this.phase !== 'toss' && this.phase !== 'rally') break;
      this.subStep(i);
    }
    if (this.phase === 'rally' && this.t > PP_RALLY_MAX) this.letReplay();
    if (this.phase === 'toss' && this.t > PP_SERVE_AUTO) this.autoServe();
    // a batida detectada neste tick vai para a rede com a bola do fim do tick (o resto do tick já passou)
    if (this.pendingHit) {
      const b = this.ball;
      this.pendingHit.b = [b.x, b.y, b.z, b.vx, b.vy, b.vz, b.wx, b.wy, b.wz];
      this.hitOut.push({ ...this.pendingHit, t: this.tick });
      this.pendingHit = null;
    }
  }

  /** O lançamento: a bola sobe da mão de quem saca (no x dado) e espera a raquete. */
  private startToss(x: number): void {
    this.phase = 'toss';
    this.t = 0;
    this.ball.x = x;
    this.ball.y = PP_SERVE_Y;
    this.ball.z = this.handZ(this.server);
    this.ball.vx = this.ball.vy = this.ball.vz = 0;
    this.ball.wx = this.ball.wy = this.ball.wz = 0;
    this.events.push({ type: 'toss', p: this.server });
  }

  /** Quem não saca a tempo tem o saque feito pela sala: um golpe mansinho, igual em todos os aparelhos. */
  private autoServe(): void {
    const p = this.server;
    const b = this.ball;
    b.vz = -PpMatch.sign(p) * 3.4;
    b.vy = 1.2;
    ppGuideHit(b, p);
    this.commitHit(p, true, false, ppKmh(Math.hypot(b.vx, b.vy, b.vz)), 'normal', 0);
  }

  /** Depois do ponto a bola só cai (para a cena ficar viva). */
  private ballFall(): void {
    for (let i = 0; i < PP_SUB; i++) {
      this.out.ev = 0;
      ppStepBall(this.ball, this.out);
    }
  }

  private subStep(sub: number): void {
    const b = this.ball;
    ppCopyBall(b, this.prev);
    // saque: a bola fica parada (sem gravidade) na frente da raquete até levar a raquetada
    if (this.phase === 'toss') return void this.tryContact(sub);
    this.out.ev = 0;
    ppStepBall(b, this.out);
    const o = this.out;
    if (o.ev & PP_EV_NET) this.events.push({ type: 'net' });
    if (o.ev & PP_EV_TABLE) {
      this.events.push({ type: 'bounce', side: o.side, x: o.bx, z: o.bz, impact: o.impact });
      this.onBounce(o.side);
      if (this.phase !== 'rally') return;
    }
    if (o.ev & PP_EV_FLOOR || Math.abs(b.z) > 9 || Math.abs(b.x) > 7 || b.y > 8) {
      this.onDead();
      return;
    }
    this.tryContact(sub);
  }

  /**
   * O contato da raquete com a bola, de verdade: o plano da raquete se move (avança com a mão) e a bola também; há batida
   * quando um passa pelo outro (varredura, nunca atravessa) dentro do disco da raquete. No saque quem bate é quem saca,
   * contra a bola lançada; depois, quem deve devolver, só depois de 1 quique na sua metade.
   */
  private tryContact(sub: number): void {
    let p: number;
    if (this.phase === 'toss') p = this.server;
    else {
      p = this.expect;
      if ((this.bounces[p] ?? 0) < 1) return;
    }
    if (this.net && (this.replay || p !== this.localPlayer)) return;
    // bola a ponto de quicar na mesa: o quique acontece no mesmo tick e a batida chegaria tarde para quem confere
    if (
      this.ball.vy < 0 &&
      this.ball.y < PP_TOP + PP_R + 0.22 &&
      Math.abs(this.ball.z) <= PP_L / 2 + 0.6
    )
      return;
    const s = PpMatch.sign(p);
    const pad = this.pad(p);
    const [x0, y0, r0] = this.before[p === 0 ? 0 : 1] as [number, number, number];
    const k0 = sub / PP_SUB;
    const k1 = (sub + 1) / PP_SUB;
    const plane = (k: number) => s * (PP_PAD_Z - (r0 + (pad.reach - r0) * k));
    const b = this.ball;
    const pr = this.prev;
    const f0 = (pr.z - plane(k0)) * s;
    const f1 = (b.z - plane(k1)) * s;
    if (!(f0 < 0 && f1 >= 0)) {
      // bola que já passou do plano: ainda dá para alcançar (pegar de volta) enquanto a raquete estiver em cima dela
      if (
        this.phase === 'rally' &&
        !this.swingNow[p === 0 ? 0 : 1] &&
        f1 > 0 &&
        f1 < PP_CATCH &&
        Math.hypot(b.x - pad.x, b.y - pad.y) <= PP_PAD_R + PP_R
      ) {
        b.z = plane(k1) - s * 0.01;
        this.hit(p, false, pad.x, pad.y);
      }
      return;
    }
    const t = f0 / (f0 - f1);
    const k = k0 + (k1 - k0) * t;
    const cx = pr.x + (b.x - pr.x) * t;
    const cy = pr.y + (b.y - pr.y) * t;
    const px = x0 + (pad.x - x0) * k;
    const py = y0 + (pad.y - y0) * k;
    if (Math.hypot(cx - px, cy - py) > PP_PAD_R + PP_R * 0.7) return;
    b.x = cx;
    b.y = cy;
    // a bola sai da face (para o lado da rede), sem ficar presa dentro da raquete
    b.z = plane(k) - s * 0.01;
    this.hit(p, this.phase === 'toss', px, py);
  }

  private hit(p: number, serve: boolean, px: number, py: number): void {
    const pad = this.pad(p);
    const sw = this.swingNow[p === 0 ? 0 : 1];
    const info = ppPaddleHit(this.ball, p, {
      x: px,
      y: py,
      vx: sw ? sw.vx : pad.vx,
      vy: sw ? sw.vy : pad.vy,
      vz: sw ? sw.vz : pad.vz,
    });
    pad.swing = 1;
    const kmh = ppKmh(info.speed);
    this.commitHit(p, serve, info.smash, kmh, info.quality, info.spin);
    if (this.net) {
      this.pendingHit = {
        p,
        serve,
        smash: info.smash,
        kmh,
        quality: info.quality,
        spin: info.spin,
        b: [],
      };
    }
  }

  private commitHit(
    p: number,
    serve: boolean,
    smash: boolean,
    kmh: number,
    quality: PpHitQuality,
    spin: number,
  ): void {
    this.lastHitter = p;
    this.bounces = [0, 0];
    this.rally++;
    if (kmh > this.bestKmh) this.bestKmh = kmh;
    if (this.phase === 'toss') this.phase = 'rally';
    // o limite de tempo é por batida: bola parada no ar nunca trava a partida, e uma batida não cai junto do limite
    this.t = 0;
    this.events.push({ type: 'hit', p, kmh, smash, quality, spin, serve });
  }

  /** Aplica uma batida resolvida por quem bateu (vinda da rede ou do registro): a bola passa a ser a do registro. */
  applyHit(r: PpHitRecord): void {
    if (this.phase !== 'toss' && this.phase !== 'rally') return;
    const b = this.ball;
    const v = r.b;
    if (v.length !== 9) return;
    [b.x, b.y, b.z, b.vx, b.vy, b.vz, b.wx, b.wy, b.wz] = v as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    this.pad(r.p).swing = 1;
    this.commitHit(r.p, r.serve, r.smash, r.kmh, r.quality, r.spin);
  }

  /** Foto do estado de agora (para voltar no tempo quando uma batida chega atrasada). */
  snapshot(): PpSnapshot {
    const b = this.ball;
    return {
      tick: this.tick,
      b: [b.x, b.y, b.z, b.vx, b.vy, b.vz, b.wx, b.wy, b.wz],
      phase: this.phase,
      server: this.server,
      lastHitter: this.lastHitter,
      bounces: [this.bounces[0], this.bounces[1]],
      serveFaults: this.serveFaults,
      rally: this.rally,
      bestKmh: this.bestKmh,
      t: this.t,
      winner: this.winner,
      score: [this.score[0], this.score[1]],
      firstServer: this.firstServer,
    };
  }

  restore(s: PpSnapshot): void {
    const b = this.ball;
    [b.x, b.y, b.z, b.vx, b.vy, b.vz, b.wx, b.wy, b.wz] = s.b as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    this.tick = s.tick;
    this.phase = s.phase;
    this.server = s.server;
    this.lastHitter = s.lastHitter;
    this.bounces = [s.bounces[0], s.bounces[1]];
    this.serveFaults = s.serveFaults;
    this.rally = s.rally;
    this.bestKmh = s.bestKmh;
    this.t = s.t;
    this.winner = s.winner;
    this.score[0] = s.score[0];
    this.score[1] = s.score[1];
    this.firstServer = s.firstServer;
    this.events = [];
    this.pendingHit = null;
    this.tossReq = null;
  }

  private onBounce(side: number): void {
    if (this.phase === 'toss') {
      // quicou antes de bater no saque
      this.serveFault(this.server);
      return;
    }
    const h = this.lastHitter;
    if (side === h) {
      // quicou na própria mesa depois de bater
      this.awardPoint(1 - h, this.rally <= 1 ? 'serve' : 'own');
      return;
    }
    const n = (this.bounces[side] ?? 0) + 1;
    this.bounces[side === 0 ? 0 : 1] = n;
    if (n >= 2) this.awardPoint(h, 'miss');
  }

  /** A bola morreu (chão ou longe demais). */
  private onDead(): void {
    if (this.phase === 'toss') {
      this.serveFault(this.server);
      return;
    }
    const h = this.lastHitter;
    const r = 1 - h;
    if ((this.bounces[r] ?? 0) >= 1) this.awardPoint(h, 'miss');
    else this.awardPoint(r, this.rally <= 1 ? 'serve' : 'out');
  }

  /** Falta de saque: a primeira repete, a segunda dá o ponto ao adversário. */
  private serveFault(p: number): void {
    this.serveFaults++;
    this.events.push({ type: 'fault', p });
    if (this.serveFaults >= 2) {
      this.awardPoint(1 - p, 'serve');
      return;
    }
    this.phase = 'serve';
    this.t = 0;
    this.lastHitter = -1;
    this.bounces = [0, 0];
    this.rally = 0;
    this.holdBall();
  }

  private letReplay(): void {
    this.phase = 'serve';
    this.t = 0;
    this.lastHitter = -1;
    this.bounces = [0, 0];
    this.rally = 0;
    this.holdBall();
  }

  private awardPoint(winner: number, reason: PpReason): void {
    if (this.phase === 'point' || this.phase === 'over') return;
    this.score[winner as 0 | 1]++;
    const [a, b] = this.score;
    this.events.push({
      type: 'point',
      winner,
      reason,
      score: [a, b],
      rally: this.rally,
      best: this.bestKmh,
    });
    this.serveFaults = 0;
    this.t = 0;
    const done = Math.max(a, b) >= PP_POINTS && Math.abs(a - b) >= 2;
    if (done) {
      this.phase = 'over';
      this.winner = a > b ? 0 : 1;
      this.events.push({ type: 'game', winner: this.winner, score: [a, b] });
    } else {
      this.phase = 'point';
    }
  }

  private nextServe(): void {
    this.server = ppServerFor(this.firstServer, this.score[0], this.score[1]);
    this.phase = 'serve';
    this.t = 0;
    this.lastHitter = -1;
    this.bounces = [0, 0];
    this.rally = 0;
    this.bestKmh = 0;
    this.holdBall();
  }

  /** Esvazia a fila de eventos (a cena e o som leem daqui). */
  drain(): PpEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
