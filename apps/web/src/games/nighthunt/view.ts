import { SWORD_BOXES, VIEW_HEIGHT, VIEW_WIDTH, type Enemy, type NhWorld } from '@nocap/games';
import { animFrame, drawFrame, type Atlas } from './assets';

export const CX = VIEW_WIDTH / 2;
export const CY = VIEW_HEIGHT / 2;
const GROUND = '#4b6d3b';

/** Efeitos de tela (morte de inimigo, coleta de item): só desenho, nada disso entra na simulação. */
export interface Fx {
  key: string;
  x: number;
  y: number;
  t: number;
  dur: number;
}

const ENEMY_ANIM: Record<string, string> = {
  Bat: 'Enemies/Bat/Move',
  Skeleton: 'Enemies/Skeleton/Move',
  Goblin: 'Enemies/Goblin/Move',
  Shark: 'Enemies/Shark/Move',
  Runner: 'Enemies/Runner/Move',
  FlyWorm: 'Enemies/FlyWorm/Move',
  Barbarian: 'Enemies/Barbarian/Run',
  DarkRaven: 'Enemies/DarkRaven/Move',
  BossOrcKing: 'Enemies/BossOrcKing/Run',
  BossStoneGolem: 'Enemies/BossStoneGolem/Run',
};
const ITEM_GFX: Record<string, { anim?: string; frame?: string; ox: number; oy: number }> = {
  xp: { anim: 'Drops/XP', ox: 3, oy: 0 },
  gold: { anim: 'Drops/Gold', ox: 0, oy: 0 },
  health: { anim: 'Drops/Health', ox: 6, oy: 8 },
  magnet: { anim: 'Drops/Magnet', ox: 3, oy: 0 },
  chest: { frame: 'Drops/Chest00', ox: 9, oy: 0 },
};
const PROJ_FRAME: Record<string, string> = {
  horizontal: 'Weapons/ShotHoriz',
  diagonal: 'Weapons/ShotDiag',
  halo: 'Weapons/ShotHalo',
  axe: 'Weapons/ThrowAxe',
};

function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function drawBackground(g: CanvasRenderingContext2D, a: Atlas, camX: number, camY: number): void {
  g.fillStyle = GROUND;
  g.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  const I0 = Math.floor((camX - CX - 280) / 512);
  const I1 = Math.ceil((camX + CX + 280) / 512);
  const J0 = Math.floor((camY - CY - 280) / 512);
  const J1 = Math.ceil((camY + CY + 280) / 512);
  for (let j = J0; j <= J1; j++) {
    for (let i = I0; i <= I1; i++) {
      const tile = a.bgs[Math.floor(hash(i, j) * a.bgs.length)] ?? [];
      const tx = i * 512;
      const ty = j * 512;
      for (const it of tile)
        drawFrame(g, a, it.f, CX + tx + it.x - camX, CY - (ty + it.y - camY), { s: it.s });
    }
  }
}

function enemyAnimKey(e: Enemy, touching: boolean): string {
  const gt = e.s.graphicsType;
  if (gt === 'BossOrcKing' || gt === 'BossStoneGolem')
    return touching ? `Enemies/${gt}/Attack` : `Enemies/${gt}/Run`;
  if (gt === 'Barbarian')
    return e.s.moveType === 'PeriodicFollow' && !e.follow
      ? 'Enemies/Barbarian/Idle'
      : 'Enemies/Barbarian/Run';
  return ENEMY_ANIM[gt] ?? 'Enemies/Bat/Move';
}

export interface WorldDrawState {
  time: number;
  /** Tempo desde a morte (para a animação de morrer), ou -1. */
  deadFor: number;
  hurtFlash: number;
  healFlash: number;
  fx: Fx[];
  dropT: Map<number, number>;
}

