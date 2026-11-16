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


async function open(page: Page, mode: 'real' | 'arcade', powers: boolean, track?: string) {
  await page.goto('/fox-cap?jogo=foxgp');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
  await page.getByTestId('gl-offline').click();
  await page.getByTestId('gp-physics-' + mode).click();
  if (mode === 'arcade') await page.getByTestId('gp-powers-' + (powers ? 'on' : 'off')).click();
  if (track) await page.getByTestId('gp-track-' + track).click();
  await page.getByRole('radiogroup', { name: 'Quantidade de adversários' }).getByRole('radio', { name: '5', exact: true }).click();
  await page.getByTestId('gp-start').click();
  await expect(page.getByTestId('gp-play')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => (window as Win).__gpStage === 'quali', null, { timeout: 20_000 });
}
for (const [id, mode, powers, track] of [['marina', 'real', false, 'marina'], ['interlagos', 'real', false, 'interlagos'], ['bala', 'arcade', false, undefined], ['castle', 'arcade', true, undefined]] as const) {
  test('foto ' + id, async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 540 });
    await open(page, mode, powers, track);
    await page.waitForTimeout(3500);
    await page.addStyleTag({ content: '.gp-play > *:not(canvas), [class*="gpx-"], [class*="gp-hud"], [class*="gp-pad"] { visibility: hidden !important; }' });
    await page.waitForTimeout(400);
    await page.screenshot({ path: '/tmp/claude-0/-home-user-nocap-app/599484f6-d22b-5257-a81d-39f0e3e6d941/scratchpad/prev/' + id + '.png' });
  });
}
