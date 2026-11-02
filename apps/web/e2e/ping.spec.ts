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
      await page.mouse.click(640, 420); // prende o mouse
      await page.mouse.click(640, 420); // lança a bola
      // a mão avança na descida da bola (é ela que bate)
      await page.waitForTimeout(650);
      await page.mouse.move(640, 300, { steps: 6 });
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

/** Uma "pessoa" no navegador: espera embaixo do ponto onde a bola vai passar e dá a passada para cima e para a frente. */
const humanDriver = () => {
  const g = (
    window as unknown as {
      __ping: {
        match: {
          phase: string;
          server: number;
          expect: number;
          rally: number;
          t: number;
          lastHitter: number;
          ball: { y: number; vy: number; x: number };
        };
        scene: {
          project(x: number, y: number, z: number): { nx: number; ny: number };
          simX(x: number): number;
        };
        predict(
          ball: unknown,
          p: number,
          reach?: number,
        ): { x: number; y: number; t: number } | null;
      };
    }
  ).__ping;
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
  // o mouse aponta para um ponto da mesa (x, z): a raquete vai até lá. y = altura do plano de controle
  const to = (x: number, z: number) => {
    const q = g.scene.project(g.scene.simX(x), 1.4, z);
    return [r.left + q.nx * r.width, r.top + q.ny * r.height] as const;
  };
  const PAD_Z = 3.825;
  let plan: { x: number; t0: number } | null = null;
  let seen = -1;
  let last = -1;
  let toss0 = -1;
  const w = window as unknown as { __hits: number };
  w.__hits = 0;
  setInterval(() => {
    const m = g.match;
    if (m.lastHitter === 0 && last !== 0) w.__hits++;
    last = m.lastHitter;
    if (m.phase === 'serve' && m.server === 0) {
      // clica para lançar a bola
      const [x, y] = to(0, PAD_Z - 0.2);
      fire('pointermove', x, y);
      if (m.t > 0.8) fire('pointerdown', x, y, { button: 0 });
      toss0 = -1;
    } else if (m.phase === 'toss' && m.server === 0) {
      // a bola subiu e cai: na descida a mão avança em passada e bate nela
      if (toss0 < 0 && m.ball.vy < 0 && m.ball.y < 1.95) toss0 = m.t;
      const k = toss0 < 0 ? 0 : Math.max(0, Math.min(1, (m.t - toss0) / 0.12));
      const [x, y] = to(0, PAD_Z - (0.2 + 1.5 * k));
      fire('pointermove', x, y);
    } else if (m.phase === 'rally' && m.expect === 0) {
      if (m.rally !== seen) {
        seen = m.rally;
        plan = null;
      }
      if (!plan) {
        const c = g.predict(m.ball, 0, 1.0);
        if (c) plan = { x: c.x, t0: m.t + c.t };
      }
      if (plan) {
        // espera atrás e avança de modo que passe pelo plano de contato (alcance 1,0 m) quando a bola chegar
        const k = Math.max(0, Math.min(1, 1 - (plan.t0 - m.t) / 0.24));
        const [x, y] = to(plan.x, PAD_Z - (0.3 + 1.4 * k));
        fire('pointermove', x, y);
      }
    }
  }, 16);
};

test('uma pessoa que dá a passada certa (de baixo para cima, para a frente) devolve a bola do bot', async ({
  page,
}) => {
  test.setTimeout(170_000);
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
  await page.evaluate(humanDriver);
  // com tempo uma passada boa devolve várias bolas (a física é de verdade: a mão rápida demais manda para fora)
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __hits: number }).__hits), {
      timeout: 120_000,
      intervals: [1000],
    })
    .toBeGreaterThanOrEqual(5);
});

