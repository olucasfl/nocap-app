// Varredura de QA responsivo do Aperta! (spec 038, etapa 13).
//
// Percorre todas as telas e modais em 320, 390, 768, 1024, 1280 e 1920 px, com toque (emulação de celular de
// verdade: isMobile, hasTouch, DPR 2) até 1024 px e com mouse + teclado em todas, e acusa rolagem lateral,
// texto cortado ou sobreposto, alvo de toque pequeno, elemento coberto e foco invisível. Guarda uma captura
// de cada ponto em `--out` para olhar (as medições não bastam).
//
// A API é simulada no navegador (nenhuma conta nem banco). Precisa do dev server do web no ar:
//   node node_modules/vite/bin/vite.js --port 5217        (em apps/web)
//   node scripts/aperta-qa.mjs --base http://localhost:5217 --out ../../.qa/aperta
// Opções: --widths 320,390  --sizes 844x390,320x480 (largura x altura, além das larguras)  --only pages,collapse
//         --modes touch,mouse  --min-target 44
// O Playwright vem do pacote global (`PLAYWRIGHT_DIR` muda o caminho). Sai com código 1 se achar problema.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import {
  GRIMOIRES,
  dustGoal,
  meetMilestone,
  minPicks,
  newSave,
} from '@nocap/games';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const next = process.argv[i + 1];
  args[a.slice(2)] = next && !next.startsWith('--') ? (i++, next) : 'true';
}
const BASE = args.base ?? 'http://localhost:5217';
const OUT = args.out ?? join(process.cwd(), '.qa', 'aperta');
const MIN_TARGET = Number(args['min-target'] ?? 44);
const WIDTHS = (args.widths ?? '320,390,768,1024,1280,1920').split(',').map(Number);
const ONLY = args.only ? args.only.split(',') : null;
const MODES = (args.modes ?? 'touch,mouse').split(',');

const EXTRA = args.sizes ? args.sizes.split(',').map((x) => x.split('x').map(Number)) : [];
const HEIGHT = { 320: 640, 390: 844, 768: 1024, 1024: 768, 1280: 800, 1920: 1080 };
const heightOf = (w) => HEIGHT[w] ?? Math.round(w * 1.8);
// Toque só até 1024 px (tablet na horizontal); acima disso a pessoa está num computador.
const touchable = (w) => w <= 1024;

const requireGlobal = createRequire(join(process.env.PLAYWRIGHT_DIR ?? 'C:/Users/lucas/AppData/Roaming/npm/node_modules', 'x.js'));
const { chromium } = requireGlobal('playwright');

// --- Saves de cada cenário (montados com o próprio motor) ---

const CLOCK = 100;
const ids = (k, n) => GRIMOIRES.filter((g) => g.unlockedAtCollapse <= k).slice(0, n).map((g) => g.id);

function base(over = {}) {
  const s = newSave('qa', Date.now() - 3_600_000, 'Missão Perigeu');
  return { ...s, tutorial: 'done', storySeen: true, clock: CLOCK, ...over };
}

function withRun(s, run) {
  return { ...s, run: { ...s.run, ...run } };
}

const objects = (n = 3) =>
  ['comet', 'satellite', 'asteroid', 'shooting-star', 'probe'].slice(0, n).map((kind, i) => ({ id: i + 1, kind, bornAt: CLOCK, expiresAt: CLOCK + 3600 }));

function mid() {
  const build = Object.fromEntries(ids(0, 9).map((id, i) => [id, (i % 4) + 1]));
  return withRun(base({ album: Object.keys(build) }), {
    dust: 250_000,
    dustLife: 400_000,
    energy: 3,
    picks: 9,
    build,
    upgradeLevels: [6, 3, 2, 1, 1],
    combo: 6,
    lastPressAt: CLOCK,
    objects: objects(4),
    nextObjectId: 5,
  });
}

function pending() {
  const s = mid();
  const [a, b, c] = ids(0, 3);
  return withRun(s, { pending: { offers: [a, b, c], openedAt: CLOCK - 5, selected: null, picksLeft: 1, rerollsLeft: 2 } });
}

function ready(collapses = 0, over = {}) {
  const k = collapses + 1;
  const build = Object.fromEntries(ids(collapses, 12).map((id, i) => [id, (i % 5) + 1]));
  return withRun(base({ collapses, album: Object.keys(build), ...over }), {
    build,
    picks: minPicks(k),
    dust: dustGoal(k),
    dustLife: dustGoal(k),
    ...meetMilestone(collapses, base().run.upgradeLevels),
  });
}

