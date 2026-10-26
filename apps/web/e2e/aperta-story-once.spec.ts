import { expect, test } from '@playwright/test';
import { installAccount, midSave } from './aperta-fixtures';

const tutorialDoneSave = midSave;

/** A história inicial só aparece na primeira vez de cada save. */
test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

test('a história não volta ao reentrar no mesmo save', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  const account = await installAccount(page, null);
  await page.goto('/arcade/aperta');
  await page.getByRole('button', { name: 'Jogar' }).first().click();
  await page
    .getByRole('button', { name: /Novo jogo/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Pular história' }).click();
  await page.locator('.ap-game').waitFor();
  // Sai pelo botão Sair e volta pelo mesmo caminho.
  await page.getByRole('button', { name: 'Sair' }).first().click({ force: true });
  await page.locator('.ap-title').waitFor();
  await page.getByRole('button', { name: 'Jogar' }).first().click();
  await page
    .getByRole('button', { name: /Continuar/ })
    .first()
    .click();
  await page.locator('.ap-game').waitFor({ timeout: 8000 });
  await expect(page.locator('.ap-story')).toHaveCount(0);
  expect(account.data?.storySeen).toBe(true);
  // E depois de recarregar a página inteira também.
  await page.reload();
  await page.getByRole('button', { name: 'Jogar' }).first().click();
  await page
    .getByRole('button', { name: /Continuar/ })
    .first()
    .click();
  await page.locator('.ap-game').waitFor({ timeout: 8000 });
  await expect(page.locator('.ap-story')).toHaveCount(0);
});

test('sem internet: só um ícone fica, o aviso some sozinho e a volta da conexão avisa', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await installAccount(page, tutorialDoneSave());
  await page.goto('/arcade/aperta');
  await page.getByRole('button', { name: 'Jogar' }).first().click();
  await page
    .getByRole('button', { name: /Continuar/ })
    .first()
    .click();
  await page.locator('.ap-game').waitFor();
  // Cai a internet: o próximo salvamento falha por rede.
  await page.route(/localhost:3333\/me\/aperta\/saves\/1/, (route) =>
    route.request().method() === 'PUT' ? route.abort('connectionfailed') : route.fallback(),
  );
  await page.getByRole('button', { name: 'Apertar o botão' }).click();
  // Em vez de esperar o salvamento automático, o aparelho "perde o foco" e tenta subir já.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.locator('.ap-net-ic')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.ap-net-toast')).toContainText('Sem conexão');
  // O balão some depois de alguns segundos; o ícone fica.
  await expect(page.locator('.ap-net-toast')).toHaveCount(0, { timeout: 9000 });
  await expect(page.locator('.ap-net-ic')).toBeVisible();
  // Tocar no ícone mostra o aviso de novo.
  await page.locator('.ap-net-ic').click();
  await expect(page.locator('.ap-net-toast')).toBeVisible();
  // A internet volta: avisa, e o ícone sai.
  await page.unroute(/localhost:3333\/me\/aperta\/saves\/1/);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('.ap-net-toast.is-ok')).toContainText('Conexão de volta', {
    timeout: 15_000,
  });
  await expect(page.locator('.ap-net-ic')).toHaveCount(0);
  await expect(page.locator('.ap-net-toast')).toHaveCount(0, { timeout: 8000 });
});
