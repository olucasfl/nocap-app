import { HALF, PLAYER_R, type PowerKind, type SinalView } from '@nocap/games';
import { V, joyCenter, screenX, screenY, type Layout } from './camera';
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
  vigia,
  wrapY,
  type Ctx,
} from './draw-art';

/** O nome de cada poder e o que ele vai fazer com você (aparece na tela no aviso do poder). */
export const POWER_INFO: Record<PowerKind, { name: string; text: string }> = {
  corvos: { name: 'OS CORVOS DO ESPANTALHO', text: 'Cobrem a tela e INVERTEM seus controles por 2 s.' },
  oleo: { name: 'ÓLEO NA PISTA', text: 'Poças escorregadias: você desliza sem controle.' },
  poeira: { name: 'POEIRA NOS OLHOS', text: 'Areia embaça a tela inteira por 2 s.' },
  buzina: { name: 'BUZINA DO SEMÁFORO', text: 'Você trava no lugar por 1 s.' },
  farois: { name: 'FARÓIS', text: 'A luz branca cega a tela por 2 s.' },
  vento: { name: 'VENTO DA CORUJA', text: 'Uma rajada empurra você de lado.' },
  atraso: { name: 'ECO DA CORUJA', text: 'Seus comandos demoram a responder por 2 s.' },
  invertido: { name: 'CONTROLES INVERTIDOS', text: 'Esquerda vira direita, frente vira trás.' },
  cortina: { name: 'CORTINA', text: 'A tela escurece: só o boneco aparece.' },
  rajada: { name: 'RAJADA', text: 'Um empurrão forte para o lado.' },
  lama: { name: 'LAMA', text: 'Você anda bem devagar por 3 s.' },
  apagao: { name: 'APAGÃO', text: 'Tudo escuro, só um círculo de luz.' },
  chuva: { name: 'CHUVA DE ABÓBORAS', text: 'Saia dos círculos vermelhos: eles empurram.' },
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
}

