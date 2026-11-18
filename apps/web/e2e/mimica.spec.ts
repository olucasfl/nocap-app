import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';
import { DEVICES, measure, setDevice } from './mobile-lib';

/**
 * Mímica (mesa), partida inteira nos 4 modos em todos os tamanhos de celular e tablet: cada tela é medida (rolagem, alvos de
 * toque, texto cortado) e a partida tem de chegar ao placar final. `mm-fast` tira a contagem e as cartelas.
 */
const only = (process.env.MM_DEV ?? 'se,a-small,pixel,iph15,promax,se-land,a-land,iph15-land,promax-land,ipad,ipad-land').split(',');
const MODES = [
  ['teams', 'classic'],
  ['solo', 'classic'],
  ['teams', 'speed'],
  ['solo', 'speed'],
] as const;

async function check(page: Page, d: (typeof DEVICES)[number], label: string, report: string[], shot: string) {
  await page.waitForTimeout(650);
  if (process.env.MM_SHOTS) await page.screenshot({ path: `test-results/mm-${shot}.png` });
  // telas de jogo e de passagem não podem rolar
  if (/^(pass|play|judge|pick-|steal)/.test(label)) {
    const over = await page.evaluate(() => {
      const b = document.querySelector('.mm-app .im-body') as HTMLElement | null;
      return b ? b.scrollHeight - b.clientHeight : 0;
    });
    if (over > 2) report.push(`ROLA em ${label}: ${over}px`);
  }
  for (const m of await measure(page, d)) report.push(`${label}: ${m}`);
}

