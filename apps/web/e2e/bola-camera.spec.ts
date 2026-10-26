/* eslint-disable @typescript-eslint/no-explicit-any -- os testes leem o mundo do jogo exposto só em desenvolvimento */
import { expect, test } from '@playwright/test';

/** Câmera do Fut Fox: a bola fica no quadro e a câmera livre gira sem saltos, mesmo perto da parede. */
test.use({ viewport: { width: 1280, height: 720 } });

test('câmera na bola mantém a bola no quadro; câmera livre gira sem saltos', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(300_000);
  await page.goto('/fox-cap/bola');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 1500 })
    .catch(() => undefined);
  await page.getByTestId('bola-play-btn').click();
  await page.getByTestId('bola-fmt-2x2').click();
  await page.getByTestId('bola-start').click();
  await expect(page.getByTestId('bola-play')).toBeVisible();
  await page
    .getByTestId('bola-tips-ok')
    .click({ timeout: 3000 })
    .catch(() => undefined);
  await page.waitForTimeout(3500);
  // câmera na bola: amostra 40 vezes enquanto a bola e a raposa andam
  await page.keyboard.down('KeyW');
  let inside = 0;
  const samples = 25;
  for (let i = 0; i < samples; i++) {
    await page.waitForTimeout(200);
    const c = await page.evaluate(() => (window as any).__bolaScene.debugCamera());
    if (Math.abs(c.ndc[0]) <= 1 && c.ndc[1] <= 1 && c.ndc[1] >= -1 && c.ndc[2] < 1) inside++;
  }
  await page.keyboard.up('KeyW');
  console.log('BOLA NO QUADRO', inside, '/', samples);
  expect(inside / samples).toBeGreaterThan(0.9);
  // câmera livre: gira com o mouse perto da parede e mede o salto máximo da posição da câmera entre quadros
  await page.keyboard.press('KeyE');
  await page.evaluate(() => {
    const w = (window as any).__bola;
    const me = w.player('me');
    const e = w.field.edges.find((x: any) => x.goal < 0) ?? w.field.edges[0];
    Object.assign(me, { x: e.mx + e.nx * 1.5, z: e.mz + e.nz * 1.5, vx: 0, vz: 0 });
    (window as any).__camLog = [];
  });
  // a câmera alcança a raposa teletransportada antes de medir os saltos
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const log = () => {
      (window as any).__camLog.push({
        ...(window as any).__bolaScene.debugCamera(),
        ph: (window as any).__bola.phase,
      });
      (window as any).__raf = requestAnimationFrame(log);
    };
    log();
  });
  for (let i = 0; i < 80; i++) {
    await page.evaluate((k) => (window as any).__bolaTurn(0.07 + Math.sin(k / 6) * 0.03), i);
    await page.waitForTimeout(16);
  }
  const jump = await page.evaluate(() => {
    cancelAnimationFrame((window as any).__raf);
    const l = (window as any).__camLog as { x: number; y: number; z: number; ph: string }[];
    let max = 0;
    for (let i = 1; i < l.length; i++)
      max = Math.max(
        max,
        Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y, l[i].z - l[i - 1].z),
      );
    return { max, n: l.length };
  });
  console.log('SALTO MAXIMO DA CAMERA', JSON.stringify(jump));
  expect(jump.max).toBeLessThan(1.6);
});
