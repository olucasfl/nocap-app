import { energyCap, newSave, tickObjects, type SaveState } from '@nocap/games';
import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/** A página da árvore em forma de grafo (spec 040, etapa 18): abrir, ver o grafo, arrastar, escolher um nó e conferir o painel. */
function choiceSave(): SaveState {
  const s = newSave('escolha', Date.now() - 3_600_000, 'Missão escolha');
  const base: SaveState = { ...s, tutorial: 'done', storySeen: true, collapses: 1, regionId: 'asteroid-belt', run: { ...s.run, picks: 6 } };
  // Barra cheia: o tick abre a escolha de grimório.
  const full = { ...base, run: { ...base.run, energy: energyCap(6) + 1 } };
  return tickObjects(full, 1);
}

async function installSaves(page: Page) {
  const account: { rev: number; data: SaveState } = { rev: 1, data: choiceSave() };
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
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1536x864', width: 1536, height: 864 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

for (const size of SIZES) {
  test.describe(`escolha de grimório sem rolagem em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('as 3 cartas e o botão cabem na tela, sem rolar', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installApi(page);
      await installSaves(page);
      await page.goto('/arcade/aperta');
      await page.getByRole('button', { name: 'Jogar' }).first().click();
      await page.getByRole('button', { name: /Continuar/ }).first().click();
      const skip = page.getByRole('button', { name: 'Pular história' });
      if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
      const dialog = page.getByRole('dialog', { name: /A energia transbordou/ });
      await expect(dialog).toBeVisible();
      const m = await page.locator('.ap-picks').evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
      expect(m.scroll, `rolagem das cartas ${m.scroll} > ${m.client}`).toBeLessThanOrEqual(m.client + 1);
      const box = (await page.getByRole('button', { name: /Escolher este grimório/ }).boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      await page.screenshot({ path: `${process.env.E2E_SHOTS ?? 'test-results'}/choice-${size.name}.png` });
    });
  });
}
