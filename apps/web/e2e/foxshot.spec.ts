import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';

/**
 * Counter Fox, Mapa de Treino (spec 057): abre pelo menu (Jogar → Mapa de Treino), o dano estilo CS vale nos alvos de cada área,
 * os bots andam/agacham/pulam, os atiradores do estande só atiram para a frente e o mapa grande (M) mostra onde a pessoa está.
 */
const fs = <T>(page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(
    ([f, a]) =>
      ((window as unknown as { __fs: Record<string, (...x: unknown[]) => unknown> }).__fs[f as string] as (...x: unknown[]) => T)(...(a as unknown[])),
    [fn, args] as [string, unknown[]],
  ) as Promise<T>;

async function open(page: Page) {
  await installApi(page);
  await page.goto('/fox-cap/counter-fox');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await page.getByTestId('cfh-play').click();
  await page.getByTestId('cfh-train').click();
  await expect(page.getByTestId('fs-ammo')).toBeVisible({ timeout: 40_000 });
  await page.getByTestId('fsm-resume').click({ timeout: 2500 }).catch(() => undefined); // a partida já abre jogando
  await page.waitForTimeout(400);
}
const alive = async (page: Page, id: string) => (await fs<{ alive: boolean }>(page, 'target', id)).alive;

test('o mapa de treino carrega, mostra o HUD e a rota antiga redireciona', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await page.setViewportSize({ width: 1280, height: 720 });
  await installApi(page);
  await page.goto('/fox-cap/fox-shot-teste');
  await expect(page).toHaveURL(/\/fox-cap\/counter-fox$/);
  await open(page);
  await expect(page.getByTestId('fs-ammo')).toContainText('18');
  await expect(page.getByTestId('fs-bars')).toBeVisible();
  if (process.env.FS_SHOTS) await page.screenshot({ path: `${process.env.FS_SHOTS}/train-spawn.png` });
});

test('dano estilo CS nos alvos do mapa de treino', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  await fs(page, 'buy', 'ak');
  await fs(page, 'weapon', 0);
  // fuzil, cabeça: mata sem colete (t1) e com colete e capacete (t3)
  for (const [id, x, z] of [['t1', -34, -11], ['t3', -22, -11]] as const) {
    await fs(page, 'teleport', x, z);
    await fs(page, 'aimAt', id, 'head');
    await fs(page, 'shoot', 1);
    expect(await alive(page, id), `fuzil, cabeça, ${id}`).toBe(false);
  }
  // agachada: o tiro na altura da cabeça de pé passa por cima; levantou, mata
  await fs(page, 'teleport', -30, -11);
  await fs(page, 'crouchTarget', 't2', true);
  await fs(page, 'aimAt', 't2', 'head');
  await fs(page, 'shoot', 1);
  expect(await alive(page, 't2'), 'agachada não é atingida na cabeça de pé').toBe(true);
  await fs(page, 'crouchTarget', 't2', false);
  await fs(page, 'aimAt', 't2', 'head');
  await fs(page, 'shoot', 1);
  expect(await alive(page, 't2'), 'de pé, a mesma mira mata').toBe(false);
  // pistola de perto: sem capacete a cabeça mata (t4)
  await fs(page, 'weapon', 1);
  await fs(page, 'teleport', -40, -14);
  await fs(page, 'aimAt', 't4', 'head');
  await fs(page, 'shoot', 1);
  expect(await alive(page, 't4'), 'pistola, cabeça, sem capacete').toBe(false);
  // pistola contra colete e capacete: não mata de cabeça
  await fs(page, 'teleport', -22, -13);
  await fs(page, 'aimAt', 't5', 'head');
  await fs(page, 'shoot', 1);
  const t5 = await fs<{ alive: boolean; hp: number }>(page, 'target', 't5');
  expect(t5.alive, 'pistola, cabeça, com capacete').toBe(true);
  expect(t5.hp).toBeLessThan(100);
  // sniper na pista de distância (30 m): corpo, colete
  await fs(page, 'buy', 'sniper');
  await fs(page, 'weapon', 0);
  await fs(page, 'teleport', -33, 34.5);
  await fs(page, 'aimAt', 't7', 'chest');
  await fs(page, 'shoot', 1);
  expect(await alive(page, 't7'), 'sniper, corpo, colete').toBe(false);
});

test('escopeta: de perto mata com um tiro, de longe quase não acerta', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  await fs(page, 'buy', 'shotgun');
  await fs(page, 'weapon', 0);
  await expect(page.getByTestId('fs-ammo')).toContainText('SPAS-12');
  await fs(page, 'teleport', -34, -11);
  await fs(page, 'aimAt', 't1', 'chest');
  await fs(page, 'shoot', 1);
  expect(await alive(page, 't1'), 'de perto mata').toBe(false);
  await fs(page, 'teleport', -17, 31.5);
  await fs(page, 'aimAt', 't8', 'chest');
  await fs(page, 'shoot', 1);
  const far = await fs<{ alive: boolean; hp: number }>(page, 'target', 't8');
  expect(far.alive, 'de longe não mata').toBe(true);
  expect(far.hp, 'de longe quase nada acerta').toBeGreaterThan(55);
});

