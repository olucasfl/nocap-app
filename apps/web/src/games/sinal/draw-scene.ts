import { HALF, PLAYER_R, type PowerKind, type SinalView } from '@nocap/games';
import { V, joyCenter, screenX, type Layout } from './camera';
import {
  INK,
  MAP_STYLE,
  HERO_COLOR,
  ORG,
  PAPER,
  YEL,
  blob,
  circle,
  clamp,
  cover,
  longCover,
  darkness,
  disp,
  fogHaze,
  ell,
  ground,
  hero,
  line,
  mono,
  obstacle,
  poly,
  rect,
  silhouette,
  star,
  vigia,
  wrapY,
  type Ctx,
} from './draw-art';

/** O nome de cada poder e o que ele vai fazer com você (aparece na tela no aviso do poder). */
export const POWER_INFO: Record<PowerKind, { name: string; text: string }> = {
  corvos: { name: 'OS CORVOS DO ESPANTALHO', text: 'Cobrem a tela e INVERTEM seus controles por 2 s.' },
  oleo: { name: 'ÓLEO NA PISTA', text: 'Poças escorregadias: você desliza sem controle.' },
  poeira: { name: 'POEIRA NOS OLHOS', text: 'Uma nuvem de areia: você só enxerga um palmo à frente.' },
  buzina: { name: 'BUZINA DO SEMÁFORO', text: 'Você trava no lugar por 1 s.' },
  farois: { name: 'FARÓIS', text: 'A luz cega: tudo apagado e embaçado, só dá para ver bem pouco à frente.' },
  vento: { name: 'VENTO DA CORUJA', text: 'Uma rajada empurra você de lado.' },
  atraso: { name: 'ECO DA CORUJA', text: 'Seus comandos demoram a responder por 2 s.' },
  invertido: { name: 'CONTROLES INVERTIDOS', text: 'Esquerda vira direita, frente vira trás.' },
  cortina: { name: 'CORTINA', text: 'Uma cortina roxa embaça tudo: só se vê o que está perto.' },
  rajada: { name: 'RAJADA', text: 'Um empurrão forte para o lado.' },
  lama: { name: 'LAMA', text: 'Você anda bem devagar por 3 s.' },
  apagao: { name: 'APAGÃO', text: 'Tudo escuro, só um pequeno círculo de luz em volta de você.' },
  chuva: { name: 'CHUVA DE ABÓBORAS', text: 'Saia dos círculos vermelhos: eles empurram.' },
  espelho: { name: 'ESPELHO', text: 'Esquerda vira direita e direita vira esquerda.' },
  bebado: { name: 'TONTURA', text: 'Você balança de um lado para o outro e a tela dobra.' },
  soluco: { name: 'SOLUÇO', text: 'De repente um empurrão, para qualquer lado.' },
  turbo: { name: 'TURBO', text: 'Você fica rápido demais: cuidado para conseguir parar.' },
  patins: { name: 'PATINS', text: 'O chão vira gelo: você desliza e demora a parar.' },
  bolhas: { name: 'BOLHAS DE SABÃO', text: 'O chão fica ensaboado: você desliza sem parar, sem controle.' },
  pixelado: { name: 'PIXELADO', text: 'A tela vira quadradões: difícil enxergar o caminho.' },
  negativo: { name: 'NEGATIVO', text: 'As cores se invertem e fica estranho de ler.' },
  lupa: { name: 'LUPA', text: 'Um zoom enorme em você: o que vem pela frente chega de surpresa.' },
};

export interface Joy {
  /** Mostra o analógico (aparelho de toque). */
  show: boolean;
  dx: number;
  dy: number;
  active: boolean;
}

export interface Notice {
  text: string;
  color: string;
}

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
  /** Os controles estão invertidos agora. */
  inverted: boolean;
  /** Tranco da tela (0 a 1): pancada, soluço. */
  jolt: number;
  /** Sala: os outros corredores (vivos), com a cor e o nome de cada um. */
  others?: { id: string; x: number; y: number; hidden: boolean; stunned?: boolean; color: string; name: string }[];
  /** Sala: quem está ao alcance do empurrão (ganha um anel pulsando). */
  pushTarget?: string | null;
}

