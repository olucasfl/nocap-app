import { dustGoal, meetMilestone, minPicks, newSave, type SaveState } from '@nocap/games';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/**
 * Colapso e Cofre dos Proibidos do Aperta! (spec 038, 8.1 e 8.2; requisitos da spec 040) de ponta a ponta: a estrela pronta, o modal de
 * 2 passos, a vida que recomeça e o Cofre. A conta é falsa e já guarda uma vida pronta para colapsar.
 */
function readySave(): SaveState {
  const s = newSave('colapso', Date.now() - 3_600_000, 'Missão teste');
  return {
    ...s,
    tutorial: 'done',
    storySeen: true,
    run: {
      ...s.run,
      picks: minPicks(1),
      dust: dustGoal(1),
      dustLife: dustGoal(1),
      build: { moon: 2, mars: 1, vesta: 1 },
      ...meetMilestone(0, s.run.upgradeLevels),
    },
    album: ['moon', 'mars', 'vesta'],
    stats: { ...s.stats, picks: minPicks(1), dustTotal: dustGoal(1) },
  };
}

/** Um save no 7º colapso (6 feitos) com a vida pela metade: nenhum requisito cumprido, para ver as barras andando. */
function midLifeSave(): SaveState {
  const c = 6;
  const s = newSave('meio', Date.now() - 3_600_000, 'Missão meio');
  let earned = 0;
  let total = 0;
  for (let k = 1; k <= c; k++) {
    earned += 3 + k;
    total += dustGoal(k);
  }
  return {
    ...s,
    tutorial: 'done',
    storySeen: true,
    collapses: c,
    regionId: 'alpha-centauri',
    sparks: { legacy: earned, spent: 0 },
    album: ['moon', 'mars'],
    run: {
      ...s.run,
      picks: 4,
      dust: dustGoal(c + 1) * 0.37,
      dustLife: dustGoal(c + 1) * 0.37,
      build: { moon: 1, mars: 1 },
      captured: 2,
      chainBest: 4,
    },
    stats: {
      ...s.stats,
      picks: c * 12 + 9,
      dustTotal: total + dustGoal(c + 1) * 0.37,
      objectsCaptured: 2,
    },
  };
}

async function installSaves(page: Page, initial: SaveState = readySave()) {
  const account: { rev: number; data: SaveState | null } = { rev: 1, data: initial };
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
      const one = d && {
        slot: 1,
        name: d.name,
        collapses: d.collapses,
        vaultCount: Object.keys(d.vault ?? {}).length,
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
  return account;
}

const noOverflow = async (page: Page) =>
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    'rolagem lateral',
  ).toBeLessThanOrEqual(1);

