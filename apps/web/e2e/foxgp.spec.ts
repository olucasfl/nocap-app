import { expect, test, type Page } from '@playwright/test';

/**
 * Fox GP (specs 078 a 080): tela inicial (física, comandos, carro que gira), garagem com prévia ao vivo, treino
 * (classificação com a volta lançada manual, grid, luzes, corrida com DRS, box, pódio), 20 carros, as três câmeras, a
 * qualidade gráfica e a fluidez do desenho com o piloto automático (só existe no desenvolvimento). A classificação e a
 * chegada são encurtadas pelo mundo exposto em `window.__gp`.
 */
interface GpCarLike {
  id: string;
  x: number;
  z: number;
  h: number;
  vx: number;
  vz: number;
  speed: number;
  prog: number;
  idx: number;
  s: number;
  d: number;
  laps: number[];
  qualiMs: number | null;
  qualiAt: number | null;
  qualiStartT: number | null;
  qualiHold: number;
  pitHold: number;
  wear: number;
  drsAvail: boolean;
  drsOpen: boolean;
}
interface GpWorldLike {
  phase: string;
  mode: string;
  ended: boolean;
  cars: GpCarLike[];
  track: {
    length: number;
    drsZones: { from: number; to: number }[];
    pointAt(s: number, d?: number): { x: number; z: number; h: number };
    projectGlobal(x: number, z: number): { i: number; s: number; d: number };
  };
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
/** Espera a classificação começar (depois da contagem). */
const qualiOn = (page: Page) => page.waitForFunction(() => (window as Win).__gpStage === 'quali', null, { timeout: 15_000 });

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
      c.qualiMs = [61_000, 60_000, 62_000, 63_000][i] ?? 64_000 + i;
      c.qualiAt = i;
    });
  });