/** Desenha um quadro inteiro do Sinal Vermelho. */
export function drawScene(c: Ctx, s: SceneInput) {
  const { layout: l, view } = s;
  const { w, h } = l;
  const map = view.course.map;
  const style = MAP_STYLE[map];
  const effects = s.view.hidden
    ? []
    : s.view.powers.filter((p) => !p.evaded && p.phase === 'efeito');
  const avisos = s.view.powers.filter((p) => !p.evaded && p.phase === 'aviso');
  const has = (k: PowerKind) => effects.some((p) => p.kind === k);
  const heroX = screenX(l, view.x);
  const heroColor = s.color ?? HERO_COLOR[map];

  c.save();
  c.clearRect(0, 0, w, h);
  // O mundo treme de leve quando os controles estão invertidos (aviso e efeito).
  const invWarn = s.view.powers.some((p) => (p.kind === 'invertido' || p.kind === 'corvos') && !p.evaded);
  const drunkP = s.view.powers.find((p) => p.kind === 'bebado' && !p.evaded);
  const sway =
    drunkP && !s.view.hidden ? Math.sin(s.t * 2.4) * (drunkP.phase === 'efeito' ? 0.08 : 0.02) : 0;
  const tilt = (invWarn && !s.view.hidden ? Math.sin(s.t * 7) * 0.025 : 0) + sway;
  if (tilt !== 0) {
    c.translate(w / 2, h / 2);
    c.rotate(tilt);
    c.translate(-w / 2, -h / 2);
  }
  // pancadas e soluços dão um tranco na tela inteira
  if (s.jolt > 0.02) c.translate(Math.sin(s.t * 95) * 7 * s.jolt, Math.cos(s.t * 83) * 7 * s.jolt);

  // ---- o mundo, em pixels de arte
  const sc = l.ppm / V;
  c.save();
  c.scale(sc, sc);
  const vw = w / sc;
  const vh = h / sc;
  const vcx = vw / 2;
  const vpy = l.heroY / sc;
  const vy = (wy: number) => vpy - (wy - view.y) * V;
  ground(c, map, view.y * V, vw, vh, HALF * V);

  // linha do seu recorde
  if (s.best !== null && s.best > 0) {
    const y = vy(s.best);
    if (y > -20 && y < vh + 20) {
      c.save();
      c.setLineDash([14, 9]);
      c.lineWidth = 6;
      c.strokeStyle = YEL;
      c.beginPath();
      c.moveTo(vcx - HALF * V, y);
      c.lineTo(vcx + HALF * V, y);
      c.stroke();
      c.restore();
    }
  }
  // linha de chegada (Clássico)
  if (Number.isFinite(view.course.length)) {
    const y = vy(view.course.length);
    if (y > -60 && y < vh + 60) finishLine(c, vcx, y);
  }
  // poças de óleo e marcas da chuva
  for (const p of view.patches) oilPatch(c, vcx + p.x * V, vy(p.y), s.t);
  for (const m of view.marks) rainMark(c, vcx + m.x * V, vy(m.y), s.t);

  // obstáculos do caminho: primeiro os de chão (lama, esteira, ímã), depois os sólidos por cima
  for (const pass of [0, 1]) {
    for (const o of view.obstacles) {
      const floor = !(
        o.kind === 'pequeno' ||
        o.kind === 'medio' ||
        o.kind === 'grande' ||
        o.kind === 'deslizante' ||
        o.kind === 'vaivem' ||
        o.kind === 'mola' ||
        o.kind === 'orbita' ||
        o.kind === 'serra'
      );
      if (floor !== (pass === 0)) continue;
      const y = vy(o.y);
      if (y < -120 || y > vh + 120) continue;
      obstacle(c, map, o.kind, vcx + o.x * V, y, o.r * V, s.t, o.dir, o.bump);
    }
  }
  // esconderijos (os de fora primeiro; o que a pessoa ocupa vai por cima da silhueta)
  let own: SinalView['covers'][number] | null = null;
  for (const cv of view.covers) {
    const x = vcx + cv.def.x * V;
    const y = vy(cv.def.y);
    const yTop = vy(cv.def.y + cv.def.len);
    if (y < -80 || yTop > vh + 80) continue;
    const near = Math.max(cv.def.y, Math.min(view.y, cv.def.y + cv.def.len));
    const occupied = view.hidden && (view.x - cv.def.x) ** 2 + (view.y - near) ** 2 <= 1.3 * 1.3;
    if (occupied) {
      own = cv;
      continue;
    }
    if (cv.broken) continue;
    if (cv.def.len > 0) {
      longCover(c, map, x, y, yTop, false, s.t, cv.dur / cv.def.max);
      continue;
    }
    c.save();
    c.translate(x, y);
    c.scale(1.25, 1.25);
    cover(c, map, 0, 0, false, s.t, cv.dur / cv.def.max, cv.def.fragile);
    c.restore();
  }
  // os outros corredores da sala: escondidos aparecem fracos, e quem dá para empurrar ganha um anel
  for (const o of s.others ?? []) {
    const ox = vcx + o.x * V;
    const oy = vy(o.y);
    if (oy < -60 || oy > vh + 60) continue;
    c.save();
    c.translate(ox, oy);
    c.scale(1.25, 1.25);
    if (o.hidden) {
      c.globalAlpha = 0.5;
      silhouette(c, 0, 0, o.color);
    } else {
      hero(c, map, 0, 0, s.t, true, 1, o.color);
    }
    c.restore();
    if (o.stunned) stunStars(c, ox, oy - 34, s.t);
    if (s.pushTarget === o.id) {
      c.save();
      c.strokeStyle = YEL;
      c.lineWidth = 5;
      c.setLineDash([9, 7]);
      c.lineDashOffset = -s.t * 30;
      c.globalAlpha = 0.7 + 0.3 * Math.sin(s.t * 10);
      c.beginPath();
      c.arc(ox, oy, 30, 0, 7);
      c.stroke();
      c.restore();
    }
    const label = `@${o.name}`.slice(0, 14);
    c.font = "700 11px 'Space Mono', ui-monospace, monospace";
    const lw = c.measureText(label).width + 14;
    blob(c, rect(ox - lw / 2, oy - 46, lw, 18, 9), o.color, 2, 2);
    mono(c, label, ox, oy - 33, 11, o.color === '#3a3a36' || o.color === '#7a3cff' || o.color === '#2f5bff' ? PAPER : INK, 'center');
  }
  const hx = vcx + view.x * V;
  if (!view.hidden) {
    c.save();
    c.translate(hx, vpy);
    c.scale(1.25, 1.25);
    if (view.knock > 0) {
      // levou uma pancada: estica na direção do empurrão
      const ang = Math.atan2(-view.knockDir.y, view.knockDir.x);
      c.rotate(ang);
      c.scale(1 + 0.45 * view.knock, 1 - 0.3 * view.knock);
      c.rotate(-ang);
    }
    hero(c, map, 0, 0, s.t, s.walking, 1, heroColor);
    c.restore();
    if (view.stun > 0) {
      stunStars(c, hx, vpy - 34, s.t);
      mono(c, 'ATORDOADO', hx, vpy - 62, 11, '#ffd23f', 'center');
    }
    if (view.knock > 0.45) {
      // estrelinha do choque, do lado de onde veio a pancada
      const k = view.knock;
      blob(c, star(hx - view.knockDir.x * 24, vpy + view.knockDir.y * 24, 16 * k, 7 * k, 8, s.t * 4), YEL, 2.2, 0);
    }
  } else {
    c.save();
    c.translate(hx, vpy);
    c.scale(1.25, 1.25);
    silhouette(c, 0, 0, heroColor);
    c.restore();
    if (own && own.def.len > 0) {
      c.save();
      c.globalAlpha = 0.72;
      longCover(c, map, vcx + own.def.x * V, vy(own.def.y), vy(own.def.y + own.def.len), true, s.t, own.dur / own.def.max);
      c.restore();
    } else if (own) {
      c.save();
      c.globalAlpha = 0.72;
      c.translate(vcx + own.def.x * V, vy(own.def.y));
      c.scale(1.25, 1.25);
      cover(c, map, 0, 0, true, s.t, own.dur / own.def.max, own.def.fragile);
      c.restore();
    }
  }
  c.restore();

  // ---- a tela
  // O Vigia fica sempre colado no topo; o painel é estreito no celular para não bater nele.
  const vTop = 6;
  vigia(c, map, s.face, s.warn, s.t, heroX, w / 2, vTop, l.vigiaScale);
  // A escuridão vai engolindo o mapa: de longe sobe aos poucos pela tela (compressão visual) e,
  // a menos de 8 m, mostra a distância de verdade até o boneco.
  const dist = Math.max(PLAYER_R, view.y - view.darkY);
  const near = 8;
  const room = h - l.heroY;
  const shown =
    dist <= near
      ? dist * l.ppm
      : near * l.ppm + Math.max(0, room - near * l.ppm) * clamp((dist - near) / (40 - near), 0, 1);
  const darkTop = l.heroY + Math.min(shown, room + 40);
  darkness(c, w, h, darkTop, s.t, style, l.ppm * 6);
  // A névoa já aparece desde o começo, fraquinha, e engrossa quando a escuridão se aproxima.
  const gapM = Math.max(0, view.y - view.darkY - PLAYER_R);
  fogHaze(c, w, h, clamp((40 - gapM) / 30, 0, 1), s.t, style);

  // efeitos dos poderes
  if (has('rajada')) windStreaks(c, w, h, s.t, effects.find((p) => p.kind === 'rajada')!.dir, '#f4f4ef');
  if (has('vento')) windStreaks(c, w, h, s.t, effects.find((p) => p.kind === 'vento')!.dir, '#f9deaa', 0.85);
  const eff = (k: PowerKind) => effects.find((e) => e.kind === k);
  /** Entra e sai suave: o efeito pega rápido e solta no fim. */
  const fade = (p: number) => clamp(Math.min(p / 0.08, (1 - p) / 0.1), 0, 1);
  const vision = l.ppm;
  if (has('poeira')) {
    // Poeira nos olhos: a areia cobre tudo e embaça; só um palmo em volta do boneco fica à vista.
    const k = fade(eff('poeira')!.p);
    limitedVision(c, w, h, heroX, l.heroY, vision * 1.8, { rgb: '18,12,4', alpha: 1, blur: 14, k });
    dust(c, w, h, s.t, heroX, l.heroY, 0.9 * k);
  }
  if (has('corvos')) crows(c, w, h, s.t, effects.find((p) => p.kind === 'corvos')!.p);
  if (has('farois')) {
    // Cegueira: o clarão branco passa e deixa tudo apagado e embaçado, só dá para ver bem pouco à frente.
    const p = eff('farois')!.p;
    const k = fade(p);
    limitedVision(c, w, h, heroX, l.heroY, vision * 2.0, {
      rgb: '0,0,0',
      alpha: 1,
      blur: 12,
      k,
      filter: 'grayscale(0.7) brightness(0.7)',
    });
    if (p < 0.16) {
      c.save();
      c.globalAlpha = 1 - p / 0.16;
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, w, h);
      c.restore();
    }
  }
  if (has('buzina')) siren(c, w, h, s.t, heroX, l.heroY);
  if (has('atraso')) echo(c, s.t, heroX, l.heroY, heroColor);
  if (has('cortina')) {
    limitedVision(c, w, h, heroX, l.heroY, vision * 2.4, { rgb: '8,2,18', alpha: 1, blur: 7, k: fade(eff('cortina')!.p) });
  }
  if (has('apagao')) {
    limitedVision(c, w, h, heroX, l.heroY, vision * 1.6, { rgb: '0,0,0', alpha: 1, blur: 0, k: fade(eff('apagao')!.p) });
  }
  // as brincadeiras
  if (has('espelho')) mirrorHint(c, w, h, s.t, fade(eff('espelho')!.p));
  if (has('bebado')) ghostImage(c, w, s.t, fade(eff('bebado')!.p));
  if (has('turbo')) speedLines(c, w, h, s.t, fade(eff('turbo')!.p));
  if (has('patins')) iceWash(c, w, h, s.t, fade(eff('patins')!.p));
  if (has('bolhas')) bubbles(c, w, h, s.t, fade(eff('bolhas')!.p));
  if (has('pixelado')) pixelate(c, w, 16 * fade(eff('pixelado')!.p));
  if (has('negativo') && fade(eff('negativo')!.p) > 0.5) negative(c, w, h);
  if (has('lupa')) zoomLens(c, w, heroX, l.heroY, 1 + 1.3 * fade(eff('lupa')!.p));
  if (has('soluco') && s.jolt > 0.2) mono(c, 'HIC!', heroX, l.heroY - 46, 16 + 10 * s.jolt, '#ffd23f', 'center');
  if (has('lama')) mud(c, w, h, s.t, heroX, l.heroY);
  for (const p of avisos) {
    if (p.kind === 'poeira') dust(c, w, h, s.t, heroX, l.heroY, 0.35);
    if (p.kind === 'rajada') windStreaks(c, w, h, s.t, p.dir, '#ffd23f', 0.5);
    if (p.kind === 'vento') windStreaks(c, w, h, s.t, p.dir, '#ffd23f', 0.4);
    if (p.kind === 'corvos') crows(c, w, h, s.t, -0.4, 0.5);
  }

  vignette(c, w, h, s.warn, s.t);
  if (view.vigia === 'olhando') lookFrame(c, w, h, s.t);
  stopAlert(c, w, h, s.t, view.vigia === 'olhando' ? 'look' : s.warn > 0.12 ? 'warn' : null, Math.max(l.heroY - 120, 150), s.warn);

  hud(c, s);
  powerBanner(c, w, avisos[0]?.kind ?? effects[0]?.kind ?? null, avisos.length > 0, s.t, l.heroY + 70);
  if (s.joy.show) stick(c, l, s.joy, s.inverted);
  else if (s.keysHint) keyHint(c, w, h);
  c.restore();
}

