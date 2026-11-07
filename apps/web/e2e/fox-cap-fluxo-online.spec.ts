import { expect, test } from '@playwright/test';
import { loginAs } from './account';

/**
 * Fluxo ONLINE de cada jogo do Fox Cap! (spec 058): tela do jogo > Jogar com amigos > Criar sala > a sala já nasce com o jogo e o
 * tema dele > Sair da sala volta para a tela do jogo (e não para a lista). Precisa de `E2E_ROOMS=1` (preparo de foxshot-online.spec.ts).
 */
test.skip(!process.env.E2E_ROOMS, 'precisa do servidor de salas (E2E_ROOMS=1)');
test.beforeEach(({ page: _page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});
test.setTimeout(120_000);

for (const game of ['atravessa', 'bola', 'pingpong', 'desmorona'] as const) {
  test(`${game}: criar sala pela tela do jogo, sala temática do jogo e sair volta para a tela do jogo`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await loginAs(page, `Fluxo${game}`);
    await page.goto('/fox-cap');
    await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
    await page.getByTestId(`foxcap-${game}`).click();
    await page.getByTestId('gl-friends').click();
    await expect(page.getByTestId('gl-friends-panel')).toBeVisible();
    await page.getByTestId('foxcap-friends').click();
    // a sala nasce com o jogo desta tela escolhido e com o tema dele
    const lobby = page.getByTestId('themed-lobby');
    await expect(lobby).toBeVisible({ timeout: 60_000 });
    await expect(lobby).toHaveAttribute('data-game', game, { timeout: 30_000 });
    // sair da sala volta para a tela do jogo
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page.getByTestId(`gl-${game}`)).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`jogo=${game}`));
  });
}

test('entrar com código inválido mostra o erro na própria tela do jogo', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await loginAs(page, 'FluxoCodigo');
  await page.goto('/fox-cap');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
  await page.getByTestId('foxcap-pingpong').click();
  await page.getByTestId('gl-friends').click();
  await page.getByTestId('gl-code').fill('ZZZZ');
  await page.getByTestId('gl-join').click();
  await expect(page.getByTestId('gl-error')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('gl-friends-panel')).toBeVisible();
});
