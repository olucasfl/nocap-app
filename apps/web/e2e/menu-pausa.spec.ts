import { expect, test, type Page } from '@playwright/test';

/**
 * O menu (Esc) e a pausa do líder nos 4 jogos do Fox Cap! em sala: mesmo menu, "Pausar o jogo" só para o líder, todo
 * mundo vê o véu, despausar volta com contagem de 3 s, e "Encerrar a sala" é o último botão. Precisa do servidor de salas
 * (E2E_ROOMS=1, ver ping-online.spec.ts).
 */
test.skip(!process.env.E2E_ROOMS, 'precisa do servidor de salas (E2E_ROOMS=1)');
test.beforeEach(({ page: _p }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});
test.setTimeout(150_000);

const GAMES = ['pingpong', 'desmorona', 'atravessa', 'bola'] as const;

async function nick(page: Page, name: string) {
  await page.getByRole('dialog').locator('input').first().fill(name);
  await page.getByRole('button', { name: 'Entrar na sala' }).click();
}
const intro = (page: Page) =>
  page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 6000 })
    .catch(() => undefined);

for (const game of GAMES) {
  test(`${game}: Esc abre e fecha o menu; o líder pausa e despausa`, async ({ browser }) => {
    const mk = async () => {
      const ctx = await browser.newContext({
        viewport: { width: 1100, height: 700 },
        locale: 'pt-BR',
      });
      return ctx.newPage();
    };
    const A = await mk();
    await A.goto('/fox-cap');
    await intro(A);
    await A.getByText('Com amigos', { exact: true }).first().click();
    await A.getByTestId('foxcap-friends').click();
    await nick(A, 'Ana');
    await A.waitForURL(/\/sala\//);
    const code = A.url().split('/sala/')[1]!.slice(0, 4);
    const B = await mk();
    await B.goto('/fox-cap');
    await intro(B);
    await B.getByText('Com amigos', { exact: true }).first().click();
    await B.getByLabel('Código da sala').fill(code);
    await B.getByRole('button', { name: 'Entrar', exact: true }).click();
    await nick(B, 'Bia');
    await B.waitForURL(/\/sala\//);

    await A.getByRole('tab', { name: /Regras/i }).click();
    await A.getByTestId(`pick-${game}`).click();
    if (game === 'atravessa' || game === 'desmorona') {
      // nesses dois cada raposa precisa de uma cor para ficar pronta
      await A.getByRole('tab', { name: /Jogadores/i }).click();
      await A.getByRole('radio').first().click();
      await B.getByRole('radio').last().click();
    }
    await B.getByRole('button', { name: /ESTOU PRONTO/i }).click({ timeout: 15_000 });
    await expect(A.getByRole('button', { name: /COMEÇAR/i })).toBeEnabled({ timeout: 15_000 });
    await A.getByRole('button', { name: /COMEÇAR/i }).click();
    // dicas de controle (se aparecerem) e a largada
    for (const p of [A, B]) {
      await p
        .getByTestId('game-tips-ok')
        .click({ timeout: 25_000 })
        .catch(() => undefined);
    }
    await A.waitForTimeout(6000);

    const menu = (p: Page) => p.locator('[data-testid$="-menu"]');
    // Esc abre; Esc de novo fecha (e não reabre)
    await A.keyboard.press('Escape');
    await expect(menu(A)).toBeVisible();
    await A.keyboard.press('Escape');
    await expect(menu(A)).toHaveCount(0);
    await A.waitForTimeout(400);
    await expect(menu(A)).toHaveCount(0);

    // quem não é líder não vê pausar nem encerrar a sala
    await B.keyboard.press('Escape');
    await expect(menu(B)).toBeVisible();
    await expect(B.locator('[data-testid$="-pause"]')).toHaveCount(0);
    await expect(B.locator('[data-testid$="-close-room"]')).toHaveCount(0);
    await B.keyboard.press('Escape');
    await expect(menu(B)).toHaveCount(0);

    // o líder: pausar, depois sair e encerrar a sala por último
    await A.keyboard.press('Escape');
    const items = await menu(A).locator('button').allInnerTexts();
    const last = items[items.length - 1] ?? '';
    expect(last).toMatch(/Encerrar a sala/i);
    expect(items[items.length - 2] ?? '').toMatch(/Sair/i);
    await A.locator('[data-testid$="-pause"]').click();
    await expect(A.getByTestId('pause-overlay')).toBeVisible();
    await expect(B.getByTestId('pause-overlay')).toBeVisible();
    await expect(B.getByTestId('pause-resume')).toHaveCount(0);
    await expect(A.getByTestId('pause-resume')).toBeVisible();
    await A.screenshot({ path: test.info().outputPath(`${game}-pausado.png`) });
    await B.waitForTimeout(1500);

    await A.getByTestId('pause-resume').click();
    await expect(B.getByTestId('pause-count')).toBeVisible({ timeout: 3000 });
    await B.screenshot({ path: test.info().outputPath(`${game}-contagem.png`) });
    await expect(A.getByTestId('pause-overlay')).toHaveCount(0, { timeout: 6000 });
    await expect(B.getByTestId('pause-overlay')).toHaveCount(0, { timeout: 6000 });
  });
}
