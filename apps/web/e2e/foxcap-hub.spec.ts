import { expect, test } from '@playwright/test';

/** Fox Cap! (spec 049): cada modo offline entra na partida sem trocar de tela; "Como jogar?" abre um popup. */
test.use({ viewport: { width: 1100, height: 700 } });

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await page.goto('/fox-cap');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 1500 })
    .catch(() => undefined);
});

test('Jogar abre a escolha ali mesmo, sem mudar de endereço, e a partida começa', async ({
  page,
}) => {
  await page.getByTestId('foxcap-bola').click();
  await expect(page).toHaveURL(/\/fox-cap$/);
  await page.getByTestId('bola-fmt-2x2').click();
  await page.getByTestId('bola-start').click();
  await expect(page.getByTestId('bola-play')).toBeVisible();
  await expect(page).toHaveURL(/\/fox-cap$/);
});

test('Desmorona! Treino também escolhe e joga ali mesmo', async ({ page }) => {
  await page.getByTestId('foxcap-desmorona').click();
  await expect(page).toHaveURL(/\/fox-cap$/);
  await page.getByTestId('dsm-start').click();
  await expect(page.getByTestId('dsm-play')).toBeVisible();
});

test('Como jogar? abre o popup de cada jogo e fecha com Entendi ou Esc', async ({ page }) => {
  for (const g of ['atravessa', 'desmorona', 'bola']) {
    await page.getByTestId(`help-${g}`).click();
    await expect(page.getByTestId('how-to-play')).toBeVisible();
    await page.getByTestId('htp-ok').click();
    await expect(page.getByTestId('how-to-play')).toBeHidden();
  }
  await page.getByTestId('help-bola').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('how-to-play')).toBeHidden();
});

test('Com amigos mostra Criar sala e Entrar com código na própria tela', async ({ page }) => {
  await page.getByTestId('tab-amigos').click();
  await expect(page.getByTestId('foxcap-friends')).toBeVisible();
  await expect(page.getByLabel(/código da sala/i)).toBeVisible();
  await expect(page).toHaveURL(/\/fox-cap$/);
});

