import { expect, test, type Page } from '@playwright/test';

/** Counter Fox, mata-mata no Duna (spec 057): preparar a partida, bots jogando, pontos e tela final. */
const fs = <T>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(
    ([f, a]) =>
      ((window as unknown as { __fs: Record<string, (...x: unknown[]) => unknown> }).__fs[f as string] as (...x: unknown[]) => T)(...(a as unknown[])),
    [fn, args] as [string, unknown[]],
  ) as Promise<T>;

async function start(page: Page, minutes: number, bots: number) {
  await page.goto('/fox-cap/counter-fox');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await page.getByTestId('cfh-play').click();
  await page.getByTestId('cfh-offline').click();
  await page.getByTestId(`cfx-min-${minutes}`).click();
  await page.getByTestId(`cfx-bots-${bots}`).click();
  await page.getByTestId('cfx-start').click();
  await expect(page.getByTestId('fs-perf')).toBeVisible({ timeout: 40_000 });
  await page.getByTestId('fsm-resume').click();
}

type Dm = { id: string; alive: boolean; kills: number; assists: number; deaths: number; weapon: string; x: number; z: number };
const dm = (page: Page) => fs<{ ended: boolean; dm: Dm[] }>(page, 'match');

test('escolhe minutos e bots e a partida começa com essa gente', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/fox-cap/counter-fox');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await expect(page.getByTestId('cfh-main')).toBeVisible();
  await expect(page.getByTestId('cfh-logo')).toBeVisible();
  await expect(page.getByTestId('cfh-exit')).toBeVisible();
  await page.waitForTimeout(1400);
  if (process.env.FS_SHOTS) await page.screenshot({ path: `${process.env.FS_SHOTS}/cfh-main.png` });
  await page.getByTestId('cfh-play').click();
  await expect(page.getByTestId('cfh-offline')).toBeVisible();
  await expect(page.getByTestId('cfh-online')).toBeVisible();
  await page.waitForTimeout(900);
  if (process.env.FS_SHOTS) await page.screenshot({ path: `${process.env.FS_SHOTS}/cfh-play.png` });
  await page.getByTestId('cfh-offline').click();
  for (const m of [2, 3, 5, 7, 10]) await expect(page.getByTestId(`cfx-min-${m}`)).toBeVisible();
  for (let n = 1; n <= 9; n++) await expect(page.getByTestId(`cfx-bots-${n}`)).toBeVisible();
  await expect(page.getByTestId('cfx-bots-10')).toHaveCount(0);
  await page.waitForTimeout(900);
  if (process.env.FS_SHOTS) await page.screenshot({ path: `${process.env.FS_SHOTS}/cfh-offline.png` });
  await page.getByTestId('cfh-back').click();
  await page.getByTestId('cfh-back').click();
  await page.getByTestId('cfh-opt').click();
  await expect(page.getByTestId('cfh-options')).toBeVisible();
  await page.getByTestId('cfh-tab-screen').click();
  await page.waitForTimeout(900);
  if (process.env.FS_SHOTS) await page.screenshot({ path: `${process.env.FS_SHOTS}/cfh-options.png` });
  await page.getByTestId('cfh-tab-keys').click();
  await page.getByTestId('cfh-back').click();
  await start(page, 3, 4);
  expect((await dm(page)).dm.length).toBe(4);
  await expect(page.getByTestId('fs-time')).toContainText(/(2:5\d|3:00)/);
});

test('os bots andam pelo mapa, lutam e o placar mostra pontos', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await start(page, 5, 6);
  const a = await dm(page);
  await page.waitForTimeout(6000);
  const b = await dm(page);
  const moved = b.dm.filter((d, i) => Math.hypot(d.x - a.dm[i]!.x, d.z - a.dm[i]!.z) > 2).length;
  expect(moved).toBeGreaterThanOrEqual(3);
  if (process.env.FS_SHOTS) {
    await fs(page, 'teleport', 0, 20);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${process.env.FS_SHOTS}/cfx-play.png` });
  }
  // algum bot acaba matando outro (ou o jogador) com o tempo
  await expect.poll(async () => (await dm(page)).dm.reduce((s, d) => s + d.kills + d.deaths, 0), { timeout: 90_000, intervals: [2000] }).toBeGreaterThan(0);
});

test('abate vale 10 pontos e o fim do tempo mostra a tabela com o vencedor', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await start(page, 2, 1);
  await fs(page, 'dmOff', true);
  // mata o bot na pistola, bem de perto
  for (let i = 0; i < 6; i++) {
    const m = (await dm(page)).dm[0]!;
    if (!m.alive) break;
    await fs(page, 'teleport', m.x, m.z + 3);
    await fs(page, 'aimAt', 'd1', 'head');
    await fs(page, 'shoot', 3);
    await page.waitForTimeout(250);
  }
  await expect.poll(async () => (await fs<{ kills: number }>(page, 'stats')).kills, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId('fs-rank-me')).toContainText('10');
  await fs(page, 'skip', 500);
  await expect(page.getByTestId('fs-end')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('fs-end-row-me')).toBeVisible();
  await expect(page.getByTestId('fs-end-row-d1')).toBeVisible();
  if (process.env.FS_SHOTS) await page.screenshot({ path: `${process.env.FS_SHOTS}/cfx-end.png` });
  await page.getByTestId('fs-end-again').click();
  await expect(page.getByTestId('fs-perf')).toBeVisible({ timeout: 40_000 });
  await expect(page.getByTestId('fs-end')).toHaveCount(0);
});