// ---------------------------------------------------------------- peças do mundo
function finishLine(c: Ctx, cx: number, y: number) {
  const w = HALF * 2 * V;
  const x0 = cx - w / 2;
  const sq = 18;
  for (let i = 0; i < Math.ceil(w / sq); i++) {
    for (let j = 0; j < 2; j++) {
      c.fillStyle = (i + j) % 2 ? INK : PAPER;
      c.fillRect(x0 + i * sq, y - sq + j * sq, sq, sq);
    }
  }
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.strokeRect(x0, y - sq, w, sq * 2);
  for (const sx of [x0 - 6, x0 + w + 6]) {
    blob(c, rect(sx - 4, y - 60, 8, 70, 3), '#ffd23f', 3, 3);
  }
  mono(c, 'CHEGADA', cx, y - 28, 13, INK, 'center');
}

function oilPatch(c: Ctx, x: number, y: number, t: number) {
  c.save();
  c.globalAlpha = 0.85;
  blob(c, ell(x, y, 58, 50), '#1a1a2a', 3, 3);
  c.globalAlpha = 0.6;
  c.fillStyle = '#7a3cff';
  c.beginPath();
  c.ellipse(x - 14 + Math.sin(t * 2) * 3, y - 8, 18, 8, -0.3, 0, 7);
  c.fill();
  c.fillStyle = '#25c7e8';
  c.beginPath();
  c.ellipse(x + 10, y + 5 + Math.cos(t * 2) * 2, 8, 4, 0.2, 0, 7);
  c.fill();
  c.restore();
}

