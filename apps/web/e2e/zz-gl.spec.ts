import { test } from '@playwright/test';
import { installApi } from './mock-api';
test('gl shots', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  test.setTimeout(120000);
  await installApi(page);
  await page.goto('/fox-cap');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
  for (const [g, vw, vh] of [['atravessa', 1440, 900], ['bola', 1440, 900], ['pingpong', 1440, 900], ['desmorona', 1440, 900], ['bola', 844, 390], ['desmorona', 390, 844]] as const) {
    await page.setViewportSize({ width: vw, height: vh });
    await page.goto('/fox-cap');
    await page.getByTestId('foxcap-' + (g === 'bola' ? 'bola' : g)).click();
    await page.waitForTimeout(1200);
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth > innerWidth, document.documentElement.scrollHeight > innerHeight, getComputedStyle(document.body).overflow]);
    console.log('SCROLL', g, vw, JSON.stringify(sw));
    await page.screenshot({ path: '/tmp/claude-0/-home-user-nocap-app/599484f6-d22b-5257-a81d-39f0e3e6d941/scratchpad/gl-' + g + '-' + vw + '.png' });
    if (g === 'bola' && vw === 1440) {
      await page.getByTestId('gl-friends').click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: '/tmp/claude-0/-home-user-nocap-app/599484f6-d22b-5257-a81d-39f0e3e6d941/scratchpad/gl-amigos.png' });
    }
  }
});
