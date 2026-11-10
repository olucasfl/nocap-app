import { expect, test, type Page } from '@playwright/test';

/**
 * Fox GP (specs 078 e 079): tela inicial, garagem com prévia ao vivo, treino (classificação individual, grid, luzes,
 * corrida, box, pódio), as três câmeras, a qualidade gráfica e a fluidez do desenho com o piloto automático (só existe no
 * desenvolvimento). A classificação e a chegada são encurtadas pelo mundo exposto em `window.__gp`.
 */
interface GpCarLike {
  id: string;
  speed: number;
  qualiMs: number | null;
  qualiAt: number | null;
  qualiStartT: number | null;
  pitHold: number;
  wear: number;
}
interface GpWorldLike {
  phase: string;
  ended: boolean;
  cars: GpCarLike[];
  applyFinish(id: string, ms: number): void;
}
interface Stats {
  frames: number;
  slow: number;
  maxDt: number;
  backs: number;
  maxJump: number;
  laps: number;
}
type Win = Window & { __gp?: GpWorldLike; __gpAuto?: boolean; __gpStats?: Stats; __gpStage?: string };

/** Espera as luzes apagarem (a corrida valendo). */
const raceOn = (page: Page) => page.waitForFunction(() => (window as Win).__gpStage === 'race', null, { timeout: 30_000 });

async function openHome(page: Page) {
  await page.goto('/fox-cap');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
  await page.getByTestId('foxcap-foxgp').click();
  await expect(page.getByTestId('gp-home')).toBeVisible();
}

async function openTraining(page: Page, bots: number) {
  await openHome(page);
  await page.getByTestId('gl-offline').click();
  await page.getByRole('radio', { name: String(bots), exact: true }).click();
  await page.getByTestId('gp-start').click();
  await expect(page.getByTestId('gp-play')).toBeVisible({ timeout: 30_000 });
}

/** Erros do console e da página (o teste falha se aparecer algum). */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/** Pula a classificação: todos marcam tempo agora. */
const skipQuali = (page: Page) =>
  page.evaluate(() => {
    const w = (window as Win).__gp!;
    w.cars.forEach((c, i) => {
      c.qualiMs = [61_000, 60_000, 62_000, 63_000][i] ?? 64_000;
      c.qualiAt = i;
    });
  });

