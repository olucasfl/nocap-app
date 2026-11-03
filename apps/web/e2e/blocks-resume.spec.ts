import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';

/** A ficha do Block Classic com partida guardada: sem a lista de passos e com os 3 botões bem organizados, em pé e deitado. */
const SIZES = [
  { name: 'pe-390', w: 390, h: 844 },
  { name: 'deitado-844', w: 844, h: 390 },
  { name: 'deitado-568', w: 568, h: 320 },
];
for (const sz of SIZES) {
  test(`ficha com partida guardada ${sz.name}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    await page.setViewportSize({ width: sz.w, height: sz.h });
    await installApi(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        'nocap-blocks-run',
        JSON.stringify({
          v: 1,
          userId: 'u-test',
          matchId: 'm1',
          seed: 'abc123abc123',
          session: 's',
          moves: [0],
          thumbs: 0,
          perfects: 0,
          hintsUsed: 3,
          before: 100,
          savedAt: Date.now(),
        }),
      );
    });
    await page.goto('/blocks');
    await page
      .getByRole('button', { name: 'Agora não' })
      .click({ timeout: 1500 })
      .catch(() => undefined);
    await page
      .getByRole('button', { name: /Block Classic/i })
      .first()
      .click();
    const sheet = page.getByRole('dialog', { name: /Block Classic/i });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.bk-howto')).toHaveCount(0);
    for (const n of [/Continuar partida/i, /Começar do zero/i, /Escolher outro modo/i]) {
      await expect(sheet.getByRole('button', { name: n })).toBeInViewport();
    }
    await page.waitForTimeout(500);
    if (process.env.BLOCKS_SHOTS)
      await page.screenshot({ path: `${process.env.BLOCKS_SHOTS}/resume-${sz.name}.png` });
  });
}
