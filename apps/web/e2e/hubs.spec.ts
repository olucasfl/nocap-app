import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';

/** Hubs da Mesmíssima, do Já Deu?, do Ecooo e do Block's (specs 066 e 067): menu, modos, amigos, regras, configurações e jogar. */
const HUBS = [
  { name: 'Mesmíssima', url: '/cor', game: 'color', mode: 'classic' },
  { name: 'Já Deu?', url: '/tempo', game: 'time', mode: 'classic' },
  { name: 'Ecooo', url: '/eco', game: 'eco', mode: 'classic' },
] as const;

for (const h of HUBS) {
  test(`hub ${h.name}`, async ({ page }) => {
    await installApi(page);
    await page.goto(h.url);
    await page
      .getByRole('button', { name: 'Agora não' })
      .click({ timeout: 800 })
      .catch(() => undefined);
    await expect(page.getByTestId(`wl-${h.game}`)).toBeVisible();
    await expect(page.getByTestId('menu-daily')).toContainText(/disponível hoje/i);
    // modos -> um modo -> voltar
    await page.getByTestId('menu-modes').click();
    await expect(page.getByTestId(`mode-${h.mode}`)).toBeVisible();
    await page.getByTestId(`mode-${h.mode}`).click();
    await expect(page.getByTestId(`mode-panel-${h.mode}`)).toBeVisible();
    await page.getByTestId('wl-back').click();
    await expect(page.getByTestId('modes-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('wl-main')).toBeVisible();
    // amigos, regras e configurações
    await page.getByTestId('menu-friends').click();
    await expect(page.getByTestId('friends-create')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('menu-rules').click();
    await expect(page.getByTestId('rules')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('menu-settings').click();
    await expect(page.getByTestId('wl-settings')).toContainText('Som do jogo');
    await page.keyboard.press('Escape');
    // Daily é uma tela do próprio hub: estado de hoje, contador e abas do dia
    await page.getByTestId('menu-daily').click();
    await expect(page.getByTestId('daily-panel')).toBeVisible();
    await expect(page.getByTestId('daily-todo')).toBeVisible();
    await expect(page.getByTestId('daily-countdown')).toContainText(/FALTA \d\d:\d\d:\d\d/);
    await expect(page.getByTestId('play-daily')).toBeVisible();
    await page.getByTestId('daily-tab-ranking').click();
    await page.getByTestId('daily-tab-rules').click();
    await page.getByTestId('wl-back').click();
    await expect(page.getByTestId(`wl-${h.game}`)).toBeVisible();
    // jogar sai do hub
    await page.getByTestId('menu-modes').click();
    await page.getByTestId(`mode-${h.mode}`).click();
    await page.getByTestId(`play-${h.mode}`).click();
    await expect(page.getByTestId(`wl-${h.game}`)).toHaveCount(0, { timeout: 10_000 });
  });
}

test("hub Block's: os dois jogos e o voltar para o início", async ({ page }) => {
  await installApi(page);
  await page.goto('/blocks');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 800 })
    .catch(() => undefined);
  await expect(page.getByTestId('mode-classic')).toBeVisible();
  await expect(page.getByTestId('mode-towers')).toBeVisible();
  await page.getByTestId('mode-towers').click();
  await expect(page.getByTestId('play-towers')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTestId('wl-exit').click();
  await expect(page).toHaveURL('/');
});
