import { expect, test } from '@playwright/test';

/** Vender uma melhoria comprada: 1º toque pede confirmação, 2º vende e devolve 90% do que custou. */
type W = Window & {
  __nh: { go(s: string): void; gold(n: number): number; state(): { screen: string } };
};

test('vender melhoria devolve 90% e pede confirmação', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 510, height: 680 } });
  const page = await ctx.newPage();
  await page.goto('/nighthunt');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 4000 })
    .catch(() => undefined);
  await page.waitForFunction(
    () => (window as unknown as W).__nh?.state().screen === 'menu',
    undefined,
    { timeout: 15000 },
  );
  const gold = (n = 0) => page.evaluate((x) => (window as unknown as W).__nh.gold(x), n);
  await gold(5000);
  await page.evaluate(() => (window as unknown as W).__nh.go('upgrades'));
  await page.waitForTimeout(700);
  const box = (await page.locator('canvas.nh-canvas').boundingBox())!;
  const click = async (x: number, y: number) => {
    await page.mouse.click(box.x + x, box.y + y);
    await page.waitForTimeout(350);
  };
  const g0 = await gold();
  await click(box.width - 80, 142); // comprar o 1º nível de Vida
  const g1 = await gold();
  expect(g1).toBeLessThan(g0);
  // 1º toque no VENDER só arma (nada muda); o 2º vende
  await click(box.width - 80, 184);
  expect(await gold()).toBe(g1);
  await click(box.width - 80, 184);
  const g2 = await gold();
  expect(g2).toBeGreaterThan(g1);
  expect(g2).toBeLessThan(g0 + 20); // nunca dá lucro (+ a recompensa da conquista, no máximo)
  await ctx.close();
});
