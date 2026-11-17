import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { DEVICES, measure, setDevice } from './mobile-lib';

/**
 * Impostor em sala (spec 088) com TRÊS janelas de verdade: criar a sala pelo /mesa, entrar por código, regras e temas,
 * papéis secretos, dicas na vez, debate, voto secreto, chute, ranking que soma, "continuar jogando" e ranking final.
 * Só roda com `E2E_ROOMS=1` (servidor de salas em :3340 e o web em :5180, como o golf-online.spec.ts).
 */
test.skip(!process.env.E2E_ROOMS, 'precisa do servidor de salas (E2E_ROOMS=1)');
// uma ação que não acontece falha rápido, com a linha, em vez de esperar o teste inteiro
test.use({ actionTimeout: 15_000 });
const OUT = process.env.SALA_OUT ?? 'test-results/impostor-sala';
const only = (process.env.SALA_DEV ?? 'se,ipad-land').split(',');

async function nick(page: Page, name: string) {
  await page.getByRole('dialog').locator('input').first().fill(name);
  await page.getByRole('button', { name: 'Entrar na sala' }).click();
}

async function hold(page: Page) {
  const b = (await page.getByTestId('sala-hold').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId('sala-secret')).not.toBeEmpty();
  await page.mouse.up();
}

for (const d of DEVICES.filter((x) => only.includes(x.name))) {
  test(`impostor sala ${d.name}`, async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    test.setTimeout(300_000);
    mkdirSync(OUT, { recursive: true });
    const report: string[] = [];
    const mk = async (keepSplash = false) => {
      const ctx = await browser.newContext({ locale: 'pt-BR', viewport: { width: d.w, height: d.h } });
      const p = await ctx.newPage();
      await p.addInitScript((keep) => { localStorage.setItem('nocap-mute', '1'); if (!keep) localStorage.setItem('im-nosplash', '1'); }, keepSplash);
      const cdp = await ctx.newCDPSession(p);
      await setDevice(p, cdp, d);
      return p;
    };
    const check = async (label: string, p: Page) => {
      await p.waitForTimeout(600);
      if (process.env.SALA_SHOTS) await p.screenshot({ path: `${OUT}/${label}-${d.name}.png` });
      for (const m of await measure(p, d)) report.push(`${label}: ${m}`);
    };
    const dismiss = (p: Page) => p.getByRole('button', { name: 'Agora não' }).click({ timeout: 4000 }).catch(() => undefined);

    // Ana cria a sala pelo menu de jogos de mesa
    const A = await mk();
    await A.goto('/mesa');
    await dismiss(A);
    await A.getByTestId('mesa-jogar').click();
    await A.getByTestId('mesa-online').click();
    await A.getByTestId('mesa-create').click();
    await nick(A, 'Ana');
    await A.waitForURL(/\/sala\//);
    const code = A.url().split('/sala/')[1]!.slice(0, 4);
    await expect(A.getByTestId('sala-lobby')).toBeVisible({ timeout: 25_000 });

    const join = async (name: string, keepSplash = false) => {
      const P = await mk(keepSplash);
      await P.goto('/');
      await dismiss(P);
      await P.getByTestId('hub-room-toggle').click();
      await P.getByTestId('hub-room-code').fill(code);
      await P.getByRole('button', { name: 'Entrar', exact: true }).click();
      await nick(P, name);
      await P.waitForURL(/\/sala\//);
      await expect(P.getByTestId('sala-lobby')).toBeVisible({ timeout: 25_000 });
      return P;
    };
    const B = await join('Bia');
    const C = await join('Cris', true);
    const all = [A, B, C];
    await expect(A.getByTestId('sala-tab-mesa')).toContainText('3');
    await check('lobby-jogadores', A);

    // aba Convidar (no lugar do botão do topo)
    await A.getByTestId('sala-tab-convidar').click();
    await expect(A.getByTestId('sala-invite-panel')).toBeVisible();
    await check('lobby-convidar', A);
    await A.getByTestId('sala-tab-mesa').click();

    // chat do Impostor: Ana escreve e Bia lê
    await A.getByTestId('sala-chat-btn').click();
    await A.getByTestId('sala-chat-input').fill('bora jogar');
    await A.getByTestId('sala-chat-send').click();
    await check('chat', A);
    await A.keyboard.press('Escape');
    await B.getByTestId('sala-chat-btn').click();
    await expect(B.getByTestId('sala-chat-list')).toContainText('bora jogar');
    await B.keyboard.press('Escape');

    // sem tema: erro visível
    await A.getByTestId('sala-start').click();
    await expect(A.getByRole('alert')).toBeVisible();
    await check('erro-sem-tema', A);
    await A.getByTestId('sala-tab-regras').click();
    await expect(A.getByTestId('sala-instr')).toBeVisible();
    await A.getByTestId('sala-cat-comida').click();
    await A.getByTestId('sala-cat-animais').click();
    await check('lobby-regras', A);
    // os outros veem as regras e marcam pronto
    await B.getByTestId('sala-tab-regras').click();
    await expect(B.getByText('Só quem criou a sala muda as regras.')).toBeVisible();
    await check('lobby-regras-membro', B);
    await B.getByTestId('sala-ready').click();
    await C.getByTestId('sala-ready').click();

    const playGame = async (label: string) => {
      await A.getByTestId('sala-start').click();
      // quem não desligou a cartela vê "Nª partida" antes do papel (só na primeira partida, para não alongar o teste)
      if (label === 'partida1') await expect(C.getByTestId('sala-splash')).toBeVisible({ timeout: 20_000 });
      for (const p of all) await expect(p.getByTestId('sala-role')).toBeVisible({ timeout: 20_000 });
      await check(`${label}-papel`, A);
      for (const p of all) {
        await hold(p);
        await p.getByTestId('sala-seen').click();
      }
      // dicas: quem tem o campo é quem fala; 3 rodadas x 3 pessoas
      for (let g = 0; g < 40; g++) {
        if (await A.getByTestId('sala-debate').isVisible().catch(() => false)) break;
        for (const p of all) {
          if (await p.getByTestId('sala-clue-input').isVisible().catch(() => false)) {
            if (g === 0) await check(`${label}-dicas`, p);
            await p.getByTestId('sala-clue-input').fill(`dica${g}x`);
            await p.getByTestId('sala-clue-send').click();
            await A.waitForTimeout(250);
          }
        }
        await A.waitForTimeout(120);
      }
      for (const p of all) await expect(p.getByTestId('sala-debate')).toBeVisible({ timeout: 20_000 });
      await check(`${label}-debate`, A);
      for (const p of all) await p.getByTestId('sala-tovote').click();
      for (const p of all) await expect(p.getByTestId('sala-vote')).toBeVisible({ timeout: 20_000 });
      await check(`${label}-voto`, A);
      for (const p of all) {
        await p.locator('[data-testid^="sala-vote-"]').first().click();
        await p.getByTestId('sala-cast').click();
      }
      // cerimônia da revelação (11 s no servidor) e o placar
      await expect(A.getByTestId('sala-reveal')).toBeVisible({ timeout: 20_000 });
      await check(`${label}-revelacao`, A);
      for (const p of all) await expect(p.getByTestId('sala-score')).toBeVisible({ timeout: 30_000 });
      await check(`${label}-placar`, A);
    };

    await playGame('partida1');
    // o convidado não tem os botões do líder
    await expect(B.getByTestId('sala-continue')).toHaveCount(0);
    await A.getByTestId('sala-continue').click();
    for (const p of all) await expect(p.getByTestId('sala-lobby')).toBeVisible({ timeout: 20_000 });
    await check('lobby-depois', A);
    await playGame('partida2');
    await A.getByTestId('sala-end').click();
    await expect(A.getByRole('alertdialog')).toBeVisible();
    await A.getByTestId('im-confirm-yes').click();
    for (const p of all) await expect(p.getByTestId('sala-final')).toBeVisible({ timeout: 20_000 });
    await check('ranking-final', A);

    writeFileSync(`${OUT}/${d.name}.json`, JSON.stringify(report, null, 1));
    expect(report, report.join('\n')).toEqual([]);
  });
}

/** Eliminação em sala: 3 pessoas, 1 impostor. Vota, alguém sai, a partida acaba (inocente fora = empate numérico; impostor fora = inocentes vencem). */
test('impostor sala eliminação', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(240_000);
  const d = DEVICES.find((x) => x.name === 'se')!;
  const mk = async () => {
    const ctx = await browser.newContext({ locale: 'pt-BR', viewport: { width: d.w, height: d.h } });
    const p = await ctx.newPage();
    await p.addInitScript(() => { localStorage.setItem('nocap-mute', '1'); localStorage.setItem('im-nosplash', '1'); });
    const cdp = await ctx.newCDPSession(p);
    await setDevice(p, cdp, d);
    return p;
  };
  const dismiss = (p: Page) => p.getByRole('button', { name: 'Agora não' }).click({ timeout: 4000 }).catch(() => undefined);
  const A = await mk();
  await A.goto('/mesa');
  await dismiss(A);
  await A.getByTestId('mesa-jogar').click();
  await A.getByTestId('mesa-online').click();
  await A.getByTestId('mesa-create').click();
  await nick(A, 'Ana');
  await A.waitForURL(/\/sala\//);
  const code = A.url().split('/sala/')[1]!.slice(0, 4);
  await expect(A.getByTestId('sala-lobby')).toBeVisible({ timeout: 25_000 });
  const join = async (name: string) => {
    const P = await mk();
    await P.goto('/');
    await dismiss(P);
    await P.getByTestId('hub-room-toggle').click();
    await P.getByTestId('hub-room-code').fill(code);
    await P.getByRole('button', { name: 'Entrar', exact: true }).click();
    await nick(P, name);
    await P.waitForURL(/\/sala\//);
    await expect(P.getByTestId('sala-lobby')).toBeVisible({ timeout: 25_000 });
    return P;
  };
  const B = await join('Bia');
  const C = await join('Cris');
  const all = [A, B, C];
  await A.getByTestId('sala-tab-regras').click();
  await A.getByTestId('sala-howvote-elim').click();
  await expect(A.getByText('A cada rodada a mesa vota')).toBeVisible();
  await A.getByTestId('sala-cat-comida').click();
  await B.getByTestId('sala-ready').click();
  await C.getByTestId('sala-ready').click();
  await A.getByTestId('sala-start').click();
  for (const p of all) {
    await expect(p.getByTestId('sala-role')).toBeVisible({ timeout: 20_000 });
    await hold(p);
    await p.getByTestId('sala-seen').click();
  }
  // dicas da rodada 1, debate e votação de eliminação
  for (let g = 0; g < 60 && !(await A.getByTestId('sala-vote').isVisible().catch(() => false)); g++) {
    // debate antes da votação: todos tocam em "quero votar"
    if (await A.getByTestId('sala-debate').isVisible().catch(() => false)) {
      for (const p of all) await p.getByTestId('sala-tovote').click();
      break;
    }
    for (const p of all) {
      if (await p.getByTestId('sala-clue-input').isVisible().catch(() => false)) {
        await p.getByTestId('sala-clue-input').fill(`dica${g}x`);
        await p.getByTestId('sala-clue-send').click();
        await A.waitForTimeout(250);
      }
    }
    await A.waitForTimeout(120);
  }
  for (const p of all) await expect(p.getByTestId('sala-vote')).toBeVisible({ timeout: 20_000 });
  await expect(A.getByText('Quem vai ser eliminado(a)?')).toBeVisible();
  for (const p of all) {
    await p.locator('[data-testid^="sala-vote-"]').first().click();
    await p.getByTestId('sala-cast').click();
  }
  // quem saiu (11 s) e o fim da partida
  await expect(A.getByTestId('sala-elimres')).toBeVisible({ timeout: 20_000 });
  await A.waitForTimeout(3500);
  await expect(A.getByTestId('sala-elim-out')).toBeVisible();
  for (const p of all) await expect(p.getByTestId('sala-score')).toBeVisible({ timeout: 40_000 });
});