/** Desenha um quadro inteiro do Sinal Vermelho. */
export function drawScene(c: Ctx, s: SceneInput) {
  const { layout: l, view } = s;
  const { w, h } = l;
  const map = view.course.map;
  const style = MAP_STYLE[map];
  const boss = view.course.boss;
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
  if (invWarn && !s.view.hidden) {
    c.translate(w / 2, h / 2);
    c.rotate(Math.sin(s.t * 7) * 0.025);
    c.translate(-w / 2, -h / 2);
  }

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
    if (y > -60 && y < vh + 60) finishLine(c, vcx, y, boss);
  }
  // poças de óleo e marcas da chuva
  for (const p of view.patches) oilPatch(c, vcx + p.x * V, vy(p.y), s.t);
  for (const m of view.marks) rainMark(c, vcx + m.x * V, vy(m.y), s.t);

  // obstáculos do caminho (o boneco contorna)
  for (const o of view.obstacles) {
    const y = vy(o.y);
    if (y < -60 || y > vh + 60) continue;
    obstacle(c, map, o.kind, vcx + o.x * V, y, o.r * V * 1.15);
  }
  // esconderijos (os de fora primeiro; o que a pessoa ocupa vai por cima da silhueta)
  let own: SinalView['covers'][number] | null = null;
  for (const cv of view.covers) {
    const x = vcx + cv.def.x * V;
    const y = vy(cv.def.y);
    if (y < -80 || y > vh + 80) continue;
    const occupied = view.hidden && (view.x - cv.def.x) ** 2 + (view.y - cv.def.y) ** 2 <= 1.3 * 1.3;
    if (occupied) {
      own = cv;
      continue;
    }
    if (cv.broken) continue;
    c.save();
    c.translate(x, y);
    c.scale(1.25, 1.25);
    cover(c, map, 0, 0, false, s.t, cv.dur / cv.def.max, cv.def.fragile);
    c.restore();
  }
  const hx = vcx + view.x * V;
  if (!view.hidden) {
    c.save();
    c.translate(hx, vpy);
    c.scale(1.25, 1.25);
    hero(c, map, 0, 0, s.t, s.walking, 1, heroColor);
    c.restore();
  } else {
    c.save();
    c.translate(hx, vpy);
    c.scale(1.25, 1.25);
    silhouette(c, 0, 0, heroColor);
    c.restore();
    if (own) {
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
  // O Vigia fica logo abaixo do painel (em telas baixas, no topo, para não bater no boneco).
  const classic = Number.isFinite(view.course.length);
  // Em tela larga o Vigia fica colado no topo; em celular desce para não bater no painel.
  const vTop = w >= 640 ? 6 : classic ? 124 : 84;
  vigia(c, map, s.face, s.warn, s.t, heroX, w / 2, vTop, l.vigiaScale, boss);
  const darkTop = screenY(l, view.darkY, view.y);
  darkness(c, w, h, darkTop, s.t, style);
  // A névoa já aparece desde o começo, fraquinha, e engrossa quando a escuridão se aproxima.
  const gapM = Math.max(0, view.y - view.darkY - PLAYER_R);
  fogHaze(c, w, h, Math.max(clamp((55 - gapM) / 40, 0, 1), clamp(0.2 + view.t / 240, 0, 0.5)), s.t, style);

  // efeitos dos poderes
  if (has('rajada')) windStreaks(c, w, h, s.t, effects.find((p) => p.kind === 'rajada')!.dir, '#f4f4ef');
  if (has('vento')) windStreaks(c, w, h, s.t, effects.find((p) => p.kind === 'vento')!.dir, '#f9deaa', 0.85);
  if (has('poeira')) dust(c, w, h, s.t, heroX, l.heroY, 1.25);
  if (has('corvos')) crows(c, w, h, s.t, effects.find((p) => p.kind === 'corvos')!.p);
  if (has('farois')) glare(c, w, h, effects.find((p) => p.kind === 'farois')!.p);
  if (has('buzina')) siren(c, w, h, s.t, heroX, l.heroY);
  if (has('atraso')) echo(c, s.t, heroX, l.heroY, heroColor);
  if (has('cortina')) curtain(c, w, h, s.t, heroX, l.heroY, style.rim);
  if (has('apagao')) blackout(c, w, h, heroX, l.heroY);
  if (has('lama')) mud(c, w, h, s.t, heroX, l.heroY);
  for (const p of avisos) {
    if (p.kind === 'poeira') dust(c, w, h, s.t, heroX, l.heroY, 0.35);
    if (p.kind === 'rajada') windStreaks(c, w, h, s.t, p.dir, '#ffd23f', 0.5);
    if (p.kind === 'vento') windStreaks(c, w, h, s.t, p.dir, '#ffd23f', 0.4);
    if (p.kind === 'corvos') crows(c, w, h, s.t, -0.4, 0.5);
  }

  vignette(c, w, h, s.warn, s.t);
  if (view.vigia === 'olhando') lookFrame(c, w, h, s.t);

  hud(c, s);
  powerBanner(c, w, avisos[0]?.kind ?? effects[0]?.kind ?? null, avisos.length > 0, s.t, l.heroY + 70);
  if (s.joy.show) stick(c, l, s.joy, s.inverted);
  else if (s.keysHint) keyHint(c, w, h);
  c.restore();
}

// ---------------------------------------------------------------- peças do mundo
function finishLine(c: Ctx, cx: number, y: number, boss: boolean) {
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
    blob(c, rect(sx - 4, y - 60, 8, 70, 3), boss ? '#e5303a' : '#ffd23f', 3, 3);
  }
  mono(c, boss ? 'CHEFE' : 'CHEGADA', cx, y - 28, 13, INK, 'center');
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

/** Os faróis: um clarão branco que cega e vai passando. */
function glare(c: Ctx, w: number, h: number, p: number) {
  c.save();
  c.globalAlpha = clamp(0.95 - 0.55 * p, 0, 0.95);
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, w, h);
  c.restore();
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

function curtain(c: Ctx, w: number, h: number, t: number, hx: number, hy: number, tint: string) {
  // tinta, penas, fumaça ou areia: cobre a tela, mas deixa sempre uma janela clara em volta do boneco
  c.save();
  c.fillStyle = 'rgba(17,17,17,.9)';
  c.beginPath();
  c.rect(0, 0, w, h);
  c.arc(hx, hy, Math.max(70, Math.min(w, h) * 0.2), 0, Math.PI * 2, true);
  c.fill('evenodd');
  c.globalAlpha = 0.5;
  c.strokeStyle = tint;
  c.lineWidth = 3;
  c.beginPath();
  c.arc(hx, hy, Math.max(70, Math.min(w, h) * 0.2) + Math.sin(t * 5) * 2, 0, 7);
  c.stroke();
  c.restore();
}

function blackout(c: Ctx, w: number, h: number, hx: number, hy: number) {
  c.save();
  const r = Math.max(80, Math.min(w, h) * 0.22);
  c.fillStyle = 'rgba(0,0,0,.93)';
  c.beginPath();
  c.rect(0, 0, w, h);
  c.arc(hx, hy, r, 0, Math.PI * 2, true);
  c.fill('evenodd');
  c.restore();
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
  const a = warn * (0.35 + 0.25 * Math.sin(t * (5 + warn * 10)));
  const g = c.createRadialGradient(w / 2, h * 0.45, h * 0.28, w / 2, h * 0.45, h * 0.72);
  g.addColorStop(0, 'rgba(229,48,58,0)');
  g.addColorStop(1, `rgba(229,48,58,${a})`);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
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
  blob(c, rect(14, 12, 124, 56, 14), PAPER, 3, 3);
  mono(c, classic ? 'DISTÂNCIA TOTAL' : 'METROS', 24, 28, 9.5, '#4a4a44');
  disp(c, String(meters), 24, 58, 32, INK);
  const nw = c.measureText(String(meters)).width;
  mono(c, 'm', 24 + nw + 4, 58, 13, INK);

  let y = 76;
  if (classic) {
    // A trilha fica só na faixa de fora da pista, embaixo da distância total.
    const side = l.w / 2 - HALF * l.ppm;
    progressBar(c, s, 14, 76, Math.max(124, Math.min(side - 28, 240)));
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
  const boss = view.course.boss;
  const len = view.course.length;
  const p = clamp(view.y / len, 0, 1);
  blob(c, rect(x, y, w, 44, 12), PAPER, 2.5, 2);
  const left = Math.max(0, Math.ceil(len - view.y));
  mono(c, `${boss ? 'CHEFE · ' : ''}FASE ${view.course.n}`, x + 10, y + 16, 10, INK);
  mono(c, `faltam ${left} m`, x + w - 10, y + 16, 10, '#4a4a44', 'right');
  const tx = x + 12;
  const tw = w - 36;
  const ty = y + 28;
  c.fillStyle = boss ? '#e5303a' : ORG;
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
  blob(c, poly([[fx, ty - 5], [fx + 9, ty - 1], [fx, ty + 3]]), boss ? '#e5303a' : YEL, 1.6, 0);
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
