import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';
import { DEVICES, measure, setDevice } from './mobile-lib';

/**
 * Impostor, modo Mesa (spec 088): o fluxo inteiro (jogadores, modo, temas, ajustes, papéis, dicas, debate, voto secreto,
 * resultado, placar, segunda partida, ranking final) em cada aparelho, medindo cada tela (docs/MOBILE-GUIDE.md).
 * IMP_DEV filtra aparelhos; IMP_OUT muda a pasta; IMP_SHOTS=1 salva as capturas.
 */
const OUT = process.env.IMP_OUT ?? 'test-results/impostor-mesa';
const only = (process.env.IMP_DEV ?? 'se,pixel,se-land,iph15-land,ipad,ipad-land').split(',');

/** "Ir para a votação" com tempo sobrando pede confirmação. */
async function toVote(page: Page) {
  await page.getByTestId('im-tovote').click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByTestId('im-confirm-yes').click();
}

async function hold(page: Page) {
  const h = page.getByTestId('im-hold');
  const b = (await h.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId('im-secret')).not.toBeEmpty();
  await page.mouse.up();
}

for (const d of DEVICES.filter((x) => only.includes(x.name))) {
  test(`impostor mesa ${d.name}`, async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    test.setTimeout(420_000);
    mkdirSync(OUT, { recursive: true });
    const report: string[] = [];
    await installApi(page);
    const cdp = await context.newCDPSession(page);
    await setDevice(page, cdp, d);
    await page.addInitScript(() => localStorage.setItem('nocap-mute', '1'));
    const check = async (label: string) => {
      await page.waitForTimeout(550);
      if (process.env.IMP_SHOTS) await page.screenshot({ path: `${OUT}/${label}-${d.name}.png` });
      for (const m of await measure(page, d)) report.push(`${label}: ${m}`);
    };

    await page.goto('/');
    await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 1500 }).catch(() => undefined);
    await page.goto('/mesa');
    await check('mesa-home');
    await page.getByTestId('mesa-jogar').click();
    await check('mesa-como');
    await page.getByTestId('mesa-impostor').click();
    // a mesa começa vazia: continuar sem gente dá erro visível
    await expect(page.getByTestId('im-players')).toBeVisible();
    await page.getByTestId('im-continue').click();
    await expect(page.getByRole('alert')).toBeVisible();
    await check('jogadores-vazio');
    for (const n of ['Sofia', 'Alexandre', 'Lúcia', 'Diego', 'Bia']) {
      await page.getByTestId('im-name').fill(n);
      await page.getByTestId('im-add').click();
    }
    await check('jogadores');
    // personagem e novo jogador
    await page.getByRole('button', { name: /Trocar o personagem de Sofia/ }).click();
    await check('personagens');
    await page.getByRole('option').nth(3).click();
    await page.getByTestId('im-name').fill('Caio');
    await page.getByTestId('im-add').click();
    await page.getByTestId('im-continue').click();
    // sem tema escolhido: erro bem visível, sem avançar
    await expect(page.getByTestId('im-meter')).toContainText('0 de 10');
    await page.getByTestId('im-continue').click();
    await expect(page.getByRole('alert')).toBeVisible();
    await check('categorias-vazio');
    await page.getByTestId('im-cat-comida').click();
    await page.getByTestId('im-cat-futebol').click();
    await page.getByTestId('im-gear-futebol').click();
    await check('categorias-folha');
    await page.getByTestId('im-f-futebol-jogador-brasil').click();
    await page.getByRole('button', { name: 'Pronto' }).click();
    await check('categorias');
    await page.getByTestId('im-continue').click();
    await page.getByTestId('im-mode-similar').click();
    await check('ajustes');
    await page.getByTestId('im-cfg-theme-futebol').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await check('ajustes-tema');
    await page.getByRole('button', { name: 'Pronto' }).click();
    await page.getByRole('button', { name: 'Mais rodadas' }).click();
    await page.getByTestId('im-start').click();

    const n = 6;
    for (let i = 0; i < n; i++) {
      if (i === 0) await check('papel');
      await hold(page);
      await page.getByTestId('im-seen').click();
    }
    // sair no meio da partida pede confirmação
    await page.getByTestId('im-leave').click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await check('confirmar-sair');
    await page.getByTestId('im-confirm-no').click();
    await expect(page.getByTestId('im-brief')).toBeVisible();
    await check('instrucoes');
    await page.getByTestId('im-next').click();
    await check('hora-de-dizer');
    for (let guard = 0; guard < 60 && (await page.getByTestId('im-next').count()); guard++) await page.getByTestId('im-next').click();
    await expect(page.getByTestId('im-talk')).toBeVisible();
    await check('debate');
    await toVote(page);
    for (let i = 0; i < n; i++) {
      await expect(page.getByTestId('im-votepass')).toBeVisible();
      if (i === 0) await check('passe-o-celular');
      await page.getByTestId('im-voteready').click();
      if (i === 0) await check('voto');
      await page.locator('[data-testid^="im-vote-"]').first().click();
      await page.getByTestId('im-cast').click();
    }
    await expect(page.getByTestId('im-revealnow')).toBeVisible();
    await check('revelar-pergunta');
    await page.getByTestId('im-revealnow').click();
    await page.waitForTimeout(3000);
    await check('revelando');
    await page.getByTestId('im-skip').click();
    await expect(page.getByTestId('im-verdict')).toBeVisible();
    await check('resultado');
    if (await page.getByTestId('im-guess').count()) {
      await page.getByTestId('im-guess').click();
      await check('chute');
      for (let g = 0; g < 3 && (await page.getByTestId('im-guess-input').count()); g++) {
        await page.getByTestId('im-guess-input').fill('nada');
        await page.getByTestId('im-guess-send').click();
      }
    } else await page.getByTestId('im-score').click();
    await expect(page.getByTestId('im-again')).toBeVisible();
    await check('placar');
    await page.getByTestId('im-again').click();
    await expect(page.getByTestId('im-reveal')).toBeVisible();
    for (let i = 0; i < n; i++) { await hold(page); await page.getByTestId('im-seen').click(); }
    for (let guard = 0; guard < 60 && (await page.getByTestId('im-next').count()); guard++) await page.getByTestId('im-next').click();
    await toVote(page);
    for (let i = 0; i < n; i++) { await page.getByTestId('im-voteready').click(); await page.locator('[data-testid^="im-vote-"]').first().click(); await page.getByTestId('im-cast').click(); }
    await page.getByTestId('im-revealnow').click();
    await page.getByTestId('im-skip').click();
    await expect(page.getByTestId('im-verdict')).toBeVisible();
    if (await page.getByTestId('im-guess').count()) {
      await page.getByTestId('im-guess').click();
      for (let g = 0; g < 3 && (await page.getByTestId('im-guess-input').count()); g++) { await page.getByTestId('im-guess-input').fill('x'); await page.getByTestId('im-guess-send').click(); }
    } else await page.getByTestId('im-score').click();
    // o ranking da sessão fica sempre à vista e abre ao toque
    await page.getByTestId('im-rank').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await check('ranking-aberto');
    await page.keyboard.press('Escape');
    await page.getByTestId('im-end').click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByTestId('im-confirm-yes').click();
    await expect(page.getByTestId('im-final')).toBeVisible();
    await check('ranking-final');

    writeFileSync(`${OUT}/${d.name}.json`, JSON.stringify(report, null, 1));
    expect(report, report.join('\n')).toEqual([]);
  });
}
