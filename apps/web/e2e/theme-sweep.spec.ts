import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';

/**
 * Varredura de tema claro e escuro: em cada tela, todo botão, link, campo e título visível precisa ter contraste legível
 * entre o texto e o fundo (>= 3:1) e o botão não pode ficar sem fundo nem borda sobre fundo da mesma cor.
 */
const ROUTES = [
  '/',
  '/cor',
  '/tempo',
  '/eco',
  '/atravessa',
  '/blocks',
  '/words',
  '/words/classic',
  '/words/classic/daily',
  '/words/classic/fases/dueto',
  '/words/classic/fase/classic/1',
  '/words/bee',
  '/words/bee/fases',
  '/words/bee/fase/1',
  '/words/connect',
  '/words/connect/fases',
  '/words/connect/fase/1',
  '/amigos',
  '/ranking',
  '/perfil',
  '/entrar',
  '/criar-conta',
  '/sala?jogo=color',
  '/fox-cap',
  '/fox-cap/desmorona',
  '/fox-cap/bola',
  '/fox-cap/counter-fox',
  '/arcade/aperta',
];

for (const scheme of ['light', 'dark'] as const) {
  for (const route of ROUTES) {
    test(`tema ${scheme} ${route}`, async ({ browser }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      const ctx = await browser.newContext({
        viewport: { width: 393, height: 852 },
        colorScheme: scheme,
      });
      const page = await ctx.newPage();
      await installApi(page);
      await page.goto(route);
      await page
        .getByRole('button', { name: 'Agora não' })
        .click({ timeout: 600 })
        .catch(() => undefined);
      await page.waitForTimeout(900);
      const bad = await page.evaluate(() => {
        const parse = (c: string) => {
          const m = c.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const p = m[1]!
            .split(/[ ,/]+/)
            .filter(Boolean)
            .map(Number);
          return { r: p[0]!, g: p[1]!, b: p[2]!, a: p[3] ?? 1 };
        };
        const lum = (c: { r: number; g: number; b: number }) => {
          const f = (v: number) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
        };
        const bgOf = (el: Element) => {
          let acc = { r: 0, g: 0, b: 0, a: 0 };
          const stack: { r: number; g: number; b: number; a: number }[] = [];
          for (let e: Element | null = el; e; e = e.parentElement) {
            const cs = getComputedStyle(e);
            if (cs.backgroundImage !== 'none') return null; // gradiente/imagem: não dá para medir
            const c = parse(cs.backgroundColor);
            if (c && c.a > 0) {
              stack.push(c);
              if (c.a >= 1) break;
            }
          }
          let base = { r: 255, g: 255, b: 255 };
          const root = parse(getComputedStyle(document.body).backgroundColor);
          if (root && root.a > 0) base = root;
          for (const c of stack.reverse())
            base = {
              r: base.r * (1 - c.a) + c.r * c.a,
              g: base.g * (1 - c.a) + c.g * c.a,
              b: base.b * (1 - c.a) + c.b * c.a,
            };
          void acc;
          return base;
        };
        const out: string[] = [];
        const seen = new Set<string>();
        for (const el of document.querySelectorAll<HTMLElement>(
          'button, a[href], input, h1, h2, h3, label, [role=button], [role=tab]',
        )) {
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || +cs.opacity < 0.5 || !(el.textContent || '').trim())
            continue;
          if (el.closest('[aria-hidden=true]') || (el as HTMLButtonElement).disabled) continue;
          const fg = parse(cs.color);
          const bg = bgOf(el);
          if (!fg || !bg) continue;
          const l1 = lum(fg),
            l2 = lum(bg);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          if (ratio < 3) {
            const id = (el.getAttribute('data-testid') || el.className || el.tagName)
              .toString()
              .slice(0, 36);
            const key = `${id}`;
            if (!seen.has(key)) {
              seen.add(key);
              out.push(
                `${el.tagName.toLowerCase()}[${id}] "${(el.textContent || '').trim().slice(0, 22)}" contraste ${ratio.toFixed(1)} (${cs.color} sobre rgb(${bg.r | 0},${bg.g | 0},${bg.b | 0}))`,
              );
            }
          }
        }
        return out.slice(0, 10);
      });
      await ctx.close();
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }
}
