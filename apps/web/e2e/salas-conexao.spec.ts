import { expect, test, type Page } from '@playwright/test';

/**
 * Conexão das salas com DUAS janelas de verdade: a conexão cai e volta sozinha, e sair da sala não puxa de volta.
 * Só roda com o servidor de salas (`E2E_ROOMS=1`; veja `ping-online.spec.ts` para subir os dois).
 */
test.skip(!process.env.E2E_ROOMS, 'precisa do servidor de salas (E2E_ROOMS=1)');
test.beforeEach(({ page: _page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});
test.setTimeout(120_000);

async function nick(page: Page, name: string) {
  await page.getByRole('dialog').locator('input').first().fill(name);
  await page.getByRole('button', { name: 'Entrar na sala' }).click();
}

async function open(page: Page) {
  await page.goto('/fox-cap');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 8000 })
    .catch(() => undefined);
  await page.getByText('Com amigos', { exact: true }).first().click();
}

async function twoInRoom(browser: import('@playwright/test').Browser) {
  const mk = async () =>
    (
      await browser.newContext({ viewport: { width: 1100, height: 700 }, locale: 'pt-BR' })
    ).newPage();
  const A = await mk();
  await open(A);
  await A.getByTestId('foxcap-friends').click();
  await nick(A, 'Ana');
  await A.waitForURL(/\/sala\//);
  const code = A.url().split('/sala/')[1]!.slice(0, 4);
  const B = await mk();
  await open(B);
  await B.getByLabel('Código da sala').fill(code);
  await B.getByRole('button', { name: 'Entrar', exact: true }).click();
  await nick(B, 'Bia');
  await B.waitForURL(/\/sala\//);
  return { A, B, code };
}

const status = (p: Page) =>
  p.evaluate(
    () =>
      (
        window as unknown as { __room: { getState(): { status: string; snapshot: unknown } } }
      ).__room.getState().status,
  );

test('a conexão cai no meio e volta sozinha, para quem caiu e para os outros', async ({
  browser,
}) => {
  const { A, B } = await twoInRoom(browser);
  await expect(A.getByText('@Bia').or(A.getByText('Bia')).first()).toBeVisible();
  for (let round = 0; round < 3; round++) {
    await B.evaluate(() => (window as unknown as { __dropRoom: () => void }).__dropRoom());
    // volta sem ninguém fazer nada (nem recarregar)
    await expect.poll(() => status(B), { timeout: 20_000 }).toBe('connected');
    await expect(B.getByText('RECONECTANDO À SALA...')).toHaveCount(0);
    await expect(B.getByText('Ana').first()).toBeVisible();
  }
  // e a Ana continua vendo a Bia, e a sala segue funcionando (a Bia marca pronto e a Ana vê)
  await expect(A.getByText('Bia').first()).toBeVisible();
  await A.getByRole('tab', { name: /Outros jogos/i }).click();
  await A.getByTestId('pick-pingpong').click();
  await B.getByRole('button', { name: /ESTOU PRONTO/i }).click();
  await expect(A.getByRole('button', { name: /COMEÇAR/i })).toBeEnabled({ timeout: 10_000 });
});

test('sair da sala leva para fora e não puxa de volta', async ({ browser }) => {
  const { A, B, code } = await twoInRoom(browser);
  await B.getByRole('button', { name: /sair/i }).first().click();
  await B.waitForURL(/\/fox-cap/, { timeout: 15_000 });
  // fica fora: nem volta sozinha para a sala, nem o aviso "você está em uma sala" aparece
  await B.waitForTimeout(6000);
  expect(B.url()).toContain('/fox-cap');
  expect(await status(B)).not.toBe('connected');
  await expect(B.getByText('VOCÊ ESTÁ EM UMA SALA')).toHaveCount(0);
  await expect(B.getByText('SUA SALA CONTINUA ABERTA')).toHaveCount(0);
  // quem fica na sala vê a saída
  await expect(A.getByText('Bia')).toHaveCount(0, { timeout: 10_000 });
  void code;
});
