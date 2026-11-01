import { expect, test } from '@playwright/test';

/** Ping Fox! (spec 055): o treino abre pelo Fox Cap!, a bola é sacada e rebatida, e o placar anda. */
test.beforeEach(({ page: _page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});

test('treino: abre, saca, a bola cruza a rede e a raquete segue o mouse', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/fox-cap');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 6000 })
    .catch(() => undefined);
  await page.getByTestId('foxcap-pingpong').click();
  await page.getByTestId('png-level-medio').click();
  await page.getByTestId('png-start').click();
  await expect(page.getByTestId('png-play')).toBeVisible();
  await page.waitForTimeout(2600);
  await page
    .getByTestId('game-tips-ok')
    .click({ timeout: 3000 })
    .catch(() => undefined);
  if (process.env.E2E_SHOTS) {
    const t = Date.now();
    await page
      .screenshot({ path: `${process.env.E2E_SHOTS}/ping-1-start.png`, timeout: 20000 })
      .catch((e) => console.log('SHOT FAIL', e.message.slice(0, 200)));
    console.log('shot ms', Date.now() - t);
  }
  const state = () =>
    page.evaluate(() => {
      const w = window as unknown as {
        __ping?: {
          match: {
            phase: string;
            ball: Record<string, number>;
            score: number[];
            rally: number;
            server: number;
            pad: (p: number) => { x: number; y: number };
          };
        };
      };
      const m = w.__ping?.match;
      return m
        ? {
            phase: m.phase,
            x: m.ball.x,
            y: m.ball.y,
            z: m.ball.z,
            score: [...m.score],
            rally: m.rally,
            server: m.server,
            pad: m.pad(0),
          }
        : null;
    });
  await page.mouse.move(640, 420);
  await page.waitForTimeout(300);
  const s0 = await state();
  expect(s0).toBeTruthy();
  // a raquete vai até o mouse (x perto de 0 com o mouse no centro)
  expect(Math.abs(s0!.pad.x)).toBeLessThan(0.6);
  await page.mouse.move(900, 400);
  await page.waitForTimeout(400);
  const s1 = await state();
  expect(s1!.pad.x).toBeGreaterThan(s0!.pad.x + 0.3);
  // quem saca primeiro pode ser o bot: espera a vez e saca
  for (let i = 0; i < 80; i++) {
    const s = await state();
    if (s && s.phase === 'serve' && s.server === 0) {
      await page.mouse.click(640, 420);
      break;
    }
    if (s && s.phase === 'rally') break;
    await page.waitForTimeout(150);
  }
  let shots = 0;
  for (let i = 0; i < 40; i++) {
    await page.mouse.move(640 + Math.sin(i / 3) * 140, 380);
    await page.waitForTimeout(250);
    if (process.env.E2E_SHOTS && i % 6 === 2 && shots < 4) {
      await page.screenshot({ path: `${process.env.E2E_SHOTS}/ping-2-rally-${shots++}.png` });
    }
  }
  const s2 = await state();
  expect(s2!.score[0] + s2!.score[1]).toBeGreaterThan(0);
});

test('quem segue o anel de alcance devolve a bola e faz ponto contra o bot fácil', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/fox-cap');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 6000 })
    .catch(() => undefined);
  await page.getByTestId('foxcap-pingpong').click();
  await page.getByTestId('png-level-facil').click();
  await page.getByTestId('png-start').click();
  await expect(page.getByTestId('png-play')).toBeVisible();
  await page.waitForTimeout(2600);
  // o "jogador": a cada 40 ms, leva o mouse até o anel de alcance e saca quando é a vez
  const stats = await page.evaluate(
    () =>
      new Promise<{ myHits: number; score: number[]; rally: number }>((resolve) => {
        const w = window as unknown as {
          __ping: {
            match: {
              phase: string;
              server: number;
              lastHitter: number;
              score: number[];
              rally: number;
            };
            scene: {
              reticle(): { x: number; y: number } | null;
              project(x: number, y: number, z: number): { nx: number; ny: number };
            };
          };
        };
        const zone = document.querySelector('.png-zone') as HTMLElement;
        const r = zone.getBoundingClientRect();
        const fire = (type: string, x: number, y: number, extra: PointerEventInit = {}) =>
          zone.dispatchEvent(
            new PointerEvent(type, {
              clientX: x,
              clientY: y,
              pointerType: 'mouse',
              bubbles: true,
              pointerId: 1,
              ...extra,
            }),
          );
        let myHits = 0;
        let last = -1;
        let best = 0;
        const t0 = performance.now();
        const iv = setInterval(() => {
          const m = w.__ping.match;
          const tgt = w.__ping.scene.reticle();
          if (tgt) {
            const p = w.__ping.scene.project(tgt.x, tgt.y, 2.45);
            fire('pointermove', r.left + p.nx * r.width, r.top + p.ny * r.height);
          } else if (m.phase === 'serve' && m.server === 0) {
            const p = w.__ping.scene.project(0, 1.35, 2.45);
            fire('pointermove', r.left + p.nx * r.width, r.top + p.ny * r.height);
            fire('pointerdown', r.left + p.nx * r.width, r.top + p.ny * r.height, { button: 0 });
          }
          if (m.lastHitter === 0 && last !== 0) myHits++;
          last = m.lastHitter;
          best = Math.max(best, m.rally);
          if (myHits >= 6 || performance.now() - t0 > 100_000) {
            clearInterval(iv);
            resolve({ myHits, score: [...m.score], rally: best });
          }
        }, 40);
      }),
  );
  expect(stats.myHits, JSON.stringify(stats)).toBeGreaterThanOrEqual(4);
});

