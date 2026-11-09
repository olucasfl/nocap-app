import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';

/** A partida do Block Classic guardada na conta aparece em outro aparelho (spec 073): aqui só existe na conta, não neste aparelho. */
test('continua no Block Classic uma partida que só existe na conta', async ({ page }) => {
  await installApi(page, {
    remoteBlocksRun: {
      v: 1,
      matchId: 'match-remota-1',
      seed: 'abc123abc123',
      session: 'sessao',
      moves: [0],
      thumbs: 0,
      perfects: 0,
      hintsUsed: 1,
      before: 100,
      savedAt: Date.now(),
    },
  });
  await page.goto('/blocks');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 800 })
    .catch(() => undefined);
  await expect(page.getByTestId('mode-classic')).toContainText('continuar');
  await page.getByTestId('mode-classic').click();
  await expect(page.getByTestId('resume')).toBeVisible();
});

test('sem partida na conta nem no aparelho, o Block Classic começa do zero', async ({ page }) => {
  await installApi(page);
  await page.goto('/blocks');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 800 })
    .catch(() => undefined);
  await expect(page.getByTestId('mode-classic')).not.toContainText('continuar');
  await page.getByTestId('mode-classic').click();
  await expect(page.getByTestId('resume')).toHaveCount(0);
  await expect(page.getByTestId('play-classic')).toBeVisible();
});