function rainMark(c: Ctx, x: number, y: number, t: number) {
  const pulse = 1 + Math.sin(t * 14) * 0.06;
  c.save();
  c.translate(x, y);
  c.scale(pulse, pulse);
  c.globalAlpha = 0.35;
  c.fillStyle = '#e5303a';
  c.beginPath();
  c.arc(0, 0, 54, 0, 7);
  c.fill();
  c.globalAlpha = 1;
  c.setLineDash([8, 6]);
  c.lineWidth = 4;
  c.strokeStyle = '#e5303a';
  c.stroke();
  c.setLineDash([]);
  line(c, -12, -12, 12, 12, 4, '#e5303a');
  line(c, 12, -12, -12, 12, 4, '#e5303a');
  c.restore();
}

// ---------------------------------------------------------------- efeitos em tela cheia
function windStreaks(c: Ctx, w: number, h: number, t: number, dir: -1 | 1, col: string, alpha = 0.7) {
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = col;
  c.lineWidth = 3;
  c.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const y = ((i * 97) % h) + 0;
    const x = wrapY(i * 131 + dir * t * 420, w + 120) - 60;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + dir * 46, y);
    c.stroke();
  }
  c.restore();
}

function dust(c: Ctx, w: number, h: number, t: number, hx: number, hy: number, strength = 1) {
  // areia nas bordas: o centro (onde está o boneco) continua claro
  c.save();
  const g = c.createRadialGradient(hx, hy, Math.min(w, h) * 0.18, hx, hy, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(244,196,108,0)');
  g.addColorStop(0.55, `rgba(244,196,108,${0.55 * strength})`);
  g.addColorStop(1, `rgba(201,154,82,${0.9 * strength})`);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.globalAlpha = 0.8 * strength;
  c.fillStyle = '#f9deaa';
  for (let i = 0; i < 40; i++) {
    const x = wrapY(i * 83 + t * 260, w + 40) - 20;
    const y = (i * 61 + Math.sin(t * 3 + i) * 18 + h) % h;
    c.beginPath();
    c.arc(x, y, 1.6 + (i % 3), 0, 7);
    c.fill();
  }
  c.restore();
}

/**
 * Os corvos: um bando grande, de asas largas, que cruza a tela e cobre boa parte dela. `p` é o
 * quanto do efeito já passou (os corvos entram, ficam e saem); `scale` diminui o bando no aviso.
 */
function crows(c: Ctx, w: number, h: number, t: number, p: number, scale = 1) {
  const cover = p < 0 ? 0.35 : Math.sin(Math.min(1, p) * Math.PI) ** 0.6;
  c.save();
  if (p >= 0) {
    c.fillStyle = `rgba(17,17,17,${0.28 * cover})`;
    c.fillRect(0, 0, w, h);
  }
  c.fillStyle = INK;
  const n = 11;
  for (let i = 0; i < n; i++) {
    const dir = i % 2 ? 1 : -1;
    const span = (70 + (i % 4) * 22) * scale;
    const x = wrapY(i * 83 + dir * t * (190 + (i % 4) * 50), w + span * 2) - span;
    const y = h * (0.1 + 0.8 * ((i * 0.37) % 1)) + Math.sin(t * 4 + i) * 14;
    const flap = Math.sin(t * 14 + i) * span * 0.22;
    c.globalAlpha = Math.max(0.2, cover);
    c.beginPath();
    c.moveTo(x - span, y + flap);
    c.quadraticCurveTo(x - span * 0.4, y - span * 0.35, x, y);
    c.quadraticCurveTo(x + span * 0.4, y - span * 0.35, x + span, y + flap);
    c.quadraticCurveTo(x + span * 0.4, y + span * 0.1, x, y + span * 0.3);
    c.quadraticCurveTo(x - span * 0.4, y + span * 0.1, x - span, y + flap);
    c.fill();
    c.beginPath();
    c.arc(x, y + span * 0.08, span * 0.13, 0, 7);
    c.fill();
    c.fillStyle = '#ffd23f';
    c.beginPath();
    c.moveTo(x + dir * span * 0.12, y + span * 0.05);
    c.lineTo(x + dir * span * 0.3, y + span * 0.1);
    c.lineTo(x + dir * span * 0.12, y + span * 0.14);
    c.fill();
    c.fillStyle = INK;
  }
  for (let i = 0; i < 18; i++) {
    const px = (i * 61 + Math.sin(t * 2 + i) * 20) % w;
    const py = wrapY(t * 80 + i * 90, h);
    c.globalAlpha = 0.6 * cover;
    c.fillRect(px, py, 3, 10);
  }
  c.restore();
}

// ---------------------------------------------------------------- visão limitada e brincadeiras
const snap: { a: HTMLCanvasElement | null; b: HTMLCanvasElement | null } = { a: null, b: null };

/** Uma cópia do quadro desenhado até agora (para embaçar, pixelar, dobrar, dar zoom). */
function snapshot(c: Ctx): HTMLCanvasElement | null {
  const cv = c.canvas;
  if (!snap.a) snap.a = document.createElement('canvas');
  if (snap.a.width !== cv.width || snap.a.height !== cv.height) {
    snap.a.width = cv.width;
    snap.a.height = cv.height;
  }
  const tc = snap.a.getContext('2d');
  if (!tc) return null;
  tc.setTransform(1, 0, 0, 1, 0, 0);
  tc.clearRect(0, 0, cv.width, cv.height);
  tc.drawImage(cv, 0, 0);
  return snap.a;
}

/**
 * Visão curta de verdade: o quadro todo fica embaçado (desfoque do navegador) e coberto por uma
 * tinta (areia, fumaça, escuro), e só um círculo de raio `r` em volta do boneco continua nítido.
 */
function limitedVision(
  c: Ctx,
  w: number,
  h: number,
  hx: number,
  hy: number,
  r: number,
  o: { rgb: string; alpha: number; blur: number; k: number; filter?: string },
) {
  if (o.k <= 0.01) return;
  const cv = c.canvas;
  const px = cv.width / w;
  if (o.blur > 0 && 'filter' in c) {
    const src = snapshot(c);
    if (src) {
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.filter = `blur(${o.blur * o.k * px}px)${o.filter ? ` ${o.filter}` : ''}`;
      c.drawImage(src, 0, 0);
      c.filter = 'none';
      // o círculo em volta do boneco continua nítido, com a borda suave
      if (!snap.b) snap.b = document.createElement('canvas');
      if (snap.b.width !== cv.width || snap.b.height !== cv.height) {
        snap.b.width = cv.width;
        snap.b.height = cv.height;
      }
      const mc = snap.b.getContext('2d');
      if (mc) {
        mc.globalCompositeOperation = 'source-over';
        mc.clearRect(0, 0, cv.width, cv.height);
        mc.drawImage(src, 0, 0);
        mc.globalCompositeOperation = 'destination-in';
        const g = mc.createRadialGradient(hx * px, hy * px, r * px * 0.45, hx * px, hy * px, r * px);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        mc.fillStyle = g;
        mc.fillRect(0, 0, cv.width, cv.height);
        c.drawImage(snap.b, 0, 0);
      }
      c.restore();
    }
  }
  // a tinta cobre tudo o que está fora do círculo
  c.save();
  const g = c.createRadialGradient(hx, hy, r * 0.5, hx, hy, r * 1.25);
  g.addColorStop(0, `rgba(${o.rgb},0)`);
  g.addColorStop(1, `rgba(${o.rgb},${o.alpha * o.k})`);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.restore();
}

/** Tontura: a imagem dobra, uma cópia balançando para os lados. */
function ghostImage(c: Ctx, w: number, t: number, k: number) {
  const src = snapshot(c);
  if (!src || k <= 0) return;
  const px = c.canvas.width / w;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 0.5 * k;
  c.drawImage(src, Math.sin(t * 3.1) * 22 * k * px, Math.cos(t * 2.3) * 8 * k * px);
  c.restore();
}

/** Turbo: riscos de velocidade correndo de cima para baixo. */
function speedLines(c: Ctx, w: number, h: number, t: number, k: number) {
  c.save();
  c.strokeStyle = '#ffffff';
  c.lineWidth = 3;
  c.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = (i * 53 + 17) % w;
    const y = wrapY(t * 1100 + i * 131, h + 240) - 120;
    c.globalAlpha = 0.55 * k;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x, y + 60 + (i % 4) * 28);
    c.stroke();
  }
  c.restore();
}

