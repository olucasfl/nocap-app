import { describe, expect, it } from 'vitest';
import { FoxShotRoomEngine } from './foxshot-room.engine';

/** Counter Fox por WebRTC (spec 060): a sala decide quem simula e só guarda o placar que o líder manda. */
function mk(p2p = true) {
  let t = 1_000_000;
  const room = new FoxShotRoomEngine({ code: 'FXP2', now: () => t, newSeed: () => 'seed' });
  room.p2pEnabled = p2p;
  room.join('lia', 'Lia');
  room.join('bia', 'Bia');
  room.configure('lia', { kind: 'dm', bots: 2 } as never);
  room.setReady('bia', true);
  return { room, adv: (ms: number) => (t += ms), now: () => t };
}
const snap = (room: FoxShotRoomEngine) => (room.snapshot('lia') as unknown as { foxshot: { net: string; p2pHost: string | null; setup: unknown } }).foxshot;

describe('Counter Fox ponto a ponto', () => {
  it('com todos conectados ao líder a partida vira p2p e a sala não simula', () => {
    const s = mk();
    s.room.start('lia');
    expect(snap(s.room).net).toBe('pending');
    expect(snap(s.room).p2pHost).toBe('lia');
    expect(snap(s.room).setup).toBeTruthy();
    s.room.p2pReport('lia', true);
    s.room.p2pReport('bia', true);
    s.room.tick();
    expect(snap(s.room).net).toBe('p2p');
    expect(s.room.serverSimulates).toBe(false);
    // chega a hora: a partida roda, mas a sala não anda a simulação
    s.adv(8000);
    s.room.tick();
    expect(s.room.currentPhase).toBe('play');
    expect(s.room.sim!.tick).toBe(0);
    expect(s.room.frameFor('lia')).toBeNull();
  });

  it('quem não consegue conectar leva todo mundo para o servidor', () => {
    const s = mk();
    s.room.start('lia');
    s.room.p2pReport('lia', true);
    s.room.p2pReport('bia', false);
    expect(snap(s.room).net).toBe('server');
    expect(s.room.serverSimulates).toBe(true);
    s.adv(8000);
    s.room.tick();
    s.adv(500);
    s.room.tick();
    expect(s.room.sim!.tick).toBeGreaterThan(0);
  });

  it('sem resposta até o prazo a sala simula', () => {
    const s = mk();
    s.room.start('lia');
    s.adv(7000);
    s.room.tick();
    expect(snap(s.room).net).toBe('server');
  });

  it('o placar do líder fecha a partida e vira o resultado final; se o líder sai, vale o último placar', () => {
    const s = mk();
    s.room.start('lia');
    s.room.p2pReport('lia', true);
    s.room.p2pReport('bia', true);
    s.room.tick();
    s.adv(8000);
    s.room.tick();
    s.room.p2pStatus('lia', [{ id: 'lia', name: 'Lia', points: 300, kills: 3, assists: 0, deaths: 1, place: 1 }, { id: 'bia', name: 'Bia', points: 100, kills: 1, assists: 0, deaths: 3, place: 2 }], false);
    s.room.disconnect('lia');
    s.room.tick();
    s.adv(3000);
    s.room.tick();
    expect(s.room.currentPhase).toBe('final');
    const rows = s.room.finalRows();
    expect(rows.find((r) => r.userId === 'lia')?.placement).toBe(1);
    expect(rows.find((r) => r.userId === 'bia')?.totalTenths).toBe(1000);
  });

  it('só o líder manda placar e a entrada pela sala é ignorada no p2p', () => {
    const s = mk();
    s.room.start('lia');
    s.room.p2pReport('lia', true);
    s.room.p2pReport('bia', true);
    s.room.tick();
    s.adv(8000);
    s.room.tick();
    s.room.p2pStatus('bia', [{ id: 'bia', name: 'Bia', points: 9999, kills: 99, assists: 0, deaths: 0, place: 1 }], true);
    expect((snap(s.room) as unknown as { over: boolean }).over).toBe(false);
    s.room.receive('lia', [{ seq: 1, fwd: 1, strafe: 0, jump: false, crouch: false, walk: false, yaw: 0, pitch: 0, trigger: false, alt: false, reload: false, inspect: false, viewTick: 0 }]);
    expect(s.room.sim!.tick).toBe(0);
  });

  it('sem WebRTC (desligado) tudo segue como antes: a sala simula', () => {
    const s = mk(false);
    s.room.start('lia');
    expect(snap(s.room).net).toBe('server');
  });

  it('modo Bomba: espectar tira a pessoa da partida e o time cheio recusa mais gente', () => {
    const s = mk(false);
    s.room.configure('lia', { kind: 'bomb', botsTr: 4 } as never);
    s.room.setTeam('lia', 'lia', 1);
    expect(() => s.room.setTeam('bia', 'bia', 1)).toThrow('Esse time está cheio');
    s.room.setTeam('bia', 'bia', 2);
    s.room.setTeam('lia', 'lia', 1);
    s.room.start('lia');
    const roster = s.room.sim!.roster.filter((r) => !r.bot).map((r) => r.id);
    expect(roster).toEqual(['lia']);
  });

  it('a sala só tem a Duna: mapa inválido é recusado', () => {
    const s = mk(false);
    expect((s.room.snapshot('lia') as unknown as { foxshot: { map: string } }).foxshot.map).toBe('duna');
    expect(() => s.room.configure('lia', { map: 'xyz' } as never)).toThrow();
    s.room.setReady('bia', true);
    s.room.start('lia');
    expect(s.room.sim!.map.id).toBe('duna');
  });
});
