import { dustGoal, minPicks, newSave, type SaveState } from '@nocap/games';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/**
 * Colapso e Atlas Eterno do Aperta! (spec 038, 8.1 e 8.2) de ponta a ponta: a estrela pronta, o modal de
 * 2 passos, a vida que recomeça e a página no Atlas. A conta é falsa e já guarda uma vida pronta para colapsar.
 */
function readySave(): SaveState {
  const s = newSave('colapso', Date.now() - 3_600_000, 'Missão teste');
  return {
    ...s,
    tutorial: 'done',
    storySeen: true,
    run: { ...s.run, picks: minPicks(1), dust: dustGoal(1), dustLife: dustGoal(1), build: { moon: 2, mars: 1, vesta: 1 } },
    album: ['moon', 'mars', 'vesta'],
    stats: { ...s.stats, picks: minPicks(1), dustTotal: dustGoal(1) },
  };
}

async function installSaves(page: Page) {
  const account: { rev: number; data: SaveState | null } = { rev: 1, data: readySave() };
  await page.route(/localhost:3333\/me\/aperta\/saves/, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return json({});
    if (path === '/me/aperta/saves') {
      const d = account.data;
      const one = d && {
        slot: 1,
        name: d.name,
        collapses: d.collapses,
        atlasPages: d.atlas.pages.length,
        lastPlayedAt: new Date().toISOString(),
        storySeen: true,
        revision: account.rev,
      };
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
  return account;
}

const noOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'rolagem lateral').toBeLessThanOrEqual(1);

async function tapCenter(page: Page, target: Locator, touch: boolean) {
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Nada do modal pode passar da tela nem ficar cortado dentro dela. */
async function insideViewport(page: Page, selector: string) {
  const r = await page.evaluate((sel) => {
    const el = document.querySelector(sel)!.getBoundingClientRect();
    return { l: el.left, r: el.right, w: window.innerWidth };
  }, selector);
  expect(r.l).toBeGreaterThanOrEqual(-1);
  expect(r.r).toBeLessThanOrEqual(r.w + 1);
}

const SIZES = [
  { name: '320 px', viewport: { width: 320, height: 640 }, touch: true },
  { name: '390 px', viewport: { width: 390, height: 844 }, touch: true },
  { name: '1280 px', viewport: { width: 1280, height: 800 }, touch: false },
];

for (const size of SIZES) {
  test.describe(`colapso do Aperta! em ${size.name}`, () => {
    test.use({
      viewport: size.viewport,
      isMobile: size.touch,
      hasTouch: size.touch,
      deviceScaleFactor: size.touch ? 2 : 1,
    });

    test('estrela pronta, modal em 2 passos, vida nova e Atlas', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await installApi(page);
      const account = await installSaves(page);
      const touch = size.touch;
      const shot = (n: string) => page.screenshot({ path: `${process.env.E2E_SHOTS ?? 'test-results'}/col-${size.viewport.width}-${n}.png` });

      await page.goto('/arcade/aperta');
      await page.getByRole('button', { name: 'Jogar' }).first().click();
      await page.getByRole('button', { name: /Continuar/ }).first().click();
      const skip = page.getByRole('button', { name: 'Pular história' });
      if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
      await expect(page.locator('.ap-game')).toBeVisible();

      // Estrela pronta no HUD.
      const ready = page.getByRole('button', { name: 'Estrela pronta: colapsar' });
      await expect(ready).toBeVisible();
      await shot('1-pronta');
      await noOverflow(page);

      // Passo 1: escolhe a Lua; "Continuar" só liga depois.
      await tapCenter(page, ready, touch);
      const dialog = page.getByRole('dialog', { name: 'A estrela está pronta' });
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(400); // guarda de 300 ms contra toque acidental
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
      await tapCenter(page, dialog.getByRole('button', { name: /^Lua/ }), touch);
      await shot('2-passo1');
      await insideViewport(page, '.ap-collapse');
      await noOverflow(page);
      await tapCenter(page, page.getByRole('button', { name: 'Continuar' }), touch);

      // Passo 2: o que fica, o que sai e os Fragmentos.
      await expect(page.getByRole('dialog', { name: 'Colapsar a estrela?' })).toBeVisible();
      await expect(page.locator('.ap-cc-gain')).toContainText('+4');
      await shot('3-passo2');
      await insideViewport(page, '.ap-collapse');
      await noOverflow(page);
      await tapCenter(page, page.getByRole('button', { name: 'Colapsar a estrela' }), touch);

      // A vida recomeça: aviso, contador, Fragmentos e a página no Atlas.
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.locator('.ap-pickup')).toContainText('Estrela colapsada');
      await expect(page.locator('.ap-pickup')).toContainText('Lua');
      await expect(page.locator('.ap-hudrow-2 b')).toHaveText('1');
      await expect(page.getByRole('button', { name: 'Estrela pronta: colapsar' })).toHaveCount(0);
      await shot('4-colapsada');
      await noOverflow(page);

      await tapCenter(page, page.getByRole('button', { name: /^Grimórios/ }), touch);
      await expect(page.locator('.ap-atlas')).toBeVisible();
      await expect(page.locator('.ap-atlas-pages li.is-full')).toHaveCount(1);
      await expect(page.locator('.ap-atlas')).toContainText('1 de 3 espaços');
      await expect(page.locator('.ap-atlas')).toContainText('Luas');
      await page.locator('.ap-atlas').scrollIntoViewIfNeeded();
      await shot('5-atlas');
      await noOverflow(page);
      await expect(page.getByRole('button', { name: 'Estrela ainda não está pronta' })).toBeDisabled();

      // O servidor aceitou: o save na conta já é o da vida nova.
      await expect.poll(() => account.data?.collapses, { timeout: 5000 }).toBe(1);
      expect(account.data?.atlas.pages).toEqual([{ grimoireId: 'moon', level: 2 }]);
      expect(errors).toEqual([]);
    });
  });
}
