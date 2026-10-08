import {
  TAP_MS,
  buildPlan,
  colorPoints,
  scoreColor,
  tapPoints,
  type Hsb,
  type MicroSlot,
} from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { INTRO_MS, PartyRoomEngine, RANKING_MS } from './party-room.engine';

type Party = {
  totals: Record<string, number>;
  kind?: string;
  command?: string;
  times: { showAt: number; pickAt: number; endsAt: number };
  challenge: { target: Hsb; start: Hsb; showMs: number; blind: boolean };
  delta?: Record<string, number>;
};

const FAR: Hsb = { h: 180, s: 10, b: 10 };

function make(seed = 'seed-party', ids = ['ana', 'bia'], rounds = 1) {
  let t = 1_000;
  const clock = { advance: (ms: number) => (t += ms), now: () => t };
  const room = new PartyRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => seed });
  ids.forEach((id) => room.join(id, id));
  room.configure(ids[0]!, { rounds });
  ids.slice(1).forEach((id) => room.setReady(id, true));
  room.start(ids[0]!);
  return { room, clock, seed };
}

const party = (room: PartyRoomEngine, viewer = 'ana') =>
  (room.snapshot(viewer) as unknown as { party: Party }).party;

/** Abre o primeiro micro-desafio (passa a introdução). */
function openFirst(room: PartyRoomEngine, clock: ReturnType<typeof make>['clock']) {
  clock.advance(INTRO_MS + 1);
  room.tick();
}

/** Espera o alvo sumir (o momento em que dá para travar a cor). */
function toPick(room: PartyRoomEngine, clock: ReturnType<typeof make>['clock']) {
  clock.advance(party(room).times.pickAt - clock.now() + 1);
}

/** Do ranking para o próximo desafio. */
function nextFromRanking(room: PartyRoomEngine, clock: ReturnType<typeof make>['clock']) {
  clock.advance(RANKING_MS + 1);
  room.tick();
}

/** Joga os 5 micro-desafios; `answer(id, target)` diz o que cada um trava. Devolve os alvos. */
function playMicros(
  room: PartyRoomEngine,
  clock: ReturnType<typeof make>['clock'],
  answer: (id: string, target: Hsb) => Hsb,
  ids = ['ana', 'bia'],
) {
  const targets: Hsb[] = [];
  for (let i = 0; i < 5; i++) {
    toPick(room, clock);
    const target = party(room).challenge.target;
    targets.push(target);
    for (const id of ids) room.submitColor(id, answer(id, target));
    expect(room.currentPhase).toBe('ranking');
    nextFromRanking(room, clock);
  }
  return targets;
}

/** Pontos esperados de quem trava exatamente o alvo em todos os micro-desafios (nota 10). */
const perfectMicros = (seed: string) =>
  (buildPlan(seed, 1).filter((s) => s.kind === 'micro') as MicroSlot[]).reduce(
    (sum, s) => sum + colorPoints(s.variant, 10),
    0,
  );

