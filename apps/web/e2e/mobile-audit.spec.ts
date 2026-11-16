import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/**
 * Varredura de celular (docs/MOBILE-GUIDE.md): cada tela, em retrato e paisagem, em aparelhos pequenos e grandes, com as áreas
 * seguras emuladas (notch, ilha, furo de câmera, barra de gestos). Confere: rolagem horizontal, controle fora da área segura,
 * alvo de toque pequeno, texto cortado, texto miúdo, controle coberto ou cortado pela borda. Grava `test-results/mobile-audit/`.
 *
 * Uso: AUDIT=hub pnpm exec playwright test e2e/mobile-audit.spec.ts --project=desktop --trace off
 * (AUDIT filtra por nome do grupo; AUDIT_SHOTS=1 também salva uma captura por aparelho; AUDIT_DEV filtra aparelhos.)
 */
const OUT = 'test-results/mobile-audit';

interface Dev {
  name: string;
  w: number;
  h: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}
const DEVICES: Dev[] = [
  { name: 'se', w: 375, h: 667, top: 0, right: 0, bottom: 0, left: 0 },
  { name: 'a-small', w: 360, h: 640, top: 24, right: 0, bottom: 0, left: 0 },
  { name: 'pixel', w: 412, h: 915, top: 32, right: 0, bottom: 16, left: 0 },
  { name: 'iph15', w: 393, h: 852, top: 59, right: 0, bottom: 34, left: 0 },
  { name: 'promax', w: 430, h: 932, top: 59, right: 0, bottom: 34, left: 0 },
  { name: 'se-land', w: 667, h: 375, top: 0, right: 0, bottom: 0, left: 0 },
  { name: 'a-land', w: 800, h: 360, top: 0, right: 0, bottom: 16, left: 40 },
  { name: 'iph15-land', w: 852, h: 393, top: 0, right: 59, bottom: 21, left: 59 },
  { name: 'promax-land', w: 932, h: 430, top: 0, right: 59, bottom: 21, left: 59 },
  { name: 'ipad', w: 820, h: 1180, top: 24, right: 0, bottom: 20, left: 0 },
  { name: 'ipad-land', w: 1180, h: 820, top: 24, right: 0, bottom: 20, left: 0 },
];

/** Grupos de telas (um commit por grupo). Chave: nome do grupo; valor: [nome da tela, rota]. */
type Act = (page: Page) => Promise<void>;
export const GROUPS: Record<string, [string, string, Act?][]> = {
  hub: [
    ['hub', '/'],
    ['hub-fox-cap', '/fox-cap?jogo=atravessa'],
  ],
  ranking: [['ranking', '/ranking']],
  amigos: [
    ['amigos', '/amigos', async (p) => void (await p.getByRole('tab', { name: /^Amigos/ }).click())],
    ['amigos-pedidos', '/amigos', async (p) => void (await p.getByRole('tab', { name: /Pedidos/ }).click())],
    [
      'amigos-adicionar',
      '/amigos',
      async (p) => {
        await p.getByRole('tab', { name: /Adicionar/ }).click();
        await p.getByRole('textbox').first().fill('mar');
        await p.getByRole('button', { name: /Buscar/ }).click();
        await p.waitForTimeout(900);
      },
    ],
    ['amigo-perfil', '/amigos/ana'],
  ],
  perfil: [
    ['perfil', '/perfil'],
    ['entrar', '/entrar'],
    ['criar', '/criar-conta'],
  ],
  cor: [['cor', '/cor']],
  tempo: [['tempo', '/tempo']],
  eco: [['eco', '/eco']],
  atravessa: [['atravessa', '/atravessa']],
  words: [
    ['words', '/words'],
    ['classic', '/words/classic'],
    ['classic-daily', '/words/classic/daily'],
    ['classic-fases', '/words/classic/fases/dueto'],
    ['bee', '/words/bee'],
    ['bee-fases', '/words/bee/fases'],
    ['connect', '/words/connect'],
    ['connect-fases', '/words/connect/fases'],
  ],
  blocks: [['blocks', '/blocks']],
  foxcap: [
    ['desmorona', '/fox-cap/desmorona'],
    ['bola', '/fox-cap/bola'],
    ['counter-fox', '/fox-cap/counter-fox'],
  ],
  minigolf: [
    ['golf-home', '/minigolf'],
    ['golf-fases', '/minigolf/fases'],
    ['golf-bola', '/minigolf/bola'],
  ],
  nighthunt: [['nighthunt', '/nighthunt']],
  sala: [['sala', '/sala?jogo=color']],
};