function late() {
  const collapses = 4;
  const build = Object.fromEntries(ids(collapses, 20).map((id, i) => [id, (i % 7) + 1]));
  const s = base({
    name: 'Missão com nome bem comprido',
    collapses,
    regionId: 'oort-cloud',
    album: ids(collapses, 40),
    vault: { 'sagittarius-a': 2, 'cygnus-x1': 1 },
    sparks: { legacy: 40, spent: 6 },
    tree: { 'co-01': 1, 'co-02': 2, 'au-01': 1, 'sk-01': 2 },
    achievements: ['tap-1', 'collapse-1'],
    favorite: ids(collapses, 1)[0],
  });
  return withRun(s, {
    dust: 1.23e12,
    dustLife: 4.56e12,
    build,
    picks: 14,
    upgradeLevels: [30, 10, 20, 5, 5, 20],
    combo: 12,
    lastPressAt: CLOCK,
    objects: objects(4),
    nextObjectId: 5,
    event: { id: 'meteor-shower', until: CLOCK + 3600 },
    mission: { id: 'capture-20', progress: 7, done: false },
  });
}

const lateReady = () => {
  const s = late();
  const k = s.collapses + 1;
  return withRun(s, { picks: minPicks(k), dust: dustGoal(k), dustLife: dustGoal(k), ...meetMilestone(s.collapses, s.run.upgradeLevels) });
};

const tut = (step) => ({ ...base(), tutorial: step, storySeen: true });

// --- Auditoria dentro da página ---

