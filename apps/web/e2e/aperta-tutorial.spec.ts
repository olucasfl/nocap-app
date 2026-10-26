import {
  TUTORIAL,
  affordableUpgradeIndex,
  energyCap,
  newSave,
  nextUpgradeCost,
  type SaveState,
} from '@nocap/games';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/**
 * Tutorial dinâmico do Aperta! (spec 038, 4.6) de ponta a ponta: só o botão no começo, Melhorias que surge com a
 * poeira, Grimórios que surge com a escolha, os cartões do jogo livre e o "Pular tutorial". A API de saves é uma
 * conta falsa em memória; cada fase parte de um save montado com o próprio motor (os números do motor mudam, então
 * o teste lê o preço e o teto da barra dele). O celular emula toque de verdade (isMobile, hasTouch, DPR 2).
 */
interface SaveData {
  tutorial: number | 'done';
  storySeen: boolean;
  name: string;
  run: { upgradeLevels: number[]; dust: number; build: Record<string, number> };
  album: string[];
  collapses: number;
  vault?: Record<string, number>;
}

/** Um servidor de saves mínimo: GET lista, GET save, PUT com revisão. */
async function installSaves(page: Page) {
  const account: { rev: number; data: SaveData | null } = { rev: 0, data: null };
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
        storySeen: d.storySeen,
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
        return account.data
          ? json({ slot: 1, revision: account.rev, data: account.data })
          : json({ message: 'sem save' }, 404);
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
    if (m.type() === 'error' && !/Failed to load resource|fonts\.g/.test(m.text()))
      errors.push(m.text());
  });
  return errors;
}

const noOverflow = async (page: Page) =>
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    'rolagem lateral',
  ).toBeLessThanOrEqual(1);

/** Toque (celular) ou clique (PC) nas coordenadas do centro do elemento. */
async function tapCenter(page: Page, target: Locator, touch: boolean) {
  await target.scrollIntoViewIfNeeded();
  // O anel do tutorial se remede a cada MEASURE_MS: sem esperar, o toque cai no bloqueio da posição antiga.
  await page.waitForTimeout(400);
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
    await page
      .getByRole('button', { name: /Continuar/ })
      .first()
      .click();
    // O mock não guarda "história vista" entre as telas; se ela reaparecer, pula como a pessoa faria.
    const skip = page.getByRole('button', { name: 'Pular história' });
    if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
  }
  await expect(page.locator('.ap-game')).toBeVisible();
}

const dock = (page: Page, name: string) =>
  page.locator('.ap-dock').getByRole('button', { name: new RegExp(`^${name}`) });
const coach = (page: Page) => page.locator('.ap-tut');
const card = (page: Page) => page.locator('.ap-tut-card, .ap-tut-inline');

