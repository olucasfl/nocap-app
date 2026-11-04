import { FS_DM_STYLE } from './dm';
import type { FsTargetSpec } from './map';
import { FS_WEAPONS, type FsWeaponId } from './weapons';

export type FsBotKind = 'walk' | 'shift' | 'crouch' | 'jump' | 'turn' | 'shoot';

/** Bot de treino: anda de um ponto a outro (ou pula parado, ou gira), só para ver as animações e treinar a mira. Os de tiro olham para (x1, z1) e atiram para lá. */
export interface FsBotSpec extends FsTargetSpec {
  kind: FsBotKind;
  /** Ponto final do trajeto (anda de x,z até aqui e volta). */
  x1: number;
  z1: number;
  /** Só dos atiradores: a arma que usam. */
  weapon?: FsWeaponId;
}

/**
 * Os bots do mapa de treino. Os da sala "Bots andando" percorrem uma raia cada (andando, devagar, agachado, pulando, girando).
 * Os do estande de tiro são "de tiro" (`shoot`): ficam parados em cabines de frente para o paredão e atiram só para a frente,
 * em rajadas, com a arma de cada cabine. Eles nunca miram em quem joga.
 */
export const FS_BOTS: readonly FsBotSpec[] = [
  { id: 'b1', label: 'andando', kind: 'walk', x: -12, z: -12.4, x1: 12, z1: -12.4, armor: 0, helmet: false },
  { id: 'b2', label: 'shift (devagar)', kind: 'shift', x: -12, z: -15.2, x1: 12, z1: -15.2, armor: 0, helmet: false },
  { id: 'b3', label: 'agachado', kind: 'crouch', x: -12, z: -18.3, x1: 10, z1: -18.3, armor: 0, helmet: false },
  { id: 'b4', label: 'pulando', kind: 'jump', x: -9, z: -21.4, x1: -9, z1: -21.4, armor: 0, helmet: false },
  { id: 'b5', label: 'girando', kind: 'turn', x: -9, z: -24.5, x1: -9, z1: -24.5, armor: 0, helmet: false },
  // estande de tiro: uma cabine por arma, todas de frente para o paredão (norte)
  ...(
    [
      ['s1', 'pistol', 19],
      ['s2', 'usp', 23],
      ['s3', 'smg', 27],
      ['s4', 'm4', 31],
      ['s5', 'ak', 35],
      ['s6', 'shotgun', 39],
      ['s7', 'sniper', 43],
    ] as const
  ).map(([id, weapon, x]): FsBotSpec => ({ id, label: `atirador ${weapon}`, kind: 'shoot', weapon, x, z: -15.2, x1: x, z1: -25, armor: 0, helmet: false })),
];

/** Calibração do estande: o paredão fica a ~10 m, então todos atiram de verdade, em rajadas de cada arma. */
export interface FsRangeState {
  cool: number;
  burstLeft: number;
}
export const fsNewRange = (): FsRangeState => ({ cool: 0.8, burstLeft: 0 });

/**
 * Um passo do atirador do estande: devolve se atira agora. O tempo entre tiros é o da arma (rpm e ferrolho); a rajada e a pausa
 * seguem o estilo de cada arma (fuzil em rajadas curtas, pistola tiro a tiro, escopeta e sniper devagar). Não olha para ninguém.
 * `rand` devolve 0 a 1.
 */
export function fsRangeStep(st: FsRangeState, weapon: FsWeaponId, dt: number, rand: () => number): boolean {
  if (weapon === 'knife') return false;
  const w = FS_WEAPONS[weapon];
  const style = FS_DM_STYLE[weapon];
  st.cool -= dt;
  if (st.cool > 0) return false;
  if (st.burstLeft <= 0) st.burstLeft = Math.round(style.burst[0] + rand() * (style.burst[1] - style.burst[0]));
  st.burstLeft--;
  const interval = 60 / w.rpm + w.boltS;
  st.cool = st.burstLeft > 0 ? interval : interval + 0.6 + rand() * 1.4 + style.pause[1];
  return true;
}

