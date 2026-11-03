import { expect, test, type Page } from '@playwright/test';

/**
 * Fox Shot! (fase 0): a arena de teste carrega com os modelos, o HUD aparece e as regras de dano estilo CS valem na tela de
 * verdade: fuzil mata de cabeça com ou sem capacete, pistola não mata de cabeça com capacete, sniper mata no corpo.
 */
type Fs = {
  aimAt(id: string, zone?: string): void;
  teleport(x: number, z: number): void;
  shoot(n?: number): unknown;
  weapon(i: number): void;
  target(id: string): { hp: number; armor: number; alive: boolean };
};
const fs = <T>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(
    ([f, a]) =>
      (
        (window as unknown as { __fs: Record<string, (...x: unknown[]) => unknown> }).__fs[
          f as string
        ] as (...x: unknown[]) => T
      )(...(a as unknown[])),
    [fn, args] as [string, unknown[]],
  ) as Promise<T>;

async function open(page: Page) {
  await page.goto('/fox-cap/fox-shot-teste');
  await expect(page.getByTestId('fs-perf')).toBeVisible({ timeout: 40_000 });
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 4000 })
    .catch(() => undefined);
  await page.waitForTimeout(500);
}

test('a arena carrega, mostra o HUD e o medidor de desempenho', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  await expect(page.getByTestId('fs-ammo')).toContainText('30');
  await expect(page.getByTestId('fs-menu')).toBeVisible();
  await expect(page.getByTestId('fs-bars')).toBeVisible();
  if (process.env.FS_SHOTS) {
    await page.screenshot({ path: `${process.env.FS_SHOTS}/desktop-menu.png` });
    // sem o cartão de pausa (o mouse não prende em teste): fotos da cena
    await page.getByTestId('fsm-resume').click();
    for (const [i, name] of ['fuzil', 'pistola', 'sniper'].entries()) {
      await fs(page, 'weapon', i);
      await fs(page, 'teleport', 0, 9);
      await fs(page, 'aimAt', 't3', 'chest');
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${process.env.FS_SHOTS}/desktop-${name}.png` });
    }
  }
});

test('dano estilo CS nos alvos', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  // fuzil (arma 0): cabeça mata sem colete (t1) e com colete e capacete (t3)
  for (const id of ['t1', 't3']) {
    await fs(page, 'teleport', 0, 14);
    await fs(page, 'weapon', 0);
    await fs(page, 'aimAt', id, 'head');
    await fs(page, 'shoot', 1);
    expect((await fs<{ alive: boolean }>(page, 'target', id)).alive, `fuzil, cabeça, ${id}`).toBe(
      false,
    );
  }
  // pistola (arma 1) de perto: sem capacete a cabeça mata (t1 revive depois de 3 s; usa t4 perto)
  await fs(page, 'teleport', -14, -1);
  await fs(page, 'weapon', 1);
  await fs(page, 'aimAt', 't4', 'head');
  await fs(page, 'shoot', 1);
  expect(
    (await fs<{ alive: boolean }>(page, 'target', 't4')).alive,
    'pistola, cabeça, sem capacete, perto',
  ).toBe(false);
  // pistola contra colete e capacete: não mata de cabeça
  await fs(page, 'teleport', 8, -1);
  await fs(page, 'aimAt', 't5', 'head');
  await fs(page, 'shoot', 1);
  const t5 = await fs<{ alive: boolean; hp: number }>(page, 'target', 't5');
  expect(t5.alive, 'pistola, cabeça, com capacete').toBe(true);
  expect(t5.hp).toBeLessThan(100);
  // sniper (arma 2): corpo com colete e capacete mata
  await fs(page, 'teleport', 14, -10);
  await fs(page, 'weapon', 2);
  await fs(page, 'aimAt', 't7', 'chest');
  await fs(page, 'shoot', 1);
  expect(
    (await fs<{ alive: boolean }>(page, 'target', 't7')).alive,
    'sniper, corpo, colete e capacete',
  ).toBe(false);
});

test('celular deitado: HUD de toque e arena (foto)', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await open(page);
  await expect(page.getByTestId('fs-menu')).toBeVisible();
  await page.getByTestId('fsm-resume').click();
  await expect(page.locator('.fs-tbtns')).toBeVisible();
  await expect(page.getByTestId('fs-radar')).toBeVisible();
  await page.waitForTimeout(800);
  if (process.env.FS_SHOTS) await page.screenshot({ path: `${process.env.FS_SHOTS}/celular.png` });
  await ctx.close();
});

test('celular em pé pede para girar o aparelho', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto('/fox-cap/fox-shot-teste');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 1500 })
    .catch(() => undefined);
  await expect(page.getByTestId('fs-rotate')).toBeVisible();
  await ctx.close();
});

test('menu do Esc: personalizar, comandos com troca de tecla, placar e kill feed', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  // personalizar: a sensibilidade e a cor da mira ficam salvas
  await page.getByTestId('fsm-tab-personalizar').click();
  await expect(page.getByTestId('fsm-custom')).toBeVisible();
  await page.getByRole('radio', { name: 'Verde' }).click();
  if (process.env.FS_SHOTS)
    await page.screenshot({ path: `${process.env.FS_SHOTS}/desktop-personalizar.png` });
  // comandos: trocar "Recarregar" de R para F
  await page.getByTestId('fsm-tab-comandos').click();
  await expect(page.getByTestId('bind-reload')).toHaveText('R');
  await page.getByTestId('bind-reload').click();
  await page.keyboard.press('KeyF');
  await expect(page.getByTestId('bind-reload')).toHaveText('F');
  if (process.env.FS_SHOTS)
    await page.screenshot({ path: `${process.env.FS_SHOTS}/desktop-comandos.png` });
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('nocap-fs-settings') ?? '{}'),
  );
  expect(saved.binds.reload).toBe('KeyF');
  expect(saved.crossColor).toBe('green');
  // continuar e jogar: abate com a cabeça aparece no kill feed e no placar (Tab)
  await page.getByTestId('fsm-tab-jogo').click();
  await page.getByTestId('fsm-resume').click();
  await page.addStyleTag({ content: '.fs-hint{display:none!important}' });
  await fs(page, 'teleport', 0, 14);
  await fs(page, 'weapon', 0);
  await fs(page, 'aimAt', 't1', 'head');
  await fs(page, 'shoot', 1);
  await expect(page.getByTestId('fs-feed')).toContainText('Raposa 1');
  await expect(page.getByTestId('fs-feed')).toContainText('CABEÇA');
  await page.keyboard.down('Tab');
  await expect(page.getByTestId('fs-board')).toBeVisible();
  if (process.env.FS_SHOTS)
    await page.screenshot({ path: `${process.env.FS_SHOTS}/desktop-placar.png` });
  await page.keyboard.up('Tab');
  await expect(page.getByTestId('fs-board')).toHaveCount(0);
  await expect(page.getByTestId('fs-topbar')).toBeVisible();
  await expect(page.getByTestId('fs-radar')).toBeVisible();
  if (process.env.FS_SHOTS)
    await page.screenshot({ path: `${process.env.FS_SHOTS}/desktop-hud.png` });
});
