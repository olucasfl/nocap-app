import { expect, test } from '@playwright/test';
import { loginAs } from './account';

/** Counter Fox online no celular (toque): botões, joystick e modo Bomba. Precisa de `E2E_ROOMS=1` (preparo de foxshot-online.spec.ts). */
test.skip(!process.env.E2E_ROOMS, 'precisa do servidor de salas (E2E_ROOMS=1)');
test.beforeEach(({ page: _page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});
test.setTimeout(240_000);

test('celular entra na partida Bomba online e vê os botões de toque', async ({ browser }) => {
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'pt-BR' });
  const ana = await dctx.newPage();
  await loginAs(ana, 'Ana');
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: 'pt-BR' });
  const bia = await mctx.newPage();
  await loginAs(bia, 'Bia');

  await ana.goto('/fox-cap/counter-fox');
  await ana.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await ana.getByTestId('cfh-play').click();
  await ana.getByTestId('cfh-online').click();
  await ana.getByTestId('cfh-create').click();
  await expect(ana.getByTestId('cfl')).toBeVisible({ timeout: 30_000 });
  const code = (await ana.getByTestId('cfl-code').locator('b').textContent())!.trim();

  await bia.goto('/fox-cap/counter-fox');
  await bia.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await bia.getByTestId('cfh-play').tap();
  await bia.getByTestId('cfh-online').tap();
  await bia.getByTestId('cfh-code').fill(code);
  await bia.getByTestId('cfh-join').tap();
  await expect(bia.getByTestId('cfl')).toBeVisible({ timeout: 30_000 });

  await ana.getByTestId('cfl-tab-modo').click();
  await ana.getByTestId('cfl-mode-bomb').click();
  await ana.getByTestId('cfl-botsct-1').click();
  await ana.getByTestId('cfl-botstr-1').click();
  await bia.screenshot({ path: `${process.env.FS_SHOTS ?? '/tmp'}/toque-lobby.png` });
  await bia.getByTestId('cfl-ready').tap();
  await expect(ana.getByTestId('cfl-start')).toBeEnabled({ timeout: 10_000 });
  await ana.getByTestId('cfl-start').click();
  await expect(bia.getByTestId('fb-hud')).toBeVisible({ timeout: 60_000 });
  // celular: o menu abre primeiro (sem trava de mouse); continuar mostra os botões
  const resume = bia.getByTestId('fsm-resume');
  if (await resume.isVisible().catch(() => false)) await resume.tap();
  await expect(bia.getByTestId('fs-tb-use')).toBeVisible({ timeout: 20_000 });
  await expect(bia.getByTestId('fs-menubtn')).toBeVisible();
  await expect(bia.getByTestId('fs-rotate')).toHaveCount(0);
  await bia.screenshot({ path: `${process.env.FS_SHOTS ?? '/tmp'}/toque-jogo.png` });
});
