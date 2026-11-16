import * as FX from './fx-art';
import * as FX2 from './fx-art2';
import { HEROES, MAPS, SWORD_BOXES, type Enemy, type NhWorld, type Obstacle } from '@nocap/games';
import { animFrame, drawFrame, drawText, type Atlas } from './assets';
import { BREAKABLE_DEBRIS, BREAKABLE_GLOW } from './extra-art';
import { MONSTERS, MONSTER_BY_ID, PICK_RADIUS } from '@nocap/games';

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
  /** Número de dano (efeito `dmg`). */
  v?: number;
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

const GROUND_TILE = 128;
const GROUND_SCALE = 2;
const groundCache = new Map<string, CanvasPattern | null>();
/** Ladrilho de textura do chão, gerado uma vez por mapa: pontinhos claros e escuros e tufos (grama) ou pedrinhas (areia). */
function groundPattern(
  g: CanvasRenderingContext2D,
  mapId: string,
  ground: readonly number[],
): CanvasPattern | null {
  const hit = groundCache.get(mapId);
  if (hit !== undefined) return hit;
  const c = document.createElement('canvas');
  c.width = GROUND_TILE;
  c.height = GROUND_TILE;
  const q = c.getContext('2d');
  if (!q) return null;
  const kind = mapId === 'deserto' ? 'sand' : mapId === 'gelo' ? 'snow' : 'grass';
  const [r, gg, b] = ground as [number, number, number];
  const shade = (k: number) =>
    `rgb(${Math.max(0, Math.min(255, r + k))},${Math.max(0, Math.min(255, gg + k))},${Math.max(0, Math.min(255, b + k))})`;
  let seed = mapId.length * 7919 + 13;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const put = (x: number, y: number, w: number, h: number, color: string) => {
    q.fillStyle = color;
    // desenha também nas bordas opostas para o ladrilho emendar sem costura
    for (const dx of [0, -GROUND_TILE, GROUND_TILE])
      for (const dy of [0, -GROUND_TILE, GROUND_TILE]) q.fillRect(x + dx, y + dy, w, h);
  };
  const n = kind === 'grass' ? 900 : 760;
  for (let i = 0; i < n; i++) {
    const x = Math.floor(rnd() * GROUND_TILE);
    const y = Math.floor(rnd() * GROUND_TILE);
    const k = rnd();
    if (k < 0.45) put(x, y, 1, 1, shade(kind === 'snow' ? 12 : -18));
    else if (k < 0.8) put(x, y, 1, 1, shade(kind === 'snow' ? -12 : 16));
    else if (kind === 'grass') {
      // tufo: duas lâminas escuras e uma clara
      put(x, y, 1, 3, shade(-26));
      put(x + 2, y + 1, 1, 2, shade(-22));
      put(x + 1, y - 1, 1, 2, shade(22));
    } else if (kind === 'sand') {
      put(x, y, 2, 1, shade(-26));
      put(x, y + 1, 1, 1, shade(-16));
    } else put(x, y, 2, 1, shade(18));
  }
  q.globalAlpha = 1;
  const p = g.createPattern(c, 'repeat');
  groundCache.set(mapId, p);
  return p;
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
  // textura do chão (grama, areia, neve): um ladrilho que se repete e anda com a câmera
  const pat = groundPattern(g, mapId, m.ground);
  if (pat) {
    const P = GROUND_TILE * GROUND_SCALE;
    const ox = (((VIEW_WIDTH / 2 - camX) % P) + P) % P;
    const oy = (((VIEW_HEIGHT / 2 + camY) % P) + P) % P;
    pat.setTransform(new DOMMatrix().translate(ox, oy).scale(GROUND_SCALE));
    g.save();
    g.imageSmoothingEnabled = false;
    g.fillStyle = pat;
    g.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    g.restore();
  }
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

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

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

/** Desenha um inimigo animado fora da partida (bestiário): os do Slash pela animação deles, os do Dungeon Crawl pela animação em código. */
export function drawEnemyPreview(
  g: CanvasRenderingContext2D,
  a: Atlas,
  art: string,
  x: number,
  y: number,
  t: number,
  scale = 1,
): void {
  if (art.startsWith('Dc:')) {
    const key = art.slice(3);
    const m = MONSTERS.find((q) => q.art === key);
    const an = MON_ANIM[key] ?? MON_ANIM.skeleton!;
    const ph = t * an.spd;
    const hop = an.fly ? Math.sin(ph * 0.6) * an.bob : -Math.abs(Math.sin(ph * 0.5)) * an.bob;
    drawFrame(g, a, `M/${key}`, x, y + hop, {
      s: (m?.scale ?? 1.6) * scale,
      sx: 1 + an.sq * Math.sin(ph),
      sy: 1 - an.sq * Math.sin(ph),
      rot: Math.sin(ph * 0.5) * an.sway,
      flip: !an.left,
      ay: 0.62,
    });
    return;
  }
  const anim = ENEMY_ANIM[art.startsWith('Boss') ? art : art] ?? 'Enemies/Bat/Move';
  drawFrame(g, a, animFrame(a, anim, t), x, y, { s: 2 * scale });
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
    FX.drawGarlicAura(g, CX, CY + 6, r, t, w.evolved.has('evoGarlic'));
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
    FX.drawMagmaPool(g, px, py, p.r, age - 0.35, p.dur - 0.35, p.evo, p.x * 0.37 + p.y);
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
    const age = (w.t - c.born) / 0.2;
    if (age > 1) continue;
    FX.drawWhipCut(g, sx(w.player.x) + c.side * 8, sy(w.player.y) - 8, c.side, age, c.len, c.evo);
  }
  // Círculo de Brasas: bolas de fogo girando
  for (const [i, b] of w.embersBalls().entries()) {
    const x = sx(b.x);
    const y = sy(b.y);
    FX.drawEmberBall(
      g,
      x,
      y,
      Math.atan2(y - CY, x - CX) - Math.PI / 2,
      t,
      b.r,
      w.evolved.has('evoEmbers'),
      i,
    );
  }
  // explosões das bombas e das runas
  for (const bl of w.blasts) {
    FX.drawBlast(g, sx(bl.x), sy(bl.y), bl.r, (w.t - bl.born) / 0.8, bl.x * 0.13 + bl.y);
  }
  // Pentagrama: o desenho se forma sob o jogador e uma onda varre a tela
  if (w.pent)
    FX.drawPentagramBurst(
      g,
      CX,
      CY + 10,
      (w.t - w.pent.born) / 1.2,
      120,
      w.evolved.has('evoPentagram'),
    );

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
    else if (q.kind === 'axe') FX2.drawAxeSpin(g, x, y, t * 12, t, false, 1);
    else if (q.kind === 'pAxe') FX2.drawAxeSpin(g, x, y, -t * 14, t, q.big, q.big ? 1.6 : 1.1);
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
      const fuse = Math.max(0, Math.min(1, 1 - (q.expire - w.t) / 1.2));
      FX.drawCherryBomb(g, x, y - hop - 6, t, fuse, 1);
    } else if (q.kind === 'cross')
      FX.drawCrossProj(g, x, y, q.angle, t, q.big, w.area, q.vx, -q.vy);
    else if (q.kind === 'bone')
      FX.drawBoneProj(g, x, y, q.angle, t, w.evolved.has('evoBone'), 0, w.area);
    else if (q.kind === 'rune')
      FX.drawRuneOrb(g, x, y, q.vx, -q.vy, t, w.evolved.has('evoRunes'), 0, w.area);
    else if (q.kind === 'wand')
      FX.drawMagicBolt(g, x, y, Math.atan2(-q.vy, q.vx), t, q.big, w.area);
    else if (q.kind === 'horizontal')
      FX2.drawDagger(g, x, y, Math.atan2(-q.vy, q.vx), t, w.evolved.has('evoHorizontal'), 1);
    else drawFrame(g, a, PROJ_FRAME[q.kind]!, x, y, { rot: -q.angle });
  }

  // orbes guardiões
  for (const o of w.orbs()) {
    const k = o.r / 17;
    g.save();
    g.globalAlpha = 0.25;
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(sx(o.x), sy(o.y) + 20 * k, 12 * k, 4 * k, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    FX2.drawGuardOrb(
      g,
      sx(o.x),
      sy(o.y),
      Math.atan2(sy(o.y) - CY, sx(o.x) - CX),
      t,
      w.evolved.has('evoOrbit'),
      k,
    );
  }

  // efeitos
  for (const f of st.fx) {
    if (f.key === 'bolt') {
      FX.drawLunarStrike(g, sx(f.x), sy(f.y), f.t / f.dur, f.x * 7 + f.y);
      continue;
    }
    if (f.key === 'hit') {
      FX2.drawHitSpark(g, sx(f.x), sy(f.y), f.t / f.dur, (f.v ?? 0) >= 30);
      continue;
    }
    if (f.key === 'death') {
      FX2.drawDeathBurst(g, sx(f.x), sy(f.y), f.t / f.dur, '#8a6a9a', f.x * 0.21 + f.y);
      continue;
    }
    if (f.key === 'chestOpen') {
      FX2.drawChestOpen(g, sx(f.x), sy(f.y), f.t / f.dur, false);
      continue;
    }
    if (f.key === 'evolveFx') {
      FX2.drawEvolveBurst(g, CX, CY - 10, f.t / f.dur);
      continue;
    }
    if (f.key === 'levelFx') {
      FX2.drawLevelUp(g, CX, CY + 20, f.t / f.dur);
      continue;
    }
    if (f.key === 'dmg') {
      // número de dano: sobe, encolhe um pouco e some; os fortes são maiores e amarelos
      const p = f.t / f.dur;
      const v = f.v ?? 0;
      const big = v >= 30;
      g.save();
      g.globalAlpha = 1 - smoothstep(0.55, 1, p);
      drawText(
        g,
        a,
        String(Math.max(1, Math.round(v))),
        sx(f.x) + ((f.x * 13) % 9) - 4,
        sy(f.y) - 18 - p * 26 - Math.sin(p * Math.PI) * 6,
        {
          size: big ? 22 : 16,
          align: 'center',
          color: big ? '#ffd94a' : '#ffffff',
        },
      );
      g.restore();
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
  if (trail > 0 && t < 1.15)
    FX2.drawSwordSlash(
      g,
      px,
      py,
      -tipA,
      Math.min(1, (t - 0.4667) / 0.6),
      w.evolved.has('evoSword'),
      reach,
    );
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
  k:
    | 'enemyDeath'
    | 'pickup'
    | 'bolt'
    | 'debris'
    | 'dmg'
    | 'hit'
    | 'chestOpen'
    | 'evolveFx'
    | 'levelFx',
  x: number,
  y: number,
  map?: string,
  v?: number,
): void {
  if (k === 'dmg') {
    // no máximo 60 números ao mesmo tempo (hordas e armas rápidas não enchem a tela)
    if (fx.filter((f) => f.key === 'dmg').length < 60)
      fx.push({ key: 'dmg', x, y, t: 0, dur: 0.7, v });
    return;
  }
  if (k === 'hit') {
    if (fx.filter((f) => f.key === 'hit').length < 40)
      fx.push({ key: 'hit', x, y, t: 0, dur: 0.22, v });
    return;
  }
  if (k === 'chestOpen') fx.push({ key: 'chestOpen', x, y, t: 0, dur: 1.2 });
  else if (k === 'evolveFx') fx.push({ key: 'evolveFx', x, y, t: 0, dur: 1.4 });
  else if (k === 'levelFx') fx.push({ key: 'levelFx', x, y, t: 0, dur: 1 });
  else if (k === 'debris') fx.push({ key: 'debris', map, x, y, t: 0, dur: 0.5 });
  else if (k === 'bolt') fx.push({ key: 'bolt', x, y, t: 0, dur: 0.9 });
  else if (k === 'enemyDeath') fx.push({ key: 'death', x, y, t: 0, dur: 0.6 });
  else fx.push({ key: 'Effects/PickBonus', x, y, t: 0, dur: 0.45 });
}