for (const size of [
  { name: 'celular-deitado', w: 844, h: 390 },
  { name: 'celular-em-pe', w: 390, h: 844 },
  { name: 'celular-pequeno-deitado', w: 568, h: 320 },
]) {
  test.describe(`Ping Fox! em ${size.name}`, () => {
    test.use({ viewport: { width: size.w, height: size.h }, isMobile: true, hasTouch: true });
    test('o HUD cabe e a raquete segue o dedo (sem pular)', async ({ page }) => {
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
      // a raquete fica embaixo do dedo: o centro dela na tela cai perto de onde o dedo está
      const under = await page.evaluate(() => {
        const w = window as unknown as {
          __ping: {
            match: { pad(p: number): { x: number; y: number; reach: number } };
            scene: {
              project(x: number, y: number, z: number): { nx: number; ny: number };
              simX(x: number): number;
            };
          };
        };
        const g = w.__ping;
        const pd = g.match.pad(0);
        const q = g.scene.project(g.scene.simX(pd.x), pd.y, 3.825 - pd.reach);
        const r = (document.querySelector('.png-zone') as HTMLElement).getBoundingClientRect();
        return { x: r.left + q.nx * r.width, y: r.top + q.ny * r.height };
      });
      expect(Math.abs(under.x - size.w * 0.8)).toBeLessThan(size.w * 0.12);
      expect(Math.abs(under.y - y)).toBeLessThan(size.h * 0.2);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      // (a bola do saque acompanha a raquete)
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

test('bola mal pegada: câmera lenta, a barra do smash aparece e o aperto vira nível', async ({
  page,
}) => {
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
  // a Raposa devolve uma bola mal pegada: sobe e vem para você
  await page.evaluate(() => {
    const g = (
      window as unknown as {
        __ping: {
          match: {
            phase: string;
            applyHit(r: unknown): void;
          };
        };
      }
    ).__ping;
    g.match.phase = 'rally';
    g.match.applyHit({
      p: 1,
      serve: false,
      smash: false,
      kmh: 40,
      quality: 'edge',
      spin: 0,
      stroke: 'subida',
      b: [0, 2.8, -0.5, 0, 3, 2.2, 0, 0, 0],
    });
  });
  await expect(page.getByTestId('png-smash')).toBeVisible({ timeout: 4000 });
  await page.keyboard.press('Space');
  await expect(page.getByTestId('png-smash')).toHaveAttribute('data-tier', /[123]/);
  if (process.env.E2E_SHOTS)
    await page.screenshot({ path: `${process.env.E2E_SHOTS}/ping-smash.png` });
});

test('mouse: o cursor fica preso no jogo e a raquete anda pelo movimento (não sai da tela)', async ({
  page,
}) => {
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
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.mouse.up();
  const locked = await page.evaluate(
    () => document.pointerLockElement?.classList.contains('png-zone') ?? false,
  );
  test.skip(!locked, 'este navegador de teste não prende o cursor');
  const padX = () =>
    page.evaluate(
      () =>
        (
          window as unknown as { __ping: { match: { pad(p: number): { x: number } } } }
        ).__ping.match.pad(0).x,
    );
  const x0 = await padX();
  for (let i = 1; i <= 12; i++) await page.mouse.move(640 + i * 30, 400);
  await page.waitForTimeout(300);
  expect(await padX()).toBeGreaterThan(x0 + 1);
  // mesmo "saindo" da janela o cursor continua no jogo
  for (let i = 1; i <= 30; i++) await page.mouse.move(1200 + i * 40, 400);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(true);
  // no menu (Esc) o cursor volta a aparecer
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('png-menu-continue')).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(false);
});

test('saque com o mouse de verdade: o clique lança a bola e a raquete bate nela (sem mexer o mouse)', async ({
  page,
}) => {
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
  await page
    .getByTestId('game-tips-ok')
    .click({ timeout: 2000 })
    .catch(() => undefined);
  // o aviso do mouse aparece grande até a pessoa clicar
  await expect(page.getByTestId('png-lock-hint')).toBeVisible();
  // a vez de sacar é sua
  await page.evaluate(() => {
    const m = (
      window as unknown as {
        __ping: {
          match: {
            server: number;
            phase: string;
            lastHitter: number;
            bounces: number[];
            rally: number;
            t: number;
          };
        };
      }
    ).__ping.match;
    m.server = 0;
    m.phase = 'serve';
    m.lastHitter = -1;
    m.bounces = [0, 0];
    m.rally = 0;
    m.t = 0;
  });
  await expect(page.getByTestId('png-serve-hint')).toBeVisible();
  await page.mouse.move(640, 420);
  await page.mouse.click(640, 420); // o primeiro clique prende o mouse (se o navegador deixar)
  const locked = await page.evaluate(() => !!document.pointerLockElement);
  if (locked) await expect(page.getByTestId('png-lock-hint')).toHaveCount(0);
  await page.mouse.click(640, 420); // o segundo lança a bola
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const g = (
            window as unknown as {
              __ping: { match: { rally: number; lastHitter: number; phase: string } };
            }
          ).__ping.match;
          return g.rally >= 1 && g.lastHitter === 0;
        }),
      { timeout: 6000 },
    )
    .toBe(true);
});

test('celular: toque (mesmo com tremidinha) lança a bola; arrastar leva a raquete sem lançar', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
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
  await page
    .getByTestId('game-tips-ok')
    .click({ timeout: 2000 })
    .catch(() => undefined);
  // espera a contagem do começo acabar (a partida só aceita o toque depois dela)
  await expect(page.locator('.png-count')).toHaveCount(0, { timeout: 20000 });
  const force = () =>
    page.evaluate(() => {
      const m = (
        window as unknown as {
          __ping: {
            match: {
              server: number;
              phase: string;
              lastHitter: number;
              bounces: number[];
              rally: number;
              t: number;
            };
          };
        }
      ).__ping.match;
      m.server = 0;
      m.phase = 'serve';
      m.lastHitter = -1;
      m.bounces = [0, 0];
      m.rally = 0;
      m.t = 0;
    });
  const phase = () =>
    page.evaluate(
      () => (window as unknown as { __ping: { match: { phase: string } } }).__ping.match.phase,
    );
  const cdp = await ctx.newCDPSession(page);
  const touch = async (type: string, x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
    });
  // guarda se a bola chegou a ser lançada (a fase 'toss' dura pouco e uma leitura solta pode perdê-la)
  await page.evaluate(() => {
    (window as unknown as { __saw: boolean }).__saw = false;
    setInterval(() => {
      const w = window as unknown as { __saw: boolean; __ping: { match: { phase: string } } };
      if (w.__ping.match.phase === 'toss') w.__saw = true;
    }, 10);
  });
  // arrastar 120 px: leva a raquete e NÃO lança
  await force();
  await touch('touchStart', 300, 250);
  for (let i = 1; i <= 6; i++) await touch('touchMove', 300 + i * 20, 250);
  await touch('touchEnd', 0, 0);
  await page.waitForTimeout(500);
  expect(await phase()).toBe('serve');
  await force();
  await page.waitForTimeout(300);
  // toque com tremidinha de 10 px e um tempinho parado: lança
  await touch('touchStart', 420, 250);
  await touch('touchMove', 428, 254);
  await page.waitForTimeout(350);
  await touch('touchEnd', 0, 0);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __saw: boolean }).__saw), {
      timeout: 4000,
    })
    .toBe(true);
  await ctx.close();
});

