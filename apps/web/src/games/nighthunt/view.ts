import { HEROES, MAPS, SWORD_BOXES, type Enemy, type NhWorld, type Obstacle } from '@nocap/games';
import { animFrame, drawFrame, type Atlas } from './assets';
import { BREAKABLE_DEBRIS, BREAKABLE_GLOW } from './extra-art';
import { MONSTER_BY_ID, PICK_RADIUS } from '@nocap/games';

/** Área visível do mundo (em unidades do mundo), recalculada a cada quadro para preencher a tela em pé ou deitada. */
let CX = 255;
let CY = 340;
let VIEW_WIDTH = 510;
let VIEW_HEIGHT = 680;

/** Efeitos de tela (morte de inimigo, coleta de item): só desenho, nada disso entra na simulação. */
export interface Fx {
  key: string;
  /** Mapa (só para os cacos). */
  map?: string;
  kind?: number;
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
  wand: 'X/p/wand',
  cross: 'X/p/cross',
  bone: 'X/p/bone',
  rune: 'X/p/rune',
  bomb: 'X/p/bomb',
  spark: 'X/p/spark',
};

function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function drawBackground(
  g: CanvasRenderingContext2D,
  a: Atlas,
  camX: number,
  camY: number,
  mapId: string,
): void {
  const m = MAPS[mapId] ?? MAPS.campo!;
  g.fillStyle = `rgb(${m.ground[0]},${m.ground[1]},${m.ground[2]})`;
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
        drawFrame(g, a, mapFrame(a, mapId, it.f), CX + tx + it.x - camX, CY - (ty + it.y - camY), {
          s: it.s,
        });
    }
  }
}

