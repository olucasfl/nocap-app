import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { newBotMemory, botInput } from './bots';
import {
  DSM_BODY_R,
  DSM_DT,
  DSM_GRACE_SEC,
  DSM_LAYERS,
  DSM_TILE_LIFE,
  dsmLayerRadii,
} from './constants';
import { hexCount, hexToWorld, layerY, worldToHex } from './hex';
import { DsmWorld, type DsmInput, type DsmPlayer, type DsmPlayerInfo, type DsmTile } from './world';

const infos = (n: number): DsmPlayerInfo[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: 0xff7d26, bot: true }));

/** Roda o jogo inteiro com bots e devolve o mundo no fim (com trava de segurança de 6 minutos). */
function playBots(seed: string, n: number, maxSec = 360): DsmWorld {
  const w = new DsmWorld(seed, infos(n));
  let i = 0;
  const mem = new Map(
    w.players.map((p) => [p.id, newBotMemory((i % 4) * 0.15, i++ % 3 === 0 ? 0.5 : 0)]),
  );
  const rng = createRng(`${seed}:bots`);
  while (!w.ended && w.t < maxSec) {
    const inputs: Record<string, DsmInput> = {};
    for (const p of w.players) inputs[p.id] = botInput(w, p, mem.get(p.id)!, rng);
    w.step(DSM_DT, inputs);
  }
  return w;
}

