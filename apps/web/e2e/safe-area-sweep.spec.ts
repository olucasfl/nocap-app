import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';

/**
 * Varredura de bordas de iPhone/iPad (PWA): com as áreas seguras emuladas (notch, ilha, barra de início), todo botão, link e campo
 * visível precisa ficar dentro da área segura, e a página não pode rolar na horizontal. Só roda no projeto desktop (viewport próprio).
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
];
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
  { name: 'iphone-se', w: 375, h: 667, top: 0, right: 0, bottom: 0, left: 0 },
  { name: 'iphone-15', w: 393, h: 852, top: 59, right: 0, bottom: 34, left: 0 },
  { name: 'iphone-15-land', w: 852, h: 393, top: 0, right: 59, bottom: 21, left: 59 },
  { name: 'ipad', w: 820, h: 1180, top: 24, right: 0, bottom: 20, left: 0 },
  { name: 'ipad-land', w: 1180, h: 820, top: 24, right: 0, bottom: 20, left: 0 },
];

for (const route of ROUTES) {
  test(`bordas ${route}`, async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    test.setTimeout(90_000);
    await installApi(page);
    const cdp = await context.newCDPSession(page);
    const problems: string[] = [];
    for (const d of DEVICES) {
      await page.setViewportSize({ width: d.w, height: d.h });
      await cdp.send('Emulation.setSafeAreaInsetsOverride', {
        insets: { top: d.top, right: d.right, bottom: d.bottom, left: d.left },
      });
      await page.goto(route);
      await page
        .getByRole('button', { name: 'Agora não' })
        .click({ timeout: 600 })
        .catch(() => undefined);
      await page.waitForTimeout(700);
      const bad: string[] = [];
      for (const pass of ['top', 'end'] as const) {
        await page.evaluate((pp) => {
          const all = [document.scrollingElement as Element, ...document.querySelectorAll('*')];
          for (const e of all) {
            const el = e as HTMLElement;
            if (
              el.scrollHeight > el.clientHeight + 2 &&
              (el === document.scrollingElement ||
                /auto|scroll/.test(getComputedStyle(el).overflowY))
            )
              el.scrollTop = pp === 'end' ? el.scrollHeight : 0;
          }
        }, pass);
        await page.waitForTimeout(150);
        bad.push(
          ...(await page.evaluate(
            ({ d, pass }) => {
              const out: string[] = [];
              const over = document.documentElement.scrollWidth - window.innerWidth;
              if (over > 0) out.push(`rolagem horizontal ${over}px`);
              const seen = new Set<string>();
              for (const el of document.querySelectorAll<HTMLElement>(
                'button, a[href], input, select, textarea, [role=button], [data-testid=wl-back]',
              )) {
                const r = el.getBoundingClientRect();
                if (r.width < 2 || r.height < 2) continue;
                // o que está numa fileira que rola de lado (as prateleiras da Home) pode passar da tela: é para rolar
                let scroller = false;
                for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
                  const ox = getComputedStyle(p).overflowX;
                  if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth + 2)
                    scroller = true;
                }
                if (scroller) continue;
                const cs = getComputedStyle(el);
                if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0)
                  continue;
                // só o que está na tela agora (o que rola pode estar fora)
                if (
                  r.bottom < 0 ||
                  r.top > window.innerHeight ||
                  r.right < 0 ||
                  r.left > window.innerWidth
                )
                  continue;
                const errs: string[] = [];
                if (r.left < d.left - 1) errs.push(`esquerda ${Math.round(d.left - r.left)}px`);
                if (r.right > window.innerWidth - d.right + 1)
                  errs.push(`direita ${Math.round(r.right - (window.innerWidth - d.right))}px`);
                if (pass === 'top' && r.top < d.top - 1 && r.top >= 0)
                  errs.push(`topo ${Math.round(d.top - r.top)}px`);
                if (
                  pass === 'end' &&
                  r.bottom > window.innerHeight - d.bottom + 1 &&
                  r.bottom <= window.innerHeight + 1
                )
                  errs.push(`base ${Math.round(r.bottom - (window.innerHeight - d.bottom))}px`);
                if (errs.length) {
                  const id = (el.getAttribute('data-testid') || el.className || el.tagName)
                    .toString()
                    .slice(0, 40);
                  const key = `${id}:${errs.join(',')}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    out.push(
                      `${el.tagName.toLowerCase()}[${id}] "${(el.textContent || '').trim().slice(0, 20)}" invade ${errs.join(', ')}`,
                    );
                  }
                }
              }
              return out.slice(0, 8);
            },
            { d, pass },
          )),
        );
      }
      for (const b of [...new Set(bad)]) problems.push(`${d.name}: ${b}`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
