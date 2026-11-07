import { expect, test, type Page } from '@playwright/test';

/**
 * Ping Fox! em sala com DUAS janelas de verdade (spec 055, fase 3). Precisa do servidor só de salas e de um site que fale
 * com ele; por isso só roda com `E2E_ROOMS=1`:
 *
 *   pnpm --filter api exec esbuild scripts/rooms-only.ts --bundle --platform=node --outfile=/tmp/rooms-only.cjs && node /tmp/rooms-only.cjs
 *   VITE_API_URL=http://localhost:3340 pnpm --filter web exec vite --port 5180 --strictPort
 *   E2E_ROOMS=1 E2E_PORT=5180 pnpm --filter web exec playwright test e2e/ping-online.spec.ts --project=desktop
 */
test.skip(!process.env.E2E_ROOMS, 'precisa do servidor de salas (E2E_ROOMS=1)');
test.beforeEach(({ page: _page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});
test.setTimeout(240_000);

async function nick(page: Page, name: string) {
  await page.getByRole('dialog').locator('input').first().fill(name);
  await page.getByRole('button', { name: 'Entrar na sala' }).click();
}

/** O "jogador": um bot do próprio jogo no lugar do mouse (cada janela joga um lado). */
const drive = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as {
      __ping: {
        match: { lastHitter: number };
        net: { localPlayer: number };
        Bot: new (lv: unknown, rng: () => number) => { input(m: unknown, p: number): unknown };
        levels: Record<string, unknown>;
      };
      __pingForce?: unknown;
      __hits: number;
    };
    const g = w.__ping;
    const me = g.net.localPlayer;
    const bot = new g.Bot(g.levels.medio, Math.random);
    w.__hits = 0;
    let last = -1;
    setInterval(() => {
      w.__pingForce = bot.input(g.match, me);
      if (g.match.lastHitter === me && last !== me) w.__hits++;
      last = g.match.lastHitter;
    }, 16);
  });

const read = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as {
      __ping: { match: { score: number[]; phase: string; rally: number; tick: number } };
      __hits: number;
    };
    const m = w.__ping.match;
    return { score: [...m.score], phase: m.phase, rally: m.rally, tick: m.tick, hits: w.__hits };
  });

test('duas janelas jogam pela sala: as duas telas andam iguais e as batidas dos dois chegam', async ({
  browser,
}) => {
  const mk = async () => {
    const ctx = await browser.newContext({
      viewport: { width: 1100, height: 700 },
      locale: 'pt-BR',
    });
    return ctx.newPage();
  };
  const A = await mk();
  await A.goto('/fox-cap');
  await A.getByRole('button', { name: 'Agora não' })
    .click({ timeout: 8000 })
    .catch(() => undefined);
  await A.getByText('Com amigos', { exact: true }).first().click();
  await A.getByTestId('foxcap-friends').click();
  await nick(A, 'Ana');
  await A.waitForURL(/\/sala\//);
  const code = A.url().split('/sala/')[1]!.slice(0, 4);

  const B = await mk();
  await B.goto('/fox-cap');
  await B.getByRole('button', { name: 'Agora não' })
    .click({ timeout: 8000 })
    .catch(() => undefined);
  await B.getByText('Com amigos', { exact: true }).first().click();
  await B.getByLabel('Código da sala').fill(code);
  await B.getByRole('button', { name: 'Entrar', exact: true }).click();
  await nick(B, 'Bia');
  await B.waitForURL(/\/sala\//);

  await A.getByRole('tab', { name: /Jogos/i }).click();
  await A.getByTestId('pick-pingpong').click();
  await B.getByRole('button', { name: /ESTOU PRONTO/i }).click();
  await A.getByRole('button', { name: /COMEÇAR/i }).click();
  await A.getByTestId('png-play').waitFor({ timeout: 20_000 });
  await B.getByTestId('png-play').waitFor({ timeout: 20_000 });

  await drive(A);
  await drive(B);
  await A.waitForTimeout(40_000);
  const [ra, rb] = await Promise.all([read(A), read(B)]);
  // os dois aparelhos estão na mesma partida (mesmo placar, mesma troca) e os dois bateram na bola
  expect(ra.score, JSON.stringify({ ra, rb })).toEqual(rb.score);
  expect(Math.abs(ra.tick - rb.tick)).toBeLessThan(30);
  expect(ra.hits).toBeGreaterThanOrEqual(3);
  expect(rb.hits).toBeGreaterThanOrEqual(3);
  // quem joga do lado de lá vê a mesa como se estivesse perto da câmera: o nome do outro aparece no placar
  await expect(B.getByTestId('png-score')).toContainText('Ana');
  await expect(A.getByTestId('png-score')).toContainText('Bia');

  // a Bia recarrega a página no meio da partida: volta para a mesma sala, refaz a partida pelo histórico e segue
  await B.reload();
  await B.getByTestId('png-play').waitFor({ timeout: 30_000 });
  await B.waitForFunction(
    () => (window as unknown as { __ping?: { net: unknown } }).__ping?.net != null,
  );
  await drive(B);
  await B.waitForTimeout(25_000);
  const [pa, pb] = await Promise.all([read(A), read(B)]);
  expect(pb.score, JSON.stringify({ pa, pb })).toEqual(pa.score);
  expect(Math.abs(pa.tick - pb.tick)).toBeLessThan(30);
  expect(pb.hits).toBeGreaterThanOrEqual(1);
});

test('sozinho com um bot do outro lado: o líder põe o bot no lobby e a partida anda', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto('/fox-cap');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 8000 })
    .catch(() => undefined);
  await page.getByText('Com amigos', { exact: true }).first().click();
  await page.getByTestId('foxcap-friends').click();
  await nick(page, 'Ana');
  await page.waitForURL(/\/sala\//);
  await page.getByRole('tab', { name: /Jogos/i }).click();
  await page.getByTestId('pick-pingpong').click();
  // dois times, uma vaga cada: o lado vazio ganha um bot
  await page.getByRole('tab', { name: /Jogadores/i }).click();
  await expect(page.getByTestId('ping-side-0')).toBeVisible();
  await expect(page.getByTestId('ping-start-room')).toBeDisabled();
  await page.getByTestId('ping-bot-add-1').click();
  // o nível vem em Médio e muda por um botão ao lado do bot
  await expect(page.getByTestId('ping-bot-level')).toContainText('Médio');
  await page.getByTestId('ping-bot-level').click();
  await page.getByTestId('ping-level-facil').click();
  await expect(page.getByTestId('ping-bot-level')).toContainText('Fácil');
  await expect(page.getByTestId('ping-start-room')).toBeEnabled();
  await page.getByTestId('ping-start-room').click();
  await page.getByTestId('png-play').waitFor({ timeout: 20_000 });
  await drive(page);
  await page.waitForTimeout(30_000);
  const r = await read(page);
  // o bot da sala saca e rebate: houve troca de bolas e o relógio da partida andou
  expect(r.tick).toBeGreaterThan(600);
  expect(r.score[0]! + r.score[1]!).toBeGreaterThan(0);
});

