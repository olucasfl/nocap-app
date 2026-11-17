import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';
import { DEVICES, measure, setDevice } from './mobile-lib';

/** Telas do /mesa fora das partidas: a escolha de como jogar e a entrada online, em todos os tamanhos. */
const only = (process.env.IMP_DEV ?? 'se,a-small,pixel,iph15,promax,se-land,a-land,iph15-land,promax-land,ipad,ipad-land').split(',');
for (const d of DEVICES.filter((x) => only.includes(x.name))) {
  test(`mesa telas ${d.name}`, async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    const report: string[] = [];
    await installApi(page);
    const cdp = await context.newCDPSession(page);
    await setDevice(page, cdp, d);
    await page.addInitScript(() => { localStorage.setItem('nocap-mute', '1'); localStorage.setItem('im-nosplash', '1'); });
    const check = async (label: string) => {
      await page.waitForTimeout(700);
      if (process.env.IMP_SHOTS) await page.screenshot({ path: `test-results/mesatelas-${label}-${d.name}.png` });
      for (const m of await measure(page, d)) report.push(`${label}: ${m}`);
    };
    await page.goto('/');
    await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
    await page.goto('/mesa');
    await page.getByTestId('mesa-jogar').click();
    await expect(page.getByTestId('mesa-step-mode')).toBeVisible();
    await check('como-jogar');
    // os dois cartões em coluna (celular em pé) ou lado a lado (espaço de sobra), nunca espremidos
    const boxes = await page.locator('.im-way').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
    for (const w of boxes) if (w < 220) report.push(`como-jogar: cartão espremido (${Math.round(w)}px)`);
    await page.getByTestId('mesa-online').click();
    await expect(page.getByTestId('mesa-step-online')).toBeVisible();
    await check('online');
    expect(report, report.join('\n')).toEqual([]);
  });
}
