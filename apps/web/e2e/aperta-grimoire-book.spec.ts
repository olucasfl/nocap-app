import { newSave, pickInto, type SaveState } from '@nocap/games';
import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/** Spec 042: o livro de Grimórios mostra um grimório por astro com 4 espaços; os não descobertos ficam "???". */
function bookSave(): SaveState {
  const s = newSave('livro', Date.now() - 3_600_000, 'Missão livro');
  const book = pickInto(s.run, 'moon', 'rare', 2);
  return {
    ...s,
    tutorial: 'done',
    storySeen: true,
    collapses: 3,
    regionId: 'kuiper-belt',
    album: ['moon:common', 'moon:rare', 'sirius:common', 'mercury:epic', 'titan:legendary'],
    run: { ...s.run, ...book, picks: 6 },
  };
}

async function installSaves(page: Page) {
  const account: { rev: number; data: SaveState } = { rev: 1, data: bookSave() };
  await page.route(/localhost:3333\/me\/aperta\/saves/, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return json({});
    if (path === '/me/aperta/saves') {
      const d = account.data;
      const one = { slot: 1, name: d.name, collapses: d.collapses, vaultCount: 0, lastPlayedAt: new Date().toISOString(), storySeen: true, revision: account.rev };
      return json({ slots: [{ slot: 1, save: one, recoverableUntil: null }, { slot: 2, save: null, recoverableUntil: null }] });
    }
    if (path === '/me/aperta/saves/1') {
      if (req.method() === 'GET') return json({ slot: 1, revision: account.rev, data: account.data });
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
  // Celular só joga deitado: tamanhos de celular são paisagem.
  { width: 568, height: 320, mobile: true },
  { width: 844, height: 390, mobile: true },
  { width: 1366, height: 768, mobile: false },
];

for (const size of SIZES) {
  test.describe(`livro de grimórios em ${size.width} px`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile });

    test('um grimório por astro com 4 espaços e nada estoura a largura', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installApi(page);
      await installSaves(page);
      await page.goto('/arcade/aperta');
      await page.getByRole('button', { name: 'Jogar' }).first().click();
      await page.getByRole('button', { name: /Continuar/ }).first().click();
      const skip = page.getByRole('button', { name: 'Pular história' });
      if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
      await page.getByRole('button', { name: /^Grimórios/ }).click();
      await expect(page.locator('.ap-album-count')).toContainText('de 80 versões descobertas');
      await expect(page.locator('.ap-album-count')).toContainText('5');
      await expect(page.locator('.ap-album > li')).toHaveCount(20);
      // A Lua tem Comum e Raro; os outros dois espaços ficam ???.
      const moon = page.locator('.ap-album > li', { hasText: 'Lua' });
      await expect(moon.locator('.ap-slot.is-found')).toHaveCount(2);
      await expect(moon.locator('.ap-slot', { hasText: '???' })).toHaveCount(2);
      const shots = process.env.E2E_SHOTS ?? 'test-results';
      await page.screenshot({ path: `${shots}/book-${size.width}.png` });
      for (const li of await page.locator('.ap-album > li').all()) {
        const box = (await li.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  });
}
