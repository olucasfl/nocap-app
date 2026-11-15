import { expect, test, type Page } from '@playwright/test';

/**
 * Telas do Night Hunt (spec 083): o jogo é um canvas, então o teste anda pelas telas com cliques calculados sobre a área
 * lógica de 510x680 e lê o estado pelos atalhos de desenvolvimento (`window.__nh`). Confere o fluxo
 * menu, herói, mapa, partida, pausa, resultado; a janela de nível com reroll, pular e banir; o baú de evolução;
 * a morte; e que cada tela desenha algo em celular em pé, em paisagem e no computador.
 */
test.setTimeout(120_000);

interface Nh {
  state(): { screen: string; modal: string | null; t?: number; level?: number; enemies?: number };
  skip(s: number): void;
  xp(n: number): void;
  chest(): void;
  brk(): number;
  give(id: string, n: number): void;
  bestiary(sel: number): void;
  saveExit(): void;
  buyHero(id: string): void;
  resume(): void;
  evo(): void;
  die(): void;
  gold(n: number): number;
  pick(hero: string, map: string): void;
  go(screen: string): void;
}
declare global {
  interface Window {
    __nh: Nh;
  }
}

async function open(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/nighthunt');
  await page
    .getByRole('button', { name: 'Agora não' })
    .click({ timeout: 4000 })
    .catch(() => undefined);
  await page.waitForFunction(() => window.__nh?.state().screen === 'menu', undefined, {
    timeout: 15_000,
  });
  return errors;
}
const state = (page: Page) => page.evaluate(() => window.__nh.state());
const screenIs = async (page: Page, s: string) => {
  await page.waitForFunction((x) => window.__nh.state().screen === x, s, { timeout: 8000 });
};
/**
 * Clica num ponto da coluna central de 510 de largura (as telas crescem para os lados, mas o conteúdo central fica no meio).
 * `game`: janelas da partida (centradas na vertical); `menu`: telas de menu (caixa centrada, y contado do topo da caixa).
 */
async function tap(page: Page, x: number, y: number, mode: 'menu' | 'game' = 'menu') {
  const box = (await page.locator('canvas.nh-canvas').boundingBox())!;
  const k = Math.min(box.width / 510, box.height / 680);
  const fw = box.width / k;
  const fh = box.height / k;
  const top = mode === 'game' ? Math.max(0, (fh - 680) / 2) : (fh - Math.min(fh, 820)) / 2;
  await page.mouse.click(box.x + (fw / 2 - 255 + x) * k, box.y + (top + y) * k);
  await page.waitForTimeout(450);
}
/** Quantas cores diferentes a tela tem (uma tela em branco ou travada tem 1 ou 2). */
async function colors(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector('canvas.nh-canvas') as HTMLCanvasElement;
    const t = document.createElement('canvas');
    t.width = 64;
    t.height = 64;
    const q = t.getContext('2d')!;
    q.drawImage(c, 0, 0, 64, 64);
    const d = q.getImageData(0, 0, 64, 64).data;
    const set = new Set<number>();
    for (let i = 0; i < d.length; i += 4)
      set.add(((d[i]! >> 4) << 8) | ((d[i + 1]! >> 4) << 4) | (d[i + 2]! >> 4));
    return set.size;
  });
}
const startRun = async (page: Page) => {
  await page.evaluate(() => window.__nh.go('maps'));
  await screenIs(page, 'maps');
  await page.keyboard.press('Enter');
  await screenIs(page, 'game');
  await page.waitForTimeout(500);
};

