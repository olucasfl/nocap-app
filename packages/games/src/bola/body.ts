import {
  BOL_ACCEL,
  BOL_AIR_ACCEL,
  BOL_AIR_JUMP,
  BOL_FLIP_LIFT,
  BOL_FLIP_SEC,
  BOL_FLIP_SPEED,
  BOL_FOX_GRAVITY,
  BOL_FOX_R,
  BOL_GOAL_DEPTH,
  BOL_JUMP,
  BOL_SPEED,
  BOL_SUBSTEPS,
} from './constants';
import type { BolField } from './field';
import type { BolInput } from './world';

/** O corpo de uma raposa: o que o movimento (sem a bola) precisa saber. */
export interface BolBody {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  grounded: boolean;
  airJumped: boolean;
  flipT: number;
  flipDx: number;
  flipDz: number;
  flipHit: boolean;
}

/** Até quanto acima do chão uma raposa que estava no chão ainda "gruda" nele (descendo a rampa), em m. */
const BOL_STICK = 0.3;

export type BodyEvent = 'jump' | 'airjump' | 'flip' | 'land';

/** Aperto de pulo, mortal e aceleração. Vale para o servidor e para o preditor do aparelho. */
export function controlBody(
  p: BolBody,
  input: BolInput,
  dt: number,
  emit?: (e: BodyEvent) => void,
): void {
  const mag = Math.hypot(input.mx, input.mz);
  const ix = mag > 1 ? input.mx / mag : input.mx;
  const iz = mag > 1 ? input.mz / mag : input.mz;
  if (input.jump) {
    if (p.grounded) {
      p.vy = BOL_JUMP;
      p.grounded = false;
      emit?.('jump');
    } else if (!p.airJumped) {
      p.airJumped = true;
      if (mag > 0.3) {
        p.flipT = BOL_FLIP_SEC;
        p.flipHit = false;
        p.flipDx = input.mx / mag;
        p.flipDz = input.mz / mag;
        p.vx = p.flipDx * BOL_FLIP_SPEED;
        p.vz = p.flipDz * BOL_FLIP_SPEED;
        // nunca abaixo do que já se sobe: o mortal precisa ser notado mesmo logo após o pulo ou na queda
        p.vy = Math.max(p.vy, BOL_FLIP_LIFT);
        p.heading = Math.atan2(p.flipDx, p.flipDz);
        emit?.('flip');
      } else {
        p.vy = BOL_AIR_JUMP;
        emit?.('airjump');
      }
    }
  }
  if (p.flipT > 0) {
    p.flipT = Math.max(0, p.flipT - dt);
    return;
  }
  const a = (p.grounded ? BOL_ACCEL : BOL_AIR_ACCEL) * dt;
  const dx = ix * BOL_SPEED - p.vx;
  const dz = iz * BOL_SPEED - p.vz;
  const d = Math.hypot(dx, dz);
  if (d <= a) {
    p.vx = ix * BOL_SPEED;
    p.vz = iz * BOL_SPEED;
  } else {
    p.vx += (dx / d) * a;
    p.vz += (dz / d) * a;
  }
  if (mag > 0.1) p.heading = Math.atan2(ix, iz);
}

/** Um passo do corpo: gravidade, chão e paredes do campo. */
export function moveBody(
  p: BolBody,
  h: number,
  field: BolField,
  emit?: (e: BodyEvent) => void,
): void {
  const wasGrounded = p.grounded;
  p.vy -= BOL_FOX_GRAVITY * h;
  p.x += p.vx * h;
  p.y += p.vy * h;
  p.z += p.vz * h;
  // o chão sobe pela rampa perto das paredes; quem estava no chão e desce a rampa acompanha o chão (não "voa" a cada passo)
  const floor = field.floorAt(p.x, p.z);
  if (p.y <= floor || (wasGrounded && p.vy <= 0 && p.y - floor < BOL_STICK)) {
    p.y = floor;
    p.vy = 0;
    if (!p.grounded) {
      p.grounded = true;
      p.airJumped = false;
      p.flipT = 0;
      emit?.('land');
    }
  } else {
    p.grounded = false;
  }
  // a boca do gol está aberta: a raposa entra, com as traves dos lados e o fundo da rede como limite
  for (const e of field.edges) {
    if (e.goal < 0) continue;
    const g = field.goals[e.goal];
    if (!g) continue;
    const d = (p.x - e.ax) * e.nx + (p.z - e.az) * e.nz;
    const t = (p.x - e.mx) * e.tx + (p.z - e.mz) * e.tz;
    // só conta como "dentro do gol" quem já está passando da linha (ou chegando nela) pelo meio da boca
    const lim = g.halfW - BOL_FOX_R;
    if (d < BOL_FOX_R && d > -BOL_GOAL_DEPTH && (Math.abs(t) <= lim || d < 0)) {
      if (d < 0) {
        const ct = Math.max(-lim, Math.min(lim, t));
        p.x += e.tx * (ct - t);
        p.z += e.tz * (ct - t);
      }
      const back = -(BOL_GOAL_DEPTH - BOL_FOX_R);
      if (d < back) {
        p.x += e.nx * (back - d);
        p.z += e.nz * (back - d);
        const vn = p.vx * e.nx + p.vz * e.nz;
        if (vn < 0) {
          p.vx -= vn * e.nx;
          p.vz -= vn * e.nz;
        }
      }
      return;
    }
  }
  for (const e of field.edges) {
    const d = (p.x - e.ax) * e.nx + (p.z - e.az) * e.nz;
    if (d >= BOL_FOX_R) continue;
    p.x += e.nx * (BOL_FOX_R - d);
    p.z += e.nz * (BOL_FOX_R - d);
    const vn = p.vx * e.nx + p.vz * e.nz;
    if (vn < 0) {
      p.vx -= vn * e.nx;
      p.vz -= vn * e.nz;
    }
  }
}

/**
 * Preditor da própria raposa no aparelho: roda a mesma conta do servidor (sem a bola nem as outras raposas) para o
 * movimento e o pulo responderem na hora, e é puxado de volta quando o servidor discorda.
 */
export class BolPredictor {
  readonly body: BolBody = {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: 0,
    grounded: true,
    airJumped: false,
    flipT: 0,
    flipDx: 0,
    flipDz: 0,
    flipHit: false,
  };
  constructor(private readonly field: BolField) {}

  /** Copia o estado inteiro (começo, teletransporte, troca de corpo). */
  reset(src: Partial<BolBody>): void {
    Object.assign(this.body, src);
  }

  step(dt: number, input: BolInput, emit?: (e: BodyEvent) => void): void {
    controlBody(this.body, input, dt, emit);
    const h = dt / BOL_SUBSTEPS;
    for (let i = 0; i < BOL_SUBSTEPS; i++) moveBody(this.body, h, this.field, emit);
  }
}