/** Velocidades (m/s) de cada tipo de caminhada. */
export const FS_BOT_SPEED: Record<'walk' | 'shift' | 'crouch', number> = { walk: 2.8, shift: 1.4, crouch: 1.1 };

export interface FsBotState {
  x: number;
  y: number;
  z: number;
  vy: number;
  /** Direção em que olha: ângulo no plano (x, z), frente = (cos, sin). */
  h: number;
  crouch: number;
  /** Indo para o ponto final (true) ou de volta (false). */
  out: boolean;
  /** Tempo até o próximo pulo. */
  jumpIn: number;
  anim: 'idle' | 'run' | 'crouchwalk' | 'jump' | 'shoot';
  /** Velocidade de reprodução da animação (andar devagar = mais lento). */
  animSpeed: number;
}

export const fsNewBot = (s: FsBotSpec): FsBotState => ({
  x: s.x, y: 0, z: s.z, vy: 0,
  h: s.kind === 'walk' || s.kind === 'shift' || s.kind === 'crouch' || s.kind === 'shoot' ? Math.atan2(s.z1 - s.z, s.x1 - s.x) : Math.PI / 2,
  crouch: 0, out: true, jumpIn: 0.8, anim: 'idle', animSpeed: 1,
});

const angDiff = (a: number, b: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** Um passo do bot: anda, vira antes de voltar, pula ou gira. Puro e determinístico (sem sorteio). */
export function fsBotStep(st: FsBotState, s: FsBotSpec, dt: number): void {
  if (s.kind === 'shoot') {
    st.anim = 'idle';
    st.animSpeed = 1;
    return;
  }
  if (s.kind === 'turn') {
    st.h += 1.1 * dt;
    st.anim = 'idle';
    st.animSpeed = 1;
    return;
  }
  if (s.kind === 'jump') {
    st.jumpIn -= dt;
    if (st.y <= 0 && st.vy <= 0 && st.jumpIn <= 0) {
      st.vy = 4.8;
      st.jumpIn = 1.9;
    }
    if (st.y > 0 || st.vy > 0) {
      st.vy -= 15 * dt;
      st.y = Math.max(0, st.y + st.vy * dt);
      if (st.y === 0) st.vy = 0;
    }
    st.anim = st.jumpIn > 1.85 || st.y > 0 ? 'jump' : 'idle';
    st.animSpeed = 1;
    return;
  }
  const speed = FS_BOT_SPEED[s.kind];
  const tx = st.out ? s.x1 : s.x;
  const tz = st.out ? s.z1 : s.z;
  const dx = tx - st.x;
  const dz = tz - st.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dz, dx);
  // vira primeiro, depois anda
  const d = angDiff(st.h, want);
  const turn = 5 * dt;
  st.h += Math.abs(d) <= turn ? d : Math.sign(d) * turn;
  const facing = Math.abs(angDiff(st.h, want)) < 0.35;
  const targetCrouch = s.kind === 'crouch' ? 1 : 0;
  st.crouch += Math.sign(targetCrouch - st.crouch) * Math.min(Math.abs(targetCrouch - st.crouch), dt * 6);
  if (facing && dist > 0.05) {
    const step = Math.min(dist, speed * dt);
    st.x += (dx / dist) * step;
    st.z += (dz / dist) * step;
    st.anim = s.kind === 'crouch' ? 'crouchwalk' : 'run';
    st.animSpeed = s.kind === 'shift' ? 0.5 : s.kind === 'crouch' ? 0.8 : 1;
  } else {
    if (dist <= 0.05) st.out = !st.out;
    st.anim = s.kind === 'crouch' ? 'crouchwalk' : 'idle';
    st.animSpeed = s.kind === 'crouch' ? 0 : 1;
  }
}