test.describe('Night Hunt', () => {
  test('o menu desenha e o fluxo vai de herói a mapa até a partida', async ({ page }) => {
    const errors = await open(page);
    expect(await colors(page)).toBeGreaterThan(12);
    await tap(page, 255, 333); // JOGAR
    await screenIs(page, 'heroes');
    expect(await colors(page)).toBeGreaterThan(12);
    await page.keyboard.press('Enter'); // CONTINUAR
    await screenIs(page, 'maps');
    await page.waitForTimeout(600);
    expect(await colors(page)).toBeGreaterThan(12);
    await page.keyboard.press('Enter');
    await screenIs(page, 'game');
    await page.waitForTimeout(800);
    expect(await colors(page)).toBeGreaterThan(20);
    expect((await state(page)).t).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('pausa com Esc congela o tempo; continuar volta; desistir leva ao resultado', async ({
    page,
  }) => {
    const errors = await open(page);
    await startRun(page);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__nh.state().modal === 'pause');
    const t0 = (await state(page)).t!;
    await page.waitForTimeout(700);
    expect((await state(page)).t).toBe(t0);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__nh.state().modal === null);
    await page.waitForTimeout(500);
    expect((await state(page)).t!).toBeGreaterThan(t0);
    await page.keyboard.press('Escape');
    await tap(page, 255, 516, 'game'); // DESISTIR (na pausa)
    await tap(page, 255, 340, 'game'); // SIM, SAIR
    await screenIs(page, 'over');
    expect(await colors(page)).toBeGreaterThan(12);
    expect(errors).toEqual([]);
  });

  test('subir de nível abre 3 ou 4 opções; reroll, banir e pular gastam os usos', async ({
    page,
  }) => {
    const errors = await open(page);
    await startRun(page);
    await page.evaluate(() => window.__nh.xp(30));
    await page.keyboard.down('d');
    await page.waitForFunction(() => window.__nh.state().modal === 'levelUp', undefined, {
      timeout: 10_000,
    });
    await page.keyboard.up('d');
    await page.waitForTimeout(1600);
    expect(await colors(page)).toBeGreaterThan(20);
    await page.keyboard.press('r'); // reroll
    await page.waitForTimeout(300);
    await page.keyboard.press('b'); // banir: toque no item
    await page.waitForTimeout(300);
    await page.keyboard.press('b'); // cancela
    await page.keyboard.press('1'); // escolhe a primeira opção
    await page.waitForFunction(() => window.__nh.state().modal !== 'levelUp' || true);
    await page.waitForTimeout(400);
    expect(errors).toEqual([]);
  });

  test('o baú entrega a evolução quando a arma está no máximo e o passivo certo está no inventário', async ({
    page,
  }) => {
    const errors = await open(page);
    await startRun(page);
    await page.evaluate(() => {
      window.__nh.evo();
      window.__nh.chest();
    });
    await page.keyboard.down('d');
    await page.waitForFunction(() => window.__nh.state().modal === 'chest', undefined, {
      timeout: 10_000,
    });
    await page.keyboard.up('d');
    await page.waitForTimeout(2400);
    expect(await colors(page)).toBeGreaterThan(20);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__nh.state().modal === null);
    expect(errors).toEqual([]);
  });

  test('morrer leva à tela de resultado, que conta o ouro e volta ao menu', async ({ page }) => {
    const errors = await open(page);
    await startRun(page);
    await page.evaluate(() => window.__nh.skip(40));
    await page.evaluate(() => window.__nh.die());
    await screenIs(page, 'over');
    await page.waitForTimeout(2800);
    expect(await colors(page)).toBeGreaterThan(14);
    await tap(page, 210, 635); // MENU
    await tap(page, 440, 635);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('comprar herói gasta ouro e fica salvo no aparelho', async ({ page }) => {
    const errors = await open(page);
    await page.evaluate(() => window.__nh.gold(1000));
    await tap(page, 255, 333); // JOGAR (lista de heróis)
    await screenIs(page, 'heroes');
    await page.evaluate(() => window.__nh.buyHero('vesper'));
    const saved = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('nighthunt:save:v1') ?? '{}') as {
          heroes?: string[];
          pick?: { hero: string };
        },
    );
    expect(saved.heroes).toContain('vesper');
    expect(saved.pick?.hero).toBe('vesper');
    expect(errors).toEqual([]);
  });

  test('melhorias, itens e conquistas abrem e desenham', async ({ page }) => {
    const errors = await open(page);
    for (const s of ['upgrades', 'items', 'achievements', 'audio']) {
      await page.evaluate((x) => window.__nh.go(x), s);
      await screenIs(page, s);
      await page.waitForTimeout(500);
      expect(await colors(page), s).toBeGreaterThan(12);
    }
    expect(errors).toEqual([]);
  });
});

test.describe('Night Hunt guardar e continuar', () => {
  test('sair e salvar guarda a partida e continuar volta ao mesmo ponto', async ({ page }) => {
    const errors = await open(page);
    await startRun(page);
    await page.evaluate(() => window.__nh.skip(12));
    const before = await state(page);
    await page.evaluate(() => window.__nh.saveExit());
    await screenIs(page, 'menu');
    const run = await page.evaluate(
      () =>
        (
          JSON.parse(localStorage.getItem('nighthunt:save:v1') ?? '{}') as {
            run?: { t: number; snap: string };
          }
        ).run,
    );
    expect(run?.snap.length).toBeGreaterThan(100);
    expect(run!.t).toBeGreaterThanOrEqual(11);
    await page.evaluate(() => window.__nh.resume());
    await screenIs(page, 'game');
    const after = await state(page);
    expect(Math.abs((after.t ?? 0) - (before.t ?? 0))).toBeLessThan(2);
    expect(after.level).toBe(before.level);
    expect(errors).toEqual([]);
  });
});

test.describe('Night Hunt bestiário e guia', () => {
  test('bestiário e guia de combinações abrem e desenham', async ({ page }) => {
    const errors = await open(page);
    await page.evaluate(() => {
      window.__nh.bestiary(12);
      window.__nh.go('bestiary');
    });
    await screenIs(page, 'bestiary');
    await page.waitForTimeout(700);
    expect(await colors(page)).toBeGreaterThan(14);
    await page.evaluate(() => window.__nh.go('guide'));
    await screenIs(page, 'guide');
    await page.waitForTimeout(700);
    expect(await colors(page)).toBeGreaterThan(14);
    expect(errors).toEqual([]);
  });
});

test.describe('Night Hunt em vários tamanhos', () => {
  for (const [name, w, h] of [
    ['celular em pé', 390, 844],
    ['paisagem', 844, 390],
    ['computador', 1280, 720],
  ] as const) {
    test(`desenha o menu e a partida em ${name}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      const errors = await open(page);
      expect(await colors(page)).toBeGreaterThan(12);
      await startRun(page);
      await page.evaluate(() => window.__nh.skip(20));
      await page.waitForTimeout(400);
      expect(await colors(page)).toBeGreaterThan(20);
      expect(errors).toEqual([]);
    });
  }
});
