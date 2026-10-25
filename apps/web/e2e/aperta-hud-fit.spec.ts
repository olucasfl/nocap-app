import { newSave, upgradeIndex, type SaveState } from '@nocap/games';
import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/** QA visual do HUD e da barra de energia: nada corta nem se sobrepõe de celular a PC. */
function treeSave(): SaveState {
  const s = newSave('lote', Date.now() - 3_600_000, 'Missão lote');
  const lv = s.run.upgradeLevels.slice();
  for (const [id, n] of Object.entries({ lens: 1, gloves: 1, satellite: 3, antenna: 2 })) lv[upgradeIndex(id)] = n;
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
  // Celular só joga deitado (spec 042 adendo): tamanhos de celular são paisagem.
  { width: 568, height: 320, mobile: true },
  { width: 844, height: 390, mobile: true },
  { width: 1280, height: 720, mobile: false },
  { width: 1366, height: 768, mobile: false },
];

const inside = (b: { x: number; y: number; width: number; height: number }, w: number, h: number) =>
  b.x >= 0 && b.y >= 0 && b.x + b.width <= w + 0.5 && b.y + b.height <= h + 0.5;

for (const size of SIZES) {
  test.describe(`HUD e energia em ${size.width} px`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile });

    test('energia, taxa e meta cabem e não se sobrepõem', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installApi(page);
      await installSaves(page);
      await page.goto('/arcade/aperta');
      await page.getByRole('button', { name: 'Jogar' }).first().click();
      await page.getByRole('button', { name: /Continuar/ }).first().click();
      const skip = page.getByRole('button', { name: 'Pular história' });
      if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
      await expect(page.locator('.ap-game')).toBeVisible();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${process.env.E2E_SHOTS ?? 'test-results'}/hud-${size.width}.png` });
      for (const sel of ['.ap-energy', '.ap-evbar', '.ap-evfoot', '.ap-ratetag.is-energy', '.ap-hudgoal', '.ap-hud .ap-hudp']) {
        const box = (await page.locator(sel).first().boundingBox())!;
        expect(inside(box, size.width, size.height), `${sel} ${JSON.stringify(box)}`).toBe(true);
      }
      // A taxa fica dentro da coluna da energia e o campo de jogo não passa por cima dela.
      const energy = (await page.locator('.ap-energy').boundingBox())!;
      const foot = (await page.locator('.ap-evfoot').boundingBox())!;
      expect(foot.x).toBeGreaterThanOrEqual(energy.x - 1);
      expect(foot.x + foot.width).toBeLessThanOrEqual(energy.x + energy.width + 1);
      if (size.width <= 900) {
        const field = (await page.locator('.ap-field').first().boundingBox())!;
        expect(field.x + field.width).toBeLessThanOrEqual(energy.x + 1);
      }
      // O chip de meta não passa por cima de nenhuma outra linha do painel.
      const goal = (await page.locator('.ap-hudgoal').boundingBox())!;
      const panel = (await page.locator('.ap-hud .ap-hudp').boundingBox())!;
      expect(goal.y + goal.height).toBeLessThanOrEqual(panel.y + panel.height + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  });
}
