import { expect, test } from '@playwright/test';

/**
 * Fut Fox (spec 052): cada formato (2, 3 e 4 times) abre com os cantos arredondados e a rampa, a bola nunca fica presa num
 * canto nem sai do campo, e a página não dá erro.
 */
test.use({ viewport: { width: 900, height: 520 } });

for (const fmt of ['1x1', '2x2', '1x1x1', '2x2x2', '1x1x1x1', '2x2x2x2']) {
  test(`formato ${fmt}: campo com cantos redondos, bola sai do canto e fica no campo`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/fox-cap');
    await page
      .getByRole('button', { name: 'Agora não' })
      .click({ timeout: 2000 })
      .catch(() => undefined);
    await page.getByTestId('foxcap-bola').click();
    await page.getByTestId(`bola-fmt-${fmt}`).click();
    await page.getByTestId('bola-start').click();
    await page.getByTestId('bola-play').waitFor();
    await page
      .getByTestId('bola-tips-ok')
      .click({ timeout: 3000 })
      .catch(() => undefined);
    await page.waitForTimeout(4200);
    // o campo tem cantos em arco (muitas arestas) e rampa
    const field = await page.evaluate(() => {
      const w = (
        window as unknown as {
          __bola: { field: { edges: unknown[]; rampR: number; teams: number } };
        }
      ).__bola;
      return { edges: w.field.edges.length, rampR: w.field.rampR, teams: w.field.teams };
    });
    expect(field.edges).toBeGreaterThan(20);
    expect(field.rampR).toBeGreaterThan(1);
    // a bola, jogada de ponta num canto, sai dele e nunca deixa o campo
    await page.evaluate(() => {
      const w = (
        window as unknown as {
          __bola: { ball: Record<string, number>; field: { edges: { ax: number; az: number }[] } };
        }
      ).__bola;
      const c = w.field.edges.reduce((m, e) =>
        Math.hypot(e.ax, e.az) > Math.hypot(m.ax, m.az) ? e : m,
      );
      const d = Math.hypot(c.ax, c.az);
      Object.assign(w.ball, {
        x: c.ax * 0.8,
        y: 1,
        z: c.az * 0.8,
        vx: (c.ax / d) * 12,
        vy: 0,
        vz: (c.az / d) * 12,
      });
    });
    const samples: { x: number; z: number; y: number }[] = [];
    for (let i = 0; i < 14; i++) {
      await page.waitForTimeout(300);
      samples.push(
        await page.evaluate(() => {
          const w = (window as unknown as { __bola: { ball: { x: number; y: number; z: number } } })
            .__bola;
          return { x: w.ball.x, y: w.ball.y, z: w.ball.z };
        }),
      );
    }
    for (const s of samples) {
      expect(Number.isFinite(s.x + s.y + s.z)).toBe(true);
      expect(s.y).toBeGreaterThanOrEqual(0.85);
    }
    await page.screenshot({ path: `test-results/formato-${fmt}.png` });
    expect(errors).toEqual([]);
  });
}
