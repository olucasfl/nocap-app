import { expect, test } from '@playwright/test';

/**
 * Celular deitado com ilha/notch (iPhone, Android com recorte): a barra lateral e o HUD dos jogos ficam fora das áreas
 * seguras. O Chromium simula as margens com `Emulation.setSafeAreaInsetsOverride`.
 */
const PHONES = [
  { name: 'iphone-17-pro', w: 874, h: 402, left: 62, right: 62, bottom: 21 },
  { name: 'iphone-se-sem-recorte', w: 667, h: 375, left: 0, right: 0, bottom: 0 },
  { name: 'android-recorte', w: 915, h: 412, left: 48, right: 24, bottom: 16 },
];

for (const ph of PHONES) {
  test.describe(ph.name, () => {
    test.use({ viewport: { width: ph.w, height: ph.h }, hasTouch: true, isMobile: true });
    test(`barra lateral e jogos respeitam as áreas seguras (${ph.name})`, async ({
      page,
      context,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await page.goto('/');
      await page
        .getByRole('button', { name: 'Agora não' })
        .click({ timeout: 1500 })
        .catch(() => undefined);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', {
        insets: { top: 0, left: ph.left, right: ph.right, bottom: ph.bottom },
      } as never);
      await page.waitForTimeout(500);
      const nav = (await page.locator('.bottom-nav').boundingBox())!;
      expect(nav.x, 'barra lateral dentro da área segura (esquerda)').toBeGreaterThanOrEqual(
        ph.left - 0.5,
      );
      expect(nav.y + nav.height, 'barra lateral acima da área segura de baixo').toBeLessThanOrEqual(
        ph.h - ph.bottom + 0.5,
      );
      // jogo: o placar do Atravessa! (canto de cima à esquerda) e o botão de menu (à direita)
      await page.goto('/fox-cap');
      await page
        .getByRole('button', { name: 'Agora não' })
        .click({ timeout: 1500 })
        .catch(() => undefined);
      await page.getByTestId('foxcap-atravessa').click();
      await expect(page.getByTestId('atr-menu-btn')).toBeVisible({ timeout: 10_000 });
      const score = (await page.locator('.at-score').boundingBox())!;
      const menu = (await page.getByTestId('atr-menu-btn').boundingBox())!;
      expect(score.x).toBeGreaterThanOrEqual(ph.left - 0.5);
      expect(menu.x + menu.width).toBeLessThanOrEqual(ph.w - ph.right + 0.5);
    });
  });
}
