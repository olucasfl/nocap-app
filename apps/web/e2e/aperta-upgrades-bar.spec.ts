import { newSave, upgradeIndex, type SaveState } from '@nocap/games';
import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/** QA visual da página de Melhorias: abas Toque/Geradores, botão Comprados e selos, sem cortes em larguras de celular a PC. */
function treeSave(): SaveState {
  const s = newSave('lote', Date.now() - 3_600_000, 'Missão lote');
  const lv = s.run.upgradeLevels.slice();
  for (const [id, n] of Object.entries({ lens: 1, gloves: 1, satellite: 3, queue: 1 })) lv[upgradeIndex(id)] = n;
  return { ...s, tutorial: 'done', storySeen: true, collapses: 2, regionId: 'jupiter-saturn', run: { ...s.run, upgradeLevels: lv, dust: 5e5, dustLife: 5e5 } };
}

async function installSaves(page: Page) {
  const account: { rev: number; data: SaveState } = { rev: 1, data: treeSave() };
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
  { width: 320, height: 640, mobile: true },
  { width: 390, height: 844, mobile: true },
  { width: 768, height: 900, mobile: false },
  { width: 1366, height: 768, mobile: false },
];

for (const size of SIZES) {
  test.describe(`melhorias em ${size.width} px`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile });

    test('barra de abas e Comprados cabem, sem corte', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installApi(page);
      await installSaves(page);
      await page.goto('/arcade/aperta');
      await page.getByRole('button', { name: 'Jogar' }).first().click();
      await page.getByRole('button', { name: /Continuar/ }).first().click();
      const skip = page.getByRole('button', { name: 'Pular história' });
      if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
      await expect(page.locator('.ap-game')).toBeVisible();
      await page.locator('.ap-dockb-big').click();
      const shots = process.env.E2E_SHOTS ?? 'test-results';
      for (const tab of ['Toque', 'Geradores']) {
        await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${shots}/up-${size.width}-${tab}.png` });
      }
      await page.getByRole('button', { name: /^Comprados/ }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${shots}/up-${size.width}-comprados.png` });
      // Cada peça da barra fica inteira dentro da janela.
      for (const sel of ['.ap-upbar', '.ap-uptab >> nth=0', '.ap-uptab >> nth=1', '.ap-ownbtn']) {
        const box = (await page.locator(sel).first().boundingBox())!;
        expect(box.x, sel).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, sel).toBeLessThanOrEqual(size.width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  });
}
