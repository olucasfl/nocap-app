/**
 * Cérebro dos bots do mata-mata (spec 057). Cada bot é um jogador de verdade: anda com o mesmo movimento do jogador
 * (`fsStepMover`), usa as mesmas armas e a mesma dispersão (`fsFire`) e só mira em quem enxerga (ou onde ouviu/viu por último).
 * O módulo é puro: quem chama (a página) passa os inimigos vivos e aplica o dano dos `FsDmAction`.
 */
import type { FsBox } from './map';
import { FS_MOVE, fsEyeHeight, fsNewMover, fsStepMover, type FsMover } from './movement';
import { FS_DUST_SOLIDS, FS_DUST_HOTSPOTS, fsDustPath } from './dust';
import { fsClearLine, FS_GRENADES, type FsGrenadeId } from './grenades';
import { fsFire, fsGunTick, fsNewGunState, type FsGunState } from './recoil';
import { FS_HEAR_RANGE, FS_WEAPONS, type FsWeaponId } from './weapons';
import type { Vec3 } from './trace';

export type FsDmWeapon = Exclude<FsWeaponId, 'knife'>;

/** Probabilidade de cada arma ser a escolhida ao nascer. */
export const FS_DM_PICK: readonly [FsDmWeapon, number][] = [
  ['ak', 0.24], ['m4', 0.24], ['smg', 0.14], ['shotgun', 0.1], ['sniper', 0.1], ['pistol', 0.1], ['usp', 0.08],
];

/** Como cada arma é usada: distância preferida (m), tiros por rajada e pausa entre rajadas (s). */
export const FS_DM_STYLE: Record<FsDmWeapon, { pref: number; burst: [number, number]; pause: [number, number] }> = {
  ak: { pref: 20, burst: [3, 6], pause: [0.25, 0.5] },
  m4: { pref: 20, burst: [3, 6], pause: [0.25, 0.5] },
  smg: { pref: 12, burst: [5, 9], pause: [0.2, 0.4] },
  shotgun: { pref: 6, burst: [1, 1], pause: [0.1, 0.3] },
  sniper: { pref: 38, burst: [1, 1], pause: [0.2, 0.6] },
  pistol: { pref: 14, burst: [1, 1], pause: [0.12, 0.3] },
  usp: { pref: 14, burst: [1, 1], pause: [0.12, 0.3] },
};

export const FS_DM_SKILL = {
  /** Cone de visão (graus, total) e alcance máximo de visão (m). */
  fov: 140, sight: 70,
  /** Atraso entre ver e começar a atirar (s). */
  react: [0.25, 0.45] as [number, number],
  /** Velocidade de giro da mira (graus por segundo). */
  turn: 380,
  /** Erro extra de mira (graus, a 10 m; cresce com a distância). */
  err: 1.6,
  /** Quem ouve passos até esta distância (m). */
  hearSteps: 12,
};

export interface FsDmFoe {
  id: string;
  x: number;
  y: number;
  z: number;
  /** 0 de pé, 1 agachado. */
  crouch: number;
  /** Faz barulho de passos agora? */
  noisy: boolean;
}

export interface FsDmBrain {
  id: string;
  mover: FsMover;
  /** Para onde olha e mira (graus; 0 = norte, como a câmera). */
  yaw: number;
  pitch: number;
  weapon: FsDmWeapon;
  ammo: number;
  reloadT: number;
  cool: number;
  burstLeft: number;
  gun: FsGunState;
  nades: Record<FsGrenadeId, number>;
  nadeCool: number;
  flashedUntil: number;
  path: [number, number][];
  goal: [number, number] | null;
  stuckT: number;
  lastX: number;
  lastZ: number;
  target: string | null;
  /** Há quanto tempo vê o alvo sem parar, e quanto falta para reagir. */
  react: number;
  lostT: number;
  last: { x: number; z: number } | null;
  strafe: 1 | -1;
  strafeT: number;
  senseT: number;
  acc: number;
  fireAnimT: number;
  anim: 'idle' | 'run' | 'crouchwalk' | 'shoot' | 'jump';
  animSpeed: number;
  /** Mira na cabeça nesta rajada? */
  headAim: boolean;
  speed: number;
}

