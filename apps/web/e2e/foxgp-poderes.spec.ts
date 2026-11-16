import { expect, test, type Page } from '@playwright/test';

/** Spec 085: o Arcade tem dois modos, Corrida (sem itens) e Poderes (caixas e itens). */
type Sys = {
  give: (id: string, item: string) => void;
  state: (id: string) => { id: string | null; left: number };
  boxes: { x: number; z: number; cd: number }[];
  shots: unknown[];
};
type Win = Window & {
  __gp?: {
    cars: {
      x: number;
      z: number;
      h: number;
      prog: number;
      qualiMs: number | null;
      qualiAt: number | null;
      lastValid: { x: number; z: number; h: number; prog: number; idx: number };
    }[];
    track: { projectGlobal: (x: number, z: number) => { i: number; s: number; d: number } };
  };
  __gpItems?: Sys | null;
  __gpStage?: string;
};
const OUT =
  '/tmp/claude-0/-home-user-nocap-app/599484f6-d22b-5257-a81d-39f0e3e6d941/scratchpad/shots/poderes';

async function start(page: Page, powers: boolean) {
  await page.goto('/fox-cap?jogo=foxgp');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 8000 })
    .catch(() => undefined);
  await page.getByTestId('gl-offline').click();
  await page.getByTestId('gp-physics-arcade').click();
  await page.getByTestId(`gp-powers-${powers ? 'on' : 'off'}`).click();
  await page
    .getByRole('radiogroup', { name: 'Quantidade de adversários' })
    .getByRole('radio', { name: '3', exact: true })
    .click();
  await page.getByTestId('gp-start').click();
  await expect(page.getByTestId('gp-play')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => (window as Win).__gpStage === 'quali', null, {
    timeout: 20_000,
  });
  await page.evaluate(() => {
    const w = (window as Win).__gp!;
    w.cars.forEach((c, i) => {
      c.qualiMs = 60_000 + i * 1000;
      c.qualiAt = i;
    });
  });
  await page.waitForFunction(() => (window as Win).__gpStage === 'race', null, { timeout: 40_000 });
}

test.describe('Fox GP: Arcade com poderes (spec 085)', () => {
  test('Poderes: slot do item, triplo gasta um por vez, caixa dá item', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewportSize({ width: 1280, height: 720 });
    await start(page, true);
    const slot = page.getByTestId('gp-item-slot');
    await expect(slot).toBeVisible();
    await expect(slot).toContainText('Sem poder');
    await page.evaluate(() => (window as Win).__gpItems!.give('me', 'ball3'));
    await expect(slot).toContainText('Bola tripla');
    await expect(slot).toContainText('x3');
    await page.keyboard.press('KeyE');
    await expect(slot).toContainText('x2');
    expect(
      await page.evaluate(() => (window as Win).__gpItems!.shots.length),
    ).toBeGreaterThanOrEqual(1);
    await page.screenshot({ path: `${OUT}-race.png` });
    // pegar uma caixa: leva o carro até ela
    await page.evaluate(() => {
      const w = (window as Win).__gp!;
      const sys = (window as Win).__gpItems!;
      sys.state('me').id = null;
      const b = sys.boxes[3]!;
      const car = w.cars[0]!;
      // o carro precisa ficar coerente com a pista (índice e distância), senão o motor o devolve ao último ponto válido
      const pr = w.track.projectGlobal(b.x, b.z);
      Object.assign(car, {
        x: b.x,
        z: b.z,
        speed: 0,
        vx: 0,
        vz: 0,
        idx: pr.i,
        s: pr.s,
        d: pr.d,
        prog: pr.s,
      });
      car.lastValid = { x: b.x, z: b.z, h: car.h, prog: pr.s, idx: pr.i };
    });
    await expect
      .poll(() => page.evaluate(() => (window as Win).__gpItems!.state('me').id), { timeout: 5000 })
      .not.toBeNull();
    expect(errors).toEqual([]);
  });

  test('Corrida: sem caixas nem slot de item', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await start(page, false);
    await expect(page.getByTestId('gp-item-slot')).toHaveCount(0);
    expect(await page.evaluate(() => (window as Win).__gpItems ?? null)).toBeNull();
  });

  test('celular: botão Item ao lado do Turbo usa o item e não cobre outros botões', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width: 740, height: 360 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await start(page, true);
    const pad = page.getByTestId('gp-pad-item');
    await expect(pad).toBeVisible();
    await page.evaluate(() => (window as Win).__gpItems!.give('me', 'ball3'));
    await expect(pad).toContainText('x3');
    await pad.tap();
    await expect(pad).toContainText('x2');
    const boxes = await page.evaluate(() =>
      ['gp-pad-item', 'gp-pad-drift', 'gp-pad-auto'].map((id) => {
        const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
        return { id, x: r.left, y: r.top, w: r.width, h: r.height };
      }),
    );
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(740);
      expect(b.y + b.h).toBeLessThanOrEqual(360);
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(ox > 2 && oy > 2, `${a.id} em cima de ${b.id}`).toBe(false);
      }
    await page.screenshot({ path: `${OUT}-celular.png` });
    await ctx.close();
  });
});