async function tapCenter(page: Page, target: Locator, touch: boolean) {
  await target.scrollIntoViewIfNeeded();
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

    test('estrela pronta, modal em 2 passos, vida nova e Cofre', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await installApi(page);
      const account = await installSaves(page);
      const touch = size.touch;
      const shot = (n: string) =>
        page.screenshot({
          path: `${process.env.E2E_SHOTS ?? 'test-results'}/col-${size.viewport.width}-${n}.png`,
        });

      await page.goto('/arcade/aperta');
      await page.getByRole('button', { name: 'Jogar' }).first().click();
      await page
        .getByRole('button', { name: /Continuar/ })
        .first()
        .click();
      const skip = page.getByRole('button', { name: 'Pular história' });
      if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
      await expect(page.locator('.ap-game')).toBeVisible();

      // Estrela pronta no HUD.
      const ready = page.getByRole('button', { name: 'Estrela pronta: colapso 1' });
      await expect(ready).toBeVisible();
      // O botão traz a barra de cada requisito (poeira, escolhas e o marco da vida).
      await expect(page.locator('.ap-ready-wrap .ap-reqs li')).toHaveCount(3);
      await expect(page.locator('.ap-ready-wrap .ap-reqs li.is-done')).toHaveCount(3);
      await shot('1-pronta');
      await noOverflow(page);

      // Passo 1: escolhe um proibido; "Continuar" só liga depois.
      await tapCenter(page, ready, touch);
      const dialog = page.getByRole('dialog', { name: /A estrela está pronta/ });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.ap-reqs li')).toHaveCount(3);
      await expect(dialog.locator('.ap-reqs')).toContainText('Geradores no nível');
      await page.waitForTimeout(400); // guarda de 300 ms contra toque acidental
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
      await tapCenter(page, dialog.locator('.ap-cc-vault').first(), touch);
      await shot('2-passo1');
      await insideViewport(page, '.ap-collapse');
      await noOverflow(page);
      await tapCenter(page, page.getByRole('button', { name: 'Continuar' }), touch);

      // Passo 2: o que fica, o que sai e as Cintilas.
      await expect(page.getByRole('dialog', { name: 'Colapsar a estrela?' })).toBeVisible();
      await expect(page.locator('.ap-cc-gain')).toContainText(/\+\d+ Cintilas?/);
      await shot('3-passo2');
      await insideViewport(page, '.ap-collapse');
      await noOverflow(page);
      await tapCenter(page, page.getByRole('button', { name: 'Colapsar a estrela' }), touch);

      // A vida recomeça: aviso, contador, Cintilas e o Cofre.
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(
        page.locator('.ap-pickup:not(.ap-pickup-ach):not(.ap-pickup-sparks)'),
      ).toContainText('Estrela colapsada');
      await expect(
        page.locator('.ap-pickup:not(.ap-pickup-ach):not(.ap-pickup-sparks)'),
      ).toContainText('Cofre:');
      await expect(page.locator('.ap-hudrow-2 b')).toHaveText('1');
      await expect(page.getByRole('button', { name: /Estrela pronta/ })).toHaveCount(0);
      await shot('4-colapsada');
      await noOverflow(page);

      await tapCenter(page, page.getByRole('button', { name: /^Cofre dos Proibidos/ }), touch);
      await expect(page.locator('.ap-vault')).toBeVisible();
      await expect(page.locator('.ap-vault-slots')).toBeVisible();
      await page.locator('.ap-vault').scrollIntoViewIfNeeded();
      await shot('5-cofre');
      await noOverflow(page);
      await expect(
        page.getByRole('button', { name: 'Estrela ainda não está pronta' }),
      ).toBeDisabled();

      // O servidor aceitou: o save na conta já é o da vida nova.
      await expect.poll(() => account.data?.collapses, { timeout: 5000 }).toBe(1);
      expect(Object.keys(account.data?.vault ?? {})).toHaveLength(1);
      expect(errors).toEqual([]);
    });

    test('colapso 7: as barras de cada requisito andam no Cofre e não há botão enquanto falta algo', async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await installApi(page);
      await installSaves(page, midLifeSave());
      const shot = (n: string) =>
        page.screenshot({
          path: `${process.env.E2E_SHOTS ?? 'test-results'}/col-${size.viewport.width}-${n}.png`,
        });

      await page.goto('/arcade/aperta');
      await page.getByRole('button', { name: 'Jogar' }).first().click();
      await page
        .getByRole('button', { name: /Continuar/ })
        .first()
        .click();
      const skip = page.getByRole('button', { name: 'Pular história' });
      if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
      await expect(page.locator('.ap-game')).toBeVisible();
      await expect(page.getByRole('button', { name: /Estrela pronta/ })).toHaveCount(0);

      await tapCenter(page, page.getByRole('button', { name: /^Cofre dos Proibidos/ }), size.touch);
      const box = page.locator('.ap-collapse-box');
      await box.scrollIntoViewIfNeeded();
      await expect(box.locator('.ap-reqs li')).toHaveCount(3);
      await expect(box.locator('.ap-reqs li.is-done')).toHaveCount(0);
      await expect(box).toContainText('Poeira da vida');
      await expect(box).toContainText('Escolhas de grimório');
      await expect(box).toContainText('Falta');
      await expect(
        box.getByRole('button', { name: 'Estrela ainda não está pronta' }),
      ).toBeDisabled();
      // A barra de poeira está em ~37%: anda por transform, sem largura.
      const fill = await box
        .locator('.ap-reqs li[data-req="dust"] .ap-cbar i')
        .evaluate((el) => (el as HTMLElement).style.transform);
      expect(fill).toMatch(/scaleX\(0\.3[67]/);
      await shot('6-barras');
      await noOverflow(page);
      expect(errors).toEqual([]);
    });
  });
}
