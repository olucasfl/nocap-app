import { buyNode, newSave, respecTree, sparksAvailable, type SaveState } from '@nocap/games';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/**
 * Árvore de Habilidades e Conquistas do Aperta! (spec 038, 3.5, 5.3 e 8.3) de ponta a ponta: comprar nós,
 * refazer em 2 passos, aviso de conquista e a página de Conquistas. A conta é falsa e já tem 1 colapso e 6 Cintilas migradas dos Fragmentos.
 */
function treeSave(): SaveState {
  const s = newSave('arvore', Date.now() - 3_600_000, 'Missão teste');
  return {
    ...s,
    tutorial: 'done',
    storySeen: true,
    collapses: 1,
    regionId: 'asteroid-belt',
    album: ['moon'],
    sparks: { legacy: 6, spent: 0 },
    achievements: ['tap-1', 'collapse-1'],
    stats: { ...s.stats, clicks: 40, picks: 20, dustTotal: 6e6 },
  };
}

async function installSaves(page: Page) {
  const account: { rev: number; data: SaveState | null } = { rev: 1, data: treeSave() };
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
        vaultCount: Object.keys(d.vault ?? {}).length,
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
  await target.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

const SIZES = [
  { name: '320 px', viewport: { width: 320, height: 640 }, touch: true },
  { name: '390 px', viewport: { width: 390, height: 844 }, touch: true },
  { name: '1280 px', viewport: { width: 1280, height: 800 }, touch: false },
];

for (const size of SIZES) {
  test.describe(`árvore e conquistas do Aperta! em ${size.name}`, () => {
    test.use({
      viewport: size.viewport,
      isMobile: size.touch,
      hasTouch: size.touch,
      deviceScaleFactor: size.touch ? 2 : 1,
    });

    test('compra nós, refaz a árvore e mostra as conquistas', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await installApi(page);
      const account = await installSaves(page);
      const touch = size.touch;
      const shot = (n: string) => page.screenshot({ path: `${process.env.E2E_SHOTS ?? 'test-results'}/tree-${size.viewport.width}-${n}.png` });

      await page.goto('/arcade/aperta');
      await page.getByRole('button', { name: 'Jogar' }).first().click();
      await page.getByRole('button', { name: /Continuar/ }).first().click();
      const skip = page.getByRole('button', { name: 'Pular história' });
      if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
      await expect(page.locator('.ap-game')).toBeVisible();

      // Árvore em grafo: 120 nós e o saldo de Cintilas (as 6 migradas mais o que o álbum e as conquistas do save já rendem).
      await tapCenter(page, page.getByRole('button', { name: /^Árvore de Habilidades/ }), touch);
      await expect(page.locator('.ap-tg-node')).toHaveCount(120);
      const spark = async () => Number(await page.locator('.ap-tree-frag b').innerText());
      const s0 = sparksAvailable(treeSave());
      await expect(page.locator('.ap-tree-frag b')).toHaveText(String(s0));
      expect(s0).toBeGreaterThan(6);
      await expect(page.locator('.ap-tree-sources')).toContainText('De onde vêm as Cintilas');
      await shot('1-arvore');
      await noOverflow(page);

      // Compra dois nós de entrada do Cosmos pelo painel; o aviso da conquista aparece.
      const buyByPanel = async (name: string) => {
        const node = page.getByRole('button', { name: new RegExp(`^${name}, Cosmos`) });
        await node.focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('.ap-tp h3')).toHaveText(name);
        await tapCenter(page, page.locator('.ap-tp-buy'), touch);
      };
      await tapCenter(page, page.locator('.ap-chipf', { hasText: 'Cosmos' }), touch);
      const afterBuy1 = buyNode(treeSave(), 'co-02');
      const afterBuy2 = buyNode(afterBuy1, 'co-01');
      await buyByPanel('Sintonia');
      await expect(page.locator('.ap-tree-frag b')).toHaveText(String(sparksAvailable(afterBuy1)));
      await shot('2-comprou');
      await noOverflow(page);
      await buyByPanel('Cartas de capa');
      await expect(page.locator('.ap-tree-frag b')).toHaveText(String(sparksAvailable(afterBuy2)));
      await expect(page.locator('.ap-tg-node.has-level')).toHaveCount(2);

      // Refazer em 2 passos: devolve o que foi gasto (100%, sem taxa) e a conquista escondida rende mais.
      const respec = page.locator('.ap-respec');
      await respec.scrollIntoViewIfNeeded();
      await tapCenter(page, respec.getByRole('button', { name: 'Refazer árvore' }), touch);
      await expect(respec.getByRole('button', { name: /Confirmar: devolver 2/ })).toBeVisible();
      await shot('3-refazer');
      await noOverflow(page);
      await tapCenter(page, respec.getByRole('button', { name: /Confirmar/ }), touch);
      await expect(page.locator('.ap-tree-frag b')).toHaveText(String(sparksAvailable(respecTree(afterBuy2))));
      expect(await spark()).toBeGreaterThan(s0);
      await expect(page.locator('.ap-tg-node.has-level')).toHaveCount(0);

      // Conquistas: ganhas em dourado, progresso N/M e a escondida (agora ganha).
      await tapCenter(page, page.getByRole('button', { name: 'Conquistas' }), touch);
      await expect(page.locator('.ap-ach.is-earned').first()).toBeVisible();
      await expect(page.locator('.ap-achpage')).toContainText('40/100');
      await expect(page.locator('.ap-achpage')).toContainText('Mudei de ideia');
      await shot('4-conquistas');
      await noOverflow(page);
      // Cabeçalho com as Cintilas, filtro por família, busca e estado.
      await expect(page.locator('.ap-ach-sparks')).toContainText('ganhas');
      await expect(page.locator('.ap-ach-sparks')).toContainText('a ganhar');
      await expect(page.locator('.ap-ach-reward').first()).toContainText('+');
      const chips = page.locator('.ap-ach-chips');
      await tapCenter(page, chips.getByRole('button', { name: /^Colapsos/ }), touch);
      await expect(page.locator('.ap-ach-group')).toHaveCount(1);
      await tapCenter(page, chips.getByRole('button', { name: /^Todas/ }), touch);
      await page.getByLabel('Buscar conquista').fill('mil toques');
      await expect(page.locator('.ap-ach')).not.toHaveCount(0);
      await expect(page.locator('.ap-ach').first()).toContainText(/toques/i);
      await shot('4b-busca');
      await noOverflow(page);
      await page.getByLabel('Buscar conquista').fill('zzzz');
      await expect(page.locator('.ap-achpage')).toContainText('Nenhuma conquista com esse filtro');
      await page.getByLabel('Buscar conquista').fill('');
      await tapCenter(page, page.locator('.ap-ach-status').getByRole('button', { name: 'Ganhas' }), touch);
      await expect(page.locator('.ap-ach:not(.is-earned)')).toHaveCount(0);
      await tapCenter(page, page.locator('.ap-ach-status').getByRole('button', { name: 'Todas' }), touch);
      await page.locator('.ap-sbody').evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await shot('5-conquistas-fim');
      await noOverflow(page);

      // O servidor aceitou o save com as conquistas e a árvore refeita.
      await expect.poll(() => account.data?.achievements.includes('respec'), { timeout: 5000 }).toBe(true);
      expect(account.data?.sparks.spent).toBe(0);
      expect(account.data?.tree).toEqual({});
      expect(account.data?.achievements).toEqual(expect.arrayContaining(['tap-1', 'collapse-1', 'tree-1', 'respec']));
      expect(errors).toEqual([]);
    });
  });
}