/** Decoração do chão com o matiz do mapa (se o mapa tiver um). */
export function mapFrame(a: Atlas, mapId: string, name: string): string {
  const v = `Background/${mapId}/${name.slice(11)}`;
  return a.frames[v] ? v : name;
}
/** Sprite do guerreiro no matiz do herói. */
export function heroFrame(a: Atlas, heroId: string, name: string | null): string | null {
  if (!name || !HEROES[heroId]?.hue) return name;
  const v = `Player/${heroId}/${name.slice(7)}`;
  return a.frames[v] ? v : name;
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

/**
 * Zoom da câmera do mundo: bem mais aberta que a do Slash (como a do Vampire Survivors). Em telas muito largas ou altas o zoom
 * sobe um pouco para não mostrar mapa demais.
 */
export const viewZoom = (): number => Math.max(0.6, stage.w / 1500, stage.h / 1250);
/** Metade da largura e da altura visíveis, em unidades do mundo (os inimigos nascem fora disso). */
export const viewHalf = (): { hw: number; hh: number } => ({
  hw: stage.w / viewZoom() / 2,
  hh: stage.h / viewZoom() / 2,
});

/** Tamanho lógico da tela (preenche o canvas inteiro); o app atualiza ao redimensionar. */
export const stage = { w: 510, h: 680 };

/** Como cada monstro do Dungeon Crawl se mexe (os quadros são parados: a animação é feita em código). */
const MON_ANIM: Record<
  string,
  { bob: number; spd: number; sq: number; sway: number; left?: boolean; fly?: boolean }
> = {
  firefly: { bob: 5, spd: 14, sq: 0.14, sway: 0.25, left: true, fly: true },
  slime: { bob: 0, spd: 5, sq: 0.2, sway: 0 },
  scorpion: { bob: 1, spd: 7, sq: 0.04, sway: 0.05, left: true },
  snake: { bob: 0, spd: 6, sq: 0.05, sway: 0.22 },
  eye: { bob: 4, spd: 3, sq: 0.06, sway: 0.05, fly: true },
  hound: { bob: 2, spd: 11, sq: 0.08, sway: 0.06, left: true },
  skeleton: { bob: 2, spd: 8, sq: 0.05, sway: 0.1 },
  brainworm: { bob: 0, spd: 5, sq: 0.12, sway: 0.1 },
  griffin: { bob: 3, spd: 9, sq: 0.1, sway: 0.08, left: true, fly: true },
  treant: { bob: 0, spd: 3, sq: 0.04, sway: 0.06 },
  wyvern: { bob: 3, spd: 6, sq: 0.1, sway: 0.05, fly: true },
  golddragon: { bob: 2, spd: 4, sq: 0.06, sway: 0.04 },
  icewolf: { bob: 2, spd: 11, sq: 0.08, sway: 0.06, left: true },
  wraith: { bob: 5, spd: 4, sq: 0.06, sway: 0.08, fly: true },
  golem: { bob: 0, spd: 2.5, sq: 0.04, sway: 0.03 },
};

/** Desenha um monstro novo com a animação do tipo dele e os avisos das regras (bote, mergulho, fase, raiva, raízes). */
function drawMonster(
  g: CanvasRenderingContext2D,
  a: Atlas,
  w: NhWorld,
  e: Enemy,
  x: number,
  y: number,
  t: number,
): void {
  const m = MONSTER_BY_ID.get(e.s.id)!;
  const an = MON_ANIM[m.art] ?? MON_ANIM.skeleton!;
  const ph = t * an.spd + e.uid;
  const hop = an.fly ? Math.sin(ph * 0.6) * an.bob : -Math.abs(Math.sin(ph * 0.5)) * an.bob;
  let sxm = 1 + an.sq * Math.sin(ph);
  let sym = 1 - an.sq * Math.sin(ph);
  let rot = Math.sin(ph * 0.5) * an.sway;
  let dx = 0;
  let tint: string | undefined;
  let tintAlpha = 0.5;
  let alpha = 1;
  const trait = e.s.trait;
  const ghost = w.isGhost(e);
  if (e.mode === 1) {
    // avisando o bote: treme e pisca
    dx = Math.sin(t * 60) * 2;
    tint = '#ffffff';
    tintAlpha = 0.35 + 0.3 * Math.sin(t * 40);
    sym *= 0.9;
  } else if (e.mode === 2) {
    sxm *= 1.28;
    sym *= 0.82;
    rot += 0.0;
  }
  if (trait === 'enrage' && e.hp <= e.maxHp / 2) {
    tint = '#ff2a2a';
    tintAlpha = 0.4;
  }
  if (trait === 'phase') {
    alpha = ghost ? 0.35 : 0.9;
    if (ghost) {
      tint = '#9ad0ff';
      tintAlpha = 0.6;
    }
  }
  if (
    (trait === 'orb' || trait === 'spread' || trait === 'ring' || trait === 'scythe') &&
    e.shootTimer > 2.6
  ) {
    sxm *= 1.12;
    sym *= 1.12;
  }
  // sombra no chão
  g.save();
  g.globalAlpha = an.fly ? 0.18 : 0.28;
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(x, y + 16 * m.scale * 0.6, 13 * m.scale, 4.5 * m.scale, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // aura das raízes do Ent
  if (trait === 'roots') {
    g.save();
    g.globalAlpha = 0.22 + 0.06 * Math.sin(t * 3);
    g.strokeStyle = '#6fd86a';
    g.lineWidth = 3;
    g.setLineDash([10, 8]);
    g.beginPath();
    g.ellipse(x, y + 10, 115, 80, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
  const frame = `M/${m.art}`;
  const flip = an.left ? e.faceX > 0 : e.faceX < 0;
  if (e.mode === 2) {
    // rastro do disparo
    drawFrame(g, a, frame, x - e.dirX * 18, y - e.dirY * 18 + hop, {
      s: m.scale,
      sx: sxm,
      sy: sym,
      flip,
      alpha: 0.3,
      ay: 0.62,
    });
  }
  drawFrame(g, a, frame, x + dx, y + hop, {
    s: m.scale,
    sx: sxm,
    sy: sym,
    rot,
    flip,
    ay: 0.62,
    alpha,
    white: e.flash > 0,
    tint,
    tintAlpha,
  });
}

export interface WorldDrawState {
  time: number;
  /** Tempo desde a morte (para a animação de morrer), ou -1. */
  deadFor: number;
  hurtFlash: number;
  healFlash: number;
  fx: Fx[];
  dropT: Map<number, number>;
  hero: string;
  map: string;
  /** Desenha o círculo do alcance de coleta e de atração. */
  showRange?: boolean;
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
  // O mundo é desenhado num espaço virtual (largura/zoom x altura/zoom) centrado na tela, assim o zoom limita quanto do mapa aparece em telas largas.
  const z = viewZoom();
  VIEW_WIDTH = stage.w / z;
  VIEW_HEIGHT = stage.h / z;
  CX = VIEW_WIDTH / 2;
  CY = VIEW_HEIGHT / 2;
  g.save();
  g.translate(stage.w / 2, stage.h / 2);
  g.scale(z, z);
  g.translate(-VIEW_WIDTH / 2, -VIEW_HEIGHT / 2);
  const sx = (x: number) => CX + x - camX;
  const sy = (y: number) => CY - (y - camY);
  const t = st.time;
  drawBackground(g, a, camX, camY, st.map);

  // itens (com um pulinho ao cair, como o DropStart do Slash)
  for (const it of w.items) {
    const gfx = ITEM_GFX[it.type]!;
    const age = w.t - it.born;
    const hop = age < 0.3 ? Math.sin((age / 0.3) * Math.PI) * 14 : 0;
    const frame = gfx.anim ? animFrame(a, gfx.anim, t + it.uid * 0.13) : gfx.frame!;
    const x = sx(it.x) + gfx.ox;
    const y = sy(it.y) - gfx.oy - hop;
    if (x < -40 || x > VIEW_WIDTH + 40 || y < -40 || y > VIEW_HEIGHT + 40) continue;
    const val = it.type === 'xp' ? (it.value ?? 1) : 1;
    drawFrame(g, a, frame, x, y, {
      s: val >= 20 ? 1.35 : val >= 5 ? 1.15 : 1,
      tint: val >= 20 ? '#ff3a3a' : val >= 5 ? '#3cff5a' : undefined,
      tintAlpha: val >= 20 ? 0.6 : 0.5,
    });
  }

  // Aura de Alho e poças de magma ficam no chão, por baixo de todo mundo
  if (w.garlicRadius > 0) {
    const r = w.garlicRadius * (1 + 0.04 * Math.sin(t * 5));
    const evo = w.evolved.has('evoGarlic');
    const gr = g.createRadialGradient(CX, CY + 6, r * 0.35, CX, CY + 6, r);
    gr.addColorStop(0, evo ? 'rgba(160,90,230,0)' : 'rgba(150,230,140,0)');
    gr.addColorStop(1, evo ? 'rgba(160,90,230,.38)' : 'rgba(150,230,140,.34)');
    g.save();
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(CX, CY + 6, r, r * 0.8, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = evo ? 'rgba(210,150,255,.7)' : 'rgba(200,255,190,.65)';
    g.lineWidth = 2;
    g.setLineDash([8, 6]);
    g.lineDashOffset = -t * 20;
    g.stroke();
    g.restore();
  }
  for (const p of w.pools) {
    const age = w.t - p.born;
    const px = sx(p.x);
    const py = sy(p.y);
    if (px < -90 || px > VIEW_WIDTH + 90 || py < -90 || py > VIEW_HEIGHT + 90) continue;
    if (age < 0.35) {
      // frasco no ar, em arco, até o ponto onde a poça vai abrir
      const k = age / 0.35;
      const fx = CX + (px - CX) * k;
      const fy = CY + (py - CY) * k - Math.sin(k * Math.PI) * 60;
      g.fillStyle = '#ff6a2a';
      g.fillRect(fx - 4, fy - 5, 8, 10);
      g.fillStyle = '#ffd24a';
      g.fillRect(fx - 2, fy - 3, 4, 4);
      continue;
    }
    const open = Math.min(1, (age - 0.35) / 0.25);
    const fade = Math.min(1, (p.dur - age) / 0.5);
    const r = p.r * open;
    const gr = g.createRadialGradient(px, py, r * 0.1, px, py, r);
    gr.addColorStop(0, p.evo ? 'rgba(255,220,120,.95)' : 'rgba(255,190,70,.9)');
    gr.addColorStop(0.6, 'rgba(240,90,30,.85)');
    gr.addColorStop(1, 'rgba(120,20,10,.7)');
    g.save();
    g.globalAlpha = Math.max(0, fade);
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(px, py, r, r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#3a0d08';
    g.lineWidth = 2;
    g.stroke();
    // bolhas subindo em laço
    for (let i = 0; i < 5; i++) {
      const ph = (t * 1.3 + i * 0.37 + p.x) % 1;
      const bx = px + Math.sin(i * 2.1 + p.y) * r * 0.55;
      const by = py - ph * r * 0.7 + r * 0.15;
      g.fillStyle = `rgba(255,230,140,${0.9 - ph})`;
      g.fillRect(bx - 2, by - 2, 4, 4);
    }
    g.restore();
  }

  // objetos quebráveis do cenário (tema do mapa)
  for (const b of w.breakables) {
    const x = sx(b.x);
    const y = sy(b.y);
    if (x < -60 || x > VIEW_WIDTH + 60 || y < -60 || y > VIEW_HEIGHT + 60) continue;
    g.save();
    g.globalAlpha = 0.25;
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(x, y + 12, 12, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    const wob = b.flash > 0 ? Math.sin(b.flash * 120) * 2 : 0;
    // aura suave que pulsa, para o objeto se destacar no chão como as tochas do Vampire Survivors
    const glow = BREAKABLE_GLOW[st.map] ?? BREAKABLE_GLOW.campo!;
    const pulse = 0.5 + 0.5 * Math.sin(t * 4 + b.uid);
    const gr = g.createRadialGradient(x, y - 4, 2, x, y - 4, 34);
    gr.addColorStop(0, `rgba(${glow},${0.34 + 0.16 * pulse})`);
    gr.addColorStop(1, `rgba(${glow},0)`);
    g.fillStyle = gr;
    g.fillRect(x - 36, y - 40, 72, 72);
    drawFrame(g, a, `X/brk/${st.map}`, x + wob, y - 2, { white: b.flash > 0 });
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
  const list: Array<{ y: number; e?: Enemy; ob?: Obstacle }> = [];
  for (const o of w.obstacles) {
    const x = sx(o.x);
    const y = sy(o.y);
    if (x < -80 || x > VIEW_WIDTH + 80 || y < -80 || y > VIEW_HEIGHT + 80) continue;
    list.push({ y: o.y, ob: o });
  }
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
    const frame = heroFrame(a, st.hero, animFrame(a, key, st.deadFor >= 0 ? st.deadFor : t));
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
    if (o.ob) {
      const ob = o.ob;
      const f = `X/obs/${st.map}/${ob.kind}`;
      g.save();
      g.globalAlpha = 0.25;
      g.fillStyle = '#000';
      g.beginPath();
      g.ellipse(sx(ob.x), sy(ob.y) + ob.r * 0.5, ob.r * 1.1, ob.r * 0.4, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      drawFrame(g, a, f, sx(ob.x), sy(ob.y) + ob.r * 0.55, { s: 1.4, ay: 1 });
      continue;
    }
    const e = o.e!;
    if (e.life > 0 && e.life <= 2 && Math.floor(t * 2.5) % 2 === 0) continue; // pisca antes de sumir
    if (MONSTER_BY_ID.has(e.s.id)) {
      drawMonster(g, a, w, e, sx(e.x), sy(e.y), t);
      continue;
    }
    const touching = Math.abs(e.x - w.player.x) < 40 && Math.abs(e.y - w.player.y) < 48;
    drawFrame(g, a, animFrame(a, enemyAnimKey(e, touching), t + e.uid * 0.17), sx(e.x), sy(e.y), {
      flip: e.faceX < 0,
      white: e.flash > 0,
    });
  }
  if (!playerDone) drawPlayer();
  if (st.showRange) {
    g.save();
    g.lineWidth = 1.5;
    g.setLineDash([5, 5]);
    g.strokeStyle = 'rgba(120,215,255,.45)';
    g.beginPath();
    g.arc(CX, CY, w.attractRadius, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(255,230,120,.7)';
    g.beginPath();
    g.arc(CX, CY, PICK_RADIUS, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  // cortes do Chicote
  for (const c of w.cuts) {
    if (c.born === 0) continue;
    const age = (w.t - c.born) / 0.22;
    if (age > 1) continue;
    const cx = sx(w.player.x) + c.side * (c.len / 2 + 8);
    const cy = sy(w.player.y) - 8;
    g.save();
    g.globalAlpha = 1 - age;
    g.strokeStyle = c.evo ? '#ff3a4a' : '#ffffff';
    g.lineCap = 'round';
    const grow = 0.5 + age * 0.5;
    for (let i = 0; i < 3; i++) {
      g.lineWidth = 7 - i * 2;
      g.globalAlpha = (1 - age) * (1 - i * 0.28);
      g.beginPath();
      g.ellipse(
        cx,
        cy + 6 - i * 4,
        (c.len / 2) * grow,
        14 - i * 3,
        0,
        c.side > 0 ? Math.PI * 1.05 : Math.PI * 1.95,
        c.side > 0 ? Math.PI * 1.95 : Math.PI * 2.85 - Math.PI,
      );
      g.stroke();
    }
    g.restore();
  }
  // Círculo de Brasas: bolas de fogo girando
  for (const b of w.embersBalls()) {
    const x = sx(b.x);
    const y = sy(b.y);
    const evo = w.evolved.has('evoEmbers');
    const gl = g.createRadialGradient(x, y, 2, x, y, b.r * 2.4);
    gl.addColorStop(0, evo ? 'rgba(140,200,255,.6)' : 'rgba(255,170,60,.55)');
    gl.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = gl;
    g.fillRect(x - b.r * 2.4, y - b.r * 2.4, b.r * 4.8, b.r * 4.8);
    drawFrame(g, a, 'X/p/ember', x, y, {
      s: 1.1 * (b.r / 12),
      tint: evo ? '#5ab4ff' : undefined,
      tintAlpha: 0.65,
    });
  }
  // explosões das bombas e das runas
  for (const bl of w.blasts) {
    const k = (w.t - bl.born) / 0.5;
    g.save();
    g.globalAlpha = Math.max(0, 1 - k);
    g.strokeStyle = '#ffd24a';
    g.lineWidth = 5 * (1 - k) + 1;
    g.beginPath();
    g.arc(sx(bl.x), sy(bl.y), bl.r * (0.4 + 0.6 * Math.min(1, k * 2.2)), 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(255,150,50,.35)';
    g.fill();
    g.restore();
  }
  // Pentagrama: o desenho se forma sob o jogador e uma onda varre a tela
  if (w.pent) {
    const k = (w.t - w.pent.born) / 1.2;
    const R = 120;
    g.save();
    g.translate(CX, CY + 10);
    g.globalAlpha = Math.max(0, 1 - k);
    g.strokeStyle = w.evolved.has('evoPentagram') ? '#ffe08a' : '#b06aff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    for (let i = 0; i <= 5; i++) {
      const ang = -Math.PI / 2 + ((i * 2) % 5) * ((Math.PI * 2) / 5);
      const px = Math.cos(ang) * R;
      const py = Math.sin(ang) * R;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
    g.lineWidth = 6;
    g.globalAlpha = Math.max(0, 0.8 - k);
    g.beginPath();
    g.arc(0, 0, R + k * Math.max(VIEW_WIDTH, VIEW_HEIGHT), 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

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
    else if (q.kind === 'pAxe')
      drawFrame(g, a, PROJ_FRAME.axe!, x, y, {
        rot: -t * 14,
        s: q.big ? 3.6 : 2.2,
        tint: q.big ? '#ffd94a' : undefined,
        tintAlpha: 0.35,
      });
    else if (q.kind === 'bomb') {
      // a bomba quica pelo chão: sombra fixa e salto que encolhe a cada quicada
      const age = w.t - (q.born ?? 0);
      const hop = age < 0.9 ? Math.abs(Math.sin(age * 9)) * 22 * (1 - age / 0.9) : 0;
      g.save();
      g.globalAlpha = 0.25;
      g.fillStyle = '#000';
      g.beginPath();
      g.ellipse(x, y + 8, 8, 3, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      const fuse = q.expire - w.t < 0.35 && Math.floor(w.t * 20) % 2 === 0;
      drawFrame(g, a, PROJ_FRAME.bomb!, x, y - hop, { s: 1.2, white: fuse });
    } else if (q.kind === 'cross' || q.kind === 'rune' || q.kind === 'bone')
      drawFrame(g, a, PROJ_FRAME[q.kind]!, x, y, {
        rot: q.angle,
        s: (q.big ? 1.4 : 1) * w.area,
        tint: q.big ? '#ffd94a' : undefined,
        tintAlpha: 0.35,
      });
    else if (q.kind === 'wand')
      drawFrame(g, a, PROJ_FRAME.wand!, x, y, {
        rot: q.angle,
        s: (q.big ? 1.3 : 1) * w.area,
        tint: q.big ? '#ffd94a' : undefined,
        tintAlpha: 0.5,
      });
    else drawFrame(g, a, PROJ_FRAME[q.kind]!, x, y, { rot: -q.angle });
  }

  // orbes guardiões
  for (const [i, o] of w.orbs().entries()) {
    const k = o.r / 17;
    g.save();
    g.globalAlpha = 0.25;
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(sx(o.x), sy(o.y) + 20 * k, 12 * k, 4 * k, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    drawFrame(g, a, `X/orb${Math.floor(t * 9 + i) % 4}`, sx(o.x), sy(o.y), {
      s: 2 * k,
      tint: w.evolved.has('evoOrbit') ? '#ffd94a' : undefined,
      tintAlpha: 0.3,
    });
  }

  // efeitos
  for (const f of st.fx) {
    if (f.key === 'bolt') {
      drawBolt(g, sx(f.x), sy(f.y), f.t / f.dur, f.x * 7 + f.y);
      continue;
    }
    if (f.key === 'debris') {
      const p = f.t / f.dur;
      const cols = BREAKABLE_DEBRIS[f.map ?? 'campo'] ?? BREAKABLE_DEBRIS.campo!;
      g.save();
      g.globalAlpha = 1 - p;
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2 + i * 0.7;
        const sp = 26 + (i % 3) * 14;
        g.fillStyle = cols[i % cols.length]!;
        const s = i % 2 ? 6 : 4;
        g.fillRect(
          sx(f.x) + Math.cos(ang) * sp * p - s / 2,
          sy(f.y) + Math.sin(ang) * sp * p + 90 * p * p - s / 2,
          s,
          s,
        );
      }
      g.restore();
      continue;
    }
    const key = animFrame(a, f.key, f.t);
    drawFrame(g, a, key, sx(f.x), sy(f.y));
  }
  g.restore();
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
export function pushFx(
  fx: Fx[],
  k: 'enemyDeath' | 'pickup' | 'bolt' | 'debris',
  x: number,
  y: number,
  map?: string,
): void {
  if (k === 'debris') fx.push({ key: 'debris', map, x, y, t: 0, dur: 0.5 });
  else if (k === 'bolt') fx.push({ key: 'bolt', x, y, t: 0, dur: 0.3 });
  else if (k === 'enemyDeath') fx.push({ key: 'Effects/DeathEffect', x, y, t: 0, dur: 0.36 });
  else fx.push({ key: 'Effects/PickBonus', x, y, t: 0, dur: 0.45 });
}

/** Raio lunar: faísca em zigue-zague do alto da tela até o alvo, com clarão no chão. */
function drawBolt(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  p: number,
  seed: number,
): void {
  const a = Math.max(0, 1 - p);
  g.save();
  g.globalAlpha = a;
  const pts: [number, number][] = [];
  const top = -20;
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const jx = i === n ? 0 : Math.sin(seed + i * 12.9898) * 22;
    pts.push([x + jx * (1 - t * 0.5), top + (y - top) * t]);
  }
  for (const [w, c] of [
    [9, 'rgba(120,170,255,.45)'],
    [5, '#bcd4ff'],
    [2.4, '#ffffff'],
  ] as const) {
    g.strokeStyle = c;
    g.lineWidth = w;
    g.lineJoin = 'round';
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.stroke();
  }
  g.fillStyle = 'rgba(190,215,255,.55)';
  g.beginPath();
  g.ellipse(x, y + 4, 34 * (0.6 + p), 12 * (0.6 + p), 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
