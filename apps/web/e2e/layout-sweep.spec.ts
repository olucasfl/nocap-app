import { expect, test } from '@playwright/test';
import { installApi } from './mock-api';

/**
 * Varredura de layout (spec 045): cada tela fora do jogo em quatro tamanhos de tela não pode ter rolagem horizontal nem
 * conteúdo fora da janela. Com `SWEEP_DIR=/pasta` também salva uma captura de cada uma para revisar à mão.
 */
const ROUTES: [string, string][] = [
  ['hub', '/'],
  ['cor', '/cor'],
  ['tempo', '/tempo'],
  ['eco', '/eco'],
  ['atravessa', '/atravessa'],
  ['blocks', '/blocks'],
  ['words', '/words'],
  ['classic', '/words/classic'],
  ['bee', '/words/bee'],
  ['connect', '/words/connect'],
  ['amigos', '/amigos'],
  ['ranking', '/ranking'],
  ['perfil', '/perfil'],
  ['entrar', '/entrar'],
  ['criar', '/criar-conta'],
  ['sala', '/sala?jogo=color'],
  ['foxcap', '/fox-cap'],
];
const SIZES: [string, number, number][] = [
  ['phone', 390, 844],
  ['tablet', 820, 1180],
  ['desk', 1440, 900],
  ['land', 844, 390],
];

for (const [name, url] of ROUTES) {
  test(`layout ${name}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    test.setTimeout(60_000);
    await installApi(page);
    for (const [size, w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(url);
      await page
        .getByRole('button', { name: 'Agora não' })
        .click({ timeout: 800 })
        .catch(() => undefined);
      await page.waitForTimeout(500);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(over, `${name} em ${size}: rolagem horizontal`).toBeLessThanOrEqual(0);
      if (process.env.SWEEP_DIR)
        await page.screenshot({
          path: `${process.env.SWEEP_DIR}/${name}-${size}.png`,
          fullPage: size !== 'land',
        });
    }
  });
}
