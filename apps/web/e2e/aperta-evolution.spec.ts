import { energyCap, newSave, pickInto, tickObjects, type SaveState } from '@nocap/games';
import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/** Spec 042: a Lua Rara no livro e uma oferta com a Lua Lendária (evolução RARO -> LENDÁRIO) e dois grimórios Comuns. */
function evoSave(): SaveState {
  const s = newSave('evolucao', Date.now() - 3_600_000, 'Missão evolução');
  const book = pickInto(s.run, 'moon', 'rare', 2);
  const base: SaveState = {
    ...s,
    tutorial: 'done',
    storySeen: true,
    collapses: 1,
    regionId: 'asteroid-belt',
    album: ['moon:common', 'moon:rare'],
    run: { ...s.run, ...book, picks: 6 },
  };
  const full = { ...base, run: { ...base.run, energy: energyCap(6) + 1 } };
  const opened = tickObjects(full, 1);
  const p = opened.run.pending!;
  return {
    ...opened,
    run: {
      ...opened.run,
      pending: {
        ...p,
        offers: ['moon', 'mercury', 'titan'],
        rarities: { moon: 'legendary', mercury: 'common', titan: 'common' },
      },
    },
  };
}

async function installSaves(page: Page) {
  const account: { rev: number; data: SaveState } = { rev: 1, data: evoSave() };
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
  { width: 320, height: 640, mobile: true },
  { width: 390, height: 844, mobile: true },
  { width: 1366, height: 768, mobile: false },
];

for (const size of SIZES) {
  test.describe(`evolução de grimório em ${size.width} px`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      isMobile: size.mobile,
      hasTouch: size.mobile,
    });

    test('a carta mostra RARO -> LENDÁRIO e a animação aparece inteira ao escolher', async ({
      page,
    }, info) => {
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
      const shots = process.env.E2E_SHOTS ?? 'test-results';

      const seal = page.locator('.ap-pick-evo');
      await expect(seal).toHaveCount(1);
      await expect(seal).toContainText('Raro');
      await expect(seal).toContainText('Lendário');
      await page.waitForTimeout(2000); // as cartas destravam depois de 1,6 s
      await page.screenshot({ path: `${shots}/evo-${size.width}-1-oferta.png` });
      const box = (await seal.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);

      await page.locator('.ap-pick', { has: seal }).click();
      await page.getByRole('button', { name: /Escolher este grimório/ }).click();
      const fx = page.locator('.ap-evo-fx');
      await expect(fx).toBeVisible();
      await page.waitForTimeout(1900);
      await page.screenshot({ path: `${shots}/evo-${size.width}-2-animacao.png` });
      await expect(fx.locator('.ap-evo-seal')).toContainText('Raro');
      await expect(fx.locator('.ap-evo-seal')).toContainText('Lendário');
      const seal2 = (await fx.locator('.ap-evo-seal').boundingBox())!;
      expect(seal2.x).toBeGreaterThanOrEqual(0);
      expect(seal2.x + seal2.width).toBeLessThanOrEqual(size.width);
      await expect(fx).toHaveCount(0, { timeout: 5000 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      ).toBeLessThanOrEqual(1);
    });
  });
}
