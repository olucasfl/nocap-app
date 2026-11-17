import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';
import { DEVICES, measure, setDevice } from './mobile-lib';

/** Cartelas de transição do Impostor (mesa): aparecem, não estouram a tela e liberam a tela seguinte. */
const only = (process.env.IMP_DEV ?? 'se,se-land,ipad').split(',');
for (const d of DEVICES.filter((x) => only.includes(x.name))) {
  test(`impostor cartelas ${d.name}`, async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    await installApi(page);
    const cdp = await context.newCDPSession(page);
    await setDevice(page, cdp, d);
    await page.addInitScript(() => localStorage.setItem('nocap-mute', '1'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
    await page.goto('/mesa/impostor');
    for (const n of ['Ana', 'Bia', 'Caio']) {
      await page.getByTestId('im-name').fill(n);
      await page.getByTestId('im-add').click();
    }
    await page.getByTestId('im-continue').click();
    await page.getByTestId('im-cat-comida').click();
    await page.getByTestId('im-continue').click();
    await page.getByTestId('im-start').click();
    await expect(page.getByTestId('im-splash')).toBeVisible();
    await expect(page.getByTestId('im-splash')).toContainText('1ª partida');
    await page.waitForTimeout(900);
    if (process.env.IMP_SHOTS) await page.screenshot({ path: `test-results/splash-${d.name}.png` });
    expect(await measure(page, d)).toEqual([]);
    await expect(page.getByTestId('im-reveal')).toBeVisible({ timeout: 5000 });
  });
}
