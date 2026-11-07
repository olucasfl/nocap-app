import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';

/** O comando da bomba (plantar/desarmar/pegar) é separado e pode ser trocado; tecla repetida avisa o conflito. */
test('Comandos: bomba tem tecla própria, troca e avisa conflito', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await page.setViewportSize({ width: 1280, height: 720 });
  await installApi(page);
  await page.addInitScript(() => localStorage.setItem('nocap-fs-settings', JSON.stringify({ binds: { drop: 'KeyE' } })));
  await page.goto('/fox-cap/counter-fox');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
  await page.getByTestId('cfh-opt').click();
  await page.getByTestId('cfh-tab-keys').click();
  await page.getByTestId('bind-bomb').scrollIntoViewIfNeeded();
  // "Largar a arma" também está no E: a bomba mostra o conflito (pegar do chão não conta)
  await expect(page.getByTestId('conflict-bomb')).toContainText('Largar a arma');
  await expect(page.getByTestId('conflict-bomb')).not.toContainText('Pegar do chão');
  await page.getByTestId('bind-bomb').click();
  await page.keyboard.press('KeyX');
  await expect(page.getByTestId('bind-bomb')).toContainText('X');
  await expect(page.getByTestId('conflict-bomb')).toHaveCount(0);
});
