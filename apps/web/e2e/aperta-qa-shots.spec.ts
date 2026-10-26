import { expect, test, type Page } from '@playwright/test';
import {
  PHONES_LANDSCAPE,
  PHONES_PORTRAIT,
  choiceSave,
  enterGame,
  freshSave,
  installAccount,
  midSave,
  readySave,
  tutorialSaves,
} from './aperta-fixtures';

/**
 * Tira as fotos de todas as telas do Aperta! nos tamanhos de celular (de lado e em pé) para a revisão visual. Só roda com
 * E2E_QA=1 (gera um monte de imagens em E2E_SHOTS); as checagens de layout de verdade estão em aperta-landscape.spec.ts.
 */
test.skip(!process.env.E2E_QA, 'revisão visual manual (E2E_QA=1)');

const sizes = [...PHONES_LANDSCAPE, ...PHONES_PORTRAIT, { name: '1280x720', w: 1280, h: 720 }];
const dir = process.env.E2E_SHOTS ?? 'test-results';

async function snap(page: Page, size: string, name: string) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${dir}/qa-${name}-${size}.png` });
}

for (const size of sizes) {
  test.describe(`QA ${size.name}`, () => {
    test.use({
      viewport: { width: size.w, height: size.h },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    test('título, espaços, história e começo do jogo', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installAccount(page, null);
      await page.goto('/arcade/aperta');
      await page.locator('.ap-title').waitFor();
      await snap(page, size.name, '01-titulo');
      await page.getByRole('button', { name: 'Jogar' }).first().click();
      await snap(page, size.name, '02-espacos');
      await page
        .getByRole('button', { name: /Novo jogo|Começar|Criar/ })
        .first()
        .click();
      await snap(page, size.name, '03-historia');
      for (const n of ['3b', '3c', '3d']) {
        await page.getByRole('button', { name: /Continuar/ }).click();
        await page.waitForTimeout(2600);
        await snap(page, size.name, `0${n}-historia`);
      }
      const skip = page.getByRole('button', { name: 'Pular história' });
      await skip.click();
      await page.locator('.ap-game').waitFor();
      await snap(page, size.name, '04-comeco');
    });

    test('jogo avançado e as páginas', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installAccount(page, midSave());
      await enterGame(page);
      await snap(page, size.name, '10-jogo');
      await page
        .getByRole('button', { name: 'Entendi' })
        .click({ force: true })
        .catch(() => undefined);
      await page.locator('.ap-hudgoal').click({ force: true });
      await snap(page, size.name, '11-meta');
      await page.keyboard.press('Escape');
      await page.locator('.ap-dockb-big').click({ force: true });
      await snap(page, size.name, '12-melhorias');
      await page.getByRole('tab', { name: /^Geradores/ }).click();
      await snap(page, size.name, '13-geradores');
      await page.getByRole('tab', { name: /^Itens/ }).click();
      await snap(page, size.name, '14-itens');
      await page.getByRole('button', { name: /Fechar Melhorias/ }).click();
      await page.getByRole('button', { name: /^Grimórios/ }).click();
      await snap(page, size.name, '15-grimorios');
      await page.getByRole('button', { name: /Fechar Grimórios/ }).click();
      await page.getByRole('button', { name: /^Conquistas/ }).click();
      await snap(page, size.name, '16-conquistas');
      await page.getByRole('button', { name: /Fechar Conquistas/ }).click();
      await page.getByRole('button', { name: /Cofre dos Proibidos/ }).click();
      await snap(page, size.name, '17-cofre');
      await page.getByRole('button', { name: /Fechar Cofre/ }).click();
      await page.getByRole('button', { name: /^Árvore de Habilidades/ }).click();
      await snap(page, size.name, '18-arvore');
      await page.locator('.ap-tg-node.is-buyable').first().dispatchEvent('click');
      await snap(page, size.name, '19-arvore-no');
      expect(true).toBe(true);
    });

    test('escolha de grimório (3 e 4 cartas)', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installAccount(page, choiceSave());
      await enterGame(page);
      await page.waitForTimeout(2000);
      await snap(page, size.name, '20-escolha');
    });

    test('colapso pronto', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installAccount(page, readySave());
      await enterGame(page);
      await snap(page, size.name, '30-pronta');
      await page
        .getByRole('button', { name: /Estrela pronta/ })
        .first()
        .click();
      await snap(page, size.name, '31-modal-colapso');
    });

    test('tutorial do começo', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installAccount(page, freshSave());
      await enterGame(page);
      await snap(page, size.name, '40-tutorial');
    });

    for (const [name, make] of [
      ['41-tut-poeira', () => tutorialSaves.touch(3)],
      ['42-tut-melhoria', () => tutorialSaves.upgrade()],
      ['44-tut-barra', () => tutorialSaves.fill()],
      ['44b-tut-escolha', () => tutorialSaves.choose()],
      ['45-tut-grimorios', () => tutorialSaves.grimoires()],
      [
        '46-tut-geradores',
        () =>
          tutorialSaves.free(['achievements', 'objects'], (s) => ({
            ...s,
            run: { ...s.run, dust: 1e12, dustLife: 1e12 },
          })),
      ],
      ['47-tut-colapso', () => tutorialSaves.free(['achievements', 'objects', 'generators'])],
      [
        '48-tut-arvore',
        () =>
          tutorialSaves.free(['achievements', 'objects', 'generators', 'collapse'], (s) => ({
            ...s,
            collapses: 1,
          })),
      ],
    ] as const) {
      test(`tutorial ${name}`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'um projeto basta');
        await installAccount(page, make());
        await enterGame(page);
        await page.waitForTimeout(900);
        await snap(page, size.name, name);
      });
    }
    test('tutorial 43-tut-pagina (Melhorias aberta)', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installAccount(page, tutorialSaves.upgrade());
      await enterGame(page);
      await page.locator('[data-tut="dock-upgrades"]').click();
      await page.waitForTimeout(900);
      await snap(page, size.name, '43-tut-pagina');
    });
  });
}
