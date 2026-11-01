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
test.setTimeout(180_000);

async function nick(page: Page, name: string) {
  await page.getByRole('dialog').locator('input').first().fill(name);
  await page.getByRole('button', { name: 'Entrar na sala' }).click();
}

/** O "jogador": segue o anel de alcance e saca quando é a vez dele. */
const drive = (page: Page) =>
  page.evaluate(() => {
    const zone = document.querySelector('.png-zone') as HTMLElement;
    const r = zone.getBoundingClientRect();
    const fire = (type: string, x: number, y: number, extra: PointerEventInit = {}) =>
      zone.dispatchEvent(
        new PointerEvent(type, {
          clientX: x,
          clientY: y,
          pointerType: 'mouse',
          bubbles: true,
          pointerId: 1,
          ...extra,
        }),
      );
    const w = window as unknown as {
      __ping: {
        match: { phase: string; server: number; lastHitter: number };
        net: { localPlayer: number };
        scene: {
          reticle(): { x: number; y: number } | null;
          project(x: number, y: number, z: number): { nx: number; ny: number };
        };
      };
      __hits: number;
    };
    w.__hits = 0;
    let last = -1;
    setInterval(() => {
      const g = w.__ping;
      if (!g?.net) return;
      const m = g.match;
      const me = g.net.localPlayer;
      const tgt = g.scene.reticle();
      if (tgt) {
        const q = g.scene.project(tgt.x, tgt.y, 2.45);
        fire('pointermove', r.left + q.nx * r.width, r.top + q.ny * r.height);
      } else if (m.phase === 'serve' && m.server === me) {
        const q = g.scene.project(0, 1.35, 2.45);
        fire('pointermove', r.left + q.nx * r.width, r.top + q.ny * r.height);
        fire('pointerdown', r.left + q.nx * r.width, r.top + q.ny * r.height, { button: 0 });
      }
      if (m.lastHitter === me && last !== me) w.__hits++;
      last = m.lastHitter;
    }, 40);
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

  await A.getByRole('tab', { name: /Regras/i }).click();
  await A.getByTestId('pick-pingpong').click();
  await B.getByRole('button', { name: /ESTOU PRONTO/i }).click();
  await A.getByRole('button', { name: /COMEÇAR/i }).click();
  await A.getByTestId('png-play').waitFor({ timeout: 20_000 });
  await B.getByTestId('png-play').waitFor({ timeout: 20_000 });

  await drive(A);
  await drive(B);
  await A.waitForTimeout(25_000);
  const [ra, rb] = await Promise.all([read(A), read(B)]);
  // os dois aparelhos estão na mesma partida (mesmo placar, mesma troca) e os dois bateram na bola
  expect(ra.score, JSON.stringify({ ra, rb })).toEqual(rb.score);
  expect(Math.abs(ra.tick - rb.tick)).toBeLessThan(30);
  expect(ra.hits).toBeGreaterThanOrEqual(4);
  expect(rb.hits).toBeGreaterThanOrEqual(4);
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
  await B.waitForTimeout(12_000);
  const [pa, pb] = await Promise.all([read(A), read(B)]);
  expect(pb.score, JSON.stringify({ pa, pb })).toEqual(pa.score);
  expect(Math.abs(pa.tick - pb.tick)).toBeLessThan(30);
  expect(pb.hits).toBeGreaterThanOrEqual(1);
});
