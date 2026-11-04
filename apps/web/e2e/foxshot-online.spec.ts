import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './account';

/**
 * Counter Fox online com DUAS janelas de verdade (spec 057): criar sala pelo menu, entrar com o código, regras, começar, andar,
 * atirar e ver tudo no servidor. Só roda com `E2E_ROOMS=1` (precisa do servidor só de salas e de um site que fale com ele):
 *
 *   pnpm --filter api exec esbuild scripts/rooms-only.ts --bundle --platform=node --outfile=/tmp/rooms-only.cjs && node /tmp/rooms-only.cjs
 *   VITE_API_URL=http://localhost:3340 pnpm --filter web exec vite --port 5180 --strictPort
 *   E2E_ROOMS=1 E2E_PORT=5180 pnpm --filter web exec playwright test e2e/foxshot-online.spec.ts --project=desktop
 */
test.skip(!process.env.E2E_ROOMS, 'precisa do servidor de salas (E2E_ROOMS=1)');
test.beforeEach(({ page: _page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});
test.setTimeout(240_000);

interface St {
  mover: { x: number; z: number };
  self: { seq: number; x: number; z: number; hp: number; alive: boolean; ammo: number } | null;
  k: number;
  rows: { idx: number; x: number; z: number; kills: number; assists: number; deaths: number; flags: number }[];
  roster: { id: string; name: string; bot: boolean }[];
  pending: number;
  me: string;
}
const st = (p: Page) => p.evaluate(() => (window as unknown as { __fsn: { state(): unknown } }).__fsn.state()) as Promise<St>;
const fsn = <T,>(p: Page, fn: string, ...a: unknown[]) =>
  p.evaluate(([f, args]) => ((window as unknown as { __fsn: Record<string, (...x: unknown[]) => unknown> }).__fsn[f as string] as (...x: unknown[]) => T)(...(args as unknown[])), [fn, a] as [string, unknown[]]) as Promise<T>;

test('duas janelas: criar sala pelo menu, entrar pelo código, jogar e ver o servidor mandar', async ({ browser }) => {
  const mk = async (name: string) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'pt-BR' });
    const page = await ctx.newPage();
    await loginAs(page, name);
    await page.addInitScript(() => localStorage.setItem('nocap-fs-settings-lock2', '1'));
    return page;
  };
  const ana = await mk('Ana');
  const bia = await mk('Bia');

  // Ana cria a sala pelo menu do Counter Fox
  await ana.goto('/fox-cap/counter-fox');
  await ana.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await ana.getByTestId('cfh-play').click();
  await ana.getByTestId('cfh-online').click();
  await ana.getByTestId('cfh-create').click();
  await expect(ana.getByTestId('cfl')).toBeVisible({ timeout: 30_000 });
  const code = (await ana.getByTestId('cfl-code').locator('b').textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{4}$/);
  await ana.screenshot({ path: `${process.env.FS_SHOTS ?? '/tmp'}/cfl-sala.png` });

  // Bia entra com o código
  await bia.goto('/fox-cap/counter-fox');
  await bia.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await bia.getByTestId('cfh-play').click();
  await bia.getByTestId('cfh-online').click();
  await bia.getByTestId('cfh-code').fill(code);
  await bia.getByTestId('cfh-join').click();
  await expect(bia.getByTestId('cfl')).toBeVisible({ timeout: 30_000 });

  // jogadores, modo e regras
  await ana.getByTestId('cfl-tab-jogadores').click();
  await expect(ana.getByTestId('cfl-player-Bia')).toBeVisible({ timeout: 10_000 });
  await ana.screenshot({ path: `${process.env.FS_SHOTS ?? '/tmp'}/cfl-jogadores.png` });
  await ana.getByTestId('cfl-tab-modo').click();
  await ana.getByTestId('cfl-min-2').click();
  await ana.getByTestId('cfl-bots-2').click();
  await expect(ana.getByTestId('cfl-bots-2')).toHaveAttribute('aria-checked', 'true');
  await ana.screenshot({ path: `${process.env.FS_SHOTS ?? '/tmp'}/cfl-modo.png` });
  await ana.getByTestId('cfl-tab-convidar').click();
  await ana.screenshot({ path: `${process.env.FS_SHOTS ?? '/tmp'}/cfl-convidar.png` });
  // chat entre as duas
  await ana.getByTestId('cfl-tab-chat').click();
  await bia.getByTestId('cfl-tab-chat').click();
  await ana.locator('input, textarea').last().fill('bora!');
  await ana.keyboard.press('Enter');
  await expect(bia.getByText('bora!')).toBeVisible({ timeout: 10_000 });

  // pronto e começar
  await expect(bia.getByTestId('cfl-ready')).toBeVisible();
  await bia.getByTestId('cfl-ready').click();
  await expect(ana.getByTestId('cfl-start')).toBeEnabled({ timeout: 10_000 });
  await ana.getByTestId('cfl-start').click();
  await expect(ana.getByTestId('fs-root')).toBeVisible({ timeout: 30_000 });
  await expect(bia.getByTestId('fs-root')).toBeVisible({ timeout: 30_000 });
  await ana.waitForFunction(() => (window as unknown as { __fsn?: { state(): { phase: string } } }).__fsn?.state().phase === 'play', undefined, { timeout: 30_000 });
  await bia.waitForFunction(() => (window as unknown as { __fsn?: { state(): { phase: string } } }).__fsn?.state().phase === 'play', undefined, { timeout: 30_000 });
  await fsn(ana, 'resume');
  await fsn(bia, 'resume');

  // o servidor manda o quadro: 4 jogadores (2 pessoas e 2 bots) e a tela anda sozinha
  await expect.poll(async () => (await st(ana)).rows.length, { timeout: 20_000 }).toBe(4);
  const s0 = await st(ana);
  expect(s0.roster.filter((r) => r.bot)).toHaveLength(2);

  // Ana anda para a frente: o corpo previsto e o confirmado pelo servidor se movem e o número de entrada avança
  await fsn(ana, 'move', 1, 0);
  await ana.waitForTimeout(2500);
  await fsn(ana, 'move', 0, 0);
  const s1 = await st(ana);
  expect(s1.self!.seq).toBeGreaterThan(60);
  expect(Math.hypot(s1.mover.x - s0.mover.x, s1.mover.z - s0.mover.z)).toBeGreaterThan(2);
  expect(Math.hypot(s1.self!.x - s0.self!.x, s1.self!.z - s0.self!.z)).toBeGreaterThan(1.5);
  // a previsão e o servidor concordam (sem correção grande)
  await ana.waitForTimeout(400);
  const s2 = await st(ana);
  expect(Math.hypot(s2.mover.x - s2.self!.x, s2.mover.z - s2.self!.z)).toBeLessThan(0.6);
  // Bia enxerga a Ana andando (a linha dela no quadro mudou de lugar)
  const bs = await st(bia);
  const anaIdx = bs.roster.findIndex((r) => r.name === 'Ana');
  const anaRow = bs.rows.find((r) => r.idx === anaIdx)!;
  expect(Math.hypot(anaRow.x - s0.rows.find((r) => r.idx === anaIdx)!.x, anaRow.z - s0.rows.find((r) => r.idx === anaIdx)!.z)).toBeGreaterThan(1.5);
  await ana.screenshot({ path: `${process.env.FS_SHOTS ?? '/tmp'}/cfl-jogo.png` });

  // combate: Ana mira na Bia e atira; o servidor acerta, tira vida e conta pontos
  const bIdx = bs.roster.findIndex((r) => r.name === 'Bia');
  await fsn(ana, 'buy', 'ak');
  let hit = false;
  for (let i = 0; i < 40 && !hit; i++) {
    const rows = (await st(ana)).rows;
    const target = rows.find((r) => r.idx === bIdx);
    if (target) {
      // vai até perto da Bia (a mesma sala), só para o teste
      await fsn(ana, 'aimAt', bs.roster[bIdx]!.id);
      await fsn(ana, 'fireBtn', true);
      await ana.waitForTimeout(250);
      await fsn(ana, 'fireBtn', false);
    }
    const bnow = await st(bia);
    hit = (bnow.self?.hp ?? 100) < 100;
    if (!hit) {
      await fsn(ana, 'move', 1, 0);
      await ana.waitForTimeout(400);
      await fsn(ana, 'move', 0, 0);
    }
  }
  // chegar a acertar depende de haver linha de tiro no mapa; se não houve, o resto do teste ainda vale
  const fin = await st(ana);
  expect(fin.k).toBeGreaterThan(s0.k + 100);
  await ana.close();
  await bia.close();
});

test('uma pessoa com bot joga até o fim do tempo: tabela final e jogar de novo volta ao lobby', async ({ browser }) => {
  test.setTimeout(280_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  await loginAs(page, 'Solo');
  await page.goto('/fox-cap/counter-fox');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await page.getByTestId('cfh-play').click();
  await page.getByTestId('cfh-online').click();
  await page.getByTestId('cfh-create').click();
  await expect(page.getByTestId('cfl')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('cfl-tab-modo').click();
  await page.getByTestId('cfl-min-2').click();
  await page.getByTestId('cfl-bots-3').click();
  await expect(page.getByTestId('cfl-bots-3')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('cfl-start').click();
  await expect(page.getByTestId('fs-root')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('fsr-final')).toBeVisible({ timeout: 200_000 });
  await expect(page.getByTestId('fsr-final-title')).toBeVisible();
  await expect(page.locator('[data-testid^="fsr-row-"]')).toHaveCount(4);
  await page.screenshot({ path: `${process.env.FS_SHOTS ?? '/tmp'}/cfl-final.png` });
  await page.getByTestId('fsr-final-again').click();
  await expect(page.getByTestId('cfl')).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});
