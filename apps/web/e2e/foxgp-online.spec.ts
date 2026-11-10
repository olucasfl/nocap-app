import { expect, test, type Page } from '@playwright/test';

/**
 * Fox GP em sala com DUAS janelas de verdade (spec 078): criar a sala do Fox Cap!, escolher o Fox GP, classificação, grid,
 * luzes, corrida (o carro de um aparece andando na tela do outro) e o pódio quando o líder encerra. Só roda com
 * `E2E_ROOMS=1` (mesmo preparo de ping-online.spec.ts):
 *
 *   pnpm --filter api exec esbuild scripts/rooms-only.ts --bundle --platform=node --outfile=/tmp/rooms-only.cjs && node /tmp/rooms-only.cjs
 *   VITE_API_URL=http://localhost:3340 pnpm --filter web exec vite --port 5180 --strictPort
 *   E2E_ROOMS=1 E2E_PORT=5180 pnpm --filter web exec playwright test e2e/foxgp-online.spec.ts --project=desktop
 */
test.skip(!process.env.E2E_ROOMS, 'precisa do servidor de salas (E2E_ROOMS=1)');
test.beforeEach(({ page: _page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});
test.setTimeout(240_000);

interface W {
  meId: string | null;
  phase: string;
  t: number;
  track: { length: number };
  cars: { id: string; x: number; z: number; h: number; vx: number; vz: number; prog: number; qualiStartT: number | null; qualiMs: number | null }[];
}
type Win = Window & { __gp?: W };

async function nick(page: Page, name: string) {
  await page.getByRole('dialog').locator('input').first().fill(name);
  await page.getByRole('button', { name: 'Entrar na sala' }).click();
}

/** Faz a sua volta de classificação "terminar agora" com o tempo dado (o carro precisa estar andando). */
const finishQuali = (page: Page, sec: number) =>
  page.evaluate((s) => {
    const w = (window as Win).__gp!;
    const me = w.cars.find((c) => c.id === w.meId)!;
    me.qualiStartT = w.t - s;
    me.prog = w.track.length - 0.2;
    // um empurrão para a frente: o carro cruza a linha no próximo passo
    me.vx = Math.sin(me.h) * 15;
    me.vz = -Math.cos(me.h) * 15;
  }, sec);

test('duas janelas: classificação, grid, corrida pela sala e pódio', async ({ browser }) => {
  const mk = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 }, locale: 'pt-BR' });
    const p = await ctx.newPage();
    await p.addInitScript(() => localStorage.setItem('nocap-mute', '1'));
    return p;
  };
  const A = await mk();
  await A.goto('/fox-cap');
  await A.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
  await A.getByText('Com amigos', { exact: true }).first().click();
  await A.getByTestId('foxcap-friends').click();
  await nick(A, 'Ana');
  await A.waitForURL(/\/sala\//);
  const code = A.url().split('/sala/')[1]!.slice(0, 4);

  const B = await mk();
  await B.goto('/fox-cap');
  await B.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
  await B.getByText('Com amigos', { exact: true }).first().click();
  await B.getByLabel('Código da sala').fill(code);
  await B.getByRole('button', { name: 'Entrar', exact: true }).click();
  await nick(B, 'Bia');
  await B.waitForURL(/\/sala\//);

  await A.getByRole('tab', { name: /Jogos/i }).click();
  await A.getByTestId('pick-foxgp').click();
  await expect(A.getByTestId('themed-lobby')).toHaveAttribute('data-game', 'foxgp', { timeout: 20_000 });
  await B.getByRole('button', { name: /ESTOU PRONTO/i }).click();
  await A.getByRole('button', { name: /COMEÇAR/i }).click();
  await A.getByTestId('gp-play').waitFor({ timeout: 20_000 });
  await B.getByTestId('gp-play').waitFor({ timeout: 20_000 });

  // classificação: passados mais de 22 s, cada um "fecha" a volta (a Bia mais rápida)
  await A.waitForFunction(() => (window as Win).__gp?.phase === 'quali' && (window as Win).__gp!.t > 0.5, null, {
    timeout: 20_000,
  });
  await A.waitForTimeout(23_500);
  await finishQuali(A, 23.4);
  await finishQuali(B, 23.1);

  // grid pelos tempos: a Bia larga na frente
  const grid = A.getByTestId('gp-grid');
  await expect(grid).toBeVisible({ timeout: 15_000 });
  await expect(grid.locator('li').first()).toContainText('Bia');
  await expect(B.getByTestId('gp-grid')).toBeVisible();
  await expect(A.getByTestId('gp-lights')).toBeVisible({ timeout: 10_000 });
  await expect(A.getByTestId('gp-lap')).toBeVisible({ timeout: 15_000 });
  await expect(B.getByTestId('gp-lap')).toBeVisible({ timeout: 15_000 });

  // a Ana acelera: o carro dela anda na tela da Bia
  const anaOnB = () =>
    B.evaluate(() => {
      const w = (window as Win).__gp!;
      const c = w.cars.find((x) => x.id !== w.meId)!;
      return { x: c.x, z: c.z };
    });
  const before = await anaOnB();
  await A.bringToFront();
  await A.keyboard.down('KeyW');
  await A.waitForTimeout(2500);
  await A.keyboard.up('KeyW');
  const after = await anaOnB();
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(5);
  await expect(B.getByTestId('gp-board')).toBeVisible();

  // a líder encerra pelo menu: os dois vão para o pódio
  await A.getByTestId('gp-menu-btn').click();
  await A.getByTestId('gp-menu-end').click();
  // o menu pede um segundo toque para confirmar
  await A.getByTestId('gp-menu-end').click();
  await expect(A.getByTestId('gp-final')).toBeVisible({ timeout: 15_000 });
  await expect(B.getByTestId('gp-final')).toBeVisible({ timeout: 15_000 });
  await expect(A.getByTestId('gp-final-row-0')).toContainText('DNF');
});
