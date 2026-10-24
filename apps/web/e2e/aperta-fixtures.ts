import { dustGoal, energyCap, meetMilestone, minPicks, newSave, pickInto, tickObjects, upgradeIndex, type SaveState } from '@nocap/games';
import type { Page } from '@playwright/test';
import { installApi } from './mock-api';

/** Saves e a conta falsa que os testes de layout do Aperta! compartilham (celular de lado, giro e rolagem). */

/** Jogo avançado: 3 colapsos, melhorias compradas, grimórios de várias raridades e proibido no Cofre. */
export function midSave(): SaveState {
  const s = newSave('layout-meio', Date.now() - 3_600_000, 'Missão meio');
  const lv = s.run.upgradeLevels.slice();
  for (const [id, n] of Object.entries({ lens: 1, gloves: 1, trained: 1, rhythm: 1, satellite: 5, probe: 2, antenna: 2, queue: 1 })) lv[upgradeIndex(id)] = n;
  let run = { ...s.run, upgradeLevels: lv, dust: 3e6, dustLife: 6e6, picks: 9 };
  for (const [id, r, n] of [['moon', 'rare', 3], ['sirius', 'common', 2], ['mercury', 'epic', 2], ['vega', 'common', 1], ['titan', 'legendary', 1]] as const) run = { ...run, ...pickInto(run, id, r, n) };
  return {
    ...s,
    tutorial: 'done',
    storySeen: true,
    collapses: 3,
    regionId: 'kuiper-belt',
    vault: { 'sagittarius-a': 1, m87: 2 },
    seals: 0,
    sparks: { legacy: 14, spent: 0 },
    album: ['moon:common', 'moon:rare', 'sirius:common', 'mercury:epic', 'vega:common', 'titan:legendary', 'sagittarius-a', 'm87'],
    run,
    stats: { ...s.stats, picks: 40, dustTotal: 4e8, objectsCaptured: 30, clicks: 800 },
  };
}

/** Escolha de grimório aberta com a Lua Rara no livro e a Lua Lendária na oferta (evolução). */
export function choiceSave(four = false): SaveState {
  const s = midSave();
  const full = { ...s, run: { ...s.run, energy: energyCap(s.run.picks) + 1 } };
  const opened = tickObjects(full, 1);
  const p = opened.run.pending!;
  const offers = four ? ['moon', 'mercury', 'titan', 'vega'] : ['moon', 'mercury', 'titan'];
  return { ...opened, run: { ...opened.run, pending: { ...p, offers, rarities: { moon: 'legendary', mercury: 'common', titan: 'rare', vega: 'epic' } } } };
}

/** Estrela pronta para colapsar. */
export function readySave(): SaveState {
  const s = midSave();
  const k = s.collapses + 1;
  return { ...s, run: { ...s.run, picks: minPicks(k), dust: dustGoal(k), dustLife: dustGoal(k), ...meetMilestone(s.collapses, s.run.upgradeLevels) }, stats: { ...s.stats, dustTotal: s.stats.dustTotal + dustGoal(k) } };
}

/** Começo do tutorial. */
export function freshSave(): SaveState {
  return { ...newSave('layout-novo', Date.now(), 'Novo'), storySeen: true };
}

export interface Account {
  rev: number;
  data: SaveState | null;
}

export async function installAccount(page: Page, initial: SaveState | null): Promise<Account> {
  await installApi(page);
  const account: Account = { rev: 1, data: initial };
  await page.route(/localhost:3333\/me\/aperta\/saves/, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return json({});
    if (path === '/me/aperta/saves') {
      const d = account.data;
      const one = d && { slot: 1, name: d.name, collapses: d.collapses, vaultCount: Object.keys(d.vault ?? {}).length, lastPlayedAt: new Date().toISOString(), storySeen: d.storySeen, revision: account.rev };
      return json({ slots: [{ slot: 1, save: one, recoverableUntil: null }, { slot: 2, save: null, recoverableUntil: null }] });
    }
    if (path === '/me/aperta/saves/1') {
      if (req.method() === 'GET') return json({ slot: 1, revision: account.rev, data: account.data });
      if (req.method() === 'PUT') {
        account.data = (req.postDataJSON() as { data: SaveState }).data;
        account.rev += 1;
        return json({ revision: account.rev, flagged: [] });
      }
    }
    return json({ message: 'não simulado' }, 404);
  });
  return account;
}

/** Abre o jogo pelo título (Jogar, escolher o espaço, pular a história) e espera a tela de jogo. */
export async function enterGame(page: Page): Promise<void> {
  await page.goto('/arcade/aperta');
  await page.getByRole('button', { name: 'Jogar' }).first().click();
  await page.getByRole('button', { name: /Continuar/ }).first().click();
  const skip = page.getByRole('button', { name: 'Pular história' });
  if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) await skip.click();
  await page.locator('.ap-game').waitFor();
}

/** Tamanhos de celular de lado (CSS px, largura x altura) e os mesmos em pé, que o jogo gira. */
export const PHONES_LANDSCAPE = [
  { name: '568x320', w: 568, h: 320 },
  { name: '667x375', w: 667, h: 375 },
  { name: '844x390', w: 844, h: 390 },
  { name: '932x430', w: 932, h: 430 },
];
export const PHONES_PORTRAIT = [
  { name: '320x568', w: 320, h: 568 },
  { name: '375x667', w: 375, h: 667 },
  { name: '390x844', w: 390, h: 844 },
  { name: '430x932', w: 430, h: 932 },
];