function auditInPage({ minTarget }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const issues = [];
  const desc = (el) => {
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32);
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${text ? ` "${text}"` : ''}`;
  };
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false;
      if (n.getAttribute('aria-hidden') === 'true') return false;
    }
    return true;
  };
  // Camadas que cobrem o resto de propósito: modais, folhas de página e o véu do tutorial.
  const INTENDED_BLOCKER = '[aria-modal="true"], .ap-newstrip, .ap-sheet, .ap-sheetwrap, .ap-tut-veil, .ap-tut-card, .ap-tut-actions';
  // O elemento está rolado para fora de um contêiner com rolagem (ou de um que corta): não aparece, não conta.
  const clippedAway = (el, r) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      if (r.bottom <= pr.top + 1 || r.top >= pr.bottom - 1 || r.right <= pr.left + 1 || r.left >= pr.right - 1) return true;
    }
    return false;
  };
  // Parte do elemento que aparece de fato: recortada por todo ancestral que corta ou rola (null se nada aparece).
  const visRect = (el, r) => {
    let v = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      v = { left: Math.max(v.left, pr.left), top: Math.max(v.top, pr.top), right: Math.min(v.right, pr.right), bottom: Math.min(v.bottom, pr.bottom) };
      if (v.right - v.left < 1 || v.bottom - v.top < 1) return null;
    }
    return v;
  };
  // Atrás de um modal (aria-modal) nada deve ser medido: a camada de cima é a que a pessoa usa.
  const modal = [...document.querySelectorAll('[aria-modal="true"]')].filter(shown).pop();
  const layer = (el) => !modal || modal.contains(el);

  if (document.documentElement.scrollWidth > vw + 1) {
    issues.push({ kind: 'hscroll', what: `scrollWidth ${document.documentElement.scrollWidth} > ${vw}` });
  }

  // 1. Alvos de toque, fora da tela e cobertos.
  const targets = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [tabindex]')].filter(
    (el) => el.getAttribute('tabindex') !== '-1' || el.matches('button, a, [role="button"]'),
  );
  for (const el of targets) {
    if (!shown(el) || !layer(el)) continue;
    const r = el.getBoundingClientRect();
    const small = Math.min(r.width, r.height) < minTarget - 0.5;
    if (small && !el.disabled) issues.push({ kind: 'small-target', what: `${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)}` });
    if (r.left < -1 || r.right > vw + 1) issues.push({ kind: 'offscreen-x', what: `${desc(el)} ${Math.round(r.left)}..${Math.round(r.right)}` });
    // O objeto do campo tem uma folga transparente no meio do botão: o toque vale na arte.
    const art = el.matches('.ap-obj') && el.querySelector('.ap-obj-drift')?.getBoundingClientRect();
    const vis = visRect(el, art || r);
    if (!vis) continue;
    const cx = Math.min(vw - 1, Math.max(0, (vis.left + vis.right) / 2));
    const cy = Math.min(vh - 1, Math.max(0, (vis.top + vis.bottom) / 2));
    if (r.bottom < 0 || r.top > vh) continue;
    if (clippedAway(el, r)) continue;
    const top = document.elementFromPoint(cx, cy);
    if (top && top !== el && !el.contains(top) && !top.contains(el) && !top.closest(INTENDED_BLOCKER)) {
      issues.push({ kind: 'covered', what: `${desc(el)} coberto por ${desc(top)} em ${(() => { const c = []; for (let n = top; n && c.length < 5; n = n.parentElement) c.push(n.tagName.toLowerCase() + (typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : '')); return c.join('<'); })()}` });
    }
  }

  // 2. Texto cortado, para fora de quem o contém ou sobreposto.
  const texts = [];
  for (const el of document.querySelectorAll('h1, h2, h3, p, span, b, small, li, button, label, em, strong, a')) {
    if (!shown(el) || !layer(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (clippedAway(el, r)) continue;
    const cs = getComputedStyle(el);
    const clipX = cs.overflowX !== 'visible' && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll';
    const clipY = cs.overflowY !== 'visible' && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll';
    if (clipX && el.scrollWidth > el.clientWidth + 1) issues.push({ kind: 'text-clipped', what: `${desc(el)} ${el.scrollWidth}>${el.clientWidth}` });
    if (clipY && el.scrollHeight > el.clientHeight + 1) issues.push({ kind: 'text-clipped', what: `${desc(el)} alto ${el.scrollHeight}>${el.clientHeight}` });
    if (r.left < -1 || r.right > vw + 1) issues.push({ kind: 'text-offscreen', what: `${desc(el)} ${Math.round(r.left)}..${Math.round(r.right)}` });
    let v = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      if (pcs.overflowX === 'visible' && pcs.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      const scrollsX = pcs.overflowX === 'auto' || pcs.overflowX === 'scroll';
      const scrollsY = pcs.overflowY === 'auto' || pcs.overflowY === 'scroll';
      const cutX = pcs.overflowX !== 'visible' && !scrollsX && (v.left < pr.left - 1.5 || v.right > pr.right + 1.5);
      const cutY = pcs.overflowY !== 'visible' && !scrollsY && (v.top < pr.top - 1.5 || v.bottom > pr.bottom + 1.5);
      if (cutX || cutY) {
        issues.push({ kind: 'text-cut-by-parent', what: `${desc(el)} passa de ${desc(p)}` });
        break;
      }
      v = { left: Math.max(v.left, pr.left), top: Math.max(v.top, pr.top), right: Math.min(v.right, pr.right), bottom: Math.min(v.bottom, pr.bottom) };
    }
    const seen = visRect(el, r);
    if (seen) texts.push({ el, r: { left: seen.left, top: seen.top, right: seen.right, bottom: seen.bottom, width: seen.right - seen.left, height: seen.bottom - seen.top } });
  }
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i];
      const b = texts[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 3 && h > 3) {
        const ca = document.elementFromPoint(Math.min(vw - 1, Math.max(0, a.r.left + a.r.width / 2)), Math.min(vh - 1, Math.max(0, a.r.top + a.r.height / 2)));
        const cb = document.elementFromPoint(Math.min(vw - 1, Math.max(0, b.r.left + b.r.width / 2)), Math.min(vh - 1, Math.max(0, b.r.top + b.r.height / 2)));
        // Só vale se os dois estão à vista (um escondido por outro modal/folha não conta).
        if (ca && cb && (a.el.contains(ca) || ca.contains(a.el)) && (b.el.contains(cb) || cb.contains(b.el))) {
          issues.push({ kind: 'text-overlap', what: `${desc(a.el)} x ${desc(b.el)} (${Math.round(w)}x${Math.round(h)})` });
        }
      }
    }
  }
  return issues;
}

// --- Foco pelo teclado ---

function focusInPage() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && !/rgba\(\d+, \d+, \d+, 0\)/.test(cs.outlineColor);
  const shadow = cs.boxShadow !== 'none';
  const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
  const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32);
  return {
    what: `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${text ? ` "${text}"` : ''}`,
    visibleRing: outline || shadow,
    onScreen: r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight,
    sized: r.width > 0 && r.height > 0,
    css: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} / ${cs.boxShadow.slice(0, 30)}`,
  };
}

// --- API falsa ---

