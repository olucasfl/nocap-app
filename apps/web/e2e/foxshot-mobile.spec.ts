import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/**
 * Counter Fox no celular: em telas de iPhone e Android deitadas, nenhum elemento do HUD pode ficar em cima de outro
 * (Loja/Menu, feed de abates, mapa, faixa de cima, botões de toque) e a loja precisa caber sem texto cortado.
 */
const DEVICES = [
  ['iphone-se', 667, 375],
  ['iphone-13', 844, 390],
  ['iphone-15-max', 932, 430],
  ['pixel-7', 915, 412],
  ['android-pequeno', 640, 360],
  ['galaxy-s8', 740, 360],
] as const;

async function enter(page: Page) {
  await installApi(page);
  await page.goto('/fox-cap/counter-fox');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 3000 })
    .catch(() => undefined);
  await page.getByTestId('cfh-play').tap({ timeout: 15000 });
  await page.getByTestId('cfh-offline').tap({ timeout: 8000 });
  await page.getByTestId('cfx-start').tap({ timeout: 8000 });
  await expect(page.getByTestId('fs-ammo')).toBeVisible({ timeout: 60_000 });
  const resume = page.getByTestId('fsm-resume');
  if (await resume.isVisible().catch(() => false)) await resume.tap();
  await expect(page.getByTestId('fs-touch')).toBeVisible({ timeout: 15000 });
}

interface Box {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

async function hudBoxes(page: Page): Promise<Box[]> {
  return page.evaluate(() => {
    const out: Box[] = [];
    const add = (name: string, el: Element | null) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      out.push({ name, x: r.left, y: r.top, w: r.width, h: r.height });
    };
    for (const id of [
      'fs-radar',
      'fs-topbar',
      'fs-tb-shop',
      'fs-menubtn',
      'fs-feed',
      'fs-bars',
      'fs-ammo',
    ]) {
      add(id, document.querySelector(`[data-testid="${id}"]`));
    }
    document
      .querySelectorAll('[data-testid="fs-touch"] .tc:not(.tc-sm)')
      .forEach((el, i) => add(`tc-${el.className.replace(/\s+/g, '.')}-${i}`, el));
    return out;
  });
}

for (const [name, w, h] of DEVICES) {
  test.describe(`celular ${name} ${w}x${h}`, () => {
    test('HUD sem sobreposição e loja que cabe', async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      });
      const page = await ctx.newPage();
      await enter(page);
      // enche o feed (3 linhas visíveis, o pior caso para a coluna da direita)
      await page.evaluate(() => {
        const f = (window as unknown as { __fs: { feedDemo: () => void } }).__fs;
        f.feedDemo();
        f.feedDemo();
        f.feedDemo();
      });
      await page.waitForTimeout(500);
      const boxes = await hudBoxes(page);
      expect(boxes.length).toBeGreaterThan(8);
      for (const b of boxes) {
        expect(b.x, `${b.name} sai pela esquerda`).toBeGreaterThanOrEqual(-1);
        expect(b.y, `${b.name} sai por cima`).toBeGreaterThanOrEqual(-1);
        expect(b.x + b.w, `${b.name} sai pela direita`).toBeLessThanOrEqual(w + 1);
        expect(b.y + b.h, `${b.name} sai por baixo`).toBeLessThanOrEqual(h + 1);
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          expect(ox > 2 && oy > 2, `${a.name} em cima de ${b.name}`).toBe(false);
        }
      }

      // loja: abas, grade e fechar dentro da tela, sem texto vazando do cartão
      await page.getByTestId('fs-tb-shop').tap();
      await expect(page.getByTestId('fs-shop')).toBeVisible();
      const tabs = page.locator('[data-testid^="fs-shop-tab-"]');
      expect(await tabs.count()).toBe(5);
      for (let t = 0; t < 5; t++) {
        await tabs.nth(t).tap();
        const bad = await page.evaluate(
          ([vw, vh]) => {
            const issues: string[] = [];
            const grid = document.querySelector('.fssm-grid')!.getBoundingClientRect();
            document.querySelectorAll('.fssm-grid .fss-item').forEach((it) => {
              const r = it.getBoundingClientRect();
              if (r.left < grid.left - 1 || r.right > grid.right + 1)
                issues.push('cartão fora da grade');
              it.querySelectorAll('.fss-name, .fss-price').forEach((n) => {
                const e = n as HTMLElement;
                if (e.scrollWidth > e.clientWidth + 1) issues.push(`texto vaza: ${e.textContent}`);
                const nr = e.getBoundingClientRect();
                if (nr.left < r.left - 1 || nr.right > r.right + 1)
                  issues.push(`texto sai do cartão: ${e.textContent}`);
              });
            });
            const close = document
              .querySelector('[data-testid="fs-shop-close"]')!
              .getBoundingClientRect();
            if (close.right > vw + 1 || close.bottom > vh + 1 || close.top < -1)
              issues.push('Fechar fora da tela');
            const tabsR = document.querySelector('.fssm-tabs')!.getBoundingClientRect();
            if (
              close.bottom > tabsR.top + 1 &&
              close.left < tabsR.right &&
              close.right > tabsR.left
            )
              issues.push('Fechar cobre abas');
            const mine = document
              .querySelector('[data-testid="fs-shop-mine"]')!
              .getBoundingClientRect();
            if (mine.bottom > vh + 1) issues.push('equipamento fora da tela');
            if (document.documentElement.scrollWidth > vw + 1) issues.push('rolagem horizontal');
            return issues;
          },
          [w, h],
        );
        expect(bad, `aba ${t}`).toEqual([]);
      }
      await tabs.nth(1).tap();
      await page.locator('.fssm-grid .fss-item:not(.soon)').first().tap();
      await expect(page.getByTestId('fs-shop-toast')).toBeVisible();
      await page.getByTestId('fs-shop-close').tap();
      await expect(page.getByTestId('fs-shop')).toHaveCount(0);
      await ctx.close();
    });
  });
}
