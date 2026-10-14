import { HALF, PLAYER_R, COVER_ZONE_R, type SinalEnd, type SinalView } from '@nocap/games';
import { V, screenX, type Layout } from './camera';
import { MAP_STYLE, HERO_COLOR, PAL } from './art/palette';
import { INK, PAPER, YEL, alpha, blob, clamp, mono, rect, type Ctx } from './art/gfx';
import { hero, silhouette, vigia } from './art/chars';
import { cover, finishLine, isFloor, longCover, obstacle } from './art/props';
import { chaser, itemPickup, shotBody, shotMarker, thrower } from './art/perigos';
import { darkness, deathFx, drawParticles, fogHaze, fxFor, lookAlert, pushBurst, stepFx, stunStars } from './art/fx';
import { hud, inkOn, keyHint, offscreenArrows, stick, type Joy, type Notice } from './art/hud';
import { drawGround, drawHaze, drawLight, sy, worldItems, type Item, type WorldCtx } from './art/world';

export type { Joy, Notice };

export interface SceneInput {
  layout: Layout;
  view: SinalView;
  /** A cor do boneco (só no online); sem ela vale o boneco padrão do mapa. */
  color?: string;
  /** Segundos desde o começo (animação). */
  t: number;
  /** 0 = Vigia de costas, 1 = olhando (suavizado). */
  face: number;
  /** Intensidade do aviso (0 a 1, suavizado). */
  warn: number;
  walking: boolean;
  joy: Joy;
  /** Dica das teclas (computador). */
  keysHint: boolean;
  /** O recorde do modo, em metros (linha no chão). */
  best: number | null;
  notices: Notice[];
  /** Tranco da tela (0 a 1): pancada. */
  jolt: number;
  /** Sala: os outros corredores (vivos), com a cor e o nome de cada um. */
  others?: { id: string; x: number; y: number; hidden: boolean; stunned?: boolean; color: string; name: string }[];
  /** Sala: quem está ao alcance do empurrão (ganha um anel pulsando). */
  pushTarget?: string | null;
  /** A animação de quando o boneco perde (idade de 0 a 1): o Vigia viu, ou a escuridão engoliu. */
  death?: { reason: SinalEnd; age: number } | null;
  /** Sala: a animação do empurrão que você deu (idade de 0 a 1) e a direção dele na tela. */
  pushFx?: { age: number; dx: number; dy: number } | null;
}

/** O tamanho do boneco em relação ao desenho base. */
const HERO_SCALE = 1.15;

