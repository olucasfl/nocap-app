import { expect, test } from '@playwright/test';

/** Os três jogos do Fox Cap! no celular deitado: tudo cabe na tela e nada se sobrepõe. */
const PHONES = [
  { name: 'deitado-844', w: 844, h: 390 },
  { name: 'deitado-667', w: 667, h: 375 },
  { name: 'deitado-568', w: 568, h: 320 },
];

test.beforeEach(async ({}, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const box = async (page: import('@playwright/test').Page, sel: string): Promise<Box | null> => {
  const b = await page.locator(sel).first().boundingBox();
  return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null;
};
const hit = (a: Box, b: Box) =>
  a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1;

for (const ph of PHONES) {
  test.describe(ph.name, () => {
    test.use({ viewport: { width: ph.w, height: ph.h }, hasTouch: true, isMobile: true });

    async function open(page: import('@playwright/test').Page) {
      await page.goto('/fox-cap');
      await page
        .getByRole('button', { name: 'Agora não' })
        .click({ timeout: 1500 })
        .catch(() => undefined);
    }
    const fits = (name: string, b: Box | null, errs: string[]) => {
      if (b && (b.x < -1 || b.y < -1 || b.x + b.w > ph.w + 1 || b.y + b.h > ph.h + 1))
        errs.push(`${name} fora da tela`);
    };

    test('Desmorona!: HUD, pular, menu e controles cabem e não se sobrepõem', async ({ page }) => {
      await open(page);
      await page.getByTestId('foxcap-desmorona').click();
      await page.getByTestId('dsm-start').click({ timeout: 5000 }).catch(() => undefined);
      await expect(page.getByTestId('dsm-play')).toBeVisible();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `test-results/land-dsm-${ph.name}-tips.png` });
      await page.getByTestId('game-tips-ok').click().catch(() => undefined);
      await page.waitForTimeout(4500);
      await page.screenshot({ path: `test-results/land-dsm-${ph.name}-play.png` });
      const hud = {
        alive: await box(page, '.dsm-pill'),
        layer: await box(page, '.dsm-pill.is-layer'),
        menu: await box(page, '[data-testid="dsm-menu-btn"]'),
        jump: await box(page, '.dsm-jump'),
      };
      const errs: string[] = [];
      const names = Object.keys(hud) as (keyof typeof hud)[];
      for (let i = 0; i < names.length; i++) {
        fits(names[i]!, hud[names[i]!], errs);
        for (let j = i + 1; j < names.length; j++) {
          const a = hud[names[i]!];
          const b = hud[names[j]!];
          if (a && b && names[i] !== 'alive' && hit(a, b)) errs.push(`${names[i]} x ${names[j]}`);
        }
      }
      expect(errs, JSON.stringify(hud)).toEqual([]);
      await page.getByTestId('dsm-menu-btn').click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `test-results/land-dsm-${ph.name}-menu.png` });
      const menu = await box(page, '.gm-card');
      expect(menu!.y).toBeGreaterThanOrEqual(-1);
      expect(menu!.y + menu!.h).toBeLessThanOrEqual(ph.h + 1);
    });

    test('Atravessa!: HUD, menu e controles cabem', async ({ page }) => {
      await open(page);
      await page.getByTestId('foxcap-atravessa').click();
      await expect(page.locator('canvas')).toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `test-results/land-atr-${ph.name}-tips.png` });
      await page.getByTestId('game-tips-ok').click().catch(() => undefined);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `test-results/land-atr-${ph.name}-play.png` });
      const hud = {
        score: await box(page, '.at-score'),
        menu: await box(page, '[data-testid="atr-menu-btn"]'),
        hint: await box(page, '.at-hint'),
      };
      const errs: string[] = [];
      const names = Object.keys(hud) as (keyof typeof hud)[];
      for (let i = 0; i < names.length; i++) {
        fits(names[i]!, hud[names[i]!], errs);
        for (let j = i + 1; j < names.length; j++) {
          const a = hud[names[i]!];
          const b = hud[names[j]!];
          if (a && b && hit(a, b)) errs.push(`${names[i]} x ${names[j]}`);
        }
      }
      expect(errs, JSON.stringify(hud)).toEqual([]);
      await page.getByTestId('atr-menu-btn').click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `test-results/land-atr-${ph.name}-menu.png` });
      const menu = await box(page, '.gm-card');
      expect(menu!.y + menu!.h).toBeLessThanOrEqual(ph.h + 1);
    });
  });
}
