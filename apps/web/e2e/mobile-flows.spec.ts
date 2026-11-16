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
const btn = (name: RegExp, last = false): Step => async (p) => {
  const l = p.getByRole('button', { name });
  await (last ? l.last() : l.first()).click();
};
const evalFinal = (mode: string, record: boolean): Step => async (p) => {
  await p.waitForFunction(() => !!(window as unknown as { __blocksFinal?: unknown }).__blocksFinal);
  await p.evaluate(
    ([m, r]) => (window as unknown as { __blocksFinal: (m: string, r: boolean) => void }).__blocksFinal(m as string, r as boolean),
    [mode, record],
  );
  await p.waitForTimeout(1500);
};
const tips: Step = async (p) => void (await p.getByTestId('game-tips-ok').click({ timeout: 2500 }).catch(() => undefined));
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
  ['blocks-folha-classic', '/blocks', [btn(/Block Classic/i), wait(600)]],
  ['blocks-folha-towers', '/blocks', [btn(/Block Towers/i), wait(600)]],
  ['blocks-jogo-classic', '/blocks', [btn(/Block Classic/i), wait(500), btn(/^Jogar/, true), wait(2500)]],
  ['blocks-jogo-towers', '/blocks', [btn(/Block Towers/i), wait(500), btn(/^Jogar/, true), wait(2500)]],
  ['blocks-fim-classic', '/blocks', [evalFinal('classic', true)]],
  ['blocks-fim-towers', '/blocks', [evalFinal('towers', false)]],
  ['atravessa-jogo', '/fox-cap?jogo=atravessa', [click('gl-offline'), wait(1500), tips, wait(500)]],
  ['desmorona-config', '/fox-cap?jogo=desmorona', [click('gl-offline'), wait(600)]],
  ['desmorona-jogo', '/fox-cap?jogo=desmorona', [click('gl-offline'), click('dsm-start'), wait(2500), tips]],
  ['ping-config', '/fox-cap?jogo=pingpong', [click('gl-offline'), wait(600)]],
  ['ping-jogo', '/fox-cap?jogo=pingpong', [click('gl-offline'), click('png-level-medio'), click('png-start'), wait(2500), tips]],
  ['bola-config', '/fox-cap?jogo=bola', [click('gl-offline'), wait(600)]],
  ['bola-jogo', '/fox-cap?jogo=bola', [click('gl-offline'), click('bola-fmt-2x2'), click('bola-start'), wait(2500), tips]],
  ['golf-jogo', '/minigolf/jogar?fase=1', [wait(3000), tips]],
  ['golf-online', '/minigolf', [click('mg-online'), wait(500)]],
  ['nighthunt-menu', '/nighthunt', [wait(2500)]],
  ['counterfox-menu', '/fox-cap/counter-fox', [wait(1500)]],
  ['counterfox-jogar', '/fox-cap/counter-fox', [click('cfh-play'), wait(800)]],
  ['counterfox-offline', '/fox-cap/counter-fox', [click('cfh-play'), click('cfh-offline'), wait(800)]],
  ['foxgp-home', '/fox-cap?jogo=foxgp', [click('gl-offline'), wait(1500)]],
  ['foxgp-jogo', '/fox-cap?jogo=foxgp', [click('gl-offline'), click('gp-physics-arcade'), click('gp-start'), wait(6000), tips]],
  ['sala-cor', '/sala?jogo=color', [wait(800)]],
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
