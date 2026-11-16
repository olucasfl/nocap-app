import { describe, expect, it } from 'vitest';
import { GP_DT, GP_NET_VERSION } from './constants';
import { GpItemSystem, GpItemView } from './items';
import { GpClient, GpHost } from './net';
import { GpWorld } from './world';

/** Spec 085: os itens na rede (o líder simula; os outros veem o estado e pedem o uso pela entrada). */
const info = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    color: 0xff7d26,
    bot: false,
  }));

function pair() {
  const hw = new GpWorld('n', info(2), undefined, 'arcade');
  hw.beginRace(['p0', 'p1']);
  const sys = new GpItemSystem(hw);
  const host = new GpHost(hw, 'p0', sys);
  const cw = new GpWorld('n', info(2), undefined, 'arcade');
  cw.beginRace(['p0', 'p1']);
  cw.goOnline('p1');
  const client = new GpClient(cw, 'p1');
  client.items = new GpItemView(cw);
  return { hw, sys, host, cw, client };
}
const idle = { throttle: 0, brake: 0, steer: 0 };

describe('itens na rede (spec 085)', () => {
  it('o cliente pede o uso pelo 9º valor da entrada e o líder usa o item dele', () => {
    const { sys, host, client } = pair();
    sys.give('p1', 'nitro');
    const pkt = client.local({ ...idle, item: true });
    expect(pkt.rows.at(-1)!.length).toBe(9);
    host.receive('p1', pkt);
    host.step(idle);
    expect(sys.state('p1').id).toBeNull();
    // sem pedir, a entrada continua com 8 valores (igual ao protocolo de antes)
    expect(client.local(idle).rows.at(-1)!.length).toBe(8);
  });

  it('entrada de 8 e de 9 valores são aceitas; outra coisa é ignorada', () => {
    const { host } = pair();
    host.receive('p1', {
      v: GP_NET_VERSION,
      rows: [
        [1, 1, 0, 0, 0, 0, 0, 0],
        [2, 1, 0, 0, 0, 0, 0, 0, 1],
      ],
    });
    host.receive('p1', { v: GP_NET_VERSION, rows: [[3, 1, 0, 0, 0, 0, 0, 0, 0, 0] as never] });
    expect(() => host.step(idle)).not.toThrow();
  });

  it('o estado dos itens chega ao espelho: item de cada carro, caixas em espera, tiros e eventos', () => {
    const { hw, sys, host, cw, client } = pair();
    const view = client.items!;
    // p0 pega a primeira caixa e lança uma bola
    const b = sys.boxes[0]!;
    const c0 = hw.cars[0]!;
    const pr = hw.track.projectGlobal(b.x, b.z);
    // posição coerente com a pista, senão o motor devolve o carro ao último ponto válido
    Object.assign(c0, { x: b.x, z: b.z, speed: 0, vx: 0, vz: 0, idx: pr.i, s: pr.s, d: pr.d, prog: pr.s });
    c0.lastValid = { x: b.x, z: b.z, h: c0.h, prog: pr.s, idx: pr.i };
    host.step(idle);
    sys.give('p0', 'ball');
    host.step({ ...idle, item: true });
    for (let i = 0; i < 4; i++) host.step(idle);
    client.receive(host.snapshot(), 1000);
    expect(view.boxes[0]!.cd).toBeGreaterThan(0);
    expect(view.shots).toHaveLength(1);
    expect(view.shots[0]!.kind).toBe('ball');
    const ev = view.drainEvents();
    expect(ev.some((e) => e.type === 'use' && e.id === cw.cars[0]!.id)).toBe(true);
    expect(view.state('p1').id).toBeNull();
    // o item de p1 aparece no espelho
    sys.give('p1', 'star');
    client.receive(host.snapshot(), 1040);
    expect(view.state('p1').id).toBe('star');
    void GP_DT;
  });

  it('sem sistema de itens o estado não leva o campo (a Corrida segue igual)', () => {
    const w = new GpWorld('n', info(2), undefined, 'arcade');
    w.beginRace(['p0', 'p1']);
    const host = new GpHost(w, 'p0');
    host.step(idle);
    expect(host.snapshot().it).toBeUndefined();
  });
});