export type FsDmAction =
  | { type: 'fire'; weapon: FsDmWeapon; origin: Vec3; rays: Vec3[] }
  | { type: 'throw'; kind: FsGrenadeId; origin: Vec3; dir: Vec3; power: number }
  | { type: 'reload'; weapon: FsDmWeapon };

export interface FsDmCtx {
  now: number;
  dt: number;
  rng: () => number;
  boxes?: readonly FsBox[];
  foes: readonly FsDmFoe[];
}

export function fsDmPickWeapon(rng: () => number): FsDmWeapon {
  let r = rng();
  for (const [w, p] of FS_DM_PICK) {
    r -= p;
    if (r <= 0) return w;
  }
  return 'ak';
}

export function fsDmNew(id: string, x: number, z: number, yaw: number, weapon: FsDmWeapon, rng: () => number, y = 0): FsDmBrain {
  const m = fsNewMover(x, z);
  m.y = y;
  return {
    id, mover: m, yaw, pitch: 0, weapon, ammo: FS_WEAPONS[weapon].mag, reloadT: 0, cool: 0.6, burstLeft: 0, gun: fsNewGunState(),
    nades: { frag: rng() < 0.45 ? 1 : 0, flash: rng() < 0.45 ? 1 : 0 },
    nadeCool: 4 + rng() * 6, flashedUntil: 0, path: [], goal: null, stuckT: 0, lastX: x, lastZ: z,
    target: null, react: 0, lostT: 99, last: null, strafe: rng() < 0.5 ? 1 : -1, strafeT: 0.6, senseT: rng() * 0.12, acc: 0, fireAnimT: 0,
    anim: 'idle', animSpeed: 1, headAim: false, speed: 0,
  };
}

const D2R = Math.PI / 180;
const angDiff = (a: number, b: number) => {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};
const yawTo = (dx: number, dz: number) => Math.atan2(-dx, -dz) / D2R;
const between = (rng: () => number, r: readonly [number, number]) => r[0] + rng() * (r[1] - r[0]);

/** Ângulo no plano (x, z) com frente = (cos, sin), como a cena usa, a partir do yaw da câmera. */
export const fsDmHeading = (yaw: number) => Math.atan2(-Math.cos(yaw * D2R), -Math.sin(yaw * D2R));

/** Ouviu um tiro em (x, z) de uma arma: se está dentro do alcance de audição e não vê ninguém, vira para lá. */
export function fsDmHear(b: FsDmBrain, weapon: FsWeaponId, x: number, z: number): void {
  const d = Math.hypot(x - b.mover.x, z - b.mover.z);
  if (d > FS_HEAR_RANGE[weapon] || d < 1) return;
  if (b.target && b.lostT < 0.5) return;
  b.last = { x, z };
}

/** Levou um tiro: o atacante passa a ser o ponto conhecido (mesmo sem ver). */
export function fsDmHurt(b: FsDmBrain, fromX: number, fromZ: number): void {
  b.last = { x: fromX, z: fromZ };
  b.lostT = Math.min(b.lostT, 1);
}

/** Granada de luz: cego e sem atirar por um tempo. */
export const fsDmFlash = (b: FsDmBrain, until: number) => {
  b.flashedUntil = Math.max(b.flashedUntil, until);
  b.target = null;
  b.burstLeft = 0;
};

const eyeOf = (m: FsMover): Vec3 => [m.x, m.y + fsEyeHeight(m), m.z];
const chestOf = (f: FsDmFoe, head: boolean): Vec3 => [f.x, f.y + (head ? 1.17 : 0.9) * (1 - 0.27 * f.crouch), f.z];

