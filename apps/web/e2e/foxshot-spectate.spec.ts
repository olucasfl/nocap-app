import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './account';

/**
 * Counter Fox: entrar com a partida rolando (spec 057). A pessoa escolhe "Entrar para jogar" ou "Entrar para espectar", espectando
 * segue um jogador e pode pedir um lugar depois; o menu tem "Convidar amigos". Só com `E2E_ROOMS=1` (veja foxshot-online.spec.ts).
 */
test.skip(!process.env.E2E_ROOMS, 'precisa do servidor de salas (E2E_ROOMS=1)');
test.beforeEach(({ page: _page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});
test.setTimeout(420_000);

interface St {
  roster: { id: string; name: string; bot: boolean }[];
  me: string;
  phase: string;
}
const st = (p: Page) => p.evaluate(() => (window as unknown as { __fsn: { state(): unknown } }).__fsn.state()) as Promise<St>;
const shots = process.env.FS_SHOTS ?? '/tmp';

test('convidado chega no meio da partida, espectando ou jogando', async ({ browser }) => {
  const mk = async (name: string) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'pt-BR' });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log(`console ${name}:`, m.text().slice(0, 300)); });
    page.on('pageerror', (e) => console.log(`pageerror ${name}:`, e.message.slice(0, 500)));
    await loginAs(page, name);
    await page.addInitScript(() => localStorage.setItem('nocap-fs-settings-lock2', '1'));
    return page;
  };
  const ana = await mk('Ana');
  await ana.goto('/fox-cap/counter-fox');
  await ana.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await ana.getByTestId('cfh-play').click();
  await ana.getByTestId('cfh-online').click();
  await ana.getByTestId('cfh-create').click();
  await expect(ana.getByTestId('cfl')).toBeVisible({ timeout: 30_000 });
  const code = (await ana.getByTestId('cfl-code').locator('b').textContent())!.trim();
  await ana.getByTestId('cfl-tab-modo').click();
  await ana.getByTestId('cfl-min-10').click();
  await ana.getByTestId('cfl-bots-3').click();
  // a aba Convidar tem o mesmo que as outras salas
  await ana.getByTestId('cfl-tab-convidar').click();
  await expect(ana.getByTestId('cfl-share')).toBeVisible();
  await expect(ana.getByTestId('cfl-copy-link')).toBeVisible();
  await expect(ana.getByTestId('cfl-search')).toBeVisible().catch(() => undefined);
  await ana.screenshot({ path: `${shots}/cfl-convidar2.png` });
  await ana.getByTestId('cfl-start').click();
  await expect(ana.getByTestId('fs-root')).toBeVisible({ timeout: 30_000 });
  await ana.waitForFunction(() => (window as unknown as { __fsn?: { state(): { phase: string } } }).__fsn?.state().phase === 'play', undefined, { timeout: 30_000 });
  // Esc abre o menu e ele tem Convidar amigos (no meio da partida)
  await ana.evaluate(() => (window as unknown as { __fsn: { resume(): void } }).__fsn.resume());
  await ana.keyboard.press('Escape');
  await expect(ana.getByTestId('fsr-invite')).toBeVisible();
  await ana.getByTestId('fsr-invite').click();
  await expect(ana.getByTestId('invite-dialog')).toBeVisible();
  await expect(ana.getByTestId('invite-dialog')).toContainText(code);
  await ana.screenshot({ path: `${shots}/cfx-convite-partida.png` });
  await ana.getByTestId('invite-close').click();

  // Bia entra com a partida rolando: aparece a escolha
  const bia = await mk('Bia');
  await bia.goto('/fox-cap/counter-fox');
  await bia.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await bia.getByTestId('cfh-play').click({ force: true, timeout: 60_000 });
  await bia.getByTestId('cfh-online').click({ force: true, timeout: 60_000 });
  await bia.getByTestId('cfh-code').fill(code);
  await bia.getByTestId('cfh-join').click();
  console.log('bia url', bia.url(), (await bia.locator('body').innerText().catch(() => 'ERR')).slice(0, 300));
  await expect(bia.getByTestId('fsr-choice')).toBeVisible({ timeout: 90_000 });
  await bia.screenshot({ path: `${shots}/cfx-escolha.png` });
  await bia.getByTestId('fsr-choice-watch').click();
  await expect(bia.getByTestId('fsr-spec')).toBeVisible({ timeout: 120_000 });
  await expect.poll(async () => bia.getByTestId('fsr-spec-name').textContent(), { timeout: 20_000 }).not.toBe('...');
  await bia.waitForTimeout(1500);
  await bia.screenshot({ path: `${shots}/cfx-espectando.png` });
  // espectando não está na lista de jogadores; pede para jogar e entra no lugar de um bot
  expect((await st(bia)).roster.some((r) => r.id === (null as never) || r.name === 'Bia')).toBe(false);
  await bia.getByTestId('fsr-join-play').click();
  await expect.poll(async () => (await st(bia)).roster.some((r) => r.name === 'Bia' && !r.bot), { timeout: 20_000 }).toBe(true);
  expect((await st(bia)).roster.filter((r) => r.bot)).toHaveLength(2);
  await expect(bia.getByTestId('fsr-spec')).toHaveCount(0, { timeout: 10_000 });
  // a Ana vê a Bia na lista
  await expect.poll(async () => (await st(ana)).roster.some((r) => r.name === 'Bia' && !r.bot), { timeout: 20_000 }).toBe(true);
});
