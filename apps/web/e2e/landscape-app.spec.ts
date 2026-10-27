import { expect, test } from '@playwright/test';

/** O app inteiro com o celular deitado (spec 051): menu lateral, conteúdo em colunas e nada transborda para o lado. */

const ROUTES = [
  '/',
  '/ranking',
  '/amigos',
  '/perfil',
  '/fox-cap',
  '/atravessa',
  '/entrar',
  '/criar-conta',
  '/words',
  '/sala',
];
const PHONES = [
  { name: '667', w: 667, h: 375 },
  { name: '844', w: 844, h: 390 },
  { name: '568', w: 568, h: 320 },
];
for (const ph of PHONES) {
  test.describe(ph.name, () => {
    test.use({ viewport: { width: ph.w, height: ph.h }, hasTouch: true, isMobile: true });
    for (const r of ROUTES) {
      test(`tela ${r}`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'um projeto basta');
        await page.goto(r);
        await page
          .getByRole('button', { name: 'Agora não' })
          .click({ timeout: 1200 })
          .catch(() => undefined);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `test-results/app-${ph.name}-${r.replace(/\W/g, '_')}.png` });
        const over = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(over, 'rolagem para o lado').toBeLessThanOrEqual(2);
      });
    }
  });
}