test.describe('Fox GP', () => {
  test.beforeEach(({ page: _page }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
  });

  test('tela inicial no tema, pistas e garagem com prévia ao vivo e salva', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1440, height: 810 });
    await openHome(page);
    await expect(page.getByRole('heading', { name: /Fox\s*GP/i })).toBeVisible();
    await expect(page.getByRole('img', { name: /O seu carro/ })).toBeVisible();
    await page.getByTestId('gp-open-track').click();
    await expect(page.getByRole('img', { name: 'Traçado do Circuito da Marina' })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar' }).first().click();
    await page.getByTestId('gp-open-garage').click();
    await expect(page.getByTestId('gp-garage')).toBeVisible();
    await page.getByTestId('garage-body-e8343c').click();
    await page.getByTestId('garage-pattern-chevron').click();
    await page.getByRole('button', { name: 'Número maior' }).click();
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-garage.png` });
    await page.getByTestId('garage-save').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nocap-gp-garage') ?? '{}'));
    expect(saved.paint).toMatchObject({ body: 0xe8343c, pattern: 'chevron', number: 8 });
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-home.png` });
    expect(errors).toEqual([]);
  });

  test('classificação individual: aquece e começa a volta quando quer', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openTraining(page, 3);
    await page.waitForTimeout(3800);
    // saindo do box: o botão aparece depois de sair da faixa
    await page.keyboard.down('KeyW');
    await expect(page.getByTestId('gp-startlap')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('KeyL');
    await expect(page.getByTestId('gp-lapflash')).toBeVisible();
    await page.keyboard.up('KeyW');
    const started = await page.evaluate(() => (window as Win).__gp!.cars[0]!.qualiStartT);
    expect(started).not.toBeNull();
    await expect(page.getByTestId('gp-qtime')).toContainText('Volta lançada');
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-quali.png` });
    expect(errors).toEqual([]);
  });

  test('três câmeras com troca suave e a qualidade gráfica sem erro', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openTraining(page, 2);
    await page.waitForTimeout(3800);
    await page.evaluate(() => ((window as Win).__gpAuto = true));
    await page.waitForTimeout(2500);
    for (const cam of ['chase', 'cockpit', 'far']) {
      await page.keyboard.press('KeyC');
      await expect(page.getByTestId('gp-play')).toHaveAttribute('data-cam', cam);
      await page.waitForTimeout(900);
      if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-cam-${cam}.png` });
    }
    // a câmera fica salva
    expect(await page.evaluate(() => localStorage.getItem('nocap-gp-cam'))).toBe('far');
    for (const q of ['Alta', 'Baixa', 'Média']) {
      await page.getByTestId('gp-menu-btn').click();
      await page.getByTestId('gp-menu-quality').click();
      await expect(page.getByTestId('gp-menu-quality')).toContainText(q);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1200);
      if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-q-${q}.png` });
    }
    const st = await page.evaluate(() => (window as Win).__gpStats!);
    expect(st.frames).toBeGreaterThan(60);
    expect(errors).toEqual([]);
  });

  test('desenho liso: com o piloto automático, nada de vai-e-volta nem salto', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openTraining(page, 3);
    await page.waitForTimeout(3800);
    await page.evaluate(() => ((window as Win).__gpAuto = true));
    await skipQuali(page);
    await raceOn(page);
    // zera as medidas na largada e corre
    await page.evaluate(() => {
      const s = (window as Win).__gpStats!;
      Object.assign(s, { frames: 0, slow: 0, maxDt: 0, backs: 0, maxJump: 0 });
    });
    await page.waitForTimeout(60_000);
    const st = await page.evaluate(() => (window as Win).__gpStats!);
    test.info().annotations.push({ type: 'fluidez', description: JSON.stringify(st) });
    expect(st.frames).toBeGreaterThan(600);
    expect(st.backs).toBe(0);
    // um quadro a 60/s anda no máximo ~0,65 m; o resto seria teleporte
    expect(st.maxJump).toBeLessThan(2.5);
    // quadros lentos (> 33 ms) quase não aparecem
    expect(st.slow / st.frames).toBeLessThan(0.05);
    expect(errors).toEqual([]);
  });

  test('box animado: parar na vaga mostra o pit stop e troca o pneu', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openTraining(page, 1);
    await page.waitForTimeout(3800);
    await skipQuali(page);
    await raceOn(page);
    await page.evaluate(() => {
      const c = (window as Win).__gp!.cars[0]!;
      c.wear = 0.8;
      c.pitHold = 3;
    });
    await expect(page.getByTestId('gp-pit')).toBeVisible();
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-pit.png` });
    await expect(page.getByTestId('gp-pit')).toBeHidden({ timeout: 6000 });
    expect(await page.evaluate(() => (window as Win).__gp!.cars[0]!.wear)).toBeLessThan(0.1);
    expect(errors).toEqual([]);
  });

  test('classificação → grid → luzes → corrida → pódio premium', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1440, height: 810 });
    await openTraining(page, 2);
    await page.waitForTimeout(3800);
    await skipQuali(page);
    const grid = page.getByTestId('gp-grid');
    await expect(grid).toBeVisible();
    await expect(grid.locator('li').first()).toContainText('1:00.000');
    await expect(page.getByTestId('gp-lights')).toBeVisible({ timeout: 8000 });
    await raceOn(page);
    await expect(page.getByTestId('gp-board')).toBeVisible();
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-race.png` });
    await page.evaluate(() => {
      const w = (window as Win).__gp!;
      w.cars.forEach((c, i) => w.applyFinish(c.id, 185_000 + i * 900));
    });
    const final = page.getByTestId('gp-final');
    await expect(final).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('gp-final-row-0')).toContainText('3:05.000');
    await expect(page.getByTestId('gp-final-row-1')).toContainText('+0.900');
    await expect(final.getByRole('img', { name: 'Pódio com os carros dos três primeiros' })).toBeVisible();
    await page.waitForTimeout(1200);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-final.png` });
    expect(errors).toEqual([]);
  });

  test('celular deitado: botões de toque, HUD sem estourar a tela', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, locale: 'pt-BR' });
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    await openTraining(page, 3);
    await page.waitForTimeout(3800);
    await expect(page.getByRole('button', { name: 'Acelerar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Turbo' })).toBeVisible();
    const gas = (await page.getByRole('button', { name: 'Acelerar' }).boundingBox())!;
    await page.mouse.move(gas.x + gas.width / 2, gas.y + gas.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1800);
    await page.mouse.up();
    expect(await page.evaluate(() => (window as Win).__gp!.cars[0]!.speed)).toBeGreaterThan(3);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-phone.png` });
    expect(errors).toEqual([]);
    await ctx.close();
  });
});
