import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/** Counter Fox, modo Bomba offline (spec 059): rounds, compra na base, bomba, economia e fim de partida. */
const fs = <T>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(
    ([f, a]) => ((window as unknown as { __fs: Record<string, (...x: unknown[]) => unknown> }).__fs[f as string] as (...x: unknown[]) => T)(...(a as unknown[])),
    [fn, args] as [string, unknown[]],
  ) as Promise<T>;
type Bomb = { phase: string; time: number; round: number; score: { tr: number; ct: number }; money: number; side: string; carrier: string | null; planter: string | null; site: string | null; alive: number; shop: boolean } | null;
const bomb = (page: Page) => fs<Bomb>(page, 'bomb');

async function start(page: Page, side: 'tr' | 'ct', rounds = 2) {
  await installApi(page);
  await page.goto('/fox-cap/counter-fox');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
  await page.getByTestId('cfh-play').click();
  await page.getByTestId('cfh-offline').click();
  await page.getByTestId('cfx-mode-bomb').click();
  await page.getByTestId(`cfx-side-${side}`).click();
  await page.getByTestId('cfx-rounds-4').click();
  void rounds;
  await page.getByTestId('cfx-start').click();
  await expect(page.getByTestId('fb-hud')).toBeVisible({ timeout: 90_000 });
}

test('modo Bomba: compra só na base e com dinheiro finito, depois o round começa', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await start(page, 'ct');
  await expect.poll(async () => (await bomb(page))?.phase).toBe('buy');
  const b0 = (await bomb(page))!;
  expect(b0.money).toBe(800);
  expect(b0.side).toBe('ct');
  await expect(page.getByTestId('fb-money')).toContainText('800');
  // abre a loja na base e compra o colete (US$ 650): sobra pouco
  await page.keyboard.press('KeyB');
  await expect(page.getByTestId('fs-shop')).toBeVisible({ timeout: 20_000 });
  await fs<void>(page, 'bombSkip');
  await expect.poll(async () => (await bomb(page))?.phase, { timeout: 60_000 }).toBe('live');
  // com o round rolando a loja não abre
  await page.keyboard.press('KeyB');
  await expect(page.getByTestId('fs-shop')).toHaveCount(0);
});

test('modo Bomba: eliminar o time inimigo vence o round e paga mais que perder', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await start(page, 'ct');
  await fs<void>(page, 'bombSkip');
  await expect.poll(async () => (await bomb(page))?.phase, { timeout: 60_000 }).toBe('live');
  await fs<void>(page, 'bombKillAll', 'tr');
  await expect.poll(async () => (await bomb(page))?.phase, { timeout: 20_000 }).toBe('end');
  const b = (await bomb(page))!;
  expect(b.score.ct).toBe(1);
  expect(b.money).toBeGreaterThanOrEqual(800 + 3250);
  await expect(page.getByTestId('fb-banner')).toContainText('Contra-terroristas vencem');
  // o relógio do navegador sem GPU é lento: pula a espera de 5 s entre os rounds
  await fs<void>(page, 'bombSkip');
  // o próximo round começa sozinho, na compra, e quem não morreu fica com o equipamento
  await expect.poll(async () => (await bomb(page))?.round, { timeout: 60_000 }).toBe(2);
});

test('modo Bomba: terrorista leva a bomba, planta no pátio e a bomba explode', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await start(page, 'tr');
  await expect.poll(async () => (await bomb(page))?.carrier).not.toBeNull();
  await fs<void>(page, 'bombSkip');
  await expect.poll(async () => (await bomb(page))?.phase, { timeout: 60_000 }).toBe('live');
  // os bots terroristas levam a bomba ao pátio e plantam sozinhos (se você não for o portador)
  const me = (await bomb(page))!.carrier === 'me';
  if (!me) {
    await expect.poll(async () => (await bomb(page))?.phase, { timeout: 200_000, intervals: [2000] }).toMatch(/planted|end/);
  }
});
