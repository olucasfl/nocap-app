import { expect, test, type Locator, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/**
 * Tutorial guiado do Aperta! (spec 038, 4.6) de ponta a ponta: save novo, bloqueio de tudo fora do alvo,
 * compra do Pulso Solar, retomar o passo salvo e pular. A API de saves é uma conta falsa em memória.
 * O celular emula toque de verdade (isMobile, hasTouch, DPR 2); o PC usa mouse.
 */
interface SaveData {
  tutorial: number | 'done';
  storySeen: boolean;
  name: string;
  run: { upgradeLevels: number[]; dust: number; build: Record<string, number> };
  album: string[];
  collapses: number;
  atlas: { pages: unknown[] };
}

/** Um servidor de saves mínimo: GET lista, GET save, PUT com revisão. */
async function installSaves(page: Page) {
  const account: { rev: number; data: SaveData | null } = { rev: 0, data: null };
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
        storySeen: d.storySeen,
        revision: account.rev,
      };
      return json({ slots: [{ slot: 1, save: one, recoverableUntil: null }, { slot: 2, save: null, recoverableUntil: null }] });
    }
    if (path === '/me/aperta/saves/1') {
      if (req.method() === 'GET') return account.data ? json({ slot: 1, revision: account.rev, data: account.data }) : json({ message: 'sem save' }, 404);
      if (req.method() === 'PUT') {
        account.data = (req.postDataJSON() as { data: SaveData }).data;
        account.rev += 1;
        return json({ revision: account.rev, flagged: [] });
      }
    }
    return json({ message: 'não simulado' }, 404);
  });
  return account;
}

async function watch(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

const noOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'rolagem lateral').toBeLessThanOrEqual(1);