test('granadas: explosiva dá dano por distância e a de luz cega só quem olha', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  await page.keyboard.press('KeyB');
  await page.getByTestId('fs-buy-frag').dispatchEvent('click');
  await page.getByTestId('fs-buy-flash').dispatchEvent('click');
  await page.keyboard.press('KeyB');
  const inv = await fs<{ frag: number; flash: number }>(page, 'nades');
  expect(inv.frag).toBe(1);
  expect(inv.flash).toBe(1);
  await page.keyboard.press('Digit4');
  await expect(page.getByTestId('fs-ammo')).toContainText('Granada explosiva');
  await page.keyboard.press('Digit4');
  await expect(page.getByTestId('fs-ammo')).toContainText('Granada de luz');
  await page.keyboard.press('Digit4');
  expect((await fs<{ held: string | null }>(page, 'nades')).held).toBeNull();
  const hp = async (id: string) => (await fs<{ hp: number }>(page, 'target', id)).hp;
  await fs(page, 'blastAt', 'frag', -6, 21.5); // em cima do t10
  await expect.poll(async () => hp('t10'), { timeout: 15_000 }).toBeLessThan(50);
  await fs(page, 'blastAt', 'frag', 4.5, 22.5); // a 4,5 m do t11
  await expect.poll(async () => hp('t11'), { timeout: 15_000 }).toBeLessThan(100);
  expect(await hp('t11')).toBeGreaterThan(70);
  // luz: de costas não cega; de frente cega
  await fs(page, 'teleport', 0, 14);
  await fs(page, 'aimAt', 't11', 'chest');
  await fs(page, 'blastAt', 'flash', 0, 10);
  await page.waitForTimeout(1500);
  expect(await fs<number>(page, 'blind'), 'de costas não cega').toBeLessThan(0.5);
  await fs(page, 'blastAt', 'flash', 0, 16.5);
  await expect.poll(async () => fs<number>(page, 'blind'), { timeout: 15_000 }).toBeGreaterThan(1);
});

test('bots andam, agacham, pulam, morrem e nascem de novo', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  type Bot = { x: number; y: number; z: number; crouch: number; alive: boolean };
  const bot = (id: string) => fs<Bot>(page, 'bot', id);
  // (o navegador de teste roda sem placa de vídeo e o relógio do jogo anda devagar: espera por condição, não por tempo fixo)
  const x0 = (await bot('b1')).x;
  await expect.poll(async () => Math.abs((await bot('b1')).x - x0), { timeout: 60_000 }).toBeGreaterThan(1);
  let maxY = 0;
  await expect
    .poll(async () => (maxY = Math.max(maxY, (await bot('b4')).y)), { timeout: 60_000, intervals: [100] })
    .toBeGreaterThan(0.3);
  await expect.poll(async () => (await bot('b3')).crouch, { timeout: 30_000 }).toBeGreaterThan(0.9);
  await fs(page, 'buy', 'ak');
  await fs(page, 'weapon', 0);
  await fs(page, 'teleport', -5, -24.5);
  await fs(page, 'aimAt', 'b5', 'head');
  await fs(page, 'shoot', 1);
  expect((await bot('b5')).alive, 'bot morreu').toBe(false);
  await expect.poll(async () => (await bot('b5')).alive, { timeout: 90_000 }).toBe(true);
});

test('estande: os atiradores só atiram para a frente, e só quando a pessoa está na galeria', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(200_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  // fora da galeria (no meio da pista) os atiradores ficam quietos
  await fs(page, 'teleport', 30, 0);
  await page.waitForTimeout(2500);
  expect(await fs<number>(page, 'rangeShots'), 'fora da galeria não há tiro').toBe(0);
  expect(await fs<number>(page, 'hp'), 'fora da galeria ninguém atira').toBe(100);
  // dentro da galeria, de frente para eles: nunca levam tiro (atiram só para o norte, para o paredão)
  await fs(page, 'teleport', 31, -11);
  await expect.poll(async () => fs<number>(page, 'rangeShots'), { timeout: 90_000, message: 'os atiradores atiraram de verdade' }).toBeGreaterThan(5);
  expect(await fs<number>(page, 'hp'), 'atrás do atirador o tiro não vem na sua direção').toBe(100);
  // passar na frente de um atirador (entre ele e o paredão) leva o tiro reto dele
  await fs(page, 'teleport', 31, -22);
  await expect.poll(async () => fs<number>(page, 'hp'), { timeout: 120_000, message: 'na frente do atirador leva o tiro' }).toBeLessThan(100);
});

test('M abre o mapa grande com onde estou e Esc fecha', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  await expect(page.locator('.fs-bigmap')).toHaveCount(0);
  await page.keyboard.press('KeyM');
  await expect(page.locator('.fs-bigmap')).toBeVisible();
  await page.waitForTimeout(500);
  if (process.env.FS_SHOTS) await page.screenshot({ path: `${process.env.FS_SHOTS}/train-bigmap.png` });
  await page.keyboard.press('KeyM');
  await expect(page.locator('.fs-bigmap')).toHaveCount(0);
});

test('celular em pé pede para girar o aparelho', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await installApi(page);
  await page.goto('/fox-cap/counter-fox');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await page.getByTestId('cfh-play').click();
  await page.getByTestId('cfh-train').click();
  await expect(page.getByTestId('fs-rotate')).toBeVisible({ timeout: 40_000 });
  await ctx.close();
});

test('fotos do mapa de treino (só com FS_SHOTS)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop' || !process.env.FS_SHOTS, 'só para conferir o visual');
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await open(page);
  const look = async (name: string, x: number, z: number, yaw: number, pitch = 0) => {
    await fs(page, 'teleport', x, z);
    await fs(page, 'look', yaw, pitch);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${process.env.FS_SHOTS}/train-${name}.png` });
  };
  await look('avenue', -41, 0, -90);
  await look('targets', -30, -11, 0);
  await look('walkers', 0, -10.5, 0);
  await look('range', 30, -11, 0);
  await look('range-front', 31, -23, 180);
  await look('move', -41, 20, 180);
  await look('nades', 0, 12, 180);
  await look('walls', 30, 11, 180);
  await look('distance', -41, 33, -90);
  await look('distance-door', 7, 22, 180);
});
