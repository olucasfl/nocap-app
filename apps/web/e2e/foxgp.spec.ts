import { expect, test, type Page } from '@playwright/test';

/**
 * Fox GP (spec 078): do hub do Fox Cap! ao pódio no treino. A classificação e a corrida são encurtadas pelo mundo exposto
 * em desenvolvimento (`window.__gp`), para não esperar 3 voltas de verdade; o resto é a tela de verdade.
 */
interface GpWorldLike {
  phase: string;
  ended: boolean;
  cars: { id: string; speed: number; qualiMs: number | null; qualiAt: number | null }[];
  applyFinish(id: string, ms: number): void;
}
type Win = Window & { __gp?: GpWorldLike };

const sizes = [
  { name: 'desktop', w: 1280, h: 720, touch: false },
  { name: 'celular deitado', w: 844, h: 390, touch: true },
];

async function openTraining(page: Page, bots: number) {
  await page.goto('/fox-cap');
  await page.getByRole('button', { name: 'Agora não' }).click();
  await page.getByTestId('foxcap-foxgp').click();
  await page.getByTestId('gl-offline').click();
  await page.getByRole('radio', { name: String(bots), exact: true }).click();
  await page.getByTestId('gp-start').click();
  await expect(page.getByTestId('gp-play')).toBeVisible();
}

for (const size of sizes) {
  test.describe(`Fox GP em ${size.name}`, () => {
    test.use({
      viewport: { width: size.w, height: size.h },
      isMobile: size.touch,
      hasTouch: size.touch,
    });

    test('o treino abre, o carro acelera e a tela não rola de lado', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await openTraining(page, 3);
      // contagem da classificação
      await page.waitForTimeout(3800);
      if (size.touch) {
        const gas = page.getByRole('button', { name: 'Acelerar' });
        await expect(gas).toBeVisible();
        await expect(page.getByRole('button', { name: 'Turbo' })).toBeVisible();
        const box = (await gas.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(1800);
        await page.mouse.up();
      } else {
        await page.keyboard.down('KeyW');
        await page.waitForTimeout(1800);
      }
      const speed = await page.evaluate(() => (window as Win).__gp!.cars[0]!.speed);
      expect(speed).toBeGreaterThan(5);
      await expect(page.getByTestId('gp-dash')).toBeVisible();
      if (!size.touch) await page.keyboard.up('KeyW');
      if (process.env.E2E_SHOTS)
        await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-${size.touch ? 'phone' : 'pc'}.png` });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test('classificação → grid → luzes → corrida → pódio', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await openTraining(page, 2);
  await page.waitForTimeout(3800);
  // todos marcam tempo na hora (a bot mais lenta, você no meio)
  await page.evaluate(() => {
    const w = (window as Win).__gp!;
    w.cars.forEach((c, i) => {
      c.qualiMs = [41_000, 40_000, 42_000][i] ?? 43_000;
      c.qualiAt = i;
    });
  });
  const grid = page.getByTestId('gp-grid');
  await expect(grid).toBeVisible();
  await expect(grid.locator('li').first()).toContainText('0:40.000');
  await expect(page.getByTestId('gp-lights')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('gp-lap')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('gp-board')).toBeVisible();
  // e todos cruzam a linha: o pódio aparece
  await page.evaluate(() => {
    const w = (window as Win).__gp!;
    w.cars.forEach((c, i) => w.applyFinish(c.id, 125_000 + i * 900));
  });
  const final = page.getByTestId('gp-final');
  await expect(final).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('gp-final-row-0')).toContainText('2:05.000');
  await expect(page.getByTestId('gp-final-row-1')).toContainText('+0.900');
  await expect(final.getByRole('img', { name: 'Troféu' })).toBeVisible();
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-final.png` });
});