/** Desenha o mundo do Night Hunt na tela lógica de 510x680, com o jogador sempre no centro (câmera do Slash). */
export function drawWorld(
  g: CanvasRenderingContext2D,
  a: Atlas,
  w: NhWorld,
  st: WorldDrawState,
): void {
  const camX = w.player.x;
  const camY = w.player.y;
  const sx = (x: number) => CX + x - camX;
  const sy = (y: number) => CY - (y - camY);
  const t = st.time;
  drawBackground(g, a, camX, camY);

  // itens (com um pulinho ao cair, como o DropStart do Slash)
  for (const it of w.items) {
    const gfx = ITEM_GFX[it.type]!;
    const age = w.t - it.born;
    const hop = age < 0.3 ? Math.sin((age / 0.3) * Math.PI) * 14 : 0;
    const frame = gfx.anim ? animFrame(a, gfx.anim, t + it.uid * 0.13) : gfx.frame!;
    const x = sx(it.x) + gfx.ox;
    const y = sy(it.y) - gfx.oy - hop;
    if (x < -40 || x > VIEW_WIDTH + 40 || y < -40 || y > VIEW_HEIGHT + 40) continue;
    drawFrame(g, a, frame, x, y);
  }

  // ímã ativo: anel de alcance
  if (w.magnet.active) {
    g.save();
    g.globalAlpha = 0.18 + 0.1 * Math.sin(t * 8);
    g.strokeStyle = '#7fd7ff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(CX, CY, 260, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  // inimigos e jogador, ordenados por altura para ficar natural
  const list: Array<{ y: number; e?: Enemy }> = [];
  for (const e of w.enemies) {
    const x = sx(e.x);
    const y = sy(e.y);
    if (x < -120 || x > VIEW_WIDTH + 120 || y < -120 || y > VIEW_HEIGHT + 120) continue;
    list.push({ y: e.y, e });
  }
  list.sort((p, q) => q.y - p.y);
  let playerDone = false;
  const drawPlayer = () => {
    playerDone = true;
    const p = w.player;
    const key = st.deadFor >= 0 ? 'Player/Die' : p.moving ? 'Player/Move' : 'Player/Idle';
    const frame = animFrame(a, key, st.deadFor >= 0 ? st.deadFor : t);
    g.save();
    g.globalAlpha = 0.25;
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(CX, CY + 26, 22, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    const tint = st.hurtFlash > 0 ? '#ff2a2a' : st.healFlash > 0 ? '#3cff5a' : undefined;
    drawFrame(g, a, frame, CX, CY, { flip: p.face > 0, tint, tintAlpha: 0.65 });
  };
  for (const o of list) {
    if (!playerDone && o.y < w.player.y) drawPlayer();
    const e = o.e!;
    if (e.life > 0 && e.life <= 2 && Math.floor(t * 2.5) % 2 === 0) continue; // pisca antes de sumir
    const touching = Math.abs(e.x - w.player.x) < 40 && Math.abs(e.y - w.player.y) < 48;
    drawFrame(g, a, animFrame(a, enemyAnimKey(e, touching), t + e.uid * 0.17), sx(e.x), sy(e.y), {
      flip: e.faceX < 0,
      white: e.flash > 0,
    });
  }
  if (!playerDone) drawPlayer();

  // barra de vida do jogador
  if (st.deadFor < 0) {
    const bw = 44;
    const x = CX - bw / 2;
    const y = CY - 40 - 5;
    g.fillStyle = '#10131c';
    g.fillRect(x - 2, y - 2, bw + 4, 14);
    g.fillStyle = '#3a1218';
    g.fillRect(x, y, bw, 10);
    g.fillStyle = '#e83a4e';
    g.fillRect(x, y, bw * Math.max(0, w.player.hp / w.player.maxHp), 10);
    g.fillStyle = 'rgba(255,255,255,.28)';
    g.fillRect(x, y, bw * Math.max(0, w.player.hp / w.player.maxHp), 3);
  }

  // espada
  if (w.weapon.active && st.deadFor < 0) drawSword(g, a, w, CX, CY - 4);

  // projéteis
  for (const q of w.projectiles) {
    const x = sx(q.x);
    const y = sy(q.y);
    if (x < -60 || x > VIEW_WIDTH + 60 || y < -60 || y > VIEW_HEIGHT + 60) continue;
    if (q.kind === 'orb') drawFrame(g, a, animFrame(a, 'Enemies/DarkRaven/Projectile', t), x, y);
    else if (q.kind === 'axe') drawFrame(g, a, PROJ_FRAME.axe!, x, y, { rot: t * 12 });
    else drawFrame(g, a, PROJ_FRAME[q.kind]!, x, y, { rot: -q.angle });
  }

  // efeitos
  for (const f of st.fx) {
    const key = animFrame(a, f.key, f.t);
    drawFrame(g, a, key, sx(f.x), sy(f.y));
  }
}

function drawSword(
  g: CanvasRenderingContext2D,
  a: Atlas,
  w: NhWorld,
  px: number,
  py: number,
): void {
  const L = w.weapon.lengthLevel;
  const t = w.weapon.t;
  const ang = (w.weaponAngle * Math.PI) / 180;
  const width = 45 + 10 * L;
  // pequena "pancada" de escala do Slash: x 0,8 -> 1,05 -> 1; y 0,2 -> 1,05 -> 1
  const k = (v0: number, v1: number) =>
    t < 0.2 ? v0 + (v1 - v0) * (t / 0.2) : t < 0.3333 ? v1 + (1 - v1) * ((t - 0.2) / 0.1333) : 1;
  const sxs = t > 0.9833 ? 1 - ((t - 0.9833) / 0.3167) * 0.2 : k(0.8, 1.05);
  const sys = t > 0.9833 ? 1 - ((t - 0.9833) / 0.3167) * 0.8 : k(0.2, 1.05);
  // rastro: leque claro atrás da ponta
  const reach = Math.abs(SWORD_BOXES[L]!.ox) + SWORD_BOXES[L]!.w / 2;
  const tipA = ang + Math.PI;
  const trail = Math.min(1.5, Math.max(0, (t - 0.4667) * 3));
  if (trail > 0 && t < 1.15) {
    g.save();
    g.translate(px, py);
    g.globalAlpha = 0.4 * Math.min(1, (1.25 - t) * 4);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, 0);
    const screenTip = -tipA;
    g.arc(0, 0, reach, screenTip, screenTip + trail, false);
    g.closePath();
    g.fill();
    g.restore();
  }
  g.save();
  g.translate(px, py);
  g.rotate(-ang);
  drawFrame(g, a, 'Weapons/SwordCplx01', 0, 0, {
    ax: 1,
    ay: 0.5,
    s: 2,
    sx: sxs,
    sy: sys,
    cropW: width,
  });
  g.restore();
}

/** Atualiza os efeitos de tela a partir dos eventos da simulação. */
export function pushFx(fx: Fx[], k: 'enemyDeath' | 'pickup', x: number, y: number): void {
  if (k === 'enemyDeath') fx.push({ key: 'Effects/DeathEffect', x, y, t: 0, dur: 0.36 });
  else fx.push({ key: 'Effects/PickBonus', x, y, t: 0, dur: 0.45 });
}
