import { expect, test, type Page } from '@playwright/test';

/**
 * Fox GP em sala com DUAS janelas de verdade (specs 078 a 080): criar a sala do Fox Cap!, escolher o Fox GP e a física,
 * classificação, grid,
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
  cars: {
    id: string;
    x: number;
    z: number;
    h: number;
    vx: number;
    vz: number;
    prog: number;
    qualiStartT: number | null;
    qualiStartProg: number;
    qualiMs: number | null;
    pitHold: number;
    surface: string;
    speed: number;
  }[];
}
type Win = Window & { __gp?: W; __gpAuto?: boolean };

async function nick(page: Page, name: string) {
  await page.getByRole('dialog').locator('input').first().fill(name);
  await page.getByRole('button', { name: 'Entrar na sala' }).click();
}

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
  // regra da sala: a líder escolhe a física Realista (só ela pode); todos correm nesse modo
  await A.getByRole('tab', { name: /Configurar|Regras/ }).click();
  await A.getByRole('radio', { name: 'Realista' }).click();
  await expect(A.getByRole('radio', { name: 'Realista' })).toHaveAttribute('aria-checked', 'true');
  await B.getByRole('button', { name: /ESTOU PRONTO/i }).click();
  await A.getByRole('button', { name: /COMEÇAR/i }).click();
  await A.getByTestId('gp-play').waitFor({ timeout: 20_000 });
  await B.getByTestId('gp-play').waitFor({ timeout: 20_000 });
  for (const p of [A, B]) await expect(p.getByTestId('gp-play')).toHaveAttribute('data-physics', 'real');

  // classificação: quem simula é a Ana (líder). Passados mais de 22 s, os dois "fecham" a volta no mundo dela (a Bia mais
  // rápida); o tempo de cada um vai para a sala pelo relato da líder
  await A.waitForFunction(() => (window as Win).__gp?.phase === 'quali' && (window as Win).__gp!.t > 0.5, null, {
    timeout: 20_000,
  });
  await A.waitForTimeout(23_500);
  await A.evaluate(() => {
    const w = (window as Win).__gp!;
    w.cars.forEach((c, i) => {
      c.qualiStartT = w.t - (i === 0 ? 23.4 : 23.1);
      c.qualiStartProg = 0;
      c.prog = w.track.length - 0.2;
      // no Realista a velocidade é o número `speed` (sempre para o nariz); no Arcade, o vetor
      c.speed = 15;
      c.vx = Math.sin(c.h) * 15;
      c.vz = -Math.cos(c.h) * 15;
      c.pitHold = 0;
      c.surface = 'asphalt';
    });
  });

  // grid pelos tempos: a Bia larga na frente
  const grid = A.getByTestId('gp-grid');
  await expect(grid).toBeVisible({ timeout: 15_000 });
  await expect(grid.locator('li').first()).toContainText('Bia');
  await expect(B.getByTestId('gp-grid')).toBeVisible();
  await expect(A.getByTestId('gp-lights')).toBeVisible({ timeout: 10_000 });
  await expect(A.getByTestId('gp-lap')).toBeVisible({ timeout: 15_000 });
  await expect(B.getByTestId('gp-lap')).toBeVisible({ timeout: 15_000 });
  // o selo da volta já aparece no grid e nas luzes: só mede depois que as luzes apagam
  for (const p of [A, B])
    await p.waitForFunction(() => (window as Win).__gp?.phase === 'race' && (window as Win).__gp!.t > 0.3, null, {
      timeout: 20_000,
    });

  // corrida: os dois no piloto automático. O carro da Ana anda na tela da Bia; o da Bia, simulado pela Ana a partir da
  // entrada que a Bia manda, anda na tela da Ana
  const carOn = (p: Page, mine: boolean) =>
    p.evaluate((m) => {
      const w = (window as Win).__gp!;
      const c = w.cars.find((x) => (m ? x.id === w.meId : x.id !== w.meId))!;
      return { x: c.x, z: c.z };
    }, mine);
  const anaOnB0 = await carOn(B, false);
  const biaOnA0 = await carOn(A, false);
  await A.evaluate(() => ((window as Win).__gpAuto = true));
  await B.evaluate(() => ((window as Win).__gpAuto = true));
  await A.waitForTimeout(5000);
  const anaOnB1 = await carOn(B, false);
  const biaOnA1 = await carOn(A, false);
  expect(Math.hypot(anaOnB1.x - anaOnB0.x, anaOnB1.z - anaOnB0.z)).toBeGreaterThan(20);
  expect(Math.hypot(biaOnA1.x - biaOnA0.x, biaOnA1.z - biaOnA0.z)).toBeGreaterThan(20);
  // e a Bia vê o próprio carro onde a líder o vê (previsão + correção)
  const biaOnB = await carOn(B, true);
  expect(Math.hypot(biaOnB.x - biaOnA1.x, biaOnB.z - biaOnA1.z)).toBeLessThan(25);
  const net = await B.getByTestId('net-badge').textContent();
  test.info().annotations.push({ type: 'rede da Bia', description: net ?? '' });
  await expect(B.getByTestId('gp-board')).toBeVisible();

  // a líder encerra pelo menu: os dois vão para o pódio
  await A.getByTestId('gp-menu-btn').click();
  await A.getByTestId('gp-menu-end').click();
  // o menu pede um segundo toque para confirmar
  await A.getByTestId('gp-menu-end').click();
  await expect(A.getByTestId('gp-final')).toBeVisible({ timeout: 15_000 });
  await expect(B.getByTestId('gp-final')).toBeVisible({ timeout: 15_000 });
  await expect(A.getByTestId('gp-final-row-0')).toContainText('DNF');

  // a Bia sai do pódio: vai direto para a tela do Fox GP, sem nenhum quadro da sala ou da lista do Fox Cap! (Fase 1.5)
  await B.evaluate(() => {
    const w = window as Window & { __saw?: string[]; __watch?: boolean };
    w.__saw = [];
    w.__watch = true;
    const tick = () => {
      if (document.querySelector('[data-testid="foxcap-foxgp"]')) w.__saw!.push('lista');
      if (!document.querySelector('[data-testid="gp-final"]') && !document.querySelector('[data-testid="gp-home"]'))
        w.__saw!.push(location.pathname);
      if (w.__watch) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await B.getByTestId('final-leave').click();
  await expect(B.getByTestId('gp-home')).toBeVisible({ timeout: 15_000 });
  await expect(B.getByTestId('gp-home')).toHaveAttribute('data-back', '1');
  await B.waitForTimeout(800);
  const saw = await B.evaluate(() => {
    const w = window as Window & { __saw?: string[]; __watch?: boolean };
    w.__watch = false;
    return w.__saw;
  });
  expect(saw).toEqual([]);
});
