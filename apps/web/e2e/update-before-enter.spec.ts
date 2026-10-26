import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

/** Entrar ou criar sala com versão velha do app: aparece "Atualize antes de entrar"; atualizar recarrega e continua. */
const current = () => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
};

test('com versão velha, criar sala pede para atualizar antes e depois segue', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  let outdated = true;
  await page.route('**/version.json*', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ id: outdated ? 'versao-nova' : current() }),
    }),
  );
  await page.goto('/fox-cap');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 1500 })
    .catch(() => undefined);
  await page.getByTestId('tab-amigos').click();
  await page.getByTestId('foxcap-friends').click();
  await expect(page.getByRole('alertdialog', { name: /atualize antes de entrar/i })).toBeVisible();
  // agora o "servidor" já tem a mesma versão que o app: atualizar recarrega e a entrada continua
  outdated = false;
  const reloaded = page.waitForEvent('load');
  await page.getByTestId('update-before-enter').click();
  await reloaded;
  await expect(page.getByRole('alertdialog', { name: /atualize antes de entrar/i })).toBeHidden();
});

test('com a versão em dia entra sem aviso nenhum', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await page.route('**/version.json*', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: current() }) }),
  );
  await page.goto('/fox-cap');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 1500 })
    .catch(() => undefined);
  await page.getByTestId('tab-amigos').click();
  await page.getByTestId('foxcap-friends').click();
  await expect(page.getByRole('alertdialog', { name: /atualize antes de entrar/i })).toBeHidden();
});
