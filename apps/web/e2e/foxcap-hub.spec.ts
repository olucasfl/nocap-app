import { expect, test } from '@playwright/test';

/** Fox Cap! (spec 049): a aba Offline abre cada modo direto e a aba Com amigos leva à sala sem jogo escolhido. */
test.use({ viewport: { width: 1100, height: 700 } });

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await page.goto('/fox-cap');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 1500 })
    .catch(() => undefined);
});

test('a aba Offline lista os modos e cada um abre direto', async ({ page }) => {
  await expect(page.getByTestId('foxcap-atravessa')).toBeVisible();
  await expect(page.getByTestId('foxcap-desmorona')).toBeVisible();
  await expect(page.getByTestId('foxcap-bola')).toBeVisible();
  await page.getByTestId('foxcap-bola').click();
  await expect(page.getByTestId('bola-fmt-2x2')).toBeVisible();
  await page.goBack();
  await page.getByTestId('foxcap-desmorona').click();
  await expect(page.getByTestId('dsm-start')).toBeVisible();
});

test('a aba Com amigos leva à criação de sala do Fox Cap!', async ({ page }) => {
  await page.getByTestId('tab-amigos').click();
  await page.getByTestId('foxcap-friends').click();
  await expect(page).toHaveURL(/\/sala\?jogo=foxcap/);
  await expect(page.getByRole('button', { name: /Criar sala de Fox Cap!/i })).toBeVisible();
});
