import { expect, test } from '@playwright/test';

/**
 * As telas do Block's (menu, regras, partida guardada, jogo e fim dos dois modos) cabem no celular em pé e deitado, sem
 * rolagem da página e sem nada cortado. Usa o gancho de dev `__blocksFinal` para abrir o fim sem jogar uma partida.
 */
const SIZES = [
  { name: 'pe-390', w: 390, h: 844 },
  { name: 'pe-360', w: 360, h: 640 },
  { name: 'deitado-844', w: 844, h: 390 },
  { name: 'deitado-667', w: 667, h: 375 },
  { name: 'deitado-568', w: 568, h: 320 },
];
const OUT = process.env.BLOCKS_SHOTS ?? '';

for (const sz of SIZES) {
  test.describe(sz.name, () => {
    test.use({ viewport: { width: sz.w, height: sz.h }, hasTouch: true, isMobile: true });
    test(`blocks ${sz.name}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      const shot = async (n: string) => {
        if (OUT) await page.screenshot({ path: `${OUT}/${sz.name}-${n}.png` });
      };
      const skip = () =>
        page
          .getByRole('button', { name: 'Agora não' })
          .click({ timeout: 1500 })
          .catch(() => undefined);
      await page.goto('/blocks');
      await skip();
      await shot('menu');
      // folha de cada modo (regras, como jogar) e a partida em andamento
      for (const mode of ['classic', 'towers'] as const) {
        await page.goto('/blocks');
        await skip();
        await page
          .getByRole('button', {
            name: new RegExp(mode === 'classic' ? 'Block Classic' : 'Block Towers', 'i'),
          })
          .first()
          .click();
        await page.waitForTimeout(600);
        await shot(`folha-${mode}`);
        await page
          .getByRole('button', { name: /^Jogar/ })
          .last()
          .click();
        await page.waitForTimeout(2500);
        await shot(`jogo-${mode}`);
      }
      for (const mode of ['classic', 'towers'] as const) {
        await page.goto('/blocks');
        await skip();
        await page.waitForFunction(
          () => !!(window as unknown as { __blocksFinal?: unknown }).__blocksFinal,
        );
        for (const record of [true, false]) {
          await page.evaluate(
            ([m, r]) =>
              (
                window as unknown as { __blocksFinal: (m: string, r: boolean) => void }
              ).__blocksFinal(m as string, r as boolean),
            [mode, record],
          );
          await expect(
            page.getByTestId(mode === 'classic' ? 'bkx-final' : 'twx-final'),
          ).toBeVisible();
          await page.waitForTimeout(1500);
          await shot(`final-${mode}-${record ? 'recorde' : 'normal'}`);
          // os botões de ação ficam à vista
          const again = page.getByTestId('final-again');
          await expect(again).toBeInViewport();
        }
      }
    });
  });
}