async function installApi(context, account) {
  await context.addInitScript(() => {
    localStorage.setItem('nocap-token', 'tok');
    localStorage.setItem('nocap-user', JSON.stringify({ id: 'u-qa', name: 'QA', email: 'qa@nocap.test', username: 'qa' }));
    localStorage.setItem('nocap-mute', '1');
  });
  await context.route(/localhost:3333\//, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return json({});
    if (path === '/me/aperta/saves') {
      const d = account.data;
      const one = d && {
        slot: 1,
        name: d.name,
        collapses: d.collapses,
        vaultCount: Object.keys(d.vault ?? {}).length,
        lastPlayedAt: new Date().toISOString(),
        storySeen: d.storySeen,
        revision: account.rev,
      };
      return json({ slots: [{ slot: 1, save: one, recoverableUntil: null }, { slot: 2, save: null, recoverableUntil: null }] });
    }
    if (path === '/me/aperta/saves/1') {
      if (req.method() === 'GET') return json({ slot: 1, revision: account.rev, data: account.data });
      if (req.method() === 'PUT') {
        account.data = req.postDataJSON().data;
        account.rev += 1;
        return json({ revision: account.rev, flagged: [] });
      }
    }
    if (path.startsWith('/api/auth')) return json({ user: { id: 'u-qa', name: 'QA', email: 'qa@nocap.test', username: 'qa' }, session: { token: 'tok' } });
    return json({ message: 'não simulado' }, 404);
  });
}

// --- Cenários ---

