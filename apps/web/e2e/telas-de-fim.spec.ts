import { expect, test, type Page } from '@playwright/test';

/** Telas de fim do Desmorona! e do Atravessa! (spec 054): jogam até o fim e conferem a tela em vários aparelhos. */
const SIZES = [
  { name: 'computador', w: 1280, h: 720 },
  { name: 'celular-em-pe', w: 390, h: 844 },
  { name: 'celular-deitado', w: 844, h: 390 },
  { name: 'celular-pequeno-deitado', w: 568, h: 320 },
];

test.beforeEach(({ page: _page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});
test.setTimeout(240_000);

async function fitsEverywhere(page: Page, testId: string, shot: string) {
  for (const s of SIZES) {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(500);
    const root = page.getByTestId(testId);
    await expect(root, s.name).toBeVisible();
    // nada passa dos lados e os botões de ação ficam alcançáveis (a tela rola por dentro)
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(over, `${s.name}: rolagem lateral`).toBeLessThanOrEqual(1);
    const card = await root.locator('.fz-card').boundingBox();
    expect(card!.x, `${s.name}: cartão`).toBeGreaterThanOrEqual(-1);
    expect(card!.x + card!.width, `${s.name}: cartão`).toBeLessThanOrEqual(s.w + 1);
    expect(card!.y + card!.height, `${s.name}: cartão`).toBeLessThanOrEqual(s.h + 1);
    const btn = page.getByTestId('final-again').or(page.getByTestId('final-exit')).first();
    await btn.scrollIntoViewIfNeeded();
    await expect(btn).toBeInViewport();
    await page.screenshot({ path: `test-results/${shot}-${s.name}.png` });
  }
}

test('Desmorona! sozinho: a tela de fim aparece com pódio, classificação e botões', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/fox-cap');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 2000 })
    .catch(() => undefined);
  await page.getByTestId('foxcap-desmorona').click();
  await page.getByRole('radio', { name: '3' }).click();
  await page.getByTestId('dsm-start').click();
  await expect(page.getByTestId('dsm-play')).toBeVisible();
  await expect(page.getByTestId('dsm-final')).toBeVisible({ timeout: 200_000 });
  await expect(page.getByTestId('dsm-final-row-0')).toBeVisible();
  await expect(page.getByTestId('dsm-final-time')).toBeVisible();
  await fitsEverywhere(page, 'dsm-final', 'fim-desmorona');
  await page.getByTestId('final-again').click();
  await expect(page.getByTestId('dsm-final')).toHaveCount(0);
});

test('Atravessa! sozinho: a tela de fim mostra linhas, tempo, ritmo e botões', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/fox-cap');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 2000 })
    .catch(() => undefined);
  await page.getByTestId('foxcap-atravessa').click();
  await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 });
  await page
    .getByTestId('game-tips-ok')
    .click({ timeout: 3000 })
    .catch(() => undefined);
  // anda um pouco e para: o jogo termina sozinho ("parou demais" ou o que vier)
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
  }
  await expect(page.getByTestId('atr-final')).toBeVisible({ timeout: 200_000 });
  await expect(page.getByTestId('atr-final-rows')).toBeVisible();
  await fitsEverywhere(page, 'atr-final', 'fim-atravessa');
});
