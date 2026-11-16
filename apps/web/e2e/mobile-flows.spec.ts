import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';
import { DEVICES, measure, setDevice } from './mobile-lib';

/**
 * Varredura de celular nas telas de dentro dos jogos (painéis dos hubs, partida, fim). Cada fluxo chega à tela uma vez (num
 * aparelho médio) e depois a mesma tela é medida em todos os tamanhos (a tela responde ao redimensionar, como ao girar o celular).
 * Uso: FLOW=cor pnpm exec playwright test e2e/mobile-flows.spec.ts --project=desktop --trace off  (FLOW filtra por nome).
 */
const OUT = 'test-results/mobile-audit';
type Step = (page: Page) => Promise<void>;
const click = (id: string): Step => async (p) => void (await p.getByTestId(id).click());
const key = (k: string): Step => async (p) => void (await p.keyboard.press(k));
const wait = (ms: number): Step => async (p) => void (await p.waitForTimeout(ms));

const hubPanels = (game: string, url: string, mode: string): [string, string, Step[]][] => [
  [`${game}-modos`, url, [click('menu-modes')]],
  [`${game}-modo`, url, [click('menu-modes'), click(`mode-${mode}`)]],
  [`${game}-amigos`, url, [click('menu-friends')]],
  [`${game}-regras`, url, [click('menu-rules')]],
  [`${game}-config`, url, [click('menu-settings')]],
  [`${game}-daily`, url, [click('menu-daily')]],
  [`${game}-ranking`, url, [click('menu-ranking')]],
  [`${game}-jogo`, url, [click('menu-modes'), click(`mode-${mode}`), click(`play-${mode}`), wait(1200)]],
];

const FLOWS: [string, string, Step[]][] = [
  ...hubPanels('cor', '/cor', 'classic'),
  ...hubPanels('tempo', '/tempo', 'classic'),
  ...hubPanels('eco', '/eco', 'classic'),
  ['classic-jogo', '/words/classic/fase/classic/1', [wait(800)]],
  ['classic-dueto', '/words/classic/fase/dueto/1', [wait(800)]],
  ['bee-jogo', '/words/bee/fase/1', [wait(800)]],
  ['connect-jogo', '/words/connect/fase/1', [wait(800)]],
];

const only = process.env.FLOW?.split(',');
for (const [name, url, steps] of FLOWS) {
  if (only && !only.some((o) => name.startsWith(o))) continue;
  test(`fluxo ${name}`, async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'um projeto basta');
    test.setTimeout(150_000);
    await installApi(page);
    const cdp = await context.newCDPSession(page);
    mkdirSync(OUT, { recursive: true });
    await setDevice(page, cdp, DEVICES.find((d) => d.name === 'iph15')!);
    await page.goto(url);
    await page
      .getByRole('button', { name: 'Agora não' })
      .click({ timeout: 700 })
      .catch(() => undefined);
    await page.waitForTimeout(700);
    for (const s of steps) await s(page);
    await page.waitForTimeout(500);
    const report: Record<string, string[]> = {};
    for (const d of DEVICES) {
      await setDevice(page, cdp, d);
      await page.waitForTimeout(450);
      if (process.env.AUDIT_SHOTS) await page.screenshot({ path: `${OUT}/f-${name}-${d.name}.png` });
      const m = await measure(page, d);
      if (m.length) report[d.name] = m;
    }
    writeFileSync(`${OUT}/f-${name}.json`, JSON.stringify(report, null, 1));
    const lines = Object.entries(report).flatMap(([k, v]) => v.map((x) => `${k}: ${x}`));
    expect(lines, lines.join('\n')).toEqual([]);
  });
}
