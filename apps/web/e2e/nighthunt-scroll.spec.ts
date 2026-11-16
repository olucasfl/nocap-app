import { expect, test } from '@playwright/test';

/** Celular: Itens e Bestiário rolam com o dedo mesmo quando o toque começa em cima de um item (a lista toda é feita deles). */
interface St {
  screen: string;
  scroll?: number;
  scrollMax?: number;
}
type W = Window & { __nh: { state(): St; go(s: string): void } };

for (const tela of ['items', 'bestiary'] as const) {
  test(`celular: ${tela} rola com o dedo e um toque parado não rola`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.goto('/nighthunt');
    await page
      .getByRole('button', { name: 'Agora não' })
      .click({ timeout: 4000 })
      .catch(() => undefined);
    await page.waitForFunction(
      () => (window as unknown as W).__nh?.state().screen === 'menu',
      undefined,
      {
        timeout: 15_000,
      },
    );
    await page.evaluate((t) => (window as unknown as W).__nh.go(t), tela);
    await page.waitForFunction((t) => (window as unknown as W).__nh.state().screen === t, tela);
    const st = () => page.evaluate(() => (window as unknown as W).__nh.state());
    expect((await st()).scrollMax).toBeGreaterThan(50);
    const box = (await page.locator('canvas.nh-canvas').boundingBox())!;
    // arrasta com o dedo de baixo para cima começando bem em cima da lista (onde há itens), com toque de verdade (CDP)
    const cdp = await ctx.newCDPSession(page);
    const x = box.x + box.width * 0.4;
    const y0 = box.y + box.height * 0.6;
    const touch = (type: string, yy: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y: yy, id: 1 }],
      });
    await touch('touchStart', y0);
    for (let i = 1; i <= 8; i++) await touch('touchMove', y0 - i * 22);
    await touch('touchEnd', y0 - 176);
    expect((await st()).scroll).toBeGreaterThan(40);
    // toque parado (sem arrastar) não mexe na rolagem
    const before = (await st()).scroll;
    await touch('touchStart', y0);
    await touch('touchEnd', y0);
    expect((await st()).scroll).toBe(before);
    await ctx.close();
  });
}
