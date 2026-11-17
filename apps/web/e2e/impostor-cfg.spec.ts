import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';
import { DEVICES, measure, setDevice } from './mobile-lib';

/** Regras da partida (mesa): com TODAS as opções aparecendo (eliminação, 2 impostores, dica de tema) tudo cabe sem rolar. */
const only = (process.env.IMP_DEV ?? 'se,a-small,pixel,iph15,promax,se-land,a-land,iph15-land,promax-land,ipad,ipad-land').split(',');
for (const d of DEVICES.filter((x) => only.includes(x.name))) {
  test(`mesa regras ${d.name}`, async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    const report: string[] = [];
    await installApi(page);
    const cdp = await context.newCDPSession(page);
    await setDevice(page, cdp, d);
    await page.addInitScript(() => { localStorage.setItem('nocap-mute', '1'); localStorage.setItem('im-nosplash', '1'); });
    await page.goto('/');
    await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
    await page.goto('/mesa/impostor');
    for (const n of ['Ana', 'Bia', 'Caio', 'Dani', 'Edu']) {
      await page.getByTestId('im-name').fill(n);
      await page.getByTestId('im-add').click();
    }
    await page.getByTestId('im-continue').click();
    for (const t of ['comida', 'animais', 'lugares']) await page.getByTestId(`im-cat-${t}`).click();
    await page.getByTestId('im-continue').click();
    await page.getByTestId('im-howvote-elim').click();
    await page.getByRole('button', { name: 'Mais impostores' }).click();
    await expect(page.getByRole('switch', { name: 'Mostrar quem era' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Dica de categoria' })).toBeVisible();
    await page.waitForTimeout(700);
    if (process.env.IMP_SHOTS) await page.screenshot({ path: `test-results/regras-${d.name}.png` });
    const over = await page.evaluate(() => {
      const b = document.querySelector('.im-cfgbody') as HTMLElement | null;
      return b ? b.scrollHeight - b.clientHeight : -1;
    });
    if (over > 2) report.push(`ROLA: as regras rolam ${over}px`);
    for (const m of await measure(page, d)) report.push(m);
    // a ajuda abre com a explicação completa
    await page.getByTestId('im-cfg-help').click();
    await expect(page.getByTestId('im-cfg-helpsheet')).toBeVisible();
    expect(report, report.join('\n')).toEqual([]);
  });
}
