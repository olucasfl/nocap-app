/* eslint-disable @typescript-eslint/no-explicit-any -- os testes leem o mundo do jogo exposto só em desenvolvimento */
import { expect, test, type Page } from '@playwright/test';

/** Fut Fox no celular (spec 046): o HUD não pode ter nada por cima de nada, em pé e deitado, nos tamanhos mais comuns. */
const phones = [
  { name: 'iphone-se', w: 320, h: 568 },
  { name: 'android-pequeno', w: 360, h: 640 },
  { name: 'iphone-14', w: 390, h: 844 },
  { name: 'android-grande', w: 412, h: 915 },
  { name: 'deitado-844', w: 844, h: 390 },
  { name: 'deitado-667', w: 667, h: 375 },
  { name: 'deitado-568', w: 568, h: 320 },
];

type Box = { x: number; y: number; w: number; h: number };
async function box(page: Page, sel: string): Promise<Box | null> {
  return page.evaluate((s) => {
    const el = document.querySelector(s) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, sel);
}
const hit = (a: Box, b: Box) =>
  a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;

for (const ph of phones) {
  test(`HUD do Fut Fox no celular ${ph.name} (${ph.w}x${ph.h})`, async ({ browser }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    test.setTimeout(120_000);
    const ctx = await browser.newContext({
      viewport: { width: ph.w, height: ph.h },
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/fox-cap/bola');
    await page
      .getByRole('button', { name: 'Agora não' })
      .click({ timeout: 1500 })
      .catch(() => undefined);
    await page.getByTestId('bola-play-btn').click();
    await page.getByTestId('bola-fmt-2x2x2x2').click();
    await page.getByTestId('bola-start').click();
    await expect(page.getByTestId('bola-play')).toBeVisible();
    await page.waitForTimeout(1200);
    await expect(page.getByTestId('bola-tips')).toBeVisible();
    await page.screenshot({ path: `test-results/mob-${ph.name}-tips.png` });
    const tips = await box(page, '.bola-tips');
    expect(tips!.x).toBeGreaterThanOrEqual(0);
    expect(tips!.x + tips!.w).toBeLessThanOrEqual(ph.w + 1);
    expect(tips!.y + tips!.h).toBeLessThanOrEqual(ph.h + 1);
    await page.getByTestId('bola-tips-ok').click();
    await page.waitForTimeout(3500);
    // gol para o cartaz aparecer junto com o HUD
    await page.evaluate(() => {
      const w = (window as any).__bola;
      const g = w.field.goals[1].edge;
      w.lastTouch = { id: 'bot0', team: 0, t: 1 };
      w.lastByTeam[0] = w.lastTouch;
      Object.assign(w.ball, {
        x: g.mx + g.nx * 6,
        y: 0.9,
        z: g.mz + g.nz * 6,
        vx: -g.nx * 20,
        vy: 0,
        vz: -g.nz * 20,
      });
    });
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `test-results/mob-${ph.name}-goal.png` });
    const hud = {
      clock: await box(page, '.bola-clock'),
      gear: await box(page, '.bola-gear'),
      score: await box(page, '.bola-board-row .bola-team'),
      banner: await box(page, '.bola-banner'),
      feed: await box(page, '.bola-feed li'),
      jump: await box(page, '.dsm-jump'),
      cam: await box(page, '.bola-cam'),
    };
    const names = Object.keys(hud) as (keyof typeof hud)[];
    const clashes: string[] = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = hud[names[i]!];
        const b = hud[names[j]!];
        // o cartaz de gol pode ficar por cima do campo, mas não do relógio, do placar nem dos botões
        if (a && b && hit(a, b)) clashes.push(`${names[i]} x ${names[j]}`);
      }
      const a = hud[names[i]!];
      if (a && (a.x < -1 || a.y < -1 || a.x + a.w > ph.w + 1 || a.y + a.h > ph.h + 1))
        clashes.push(`${names[i]} fora da tela`);
    }
    expect(clashes, JSON.stringify(hud)).toEqual([]);
    // menu, times e estatísticas cabem na tela (ou rolam dentro dela)
    await page.waitForTimeout(4500);
    await page.getByTestId('bola-gear').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/mob-${ph.name}-menu.png` });
    const menu = await box(page, '.bola-menu');
    expect(menu!.y).toBeGreaterThanOrEqual(-1);
    expect(menu!.y + menu!.h).toBeLessThanOrEqual(ph.h + 1);
    await page.getByTestId('bola-menu-teams').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/mob-${ph.name}-teams.png` });
    const teams = await box(page, '.bola-teams');
    expect(teams!.y + teams!.h).toBeLessThanOrEqual(ph.h + 1);
    expect(teams!.x + teams!.w).toBeLessThanOrEqual(ph.w + 1);
    await page.getByRole('button', { name: 'Voltar' }).click();
    await page.getByTestId('bola-menu-stats').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/mob-${ph.name}-stats.png` });
    const stats = await box(page, '.bola-stats');
    expect(stats!.x).toBeGreaterThanOrEqual(-1);
    expect(stats!.x + stats!.w).toBeLessThanOrEqual(ph.w + 1);
    expect(stats!.y + stats!.h).toBeLessThanOrEqual(ph.h + 1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}
