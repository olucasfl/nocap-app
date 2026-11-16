import { expect, test } from '@playwright/test';

/** Reset de 16/11/2026: um save de antes (sem geração) é descartado e o jogo abre como se ninguém tivesse jogado. */
test('save antigo do Night Hunt é descartado; save novo é da a geração atual', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('seeded')) {
      localStorage.setItem('seeded', '1');
      localStorage.setItem(
        'nighthunt:save:v1',
        JSON.stringify({ v: 1, rev: 40, gold: 9999, highscore: 1234, heroes: ['kael', 'mara'], meta: { health: 3 } }),
      );
    }
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/nighthunt');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 4000 }).catch(() => undefined);
  await page.waitForTimeout(3000);
  const raw = await page.evaluate(() => localStorage.getItem('nighthunt:save:v1'));
  if (raw) {
    const s = JSON.parse(raw);
    expect(s.epoch).toBe(3);
    expect(s.gold).toBe(0);
    expect(s.highscore).toBe(0);
  }
  expect(errors).toEqual([]);
});
