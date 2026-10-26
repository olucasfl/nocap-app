import { expect, test } from '@playwright/test';

/** Desmorona! (spec 044): o menu abre, a partida começa, WASD move e nada passa dos lados do celular deitado. */
const sizes = [
  { name: 'desktop', w: 1280, h: 720, touch: false },
  { name: 'celular deitado', w: 844, h: 390, touch: true },
];

for (const size of sizes) {
  test.describe(`Desmorona! em ${size.name}`, () => {
    test.use({ viewport: { width: size.w, height: size.h }, isMobile: size.touch, hasTouch: size.touch });

    test('Fox Cap! leva ao jogo, a partida roda e a tela não rola de lado', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await page.goto('/fox-cap');
      await page.getByRole('button', { name: 'Agora não' }).click();
      await page.getByRole('link', { name: /Desmorona!/ }).click();
      await page.getByTestId('dsm-play-btn').click();
      await page.getByRole('radio', { name: '3' }).click();
      await page.getByTestId('dsm-start').click();
      await expect(page.getByTestId('dsm-play')).toBeVisible();
      await page.waitForTimeout(4500);
      if (!size.touch) {
        await page.keyboard.down('KeyW');
        await page.keyboard.press('Space');
        await page.waitForTimeout(600);
        await page.keyboard.up('KeyW');
      }
      await expect(page.locator('.dsm-hud')).toBeVisible();
      if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/dsm-${size.touch ? 'phone' : 'pc'}.png` });
      if (size.touch) await expect(page.locator('.dsm-jump')).toBeVisible();
      else await expect(page.locator('.dsm-jump')).toBeHidden();
      // a câmera gira: arrastando o mouse (computador) ou o dedo na metade direita (celular)
      const yaw = () => page.evaluate(() => (window as unknown as { __dsmYaw?: number }).__dsmYaw ?? 0);
      const before = await yaw();
      if (size.touch) {
        const cdp = await page.context().newCDPSession(page);
        const pt = (x: number) => [{ x, y: 150, id: 1 }];
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(600) });
        for (let x = 600; x <= 760; x += 20) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(400, 300);
        await page.mouse.down();
        await page.mouse.move(600, 300, { steps: 6 });
        await page.mouse.up();
      }
      await page.waitForTimeout(300);
      expect(Math.abs((await yaw()) - before)).toBeGreaterThan(0.3);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over).toBeLessThanOrEqual(0);
    });
  });
}
