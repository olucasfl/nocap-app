import { expect, test, type Page } from '@playwright/test';
import { loginAs } from './account';

/**
 * Counter Fox online, modo Bomba, com DUAS janelas (spec 059): líder escolhe Bomba e os times, a partida começa na compra,
 * cada um vê o seu dinheiro, e a loja só abre na base. Precisa de `E2E_ROOMS=1` (mesmo preparo de foxshot-online.spec.ts).
 */
test.skip(!process.env.E2E_ROOMS, 'precisa do servidor de salas (E2E_ROOMS=1)');
test.beforeEach(({ page: _page }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
});
test.setTimeout(420_000);

const fsn = <T,>(p: Page, fn: string, ...a: unknown[]) =>
  p.evaluate(([f, args]) => ((window as unknown as { __fsn: Record<string, (...x: unknown[]) => unknown> }).__fsn[f as string] as (...x: unknown[]) => T)(...(args as unknown[])), [fn, a] as [string, unknown[]]) as Promise<T>;

test('duas janelas: modo Bomba com times TR e CT, compra com dinheiro e HUD da bomba', async ({ browser }) => {
  const mk = async (name: string) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'pt-BR' });
    const page = await ctx.newPage();
    await loginAs(page, name);
    await page.addInitScript(() => localStorage.setItem('nocap-fs-settings-lock2', '1'));
    return page;
  };
  const ana = await mk('Ana');
  const bia = await mk('Bia');
  await ana.goto('/fox-cap/counter-fox');
  await ana.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await ana.getByTestId('cfh-play').click();
  await ana.getByTestId('cfh-online').click();
  await ana.getByTestId('cfh-create').click();
  await expect(ana.getByTestId('cfl')).toBeVisible({ timeout: 30_000 });
  const code = (await ana.getByTestId('cfl-code').locator('b').textContent())!.trim();
  await bia.goto('/fox-cap/counter-fox');
  await bia.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await bia.getByTestId('cfh-play').click();
  await bia.getByTestId('cfh-online').click();
  await bia.getByTestId('cfh-code').fill(code);
  await bia.getByTestId('cfh-join').click();
  await expect(bia.getByTestId('cfl')).toBeVisible({ timeout: 30_000 });

  // Ana escolhe Bomba, 4 rounds e 1 bot de cada lado
  await ana.getByTestId('cfl-tab-modo').click();
  await ana.getByTestId('cfl-mode-bomb').click();
  await expect(ana.getByTestId('cfl-rounds-4')).toBeVisible();
  await ana.getByTestId('cfl-rounds-4').click();
  // times e bots ficam na aba Sala: Ana TR, Bia CT, 1 bot de cada lado
  await ana.getByTestId('cfl-tab-sala').click();
  await expect(ana.getByTestId('cfl-board')).toBeVisible({ timeout: 10_000 });
  await ana.getByTestId('cfl-join-tr').first().click();
  await expect(ana.getByTestId('cfl-slot-tr-Ana')).toBeVisible({ timeout: 10_000 });
  await bia.getByTestId('cfl-tab-sala').click();
  // a sala já põe a Bia no time com menos gente (sem botão no próprio time): só clica se ela ainda não estiver no CT
  if (!(await ana.getByTestId('cfl-slot-ct-Bia').isVisible())) await bia.getByTestId('cfl-join-ct').first().click({ timeout: 15_000 }).catch(() => undefined);
  await expect(ana.getByTestId('cfl-slot-ct-Bia')).toBeVisible({ timeout: 10_000 });
  await ana.getByTestId('cfl-botup-ct').click();
  await ana.getByTestId('cfl-botup-tr').click();
  await expect(ana.getByTestId('cfl-botn-ct')).toHaveText('1');
  // quem quiser assistir escolhe Espectar (Bia testa e volta ao time)
  await bia.getByTestId('cfl-join-spec').click();
  await expect(ana.getByTestId('cfl-spec')).toContainText('Bia', { timeout: 10_000 });
  // a sala já põe a Bia no time com menos gente (sem botão no próprio time): só clica se ela ainda não estiver no CT
  if (!(await ana.getByTestId('cfl-slot-ct-Bia').isVisible())) await bia.getByTestId('cfl-join-ct').first().click({ timeout: 15_000 }).catch(() => undefined);
  await expect(ana.getByTestId('cfl-slot-ct-Bia')).toBeVisible({ timeout: 10_000 });
  await bia.getByTestId('cfl-ready').click();
  await expect(ana.getByTestId('cfl-start')).toBeEnabled({ timeout: 10_000 });
  await ana.getByTestId('cfl-start').click();
  await expect(ana.getByTestId('fb-hud')).toBeVisible({ timeout: 120_000 });
  // sem pointer lock o menu Esc abre sozinho e pausa o relógio do líder: ele precisa continuar antes de a Bia receber quadros
  await fsn(ana, 'resume');
  await expect(bia.getByTestId('fb-hud')).toBeVisible({ timeout: 120_000 });
  await fsn(bia, 'resume');
  await expect(ana.getByTestId('fb-money')).toContainText('800');
  await expect(bia.getByTestId('fb-money')).toContainText('800');
  await expect(ana.getByTestId('fb-hud')).toContainText('TERRORISTA');
  await expect(bia.getByTestId('fb-hud')).toContainText('CONTRA-TERRORISTA');
  // o navegador sem GPU é lento: a compra (15 s) pode já ter passado; se ainda é compra, a loja abre na base; senão, não abre
  const phase = await ana.getByTestId('fb-hud').getAttribute('data-phase');
  await ana.keyboard.press('KeyB');
  if (phase === 'buy') await expect(ana.getByTestId('fs-shop')).toBeVisible({ timeout: 20_000 });
  else await expect(ana.getByTestId('fs-shop')).toHaveCount(0);
  await ana.screenshot({ path: `${process.env.FS_SHOTS ?? '/tmp'}/bomba-online.png` });
  // mapa grande no online: M abre com as marcas e M fecha
  await ana.keyboard.press('Escape').catch(() => undefined);
  await fsn(ana, 'resume');
  await ana.keyboard.press('KeyM');
  await expect(ana.getByTestId('fs-bigmap')).toBeVisible({ timeout: 15_000 });
  await ana.screenshot({ path: `${process.env.FS_SHOTS ?? '/tmp'}/bomba-online-mapa.png` });
  await ana.keyboard.press('KeyM');
  await expect(ana.getByTestId('fs-bigmap')).toHaveCount(0);
});