/** Desenha um quadro inteiro do Sinal Vermelho. */
export function drawScene(c: Ctx, s: SceneInput) {
  const { layout: l, view } = s;
  const { w, h } = l;
  const map = view.course.map;
  const style = MAP_STYLE[map];
  const pal = PAL[map];
  const heroX = screenX(l, view.x);
  const heroColor = s.color ?? HERO_COLOR[map];

  c.save();
  c.clearRect(0, 0, w, h);
  // pancadas dão um tranco na tela inteira
  if (s.jolt > 0.02) c.translate(Math.sin(s.t * 95) * 7 * s.jolt, Math.cos(s.t * 83) * 7 * s.jolt);

  // ---- o mundo, em pixels de arte
  const sc = l.ppm / V;
  c.save();
  c.scale(sc, sc);
  const vw = w / sc;
  const vh = h / sc;
  const vcx = vw / 2;
  const vpy = l.heroY / sc;
  const W: WorldCtx = { c, map, pal, vw, vh, vcx, vpy, y: view.y, halfAt: view.halfAt, t: s.t };
  const vy = (wy: number) => sy(W, wy);

  drawGround(W);

  // linha do seu recorde
  if (s.best !== null && s.best > 0) {
    const y = vy(s.best);
    if (y > -20 && y < vh + 20) {
      const half = view.halfAt(s.best);
      c.save();
      c.setLineDash([14, 9]);
      c.lineWidth = 6;
      c.strokeStyle = YEL;
      c.beginPath();
      c.moveTo(vcx - half * V, y);
      c.lineTo(vcx + half * V, y);
      c.stroke();
      c.restore();
    }
  }
  // linha de chegada (Clássico)
  if (Number.isFinite(view.course.length)) {
    const y = vy(view.course.length);
    if (y > -80 && y < vh + 80) finishLine(c, vcx, y, view.halfAt(view.course.length) * V, s.t);
  }
  // o chão que age (lama, esteira, ímã, gelo) fica embaixo de tudo
  for (const o of view.obstacles) {
    if (!isFloor(o.kind)) continue;
    const y = vy(o.y);
    if (y < -140 || y > vh + 140) continue;
    obstacle(c, map, o.kind, vcx + o.x * V, y, o.r * V, s.t, o.dir, o.bump);
  }

  // as marcas dos arremessos no chão (onde vai cair, por onde a bola vai rolar)
  for (const sh of view.shots) {
    shotMarker(c, sh, vcx, vy, view.halfAt(sh.sy) * V, s.t);
  }

  // tudo o que tem altura, do fundo para a frente
  const items: Item[] = worldItems(W);
  for (const th of view.throwers) {
    items.push({
      y: th.y,
      draw: () => thrower(c, map, vcx + th.x * V, vy(th.y), th.side, th.kind, th.phase, th.p, s.t),
    });
  }
  for (const sh of view.shots) {
    items.push({ y: sh.y + (sh.kind === 'lob' ? 1.5 : 0), draw: () => shotBody(c, map, sh, vcx, vy, s.t) });
  }
  for (const ch of view.chasers) {
    items.push({
      y: ch.y,
      draw: () => chaser(c, map, vcx + ch.x * V, vy(ch.y), ch.frozen, ch.dizzy, view.x - ch.x, s.t),
    });
  }
  for (const it of view.items) {
    items.push({ y: it.y, draw: () => itemPickup(c, it.kind, vcx + it.x * V, vy(it.y), s.t, it.id) });
  }
  let own: SinalView['covers'][number] | null = null;
  for (const o of view.obstacles) {
    if (isFloor(o.kind)) continue;
    items.push({
      y: o.y,
      draw: () => {
        const y = vy(o.y);
        if (y < -140 || y > vh + 140) return;
        obstacle(c, map, o.kind, vcx + o.x * V, y, o.r * V, s.t, o.dir, o.bump);
      },
    });
  }
  for (const cv of view.covers) {
    const near = Math.max(cv.def.y, Math.min(view.y, cv.def.y + cv.def.len));
    const occupied = view.hidden && (view.x - cv.def.x) ** 2 + (view.y - near) ** 2 <= COVER_ZONE_R * COVER_ZONE_R;
    if (occupied) {
      own = cv;
      continue;
    }
    if (cv.broken) continue;
    items.push({
      y: cv.def.y,
      draw: () => {
        const x = vcx + cv.def.x * V;
        const y = vy(cv.def.y);
        const yTop = vy(cv.def.y + cv.def.len);
        if (y < -100 || yTop > vh + 100) return;
        if (cv.def.len > 0) longCover(c, map, x, y, yTop, false, s.t, cv.dur / cv.def.max, cv.def.id);
        else cover(c, map, x, y, false, s.t, cv.dur / cv.def.max, cv.def.fragile);
      },
    });
  }
  // os outros corredores da sala; quem está fora da tela vira uma seta na borda
  const offscreen: { sx: number; sy: number; color: string; name: string; ahead: number }[] = [];
  for (const o of s.others ?? []) {
    const ox = vcx + o.x * V;
    const oy = vy(o.y);
    if (oy < -60 || oy > vh + 60 || ox < -60 || ox > vw + 60) {
      offscreen.push({ sx: ox * sc, sy: oy * sc, color: o.color, name: o.name, ahead: o.y - view.y });
      continue;
    }
    items.push({
      y: o.y,
      draw: () => {
        c.save();
        if (o.hidden) {
          c.globalAlpha = 0.5;
          c.translate(ox, oy);
          c.scale(HERO_SCALE, HERO_SCALE);
          silhouette(c, 0, 0, o.color);
        } else {
          c.translate(ox, oy);
          c.scale(HERO_SCALE, HERO_SCALE);
          hero(c, map, 0, 0, s.t, true, 1, o.color);
        }
        c.restore();
        if (o.stunned) stunStars(c, ox, oy - 40, s.t);
        if (s.pushTarget === o.id) {
          c.save();
          c.strokeStyle = YEL;
          c.lineWidth = 5;
          c.setLineDash([9, 7]);
          c.lineDashOffset = -s.t * 30;
          c.globalAlpha = 0.7 + 0.3 * Math.sin(s.t * 10);
          c.beginPath();
          c.arc(ox, oy - 12, 30, 0, 7);
          c.stroke();
          c.restore();
        }
        const label = `@${o.name}`.slice(0, 14);
        c.font = "700 11px 'Space Mono', ui-monospace, monospace";
        const lw = c.measureText(label).width + 14;
        blob(c, rect(ox - lw / 2, oy - 62, lw, 18, 9), o.color, 2, 2);
        mono(c, label, ox, oy - 49, 11, inkOn(o.color), 'center');
      },
    });
  }
  // o boneco
  const hx = vcx + view.x * V;
  items.push({
    y: view.y,
    draw: () => {
      if (view.hidden) {
        c.save();
        c.translate(hx, vpy);
        c.scale(HERO_SCALE, HERO_SCALE);
        silhouette(c, 0, 0, heroColor);
        if (view.shadow > 0) {
          // a Sombra: fiapos roxos girando em volta
          for (let i = 0; i < 6; i++) {
            const an = s.t * 3 + (i * Math.PI * 2) / 6;
            c.fillStyle = `rgba(150,100,255,${0.35 + 0.3 * Math.sin(s.t * 6 + i)})`;
            c.beginPath();
            c.ellipse(Math.cos(an) * 20, -16 + Math.sin(an) * 14, 4, 7, an, 0, 7);
            c.fill();
          }
        }
        c.restore();
        return;
      }
      c.save();
      const dth = s.death;
      // perdeu para o Vigia: treme de susto; para a escuridão: encolhe, gira e some
      c.translate(hx + (dth?.reason === 'vigia' ? Math.sin(s.t * 70) * 3.5 * (1 - dth.age) : 0), vpy);
      c.scale(HERO_SCALE, HERO_SCALE);
      if (dth?.reason === 'escuridao') {
        const k = 1 - 0.55 * dth.age;
        c.scale(k, k);
        c.rotate(dth.age * 3.2);
        c.globalAlpha = 1 - 0.85 * dth.age;
      }
      if (view.knock > 0) {
        // levou uma pancada: estica na direção do empurrão
        const ang = Math.atan2(-view.knockDir.y, view.knockDir.x);
        c.rotate(ang);
        c.scale(1 + 0.45 * view.knock, 1 - 0.3 * view.knock);
        c.rotate(-ang);
      }
      if (view.boost > 0) {
        // o Impulso: imagens que ficam para trás e um brilho dourado
        for (let i = 3; i >= 1; i--) {
          c.save();
          c.globalAlpha = 0.34 / i;
          c.translate(0, i * 11);
          hero(c, map, 0, 0, s.t - i * 0.04, true, 1, heroColor);
          c.restore();
        }
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = 'rgba(255,176,32,0.22)';
        c.beginPath();
        c.arc(0, -16, 26, 0, 7);
        c.fill();
        c.restore();
      }
      hero(c, map, 0, 0, s.t, s.walking, 1, heroColor);
      c.restore();
      if (view.stun > 0) {
        stunStars(c, hx, vpy - 44, s.t);
        mono(c, 'ATORDOADO', hx, vpy - 72, 11, YEL, 'center');
      }
    },
  });
  items.sort((a, b) => b.y - a.y);
  for (const it of items) it.draw();

  // o esconderijo ocupado vai por cima da silhueta, translúcido
  if (own) {
    c.save();
    c.globalAlpha = 0.78;
    const ox = vcx + own.def.x * V;
    if (own.def.len > 0) {
      longCover(c, map, ox, vy(own.def.y), vy(own.def.y + own.def.len), true, s.t, own.dur / own.def.max, own.def.id);
    } else {
      cover(c, map, ox, vy(own.def.y), true, s.t, own.dur / own.def.max, own.def.fragile);
    }
    c.restore();
  }
  if (view.knock > 0.45 && !view.hidden) {
    const k = view.knock;
    c.fillStyle = YEL;
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + s.t * 4;
      const r = (i % 2 ? 7 : 16) * k;
      const px = hx - view.knockDir.x * 26 + Math.cos(a) * r;
      const py = vpy + view.knockDir.y * 26 + Math.sin(a) * r;
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.closePath();
    c.fill();
  }

  // partículas, névoa de longe e a luz do mapa
  const fx = fxFor(c);
  stepFx(fx, s.t, view, map, s.walking);
  drawParticles(W, fx);
  drawHaze(W);
  drawLight(W, hx);
  c.restore();

  // ---- a tela
  // O Vigia fica sempre colado no topo; o painel é estreito no celular para não bater nele.
  vigia(c, { map, face: s.face, warn: s.warn, t: s.t, heroX, cx: w / 2, top: 6, scale: l.vigiaScale, view });
  // A escuridão engole o mapa: de longe sobe aos poucos pela tela e, a menos de 8 m, mostra a
  // distância de verdade até o boneco.
  const dist = Math.max(PLAYER_R, view.y - view.darkY);
  const near = 8;
  const far = 30;
  const room = h - l.heroY;
  const shown =
    dist <= near ? dist * l.ppm : near * l.ppm + Math.max(0, room - near * l.ppm) * clamp((dist - near) / (far - near), 0, 1);
  const darkTop = l.heroY + Math.min(shown, room + 40);
  const gapM = Math.max(0, dist - PLAYER_R);
  darkness(c, w, h, darkTop, s.t, style, l.ppm * 5, clamp((16 - gapM) / 14, 0, 1));
  fogHaze(c, w, h, clamp((far - gapM) / 22, 0, 1), s.t, style);

  if (s.death) deathFx(c, w, h, heroX, l.heroY, s.death, s.t);
  lookAlert(c, w, h, s.t, view.vigia === 'olhando' ? 'look' : s.warn > 0.12 ? 'warn' : null, s.warn);

  offscreenArrows(c, w, h, l, heroX, offscreen, s.t);
  if (s.pushFx) pushBurst(c, heroX, l.heroY, s.pushFx);
  hud(c, s);
  if (s.joy.show) stick(c, l, s.joy);
  else if (s.keysHint) keyHint(c, w, h);
  c.restore();
  void HALF;
  void INK;
  void PAPER;
  void alpha;
}
