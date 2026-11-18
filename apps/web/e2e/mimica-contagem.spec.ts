import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';
import { DEVICES, setDevice } from './mobile-lib';

/** A contagem 3-2-1 e o "Valendo!" cabem na tela em todos os tamanhos (nada cortado nas bordas). */
const only = (process.env.MM_DEV ?? 'se,a-small,pixel,iph15,promax,se-land,a-land,iph15-land,promax-land,ipad,ipad-land').split(',');
for (const d of DEVICES.filter((x) => only.includes(x.name))) {
  test(`mimica contagem ${d.name}`, async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    await installApi(page);
    const cdp = await context.newCDPSession(page);
    await setDevice(page, cdp, d);
    await page.addInitScript(() => {
      localStorage.setItem('nocap-mute', '1');
      localStorage.setItem('mm-nosplash', '1');
      localStorage.removeItem('nocap-mimica-setup');
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
    await page.goto('/mesa/mimica');
    await page.getByTestId('mm-continue').click();
    await page.getByTestId('mm-continue').click();
    await page.getByTestId('mm-cat-animais').click();
    await page.getByTestId('mm-continue').click();
    await page.getByTestId('mm-start').click();
    await page.getByTestId('mm-ready').click();
    await page.getByTestId('mm-opt-0').click();
    const box = page.getByTestId('mm-321');
    const seen: string[] = [];
    for (const want of ['3', '2', '1', 'Valendo!']) {
      await expect(box).toHaveText(want, { timeout: 4000 });
      const r = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="mm-321"]') as HTMLElement;
        const range = document.createRange();
        range.selectNodeContents(el);
        const b = range.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, w: innerWidth, h: innerHeight };
      });
      if (r.left < 0 || r.right > r.w || r.top < 0 || r.bottom > r.h) seen.push(`${want} cortado: ${JSON.stringify(r)}`);
      if (process.env.MM_SHOTS && want === 'Valendo!') await page.screenshot({ path: `test-results/mm-valendo-${d.name}.png` });
    }
    expect(seen, seen.join('\n')).toEqual([]);
  });
}
