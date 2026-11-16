import { mkdirSync } from 'node:fs';
import { test } from '@playwright/test';
import { DEVICES, setDevice } from './mobile-lib';

/**
 * Night Hunt em celular: o jogo é um canvas (sem DOM para medir), então esta varredura só tira capturas de cada tela em
 * aparelhos pequenos e grandes, retrato e paisagem, para revisar à mão (corte nas bordas, texto miúdo, botão pequeno).
 */
const OUT = 'test-results/mobile-audit';
interface Nh {
  go(s: string): void;
  state(): { screen: string };
  xp(n: number): void;
  die(): void;
  pick(h: string, m: string): void;
  bestiary(n: number): void;
}
declare global {
  interface Window {
    __nh: Nh;
  }
}
const PICK = ['se', 'iph15', 'se-land', 'iph15-land', 'ipad'];
const SCREENS = ['menu', 'heroes', 'maps', 'upgrades', 'achievements', 'items', 'bestiary', 'guide', 'audio'];

test('night hunt: capturas de cada tela', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'um projeto basta');
  test.setTimeout(240_000);
  mkdirSync(OUT, { recursive: true });
  const cdp = await context.newCDPSession(page);
  await setDevice(page, cdp, DEVICES.find((d) => d.name === 'iph15')!);
  await page.goto('/nighthunt');
  await page.getByRole('button', { name: 'Agora não' }).click({ timeout: 3000 }).catch(() => undefined);
  await page.waitForFunction(() => window.__nh?.state().screen === 'menu', undefined, { timeout: 20_000 });
  await page.evaluate(() => {
    window.__nh.pick('knight', 'forest');
    window.__nh.bestiary(1);
  });
  const shot = async (name: string) => {
    for (const d of DEVICES.filter((x) => PICK.includes(x.name))) {
      await setDevice(page, cdp, d);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/nh-${name}-${d.name}.png` });
    }
  };
  for (const s of SCREENS) {
    await page.evaluate((x) => window.__nh.go(x), s);
    await page.waitForTimeout(700);
    await shot(s);
  }
  await page.evaluate(() => window.__nh.go('maps'));
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__nh.state().screen === 'game');
  await page.waitForTimeout(1500);
  await shot('game');
  await page.evaluate(() => window.__nh.xp(25));
  await page.waitForTimeout(1500);
  await shot('levelup');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await shot('pause');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__nh.die());
  await page.waitForFunction(() => window.__nh.state().screen === 'over', undefined, { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await shot('over');
});
