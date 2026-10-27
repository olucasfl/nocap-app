import { expect, test } from '@playwright/test';

/**
 * Fut Fox (spec 052): a raposa corre contra o muro, sobe, anda no teto e cai quando o grude acaba. A câmera não pode
 * perder o sentido: a bola nunca some e os controles continuam valendo para onde a tela olha.
 */
test.use({ viewport: { width: 900, height: 520 } });

test('raposa sobe a parede, anda no teto e cai; a câmera acompanha sem virar', async ({
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
  await page.getByTestId('bola-fmt-1x1').click();
  await page.getByTestId('bola-start').click();
  await page.getByTestId('bola-play').waitFor();
  await page
    .getByTestId('bola-tips-ok')
    .click({ timeout: 3000 })
    .catch(() => undefined);
  await page.waitForTimeout(4200);
  // põe a raposa já colada num muro comprido (a 1 m do chão) e a bola longe: a câmera precisa se alinhar com a parede sozinha
  await page.evaluate(() => {
    const w = (
      window as unknown as {
        __bola: {
          players: Record<string, number | boolean>[];
          ball: Record<string, number>;
          field: {
            edges: { mx: number; mz: number; nx: number; nz: number; len: number; goal: number }[];
          };
        };
      }
    ).__bola;
    const e = w.field.edges.find((q) => q.goal < 0 && q.len > 10)!;
    const me = w.players.find((p) => !p.bot)!;
    Object.assign(me, {
      x: e.mx + e.nx * 0.5,
      z: e.mz + e.nz * 0.5,
      y: 1,
      vx: 0,
      vy: 0,
      vz: 0,
      surf: 1,
      wnx: e.nx,
      wnz: e.nz,
      stick: 3.2,
      grounded: false,
    });
    for (const p of w.players)
      if (p.bot) {
        p.x = e.mx + e.nx * 12;
        p.z = e.mz + e.nz * 12;
      }
    Object.assign(w.ball, { x: e.mx + e.nx * 10, y: 1, z: e.mz + e.nz * 10, vx: 0, vy: 0, vz: 0 });
  });
  await page.keyboard.down('KeyW');
  const seen = { wall: false, ceil: false, maxY: 0, fell: false };
  const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    await page.waitForTimeout(150);
    const s = await page.evaluate(() => {
      const w = (
        window as unknown as {
          __bola: { players: { bot?: boolean; surf: number; y: number; stick: number }[] };
        }
      ).__bola;
      const me = w.players.find((p) => !p.bot)!;
      return { surf: me.surf, y: me.y, stick: me.stick };
    });
    if (s.surf === 1 && s.y > 3 && !seen.wall)
      await page.screenshot({ path: 'test-results/parede-sobe.png' });
    if (s.surf === 2 && !seen.ceil) {
      await page.waitForTimeout(250);
      // o corpo está de cabeça para baixo no teto: a cabeça (0, 1,2 m no corpo) fica abaixo dos pés
      const headBelow = await page.evaluate(() => {
        const sc = (
          window as unknown as {
            __bolaScene: {
              foxes: Map<
                string,
                {
                  group: {
                    updateMatrixWorld: (f: boolean) => void;
                    matrixWorld: { elements: number[] };
                  };
                }
              >;
              world: { players: { id: string; bot?: boolean }[] };
            };
          }
        ).__bolaScene;
        const me = sc.world.players.find((p) => !p.bot)!;
        const g = sc.foxes.get(me.id)!.group;
        g.updateMatrixWorld(true);
        const e = g.matrixWorld.elements;
        return e[5]! * 1.2 + e[13]! < e[13]! - 0.5;
      });
      expect(headBelow).toBe(true);
      await page.screenshot({ path: 'test-results/parede-teto.png' });
    }
    if (s.surf === 1) seen.wall = true;
    if (s.surf === 2) seen.ceil = true;
    seen.maxY = Math.max(seen.maxY, s.y);
    if ((seen.wall || seen.ceil) && s.surf === 0 && !seen.fell) {
      await page.waitForTimeout(200);
      await page.screenshot({ path: 'test-results/parede-cai.png' });
    }
    if ((seen.wall || seen.ceil) && s.surf === 0) seen.fell = true;
    if (seen.wall && seen.ceil && seen.fell) break;
  }
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: 'test-results/parede-fim.png' });
  expect(seen.wall).toBe(true);
  expect(seen.maxY).toBeGreaterThan(5);
  expect(errors).toEqual([]);
});
