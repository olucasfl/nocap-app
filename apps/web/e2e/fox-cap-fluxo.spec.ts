import { expect, test, type Page } from '@playwright/test';

/**
 * Fluxo de entrada e saída de cada jogo do Fox Cap! (spec 058): a lista abre a TELA DO JOGO; jogar offline entra na partida;
 * sair da partida (menu > Sair) volta para a tela do jogo; só "Sair do ..." nessa tela volta para a lista.
 */
test.use({ viewport: { width: 1280, height: 720 } });
test.setTimeout(240_000);

async function open(page: Page, game: string) {
  await page.goto('/fox-cap');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
  await page.getByTestId(`foxcap-${game}`).click();
  await expect(page.getByTestId(`gl-${game}`)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`jogo=${game}`));
}

async function exitFromMenu(page: Page, prefix: string, btn: string) {
  await page.getByTestId('game-tips-ok').click({ timeout: 2500 }).catch(() => undefined);
  await page.getByTestId(btn).click();
  const exit = page.getByTestId(`${prefix}-exit`);
  await exit.click();
  await exit.click(); // pede para tocar de novo
}

async function backToHubThenList(page: Page, game: string) {
  // voltou para a TELA DO JOGO (não para a lista com todos os jogos)
  await expect(page.getByTestId(`gl-${game}`)).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(new RegExp(`jogo=${game}`));
  await expect(page.getByTestId('gl-offline')).toBeVisible();
  // só o "Sair do jogo" da tela do jogo leva para a lista
  await page.getByTestId('gl-exit').click();
  await expect(page.getByTestId(`gl-${game}`)).toHaveCount(0);
  await expect(page.getByTestId(`foxcap-${game}`)).toBeVisible();
  await expect(page).not.toHaveURL(/jogo=/);
}

test('Atravessa!: lista > tela do jogo > partida > sair da partida volta para a tela do jogo > Sair vai para a lista', async ({ page }) => {
  await open(page, 'atravessa');
  await page.getByTestId('gl-offline').click();
  await expect(page).toHaveURL(/\/atravessa/);
  await expect(page.getByTestId('atr-menu-btn')).toBeVisible({ timeout: 60_000 });
  await exitFromMenu(page, 'atr-menu', 'atr-menu-btn');
  await backToHubThenList(page, 'atravessa');
});

test('Ping Fox!: partida offline e volta para a tela do jogo', async ({ page }) => {
  await open(page, 'pingpong');
  await page.getByTestId('gl-offline').click();
  await page.getByTestId('png-level-medio').click();
  await page.getByTestId('png-start').click();
  await expect(page.getByTestId('png-play')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2600);
  await exitFromMenu(page, 'png-menu', 'png-menu-btn');
  await backToHubThenList(page, 'pingpong');
});

test('Desmorona!: partida offline e volta para a tela do jogo', async ({ page }) => {
  await open(page, 'desmorona');
  await page.getByTestId('gl-offline').click();
  await page.getByRole('radio', { name: '3' }).click();
  await page.getByTestId('dsm-start').click();
  await expect(page.getByTestId('dsm-play')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(3000);
  await exitFromMenu(page, 'dsm-menu', 'dsm-menu-btn');
  await backToHubThenList(page, 'desmorona');
});

test('Fut Fox: partida offline e volta para a tela do jogo', async ({ page }) => {
  await open(page, 'bola');
  await page.getByTestId('gl-offline').click();
  await page.getByTestId('bola-fmt-2x2').click();
  await page.getByTestId('bola-start').click();
  await expect(page.getByTestId('bola-play')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(3000);
  await exitFromMenu(page, 'bola-menu', 'bola-gear');
  await backToHubThenList(page, 'bola');
});

test('cancelar a escolha da partida volta para a tela do jogo, e o Esc na tela do jogo volta para a lista', async ({ page }) => {
  await open(page, 'bola');
  await page.getByTestId('gl-offline').click();
  await page.getByRole('button', { name: /cancelar|voltar/i }).first().click();
  await expect(page.getByTestId('gl-bola')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('gl-bola')).toHaveCount(0);
});
