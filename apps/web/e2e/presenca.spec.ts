import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';

/** Presença em tempo real: o app diz onde a pessoa está e os amigos veem "online · jogando X". */
test.beforeEach(({ page: _p }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});

test('o batimento leva o que a pessoa está fazendo e muda ao trocar de tela', async ({ page }) => {
  await installApi(page);
  const bodies: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/me/ping') && r.method() === 'POST') bodies.push(r.postData() ?? '');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
  await expect.poll(() => bodies.some((b) => b.includes('"menu"')), { timeout: 8000 }).toBe(true);
  await page.goto('/cor');
  await expect
    .poll(() => bodies.some((b) => b.includes('"game"') && b.includes('"color"')), { timeout: 8000 })
    .toBe(true);
  await page.goto('/fox-cap?jogo=foxgp');
  await expect.poll(() => bodies.some((b) => b.includes('"foxgp"')), { timeout: 8000 }).toBe(true);
});

test('a lista de amigos mostra online e o que cada um está fazendo', async ({ page }) => {
  await installApi(page);
  await page.goto('/amigos');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
  await page.getByRole('tab', { name: /^Amigos/ }).click();
  await expect(page.getByText('ONLINE · JOGANDO FOX GP')).toBeVisible();
  await expect(page.getByText('ONLINE · NUMA SALA')).toBeVisible();
});

test('o painel de amigos online do início mostra o que cada um está fazendo', async ({ page }) => {
  await installApi(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
  const list = page.getByTestId('hub-online');
  await expect(list).toContainText('online · jogando Fox GP');
  await expect(list).toContainText('online · numa sala');
});
