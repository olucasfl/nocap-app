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
    // ranking do hub: um quadro por modo e a minha posição
    await page.getByTestId('menu-ranking').click();
    await expect(page.getByTestId('hub-ranking')).toBeVisible();
    await expect(page.getByTestId('hub-ranking')).toContainText('@ana');
    await expect(page.getByTestId('hub-ranking')).toContainText('@lucas');
    await page.getByTestId('rank-period-week').click();
    await page.getByTestId('wl-back').click();
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
  await page.getByTestId('menu-play').click();
  await expect(page.getByTestId('mode-classic')).toBeVisible();
  await expect(page.getByTestId('mode-towers')).toBeVisible();
  await page.getByTestId('mode-towers').click();
  await expect(page.getByTestId('play-towers')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByTestId('wl-exit').click();
  await expect(page).toHaveURL('/');
});

test('os chips de Daily da Home abrem o Daily do jogo e não só o hub', async ({ page }) => {
  await installApi(page);
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 800 })
    .catch(() => undefined);
  await page.getByTestId('daily-color').click();
  await expect(page.getByTestId('daily-panel')).toBeVisible();
  await page.goto('/');
  await page.getByTestId('daily-wclassic').click();
  await expect(page).toHaveURL(/\/words\/classic\/daily$/);
  await expect(page.getByTestId('daily-card')).toBeVisible();
  await page.getByTestId('daily-tab-ranking').click();
  await expect(page.getByTestId('hub-ranking')).toContainText('@ana');
});

test("hub do Block's tem ranking dos dois jogos", async ({ page }) => {
  await installApi(page);
  await page.goto('/blocks');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 800 })
    .catch(() => undefined);
  await page.getByTestId('menu-ranking').click();
  await expect(page.getByTestId('rank-board-classic')).toBeVisible();
  await page.getByTestId('rank-board-towers').click();
  await expect(page.getByTestId('hub-ranking')).toContainText('@ana');
});

test('tela do Atravessa! tem ranking temático', async ({ page }) => {
  await installApi(page);
  await page.goto('/fox-cap');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 800 })
    .catch(() => undefined);
  await page.getByTestId('foxcap-atravessa').click();
  await page.getByTestId('gl-ranking').click();
  await expect(page.getByTestId('hub-ranking')).toContainText('@ana');
  await page.getByTestId('gl-back').click();
  await expect(page.getByTestId('gl-main')).toBeVisible();
});
