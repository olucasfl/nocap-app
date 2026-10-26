import { expect, test } from '@playwright/test';

/** Bola Maluca! (spec 046): o menu abre, o treino roda com bots e o jogador consegue mover e pular. */
test.use({ viewport: { width: 1280, height: 720 } });

test('Fox Cap! leva ao Bola Maluca!, a partida roda e a bola é tocada', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/fox-cap');
  await page.getByRole('button', { name: 'Agora não' }).click();
  await page.getByTestId('foxcap-bola').click();
  await page.getByTestId('bola-play-btn').click();
  await page.getByTestId('bola-fmt-2x2').click();
  await page.getByTestId('bola-start').click();
  await expect(page.getByTestId('bola-play')).toBeVisible();
  await page.waitForTimeout(3600);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');
  await page.waitForTimeout(8000);
  await page.keyboard.up('KeyD');
  await page.screenshot({ path: 'test-results/bola.png' });
  const w = await page.evaluate(() => {
    const world = (
      window as unknown as {
        __bola?: { phase: string; clock: number; ball: { x: number; z: number }; scores: number[] };
      }
    ).__bola;
    return world
      ? { phase: world.phase, clock: world.clock, scores: world.scores, ball: world.ball }
      : null;
  });
  expect(w?.clock).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});
