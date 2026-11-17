import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';
import { DEVICES, measure, setDevice } from './mobile-lib';

/** Carrossel de jogos do /mesa: Impostor, Frase Maluca e Mímica; setas, bolinhas e o botão que muda com o cartão. */
const only = (process.env.IMP_DEV ?? 'se,a-small,se-land,ipad').split(',');
for (const d of DEVICES.filter((x) => only.includes(x.name))) {
  test(`mesa carrossel ${d.name}`, async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    const report: string[] = [];
    await installApi(page);
    const cdp = await context.newCDPSession(page);
    await setDevice(page, cdp, d);
    await page.addInitScript(() => localStorage.setItem('nocap-mute', '1'));
    const check = async (label: string) => {
      await page.waitForTimeout(600);
      if (process.env.IMP_SHOTS) await page.screenshot({ path: `test-results/carrossel-${label}-${d.name}.png` });
      for (const m of await measure(page, d)) report.push(`${label}: ${m}`);
    };
    await page.goto('/');
    await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
    await page.goto('/mesa');
    await expect(page.getByTestId('mesa-jogar')).toBeVisible();
    await expect(page.getByTestId('mesa-prev')).toBeDisabled();
    await check('impostor');
    await page.getByTestId('mesa-next').click();
    await expect(page.getByTestId('mesa-soon')).toBeVisible();
    await expect(page.getByTestId('mesa-soon')).toContainText('Frase Maluca');
    await check('frase-maluca');
    await page.getByTestId('mesa-next').click();
    await expect(page.getByTestId('mesa-soon')).toContainText('Mímica');
    await expect(page.getByTestId('mesa-next')).toBeDisabled();
    await check('mimica');
    await page.getByTestId('mesa-prev').click();
    await page.getByTestId('mesa-prev').click();
    await expect(page.getByTestId('mesa-jogar')).toBeVisible();
    expect(report, report.join('\n')).toEqual([]);
  });
}
