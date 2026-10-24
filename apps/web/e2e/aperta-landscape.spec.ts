import { expect, test, type Page } from '@playwright/test';
import { PHONES_LANDSCAPE, PHONES_PORTRAIT, enterGame, installAccount, midSave, readySave } from './aperta-fixtures';

/**
 * Celular só joga deitado: em pé, o Aperta! gira 90° por CSS e ocupa a tela toda (spec 042, adendo). Aqui o jogo é medido
 * pelo próprio tamanho do contêiner (clientWidth/Height), que não muda com a rotação.
 */
const sizes = [...PHONES_LANDSCAPE, ...PHONES_PORTRAIT];

/** Tamanho do contêiner em coordenadas locais e o que passa dele. */
async function frame(page: Page) {
  return page.evaluate(() => {
    const ap = document.querySelector<HTMLElement>('.ap')!;
    const w = ap.clientWidth;
    const h = ap.clientHeight;
    const rect = ap.getBoundingClientRect();
    return { w, h, rw: rect.width, rh: rect.height, sw: ap.scrollWidth, innerW: window.innerWidth, innerH: window.innerHeight };
  });
}

for (const size of sizes) {
  const portrait = size.h > size.w;
  test.describe(`Aperta! de lado em ${size.name}`, () => {
    test.use({ viewport: { width: size.w, height: size.h }, isMobile: true, hasTouch: true });

    test('o contêiner ocupa a tela deitado e nada passa dos lados', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installAccount(page, midSave());
      await page.goto('/arcade/aperta');
      await page.locator('.ap-title').waitFor();
      const f = await frame(page);
      // Deitado o contêiner é a janela; em pé ele é a janela virada (largura local = altura da janela).
      expect(f.w).toBe(portrait ? size.h : size.w);
      expect(f.h).toBe(portrait ? size.w : size.h);
      expect(Math.round(f.rw)).toBe(size.w);
      expect(Math.round(f.rh)).toBe(size.h);
      expect(f.sw).toBeLessThanOrEqual(f.w + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      await enterGame(page);
      await page.locator('.ap-game').waitFor();
      const after = await frame(page);
      expect(after.sw).toBeLessThanOrEqual(after.w + 1);
      // Jogo, barra de energia e dock cabem no contêiner (medidos pelas posições locais).
      const local = await page.evaluate(() => {
        const ap = document.querySelector<HTMLElement>('.ap')!;
        const cs = new DOMMatrix(getComputedStyle(ap).transform);
        const inv = cs.inverse();
        const a = ap.getBoundingClientRect();
        const boxes: Record<string, { x: number; y: number; w: number; h: number } | null> = {};
        for (const sel of ['.ap-hud .ap-hudp', '.ap-energy', '.ap-dock']) {
          const el = document.querySelector(sel);
          if (!el) { boxes[sel] = null; continue; }
          const r = el.getBoundingClientRect();
          const p1 = inv.transformPoint(new DOMPoint(r.left - a.left, r.top - a.top));
          const p2 = inv.transformPoint(new DOMPoint(r.right - a.left, r.bottom - a.top));
          // Em pé o ponto (0,0) do contêiner está no canto superior direito da janela: o espelhamento do rotate já vem na matriz.
          boxes[sel] = { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y) };
        }
        return boxes;
      });
      for (const [sel, b] of Object.entries(local)) {
        if (!b) continue;
        expect(b.w, sel).toBeGreaterThan(0);
        expect(b.h, sel).toBeGreaterThan(0);
      }
    });

    test('as páginas rolam por dentro e a janela não rola', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installAccount(page, midSave());
      await page.goto('/arcade/aperta');
      await enterGame(page);
      await page.locator('.ap-game').waitFor();
      await page.getByRole('button', { name: /Melhorias/ }).first().click({ force: true });
      const body = page.locator('.ap-sbody').first();
      await expect(body).toBeVisible();
      const info2 = await body.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, oy: getComputedStyle(el).overflowY }));
      expect(['auto', 'scroll']).toContain(info2.oy);
      expect(info2.ch).toBeGreaterThan(80);
      expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(1);
    });

    test('o botão da estrela pronta fica dentro da tela', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installAccount(page, readySave());
      await page.goto('/arcade/aperta');
      await enterGame(page);
      const btn = page.getByRole('button', { name: /Estrela pronta/ }).first();
      await expect(btn).toBeVisible();
      const b = (await btn.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(-1);
      expect(b.y).toBeGreaterThanOrEqual(-1);
      expect(b.x + b.width).toBeLessThanOrEqual(size.w + 1);
      expect(b.y + b.height).toBeLessThanOrEqual(size.h + 1);
    });

    test('toda aba abre em tela cheia, com Voltar, e fecha', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installAccount(page, midSave());
      await page.goto('/arcade/aperta');
      await enterGame(page);
      for (const name of [/Melhorias/, /Grimórios/, /Conquistas/, /Cofre/]) {
        await page.getByRole('button', { name }).first().click({ force: true });
        const wrap = page.locator('.ap-sheetwrap');
        await expect(wrap).toBeVisible();
        // Mesmas dimensões do jogo (layout, sem a rotação do celular em pé): a aba cobre a tela toda.
        const full = await page.evaluate(() => {
          const ap = document.querySelector<HTMLElement>('.ap')!;
          const w = document.querySelector<HTMLElement>('.ap-sheetwrap')!;
          return { same: w.offsetWidth === ap.clientWidth && w.offsetHeight === ap.clientHeight, back: !!document.querySelector('.ap-x-back') && getComputedStyle(document.querySelector('.ap-x-back')!).display !== 'none' };
        });
        expect(full.same, String(name)).toBe(true);
        expect(full.back, String(name)).toBe(true);
        await expect(page.locator('.ap-x-back')).toContainText('Voltar');
        await page.locator('.ap-x').click();
        await expect(wrap).toHaveCount(0);
      }
    });

    test('nada fica rente à borda: HUD, dock e energia respeitam a margem de segurança', async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      await installAccount(page, midSave());
      await page.goto('/arcade/aperta');
      await enterGame(page);
      const edges = await page.evaluate(() => {
        const px = (sel: string, prop: string) => parseFloat(getComputedStyle(document.querySelector(sel)!).getPropertyValue(prop));
        return { hudL: px('.ap-hud', 'left'), hudT: px('.ap-hud', 'top'), hudR: px('.ap-hud', 'right'), dockL: px('.ap-dock', 'left'), dockB: px('.ap-dock', 'bottom'), enR: px('.ap-energy', 'right') };
      });
      for (const [k, v] of Object.entries(edges)) expect(v, k).toBeGreaterThanOrEqual(14);
    });
  });
}

