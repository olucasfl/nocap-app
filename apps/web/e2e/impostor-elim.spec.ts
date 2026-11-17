import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';
import { DEVICES, measure, setDevice } from './mobile-lib';

/** Impostor (mesa) no modo Eliminação: dicas, votação só dos vivos, quem saiu, rodadas até acabar e ranking. */
const only = (process.env.IMP_DEV ?? 'se,se-land,ipad').split(',');
const OUT = process.env.ELIM_OUT ?? 'test-results/impostor-elim';

async function hold(page: Page) {
  const b = (await page.getByTestId('im-hold').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId('im-secret')).not.toBeEmpty();
  await page.mouse.up();
}

for (const d of DEVICES.filter((x) => only.includes(x.name))) {
  test(`impostor eliminação ${d.name}`, async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    test.setTimeout(240_000);
    mkdirSync(OUT, { recursive: true });
    const report: string[] = [];
    await installApi(page);
    const cdp = await context.newCDPSession(page);
    await setDevice(page, cdp, d);
    await page.addInitScript(() => { localStorage.setItem('nocap-mute', '1'); localStorage.setItem('im-nosplash', '1'); });
    const check = async (label: string) => {
      await page.waitForTimeout(500);
      if (process.env.IMP_SHOTS) await page.screenshot({ path: `${OUT}/${label}-${d.name}.png` });
      for (const m of await measure(page, d)) report.push(`${label}: ${m}`);
    };
    await page.goto('/mesa/impostor');
    for (const n of ['Ana', 'Bia', 'Caio', 'Dani', 'Edu']) {
      await page.getByTestId('im-name').fill(n);
      await page.getByTestId('im-add').click();
    }
    await page.getByTestId('im-continue').click();
    await page.getByTestId('im-cat-comida').click();
    await page.getByTestId('im-continue').click();
    // regras: eliminação, 2 impostores
    await page.getByTestId('im-howvote-elim').click();
    await expect(page.getByTestId('im-tm')).toHaveCount(0);
    await page.getByRole('button', { name: 'Mais impostores' }).click().catch(() => undefined);
    await check('regras-eliminacao');
    await page.getByTestId('im-start').click();
    for (let i = 0; i < 5; i++) { await hold(page); await page.getByTestId('im-seen').click(); }

    let sawVote = false;
    let sawElim = false;
    for (let guard = 0; guard < 80 && !(await page.getByTestId('im-again').count()); guard++) {
      if (await page.getByTestId('im-next').count()) { await page.getByTestId('im-next').click(); continue; }
      if (await page.getByTestId('im-tovote').count()) {
        await page.getByTestId('im-tovote').click();
        await page.getByTestId('im-confirm-yes').click({ timeout: 1500 }).catch(() => undefined);
        continue;
      }
      if (await page.getByTestId('im-voteready').count()) {
        if (!sawVote) { sawVote = true; await check('passe-o-celular'); }
        await page.getByTestId('im-voteready').click();
        continue;
      }
      if (await page.locator('[data-testid^="im-vote-"]').count()) {
        await page.locator('[data-testid^="im-vote-"]').first().click();
        await page.getByTestId('im-cast').click();
        continue;
      }
      if (await page.getByTestId('im-elim-culprits').count()) {
        await check('impostores-revelados');
        await page.getByTestId('im-elim-next').click();
        continue;
      }
      if (await page.getByTestId('im-elimres').count()) {
        if (!sawElim) {
          sawElim = true;
          await page.waitForTimeout(3000);
          await check('quem-saiu');
        }
        await page.getByTestId('im-skip').click({ timeout: 2000 }).catch(() => undefined);
        await page.getByTestId('im-elim-reveal').click({ timeout: 1500 }).catch(() => undefined);
        await page.getByTestId('im-elim-next').click({ timeout: 1500 }).catch(() => undefined);
        continue;
      }
      await page.waitForTimeout(200);
    }
    await expect(page.getByTestId('im-again')).toBeVisible();
    expect(sawVote && sawElim).toBe(true);
    await check('ranking');
    writeFileSync(`${OUT}/${d.name}.json`, JSON.stringify(report, null, 1));
    expect(report, report.join('\n')).toEqual([]);
  });
}
