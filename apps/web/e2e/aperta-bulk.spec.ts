import { newSave, upgradeIndex, type SaveState } from '@nocap/games';
import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/** A página da árvore em forma de grafo (spec 040, etapa 18): abrir, ver o grafo, arrastar, escolher um nó e conferir o painel. */
function treeSave(): SaveState {
  const s = newSave('lote', Date.now() - 3_600_000, 'Missão lote');
  const lv = s.run.upgradeLevels.slice();
  for (const [id, n] of Object.entries({ lens: 1, gloves: 1, satellite: 3 }))
    lv[upgradeIndex(id)] = n;
  return {
    ...s,
    tutorial: 'done',
    storySeen: true,
    collapses: 2,
    regionId: 'jupiter-saturn',
    run: { ...s.run, upgradeLevels: lv, dust: 5e5, dustLife: 5e5 },
  };
}

async function installSaves(page: Page) {
  const account: { rev: number; data: SaveState } = { rev: 1, data: treeSave() };
  await page.route(/localhost:3333\/me\/aperta\/saves/, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
    };
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers,
        body: JSON.stringify(body),
      });
    if (req.method() === 'OPTIONS') return json({});
    if (path === '/me/aperta/saves') {
      const d = account.data;
      const one = {
        slot: 1,
        name: d.name,
        collapses: d.collapses,
        vaultCount: 0,
        lastPlayedAt: new Date().toISOString(),
        storySeen: true,
        revision: account.rev,
      };
      return json({
        slots: [
          { slot: 1, save: one, recoverableUntil: null },
          { slot: 2, save: null, recoverableUntil: null },
        ],
      });
    }
    if (path === '/me/aperta/saves/1') {
      if (req.method() === 'GET')
        return json({ slot: 1, revision: account.rev, data: account.data });
      if (req.method() === 'PUT') {
        account.data = (req.postDataJSON() as { data: SaveState }).data;
        account.rev += 1;
        return json({ revision: account.rev, flagged: [] });
      }
    }
    return json({ message: 'não simulado' }, 404);
  });
}

const SIZES = [
  { name: '320 px', width: 320, height: 640 },
  { name: '390 px', width: 390, height: 844 },
];

for (const size of SIZES) {
  test.describe(`completar gerador em ${size.name}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    test('o botão Completar mostra o preço total, e cabe na tela', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installApi(page);
      await installSaves(page);
      await page.goto('/arcade/aperta');
      await page.getByRole('button', { name: 'Jogar' }).first().click();
      await page
        .getByRole('button', { name: /Continuar/ })
        .first()
        .click();
      const skip = page.getByRole('button', { name: 'Pular história' });
      if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
      await expect(page.locator('.ap-game')).toBeVisible();
      await page.locator('.ap-dockb-big').click();
      await page
        .getByRole('tab', { name: /Geradores/ })
        .or(page.getByRole('button', { name: /^Geradores/ }))
        .first()
        .click();
      const bulk = page.locator('.ap-up-bulk').first();
      await bulk.scrollIntoViewIfNeeded();
      await expect(bulk).toContainText('Completar');

      const box = (await bulk.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      ).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: `${process.env.E2E_SHOTS ?? 'test-results'}/bulk-${size.width}.png`,
      });
    });
  });
}
