import { expect, test } from '@playwright/test';

/** Counter Fox só com conta: sem conta aparece o aviso com criar conta, entrar e voltar. */
test('sem conta o Counter Fox pede para criar a conta ou entrar', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/fox-cap/counter-fox');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await expect(page.getByTestId('cfh-gate')).toBeVisible();
  await expect(page.getByTestId('cfh-play')).toHaveCount(0);
  await page.waitForTimeout(900);
  if (process.env.FS_SHOTS) await page.screenshot({ path: `${process.env.FS_SHOTS}/cfx-gate.png` });
  await page.getByTestId('cfh-gate-register').click();
  await expect(page).toHaveURL(/\/criar-conta$/);
  await page.goBack();
  await page.getByTestId('cfh-gate-login').click();
  await expect(page).toHaveURL(/\/entrar$/);
});
