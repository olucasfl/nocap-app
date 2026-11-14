import { expect, test, type Page } from '@playwright/test';

/**
 * Mini Golf em sala com DUAS janelas de verdade (spec 082): criar a sala pela tela do Mini Golf, entrar por código, regras,
 * contagem, tacada (a de uma janela aparece na outra), placar no TAB e o pódio quando o líder encerra. Só roda com
 * `E2E_ROOMS=1` (mesmo preparo de foxgp-online.spec.ts):
 *
 *   pnpm --filter api exec esbuild scripts/rooms-only.ts --bundle --platform=node --outfile=/tmp/rooms-only.cjs && node /tmp/rooms-only.cjs
 *   VITE_API_URL=http://localhost:3340 pnpm --filter web exec vite --port 5180 --strictPort
 *   E2E_ROOMS=1 E2E_PORT=5180 pnpm --filter web exec playwright test e2e/golf-online.spec.ts --project=desktop
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

test('duas janelas: sala, tacada replicada, placar e pódio', async ({ browser }) => {
  const mk = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 }, locale: 'pt-BR' });
    const p = await ctx.newPage();
    await p.addInitScript(() => localStorage.setItem('nocap-mute', '1'));
    return p;
  };
  const A = await mk();
  await A.goto('/minigolf');
  await A.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
  await A.getByTestId('mg-online').click();
  await A.getByTestId('mg-create').click();
  await nick(A, 'Ana');
  await A.waitForURL(/\/sala\//);
  const code = A.url().split('/sala/')[1]!.slice(0, 4);

  const B = await mk();
  await B.goto('/minigolf');
  await B.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
  await B.getByTestId('mg-online').click();
  await B.getByTestId('mg-code').fill(code);
  await B.getByRole('button', { name: 'Entrar', exact: true }).click();
  await nick(B, 'Bia');
  await B.waitForURL(/\/sala\//);

  // a sala já nasce com o Mini Golf escolhido, e cada um vê as bolas da sala
  await expect(A.getByTestId('golf-lobby')).toBeVisible({ timeout: 20_000 });
  await expect(B.getByTestId('golf-lobby')).toBeVisible({ timeout: 20_000 });
  await expect(A.getByTestId('golf-lobby').locator('li')).toHaveCount(2);

  // a Bia marca pronto e a Ana começa
  await B.getByRole('button', { name: /estou pronto/i }).first().click();
  await A.getByRole('button', { name: /começar/i }).first().click({ timeout: 20_000 });
  await expect(A.getByTestId('golf-intro')).toBeVisible({ timeout: 20_000 });
  await expect(A.getByTestId('golf-time')).toBeVisible({ timeout: 20_000 });
  await expect(B.getByTestId('golf-time')).toBeVisible({ timeout: 20_000 });

  // a Ana taca (arrastando para trás): as tacadas dela sobem no placar e a Bia vê
  const cv = A.locator('canvas').first();
  const box = (await cv.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await A.mouse.move(x, y);
  await A.mouse.down();
  await A.mouse.move(x, y + 90, { steps: 6 });
  await A.mouse.up();
  await expect(A.getByTestId('golf-strokes')).toContainText('1/16', { timeout: 10_000 });
  await B.keyboard.down('Tab');
  await expect(B.getByTestId('golf-board')).toBeVisible();
  await B.screenshot({ path: 'test-results/golf-board.png' });
  await B.keyboard.up('Tab');
  await A.screenshot({ path: 'test-results/golf-play.png' });

  // o líder encerra pelo placar: pódio nas duas janelas
  await A.getByTestId('golf-board-btn').click();
  await A.getByTestId('golf-end').click();
  await expect(A.getByTestId('golf-final')).toBeVisible({ timeout: 15_000 });
  await expect(B.getByTestId('golf-final')).toBeVisible({ timeout: 15_000 });
});
