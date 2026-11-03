import { expect, test } from '@playwright/test';

/**
 * Block Classic e Block Tower no celular deitado com câmera frontal / cantos (iPhone, Android): a grade, o placar, os
 * botões e as peças ficam dentro das áreas seguras. O Chromium simula as margens com `setSafeAreaInsetsOverride`.
 */
const PHONES = [
  { name: 'iphone-17-pro', w: 874, h: 402, left: 62, right: 62, bottom: 21 },
  { name: 'android-recorte', w: 915, h: 412, left: 48, right: 24, bottom: 16 },
];

for (const ph of PHONES) {
  test.describe(ph.name, () => {
    test.use({ viewport: { width: ph.w, height: ph.h }, hasTouch: true, isMobile: true });
    for (const mode of ['classic', 'towers'] as const) {
      test(`${mode} respeita as áreas seguras (${ph.name})`, async ({ page, context }, info) => {
        test.skip(info.project.name !== 'desktop', 'um projeto basta');
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setSafeAreaInsetsOverride', {
          insets: { top: 0, left: ph.left, right: ph.right, bottom: ph.bottom },
        } as never);
        await page.goto('/blocks');
        await page
          .getByRole('button', { name: 'Agora não' })
          .click({ timeout: 1500 })
          .catch(() => undefined);
        await page
          .getByRole('button', { name: mode === 'classic' ? /Block Classic/i : /Block Towers/i })
          .first()
          .click();
        await page
          .getByRole('button', { name: /^Jogar/ })
          .last()
          .click();
        const root = page.locator(mode === 'classic' ? '.bk-play' : '.tw-play, .tw');
        await expect(root.first()).toBeVisible({ timeout: 15_000 });
        await page.waitForTimeout(1500);
        if (process.env.BLOCKS_SHOTS)
          await page.screenshot({ path: `${process.env.BLOCKS_SHOTS}/sa-${ph.name}-${mode}.png` });
        // nenhum botão, peça ou placar encostado nas laterais inseguras
        const bad = await page.evaluate(
          ([l, r, w]) => {
            const out: string[] = [];
            for (const el of document.querySelectorAll<HTMLElement>(
              'button, .bk-board, .bk-slot, .bk-hud, .tw-score, .tw-chips, .tw-top, .tw-controls',
            )) {
              const b = el.getBoundingClientRect();
              if (b.width === 0 || b.height === 0) continue;
              if (b.left < (l as number) - 1 || b.right > (w as number) - (r as number) + 1)
                out.push(
                  `${el.className || el.tagName}: ${Math.round(b.left)}..${Math.round(b.right)}`,
                );
            }
            return out;
          },
          [ph.left, ph.right, ph.w],
        );
        expect(bad).toEqual([]);
      });
    }
  });
}
