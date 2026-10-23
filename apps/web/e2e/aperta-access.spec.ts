import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/** O Aperta! está em teste: só a conta que o servidor libera vê o cartão e entra na rota. */
async function answer(page: Page, allowed: boolean) {
  await page.route(/localhost:3333\/me\/aperta\/access/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
      body: JSON.stringify({ allowed }),
    }),
  );
}

test.describe('Aperta! liberado só para uma conta', () => {
  test.beforeEach(({ browserName }, info) => {
    test.skip(info.project.name !== 'desktop' || browserName !== 'chromium', 'um projeto basta');
  });

  test('conta liberada vê o cartão no Hub e abre a rota', async ({ page }) => {
    await installApi(page);
    await answer(page, true);
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Aperta!/ })).toBeVisible();
    await page.goto('/arcade/aperta');
    await expect(page.locator('main.ap')).toBeVisible();
    await expect(page).toHaveURL(/\/arcade\/aperta$/);
  });

  test('outra conta não vê o cartão e a rota volta para o início', async ({ page }) => {
    await installApi(page);
    await answer(page, false);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Arcade/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Aperta!/ })).toHaveCount(0);
    await page.goto('/arcade/aperta');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.hub-card-aperta')).toHaveCount(0);
  });

  test('visitante (sem conta) não vê o cartão nem entra na rota', async ({ page }) => {
    await page.route(/localhost:3333/, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
        body: JSON.stringify({ message: 'Entre na sua conta' }),
      }),
    );
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Arcade/ })).toBeVisible();
    await expect(page.locator('.hub-card-aperta')).toHaveCount(0);
    await page.goto('/arcade/aperta');
    await expect(page).toHaveURL(/\/$/);
  });
});
