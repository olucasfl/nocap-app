import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { DEVICES, measure, setDevice } from './mobile-lib';

/**
 * Salas online com DUAS janelas no tamanho de celular (docs/MOBILE-GUIDE.md): lobby, escolha de jogo, chat, e o Mini Golf em
 * sala (partida, placar e pódio). Mede as duas janelas em cada etapa. Mesmo preparo do golf-online.spec.ts:
 *   node /tmp/rooms-only.cjs   (porta 3340)
 *   VITE_API_URL=http://localhost:3340 pnpm exec vite --port 5180 --strictPort
 *   E2E_ROOMS=1 E2E_PORT=5180 pnpm exec playwright test e2e/mobile-online.spec.ts --project=desktop --trace off
 * ONLINE_DEV filtra aparelhos; ONLINE_OUT muda a pasta de saída.
 */
test.skip(!process.env.E2E_ROOMS, 'precisa do servidor de salas (E2E_ROOMS=1)');
const OUT = process.env.ONLINE_OUT ?? 'test-results/mobile-online';
const only = (process.env.ONLINE_DEV ?? 'se,pixel,se-land,iph15-land,ipad').split(',');

async function nick(page: Page, name: string) {
  await page.getByRole('dialog').locator('input').first().fill(name);
  await page.getByRole('button', { name: 'Entrar na sala' }).click();
}

for (const d of DEVICES.filter((x) => only.includes(x.name))) {
  test(`online golf ${d.name}`, async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    test.setTimeout(180_000);
    mkdirSync(OUT, { recursive: true });
    const report: string[] = [];
    const mk = async () => {
      const ctx = await browser.newContext({ locale: 'pt-BR', viewport: { width: d.w, height: d.h } });
      const p = await ctx.newPage();
      await p.addInitScript(() => localStorage.setItem('nocap-mute', '1'));
      const cdp = await ctx.newCDPSession(p);
      await setDevice(p, cdp, d);
      return p;
    };
    const check = async (label: string, pages: [string, Page][]) => {
      for (const [who, p] of pages) {
        await p.waitForTimeout(500);
        await p.screenshot({ path: `${OUT}/${label}-${who}-${d.name}.png` });
        for (const m of await measure(p, d)) report.push(`${label}/${who}: ${m}`);
      }
    };
    const dismiss = (p: Page) => p.getByRole('button', { name: 'Agora não' }).click({ timeout: 6000 }).catch(() => undefined);

    const A = await mk();
    await A.goto('/minigolf');
    await dismiss(A);
    await A.getByTestId('mg-online').click();
    await check('golf-online-menu', [['A', A]]);
    await A.getByTestId('mg-create').click();
    await nick(A, 'Ana');
    await A.waitForURL(/\/sala\//);
    const code = A.url().split('/sala/')[1]!.slice(0, 4);

    const B = await mk();
    await B.goto('/minigolf');
    await dismiss(B);
    await B.getByTestId('mg-online').click();
    await B.getByTestId('mg-code').fill(code);
    await B.getByRole('button', { name: 'Entrar', exact: true }).click();
    await nick(B, 'Bia');
    await B.waitForURL(/\/sala\//);

    await expect(A.getByTestId('golf-lobby').locator('li')).toHaveCount(2, { timeout: 20_000 });
    await expect(B.getByTestId('golf-lobby')).toBeVisible({ timeout: 20_000 });
    await check('golf-lobby', [['A', A], ['B', B]]);

    await B.getByRole('button', { name: /estou pronto/i }).first().click();
    await A.getByRole('button', { name: /começar/i }).first().click({ timeout: 20_000 });
    await expect(A.getByTestId('golf-time')).toBeVisible({ timeout: 25_000 });
    await expect(B.getByTestId('golf-time')).toBeVisible({ timeout: 25_000 });
    await check('golf-jogo', [['A', A], ['B', B]]);

    // placar: pelo botão (no celular não há TAB)
    await A.getByTestId('golf-board-btn').click();
    await expect(A.getByTestId('golf-board')).toBeVisible();
    await check('golf-placar', [['A', A]]);
    await A.getByTestId('golf-end').click();
    await expect(A.getByTestId('golf-final')).toBeVisible({ timeout: 15_000 });
    await expect(B.getByTestId('golf-final')).toBeVisible({ timeout: 15_000 });
    await check('golf-podio', [['A', A], ['B', B]]);

    writeFileSync(`${OUT}/golf-${d.name}.json`, JSON.stringify(report, null, 1));
    expect(report, report.join('\n')).toEqual([]);
  });
}

/** Sala genérica (criada pelo hub): cada jogo escolhido na sala, lobby e abas medidos nas duas janelas. */
const PICKS = ['foxshot', 'foxgp', 'atravessa', 'desmorona', 'bola', 'pingpong', 'time', 'color', 'eco', 'impostor'];
for (const d of DEVICES.filter((x) => only.includes(x.name) && x.name !== 'ipad')) {
  test(`online salas ${d.name}`, async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    test.setTimeout(240_000);
    mkdirSync(OUT, { recursive: true });
    const report: string[] = [];
    const mk = async () => {
      const ctx = await browser.newContext({ locale: 'pt-BR', viewport: { width: d.w, height: d.h } });
      const p = await ctx.newPage();
      await p.addInitScript(() => localStorage.setItem('nocap-mute', '1'));
      const cdp = await ctx.newCDPSession(p);
      await setDevice(p, cdp, d);
      return p;
    };
    const check = async (label: string, pages: [string, Page][]) => {
      for (const [who, p] of pages) {
        await p.waitForTimeout(450);
        await p.screenshot({ path: `${OUT}/${label}-${who}-${d.name}.png` });
        for (const m of await measure(p, d)) report.push(`${label}/${who}: ${m}`);
      }
    };
    const dismiss = (p: Page) => p.getByRole('button', { name: 'Agora não' }).click({ timeout: 6000 }).catch(() => undefined);
    const A = await mk();
    await A.goto('/');
    await dismiss(A);
    await A.getByTestId('hub-room-toggle').click();
    await check('hub-sala-aberta', [['A', A]]);
    await A.getByTestId('hub-create-room').click();
    await nick(A, 'Ana');
    await A.waitForURL(/\/sala\//);
    const code = A.url().split('/sala/')[1]!.slice(0, 4);
    const B = await mk();
    await B.goto('/');
    await dismiss(B);
    await B.getByTestId('hub-room-toggle').click();
    await B.getByTestId('hub-room-code').fill(code);
    await B.getByRole('button', { name: 'Entrar', exact: true }).click();
    await nick(B, 'Bia');
    await B.waitForURL(/\/sala\//);
    await expect(A.getByRole('tab', { name: /Jogos/i }).first()).toBeVisible({ timeout: 20_000 });
    await check('sala-inicial', [['A', A], ['B', B]]);
    for (const g of PICKS) {
      const tab = A.getByRole('tab', { name: /Jogos|Outros jogos/i }).first();
      if (await tab.count()) await tab.click().catch(() => undefined);
      const pick = A.getByTestId(`pick-${g}`);
      if (!(await pick.count())) {
        report.push(`pick-${g}: botão do jogo não achado na sala`);
        continue;
      }
      await pick.scrollIntoViewIfNeeded();
      await check(`sala-escolha-${g}`, [['A', A]]);
      await pick.click();
      await A.waitForTimeout(900);
      await check(`sala-${g}`, [['A', A], ['B', B]]);
    }
    writeFileSync(`${OUT}/salas-${d.name}.json`, JSON.stringify(report, null, 1));
    expect(report, report.join('\n')).toEqual([]);
  });
}