async function metrics(page: Page, d: Dev, pass: 'top' | 'end') {
  return page.evaluate(({ d, pass }) => {
    const out: string[] = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const over = document.documentElement.scrollWidth - vw;
    if (over > 1) out.push(`H-SCROLL: a página rola ${over}px na horizontal`);
    const canScrollY = (el: Element | null): boolean => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (/auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1) return true;
      }
      return document.scrollingElement!.scrollHeight > vh + 1;
    };
    const label = (el: Element) => {
      const h = el as HTMLElement;
      const id = (h.getAttribute('data-testid') || (typeof h.className === 'string' ? h.className : '') || h.tagName)
        .toString()
        .split(' ')[0]!
        .slice(0, 36);
      return `${el.tagName.toLowerCase()}[${id}] "${(h.textContent || h.getAttribute('aria-label') || '').trim().slice(0, 22)}"`;
    };
    const seen = new Set<string>();
    const add = (kind: string, el: Element, msg: string) => {
      const key = `${kind}|${label(el)}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(`${kind}: ${label(el)} ${msg}`);
    };
    const visible = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return null;
      return r;
    };
    const inter = Array.from(
      document.querySelectorAll<HTMLElement>('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab]'),
    );
    const rects: [HTMLElement, DOMRect][] = [];
    for (const el of inter) {
      const r = visible(el);
      if (!r) continue;
      rects.push([el, r]);
      const onScreen = r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
      if (!onScreen) {
        // fora da janela e sem rolagem que o alcance: cortado
        if (r.top >= vh - 1 && !canScrollY(el.parentElement)) add('CORTADO', el, 'abaixo da tela sem rolagem');
        continue;
      }
      if (r.left < d.left - 1) add('BORDA', el, `invade a esquerda ${Math.round(d.left - r.left)}px`);
      if (r.right > vw - d.right + 1) add('BORDA', el, `invade a direita ${Math.round(r.right - (vw - d.right))}px`);
      if (pass === 'top' && r.top >= 0 && r.top < d.top - 1) add('BORDA', el, `invade o topo ${Math.round(d.top - r.top)}px`);
      if (pass === 'end' && r.bottom <= vh + 1 && r.bottom > vh - d.bottom + 1) add('BORDA', el, `invade a base ${Math.round(r.bottom - (vh - d.bottom))}px`);
      if (r.left < -1 || r.right > vw + 1) add('CORTADO', el, 'passa da borda da tela');
      if (pass === 'end' && r.bottom > vh + 1 && r.top < vh && !canScrollY(el.parentElement)) add('CORTADO', el, 'cortado embaixo, sem rolagem');
      const small = Math.min(r.width, r.height);
      if (el.tagName !== 'INPUT' && small < 40) add('TOQUE', el, `alvo de ${Math.round(r.width)}x${Math.round(r.height)}px (< 40)`);
    }
    // controles que se cobrem (centro de um dentro de outro que não é pai/filho)
    for (let i = 0; i < (pass === 'end' ? rects.length : 0); i++) {
      const [a, ra] = rects[i]!;
      const cx = ra.left + ra.width / 2;
      const cy = ra.top + ra.height / 2;
      if (cx < 0 || cx > vw || cy < 0 || cy > vh) continue;
      const top = document.elementFromPoint(cx, cy);
      if (top && top !== a && !a.contains(top) && !top.contains(a)) {
        const t = top as HTMLElement;
        // tela cheia por cima (menu de jogo, modal): o que está embaixo está inativo, não é conflito
        let full = false;
        for (let e: HTMLElement | null = t; e && !full; e = e.parentElement) {
          const cs2 = getComputedStyle(e);
          if (cs2.position === 'fixed' || cs2.position === 'absolute') {
            const rr = e.getBoundingClientRect();
            if (rr.width >= vw * 0.9 && rr.height >= vh * 0.9) full = true;
          }
        }
        if (full) continue;
        if (t.closest('button, a[href], input, select, textarea, [role=button], [role=tab]') || getComputedStyle(t).position === 'fixed')
          add('COBERTO', a, `coberto por ${label(top)}`);
      }
    }
    // texto cortado e texto miúdo
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (!el.childNodes.length || !Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || '').trim())) continue;
      const r = visible(el);
      if (!r || r.bottom < 0 || r.top > vh) continue;
      const cs = getComputedStyle(el);
      // o `zoom` da moldura encolhe o texto sem mudar o valor calculado: mede o tamanho que aparece na tela
      const zf = el.offsetWidth > 0 ? r.width / el.offsetWidth : 1;
      const fs = parseFloat(cs.fontSize) * (zf > 0.3 && zf < 3 ? zf : 1);
      if (fs < (cs.textTransform === 'uppercase' || (el.textContent || '').trim() === (el.textContent || '').trim().toUpperCase() ? 9.5 : 11)) add('MIUDO', el, `fonte ${fs.toFixed(1)}px`);
      if (el.scrollWidth > el.clientWidth + 2 && /hidden|clip/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis' && cs.whiteSpace !== 'normal')
        add('TEXTO', el, `cortado (${el.scrollWidth}>${el.clientWidth})`);
    }
    // texto que passa da borda da própria caixa (a caixa do cartão, botão ou etiqueta que o contém)
    const isBox = (e: HTMLElement) => {
      const cs = getComputedStyle(e);
      const bg = cs.backgroundColor;
      const hasBg = bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && !/rgba\(.*, 0\)$/.test(bg);
      return hasBg || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 || cs.backgroundImage !== 'none';
    };
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const tn = Array.from(el.childNodes).find((n) => n.nodeType === 3 && (n.textContent || '').trim());
      if (!tn) continue;
      if (getComputedStyle(el).textOverflow === 'ellipsis') {
        if (el.scrollWidth > el.clientWidth + 1 && visible(el)) add('TRUNCADO', el, `texto com reticências (${el.scrollWidth}>${el.clientWidth})`);
        continue;
      }
      const er = visible(el);
      if (!er || er.bottom < 0 || er.top > vh) continue;
      const range = document.createRange();
      range.selectNodeContents(tn);
      const tr = range.getBoundingClientRect();
      if (tr.width < 2) continue;
      let box: HTMLElement | null = el;
      while (box && box !== document.body && !isBox(box)) box = box.parentElement;
      if (!box || box === document.body || box === document.documentElement) continue;
      const br = box.getBoundingClientRect();
      if (br.width < 6) continue;
      const left = br.left - tr.left;
      const right = tr.right - br.right;
      if (left > 1.5 || right > 1.5) add('TRANSBORDA', el, `texto passa da caixa ${Math.round(Math.max(left, right))}px (${label(box)})`);
    }
    return out.slice(0, 30);
  }, { d, pass });
}

const only = process.env.AUDIT;
const devFilter = process.env.AUDIT_DEV?.split(',');
const devices = devFilter ? DEVICES.filter((x) => devFilter.includes(x.name)) : DEVICES;

for (const [group, routes] of Object.entries(GROUPS)) {
  if (only && !only.split(',').includes(group)) continue;
  for (const [name, url, act] of routes) {
    test(`mobile ${group} / ${name}`, async ({ page, context }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      test.setTimeout(120_000);
      await installApi(page);
      const cdp = await context.newCDPSession(page);
      // AUDIT_PWA=1: simula o app instalado (sem barra do navegador; o app troca estilos por `display-mode: standalone`)
      if (process.env.AUDIT_PWA)
        await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] });
      const report: Record<string, string[]> = {};
      mkdirSync(OUT, { recursive: true });
      for (const d of devices) {
        await page.setViewportSize({ width: d.w, height: d.h });
        await cdp.send('Emulation.setSafeAreaInsetsOverride', {
          insets: { top: d.top, right: d.right, bottom: d.bottom, left: d.left },
        });
        await page.goto(url);
        await page
          .getByRole('button', { name: 'Agora não' })
          .click({ timeout: 700 })
          .catch(() => undefined);
        await page.waitForTimeout(900);
        if (act) {
          await act(page);
          await page.waitForTimeout(500);
        }
        if (process.env.AUDIT_SHOTS)
          await page.screenshot({ path: `${OUT}/${name}-${d.name}.png` });
        const m: string[] = [];
        for (const pass of ['top', 'end'] as const) {
          await page.evaluate((pp) => {
            const all = [document.scrollingElement as Element, ...document.querySelectorAll('*')];
            for (const e of all) {
              const el = e as HTMLElement;
              if (
                el.scrollHeight > el.clientHeight + 2 &&
                (el === document.scrollingElement || /auto|scroll/.test(getComputedStyle(el).overflowY))
              )
                el.scrollTop = pp === 'end' ? el.scrollHeight : 0;
            }
          }, pass);
          await page.waitForTimeout(150);
          m.push(...(await metrics(page, d, pass)));
        }
        if (m.length) report[d.name] = [...new Set(m)];
      }
      writeFileSync(`${OUT}/${name}.json`, JSON.stringify(report, null, 1));
      const lines = Object.entries(report).flatMap(([k, v]) => v.map((x) => `${k}: ${x}`));
      expect(lines, lines.join('\n')).toEqual([]);
    });
  }
}
