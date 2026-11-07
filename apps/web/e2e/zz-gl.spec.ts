import { test } from '@playwright/test';
import { installApi } from './mock-api';
test('gl shots', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  test.setTimeout(150000);
  await installApi(page);
  await page.goto('/fox-cap');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
  for (const [g, vw, vh] of [['pingpong', 1440, 900], ['desmorona', 1440, 900], ['atravessa', 844, 390], ['desmorona', 390, 844]] as const) {
    await page.setViewportSize({ width: vw, height: vh });
    await page.goto('/fox-cap');
    await page.getByTestId('foxcap-' + g).click();
    await page.waitForTimeout(1200);
    const d = await page.evaluate(() => ['.gx', '.gx-left', '.gx-right', '.gx-btn'].map((q) => { const e = document.querySelector(q); if (!e) return q + ':none'; const r = e.getBoundingClientRect(); return q + ':' + Math.round(r.width) + 'x' + Math.round(r.height); }));
    console.log('DIMS', g, vw, JSON.stringify(d));
    await page.screenshot({ path: '/tmp/claude-0/-home-user-nocap-app/599484f6-d22b-5257-a81d-39f0e3e6d941/scratchpad/gx-' + g + '-' + vw + '.png' });
  }
});