test('Atravessa! Infinito entra na partida sem menu no meio', async ({ page }) => {
  // o pacote do jogo já foi baixado em segundo plano quando o hub abre
  await page.waitForTimeout(2500);
  const seen: string[] = [];
  await page.exposeFunction('__seen', (t: string) => seen.push(t));
  await page.evaluate(() => {
    new MutationObserver(() => {
      if (document.querySelector('.hub-hero, .gh-hero') && location.pathname === '/atravessa')
        (window as unknown as { __seen: (s: string) => void }).__seen('menu');
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await page.getByTestId('foxcap-atravessa').click();
  await expect(page).toHaveURL(/\/atravessa/);
  await expect(page.locator('canvas')).toBeVisible({ timeout: 8000 });
  expect(seen).toEqual([]);
});

test('Fut Fox: Sair da partida fica vermelho ao primeiro toque, pedindo confirmação', async ({
  page,
}) => {
  await page.getByTestId('foxcap-bola').click();
  await page.getByTestId('bola-fmt-2x2').click();
  await page.getByTestId('bola-start').click();
  await expect(page.getByTestId('bola-play')).toBeVisible();
  await page.getByTestId('bola-gear').click();
  const exit = page.getByTestId('bola-menu-exit');
  await exit.click();
  await expect(exit).toHaveCSS('background-color', 'rgb(220, 43, 54)');
  await expect(exit).toContainText('Toque de novo');
});

test('Fut Fox 3 times: empate de dois no topo manda só eles para a prorrogação, com animação', async ({
  page,
}) => {
  await page.getByTestId('foxcap-bola').click();
  await page.getByTestId('bola-fmt-1x1x1').click();
  await page.getByTestId('bola-start').click();
  await expect(page.getByTestId('bola-play')).toBeVisible();
  await page.evaluate(() => {
    const w = (
      window as unknown as { __bola: { scores: number[]; clock: number; durationSec: number } }
    ).__bola;
    w.scores.splice(0, 3, 2, 2, 0);
    w.clock = w.durationSec;
  });
  await expect(page.locator('.bola-ot')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.bola-ot-chip.is-out')).toHaveCount(1);
  await expect(page.locator('.bola-ot-chip.is-stay')).toHaveCount(2);
  // as raposas dos times que ficaram de fora saem do campo (no mundo e na cena)
  const counts = await page.evaluate(() => {
    const w = window as unknown as {
      __bola: { players: unknown[] };
      __bolaScene: { foxes: Map<string, unknown> };
    };
    return { world: w.__bola.players.length, scene: w.__bolaScene.foxes.size };
  });
  expect(counts).toEqual({ world: 2, scene: 2 });
});

test('Fut Fox 4 times: avisos e cartaz ficam abaixo do placar e do tempo, nunca por cima', async ({
  page,
}) => {
  await page.getByTestId('foxcap-bola').click();
  await page.getByTestId('bola-fmt-1x1x1x1').click();
  await page.getByTestId('bola-start').click();
  await expect(page.getByTestId('bola-play')).toBeVisible();
  await page.getByTestId('bola-tips-ok').click();
  await page.evaluate(() => {
    const w = (
      window as unknown as { __bola: { scores: number[]; clock: number; durationSec: number } }
    ).__bola;
    w.scores.splice(0, 4, 1, 1, 1, 1);
    w.clock = w.durationSec;
  });
  await expect(page.locator('.bola-warn, .bola-banner').first()).toBeVisible({ timeout: 10_000 });
  const board = await page.locator('.bola-board').boundingBox();
  for (const sel of ['.bola-warn', '.bola-banner']) {
    const box = await page
      .locator(sel)
      .first()
      .boundingBox()
      .catch(() => null);
    if (box && board) expect(box.y).toBeGreaterThanOrEqual(board.y + board.height - 1);
  }
});

test('menu: Controles e Convidar abrem POR CIMA do menu, nunca atrás', async ({ page }) => {
  await page.getByTestId('foxcap-desmorona').click();
  await page.getByTestId('dsm-start').click();
  await expect(page.getByTestId('dsm-play')).toBeVisible();
  await page
    .getByTestId('game-tips-ok')
    .click({ timeout: 8000 })
    .catch(() => undefined);
  await page.getByTestId('dsm-menu-btn').click();
  await page.getByTestId('dsm-menu-controls').click();
  const onTop = async (sel: string) =>
    page.evaluate((s) => {
      const el = document.querySelector(s) as HTMLElement;
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.x + r.width / 2, r.y + 20);
      return !!at && el.contains(at);
    }, sel);
  await expect(page.locator('.gm-tips.is-modal')).toBeVisible();
  expect(await onTop('.gm-tips.is-modal')).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.gm-tips.is-modal')).toHaveCount(0);
  await page.getByTestId('dsm-menu-invite').click();
  await expect(page.getByTestId('invite-dialog')).toBeVisible();
  expect(await onTop('[data-testid="invite-dialog"] .gm-card')).toBe(true);
});

test('as telas antigas dos jogos não existem mais: os endereços levam ao Fox Cap!', async ({
  page,
}) => {
  for (const url of ['/fox-cap/bola', '/fox-cap/desmorona', '/atravessa']) {
    await page.goto(url);
    await expect(page).toHaveURL(/\/fox-cap$/);
    await expect(page.getByTestId('foxcap-bola')).toBeVisible();
  }
});

test('sair da partida offline volta ao Fox Cap! (e não a uma tela antiga)', async ({ page }) => {
  await page.getByTestId('foxcap-bola').click();
  await page.getByTestId('bola-fmt-2x2').click();
  await page.getByTestId('bola-start').click();
  await expect(page.getByTestId('bola-play')).toBeVisible();
  await page.getByTestId('bola-gear').click();
  await page.getByTestId('bola-menu-exit').click();
  await page.getByTestId('bola-menu-exit').click();
  await expect(page).toHaveURL(/\/fox-cap$/);
  await expect(page.getByTestId('foxcap-bola')).toBeVisible();
});
