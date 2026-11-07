/** Botões do menu do Esc na partida offline e no treino (Counter Fox, spec 057). */
import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';
test('menu da partida: encerrar volta ao menu do Counter Fox, treino tem voltar ao menu e sair vai ao Fox Cap!', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  test.setTimeout(240000);
  await installApi(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/fox-cap/counter-fox');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  // partida offline: Esc -> Encerrar a partida (2 toques) -> menu do Counter Fox
  await page.getByTestId('cfh-play').click();
  await page.getByTestId('cfh-offline').click();
  await page.getByTestId('cfx-start').click();
  await expect(page.getByTestId('fs-ammo')).toBeVisible({ timeout: 90000 });
  await page.getByTestId('fsm-resume').click({ timeout: 2500 }).catch(() => undefined); // a partida já abre jogando
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await page.getByTestId('fsm-end').click();
  await expect(page.getByTestId('fsm-end')).toContainText('confirmar');
  await page.getByTestId('fsm-end').click();
  await expect(page.getByTestId('cfh-main')).toBeVisible({ timeout: 15000 });
  expect(page.url()).toContain('/fox-cap/counter-fox');
  // treino: Esc -> Voltar ao menu do Counter Fox
  await page.getByTestId('cfh-play').click();
  await page.getByTestId('cfh-train').click();
  await expect(page.getByTestId('fs-ammo')).toBeVisible({ timeout: 90000 });
  await page.getByTestId('fsm-resume').click({ timeout: 2500 }).catch(() => undefined); // a partida já abre jogando
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await page.getByTestId('fsm-back').click();
  await expect(page.getByTestId('cfh-main')).toBeVisible({ timeout: 15000 });
  // e "Sair do Counter Fox" leva ao Fox Cap!
  await page.getByTestId('cfh-exit').click();
  await expect(page).toHaveURL(/\/fox-cap$/);
});