test.describe('Fox GP', () => {
  test.beforeEach(({ page: _page }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
  });

  test('tela inicial: física guardada, carro que gira, pistas e garagem com prévia ao vivo', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1440, height: 810 });
    await openHome(page);
    await expect(page.getByRole('heading', { name: /Fox\s*GP/i })).toBeVisible();
    await expect(page.getByRole('img', { name: /O seu carro/ })).toBeVisible();
    // seletor de física: Arcade por padrão, a escolha fica no aparelho
    await expect(page.getByTestId('gp-physics-arcade')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('gp-physics-real').click();
    expect(await page.evaluate(() => localStorage.getItem('nocap-gp-physics'))).toBe('real');
    await expect(page.getByTestId('gp-best')).toContainText('Realista');
    // arrastar o carro não dispara os botões do menu
    const car = (await page.getByTestId('gp-car-preview').boundingBox())!;
    await page.mouse.move(car.x + car.width * 0.7, car.y + car.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(car.x + car.width * 0.4, car.y + car.height * 0.5, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId('gp-home')).toBeVisible();
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

  test('menu Comandos: troca a tecla, avisa conflito, troca e restaura; vale na hora', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHome(page);
    await page.getByTestId('gp-open-commands').click();
    await expect(page.getByTestId('gp-commands')).toBeVisible();
    // DRS no Q
    await page.getByTestId('gp-bind-drs-0').click();
    await expect(page.getByTestId('gp-bind-drs-0')).toHaveText('Pressione uma tecla');
    await page.keyboard.press('KeyQ');
    await expect(page.getByTestId('gp-bind-drs-0')).toHaveText('Q');
    // câmera no W (já é do acelerar): avisa e oferece trocar
    await page.getByTestId('gp-bind-cam-0').click();
    await page.keyboard.press('KeyW');
    await expect(page.getByTestId('gp-bind-clash')).toBeVisible();
    await page.getByTestId('gp-bind-swap').click();
    await expect(page.getByTestId('gp-bind-cam-0')).toHaveText('W');
    await expect(page.getByTestId('gp-bind-gas-0')).toHaveText('C');
    // Esc cancela a captura (e não perde a tecla)
    await page.getByTestId('gp-bind-lap-0').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gp-bind-lap-0')).toHaveText('L');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nocap-gp-controls') ?? '{}'));
    expect(stored.drs[0]).toBe('KeyQ');
    await page.getByTestId('gp-bind-reset').click();
    await expect(page.getByTestId('gp-bind-gas-0')).toHaveText('W');
    await page.getByTestId('gp-bind-lap-0').click();
    await page.keyboard.press('KeyK');
    await page.getByTestId('gp-commands-close').click();
    // na partida, a chamada da volta lançada mostra a tecla do mapa, e ela funciona
    await page.getByTestId('gl-offline').click();
    await page.getByRole('radio', { name: '1', exact: true }).click();
    await page.getByTestId('gp-start').click();
    await qualiOn(page);
    await expect(page.getByTestId('gp-startlap')).toContainText('K', { timeout: 15_000 });
    await page.keyboard.press('KeyK');
    await expect(page.getByTestId('gp-lapcount')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('volta lançada manual: anda livre, aperta L, vai para a largada, conta e larga', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openTraining(page, 3);
    await qualiOn(page);
    await expect(page.getByTestId('gp-notice')).toBeVisible();
    // andando livre: sem tempo correndo, com a chamada da volta embaixo
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('gp-startlap')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('gp-qtime')).toContainText('Andando livre');
    expect(await page.evaluate(() => (window as Win).__gp!.cars[0]!.qualiStartT)).toBeNull();
    await page.keyboard.press('KeyL');
    // levado para a largada, parado, com a contagem
    await expect(page.getByTestId('gp-lapcount')).toBeVisible();
    const atLine = await page.evaluate(() => {
      const w = (window as Win).__gp!;
      const c = w.cars[0]!;
      const p = w.track.pointAt(0, 0);
      return { dist: Math.hypot(c.x - p.x, c.z - p.z), speed: c.speed };
    });
    expect(atLine.dist).toBeLessThan(1);
    expect(atLine.speed).toBe(0);
    await expect(page.getByTestId('gp-lapflash')).toBeVisible({ timeout: 6000 });
    await page.keyboard.up('KeyW');
    expect(await page.evaluate(() => (window as Win).__gp!.cars[0]!.qualiStartT)).not.toBeNull();
    await expect(page.getByTestId('gp-qtime')).toContainText('Volta lançada');
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-quali.png` });
    expect(errors).toEqual([]);
  });

  test('DRS: liberado na zona depois da 1ª volta, E abre, frear fecha; a asa e a HUD acompanham', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openTraining(page, 1);
    await qualiOn(page);
    await skipQuali(page);
    await raceOn(page);
    await expect(page.getByTestId('gp-drs')).toHaveAttribute('data-state', 'off');
    // você em 2º, na zona de DRS, com uma volta completa
    const place = () =>
      page.evaluate(() => {
        const w = (window as Win).__gp!;
        const zone = w.track.drsZones[0]!;
        w.cars.forEach((c, i) => {
          const s = zone.from + 20 + (i === 0 ? 0 : 30);
          const p = w.track.pointAt(s, 0);
          const pr = w.track.projectGlobal(p.x, p.z);
          Object.assign(c, { x: p.x, z: p.z, h: p.h, vx: Math.sin(p.h) * 20, vz: -Math.cos(p.h) * 20, speed: 20 });
          Object.assign(c, { idx: pr.i, s: pr.s, d: pr.d, prog: w.track.length + s, laps: [60_000] });
        });
      });
    await place();
    await page.keyboard.down('KeyW');
    await expect(page.getByTestId('gp-drs')).toHaveAttribute('data-state', 'avail', { timeout: 3000 });
    await page.keyboard.press('KeyE');
    await expect(page.getByTestId('gp-drs')).toHaveAttribute('data-state', 'open', { timeout: 3000 });
    expect(await page.evaluate(() => (window as Win).__gp!.cars[0]!.drsOpen)).toBe(true);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-drs.png` });
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyS');
    await expect(page.getByTestId('gp-drs')).not.toHaveAttribute('data-state', 'open', { timeout: 3000 });
    await page.keyboard.up('KeyS');
    expect(errors).toEqual([]);
  });

  test('três câmeras com troca suave e a qualidade gráfica sem erro', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openTraining(page, 3);
    await qualiOn(page);
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

  test('20 carros contra bots no Realista: corrida lisa, classificação com 20 linhas', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openHome(page);
    await page.getByTestId('gp-physics-real').click();
    await page.getByTestId('gl-offline').click();
    await page.getByRole('radio', { name: '19', exact: true }).click();
    await page.getByTestId('gp-start').click();
    await expect(page.getByTestId('gp-play')).toHaveAttribute('data-physics', 'real', { timeout: 30_000 });
    await qualiOn(page);
    expect(await page.evaluate(() => (window as Win).__gp!.cars.length)).toBe(20);
    expect(await page.evaluate(() => (window as Win).__gp!.mode)).toBe('real');
    await page.evaluate(() => ((window as Win).__gpAuto = true));
    await skipQuali(page);
    await raceOn(page);
    await expect(page.getByTestId('gp-mode')).toHaveText('Realista');
    await page.evaluate(() => {
      const s = (window as Win).__gpStats!;
      Object.assign(s, { frames: 0, slow: 0, maxDt: 0, backs: 0, maxJump: 0 });
    });
    await page.waitForTimeout(20_000);
    await expect(page.getByTestId('gp-board').locator('li')).toHaveCount(21);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-20.png` });
    const st = await page.evaluate(() => (window as Win).__gpStats!);
    test.info().annotations.push({ type: 'fluidez com 20 carros', description: JSON.stringify(st) });
    expect(st.frames).toBeGreaterThan(200);
    expect(st.backs).toBe(0);
    expect(st.maxJump).toBeLessThan(2.5);
    expect(errors).toEqual([]);
  });

  test('desenho liso: com o piloto automático, nada de vai-e-volta nem salto', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await openTraining(page, 3);
    await qualiOn(page);
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
    await qualiOn(page);
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

  test('classificação → grid → luzes → "Vai!" → corrida → pódio premium', async ({ page }) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 1440, height: 810 });
    await openTraining(page, 3);
    await qualiOn(page);
    await skipQuali(page);
    const grid = page.getByTestId('gp-grid');
    await expect(grid).toBeVisible();
    await expect(grid.locator('li').first()).toContainText('1:00.000');
    await expect(page.getByTestId('gp-lights')).toBeVisible({ timeout: 8000 });
    // antes de as luzes apagarem o carro não anda, nem com o pé no fundo
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1500);
    if ((await page.evaluate(() => (window as Win).__gpStage)) !== 'race')
      expect(await page.evaluate(() => Math.abs((window as Win).__gp!.cars[0]!.speed))).toBeLessThan(0.01);
    await raceOn(page);
    await expect(page.getByTestId('gp-go')).toBeVisible();
    await page.keyboard.up('KeyW');
    await expect(page.getByTestId('gp-board')).toBeVisible();
    await expect(page.getByTestId('gp-lap')).toHaveText('1/3');
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-race.png` });
    await page.evaluate(() => {
      const w = (window as Win).__gp!;
      w.cars.forEach((c, i) => w.applyFinish(c.id, 185_000 + i * 900));
    });
    const final = page.getByTestId('gp-final');
    await expect(final).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('gp-final-row-0')).toContainText('3:05.000');
    await expect(page.getByTestId('gp-final-row-1')).toContainText('+0.900');
    await expect(page.getByTestId('gp-final-physics')).toHaveText('Arcade');
    await expect(final.getByRole('img', { name: 'Pódio com os carros dos três primeiros' })).toBeVisible();
    await page.waitForTimeout(1200);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-final.png` });
    expect(errors).toEqual([]);
  });

  test('celular deitado: botões de toque (DRS no lugar do antigo), HUD sem estourar a tela', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, locale: 'pt-BR' });
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    await openTraining(page, 9);
    await qualiOn(page);
    await expect(page.getByRole('button', { name: 'Acelerar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'DRS' })).toBeVisible();
    await expect(page.getByTestId('gp-startlap')).toBeVisible({ timeout: 15_000 });
    const gas = (await page.getByRole('button', { name: 'Acelerar' }).boundingBox())!;
    await page.mouse.move(gas.x + gas.width / 2, gas.y + gas.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1800);
    await page.mouse.up();
    expect(await page.evaluate(() => (window as Win).__gp!.cars[0]!.speed)).toBeGreaterThan(3);
    // classificação compacta: o líder e cinco em volta de você
    await skipQuali(page);
    await raceOn(page);
    expect(await page.getByTestId('gp-board').locator('li').count()).toBeLessThanOrEqual(7);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-phone.png` });
    expect(errors).toEqual([]);
    await ctx.close();
  });
});