/** Cada cenário recebe um objeto `t` com o que a navegação precisa; devolve depois de tirar suas capturas. */
const SCENARIOS = [
  {
    name: 'title',
    group: 'entry',
    save: null,
    async run(t) {
      await t.open();
      await t.snap('title');
      await t.click(t.page.getByRole('button', { name: 'Jogar' }));
      await t.page.getByRole('dialog').waitFor();
      await t.snap('saves-empty');
    },
  },
  {
    name: 'saves',
    group: 'entry',
    save: () => base({ storySeen: false, name: 'Missão com nome bem comprido' }),
    async run(t) {
      await t.open();
      await t.click(t.page.getByRole('button', { name: 'Jogar' }));
      await t.page.getByRole('dialog').waitFor();
      await t.snap('saves-filled');
      await t.click(t.page.getByRole('button', { name: 'Apagar', exact: true }).first());
      await t.snap('saves-delete-confirm');
      await t.click(t.page.getByRole('button', { name: 'Cancelar' }));
      await t.click(t.page.getByRole('button', { name: 'Continuar' }));
      await t.page.locator('.ap-story').waitFor();
      await t.snap('story-1');
      await t.click(t.page.locator('.ap-story .ap-btn'));
      await t.snap('story-2');
    },
  },
  ...[1, 2, 3, 4, 5].map((step) => ({
    name: `tutorial-${step}`,
    group: 'tutorial',
    save: () => tut(step),
    async run(t) {
      await t.enterGame();
      await t.snap(`tutorial-${step}`);
    },
  })),
  {
    name: 'game',
    group: 'game',
    save: mid,
    async run(t) {
      await t.enterGame();
      await t.snap('game');
      await t.pressTest();
      await t.snap('game-after-press');
    },
  },
  {
    name: 'pages',
    group: 'pages',
    save: mid,
    async run(t) {
      await t.enterGame();
      for (const [label, name] of [['Melhorias', 'Melhorias'], ['Grimórios', 'Grimórios'], ['Conquistas', 'Conquistas']]) {
        await t.click(t.page.locator('.ap-dock').getByRole('button', { name: new RegExp(`^${label}`) }));
        await t.page.locator('.ap-sheet').waitFor();
        await t.snap(`page-${name}`);
        await t.scrollBody('.ap-sbody');
        await t.snap(`page-${name}-end`);
        await t.click(t.page.locator('.ap-sheet .ap-x'));
      }
    },
  },
  {
    name: 'pages-late',
    group: 'pages',
    save: late,
    async run(t) {
      await t.enterGame();
      await t.snap('game-late');
      for (const [btn, name] of [
        [t.page.locator('.ap-dock').getByRole('button', { name: /^Melhorias/ }), 'Melhorias'],
        [t.page.locator('.ap-dock').getByRole('button', { name: /^Grimórios/ }), 'Grimórios'],
        [t.page.locator('.ap-dock').getByRole('button', { name: /^Cofre dos Proibidos/ }), 'Cofre'],
        [t.page.locator('.ap-dock').getByRole('button', { name: /^Conquistas/ }), 'Conquistas'],
        [t.page.locator('.ap-hbtn-tree'), 'Arvore'],
      ]) {
        await t.click(btn);
        await t.page.locator('.ap-sheet').waitFor();
        await t.snap(`late-page-${name}`);
        await t.scrollBody('.ap-sbody');
        await t.snap(`late-page-${name}-end`);
        await t.click(t.page.locator('.ap-sheet .ap-x'));
      }
    },
  },
  {
    name: 'choice',
    group: 'modals',
    save: pending,
    async run(t) {
      await t.enterGame();
      await t.page.getByRole('dialog').waitFor();
      await t.snap('choice-1');
      await t.page.waitForTimeout(1900);
      await t.click(t.page.locator('.ap-choice button, [role="dialog"] button').first());
      await t.snap('choice-selected');
    },
  },
  {
    name: 'collapse',
    group: 'modals',
    save: ready,
    async run(t) {
      await t.enterGame();
      await t.snap('collapse-ready');
      await t.click(t.page.getByRole('button', { name: /Estrela pronta/ }));
      await t.page.getByRole('dialog').waitFor();
      await t.snap('collapse-1');
      await t.page.waitForTimeout(1900);
      await t.click(t.page.locator('.ap-cc-list button').first());
      await t.click(t.page.getByRole('button', { name: 'Continuar' }));
      await t.snap('collapse-2');
    },
  },
  {
    name: 'collapse-late',
    group: 'modals',
    save: lateReady,
    async run(t) {
      await t.enterGame();
      await t.click(t.page.getByRole('button', { name: /Estrela pronta/ }));
      await t.page.getByRole('dialog').waitFor();
      await t.snap('collapse-late-1');
      await t.page.waitForTimeout(1900);
      await t.click(t.page.locator('.ap-cc-list button').first());
      await t.snap('collapse-late-picked');
      await t.click(t.page.getByRole('button', { name: 'Continuar' }));
      await t.snap('collapse-late-2');
    },
  },
  {
    name: 'regions',
    group: 'modals',
    save: late,
    async run(t) {
      await t.enterGame();
      await t.click(t.page.locator('.ap-hudrow-btn'));
      await t.page.getByRole('dialog').waitFor();
      await t.snap('regions');
    },
  },
  {
    name: 'objects',
    group: 'game',
    save: mid,
    async run(t) {
      await t.enterGame();
      await t.snap('objects');
      // Toque de verdade (por coordenada) no centro de cada objeto: se algo cobre, o objeto não some.
      const count = () => t.page.locator('.ap-obj').count();
      const before = await count();
      for (let i = 0; i < before; i++) {
        const obj = t.page.locator('.ap-obj').first();
        const box = await obj.boundingBox();
        const art = await obj.locator('.ap-obj-drift').boundingBox();
        const at = art ?? box;
        await t.tapAt(at.x + at.width / 2, at.y + at.height / 2);
        await t.page.waitForTimeout(200);
      }
      const after = await count();
      if (after !== 0) t.report('objects-captured', 'capture-failed', `${before} objetos, ${after} sobraram depois do toque no centro de cada um`);
      await t.snap('objects-captured');
    },
  },
];

