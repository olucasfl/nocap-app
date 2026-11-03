import { expect, test, type Page } from '@playwright/test';

/** O chat da sala no saguão (mesmo visual do chat da partida). Precisa do servidor de salas: E2E_ROOMS=1 (ver ping-online.spec.ts). */
test.skip(!process.env.E2E_ROOMS, 'precisa do servidor de salas (E2E_ROOMS=1)');
test.beforeEach(({ page: _p }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});

async function nick(page: Page, name: string) {
  await page.getByRole('dialog').locator('input').first().fill(name);
  await page.getByRole('button', { name: 'Entrar na sala' }).click();
}
const skipIntro = (page: Page) =>
  page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 8000 })
    .catch(() => undefined);

test('chat do saguão: mensagem nova aparece ao lado do botão e o painel mostra a conversa', async ({
  browser,
}, info) => {
  const mk = async (w: number, h: number) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'pt-BR' });
    return ctx.newPage();
  };
  const A = await mk(1100, 700);
  await A.goto('/fox-cap');
  await skipIntro(A);
  await A.getByText('Com amigos', { exact: true }).first().click();
  await A.getByTestId('foxcap-friends').click();
  await nick(A, 'Ana');
  await A.waitForURL(/\/sala\//);
  const code = A.url().split('/sala/')[1]!.slice(0, 4);

  const B = await mk(390, 800);
  await B.goto('/fox-cap');
  await skipIntro(B);
  await B.getByText('Com amigos', { exact: true }).first().click();
  await B.getByLabel('Código da sala').fill(code);
  await B.getByRole('button', { name: 'Entrar', exact: true }).click();
  await nick(B, 'Bia');
  await B.waitForURL(/\/sala\//);

  await expect(B.getByTestId('room-chat-btn')).toBeVisible();
  await A.getByTestId('room-chat-btn').click();
  await expect(A.getByTestId('room-chat-panel')).toBeVisible();
  await A.getByLabel('Mensagem').fill('bora jogar');
  await A.getByRole('button', { name: 'Enviar' }).click();
  // fora do painel a mensagem aparece ao lado do botão e o botão mostra o número
  await expect(B.locator('.gc-toast')).toContainText('bora jogar');
  await expect(B.locator('.gc-count')).toHaveText('1');
  await B.screenshot({ path: info.outputPath('b-toast.png') });
  await B.getByTestId('room-chat-btn').click();
  await expect(B.locator('.gc-count')).toHaveCount(0);
  await expect(B.getByTestId('room-chat-panel')).toContainText('bora jogar');
  await B.getByLabel('Mensagem').fill('bora!');
  await B.getByRole('button', { name: 'Enviar' }).click();
  await B.screenshot({ path: info.outputPath('b-panel.png') });
  await A.screenshot({ path: info.outputPath('a-panel.png') });
  await expect(A.getByTestId('room-chat-panel')).toContainText('bora!');
  await B.keyboard.press('Escape');
  await expect(B.getByTestId('room-chat-panel')).toHaveCount(0);
});
