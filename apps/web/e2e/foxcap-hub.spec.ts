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