/** Um save no meio do roteiro, montado pelo motor: `patch` ajusta o que a fase precisa. */
function saveAt(patch: (s: SaveState) => SaveState): SaveData {
  const base = newSave('e2e', Date.now() - 600_000, 'Missão Perigeu');
  return patch({ ...base, storySeen: true }) as unknown as SaveData;
}
const nearUpgrade = (s: SaveState): SaveState => {
  // A melhoria mais barata, não a primeira da lista: é a que o tutorial manda comprar.
  const rich = { ...s, run: { ...s.run, dust: 1e12 } };
  const cost = nextUpgradeCost(s, affordableUpgradeIndex(rich)!) as number;
  return { ...s, run: { ...s.run, dust: cost - 1, dustLife: cost - 1 } };
};
const nearFull = (s: SaveState): SaveState => ({
  ...s,
  run: { ...s.run, energy: energyCap(s.run.picks) - 0.01 },
});

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
    const touch = size.touch;
    const shotDir = process.env.E2E_SHOTS ?? 'test-results';
    const shot = (page: Page, n: string) =>
      page.screenshot({ path: `${shotDir}/ftue-${size.viewport.width}-${n}.png` });
    const press = (page: Page) =>
      tapCenter(page, page.getByRole('button', { name: 'Apertar o botão' }), touch);

    test('começa só com o botão: poeira sobe de 1 em 1 e nada mais aparece', async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors = await watch(page);
      await installApi(page);
      await installSaves(page);
      await openGame(page, true);
      await expect(coach(page)).toContainText('Toque aqui para ganhar poeira');
      await expect(page.locator('.ap-tut-ring')).toBeVisible();
      await expect(page.locator('.ap-dock')).toHaveCount(0);
      await expect(page.locator('[data-tut="tree"]')).toHaveCount(0);
      await expect(page.locator('.ap-hudrow-2')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Pular tutorial' })).toBeVisible();
      await shot(page, '1-botao');
      // O motor aceita no máximo 12 toques por segundo: um respiro entre os toques.
      for (let i = 0; i < 3; i++) {
        await press(page);
        await page.waitForTimeout(160);
      }
      await expect(page.locator('.ap-hudrow b').first()).toHaveText('3');
      await expect(page.locator('.ap-dock')).toHaveCount(0);
      await shot(page, '1b-tres-toques');
      await noOverflow(page);
      expect(errors).toEqual([]);
    });

    test('poeira da 1ª melhoria: surge Melhorias, compra, volta e a barra sobe; recarregar retoma', async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors = await watch(page);
      await installApi(page);
      const account = await installSaves(page);
      account.data = saveAt(nearUpgrade);
      account.rev = 1;
      await openGame(page, false);
      await expect(dock(page, 'Melhorias')).toHaveCount(0);
      await press(page);
      await expect(coach(page)).toContainText('Você já pode comprar seu primeiro item.');
      await expect(dock(page, 'Melhorias')).toBeVisible();
      await expect(dock(page, 'Grimórios')).toHaveCount(0);
      await expect(dock(page, 'Conquistas')).toHaveCount(0);
      await shot(page, '2-parabens');
      await noOverflow(page);

      // O passo fica salvo: recarregar volta no mesmo ponto.
      await expect.poll(() => account.data?.tutorial).toBe(TUTORIAL.UPGRADE);
      await page.reload();
      await openGame(page, false);
      await expect(coach(page)).toContainText('Você já pode comprar seu primeiro item.');

      await tapCenter(page, dock(page, 'Melhorias'), touch);
      await expect(page.locator('.ap-sheet')).toBeVisible();
      await expect(coach(page)).toContainText('Toque no preço para comprar');
      await shot(page, '3-comprar');
      await noOverflow(page);
      await tapCenter(page, page.locator('[data-tut="buy-first"]'), touch);
      await expect(coach(page)).toContainText('Feche a página e volte a tocar');
      await shot(page, '4-voltar');
      await tapCenter(page, page.locator('.ap-sheet .ap-x'), touch);
      await expect(page.locator('.ap-sheet')).toHaveCount(0);
      await expect(coach(page)).toContainText('Encha a barra de energia');
      await expect(dock(page, 'Grimórios')).toHaveCount(0);
      await shot(page, '5-barra');
      await noOverflow(page);
      await expect.poll(() => account.data?.tutorial).toBe(TUTORIAL.FILL);
      expect(errors).toEqual([]);
    });

    test('barra cheia: escolha do 1º grimório com o cartão, surge Grimórios, depois o jogo livre', async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors = await watch(page);
      await installApi(page);
      const account = await installSaves(page);
      account.data = saveAt((s) =>
        nearFull({ ...s, tutorial: TUTORIAL.FILL, ui: { unlocked: ['upgrades'], hints: [] } }),
      );
      account.rev = 1;
      await openGame(page, false);
      await expect(dock(page, 'Grimórios')).toHaveCount(0);
      await press(page);
      await expect(page.locator('.ap-tut-inline')).toContainText(
        'Você ganhou seu primeiro grimório!',
      );
      await expect(page.locator('.ap-tut-inline')).toContainText('1,6 s');
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, '6-escolha');
      await noOverflow(page);
      await page.waitForTimeout(2000);
      await page.locator('.ap-pick').first().click();
      await page.getByRole('button', { name: 'Escolher este grimório' }).click();
      await expect(coach(page)).toContainText('Seus grimórios');
      await expect(dock(page, 'Grimórios')).toBeVisible();
      await expect(dock(page, 'Conquistas')).toHaveCount(0);
      await shot(page, '7-grimorios');
      await tapCenter(page, dock(page, 'Grimórios'), touch);
      await expect(page.locator('.ap-sheet')).toBeVisible();
      await expect.poll(() => account.data?.tutorial).toBe(TUTORIAL.FREE);
      await shot(page, '8-colecao');
      await tapCenter(page, page.locator('.ap-sheet .ap-x'), touch);
      await expect(card(page)).toHaveCount(0);
      await noOverflow(page);
      expect(errors).toEqual([]);
    });

    test('jogo livre: o cartão de conquistas vem com a conquista e libera o botão', async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors = await watch(page);
      await installApi(page);
      const account = await installSaves(page);
      account.data = saveAt((s) => ({
        ...s,
        tutorial: TUTORIAL.FREE,
        ui: { unlocked: ['upgrades', 'grimoires'], hints: [] },
        album: ['moon'],
        run: { ...s.run, picks: 1, build: { moon: 1 } },
        stats: { ...s.stats, clicks: 99, picks: 1 },
        achievements: ['tap-1'],
      }));
      account.rev = 1;
      await openGame(page, false);
      await expect(dock(page, 'Conquistas')).toHaveCount(0);
      await expect(page.locator('.ap-tut-card')).toHaveCount(0);
      await press(page); // o toque 100 dá a segunda conquista
      await expect(page.locator('.ap-tut-card')).toContainText('Sua primeira conquista!');
      await expect(dock(page, 'Conquistas')).toBeVisible();
      await shot(page, '9-conquistas');
      await noOverflow(page);
      await page.getByRole('button', { name: 'Entendi' }).click();
      await expect(page.locator('.ap-tut-card')).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    /** Quem está no ponto central do elemento: o bloqueio do tutorial (bloqueado) ou o próprio elemento (livre). */
    const hitsBlock = (page: Page, target: Locator) =>
      target.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!hit?.closest('.ap-tut-block');
      });

    test('o tutorial escurece a tela e só o alvo, Sair e Pular respondem ao toque', async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors = await watch(page);
      await installApi(page);
      await installSaves(page);
      await openGame(page, true);
      await expect(page.locator('.ap-tut')).toHaveAttribute('data-blocking', 'true');
      await expect(page.locator('.ap-tut-dim')).toBeVisible();
      await expect(page.locator('.ap-tut-hand')).toBeVisible();
      await expect(page.locator('.ap-tut-card')).toContainText('Passo 1 de 6');
      // O botão central está livre; o HUD de poeira e o resto estão sob o bloqueio; Sair e Pular passam.
      expect(await hitsBlock(page, page.locator('[data-tut="press"]'))).toBe(false);
      expect(await hitsBlock(page, page.locator('[data-tut="dust"]'))).toBe(true);
      expect(await hitsBlock(page, page.locator('.ap-hbtn-exit'))).toBe(false);
      expect(await hitsBlock(page, page.getByRole('button', { name: 'Pular tutorial' }))).toBe(
        false,
      );
      // Tocar fora balança o anel e não faz nada no jogo.
      await page.locator('.ap-tut-block').dispatchEvent('pointerdown');
      await expect(page.locator('.ap-tut-ring.is-nudge')).toBeVisible();
      await expect(page.locator('.ap-hudrow b').first()).toHaveText('0');
      await press(page);
      await expect(page.locator('.ap-hudrow b').first()).toHaveText('1');
      await shot(page, '1c-bloqueio');
      expect(errors).toEqual([]);
    });

    test('nos primeiros toques a poeira acende e o botão continua livre', async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors = await watch(page);
      await installApi(page);
      const account = await installSaves(page);
      account.data = saveAt((s) => ({ ...s, run: { ...s.run, clicks: 3, dust: 3, dustLife: 3 } }));
      account.rev = 1;
      await openGame(page, false);
      await expect(page.locator('.ap-tut-ring.is-glow')).toBeVisible();
      await expect(page.locator('.ap-tut-card')).toContainText('Esta é a sua poeira');
      await expect(page.locator('.ap-tut-arrow')).toContainText('Sua poeira');
      expect(await hitsBlock(page, page.locator('[data-tut="press"]'))).toBe(false);
      // O que só acende não responde: o contador de poeira está sob o bloqueio.
      expect(await hitsBlock(page, page.locator('[data-tut="dust"]'))).toBe(true);
      await shot(page, '1d-poeira');
      await noOverflow(page);
      expect(errors).toEqual([]);
    });

    test('na página de Melhorias o único toque livre é o preço da melhoria; o resto da página não responde', async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors = await watch(page);
      await installApi(page);
      const account = await installSaves(page);
      account.data = saveAt(nearUpgrade);
      account.rev = 1;
      await openGame(page, false);
      await press(page);
      await expect(coach(page)).toContainText('Você já pode comprar seu primeiro item.');
      await tapCenter(page, dock(page, 'Melhorias'), touch);
      await expect(page.locator('.ap-sheet')).toBeVisible();
      await expect(page.locator('.ap-tut')).toHaveAttribute('data-blocking', 'true');
      expect(await hitsBlock(page, page.locator('[data-tut="buy-first"]'))).toBe(false);
      expect(await hitsBlock(page, page.locator('.ap-sheet .ap-x'))).toBe(true);
      // Tentar fechar sem comprar não fecha.
      await page.locator('.ap-tut-block').dispatchEvent('pointerdown');
      await expect(page.locator('.ap-sheet')).toBeVisible();
      await tapCenter(page, page.locator('[data-tut="buy-first"]'), touch);
      // Comprou: agora o X é o alvo e fica livre.
      await expect(coach(page)).toContainText('Feche a página e volte a tocar');
      expect(await hitsBlock(page, page.locator('.ap-sheet .ap-x'))).toBe(false);
      await shot(page, '4b-bloqueio-pagina');
      expect(errors).toEqual([]);
    });

    test('jogo livre: com poeira de sobra o cartão de Geradores aponta para Melhorias e abrir a página conta como visto', async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors = await watch(page);
      await installApi(page);
      const account = await installSaves(page);
      account.data = saveAt((s) => ({
        ...s,
        tutorial: TUTORIAL.FREE,
        ui: {
          unlocked: ['upgrades', 'grimoires', 'achievements'],
          hints: ['achievements', 'objects'],
        },
        album: ['moon'],
        run: { ...s.run, picks: 1, build: { moon: 1 }, dust: 1e12, dustLife: 1e12 },
        stats: { ...s.stats, clicks: 300, picks: 1 },
        achievements: ['tap-1', 'tap-100'],
      }));
      account.rev = 1;
      await openGame(page, false);
      await expect(page.locator('.ap-tut-card')).toContainText('Poeira sem tocar');
      await expect(page.locator('.ap-tut-card')).toContainText('Dica');
      expect(await hitsBlock(page, dock(page, 'Melhorias'))).toBe(false);
      expect(await hitsBlock(page, dock(page, 'Conquistas'))).toBe(true);
      await shot(page, '9c-geradores');
      await tapCenter(page, dock(page, 'Melhorias'), touch);
      await expect(page.locator('.ap-sheet')).toBeVisible();
      await expect
        .poll(() => (account.data as unknown as { ui: { hints: string[] } }).ui.hints)
        .toContain('generators');
      expect(errors).toEqual([]);
    });

    test('o colapso é explicado cedo e a meta fica à vista no topo', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors = await watch(page);
      await installApi(page);
      const account = await installSaves(page);
      account.data = saveAt((s) => ({
        ...s,
        tutorial: TUTORIAL.FREE,
        ui: {
          unlocked: ['upgrades', 'grimoires', 'achievements'],
          hints: ['achievements', 'objects'],
        },
        album: ['moon', 'mars'],
        run: { ...s.run, picks: 2, build: { moon: 1, mars: 1 } },
        stats: { ...s.stats, clicks: 300, picks: 2 },
        achievements: ['tap-1', 'tap-100'],
      }));
      account.rev = 1;
      await openGame(page, false);
      await expect(page.locator('.ap-tut-card')).toContainText('O colapso da estrela');
      await expect(page.locator('.ap-tut-card')).toContainText('A sua meta');
      await shot(page, '9-colapso');
      await noOverflow(page);
      await page.getByRole('button', { name: 'Entendi' }).click();
      // O chip de meta abre os requisitos.
      const goal = page.locator('.ap-hudgoal');
      await expect(goal).toBeVisible();
      await tapCenter(page, goal, touch);
      await expect(page.getByRole('dialog', { name: /Sua meta: colapso 1/ })).toBeVisible();
      await expect(page.locator('.ap-reqs li')).toHaveCount(3);
      await shot(page, '9b-meta');
      await noOverflow(page);
      expect(errors).toEqual([]);
    });

    test('a árvore é o último cartão e dispensá-lo conclui o tutorial', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors = await watch(page);
      await installApi(page);
      const account = await installSaves(page);
      account.data = saveAt((s) => ({
        ...s,
        tutorial: TUTORIAL.FREE,
        ui: {
          unlocked: ['upgrades', 'grimoires', 'achievements'],
          hints: ['achievements', 'objects', 'generators', 'collapse'],
        },
        album: ['moon'],
        run: { ...s.run, picks: 1, build: { moon: 1 } },
        stats: { ...s.stats, clicks: 300, picks: 1 },
        achievements: ['tap-1', 'tap-100'],
      }));
      account.rev = 1;
      await openGame(page, false);
      await expect(page.locator('.ap-tut-card')).toContainText('Árvore de Habilidades');
      await expect(page.locator('.ap-tut-card')).toContainText('Cintilas');
      await shot(page, '10-arvore');
      await noOverflow(page);
      await page.getByRole('button', { name: 'Entendi' }).click();
      await expect(coach(page)).toHaveCount(0);
      await expect(page.locator('.ap-tutdone')).toContainText('Tutorial concluído');
      await expect.poll(() => account.data?.tutorial).toBe('done');
      expect(errors).toEqual([]);
    });

    test('história: a última tela mostra livros de grimório, não planetas', async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors = await watch(page);
      await installApi(page);
      await installSaves(page);
      await page.goto('/arcade/aperta');
      await page.getByRole('button', { name: 'Jogar' }).first().click();
      await page.getByRole('button', { name: 'Novo jogo' }).first().click();
      for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.locator('.st-books .ap-book')).toHaveCount(3);
      await expect(page.locator('svg.ap-scene')).toHaveCount(0);
      await shot(page, '0-historia');
      await noOverflow(page);
      await page.getByRole('button', { name: 'Começar' }).click();
      await expect(page.locator('.ap-game')).toBeVisible();
      expect(errors).toEqual([]);
    });

    test('pular libera tudo de uma vez e não volta depois de recarregar', async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'o tamanho vem do describe; um projeto basta');
      const errors = await watch(page);
      await installApi(page);
      const account = await installSaves(page);
      await openGame(page, true);
      await page.getByRole('button', { name: 'Pular tutorial' }).click();
      await expect(coach(page)).toHaveCount(0);
      for (const name of ['Conquistas', 'Grimórios', 'Melhorias'])
        await expect(dock(page, name)).toBeVisible();
      await expect(page.getByRole('button', { name: /Árvore/ })).toBeVisible();
      await shot(page, '11-pulou');
      await noOverflow(page);
      await press(page);
      await expect.poll(() => account.data?.tutorial).toBe('done');
      await page.reload();
      await openGame(page, false);
      await expect(coach(page)).toHaveCount(0);
      await expect(dock(page, 'Grimórios')).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}