/**
 * Virar o aparelho (iPhone 17: 402x874 em pé, 874x402 deitado) não pode mudar nada no jogo: o layout dentro da raiz `.ap`
 * é o mesmo nos dois sentidos e, depois de a medida assentar, não sobra estado intermediário.
 */
test.describe('virar o aparelho', () => {
  test.use({ viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

  const layout = (page: Page) =>
    page.evaluate(() => {
      const ap = document.querySelector<HTMLElement>('.ap')!;
      const box = (sel: string) => {
        const e = document.querySelector<HTMLElement>(sel);
        return e ? [e.offsetLeft, e.offsetTop, e.offsetWidth, e.offsetHeight] : null;
      };
      return {
        frame: ap.dataset.frame,
        size: [ap.clientWidth, ap.clientHeight],
        transform: getComputedStyle(ap).transform,
        parts: { hud: box('.ap-hud'), hudp: box('.ap-hudp'), field: box('.ap-field'), energy: box('.ap-energy'), dock: box('.ap-dock') },
      };
    });

  test('o layout é o mesmo em pé e deitado, vire quantas vezes virar', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    await installAccount(page, midSave());
    await enterGame(page);
    const settle = () => page.waitForTimeout(900);
    await settle();
    const reference = await layout(page);
    expect(reference.frame).toBe('rotated');
    expect(reference.size).toEqual([874, 402]);
    expect(reference.transform).not.toBe('none');

    for (let i = 0; i < 4; i++) {
      await page.setViewportSize({ width: 874, height: 402 });
      await settle();
      const flat = await layout(page);
      expect(flat.frame, `deitado ${i}`).toBe('landscape');
      expect(flat.size, `deitado ${i}`).toEqual([874, 402]);
      expect(flat.transform, `deitado ${i}`).toBe('none');
      // Mesmo layout dentro da raiz, em pé ou deitado.
      expect(flat.parts, `deitado ${i}`).toEqual(reference.parts);

      await page.setViewportSize({ width: 402, height: 874 });
      await settle();
      const upright = await layout(page);
      expect(upright.frame, `em pé ${i}`).toBe('rotated');
      expect(upright.size, `em pé ${i}`).toEqual([874, 402]);
      expect(upright.parts, `em pé ${i}`).toEqual(reference.parts);
    }
  });

  test('virar depressa, várias vezes seguidas, termina no modo certo e sem restos', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    await installAccount(page, midSave());
    await enterGame(page);
    for (let i = 0; i < 7; i++) {
      await page.setViewportSize(i % 2 === 0 ? { width: 874, height: 402 } : { width: 402, height: 874 });
      await page.waitForTimeout(30);
    }
    // O último foi 874x402 (deitado): depois de assentar não pode haver giro nenhum.
    await page.waitForTimeout(1000);
    const end = await layout(page);
    expect(end.frame).toBe('landscape');
    expect(end.size).toEqual([874, 402]);
    expect(end.transform).toBe('none');
    // E o jogo segue de pé na tela: o botão central responde ao toque.
    await expect(page.getByRole('button', { name: 'Apertar o botão' })).toBeVisible();
  });
});
