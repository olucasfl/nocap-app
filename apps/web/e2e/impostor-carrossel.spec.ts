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
    await page.addInitScript(() => { localStorage.setItem('nocap-mute', '1'); localStorage.setItem('im-nosplash', '1'); });
    const check = async (label: string) => {
      await page.waitForTimeout(600);
      if (process.env.IMP_SHOTS) await page.screenshot({ path: `test-results/carrossel-${label}-${d.name}.png` });
      for (const m of await measure(page, d)) report.push(`${label}: ${m}`);
    };
    await page.goto('/');
    await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
    await page.goto('/mesa');
    await expect(page.getByTestId('mesa-jogar')).toBeVisible();
    await check('impostor');
    await page.getByTestId('mesa-next').click();
    await expect(page.getByTestId('mesa-soon')).toBeVisible();
    await expect(page.getByTestId('mesa-soon')).toContainText('Frase Maluca');
    await check('frase-maluca');
    await page.getByTestId('mesa-next').click();
    await expect(page.getByTestId('mesa-soon')).toContainText('Mímica');
    await check('mimica');
    // dá a volta: depois da Mímica vem o Impostor; e para trás também
    await page.getByTestId('mesa-next').click();
    await expect(page.getByTestId('mesa-jogar')).toBeVisible();
    await page.getByTestId('mesa-prev').click();
    await expect(page.getByTestId('mesa-soon')).toContainText('Mímica');
    await page.getByTestId('mesa-prev').click();
    await page.getByTestId('mesa-prev').click();
    await expect(page.getByTestId('mesa-jogar')).toBeVisible();
    expect(report, report.join('\n')).toEqual([]);
  });
}

/** A roda gira sozinha a cada 5 s (sem a trava dos testes) e para quando o mouse está em cima. */
test('mesa carrossel gira sozinho', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await installApi(page);
  await page.addInitScript(() => localStorage.setItem('nocap-mute', '1'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
  await page.goto('/mesa');
  await expect(page.getByTestId('mesa-jogar')).toBeVisible();
  await expect(page.getByTestId('mesa-soon')).toContainText('Frase Maluca', { timeout: 8000 });
  // com o mouse em cima, não gira
  await page.getByTestId('mesa-carousel').hover();
  await page.waitForTimeout(6500);
  await expect(page.getByTestId('mesa-soon')).toContainText('Frase Maluca');
});