// --- Execução ---

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(args.chromium ? { executablePath: args.chromium } : {});
  const report = [];
  const seen = new Set();

  const sizes = args.widths || !args.sizes ? [...WIDTHS.map((w) => [w, heightOf(w)]), ...EXTRA] : EXTRA;
  for (const [width, height] of sizes) {
    for (const mode of MODES) {
      if (mode === 'touch' && !touchable(width)) continue;
      const touch = mode === 'touch';
      for (const sc of SCENARIOS) {
        if (ONLY && !ONLY.includes(sc.name) && !ONLY.includes(sc.group)) continue;
        const context = await browser.newContext({
          viewport: { width, height },
          deviceScaleFactor: touch ? 2 : 1,
          isMobile: touch && width <= 768,
          hasTouch: touch,
          locale: 'pt-BR',
          reducedMotion: 'no-preference',
        });
        const account = { rev: 1, data: sc.save ? sc.save() : null };
        await installApi(context, account);
        const page = await context.newPage();
        const consoleErrors = [];
        page.on('pageerror', (e) => consoleErrors.push(String(e)));
        const tag = `${width}x${height}-${mode}`;

        const t = {
          page,
          async open() {
            await page.goto(`${BASE}/arcade/aperta`, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('.ap-title, .ap-game', { timeout: 20_000 });
            await page.waitForTimeout(500);
          },
          async click(locator) {
            await locator.waitFor({ state: 'visible', timeout: 8000 });
            if (touch) {
              await locator.scrollIntoViewIfNeeded().catch(() => undefined);
              const box = await locator.boundingBox();
              await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
            } else {
              await locator.click({ timeout: 8000 });
            }
            await page.waitForTimeout(250);
          },
          async tapAt(x, y) {
            if (touch) await page.touchscreen.tap(x, y);
            else await page.mouse.click(x, y);
          },
          report(label, kind, what) {
            report.push({ tag, scenario: sc.name, label, kind, what });
          },
          async enterGame() {
            await t.open();
            await t.click(page.getByRole('button', { name: 'Jogar' }));
            await page.getByRole('dialog').waitFor();
            await t.click(page.getByRole('button', { name: 'Continuar' }));
            await page.locator('.ap-game').waitFor({ timeout: 15_000 });
            await page.waitForTimeout(700);
          },
          async scrollBody(selector) {
            await page.evaluate((sel) => {
              const el = document.querySelector(sel);
              if (el) el.scrollTop = el.scrollHeight;
            }, selector);
            await page.waitForTimeout(150);
          },
          async pressTest() {
            const dust = () => page.locator('.ap-energy b').first().textContent();
            const before = await dust();
            const big = page.locator('.ap-bigbtn');
            for (let i = 0; i < 3; i++) {
              if (touch) {
                const box = await big.boundingBox();
                await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
              } else {
                await big.click();
              }
              await page.waitForTimeout(120);
            }
            // O teclado também toca (Espaço) e abre as páginas (M, Esc).
            await page.keyboard.press('Space');
            await page.waitForTimeout(150);
            const after = await dust();
            if (before === after) report.push({ tag, scenario: sc.name, label: 'press', kind: 'press-no-effect', what: `energia ficou em ${before}` });
            await page.keyboard.press('m');
            await page.locator('.ap-sheet').waitFor({ timeout: 3000 }).catch(() => report.push({ tag, scenario: sc.name, label: 'press', kind: 'key-m', what: 'M não abriu Melhorias' }));
            await page.keyboard.press('Escape');
            await page.waitForTimeout(250);
          },
          async snap(label) {
            await page.waitForTimeout(300);
            await page.screenshot({ path: join(OUT, `${tag}__${label}.png`) });
            const issues = await page.evaluate(auditInPage, { minTarget: MIN_TARGET });
            for (const i of issues) {
              const key = `${tag}|${label}|${i.kind}|${i.what}`;
              if (seen.has(key)) continue;
              seen.add(key);
              report.push({ tag, scenario: sc.name, label, ...i });
            }
            // Foco: Tab por tudo o que dá para focar neste ponto (só uma vez por tela, não a cada captura).
            await focusPass(label);
          },
        };

        const focusSeen = new Set();
        async function focusPass(label) {
          await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
          const first = [];
          for (let i = 0; i < 40; i++) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(30);
            const f = await page.evaluate(focusInPage);
            if (!f) break;
            if (first.includes(f.what)) break;
            first.push(f.what);
            const key = `${label}|${f.what}`;
            if (focusSeen.has(key)) continue;
            focusSeen.add(key);
            if (!f.visibleRing) report.push({ tag, scenario: sc.name, label, kind: 'focus-invisible', what: `${f.what} [${f.css}]` });
            if (!f.onScreen) report.push({ tag, scenario: sc.name, label, kind: 'focus-offscreen', what: f.what });
          }
          await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
        }

        try {
          await sc.run(t);
        } catch (e) {
          report.push({ tag, scenario: sc.name, label: 'run', kind: 'scenario-failed', what: String(e.message).split('\n')[0] });
          await page.screenshot({ path: join(OUT, `${tag}__${sc.name}__FAILED.png`) }).catch(() => undefined);
        }
        for (const e of consoleErrors) report.push({ tag, scenario: sc.name, label: 'run', kind: 'page-error', what: e.slice(0, 160) });
        await context.close();
        process.stdout.write(`${tag} ${sc.name} ok\n`);
      }
    }
  }
  await browser.close();

  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  const byKind = {};
  for (const r of report) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
  console.log(`\n${report.length} problema(s)`, byKind);
  for (const r of report) console.log(`${r.tag} ${r.scenario}/${r.label} ${r.kind}: ${r.what}`);
  process.exit(report.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
