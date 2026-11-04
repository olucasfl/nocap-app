import { expect, test } from '@playwright/test';
test('vm jitter', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => localStorage.setItem('fs-no-shooters', '1'));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/fox-cap/fox-shot-teste');
  await expect(page.getByTestId('fs-perf')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await page.getByTestId('fsm-resume').click();
  const w = window as never;
  void w;
  await page.evaluate(() => (window as any).__fs.buy('ak'));
  await page.evaluate(() => (window as any).__fs.weapon(0));
  await page.evaluate(() => (window as any).__fs.ads(true));
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1500);
  const rows = await page.evaluate(
    () =>
      new Promise<number[][]>((res) => {
        const out: number[][] = [];
        const f = () => {
          out.push((window as any).__fs.vm());
          if (out.length < 60) requestAnimationFrame(f);
          else res(out);
        };
        requestAnimationFrame(f);
      }),
  );
  await page.keyboard.up('KeyD');
  const col = (i: number) => rows.map((r) => r[i]!);
  const rng = (a: number[]) => Math.max(...a) - Math.min(...a);
  console.log('RANGE x', rng(col(0)).toFixed(5), 'y', rng(col(1)).toFixed(5), 'z', rng(col(2)).toFixed(5), 'rotY', rng(col(4)).toFixed(5), 'rotZ', rng(col(5)).toFixed(5), 'fov', rng(col(6)).toFixed(4));
  console.log('SAMPLE', JSON.stringify(rows.slice(0, 6).map((r) => r.map((v) => +v.toFixed(4)))));
});
