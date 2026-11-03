import type { FsTargetSpec } from './map';

export type FsBotKind = 'walk' | 'shift' | 'crouch' | 'jump' | 'turn';

/** Bot de treino: anda de um ponto a outro (ou pula parado, ou gira), só para ver as animações e treinar a mira. */
export interface FsBotSpec extends FsTargetSpec {
  kind: FsBotKind;
  /** Ponto final do trajeto (anda de x,z até aqui e volta). */
  x1: number;
  z1: number;
}

/** Faixa de bots no canto noroeste da arena: uma raia por movimento, cada uma com uma placa. */
export const FS_BOTS: readonly FsBotSpec[] = [
  { id: 'b1', label: 'andando', kind: 'walk', x: -18, z: -11, x1: -8, z1: -11, armor: 0, helmet: false },
  { id: 'b2', label: 'shift (devagar)', kind: 'shift', x: -18, z: -12.8, x1: -8, z1: -12.8, armor: 0, helmet: false },
  { id: 'b3', label: 'agachado', kind: 'crouch', x: -18, z: -14.6, x1: -10, z1: -14.6, armor: 0, helmet: false },
  { id: 'b4', label: 'pulando', kind: 'jump', x: -13, z: -16.4, x1: -13, z1: -16.4, armor: 0, helmet: false },
  { id: 'b5', label: 'girando', kind: 'turn', x: -13, z: -18.2, x1: -13, z1: -18.2, armor: 0, helmet: false },
];

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
  anim: 'idle' | 'run' | 'crouchwalk' | 'jump';
  /** Velocidade de reprodução da animação (andar devagar = mais lento). */
  animSpeed: number;
}

export const fsNewBot = (s: FsBotSpec): FsBotState => ({
  x: s.x, y: 0, z: s.z, vy: 0,
  h: s.kind === 'walk' || s.kind === 'shift' || s.kind === 'crouch' ? Math.atan2(s.z1 - s.z, s.x1 - s.x) : Math.PI / 2,
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
