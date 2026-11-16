import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installApi } from './mock-api';
import { DEVICES, measure, setDevice } from './mobile-lib';

/**
 * Varredura de celular (docs/MOBILE-GUIDE.md): cada tela, em retrato e paisagem, em aparelhos pequenos e grandes, com as áreas
 * seguras emuladas (notch, ilha, furo de câmera, barra de gestos). Confere: rolagem horizontal, controle fora da área segura,
 * alvo de toque pequeno, texto cortado, texto miúdo, controle coberto ou cortado pela borda. Grava `test-results/mobile-audit/`.
 *
 * Uso: AUDIT=hub pnpm exec playwright test e2e/mobile-audit.spec.ts --project=desktop --trace off
 * (AUDIT filtra por nome do grupo; AUDIT_SHOTS=1 também salva uma captura por aparelho; AUDIT_DEV filtra aparelhos.)
 */
const OUT = 'test-results/mobile-audit';

/** Grupos de telas (um commit por grupo). Chave: nome do grupo; valor: [nome da tela, rota]. */
type Act = (page: Page) => Promise<void>;
export const GROUPS: Record<string, [string, string, Act?][]> = {
  hub: [
    ['hub', '/'],
    ['hub-fox-cap', '/fox-cap?jogo=atravessa'],
  ],
  ranking: [['ranking', '/ranking']],
  amigos: [
    ['amigos', '/amigos', async (p) => void (await p.getByRole('tab', { name: /^Amigos/ }).click())],
    ['amigos-pedidos', '/amigos', async (p) => void (await p.getByRole('tab', { name: /Pedidos/ }).click())],
    [
      'amigos-adicionar',
      '/amigos',
      async (p) => {
        await p.getByRole('tab', { name: /Adicionar/ }).click();
        await p.getByRole('textbox').first().fill('mar');
        await p.getByRole('button', { name: /Buscar/ }).click();
        await p.waitForTimeout(900);
      },
    ],
    ['amigo-perfil', '/amigos/ana'],
  ],
  perfil: [
    ['perfil', '/perfil'],
    ['entrar', '/entrar'],
    ['criar', '/criar-conta'],
  ],
  cor: [['cor', '/cor']],
  tempo: [['tempo', '/tempo']],
  eco: [['eco', '/eco']],
  atravessa: [['atravessa', '/atravessa']],
  words: [
    ['words', '/words'],
    ['classic', '/words/classic'],
    ['classic-daily', '/words/classic/daily'],
    ['classic-fases', '/words/classic/fases/dueto'],
    ['bee', '/words/bee'],
    ['bee-fases', '/words/bee/fases'],
    ['connect', '/words/connect'],
    ['connect-fases', '/words/connect/fases'],
  ],
  blocks: [['blocks', '/blocks']],
  foxcap: [
    ['desmorona', '/fox-cap/desmorona'],
    ['bola', '/fox-cap/bola'],
    ['counter-fox', '/fox-cap/counter-fox'],
  ],
  minigolf: [
    ['golf-home', '/minigolf'],
    ['golf-fases', '/minigolf/fases'],
    ['golf-bola', '/minigolf/bola'],
  ],
  nighthunt: [['nighthunt', '/nighthunt']],
  sala: [['sala', '/sala?jogo=color']],
};

const only = process.env.AUDIT;
const devFilter = process.env.AUDIT_DEV?.split(',');
const devices = devFilter ? DEVICES.filter((x) => devFilter.includes(x.name)) : DEVICES;

for (const [group, routes] of Object.entries(GROUPS)) {
  if (only && !only.split(',').includes(group)) continue;
  for (const [name, url, act] of routes) {
    test(`mobile ${group} / ${name}`, async ({ page, context }, info) => {
      test.skip(info.project.name !== 'desktop', 'um projeto basta');
      test.setTimeout(120_000);
      await installApi(page);
      const cdp = await context.newCDPSession(page);
      // AUDIT_PWA=1: simula o app instalado (sem barra do navegador; o app troca estilos por `display-mode: standalone`)
      if (process.env.AUDIT_PWA)
        await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] });
      const report: Record<string, string[]> = {};
      mkdirSync(OUT, { recursive: true });
      for (const d of devices) {
        await setDevice(page, cdp, d);
        await page.goto(url);
        await page
          .getByRole('button', { name: 'Agora não' })
          .click({ timeout: 700 })
          .catch(() => undefined);
        await page.waitForTimeout(900);
        if (act) {
          await act(page);
          await page.waitForTimeout(500);
        }
        if (process.env.AUDIT_SHOTS)
          await page.screenshot({ path: `${OUT}/${name}-${d.name}.png` });
        const m = await measure(page, d);
        if (m.length) report[d.name] = m;
      }
      writeFileSync(`${OUT}/${name}.json`, JSON.stringify(report, null, 1));
      const lines = Object.entries(report).flatMap(([k, v]) => v.map((x) => `${k}: ${x}`));
      expect(lines, lines.join('\n')).toEqual([]);
    });
  }
}
