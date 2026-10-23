import { newSave, type SaveState } from '@nocap/games';
import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/** A página da árvore em forma de grafo (spec 040, etapa 18): abrir, ver o grafo, arrastar, escolher um nó e conferir o painel. */
function treeSave(): SaveState {
  const s = newSave('grafo', Date.now() - 3_600_000, 'Missão grafo');
  return {
    ...s,
    tutorial: 'done',
    storySeen: true,
    collapses: 2,
    regionId: 'jupiter-saturn',
    album: ['moon'],
    sparks: { legacy: 12, spent: 0 },
    achievements: ['tap-1', 'collapse-1'],
    stats: { ...s.stats, clicks: 40, picks: 40, dustTotal: 6e8 },
  };
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

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

test('árvore em grafo: abre, mostra os nós, arrasta e abre o painel', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await installApi(page);
  await installSaves(page);
  const shot = (n: string) => page.screenshot({ path: `${process.env.E2E_SHOTS ?? 'test-results'}/tree-390-${n}.png` });

  await page.goto('/arcade/aperta');
  await page.getByRole('button', { name: 'Jogar' }).first().click();
  await page.getByRole('button', { name: /Continuar/ }).first().click();
  const skip = page.getByRole('button', { name: 'Pular história' });
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
  await expect(page.locator('.ap-game')).toBeVisible();

  await page.getByRole('button', { name: /^Árvore de Habilidades/ }).click();
  await expect(page.locator('.ap-tg-node')).toHaveCount(120);
  await expect(page.locator('.ap-tg-hint')).toBeVisible();
  await shot('1-aberta');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  // Arrasta a área: a dica some e o conteúdo se move.
  const stage = page.locator('.ap-tg-stage');
  const before = await page.locator('.ap-tg-content').evaluate((el) => (el as unknown as SVGGElement).style.transform);
  await stage.scrollIntoViewIfNeeded();
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 6 });
  await page.mouse.up();
  const after = await page.locator('.ap-tg-content').evaluate((el) => (el as unknown as SVGGElement).style.transform);
  expect(after).not.toBe(before);
  await expect(page.locator('.ap-tg-hint')).toHaveCount(0);

  // Escolhe um nó pelo teclado (foco + Enter) e confere o painel.
  await page.locator('.ap-chipf', { hasText: 'Cosmos' }).click();
  await page.getByRole('button', { name: /^Sintonia, Cosmos/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ap-tp h3')).toHaveText('Sintonia');
  const buy = page.locator('.ap-tp-buy');
  expect((await buy.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await shot('2-painel');
  await buy.click();
  await expect(page.locator('.ap-tp-now')).toContainText('Agora');
  await shot('3-comprado');
  expect(errors).toEqual([]);
});