test('encerrar a sala: todo mundo sai e ninguém fica preso no "entrando na sala"', async ({
  browser,
}) => {
  const mk = async () => {
    const ctx = await browser.newContext({
      viewport: { width: 1100, height: 700 },
      locale: 'pt-BR',
    });
    return ctx.newPage();
  };
  const A = await mk();
  await A.goto('/fox-cap');
  await A.getByRole('button', { name: 'Agora não' })
    .click({ timeout: 8000 })
    .catch(() => undefined);
  await A.getByText('Com amigos', { exact: true }).first().click();
  await A.getByTestId('foxcap-friends').click();
  await nick(A, 'Ana');
  await A.waitForURL(/\/sala\//);
  const code = A.url().split('/sala/')[1]!.slice(0, 4);
  const B = await mk();
  await B.goto('/fox-cap');
  await B.getByRole('button', { name: 'Agora não' })
    .click({ timeout: 8000 })
    .catch(() => undefined);
  await B.getByText('Com amigos', { exact: true }).first().click();
  await B.getByLabel('Código da sala').fill(code);
  await B.getByRole('button', { name: 'Entrar', exact: true }).click();
  await nick(B, 'Bia');
  await B.waitForURL(/\/sala\//);
  await expect(A.getByText('Bia').first()).toBeVisible({ timeout: 15000 });
  // a Ana encerra a sala
  await A.getByRole('button', { name: 'Encerrar', exact: true }).first().click({ timeout: 15000 });
  await A.getByRole('button', { name: 'Encerrar', exact: true }).last().click({ timeout: 15000 });
  for (const page of [A, B]) {
    // todo mundo volta para a tela do jogo (Fox Cap!), com o aviso, e nunca para a tela de entrada da Mesmíssima
    await expect(page).toHaveURL(/\/fox-cap/, { timeout: 15000 });
    await expect(page.getByTestId('room-toast')).toContainText(/sala foi encerrada/i, {
      timeout: 5000,
    });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Entrando na sala')).toHaveCount(0);
    await expect(page.getByText('Mesmíssima')).toHaveCount(0);
  }
});

test('o líder encerra a partida pelo menu e as duas telas vão para o fim', async ({ browser }) => {
  const mk = async () => {
    const ctx = await browser.newContext({
      viewport: { width: 1100, height: 700 },
      locale: 'pt-BR',
    });
    return ctx.newPage();
  };
  const A = await mk();
  await A.goto('/fox-cap');
  await A.getByRole('button', { name: 'Agora não' })
    .click({ timeout: 8000 })
    .catch(() => undefined);
  await A.getByText('Com amigos', { exact: true }).first().click();
  await A.getByTestId('foxcap-friends').click();
  await nick(A, 'Ana');
  await A.waitForURL(/\/sala\//);
  const code = A.url().split('/sala/')[1]!.slice(0, 4);
  const B = await mk();
  await B.goto('/fox-cap');
  await B.getByRole('button', { name: 'Agora não' })
    .click({ timeout: 8000 })
    .catch(() => undefined);
  await B.getByText('Com amigos', { exact: true }).first().click();
  await B.getByLabel('Código da sala').fill(code);
  await B.getByRole('button', { name: 'Entrar', exact: true }).click();
  await nick(B, 'Bia');
  await B.waitForURL(/\/sala\//);
  await A.getByRole('tab', { name: /Jogos/i }).click();
  await A.getByTestId('pick-pingpong').click();
  await B.getByRole('button', { name: /ESTOU PRONTO/i }).click();
  await A.getByRole('button', { name: /COMEÇAR/i }).click();
  await A.getByTestId('png-play').waitFor({ timeout: 20_000 });
  await B.getByTestId('png-play').waitFor({ timeout: 20_000 });
  await A.waitForTimeout(6000);
  // só o líder tem o botão
  await B.keyboard.press('Escape');
  await expect(B.getByTestId('png-menu')).toBeVisible();
  await expect(B.getByTestId('png-menu-end')).toHaveCount(0);
  await B.getByTestId('png-menu-continue').click();
  // o líder encerra (pede um segundo toque)
  await A.keyboard.press('Escape');
  await A.getByTestId('png-menu-end').click();
  await A.getByTestId('png-menu-end').click();
  for (const page of [A, B]) {
    await expect(page.getByTestId('png-final-a')).toBeVisible({ timeout: 15000 });
  }
});