for (const size of [
  { name: 'celular-deitado', w: 844, h: 390 },
  { name: 'celular-em-pe', w: 390, h: 844 },
  { name: 'celular-pequeno-deitado', w: 568, h: 320 },
]) {
  test.describe(`Ping Fox! em ${size.name}`, () => {
    test.use({ viewport: { width: size.w, height: size.h }, isMobile: true, hasTouch: true });
    test('HUD e botão de smash cabem e a raquete segue o dedo', async ({ page }) => {
      await page.goto('/fox-cap');
      await page
        .getByRole('button', { name: 'Agora não' })
        .click({ timeout: 6000 })
        .catch(() => undefined);
      await page.getByTestId('foxcap-pingpong').click();
      await page.getByTestId('png-start').click();
      await expect(page.getByTestId('png-play')).toBeVisible();
      await page.waitForTimeout(2800);
      await page
        .getByTestId('game-tips-ok')
        .click({ timeout: 2000 })
        .catch(() => undefined);
      const fits = async (sel: string) => {
        const b = await page.locator(sel).first().boundingBox();
        expect(b, sel).toBeTruthy();
        expect(b!.x, sel).toBeGreaterThanOrEqual(-1);
        expect(b!.y, sel).toBeGreaterThanOrEqual(-1);
        expect(b!.x + b!.width, sel).toBeLessThanOrEqual(size.w + 1);
        expect(b!.y + b!.height, sel).toBeLessThanOrEqual(size.h + 1);
      };
      await fits('[data-testid="png-score"]');
      await fits('[data-testid="png-menu-btn"]');
      await fits('[data-testid="png-smash"]');
      // o dedo leva a raquete: arrasta para a direita e confere
      const cdp = await page.context().newCDPSession(page);
      const pad = () =>
        page.evaluate(() => {
          const w = window as unknown as { __ping: { match: { pad(p: number): { x: number } } } };
          return w.__ping.match.pad(0).x;
        });
      const x0 = await pad();
      const y = Math.round(size.h * 0.55);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: Math.round(size.w * 0.5), y, id: 1 }],
      });
      for (let x = size.w * 0.5; x <= size.w * 0.8; x += 12)
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: Math.round(x), y, id: 1 }],
        });
      await page.waitForTimeout(300);
      const x1 = await pad();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      expect(x1).toBeGreaterThan(x0 + 0.3);
      if (process.env.E2E_SHOTS)
        await page.screenshot({ path: `${process.env.E2E_SHOTS}/ping-${size.name}.png` });
    });
  });
}

test('tela de fim: aparece com o placar e os botões, em qualquer tamanho', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/fox-cap');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 6000 })
    .catch(() => undefined);
  await page.getByTestId('foxcap-pingpong').click();
  await page.getByTestId('png-level-dificil').click();
  await page.getByTestId('png-start').click();
  await expect(page.getByTestId('png-play')).toBeVisible();
  await page.waitForTimeout(2600);
  // chega perto do fim sem esperar uma partida inteira: o adversário está a 1 ponto de ganhar
  await page.evaluate(() => {
    const w = window as unknown as { __ping: { match: { score: number[] } } };
    w.__ping.match.score[1] = 10;
  });
  await expect(page.getByTestId('png-final')).toBeVisible({ timeout: 90_000 });
  for (const s of [
    { name: 'computador', w: 1280, h: 720 },
    { name: 'celular-em-pe', w: 390, h: 844 },
    { name: 'celular-deitado', w: 844, h: 390 },
    { name: 'celular-pequeno-deitado', w: 568, h: 320 },
  ]) {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(500);
    const card = await page.locator('[data-testid="png-final"] .fz-card').boundingBox();
    expect(card!.x, s.name).toBeGreaterThanOrEqual(-1);
    expect(card!.x + card!.width, s.name).toBeLessThanOrEqual(s.w + 1);
    expect(card!.y + card!.height, s.name).toBeLessThanOrEqual(s.h + 1);
    await expect(page.getByTestId('final-again'), s.name).toBeInViewport();
    await expect(page.getByTestId('final-exit'), s.name).toBeInViewport();
    if (process.env.E2E_SHOTS)
      await page.screenshot({ path: `${process.env.E2E_SHOTS}/ping-final-${s.name}.png` });
  }
  await page.getByTestId('final-again').click();
  await expect(page.getByTestId('png-final')).toHaveCount(0);
});