describe('PartyRoomEngine', () => {
  it('uma rodada tem intro, 5 micro-desafios com ranking, tutorial, grande e fim, sem ranking depois do grande', () => {
    const { room, clock } = make();
    expect(room.currentPhase).toBe('intro');
    openFirst(room, clock);
    expect(room.currentPhase).toBe('micro');
    expect(party(room).kind).toBe('micro');

    playMicros(room, clock, (_id, target) => target);
    expect(room.currentPhase).toBe('tutorial');
    expect(party(room).kind).toBe('big');

    room.tutorialReady('ana');
    expect(room.currentPhase).toBe('tutorial');
    room.tutorialReady('bia');
    expect(room.currentPhase).toBe('big');

    clock.advance(1500 + TAP_MS + 1);
    room.tick();
    expect(room.currentPhase).toBe('final');
  });

  it('só dá para travar a cor depois que o alvo some, e o segundo envio é ignorado', () => {
    const { room, clock } = make();
    openFirst(room, clock);
    const target = party(room).challenge.target;
    expect(() => room.submitColor('ana', target)).toThrow(/Espere o alvo sumir/);
    toPick(room, clock);
    room.submitColor('ana', target);
    room.submitColor('ana', FAR);
    room.submitColor('bia', target);
    // O primeiro envio valeu: ana ficou com os pontos da cor exata, não os da cor longe.
    const slot = buildPlan('seed-party', 1)[0] as MicroSlot;
    expect(party(room).delta!.ana).toBe(colorPoints(slot.variant, 10));
  });

  it('os pontos são decididos só pelo servidor, pela nota da cor e pela variante', () => {
    const { room, clock } = make();
    openFirst(room, clock);
    toPick(room, clock);
    const target = party(room).challenge.target;
    room.submitColor('ana', target);
    room.submitColor('bia', FAR);
    const slot = buildPlan('seed-party', 1)[0] as MicroSlot;
    expect(party(room).delta!.ana).toBe(colorPoints(slot.variant, 10));
    expect(party(room).delta!.bia).toBe(colorPoints(slot.variant, scoreColor(target, FAR)));
  });

  it('recusa cor inválida', () => {
    const { room, clock } = make();
    openFirst(room, clock);
    toPick(room, clock);
    expect(() => room.submitColor('ana', { h: 999, s: 0, b: 0 })).toThrow(/inválida/);
  });

  it('no desafio Invertido acertar a cor exata tira pontos (total negativo)', () => {
    // Procura uma seed em que o primeiro micro-desafio é Invertido.
    let seed = '';
    for (let i = 0; i < 400 && !seed; i++) {
      const s = `inv-${i}`;
      if ((buildPlan(s, 1)[0] as MicroSlot).variant === 'inverted') seed = s;
    }
    expect(seed).not.toBe('');
    const { room, clock } = make(seed);
    openFirst(room, clock);
    toPick(room, clock);
    const target = party(room).challenge.target;
    room.submitColor('ana', target);
    room.submitColor('bia', FAR);
    expect(party(room).delta!.ana).toBe(-500);
    expect(party(room).totals.ana).toBe(-500);
    expect(party(room).delta!.bia).toBeGreaterThan(0);
  });

  it('o grande: toques mais rápidos que o intervalo humano não contam', () => {
    const { room, clock, seed } = make();
    openFirst(room, clock);
    playMicros(room, clock, (_id, target) => target);
    room.tutorialReady('ana');
    room.tutorialReady('bia');
    clock.advance(party(room).times.showAt - clock.now() + 1);

    room.tap('ana');
    clock.advance(10);
    room.tap('ana'); // 10 ms depois: ignorado
    clock.advance(50);
    room.tap('ana'); // 60 ms depois do último que contou: vale
    clock.advance(1500 + TAP_MS + 1);
    room.tick();

    expect(room.currentPhase).toBe('final');
    const rows = room.finalRows();
    const ana = rows.find((r) => r.userId === 'ana')!;
    const bia = rows.find((r) => r.userId === 'bia')!;
    expect(ana.totalTenths).toBe(Math.round((perfectMicros(seed) + tapPoints(2)) / 10));
    expect(bia.totalTenths).toBe(Math.round(perfectMicros(seed) / 10));
    expect(ana.placement).toBe(1);
    expect(bia.placement).toBe(2);
  });

  it('só o líder inicia o grande antes de todos estarem prontos; o tutorial também começa sozinho', () => {
    const { room, clock } = make();
    openFirst(room, clock);
    playMicros(room, clock, (_id, target) => target);
    expect(room.currentPhase).toBe('tutorial');
    expect(() => room.begin('bia')).toThrow(/quem criou a sala/);
    room.begin('ana');
    expect(room.currentPhase).toBe('big');

    // Outra partida: ninguém aperta, o tutorial começa pelo tempo.
    const other = make('seed-b');
    openFirst(other.room, other.clock);
    playMicros(other.room, other.clock, (_id, target) => target);
    expect(other.room.currentPhase).toBe('tutorial');
    other.clock.advance(20_001);
    other.room.tick();
    expect(other.room.currentPhase).toBe('big');
  });

  it('o chat fecha durante os desafios e abre no tutorial, no ranking e no fim', () => {
    const { room, clock } = make();
    expect(() => room.sendChat('ana', 'oi')).not.toThrow();
    openFirst(room, clock);
    clock.advance(1100);
    expect(room.snapshot('ana').chat.open).toBe(false);
    expect(() => room.sendChat('ana', 'oi')).toThrow(/fechado/);
    toPick(room, clock);
    const target = party(room).challenge.target;
    room.submitColor('ana', target);
    room.submitColor('bia', target);
    expect(room.currentPhase).toBe('ranking');
    expect(room.snapshot('ana').chat.open).toBe(true);
  });

  it('empate divide a colocação; sem empate, quem tem mais pontos fica em 1º', () => {
    const tie = make();
    openFirst(tie.room, tie.clock);
    playMicros(tie.room, tie.clock, (_id, target) => target);
    tie.room.begin('ana');
    tie.clock.advance(1500 + TAP_MS + 1);
    tie.room.tick();
    const rows = tie.room.finalRows();
    expect(rows[0]!.totalTenths).toBe(rows[1]!.totalTenths);
    expect(rows.map((r) => r.placement)).toEqual([1, 1]);

    const win = make();
    openFirst(win.room, win.clock);
    playMicros(win.room, win.clock, (id, target) => (id === 'ana' ? target : FAR));
    win.room.begin('ana');
    win.clock.advance(1500 + TAP_MS + 1);
    win.room.tick();
    const byId = Object.fromEntries(win.room.finalRows().map((r) => [r.userId, r.placement]));
    expect(byId).toEqual({ ana: 1, bia: 2 });
  });
});
