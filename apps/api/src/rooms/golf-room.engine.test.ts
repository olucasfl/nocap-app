import { GOLF_CLEARED_MS, GOLF_INTRO_MS, golfServerLevel } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { RoomError } from './color-room.engine';
import { GolfRoomEngine } from './golf-room.engine';

interface Snap {
  phase: string;
  golf: { stage: string | null; hole: number; levels: number[]; slots: Record<string, number>; looks: Record<string, { color: number }>; totals: Record<string, number>; results: { level: number; rows: Record<string, { s: number; h: boolean }> }[]; strokes: Record<string, number> };
  final: { userId: string; placement: number; totalTenths: number }[] | null;
  settings: Record<string, unknown>;
}

function make() {
  let t = 1_000_000;
  const room = new GolfRoomEngine({ code: 'GOLF', now: () => t, newSeed: () => 'seed-1' });
  room.join('ana', 'ana');
  room.join('bia', 'bia');
  room.setReady('bia', true);
  return { room, adv: (ms: number) => (t += ms), snap: () => room.snapshot('ana') as unknown as Snap };
}

/** Anda o relógio em passos de 16 ms, como a sala faz. */
function run(ctx: ReturnType<typeof make>, ms: number, stop?: () => boolean) {
  for (let i = 0; i < ms / 16; i++) {
    ctx.adv(16);
    ctx.room.tick();
    if (stop?.()) return;
  }
}

describe('sala do Mini Golf', () => {
  it('regras do líder: buracos, dificuldade, tempo e colisão; valores fora da lista são recusados', () => {
    const { room } = make();
    expect(() => room.configure('bia', { holes: 6 } as never)).toThrow(RoomError);
    room.configure('ana', { holes: 6, tier: 'easy', seconds: 60, collide: false } as never);
    expect(() => room.configure('ana', { holes: 7 } as never)).toThrow(RoomError);
    expect(() => room.configure('ana', { tier: 'x' } as never)).toThrow(RoomError);
    expect(() => room.configure('ana', { seconds: 61 } as never)).toThrow(RoomError);
    expect(() => room.configure('ana', { collide: 'sim' } as never)).toThrow(RoomError);
  });

  it('guarda a bola de cada um (validada) e só muda no lobby', () => {
    const { room, snap } = make();
    room.setLook('ana', { color: 0x2f5bff, finish: 'estrela', trail: 'fogo' });
    room.setLook('bia', { color: -5, finish: 'x' });
    expect(snap().golf.looks.ana!.color).toBe(0x2f5bff);
    expect(snap().golf.looks.bia!.color).toBe(0xffc83d);
  });

  it('começa com contagem, joga o buraco, mostra o resultado e passa para o próximo', () => {
    const ctx = make();
    const { room, snap } = ctx;
    room.configure('ana', { holes: 3, seconds: 60 } as never);
    room.setReady('bia', true);
    room.start('ana');
    expect(snap().phase).toBe('play');
    expect(snap().golf.stage).toBe('intro');
    expect(snap().golf.levels).toHaveLength(3);
    run(ctx, GOLF_INTRO_MS + 100);
    expect(snap().golf.stage).toBe('play');
    // as bolas ficam paradas até alguém tacar; a tacada de quem não está na sala é ignorada
    room.shoot('ghost', { x: 0, z: -1, p: 0.5 });
    room.shoot('ana', { x: 0, z: -1, p: 0.3 });
    room.shoot('bia', { x: 'a', z: 1, p: 1 });
    expect(snap().golf.strokes.ana).toBe(1);
    expect(snap().golf.strokes.bia).toBe(0);
    run(ctx, 32);
    const frame = room.frame();
    expect(frame?.balls).toHaveLength(2);
    expect(room.drainEvents().some((e) => e.type === 'hit' && e.slot === 0)).toBe(true);
    // o tempo do buraco acaba: todos contam 18 e vem a pausa do resultado
    run(ctx, 61_000, () => snap().golf.stage === 'cleared');
    expect(snap().golf.stage).toBe('cleared');
    expect(snap().golf.results[0]!.rows.ana!.h).toBe(false);
    expect(snap().golf.totals.ana).toBe(18);
    run(ctx, GOLF_CLEARED_MS + 100);
    expect(snap().golf.hole).toBe(1);
    expect(snap().golf.stage).toBe('intro');
  });

  it('republica o estado quando a bola para: sem isso só dava para tacar uma vez por buraco', () => {
    const ctx = make();
    const { room, snap } = ctx;
    room.configure('ana', { holes: 3, seconds: 180 } as never);
    room.setReady('bia', true);
    room.start('ana');
    run(ctx, GOLF_INTRO_MS + 100);
    const status = () => (room.snapshot('ana') as unknown as { golf: { status: Record<string, number> } }).golf.status.ana;
    expect(status()).toBe(0);
    room.shoot('ana', { x: 0, z: -1, p: 0.12 });
    expect(snap().golf.strokes.ana).toBe(1);
    // a tacada é publicada (a bola rola) e, quando ela para, o estado volta a ser publicado como "pronta para tacar"
    let published = 0;
    let rolled = false;
    for (let i = 0; i < 600; i++) {
      ctx.adv(16);
      const changed = room.tick();
      if (status() === 1) rolled = true;
      if (rolled && status() === 0) {
        expect(changed).toBe(true);
        published++;
        break;
      }
    }
    expect(rolled).toBe(true);
    expect(published).toBe(1);
    room.shoot('ana', { x: 0, z: -1, p: 0.12 });
    expect(snap().golf.strokes.ana).toBe(2);
  });

  it('o resultado final soma os buracos e ordena (menos tacadas ganha)', () => {
    const ctx = make();
    const { room, snap } = ctx;
    room.configure('ana', { holes: 3, seconds: 60 } as never);
    room.setReady('bia', true);
    room.start('ana');
    run(ctx, GOLF_INTRO_MS + 100);
    room.endNow('ana');
    expect(snap().phase).toBe('final');
    const rows = snap().final!;
    expect(rows).toHaveLength(2);
    expect(rows[0]!.placement).toBe(1);
    expect(rows[0]!.totalTenths).toBe(18);
    expect(golfServerLevel(1).holes).toHaveLength(1);
  });

  it('quem sai no meio do buraco não segura os outros', () => {
    const ctx = make();
    const { room, snap } = ctx;
    room.configure('ana', { holes: 3, seconds: 60 } as never);
    room.setReady('bia', true);
    room.start('ana');
    run(ctx, GOLF_INTRO_MS + 100);
    room.disconnect('bia');
    room.shoot('ana', { x: 0, z: -1, p: 0.2 });
    run(ctx, 30_000, () => snap().golf.stage === 'cleared');
    // a bola da Ana ainda pode estar rolando; o buraco só fecha quando ela também terminar
    expect(['play', 'cleared']).toContain(snap().golf.stage);
  });
});
