import { expect, test } from '@playwright/test';
import { installAccount } from './aperta-fixtures';

/** A história inicial só aparece na primeira vez de cada save. */
test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

test('a história não volta ao reentrar no mesmo save', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  const account = await installAccount(page, null);
  await page.goto('/arcade/aperta');
  await page.getByRole('button', { name: 'Jogar' }).first().click();
  await page.getByRole('button', { name: /Novo jogo/ }).first().click();
  await page.getByRole('button', { name: 'Pular história' }).click();
  await page.locator('.ap-game').waitFor();
  // Sai pelo botão Sair e volta pelo mesmo caminho.
  await page.getByRole('button', { name: 'Sair' }).first().click({ force: true });
  await page.locator('.ap-title').waitFor();
  await page.getByRole('button', { name: 'Jogar' }).first().click();
  await page.getByRole('button', { name: /Continuar/ }).first().click();
  await page.locator('.ap-game').waitFor({ timeout: 8000 });
  await expect(page.locator('.ap-story')).toHaveCount(0);
  expect(account.data?.storySeen).toBe(true);
  // E depois de recarregar a página inteira também.
  await page.reload();
  await page.getByRole('button', { name: 'Jogar' }).first().click();
  await page.getByRole('button', { name: /Continuar/ }).first().click();
  await page.locator('.ap-game').waitFor({ timeout: 8000 });
  await expect(page.locator('.ap-story')).toHaveCount(0);
});