/** Um passo de tempo do bot (até 0,05 s); devolve o que ele fez (atirar, jogar granada, recarregar). */
export function fsDmStep(b: FsDmBrain, ctx: FsDmCtx): FsDmAction[] {
  const out: FsDmAction[] = [];
  const { now, dt, rng } = ctx;
  const boxes = ctx.boxes ?? FS_DUST_SOLIDS;
  const w = FS_WEAPONS[b.weapon];
  const st = FS_DM_STYLE[b.weapon];
  const m = b.mover;
  const blind = now < b.flashedUntil;
  fsGunTick(w, b.gun, dt);
  b.cool -= dt;
  b.fireAnimT -= dt;
  b.nadeCool -= dt;
  b.strafeT -= dt;
  if (b.reloadT > 0) {
    b.reloadT -= dt;
    if (b.reloadT <= 0) b.ammo = w.mag;
  }

  // ---- percepção (a cada ~0,12 s)
  b.senseT -= dt;
  const eye = eyeOf(m);
  if (b.senseT <= 0) {
    b.senseT = 0.12;
    let best: FsDmFoe | null = null;
    let bd = 1e9;
    let heard: FsDmFoe | null = null;
    if (!blind) {
      for (const f of ctx.foes) {
        const dx = f.x - m.x;
        const dz = f.z - m.z;
        const d = Math.hypot(dx, dz);
        if (d > FS_DM_SKILL.sight) continue;
        const inCone = Math.abs(angDiff(b.yaw, yawTo(dx, dz))) <= FS_DM_SKILL.fov / 2 || d < 3.5;
        if (inCone && d < bd && fsClearLine(boxes, eye, chestOf(f, false))) {
          best = f;
          bd = d;
        }
        if (f.noisy && d < FS_DM_SKILL.hearSteps && (!heard || d < Math.hypot(heard.x - m.x, heard.z - m.z))) heard = f;
      }
    }
    if (best) {
      if (b.target !== best.id || b.lostT > 0.4) b.react = between(rng, FS_DM_SKILL.react);
      if (b.target !== best.id) b.headAim = rng() < (b.weapon === 'sniper' ? 0.35 : 0.16);
      b.target = best.id;
      b.lostT = 0;
      b.last = { x: best.x, z: best.z };
    } else {
      b.lostT += 0.12;
      if (b.lostT > 0.4 && heard) b.last = { x: heard.x, z: heard.z };
      if (b.lostT > 3) b.target = null;
    }
  }

  const foe = b.target && b.lostT < 0.4 ? ctx.foes.find((f) => f.id === b.target) ?? null : null;
  let wantX = 0;
  let wantZ = 0;
  let move = 0;
  let faceYaw = b.yaw;
  let crouch = false;
  let firing = false;

  if (foe && !blind) {
    const dx = foe.x - m.x;
    const dz = foe.z - m.z;
    const dist = Math.hypot(dx, dz);
    const aimP = chestOf(foe, b.headAim);
    const ay = yawTo(dx, dz);
    const ap = Math.atan2(aimP[1] - eye[1], dist) / D2R;
    faceYaw = ay;
    b.react -= dt;
    // gira a mira para o alvo (limitado pela velocidade de giro)
    const dy = angDiff(b.yaw, ay);
    const maxTurn = FS_DM_SKILL.turn * dt;
    b.yaw += Math.abs(dy) <= maxTurn ? dy : Math.sign(dy) * maxTurn;
    b.pitch += Math.max(-maxTurn, Math.min(maxTurn, ap - b.pitch));
    const onTarget = Math.abs(angDiff(b.yaw, ay)) < 3 + 12 / Math.max(dist, 2) && Math.abs(ap - b.pitch) < 4;
    // posição: longe demais avança, perto demais recua, no meio anda de lado
    const fx = dx / (dist || 1);
    const fz = dz / (dist || 1);
    const sideX = -fz * b.strafe;
    const sideZ = fx * b.strafe;
    if (b.strafeT <= 0) {
      b.strafe = (b.strafe * -1) as 1 | -1;
      b.strafeT = 0.4 + rng() * 0.8;
    }
    const holdStill = b.burstLeft > 0 || b.weapon === 'sniper';
    if (dist > st.pref * 1.35) {
      wantX = fx;
      wantZ = fz;
      move = 0.9;
    } else if (dist < st.pref * 0.5 && b.weapon !== 'shotgun' && b.weapon !== 'smg') {
      wantX = -fx * 0.8 + sideX * 0.6;
      wantZ = -fz * 0.8 + sideZ * 0.6;
      move = 0.8;
    } else if (!holdStill) {
      wantX = sideX;
      wantZ = sideZ;
      move = 0.75;
    }
    crouch = b.weapon === 'sniper' && dist > 20;
    // granada: quando já está lutando a uma distância média
    if (b.nadeCool <= 0 && b.react <= 0 && dist > 9 && dist < 26 && b.reloadT <= 0) {
      const kind: FsGrenadeId | null = b.nades.frag > 0 && rng() < 0.6 ? 'frag' : b.nades.flash > 0 ? 'flash' : b.nades.frag > 0 ? 'frag' : null;
      if (kind) {
        b.nades[kind]--;
        b.nadeCool = 9 + rng() * 8;
        const pitch = 14 + dist * 0.55;
        const power = Math.min(1, 0.4 + dist / 34);
        const cy = ay * D2R;
        const cp = pitch * D2R;
        out.push({
          type: 'throw', kind, origin: [m.x, eye[1] - 0.15, m.z],
          dir: [-Math.sin(cy) * Math.cos(cp), Math.sin(cp), -Math.cos(cy) * Math.cos(cp)], power,
        });
      } else b.nadeCool = 3;
    }
    // atira
    const shotgunRange = b.weapon === 'shotgun' && dist > 15;
    if (b.react <= 0 && onTarget && b.reloadT <= 0 && b.cool <= 0 && !shotgunRange && dist < Math.min(FS_DM_SKILL.sight, w.rangeMod < 0.6 ? 25 : 70)) {
      if (b.ammo <= 0) {
        b.reloadT = w.reload;
        out.push({ type: 'reload', weapon: b.weapon });
      } else {
        if (b.burstLeft <= 0) b.burstLeft = Math.round(between(rng, st.burst));
        const speed = Math.hypot(m.vx, m.vz);
        const shot = fsFire(w, b.gun, { moving: speed > 1, airborne: !m.onGround, ads: false, speed, crouch: m.crouchK > 0.5 }, b.id);
        // erro do jogador virtual: cresce com a distância
        const e = FS_DM_SKILL.err * (0.4 + dist / 25) * (b.weapon === 'sniper' ? 0.45 : 1);
        const ra = rng() * Math.PI * 2;
        const rr = Math.sqrt(rng()) * e;
        const base = [b.yaw + Math.cos(ra) * rr, b.pitch + Math.sin(ra) * rr] as const;
        const rays = (shot.pellets ?? [{ devYaw: shot.devYaw, devPitch: shot.devPitch }]).map((p): Vec3 => {
          const yy = (base[0] + p.devYaw) * D2R;
          const pp = (base[1] + p.devPitch) * D2R;
          return [-Math.sin(yy) * Math.cos(pp), Math.sin(pp), -Math.cos(yy) * Math.cos(pp)];
        });
        out.push({ type: 'fire', weapon: b.weapon, origin: [eye[0], eye[1] - 0.2, eye[2]], rays });
        b.ammo--;
        b.burstLeft--;
        b.fireAnimT = 0.18;
        const interval = 60 / w.rpm + w.boltS;
        b.cool = b.burstLeft > 0 ? interval : interval + between(rng, st.pause);
        firing = true;
      }
    } else if (b.ammo <= 0 && b.reloadT <= 0) {
      b.reloadT = w.reload;
      out.push({ type: 'reload', weapon: b.weapon });
    }
  } else if (!blind && b.last && b.lostT < 8) {
    // perdeu de vista: vai até onde viu/ouviu por último
    if (!b.goal || Math.hypot(b.goal[0] - b.last.x, b.goal[1] - b.last.z) > 3) {
      b.goal = [b.last.x, b.last.z];
      b.path = fsDustPath(m.x, m.z, b.last.x, b.last.z);
    }
    if (Math.hypot(b.last.x - m.x, b.last.z - m.z) < 2) b.last = null;
  } else if (!b.goal || b.path.length === 0) {
    // passeia: um ponto de interesse sorteado
    const spots = FS_DUST_HOTSPOTS.filter(([x, z]) => Math.hypot(x - m.x, z - m.z) > 8);
    const g = spots[Math.floor(rng() * spots.length)]!;
    b.goal = [g[0], g[1]];
    b.path = fsDustPath(m.x, m.z, g[0], g[1]);
  }

  // recarrega sozinho se o carregador está baixo e não há ninguém à vista
  if (!foe && b.reloadT <= 0 && b.ammo < w.mag * 0.4) {
    b.reloadT = w.reload;
    out.push({ type: 'reload', weapon: b.weapon });
  }

  // ---- seguir o caminho (se não está lutando de pé)
  if (!foe || blind || (move > 0 && wantX === 0 && wantZ === 0)) {
    while (b.path.length && Math.hypot(b.path[0]![0] - m.x, b.path[0]![1] - m.z) < 0.55) b.path.shift();
    const p = b.path[0];
    if (p) {
      const dx = p[0] - m.x;
      const dz = p[1] - m.z;
      const d = Math.hypot(dx, dz) || 1;
      wantX = dx / d;
      wantZ = dz / d;
      move = blind ? 0.5 : 1;
      faceYaw = yawTo(dx, dz);
      // olhando para onde anda, a mira gira rápido junto
      const dy = angDiff(b.yaw, faceYaw);
      const maxTurn = 420 * dt;
      b.yaw += Math.abs(dy) <= maxTurn ? dy : Math.sign(dy) * maxTurn;
      b.pitch *= 0.9;
    } else if (!foe) {
      b.goal = null;
      if (!b.last) b.pitch *= 0.9;
    }
  }

  // ---- preso? escolhe outro lugar
  if (move > 0) {
    b.stuckT += dt;
    if (b.stuckT > 0.8) {
      if (Math.hypot(m.x - b.lastX, m.z - b.lastZ) < 0.25) {
        b.goal = null;
        b.path = [];
        b.last = null;
      }
      b.stuckT = 0;
      b.lastX = m.x;
      b.lastZ = m.z;
    }
  }

  // ---- movimento com a física do jogador (passos fixos de 1/60 s)
  b.acc += dt;
  const yawR = b.yaw * D2R;
  const fwdX = -Math.sin(yawR);
  const fwdZ = -Math.cos(yawR);
  const rtX = Math.cos(yawR);
  const rtZ = -Math.sin(yawR);
  const fwd = (wantX * fwdX + wantZ * fwdZ) * move;
  const strafe = (wantX * rtX + wantZ * rtZ) * move;
  while (b.acc >= 1 / 60) {
    b.acc -= 1 / 60;
    fsStepMover(m, { fwd, strafe, jump: false, yaw: b.yaw, speedMul: w.moveMul * 0.92, crouch }, 1 / 60, boxes);
  }
  b.speed = Math.hypot(m.vx, m.vz);
  b.anim = b.fireAnimT > 0 ? 'shoot' : b.speed > 1 ? (m.crouchK > 0.5 ? 'crouchwalk' : 'run') : 'idle';
  b.animSpeed = b.speed > 1 ? Math.min(1.2, b.speed / FS_MOVE.run) : 1;
  void firing;
  void FS_GRENADES;
  return out;
}

/** Separa dois corpos que se sobrepõem (empurra cada um metade): chame depois de mover todos. */
export function fsSeparate(items: readonly { x: number; z: number }[], radius = 0.6): void {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!;
      const c = items[j]!;
      const dx = c.x - a.x;
      const dz = c.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d >= radius || d < 1e-6) continue;
      const push = (radius - d) / 2;
      a.x -= (dx / d) * push;
      a.z -= (dz / d) * push;
      c.x += (dx / d) * push;
      c.z += (dz / d) * push;
    }
  }
}
