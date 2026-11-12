import { expect, test, type Page } from '@playwright/test';

/**
 * Fox GP: a tela inicial e os painéis dela cabem em qualquer tamanho, sem rolagem (spec 081, Fase 1.6). Para cada tamanho
 * e cada tela: nada rola (nem a página nem um painel), todo botão fica com a caixa inteira dentro da janela e nenhum
 * encosta na faixa quadriculada de baixo.
 */
const SIZES: [number, number][] = [
  [1920, 1080],
  [1536, 864],
  [1366, 768],
  [1280, 720],
  [1024, 768],
  [844, 390],
  [667, 375],
  [390, 844],
  // zoom de 125 % em 1280×720 e em 1536×864 (a janela em px de CSS fica menor)
  [1024, 576],
  [1229, 691],
];

/** Problemas de layout na tela de agora (só a camada de cima: com um diálogo aberto, só os botões dele). */
const issues = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const vw = innerWidth;
    const vh = innerHeight;
    const root = document.scrollingElement!;
    if (root.scrollHeight > vh + 1) out.push(`a página rola (${root.scrollHeight} > ${vh})`);
    const layer =
      [...document.querySelectorAll<HTMLElement>('.gph-garage, .gp-pick, .gp-cmd')].at(-1) ??
      document.querySelector<HTMLElement>('.gph')!;
    for (const el of [layer, ...layer.querySelectorAll<HTMLElement>('*')]) {
      // nada rolado (nem por foco num contêiner com overflow escondido)
      if (el.scrollTop > 0 || el.scrollLeft > 0) out.push(`rolado: ${el.className} (${el.scrollTop})`);
      const cs = getComputedStyle(el);
      const clips = /(auto|scroll|hidden)/.test(cs.overflowY + cs.overflowX);
      if (!clips || el.tagName === 'CANVAS' || el.tagName === 'svg') continue;
      // texto que só passa um pouco da caixa (itálico, acentos) não conta: só o que corta conteúdo de verdade
      if (el.scrollHeight > el.clientHeight + 4 || el.scrollWidth > el.clientWidth + 4)
        out.push(`conteúdo cortado ou rolando: ${el.className} (${el.scrollWidth}x${el.scrollHeight} em ${el.clientWidth}x${el.clientHeight})`);
    }
    const flag = layer.classList.contains('gph') ? layer.querySelector('.gph-flag')?.getBoundingClientRect() : null;
    for (const b of layer.querySelectorAll<HTMLElement>('button, input, [role="radio"]')) {
      const r = b.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(b).visibility === 'hidden') continue;
      const name = (b.textContent || b.getAttribute('aria-label') || b.tagName).trim().slice(0, 24);
      if (r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5)
        out.push(`fora da janela: ${name} (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
      if (flag && r.bottom > flag.top - 2 && r.right > flag.left) out.push(`encosta na faixa: ${name}`);
      if (b.tagName === 'BUTTON' && (b.scrollHeight > b.clientHeight + 4 || b.scrollWidth > b.clientWidth + 4))
        out.push(`texto estoura o botão: ${name}`);
    }
    return out;
  });

test.describe('Fox GP: tamanhos de tela', () => {
  test.beforeEach(({ page: _page }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
  });
  test.setTimeout(240_000);

  test('tela inicial, Antes de correr, online, pistas e garagem cabem sem rolagem', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('nocap-mute', '1'));
    await page.goto('/fox-cap');
    await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 8000 }).catch(() => undefined);
    await page.getByTestId('foxcap-foxgp').click();
    const all: string[] = [];
    for (const [w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await expect(page.getByTestId('gp-home')).toBeVisible();
      await page.waitForTimeout(250);
      const tag = `${w}x${h}`;
      const add = async (screen: string) => {
        for (const p of await issues(page)) all.push(`${tag} ${screen}: ${p}`);
        if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/gp-size-${tag}-${screen}.png` });
      };
      await add('inicial');
      await page.getByTestId('gl-offline').click();
      await expect(page.getByRole('dialog', { name: 'Antes de correr' })).toBeVisible();
      await add('antes');
      await page.getByRole('dialog', { name: 'Antes de correr' }).getByRole('button', { name: 'Voltar' }).click();
      await page.getByTestId('gl-friends').click();
      await expect(page.getByTestId('gl-friends-panel')).toBeVisible();
      await add('online');
      await page.getByTestId('gl-friends-panel').getByRole('button', { name: 'Voltar' }).click();
      await page.getByTestId('gp-open-track').click();
      await expect(page.getByTestId('gp-track-panel')).toBeVisible();
      await add('pistas');
      await page.getByTestId('gp-track-panel').getByRole('button', { name: 'Voltar' }).click();
      if (process.env.E2E_GARAGE) {
        // a garagem é refeita na Fase 8 (uma por veículo); até lá fica fora desta conferência
        await page.getByTestId('gp-open-garage').click();
        await expect(page.getByTestId('gp-garage')).toBeVisible();
        await add('garagem');
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('gp-garage')).toHaveCount(0);
      }
    }
    expect(all).toEqual([]);
  });
});