for (const d of DEVICES.filter((x) => only.includes(x.name))) {
  for (const [format, style] of MODES) {
    test(`mimica ${format} ${style} ${d.name}`, async ({ page, context }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      test.setTimeout(120_000);
      const report: string[] = [];
      await installApi(page);
      const cdp = await context.newCDPSession(page);
      await setDevice(page, cdp, d);
      await page.addInitScript(() => {
        localStorage.setItem('nocap-mute', '1');
        localStorage.setItem('mm-fast', '1');
        localStorage.setItem('mm-secs', '60');
        localStorage.removeItem('nocap-mimica-setup');
      });
      await page.goto('/');
      await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
      await page.goto('/mesa/mimica');
      const tag = `${format}-${style}-${d.name}`;

      // modo
      await page.getByTestId(`mm-fmt-${format}`).click();
      await page.getByTestId(`mm-style-${style}`).click();
      await check(page, d, 'modo', report, `${tag}-1modo`);
      await page.getByTestId('mm-continue').click();

      // times ou jogadores
      if (format === 'teams') {
        await page.getByTestId('mm-addteam').click();
        await expect(page.getByTestId('mm-team-2')).toBeVisible();
        // o nome e o personagem do time se editam
        await page.getByTestId('mm-team-0').fill('Os Fortes');
        await page.getByTestId('mm-team-av-1').click();
        await page.getByRole('option').nth(7).click();
        await expect(page.getByTestId('mm-team-0')).toHaveValue('Os Fortes');
      } else {
        for (const n of ['Ana', 'Beto', 'Caio']) {
          await page.getByTestId('mm-name').fill(n);
          await page.getByTestId('mm-add').click();
        }
      }
      await check(page, d, 'lados', report, `${tag}-2lados`);
      await page.getByTestId('mm-continue').click();

      // temas e regras
      await expect(page.getByTestId('mm-cats')).toBeVisible();
      // nenhum tema vem marcado: seguir sem escolher avisa
      await expect(page.locator('[data-testid^="mm-cat-"][aria-pressed="true"]')).toHaveCount(0);
      await page.getByTestId('mm-continue').click();
      await expect(page.getByRole('alert')).toBeVisible();
      await page.getByTestId('mm-cat-animais').click();
      await page.getByTestId('mm-cat-comida').click();
      await check(page, d, 'temas', report, `${tag}-3temas`);
      await page.getByTestId('mm-continue').click();
      await expect(page.getByTestId('mm-cfg')).toBeVisible();
      await page.getByRole('button', { name: 'Menos rodadas' }).click();
      await page.getByRole('button', { name: 'Menos rodadas' }).click();
      await page.getByTestId('mm-sec-90').click();
      await check(page, d, 'regras', report, `${tag}-4regras`);
      await page.getByTestId('mm-help').click();
      await expect(page.getByText('Sem apontar')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.getByTestId('mm-start').click();

      // três turnos (3 times ou 3 pessoas, 1 rodada)
      for (let turn = 0; turn < 3; turn++) {
        await expect(page.getByTestId('mm-pass')).toBeVisible();
        if (turn === 0) {
          await check(page, d, 'pass', report, `${tag}-5passa`);
          await page.getByTestId('mm-rank').click();
          await expect(page.getByTestId('mm-board').first()).toBeVisible();
          await page.keyboard.press('Escape');
        }
        await page.getByTestId('mm-ready').click();
        if (style === 'classic') {
          await expect(page.getByTestId('mm-choose')).toBeVisible();
          if (turn === 0) await check(page, d, 'escolha', report, `${tag}-6escolha`);
          await page.getByTestId('mm-opt-0').click();
          await expect(page.getByTestId('mm-play')).toBeVisible();
          // segurar mostra a palavra, soltar esconde
          const peek = page.getByTestId('mm-peek');
          await peek.dispatchEvent('pointerdown');
          await expect(page.getByTestId('mm-word')).toBeVisible();
          if (turn === 0) await check(page, d, 'play-palavra', report, `${tag}-7palavra`);
          await peek.dispatchEvent('pointerup');
          await expect(page.getByTestId('mm-word')).toHaveCount(0);
          if (turn === 0) await check(page, d, 'play', report, `${tag}-7jogando`);
          if (format === 'teams') {
            await page.getByTestId('mm-hit').click();
          } else {
            await page.getByTestId('mm-hit').click();
            await expect(page.getByTestId('mm-pick')).toBeVisible();
            if (turn === 0) await check(page, d, 'pick-quem', report, `${tag}-8quem`);
            await page.getByTestId('mm-pick-0').click();
          }
        } else {
          await expect(page.getByTestId('mm-play')).toBeVisible();
          await expect(page.getByTestId('mm-word')).toBeVisible();
          if (turn === 0) await check(page, d, 'play-speed', report, `${tag}-7speed`);
          await page.getByTestId('mm-hit').click();
          await page.getByTestId('mm-hit').click();
          await page.getByTestId('mm-skip').click();
          await expect(page.getByTestId('mm-hits')).toHaveText('2');
          await page.getByTestId('mm-end').click();
          if (format === 'solo') {
            await expect(page.getByTestId('mm-assign')).toBeVisible();
            if (turn === 0) await check(page, d, 'assign', report, `${tag}-8assign`);
            await page.getByRole('button', { name: /Mais um acerto de/ }).first().click();
            await expect(page.getByTestId('mm-left')).toContainText('1');
            await page.getByTestId('mm-assign-ok').click();
          }
        }
        await expect(page.getByTestId('mm-result')).toBeVisible();
        if (turn === 0) await check(page, d, 'resultado', report, `${tag}-9resultado`);
        await page.getByTestId('mm-next').click();
      }
      await expect(page.getByTestId('mm-final')).toBeVisible();
      await check(page, d, 'final', report, `${tag}-99final`);
      expect(report, report.join('\n')).toEqual([]);
    });
  }
}

/** O roubo: o tempo acaba, o time não acertou e outro time marca que sabia a resposta. */
test('mimica roubo entre times', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(60_000);
  await installApi(page);
  await page.addInitScript(() => {
    localStorage.setItem('nocap-mute', '1');
    localStorage.setItem('mm-fast', '1');
    localStorage.setItem('mm-secs', '2');
    localStorage.removeItem('nocap-mimica-setup');
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
  await page.goto('/mesa/mimica');
  await page.getByTestId('mm-continue').click();
  await page.getByTestId('mm-continue').click();
  await page.getByTestId('mm-cat-animais').click();
  await page.getByTestId('mm-cat-comida').click();
  await page.getByTestId('mm-continue').click();
  await page.getByTestId('mm-start').click();
  await page.getByTestId('mm-ready').click();
  await page.getByTestId('mm-opt-0').click();
  await expect(page.getByTestId('mm-judge')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('mm-judge-who')).toContainText('Time Laranja');
  await page.getByTestId('mm-judge-no').click();
  // com 2 times a pergunta é sempre sobre o outro time
  await expect(page.getByTestId('mm-steal-who')).toContainText('Time Azul acertou a palavra?');
  await page.getByTestId('mm-steal-yes').click();
  await expect(page.getByTestId('mm-result')).toBeVisible();
  // quem roubou ganha 1 ponto; o time da mímica, nenhum
  await expect(page.getByTestId('mm-brow-0')).toContainText('1');
  await expect(page.locator('.mm-gain')).toHaveText('+1');
});

/** Fim do tempo no Clássico em Times: as 3 respostas e a escolha do time que acertou, em todos os tamanhos. */
for (const d of DEVICES.filter((x) => only.includes(x.name))) {
  test(`mimica fim do tempo ${d.name}`, async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    test.setTimeout(60_000);
    const report: string[] = [];
    await installApi(page);
    const cdp = await context.newCDPSession(page);
    await setDevice(page, cdp, d);
    await page.addInitScript(() => {
      localStorage.setItem('nocap-mute', '1');
      localStorage.setItem('mm-fast', '1');
      localStorage.setItem('mm-secs', '2');
      localStorage.removeItem('nocap-mimica-setup');
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
    await page.goto('/mesa/mimica');
    await page.getByTestId('mm-continue').click();
    await page.getByTestId('mm-addteam').click();
    await page.getByTestId('mm-continue').click();
    await page.getByTestId('mm-cat-animais').click();
    await page.getByTestId('mm-continue').click();
    await page.getByTestId('mm-start').click();
    await page.getByTestId('mm-ready').click();
    await page.getByTestId('mm-opt-0').click();
    await expect(page.getByTestId('mm-judge')).toBeVisible({ timeout: 10_000 });
    await check(page, d, 'judge', report, `fim-${d.name}-1`);
    await page.getByTestId('mm-judge-no').click();
    // com 3 times: lista para marcar quais times sabem a palavra
    await expect(page.getByTestId('mm-steal-who')).toContainText('Algum time sabe a palavra?');
    await expect(page.getByTestId('mm-steal-ok')).toBeDisabled();
    await page.getByRole('button', { name: /acertou$/ }).first().click();
    await check(page, d, 'steal', report, `fim-${d.name}-2`);
    await page.getByTestId('mm-steal-ok').click();
    await expect(page.getByTestId('mm-result')).toBeVisible();
    expect(report, report.join('\n')).toEqual([]);
  });
}
