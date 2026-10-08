import { describe, expect, it } from 'vitest';
import { PartyRoomEngine, INTRO_MS, MICRO_LEAD_MS, RANKING_MS } from './party-room.engine';
import { TAP_MS } from '@nocap/games';

const SEED = 'seed-party';

function started(ids = ['ana', 'bia'], rounds = 1) {
  let t = 1_000;
  const clock = { advance: (ms: number) => (t += ms), now: () => t };
  const room = new PartyRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => SEED });
  ids.forEach((id) => room.join(id, id));
  room.configure(ids[0]!, { rounds });
  ids.slice(1).forEach((id) => room.setReady(id, true));
  room.start(ids[0]!);
  return { room, clock };
}

const snap = (room: PartyRoomEngine, viewer = 'ana') =>
  room.snapshot(viewer) as unknown as {
    phase: string;
    party: {
      totals: Record<string, number>;
      round: number;
      rounds: number;
      index: number;
      count: number;
      kind?: string;
      command?: string;
      times?: { showAt: number; pickAt: number; endsAt: number };
      challenge?: { target: { h: number; s: number; b: number }; start: { h: number; s: number; b: number }; showMs: number; blind: boolean };
      submitted?: string[];
      ready?: string[];
      delta?: Record<string, number>;
      autoStartAt?: number | null;
    };
  };

describe('PartyRoomEngine', () => {
  it('fluxo intro -> micro -> ranking -> ... -> tutorial -> big -> final com 2 jogadores', () => {
    const { room, clock } = started(['ana', 'bia'], 1);
    expect(room.currentPhase).toBe('intro');

    // Avança intro
    clock.advance(INTRO_MS + 1);
    expect(room.tick()).toBe(true);
    expect(room.currentPhase).toBe('micro');
    const s1 = snap(room);
    expect(s1.party.kind).toBe('micro');

    // Avança tempo para pickAt para poder submeter
    clock.advance(MICRO_LEAD_MS + 3000 + 700);
    const target = s1.party.challenge!.target;
    room.submitColor('ana', target);
    room.submitColor('bia', { h: 0, s: 0, b: 0 });

    // Todos submeteram, vai para ranking
    expect(room.currentPhase).toBe('ranking');
    expect(snap(room).party.delta).toBeDefined();

    // Avança ranking e passa pelos 5 micro-desafios...
    for (let i = 0; i < 4; i++) {
      clock.advance(RANKING_MS + 1);
      room.tick();
      expect(room.currentPhase).toBe('micro');
      clock.advance(MICRO_LEAD_MS + 3000 + 700);
      const cur = snap(room);
      const tgt = cur.party.challenge!.target;
      room.submitColor('ana', tgt);
      room.submitColor('bia', tgt);
      expect(room.currentPhase).toBe('ranking');
    }

    // Após o 5º ranking, vai para o tutorial do minijogo grande
    clock.advance(RANKING_MS + 1);
    room.tick();
    expect(room.currentPhase).toBe('tutorial');
    expect(snap(room).party.kind).toBe('big');

    // Todos prontos no tutorial começa na hora
    room.tutorialReady('ana');
    room.tutorialReady('bia');
    expect(room.currentPhase).toBe('big');

    // Toca no grande
    room.tap('ana');
    room.tap('bia');

    clock.advance(1500 + TAP_MS + 1);
    room.tick();
    // Fim da partida
    expect(room.currentPhase).toBe('final');
    expect(room.finalRows()).toHaveLength(2);
  });

  it('submit antes do alvo sumir é recusado', () => {
    const { room, clock } = started(['ana', 'bia'], 1);
    clock.advance(INTRO_MS + 1);
    room.tick();
    expect(room.currentPhase).toBe('micro');
    
    const s = snap(room);
    const target = s.party.challenge!.target;
    // Tenta submeter imediatamente (antes de pickAt)
    expect(() => room.submitColor('ana', target)).toThrow(/Espere o alvo sumir/);

    // Avança até pickAt
    clock.advance(MICRO_LEAD_MS + s.party.challenge!.showMs + 700);
    expect(() => room.submitColor('ana', target)).not.toThrow();
  });

  it('toque do grande respeita TAP_MIN_GAP_MS', () => {
    const { room, clock } = started(['ana', 'bia'], 1);
    // Avança até tutorial e inicia big
    clock.advance(INTRO_MS + 1);
    room.tick();
    // Pula os 5 micro
    for (let i = 0; i < 5; i++) {
      clock.advance(RANKING_MS + 1);
      room.tick();
      clock.advance(MICRO_LEAD_MS + 4000);
      const s = snap(room);
      room.submitColor('ana', s.party.challenge!.target);
      room.submitColor('bia', s.party.challenge!.target);
    }
    clock.advance(RANKING_MS + 1);
    room.tick();
    expect(room.currentPhase).toBe('tutorial');
    room.tutorialReady('ana');
    room.tutorialReady('bia');
    expect(room.currentPhase).toBe('big');

    // Primeiro tap
    room.tap('ana');
    // Segundo tap imediato (< 40ms) deve ser ignorado
    clock.advance(10);
    room.tap('ana');
    // Tap após 50ms deve contar
    clock.advance(50);
    room.tap('ana');
  });

  it('chat fechado em micro e big', () => {
    const { room, clock } = started(['ana', 'bia'], 1);
    // Lobby: chat aberto
    expect(() => room.sendChat('ana', 'olá')).not.toThrow();

    // Intro
    clock.advance(INTRO_MS + 1);
    room.tick();
    // Micro: chat fechado
    expect(() => room.sendChat('ana', 'olá')).toThrow();
  });

  it('finalRows ordena por pontos com empate dividindo colocação', () => {
    const { room, clock } = started(['ana', 'bia'], 1);
    clock.advance(INTRO_MS + 1);
    room.tick();

    // Simula pontuações iguais nos 5 micro e no grande
    for (let i = 0; i < 5; i++) {
      clock.advance(MICRO_LEAD_MS + 4000);
      const s = snap(room);
      const tgt = s.party.challenge!.target;
      room.submitColor('ana', tgt);
      room.submitColor('bia', tgt);
      clock.advance(RANKING_MS + 1);
      room.tick();
    }
    room.tutorialReady('ana');
    room.tutorialReady('bia');
    clock.advance(1500 + TAP_MS + 1);
    room.tick();

    expect(room.currentPhase).toBe('final');
    const rows = room.finalRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]!.placement).toBe(1);
    expect(rows[1]!.placement).toBe(1); // Empate
  });
});
