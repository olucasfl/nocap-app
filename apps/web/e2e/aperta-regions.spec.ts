import { REGIONS, atlasSlots, newSave, type SaveState } from '@nocap/games';
import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/**
 * Regiões do Aperta! (spec 038, 5.4): cada cenário dos colapsos 0 a 5 renderiza sem rolagem lateral em
 * 320, 390, 768 e 1280 px, a faixa "Novo no espaço" aparece e o menu de regiões troca o fundo.
 */
function saveAt(k: number): SaveState {
  const s = newSave('regioes', Date.now() - 3_600_000, 'Missão regiões');
  let earned = 0;
  for (let j = 1; j <= k; j++) earned += 3 + j;
  return {
    ...s,
    tutorial: 'done',
    storySeen: true,
    collapses: k,
    regionId: (REGIONS.filter((r) => r.unlockedAtCollapse <= k).at(-1) ?? REGIONS[0])!.id,
    atlas: { slots: atlasSlots(k), pages: [] },
    fragments: { earned, spent: 0 },
    stats: { ...s.stats, picks: k },
  };
}

async function installSaves(page: Page, data: SaveState) {
  await page.route(/localhost:3333\/me\/aperta\/saves/, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return json({});
    if (path === '/me/aperta/saves') {
      const one = {
        slot: 1,
        name: data.name,
        collapses: data.collapses,
        atlasPages: 0,
        lastPlayedAt: new Date().toISOString(),
        storySeen: true,
        revision: 1,
      };
      return json({ slots: [{ slot: 1, save: one, recoverableUntil: null }, { slot: 2, save: null, recoverableUntil: null }] });
    }
    if (path === '/me/aperta/saves/1') {
      if (req.method() === 'GET') return json({ slot: 1, revision: 1, data });
      if (req.method() === 'PUT') return json({ revision: 2, flagged: [] });
    }
    return json({ message: 'não simulado' }, 404);
  });
}

const noOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'rolagem lateral').toBeLessThanOrEqual(1);

async function openGame(page: Page) {
  await page.goto('/arcade/aperta');
  await page.getByRole('button', { name: 'Jogar' }).first().click();
  await page.getByRole('button', { name: /Continuar/ }).first().click();
  const skip = page.getByRole('button', { name: 'Pular história' });
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
  await expect(page.locator('.ap-game')).toBeVisible();
}

const SIZES = [
  { width: 320, height: 640, touch: true },
  { width: 390, height: 844, touch: true },
  { width: 768, height: 1024, touch: true },
  { width: 1280, height: 800, touch: false },
];

for (const size of SIZES) {
  test.describe(`regiões do Aperta! em ${size.width} px`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      isMobile: size.touch,
      hasTouch: size.touch,
      deviceScaleFactor: size.touch ? 2 : 1,
    });

    test('cada região renderiza, a faixa aparece e o menu troca o fundo', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await installApi(page);

      for (let k = 0; k <= 5; k++) {
        const save = saveAt(k);
        // Cada região parte de um aparelho limpo: a cópia local do passo anterior não pode vencer a conta.
        await page.goto('/');
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        await installSaves(page, save);
        await openGame(page);

        const region = page.locator('.ap-region');
        await expect(region).toHaveAttribute('data-region', save.regionId);
        await expect(region.locator('.ap-layer')).toHaveCount(2);
        await noOverflow(page);
        await page.screenshot({ path: `${process.env.E2E_SHOTS ?? 'test-results'}/reg-${size.width}-${k}.png` });

        if (k === 0) {
          await expect(page.locator('.ap-newstrip')).toHaveCount(0);
          await expect(page.getByRole('button', { name: /Abrir o menu de regiões/ })).toHaveCount(0);
          continue;
        }

        // Faixa "Novo no espaço": traz a região do colapso e some ao dispensar.
        const strip = page.locator('.ap-newstrip');
        await expect(strip).toBeVisible();
        await expect(strip).toContainText(REGIONS[k]!.name);
        const box = (await strip.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
        await page.screenshot({ path: `${process.env.E2E_SHOTS ?? 'test-results'}/reg-${size.width}-${k}-novo.png` });
        await strip.getByRole('button', { name: 'Entendi' }).click();
        await expect(strip).toHaveCount(0);

        // Menu de regiões: lista as k+1 abertas e troca para a primeira.
        await page.getByRole('button', { name: /Abrir o menu de regiões/ }).click();
        const menu = page.getByRole('dialog', { name: 'Regiões do espaço' });
        await expect(menu).toBeVisible();
        await expect(menu.locator('.ap-rm')).toHaveCount(k + 1);
        await noOverflow(page);
        await menu.locator('.ap-rm').first().click();
        await expect(menu).toHaveCount(0);
        await expect(region).toHaveAttribute('data-region', REGIONS[0]!.id);
        await noOverflow(page);
      }
      expect(errors).toEqual([]);
    });
  });
}
