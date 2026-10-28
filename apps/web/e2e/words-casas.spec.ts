import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';

/**
 * Classic Word's: a pessoa escolhe a casa da linha (toque, clique ou setas) e escreve ali, sem digitar a palavra toda
 * desde a 1ª letra; o teclado na tela existe em todos os aparelhos, inclusive no computador.
 */
const levels = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'src',
      'games',
      'words',
      'levels',
      'classic-levels.json',
    ),
    'utf8',
  ),
) as Record<'c', { id: string; w: string[] }[]>;
const answer = levels.c[0]!.w[0]!.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

for (const [name, viewport, touch] of [
  ['computador', { width: 1280, height: 720 }, false],
  ['celular em pé', { width: 390, height: 844 }, true],
  ['celular deitado', { width: 844, height: 390 }, true],
] as const) {
  test(`escolher a casa e escrever fora de ordem (${name})`, async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await installApi(page);
    await page.goto('/words/classic/fase/classic/1');
    await expect(page.getByTestId('board-0')).toBeVisible();

    // o teclado da tela aparece inteiro, sem passar do fim da janela
    for (const k of ['q', 'p', 'z', 'm', 'enter', 'backspace']) {
      const id = k.length === 1 ? `key-${k}` : k;
      await expect(page.getByTestId(id)).toBeVisible();
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.y + box.height, `${id} dentro da janela`).toBeLessThanOrEqual(viewport.height + 1);
    }

    // escolhe a 4ª casa e escreve a 4ª e a 5ª letras: a seleção não sai da casa escolhida
    await page.getByTestId('slot-0-3').click();
    await page.getByTestId(`key-${answer[3]}`).click();
    await expect(page.getByTestId('slot-0-3')).toContainText(answer[3]!);
    await expect(page.getByTestId('slot-0-3')).toHaveClass(/cur/);

    // as setas movem a seleção; escreve a 5ª letra
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('slot-0-4')).toHaveClass(/cur/);
    await page.getByTestId(`key-${answer[4]}`).click();
    await expect(page.getByTestId('slot-0-4')).toContainText(answer[4]!);
    await expect(page.getByTestId('slot-0-4')).toHaveClass(/cur/);

    // apagar limpa a casa e volta uma; depois, digitando normal, a seleção passa sozinha
    await page.getByTestId('backspace').click();
    await expect(page.getByTestId('slot-0-4')).toHaveText('');
    await expect(page.getByTestId('slot-0-3')).toHaveClass(/cur/);
    await page.getByTestId('backspace').click();
    await expect(page.getByTestId('slot-0-3')).toHaveText('');
    await expect(page.getByTestId('slot-0-2')).toHaveClass(/cur/);
    await page.getByTestId('slot-0-3').click();
    await page.getByTestId(`key-${answer[3]}`).click();
    await page.getByTestId('slot-0-4').click();
    await page.getByTestId(`key-${answer[4]}`).click();

    // faltando letras o Enter não gasta tentativa
    await page.getByTestId('enter').click();
    await expect(page.getByTestId('row-0-0')).toHaveCount(0);

    // completa o resto, clicando as letras, e envia
    await page.getByTestId('slot-0-0').click();
    for (const [i, l] of [...answer.slice(0, 3)].entries()) {
      await page.getByTestId(`slot-0-${i}`).click();
      await page.getByTestId(`key-${l}`).click();
    }
    await page.getByTestId('enter').click();
    await expect(page.getByTestId('row-0-0')).toBeVisible();
    expect(errors).toEqual([]);
    await ctx.close();
  });
}
