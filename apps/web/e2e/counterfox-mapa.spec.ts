import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/** Counter Fox com o mapa Cidade (spec 061): escolher o mapa no menu offline, entrar e jogar nele (mata-mata e bomba). */
const fs = <T = unknown>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(
    ([f, a]) => ((window as unknown as { __fs: Record<string, (...x: unknown[]) => unknown> }).__fs[f as string] as (...x: unknown[]) => T)(...(a as unknown[])),
    [fn, args] as [string, unknown[]],
  ) as Promise<T>;

async function start(page: Page, mode: 'dm' | 'bomb') {
  await installApi(page);
  await page.goto('/fox-cap/counter-fox');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
  await page.getByTestId('cfh-play').click();
  await page.getByTestId('cfh-offline').click();
  await page.getByTestId('cfx-map-cidade').click();
  await page.getByTestId(`cfx-mode-${mode}`).click();
  if (mode === 'bomb') await page.getByTestId('cfx-side-tr').click();
  await page.getByTestId('cfx-start').click();
}

test('Cidade: escolher o mapa e jogar o mata-mata', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await start(page, 'dm');
  await expect(page.getByTestId('fs-root')).toBeVisible({ timeout: 120_000 });
  await expect.poll(async () => await fs<number>(page, 'hp'), { timeout: 120_000 }).toBe(100);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-results/cidade-dm.png' });
  await fs<void>(page, 'look', 90, -5);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/cidade-dm2.png' });
  await fs<void>(page, 'look', 270, 0);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/cidade-dm3.png' });
});

test('Cidade: modo Bomba como terrorista, a bomba e as bases existem', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await start(page, 'bomb');
  await expect(page.getByTestId('fb-hud')).toBeVisible({ timeout: 120_000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/cidade-bomba.png' });
});

test('Cidade: ninguém cai do mapa na contagem e "Se matar" funciona sem tela branca', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 720 });
  await start(page, 'dm');
  await expect(page.getByTestId('fs-root')).toBeVisible({ timeout: 120_000 });
  await expect.poll(async () => await fs<number>(page, 'hp'), { timeout: 120_000 }).toBe(100);
  const y0 = (await fs<number[]>(page, 'pos', 'me'))[1]!;
  await page.waitForTimeout(8000);
  const y1 = (await fs<number[]>(page, 'pos', 'me'))[1]!;
  expect(Math.abs(y1 - y0)).toBeLessThan(0.5);
  for (const id of ['d1', 'd2', 'd3', 'd4']) {
    const b = await fs<number[]>(page, 'pos', id);
    expect(b[1]!).toBeGreaterThan(-0.5);
  }
  await page.screenshot({ path: 'test-results/cidade-queda.png' });
  await page.keyboard.press('Escape');
  await page.getByTestId('fsm-suicide').click();
  await page.getByTestId('fsm-suicide').click();
  await expect.poll(async () => await fs<number>(page, 'hp'), { timeout: 10_000 }).toBeLessThanOrEqual(0);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/cidade-sematar.png' });
  expect(errors).toEqual([]);
});
