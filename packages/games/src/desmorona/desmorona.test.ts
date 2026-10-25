import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { newBotMemory, botInput } from './bots';
import { DSM_DT, DSM_GRACE_SEC, DSM_LAYERS, DSM_TILE_LIFE, dsmLayerRadii } from './constants';
import { hexCount, hexToWorld, layerY, worldToHex } from './hex';
import { DsmWorld, type DsmInput, type DsmPlayerInfo } from './world';

const infos = (n: number): DsmPlayerInfo[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: 0xff7d26, bot: true }));

/** Roda o jogo inteiro com bots e devolve o mundo no fim (com trava de segurança de 6 minutos). */
function playBots(seed: string, n: number, maxSec = 360): DsmWorld {
  const w = new DsmWorld(seed, infos(n));
  let i = 0;
  const mem = new Map(w.players.map((p) => [p.id, newBotMemory((i++ % 4) * 0.15)]));
  const rng = createRng(`${seed}:bots`);
  while (!w.ended && w.t < maxSec) {
    const inputs: Record<string, DsmInput> = {};
    for (const p of w.players) inputs[p.id] = botInput(w, p, mem.get(p.id)!, rng);
    w.step(DSM_DT, inputs);
  }
  return w;
}

describe('hexágonos', () => {
  it('são 5 camadas, cada uma menor que a de cima, e a arena cresce com os jogadores', () => {
    for (const n of [2, 5, 8]) {
      const r = dsmLayerRadii(n);
      expect(r).toHaveLength(DSM_LAYERS);
      for (let i = 1; i < DSM_LAYERS; i++) expect(r[i]).toBeLessThan(r[i - 1] as number);
    }
    expect(hexCount(2)).toBe(19);
    expect(hexCount(dsmLayerRadii(8)[0] as number)).toBeGreaterThan(hexCount(dsmLayerRadii(2)[0] as number));
    expect(new DsmWorld('s', infos(2)).radii).toEqual(dsmLayerRadii(2));
  });

  it('ida e volta entre hexágono e mundo', () => {
    for (const [q, r] of [[0, 0], [3, -2], [-5, 4], [8, -8]] as const) {
      const p = hexToWorld(q, r);
      expect(worldToHex(p.x, p.z)).toEqual({ q, r });
    }
  });
});

describe('mundo', () => {
  it('todos começam no ar, vivos e acima da primeira camada', () => {
    const w = new DsmWorld('s', infos(4));
    expect(w.players).toHaveLength(4);
    for (const p of w.players) {
      expect(p.alive).toBe(true);
      expect(p.grounded).toBe(false);
      expect(p.y).toBeGreaterThan(layerY(0));
    }
  });

  it('as raposas caem e pousam na camada de cima, e a queda não quebra nada na proteção', () => {
    const w = new DsmWorld('s', infos(4));
    for (let i = 0; i < 90 && w.players.some((p) => !p.grounded); i++) w.step(DSM_DT);
    expect(w.players.every((p) => p.grounded && p.layer === 0)).toBe(true);
    expect(w.t).toBeLessThan(DSM_GRACE_SEC);
    expect([...w.tiles.values()].every((t) => t.status === 'firme')).toBe(true);
  });

  it('depois da proteção, o ladrilho pisado quebra no tempo certo e quem estava nele cai para a camada de baixo', () => {
    const w = new DsmWorld('s', infos(2));
    // pousa e espera a proteção acabar
    while (w.t < DSM_GRACE_SEC + 0.1) w.step(DSM_DT);
    const p = w.players[0]!;
    const tile = w.standingTile(0, p.x, p.z)!;
    expect(tile.status).toBe('pisado');
    const born = tile.breakAt - (DSM_TILE_LIFE[0] as number);
    expect(born).toBeGreaterThanOrEqual(DSM_GRACE_SEC - 1e-6);
    while (tile.status !== 'caiu' && w.t < 10) w.step(DSM_DT);
    expect(tile.status).toBe('caiu');
    expect(w.t).toBeGreaterThanOrEqual(tile.breakAt);
    for (let i = 0; i < 180 && p.layer === 0 && p.alive; i++) w.step(DSM_DT);
    expect(p.grounded || p.deepest >= 1 || !p.alive).toBe(true);
  });

  it('cair da última camada elimina, e o último vivo vence', () => {
    const w = new DsmWorld('s', infos(2));
    const [a, b] = w.players as [typeof w.players[0], typeof w.players[0]];
    a.x = 40; // longe da arena inteira: cai direto até a lava
    a.z = 40;
    for (let i = 0; i < 600 && !w.ended; i++) w.step(DSM_DT);
    expect(a.alive).toBe(false);
    expect(w.ended).toBe(true);
    expect(w.winnerId).toBe(b.id);
    expect(w.standings()[0]?.id).toBe(b.id);
    expect(w.deaths).toEqual([a.id]);
  });

  it('é determinístico: mesma seed e mesmos jogadores dão o mesmo fim', () => {
    const a = playBots('det', 4);
    const b = playBots('det', 4);
    expect(a.winnerId).toBe(b.winnerId);
    expect(a.deaths).toEqual(b.deaths);
    expect(a.t).toBeCloseTo(b.t, 9);
  });
});

describe('partidas com bots', () => {
  it.each([2, 4, 8])('com %i jogadores a partida termina, com um vencedor, em até 4 minutos', (n) => {
    const w = playBots(`fim-${n}`, n);
    expect(w.ended).toBe(true);
    expect(w.winnerId).not.toBeNull();
    expect(w.t).toBeLessThanOrEqual(240);
    expect(w.standings()).toHaveLength(n);
    expect(new Set(w.standings().map((p) => p.id)).size).toBe(n);
  });

  it('as partidas de 8 bots duram de 2,5 a 4 minutos em várias sementes (a arena cresce com os jogadores)', () => {
    for (let i = 0; i < 4; i++) {
      const t = playBots(`dur-${i}`, 8).t;
      expect(t).toBeGreaterThan(150);
      expect(t).toBeLessThanOrEqual(240);
    }
  });
});