test('celular: sair do app no meio do toque e voltar não trava a raquete', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
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
  await page
    .getByTestId('game-tips-ok')
    .click({ timeout: 2000 })
    .catch(() => undefined);
  await expect(page.locator('.png-count')).toHaveCount(0, { timeout: 20000 });
  const padX = () =>
    page.evaluate(
      () =>
        (
          window as unknown as { __ping: { match: { pad(p: number): { x: number } } } }
        ).__ping.match.pad(0).x,
    );
  const cdp = await ctx.newCDPSession(page);
  const touch = (type: string, x: number, y: number, id = 1) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y, id }],
    });
  // o dedo mexe a raquete para a direita
  await touch('touchStart', 300, 250);
  for (let i = 1; i <= 6; i++) await touch('touchMove', 300 + i * 40, 250);
  await page.waitForTimeout(400);
  const right = await padX();
  // o app vai para o segundo plano: o toque é cancelado e o dedo nunca "solta"
  await touch('touchCancel', 0, 0);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(300);
  // volta e mexe para a esquerda: a raquete tem que seguir o dedo novo
  await touch('touchStart', 600, 250, 2);
  for (let i = 1; i <= 6; i++) await touch('touchMove', 600 - i * 70, 250, 2);
  await page.waitForTimeout(500);
  const left = await padX();
  expect(left).toBeLessThan(right - 0.5);
  await ctx.close();
});