describe('hexágonos', () => {
  it('são 6 camadas em losango: a de cima é menor, crescem até a maior e diminuem até a última, a menor', () => {
    for (const n of [2, 5, 8]) {
      const r = dsmLayerRadii(n);
      expect(r).toHaveLength(DSM_LAYERS);
      // o pico fica no meio (com seis camadas, na terceira)
      const mid = r.indexOf(Math.max(...r));
      expect(mid).toBe(Math.floor(DSM_LAYERS / 2) - 1);
      for (let i = 1; i <= mid; i++) expect(r[i]).toBeGreaterThanOrEqual(r[i - 1] as number);
      for (let i = mid + 1; i < DSM_LAYERS; i++)
        expect(r[i]).toBeLessThanOrEqual(r[i - 1] as number);
      expect(r[0]).toBeLessThan(r[mid] as number);
      expect(r[DSM_LAYERS - 1]).toBeLessThan(r[0] as number);
    }
    expect(hexCount(2)).toBe(19);
    expect(hexCount(dsmLayerRadii(8)[3] as number)).toBeGreaterThan(
      hexCount(dsmLayerRadii(2)[3] as number),
    );
    expect(new DsmWorld('s', infos(2)).radii).toEqual(dsmLayerRadii(2));
  });

  it('ida e volta entre hexágono e mundo', () => {
    for (const [q, r] of [
      [0, 0],
      [3, -2],
      [-5, 4],
      [8, -8],
    ] as const) {
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
    expect([...w.tiles.values()].every((t) => t.status !== 'caiu')).toBe(true);
  });

  it('depois da proteção, o ladrilho pisado quebra no tempo certo e quem estava nele cai para a camada de baixo', () => {
    const w = new DsmWorld('s', infos(2));
    // pousa e espera a proteção acabar
    while (w.t < DSM_GRACE_SEC + 0.1 || !w.players[0]!.grounded) w.step(DSM_DT);
    w.step(DSM_DT);
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
    const [a, b] = w.players as [(typeof w.players)[0], (typeof w.players)[0]];
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
  it.each([2, 4, 8])(
    'com %i jogadores a partida termina, com um vencedor, em até 4 minutos',
    (n) => {
      const w = playBots(`fim-${n}`, n);
      expect(w.ended).toBe(true);
      expect(w.winnerId).not.toBeNull();
      expect(w.t).toBeLessThanOrEqual(240);
      expect(w.standings()).toHaveLength(n);
      expect(new Set(w.standings().map((p) => p.id)).size).toBe(n);
    },
  );

  it('as partidas de 8 bots duram de meio minuto a 4 minutos em várias sementes (a arena cresce com os jogadores)', () => {
    for (let i = 0; i < 4; i++) {
      const t = playBots(`dur-${i}`, 8).t;
      expect(t).toBeGreaterThan(30);
      expect(t).toBeLessThanOrEqual(240);
    }
  });
});

describe('modo online', () => {
  it('só simula a raposa local; passo, morte e fim vêm da sala', () => {
    const w = new DsmWorld('on', infos(3));
    w.goOnline('p0');
    for (let i = 0; i < 90; i++) w.step(DSM_DT);
    const remote = w.players[1]!;
    expect(remote.grounded).toBe(false); // a raposa dos outros não cai sozinha
    w.setRemote(remote.id, {
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vz: 0,
      heading: 0,
      grounded: true,
      layer: 0,
    });
    expect(remote.y).toBe(0);
    w.applyStep(0, 0, 0, w.t);
    const tile = w.tile(0, 0, 0)!;
    expect(tile.status).toBe('pisado');
    expect(tile.breakAt).toBeCloseTo(w.t + (DSM_TILE_LIFE[0] as number), 9);
    w.markDead(remote.id);
    expect(remote.alive).toBe(false);
    expect(w.ended).toBe(false); // quem decide o fim é a sala
    w.finish('p0');
    expect(w.ended).toBe(true);
    expect(w.winnerId).toBe('p0');
  });
});

describe('colisão e empurrão (fase 3)', () => {
  const duel = () => {
    const w = new DsmWorld('push', infos(2));
    for (let i = 0; i < 150; i++) w.step(DSM_DT);
    const [a, b] = w.players as [DsmPlayer, DsmPlayer];
    // alinha os dois no chão firme: a corre para a direita contra b parada
    a.x = -1;
    a.z = 0;
    b.x = 0.2;
    b.z = 0;
    for (const p of [a, b]) {
      p.vx = 0;
      p.vz = 0;
      p.kx = 0;
      p.kz = 0;
    }
    return { w, a, b };
  };

  it('os corpos não se atravessam', () => {
    const { w, a, b } = duel();
    for (let i = 0; i < 20; i++) w.step(DSM_DT, { p0: { mx: 0.3, mz: 0, jump: false } });
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(DSM_BODY_R * 1.5);
  });

  it('quem corre contra o outro o empurra, com recuo, e só uma vez por tempo de espera', () => {
    const { w, a, b } = duel();
    let pushes = 0;
    for (let i = 0; i < 60; i++) {
      w.step(DSM_DT, { p0: { mx: 1, mz: 0, jump: false } });
      pushes += w.drainEvents().filter((e) => e.type === 'push').length;
    }
    expect(pushes).toBeGreaterThanOrEqual(1);
    expect(b.x).toBeGreaterThan(0.2 + 0.5);
    expect(pushes).toBeLessThan(8);
    void a;
  });

  it('devagar não empurra', () => {
    const { w, b } = duel();
    for (let i = 0; i < 40; i++) w.step(DSM_DT, { p0: { mx: 0.2, mz: 0, jump: false } });
    expect(w.drainEvents().some((e) => e.type === 'push')).toBe(false);
    expect(b.kx).toBe(0);
  });

  it('online o empurrão em outra raposa vira evento e quem leva aplica o impulso em si', () => {
    const w = new DsmWorld('push', infos(2));
    w.goOnline('p0');
    const [a, b] = w.players as [DsmPlayer, DsmPlayer];
    for (let i = 0; i < 120; i++) w.step(DSM_DT);
    a.x = -1;
    a.z = 0;
    a.y = 0;
    a.grounded = true;
    a.layer = 0;
    a.vx = 6;
    a.vz = 0;
    w.setRemote('p1', { x: -0.3, y: 0, z: 0, vx: 0, vz: 0, heading: 0, grounded: true, layer: 0 });
    w.step(DSM_DT, { p0: { mx: 1, mz: 0, jump: false } });
    const ev = w.drainEvents().find((e) => e.type === 'push');
    expect(ev).toMatchObject({ from: 'p0', to: 'p1' });
    expect(b.kx).toBe(0); // o impulso é aplicado na tela de quem leva
    w.goOnline('p1');
    w.applyKnock('p1', 8, 0);
    expect(b.kx).toBe(8);
  });
});

describe('pulo duplo', () => {
  const landed = () => {
    const w = new DsmWorld('dj', infos(2));
    // para assim que pousa: o chão debaixo dela ainda não quebrou
    for (let i = 0; i < 150 && !(w.players[0] as DsmPlayer).grounded; i++) w.step(DSM_DT);
    w.drainEvents();
    return { w, p: w.players[0] as DsmPlayer };
  };
  const jump: DsmInput = { mx: 0, mz: 0, jump: true };
  const none: DsmInput = { mx: 0, mz: 0, jump: false };

  it('dá um segundo impulso no ar, só um por voo, e volta com o pouso', () => {
    const { w, p } = landed();
    w.step(DSM_DT, { p0: jump });
    expect(p.grounded).toBe(false);
    for (let i = 0; i < 12; i++) w.step(DSM_DT, { p0: none });
    const vyBefore = p.vy;
    w.step(DSM_DT, { p0: jump });
    expect(p.vy).toBeGreaterThan(vyBefore);
    expect(w.drainEvents().filter((e) => e.type === 'airjump')).toHaveLength(1);
    const vyAfter = p.vy;
    w.step(DSM_DT, { p0: jump });
    expect(p.vy).toBeLessThan(vyAfter); // o terceiro toque não faz nada
    expect(w.drainEvents().some((e) => e.type === 'airjump')).toBe(false);
    for (let i = 0; i < 180 && !p.grounded; i++) w.step(DSM_DT, { p0: none });
    expect(p.airJumped).toBe(false);
  });

  it('chega mais alto e mais longe que um pulo só', () => {
    const peak = (double: boolean) => {
      const { w, p } = landed();
      const y0 = p.y;
      let top = y0;
      w.step(DSM_DT, { p0: jump });
      for (let i = 0; i < 90; i++) {
        w.step(DSM_DT, { p0: double && i === 14 ? jump : none });
        top = Math.max(top, p.y);
      }
      return top - y0;
    };
    expect(peak(true)).toBeGreaterThan(peak(false) + 1);
  });

  it('online a raposa dos outros mostra o pulo duplo na borda de subida', () => {
    const w = new DsmWorld('dj', infos(2));
    w.goOnline('p0');
    const s = { x: 0, y: 3, z: 0, vx: 0, vz: 0, heading: 0, grounded: false, layer: 0 };
    w.setRemote('p1', { ...s, airJumped: true });
    w.setRemote('p1', { ...s, airJumped: true });
    expect(w.drainEvents().filter((e) => e.type === 'airjump')).toHaveLength(1);
  });
});

describe('borda e tempo de coiote', () => {
  const grounded = () => {
    const w = new DsmWorld('edge', infos(2));
    for (let i = 0; i < 150 && !(w.players[0] as DsmPlayer).grounded; i++) w.step(DSM_DT);
    return { w, p: w.players[0] as DsmPlayer };
  };
  const jump: DsmInput = { mx: 0, mz: 0, jump: true };

  it('logo depois de sair do chão, o pulo ainda é o primeiro (não o duplo)', () => {
    const { w, p } = grounded();
    // some o chão debaixo dela
    for (const t of w.tiles.values()) if (t.layer === p.layer) t.status = 'caiu';
    w.step(DSM_DT);
    expect(p.grounded).toBe(false);
    w.step(DSM_DT, { p0: jump });
    expect(p.airJumped).toBe(false);
    expect(p.vy).toBeGreaterThan(7);
    w.step(DSM_DT, { p0: jump });
    expect(p.airJumped).toBe(true); // o segundo toque é o pulo duplo
  });

  it('passado o tempo de coiote o toque vira pulo duplo', () => {
    const { w, p } = grounded();
    for (const t of w.tiles.values()) if (t.layer === p.layer) t.status = 'caiu';
    for (let i = 0; i < 12; i++) w.step(DSM_DT);
    w.step(DSM_DT, { p0: jump });
    expect(p.airJumped).toBe(true);
  });

  it('a borda perdoa: com o centro um pouco fora do ladrilho, ainda está no chão', () => {
    const { w, p } = grounded();
    const t = w.standingTile(p.layer, p.x, p.z) as DsmTile;
    // deixa só o ladrilho dela e anda até logo além da borda dele
    for (const o of w.tiles.values()) if (o.layer === p.layer && o !== t) o.status = 'caiu';
    p.x = t.x + 1.0 * Math.cos(0);
    p.z = t.z;
    for (let i = 0; i < 3; i++) w.step(DSM_DT);
    expect(w.standingTile(p.layer, p.x, p.z)).toBeUndefined();
    expect(w.supported(p.layer, p.x, p.z)).toBe(true);
  });

  it('na borda, o ladrilho que sustenta também quebra (a borda não é esconderijo)', () => {
    const { w, p } = grounded();
    const t = w.standingTile(p.layer, p.x, p.z) as DsmTile;
    for (const o of w.tiles.values()) if (o.layer === p.layer && o !== t) o.status = 'caiu';
    t.status = 'firme';
    p.x = t.x + 1.0;
    p.z = t.z;
    p.vx = 0;
    p.vz = 0;
    p.kx = 0;
    p.kz = 0;
    for (let i = 0; i < 4; i++) w.step(DSM_DT);
    expect(w.standingTile(p.layer, p.x, p.z)).toBeUndefined();
    expect(t.status).toBe('pisado');
  });
});
