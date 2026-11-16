import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';
import { DEVICES, setDevice } from './mobile-lib';

/**
 * Teclado virtual aberto (docs/MOBILE-GUIDE.md, seção 4): simula o teclado encolhendo a janela para ~55% da altura (é o que o
 * Android faz com `resizes-content`) e confere que cada campo e o botão de enviar continuam alcançáveis: dá para rolar até eles e
 * nada fixo (menu de baixo, barra) fica por cima. Só campos de texto contam.
 */
const SCREENS: [string, string, ((p: import('@playwright/test').Page) => Promise<void>)?][] = [
  ['entrar', '/entrar'],
  ['criar', '/criar-conta'],
  [
    'amigos-busca',
    '/amigos',
    async (p) => {
      await p.getByRole('tab', { name: /Adicionar/ }).click();
    },
  ],
];
const KEY_DEVS = ['se', 'a-small', 'iph15', 'se-land', 'iph15-land'];

for (const [name, url, act] of SCREENS) {
  test(`teclado ${name}`, async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    test.setTimeout(120_000);
    await installApi(page);
    const cdp = await context.newCDPSession(page);
    const problems: string[] = [];
    for (const d of DEVICES.filter((x) => KEY_DEVS.includes(x.name))) {
      await setDevice(page, cdp, d);
      await page.goto(url);
      await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 700 }).catch(() => undefined);
      await page.waitForTimeout(600);
      if (act) await act(page);
      // teclado: portrait ocupa ~45% da altura; paisagem ~55% (sobra pouco)
      const kb = Math.round(d.h * (d.w > d.h ? 0.55 : 0.45));
      await page.setViewportSize({ width: d.w, height: d.h - kb });
      await page.waitForTimeout(400);
      const fields = page.locator('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea');
      const n = await fields.count();
      for (let i = 0; i < n; i++) {
        const f = fields.nth(i);
        if (!(await f.isVisible())) continue;
        await f.focus();
        await f.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(150);
        const r = await f.evaluate((el) => {
          const b = el.getBoundingClientRect();
          const cx = b.left + b.width / 2;
          const cy = b.top + b.height / 2;
          const top = document.elementFromPoint(cx, cy);
          return {
            inView: b.top >= 0 && b.bottom <= window.innerHeight && b.height > 0,
            covered: !!top && top !== el && !el.contains(top) && !top.contains(el),
            by: top ? `${top.tagName.toLowerCase()}.${(top as HTMLElement).className}`.slice(0, 40) : '',
          };
        });
        const id = (await f.getAttribute('data-testid')) || (await f.getAttribute('name')) || `campo ${i + 1}`;
        if (!r.inView) problems.push(`${d.name}: ${id} não chega a ficar visível com o teclado aberto`);
        if (r.covered) problems.push(`${d.name}: ${id} coberto por ${r.by}`);
      }
      // o botão principal de enviar também precisa ser alcançável
      const submit = page.locator('button[type=submit], button.btn:not(.ghost):not(.alt)').last();
      if (await submit.count()) {
        await submit.scrollIntoViewIfNeeded().catch(() => undefined);
        const ok = await submit.evaluate((el) => {
          const b = el.getBoundingClientRect();
          const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return b.bottom <= window.innerHeight + 1 && (!top || top === el || el.contains(top) || top.contains(el));
        });
        if (!ok) problems.push(`${d.name}: botão de enviar fica escondido com o teclado aberto`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