/** Toque (celular) ou clique (PC) nas coordenadas do centro do elemento, passando por cima de qualquer véu. */
async function tapCenter(page: Page, target: Locator, touch: boolean) {
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function openGame(page: Page, fresh: boolean) {
  await page.goto('/arcade/aperta');
  await page.getByRole('button', { name: 'Jogar' }).first().click();
  if (fresh) {
    await page.getByRole('button', { name: 'Novo jogo' }).first().click();
    await page.getByRole('button', { name: 'Pular história' }).click();
  } else {
    await page.getByRole('button', { name: /Continuar/ }).first().click();
    // O mock não guarda "história vista" entre as telas; se ela reaparecer, pula como a pessoa faria.
    const skip = page.getByRole('button', { name: 'Pular história' });
    if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
  }
  await expect(page.locator('.ap-game')).toBeVisible();
}

const card = (page: Page) => page.locator('.ap-tut-card');

const SIZES = [
  { name: '320 px', viewport: { width: 320, height: 640 }, touch: true },
  { name: '390 px', viewport: { width: 390, height: 844 }, touch: true },
  { name: '1280 px', viewport: { width: 1280, height: 800 }, touch: false },
];

for (const size of SIZES) {
  test.describe(`tutorial do Aperta! em ${size.name}`, () => {
    test.use({
      viewport: size.viewport,
      isMobile: size.touch,
      hasTouch: size.touch,
      deviceScaleFactor: size.touch ? 2 : 1,
    });

    test('guia os 5 passos, bloqueia o resto e retoma o passo salvo', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors = await watch(page);
      await installApi(page);
      const account = await installSaves(page);
      const touch = size.touch;
      await openGame(page, true);
      const shot = (n: string) => page.screenshot({ path: `${process.env.E2E_SHOTS ?? 'test-results'}/tut-${size.viewport.width}-${n}.png` });

      // Passo 1: só o botão grande funciona.
      await expect(card(page)).toContainText('passo 1 de 5');
      await expect(page.locator('.ap-tut-ring')).toBeVisible();
      await shot('1');
      await tapCenter(page, page.getByRole('button', { name: 'Melhorias' }), touch);
      await tapCenter(page, page.getByRole('button', { name: /Árvore/ }), touch);
      await tapCenter(page, page.getByRole('button', { name: 'Sair' }), touch);
      await expect(page.locator('.ap-sheet')).toHaveCount(0);
      await expect(page.locator('.ap-game')).toBeVisible();
      await noOverflow(page);

      await tapCenter(page, page.getByRole('button', { name: 'Apertar o botão' }), touch);

      // Passo 2: o livro da Lua; só "Entendi" funciona.
      await expect(card(page)).toContainText('passo 2 de 5');
      await expect(page.getByRole('dialog', { name: 'Primeiro grimório' })).toBeVisible();
      await shot('2');
      await page.keyboard.press('g');
      await page.keyboard.press('Escape');
      await expect(page.locator('.ap-sheet')).toHaveCount(0);
      await noOverflow(page);
      await page.waitForTimeout(450);
      await tapCenter(page, page.getByRole('button', { name: 'Entendi' }), touch);

      // Passo 3: seta em Melhorias; Conquistas e Grimórios seguem bloqueados.
      await expect(card(page)).toContainText('passo 3 de 5');
      await shot('3');
      await tapCenter(page, page.getByRole('button', { name: 'Grimórios' }), touch);
      await page.keyboard.press('g');
      await expect(page.locator('.ap-sheet')).toHaveCount(0);
      await tapCenter(page, page.getByRole('button', { name: /^Melhorias/ }), touch);

      // Passo 4: só o preço do Pulso Solar; o X da página e as outras linhas ficam bloqueados.
      await expect(page.locator('.ap-sheet')).toBeVisible();
      await expect(card(page)).toContainText('passo 4 de 5');
      await shot('4');
      await tapCenter(page, page.locator('.ap-sheet .ap-x'), touch);
      await page.keyboard.press('Escape');
      await expect(page.locator('.ap-sheet')).toBeVisible();
      await noOverflow(page);
      await tapCenter(page, page.locator('[data-tut="buy-pulse"]'), touch);

      // Passo 5: recarregar no meio retoma daí (a cópia do aparelho e a conta guardam o passo e a compra).
      await expect(card(page)).toContainText('passo 5 de 5');
      await page.waitForTimeout(600); // deixa a subida do passo 5 terminar (uma pessoa leva mais que isso)
      await page.reload();
      await openGame(page, false);
      await expect(card(page)).toContainText('passo 5 de 5');
      await expect(card(page)).toContainText('Agora os grimórios');
      await shot('5a');
      await tapCenter(page, page.getByRole('button', { name: /^Melhorias/ }), touch);
      await expect(page.locator('.ap-sheet')).toHaveCount(0);
      await tapCenter(page, page.getByRole('button', { name: /^Grimórios/ }), touch);

      await expect(page.locator('.ap-sheet')).toBeVisible();
      await expect(card(page)).toContainText('Sua coleção');
      await shot('5b');
      await noOverflow(page);
      await page.getByRole('button', { name: 'Começar a jogar' }).click();
      await expect(page.locator('.ap-tut')).toHaveCount(0);

      // Livre: tudo volta a funcionar, e a compra e a Lua do tutorial continuam no save.
      await page.locator('.ap-sheet .ap-x').click();
      await tapCenter(page, page.getByRole('button', { name: 'Apertar o botão' }), touch);
      await page.waitForTimeout(600);
      await page.reload();
      await openGame(page, false);
      await expect(page.locator('.ap-tut')).toHaveCount(0);
      await expect.poll(() => account.data?.tutorial).toBe('done');
      expect(account.data?.run.upgradeLevels[0]).toBe(1);
      expect(account.data?.album).toContain('moon');
      expect(errors).toEqual([]);
    });

    test('pular marca como feito e libera o jogo', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors = await watch(page);
      await installApi(page);
      const account = await installSaves(page);
      await openGame(page, true);
      await expect(card(page)).toContainText('passo 1 de 5');
      await page.getByRole('button', { name: 'Pular tutorial' }).click();
      await expect(page.locator('.ap-tut')).toHaveCount(0);
      await tapCenter(page, page.getByRole('button', { name: /^Melhorias/ }), size.touch);
      await expect(page.locator('.ap-sheet')).toBeVisible();
      // Voltar ao jogo não traz o tutorial de volta.
      await page.reload();
      await openGame(page, false);
      await expect(page.locator('.ap-tut')).toHaveCount(0);
      await expect.poll(() => account.data?.tutorial).toBe('done');
      await noOverflow(page);
      expect(errors).toEqual([]);
    });
  });
}