test('painel de rede e fps: desligado por padrão, liga e desliga no menu e lembra', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 650 });
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
  await page
    .getByTestId('game-tips-ok')
    .click({ timeout: 2000 })
    .catch(() => undefined);
  // vem desligado
  await expect(page.getByTestId('net-badge')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByTestId('png-menu-net').click();
  await page.getByTestId('png-menu-continue').click();
  await expect(page.getByTestId('net-badge')).toBeVisible();
  await expect(page.getByTestId('net-badge')).toContainText('fps');
  // desliga de novo
  await page.keyboard.press('Escape');
  await page.getByTestId('png-menu-net').click();
  await page.getByTestId('png-menu-continue').click();
  await expect(page.getByTestId('net-badge')).toHaveCount(0);
});

test('celular: dedo parado lança a bola sem soltar; depois arrasta para sacar quando ela desce', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
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
  await page
    .getByTestId('game-tips-ok')
    .click({ timeout: 2000 })
    .catch(() => undefined);
  await expect(page.locator('.png-count')).toHaveCount(0, { timeout: 20000 });
  await page.evaluate(() => {
    const m = (
      window as unknown as {
        __ping: {
          match: {
            server: number;
            phase: string;
            lastHitter: number;
            bounces: number[];
            rally: number;
            t: number;
          };
        };
      }
    ).__ping.match;
    m.server = 0;
    m.phase = 'serve';
    m.lastHitter = -1;
    m.bounces = [0, 0];
    m.rally = 0;
    m.t = 0;
  });
  // o gesto inteiro roda dentro da página (toques de verdade demoram demais num navegador sem placa de vídeo): dedo
  // pousa e fica parado (a bola sobe sem soltar), mexe um pouco com a bola no alto (não saca) e depois arrasta para a
  // frente e para a direita quando a bola desce (aí saca), sempre com o dedo na tela
  const out = await page.evaluate(async () => {
    const zn = document.querySelector('.png-zone') as HTMLElement;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const ev = (type: string, x: number, y: number) =>
      zn.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 7,
          pointerType: 'touch',
          isPrimary: true,
          clientX: x,
          clientY: y,
          bubbles: true,
        }),
      );
    const m = (
      window as unknown as {
        __ping: { match: { phase: string; rally: number; ball: { y: number; vy: number } } };
      }
    ).__ping.match;
    ev('pointerdown', 420, 300);
    const t0 = performance.now();
    while (m.phase !== 'toss' && performance.now() - t0 < 2000) await wait(5);
    const launched = m.phase === 'toss';
    // bola no alto: mexe um pouco
    ev('pointermove', 424, 296);
    ev('pointermove', 428, 292);
    await wait(16);
    const earlyHit = m.rally;
    // bola descendo: arrasta para a frente
    const t1 = performance.now();
    while (!(m.ball.vy < 0 && m.ball.y < 2.5) && performance.now() - t1 < 1500) await wait(4);
    for (let i = 1; i <= 14; i++) {
      ev('pointermove', 428 + i * 3, 292 - i * 18);
      await wait(14);
    }
    await wait(300);
    const rally = m.rally;
    ev('pointerup', 470, 170);
    return { launched, earlyHit, rally };
  });
  expect(out.launched).toBe(true);
  expect(out.earlyHit).toBe(0);
  expect(out.rally).toBeGreaterThanOrEqual(1);
  await ctx.close();
});