/** Patins: o chão vira gelo, com cintilações e geada nos cantos. */
function iceWash(c: Ctx, w: number, h: number, t: number, k: number) {
  c.save();
  c.fillStyle = `rgba(170,230,255,${0.16 * k})`;
  c.fillRect(0, 0, w, h);
  for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]] as const) {
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.45);
    g.addColorStop(0, `rgba(235,250,255,${0.7 * k})`);
    g.addColorStop(1, 'rgba(235,250,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
  c.fillStyle = '#ffffff';
  for (let i = 0; i < 14; i++) {
    const x = (i * 97 + 31) % w;
    const y = (i * 151 + 53) % h;
    c.globalAlpha = (0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i))) * k;
    c.fillRect(x - 1.5, y - 6, 3, 12);
    c.fillRect(x - 6, y - 1.5, 12, 3);
  }
  c.restore();
}

/** Bolhas enormes que sobem e tapam a visão. */
function bubbles(c: Ctx, w: number, h: number, t: number, k: number) {
  c.save();
  for (let i = 0; i < 11; i++) {
    const r = 38 + (i % 5) * 17;
    const x = ((i * 137) % 100) / 100 * w + Math.sin(t * 0.9 + i) * 34;
    const y = h + r - ((t * (34 + (i % 4) * 13) + i * 83) % (h + r * 2));
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.5 * k})`);
    g.addColorStop(1, `rgba(150,215,255,${0.38 * k})`);
    c.fillStyle = g;
    c.strokeStyle = `rgba(255,255,255,${0.9 * k})`;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(x, y, r, 0, 7);
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(x - r * 0.35, y - r * 0.35, r * 0.18, Math.PI, Math.PI * 1.6);
    c.stroke();
  }
  c.restore();
}

/** Pixelado: o quadro vira quadradões. */
function pixelate(c: Ctx, w: number, size: number) {
  if (size < 2) return;
  const src = snapshot(c);
  if (!src) return;
  const cv = c.canvas;
  const px = cv.width / w;
  const sw = Math.max(8, Math.round(cv.width / (size * px)));
  const sh = Math.max(8, Math.round(cv.height / (size * px)));
  if (!snap.b) snap.b = document.createElement('canvas');
  snap.b.width = sw;
  snap.b.height = sh;
  const mc = snap.b.getContext('2d');
  if (!mc) return;
  mc.drawImage(src, 0, 0, sw, sh);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.imageSmoothingEnabled = false;
  c.drawImage(snap.b, 0, 0, sw, sh, 0, 0, cv.width, cv.height);
  c.restore();
}

/** Negativo: todas as cores se invertem. */
function negative(c: Ctx, w: number, h: number) {
  c.save();
  c.globalCompositeOperation = 'difference';
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, w, h);
  c.restore();
}

/** Lupa: um zoom grande em volta do boneco. */
function zoomLens(c: Ctx, w: number, hx: number, hy: number, z: number) {
  if (z <= 1.02) return;
  const src = snapshot(c);
  if (!src) return;
  const px = c.canvas.width / w;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.translate(hx * px, hy * px);
  c.scale(z, z);
  c.translate(-hx * px, -hy * px);
  c.drawImage(src, 0, 0);
  c.restore();
}

/** Espelho: um friso azul e as setas que trocam de lado. */
function mirrorHint(c: Ctx, w: number, h: number, t: number, k: number) {
  c.save();
  c.fillStyle = `rgba(37,199,232,${0.09 * k})`;
  c.fillRect(0, 0, w, h);
  c.globalAlpha = 0.7 * k;
  c.strokeStyle = '#25c7e8';
  c.lineWidth = 3;
  c.setLineDash([12, 10]);
  c.lineDashOffset = -t * 30;
  c.beginPath();
  c.moveTo(w / 2, 0);
  c.lineTo(w / 2, h);
  c.stroke();
  c.restore();
}

/** Estrelinhas girando em volta da cabeça: o boneco está atordoado. */
function stunStars(c: Ctx, x: number, y: number, t: number) {
  for (let i = 0; i < 3; i++) {
    const an = t * 7 + (i * Math.PI * 2) / 3;
    blob(c, star(x + Math.cos(an) * 20, y + Math.sin(an) * 6, 8, 3.4, 5, t * 5 + i), YEL, 1.8, 0);
  }
}

/** A buzina: a borda pisca e o boneco fica travado. */
function siren(c: Ctx, w: number, h: number, t: number, hx: number, hy: number) {
  c.save();
  c.globalAlpha = 0.35 + 0.3 * Math.sin(t * 22);
  c.lineWidth = 14;
  c.strokeStyle = '#ff4b4b';
  c.strokeRect(7, 7, w - 14, h - 14);
  c.restore();
  mono(c, 'TRAVADO', hx, hy - 34, 12, '#ffd23f', 'center');
}

/** O eco: sombras do boneco que ficam para trás, como o atraso dos comandos. */
function echo(c: Ctx, t: number, hx: number, hy: number, col: string) {
  c.save();
  c.globalAlpha = 0.35;
  for (let i = 1; i <= 3; i++) {
    c.fillStyle = col;
    c.beginPath();
    c.arc(hx + Math.sin(t * 5 + i) * 9 * i, hy + i * 11, 13 - i * 2, 0, 7);
    c.fill();
  }
  c.restore();
  mono(c, 'ATRASO', hx, hy - 34, 12, '#ffd23f', 'center');
}

function mud(c: Ctx, w: number, h: number, t: number, hx: number, hy: number) {
  c.save();
  c.globalAlpha = 0.5;
  c.fillStyle = '#6b4a2b';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + t * 0.4;
    c.beginPath();
    c.ellipse(hx + Math.cos(a) * 52, hy + 14 + Math.sin(a) * 18, 18, 9, 0, 0, 7);
    c.fill();
  }
  c.restore();
  mono(c, 'DEVAGAR', hx, hy + 54, 11, '#f4f4ef', 'center');
}

function vignette(c: Ctx, w: number, h: number, warn: number, t: number) {
  if (warn <= 0.02) return;
  const a = Math.min(1, warn * (0.65 + 0.3 * Math.sin(t * (5 + warn * 10))));
  const g = c.createRadialGradient(w / 2, h * 0.45, h * 0.12, w / 2, h * 0.45, h * 0.62);
  g.addColorStop(0, 'rgba(229,48,58,0)');
  g.addColorStop(1, `rgba(229,48,58,${a})`);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

/**
 * O alerta grande para quem joga sem som: no aviso, placa de PARE piscando com "ELE VAI OLHAR" e a
 * borda da tela pulsando; quando ele olha, tela avermelhada com "NÃO SE MEXA". O falso aviso é igual.
 */
function stopAlert(c: Ctx, w: number, h: number, t: number, state: 'warn' | 'look' | null, y: number, warn: number) {
  if (!state) return;
  const look = state === 'look';
  c.save();
  if (look) {
    // ele virou: a tela fica bem vermelha
    c.fillStyle = 'rgba(229,48,58,0.34)';
    c.fillRect(0, 0, w, h);
    c.lineWidth = 34;
    c.strokeStyle = '#ff2d3a';
    c.globalAlpha = 0.9;
    c.strokeRect(0, 0, w, h);
  } else {
    // o vermelho cresce junto com o aviso: quanto mais perto de ele virar, mais forte
    const pulse = 0.5 + 0.5 * Math.sin(t * (14 + 10 * warn));
    c.globalAlpha = 0.55 + 0.45 * pulse;
    c.lineWidth = 22 + 26 * warn;
    c.strokeStyle = '#ff2d3a';
    c.strokeRect(0, 0, w, h);
    c.globalAlpha = (0.1 + 0.3 * warn) * (0.5 + 0.5 * pulse);
    c.fillStyle = '#ff2d3a';
    c.fillRect(0, 0, w, h);
  }
  c.globalAlpha = 1;
  const pop = look ? 1 : 1 + 0.07 * Math.sin(t * 16);
  const bw = Math.min(w - 40, 300);
  c.translate(w / 2, y);
  c.scale(pop, pop);
  blob(c, rect(-bw / 2, -52, bw, 104, 18), look ? '#e5303a' : YEL, 4, 4);
  // placa de PARE (ou olho aberto, quando ele já está olhando)
  const R = 30;
  const ox = -bw / 2 + 14 + R;
  if (look) {
    blob(c, ell(ox, 0, R, R * 0.66), '#ffffff', 3.5, 0);
    blob(c, circle(ox, 0, R * 0.36), INK, 2, 0);
    blob(c, circle(ox - 4, -4, 4), '#ffffff', 0.01, 0);
  } else {
    const pts: [number, number][] = [];
    for (let i = 0; i < 8; i++) {
      const an = (Math.PI / 4) * i + Math.PI / 8;
      pts.push([ox + Math.cos(an) * R, Math.sin(an) * R]);
    }
    blob(c, poly(pts), '#e5303a', 4, 0);
    mono(c, 'PARE', ox, 6, 14, '#ffffff', 'center');
  }
  const tx = ox + R + 12;
  disp(c, look ? 'VIROU!' : 'PARE!', tx, look ? 2 : -2, look ? 32 : 32, look ? '#ffffff' : INK);
  mono(c, look ? 'NÃO SE MEXA' : 'ELE VAI VIRAR', tx, 26, 12.5, look ? '#ffffff' : INK);
  c.restore();
}

/** Moldura vermelha enquanto o Vigia olha: não se mexa. */
function lookFrame(c: Ctx, w: number, h: number, t: number) {
  c.save();
  c.globalAlpha = 0.55 + Math.sin(t * 12) * 0.2;
  c.lineWidth = 10;
  c.strokeStyle = '#e5303a';
  c.strokeRect(5, 5, w - 10, h - 10);
  c.restore();
}

// ---------------------------------------------------------------- interface
function hud(c: Ctx, s: SceneInput) {
  const { view, layout: l } = s;
  const classic = Number.isFinite(view.course.length);
  const meters = Math.floor(view.meters);
  const narrow = l.w < 640;
  const cw = narrow ? 108 : 124;
  blob(c, rect(14, 12, cw, 56, 14), PAPER, 3, 3);
  mono(c, classic ? 'DISTÂNCIA TOTAL' : 'METROS', 24, 28, 9.5, '#4a4a44');
  disp(c, String(meters), 24, 58, 32, INK);
  const nw = c.measureText(String(meters)).width;
  mono(c, 'm', 24 + nw + 4, 58, 13, INK);

  let y = 76;
  if (classic) {
    // A trilha fica só na faixa de fora da pista, embaixo da distância total.
    const side = l.w / 2 - HALF * l.ppm;
    progressBar(c, s, 14, 76, Math.max(cw, Math.min(side - 28, 240)));
    y = 128;
  }
  const chips: Notice[] = [];
  const gap = Math.max(0, view.y - view.darkY - PLAYER_R);
  chips.push({ text: `ESCURIDÃO ${Math.floor(gap)} m`, color: gap < 15 ? ORG : '#0d0d12' });
  if (view.hidden) chips.push({ text: 'ESCONDIDO', color: '#33c27f' });
  chips.push(...s.notices);
  for (const chip of chips) {
    const w = Math.max(96, chip.text.length * 7.2 + 28);
    blob(c, rect(14, y, w, 22, 11), chip.color, 2.5, 2);
    const dark = chip.color === '#0d0d12' || chip.color === '#e5303a';
    mono(c, chip.text, 14 + 14, y + 15, 10, dark ? PAPER : INK);
    if (chip.text === 'ESCONDIDO') eyeSlash(c, 14 + w - 16, y + 11);
    y += 28;
  }
}

function eyeSlash(c: Ctx, x: number, y: number) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(0, 0, 7, 4.5, 0, 0, 7);
  c.stroke();
  c.fillStyle = INK;
  c.beginPath();
  c.arc(0, 0, 2, 0, 7);
  c.fill();
  c.beginPath();
  c.moveTo(-8, 6);
  c.lineTo(8, -6);
  c.stroke();
  c.restore();
}

/** Trilha de progresso da fase: um cartão pequeno com "FASE n", "faltam X m" e o boneco andando até a bandeira. */
function progressBar(c: Ctx, s: SceneInput, x: number, y: number, w: number) {
  const { view } = s;
  const len = view.course.length;
  const p = clamp(view.y / len, 0, 1);
  blob(c, rect(x, y, w, 44, 12), PAPER, 2.5, 2);
  const left = Math.max(0, Math.ceil(len - view.y));
  mono(c, `FASE ${view.course.n}`, x + 10, y + 16, 10, INK);
  mono(c, w < 130 ? `${left} m` : `faltam ${left} m`, x + w - 10, y + 16, 10, '#4a4a44', 'right');
  const tx = x + 12;
  const tw = w - 36;
  const ty = y + 28;
  c.fillStyle = ORG;
  c.beginPath();
  c.roundRect(tx, ty, Math.max(6, tw * p), 6, 3);
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  c.beginPath();
  c.roundRect(tx, ty, tw, 6, 3);
  c.stroke();
  line(c, tx + tw / 2, ty - 3, tx + tw / 2, ty + 9, 2);
  // bandeirinha
  const fx = x + w - 14;
  line(c, fx, ty - 5, fx, ty + 11, 2.4);
  blob(c, poly([[fx, ty - 5], [fx + 9, ty - 1], [fx, ty + 3]]), YEL, 1.6, 0);
  // boneco
  blob(c, circle(tx + tw * p, ty + 3, 6), s.color ?? HERO_COLOR[view.course.map], 2, 0);
}

/** O aviso de um poder: o nome e o que vai acontecer com você, antes (e durante) o efeito. */
function powerBanner(c: Ctx, w: number, kind: PowerKind | null, warning: boolean, t: number, y: number) {
  if (!kind) return;
  const info = POWER_INFO[kind];
  const bw = Math.min(w - 28, 380);
  const x = (w - bw) / 2;
  c.save();
  // Pisca devagar no aviso (dá para ler); no efeito fica firme e um pouco mais clara.
  c.globalAlpha = warning ? 0.94 + Math.sin(t * 6) * 0.06 : 0.82;
  const lines = wrapText(c, info.text, bw - 28, 13);
  const bh = 40 + lines.length * 18;
  blob(c, rect(x, y, bw, bh, 14), warning ? YEL : PAPER, 3, 3);
  mono(c, warning ? `ATENÇÃO: ${info.name}` : `AGORA: ${info.name}`, w / 2, y + 24, 13.5, INK, 'center');
  lines.forEach((ln, i) => mono(c, ln, w / 2, y + 45 + i * 18, 13, INK, 'center'));
  c.restore();
}

function wrapText(c: Ctx, text: string, maxW: number, size: number): string[] {
  c.font = `700 ${size}px 'Space Mono', ui-monospace, monospace`;
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const wd of words) {
    const next = cur ? `${cur} ${wd}` : wd;
    if (c.measureText(next).width > maxW && cur) {
      lines.push(cur);
      cur = wd;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function stick(c: Ctx, l: Layout, joy: Joy, inverted: boolean) {
  const { x: cx, y: cy, r } = joyCenter(l);
  c.save();
  c.globalAlpha = 0.96;
  c.fillStyle = 'rgba(244,244,239,.18)';
  c.beginPath();
  c.arc(cx, cy, r, 0, 7);
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = inverted ? '#7a3cff' : PAPER;
  c.stroke();
  for (const [ax, ay] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
    c.beginPath();
    c.moveTo(cx + ax * 40 - ay * 6 - ax * 6, cy + ay * 40 + ax * 6 - ay * 6);
    c.lineTo(cx + ax * 46, cy + ay * 46);
    c.lineTo(cx + ax * 40 + ay * 6 - ax * 6, cy + ay * 40 - ax * 6 - ay * 6);
    c.lineWidth = 2.6;
    c.stroke();
  }
  blob(c, circle(cx + joy.dx * 26, cy + joy.dy * 26, 24), inverted ? '#7a3cff' : ORG, 3, 3);
  c.restore();
}

function keyHint(c: Ctx, w: number, h: number) {
  const keys = ['W', 'A', 'S', 'D'];
  const bx = w / 2 - 78;
  const by = h - 74;
  blob(c, rect(bx - 10, by - 14, 176, 58, 14), 'rgba(17,17,17,.7)', 2.5, 0, 'transparent');
  keys.forEach((k, i) => {
    const kx = bx + i * 38;
    blob(c, rect(kx, by, 30, 30, 8), PAPER, 2.5, 2);
    mono(c, k, kx + 15, by + 20, 14, INK, 'center');
  });
  mono(c, 'ou as setas para andar', w / 2, by + 56, 9.5, PAPER, 'center');
}
