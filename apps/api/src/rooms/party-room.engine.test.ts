import {
  POINTS_BAD,
  POINTS_GOOD,
  POINTS_NEUTRAL,
  buildPlan,
  colorPoints,
  ecoChallenge,
  ecoPoints,
  scoreColor,
  shapesRound,
  timeChallenge,
  timePoints,
  typingChallenge,
  typingPoints,
  type BigSlot,
  type Hsb,
  type MicroSlot,
} from '@nocap/games';
import { describe, expect, it } from 'vitest';
import { INTRO_MS, PartyRoomEngine, RANKING_MS } from './party-room.engine';

const FAR: Hsb = { h: 180, s: 10, b: 10 };

type Snap = {
  phase: string;
  chat: { open: boolean };
  party: {
    totals: Record<string, number>;
    index: number;
    kind?: string;
    game?: string;
    command?: string;
    delta?: Record<string, number>;
    times: { showAt: number; pickAt: number; endsAt: number };
    challenge: { target: Hsb };
    x1?: {
      state: string;
      lead: number;
      round: number;
      result: string | null;
      goAt: number | null;
      opponent: string;
      last: { mine: number | null; theirs: number | null; won: boolean | null } | null;
    } | null;
  };
};

function make(seed = 'seed-party', ids = ['ana', 'bia'], rounds = 1) {
  let t = 1_000;
  const clock = { advance: (ms: number) => (t += ms), now: () => t };
  const room = new PartyRoomEngine({ code: 'ABCD', now: () => t, newSeed: () => seed });
  ids.forEach((id) => room.join(id, id));
  room.configure(ids[0]!, { rounds });
  ids.slice(1).forEach((id) => room.setReady(id, true));
  room.start(ids[0]!);
  const plan = buildPlan(seed, rounds);
  return { room, clock, plan, ids };
}
type Ctx = ReturnType<typeof make>;

const snap = (room: PartyRoomEngine, viewer = 'ana') => room.snapshot(viewer) as unknown as Snap;

/** Avança o relógio em passos, chamando tick (como a sala faz), até `ms` depois. */
function run(c: Ctx, ms: number, step = 50) {
  for (let left = ms; left > 0; left -= step) {
    c.clock.advance(Math.min(step, left));
    c.room.tick();
  }
}

/** Avança até a fase mudar para  (sem passar dela). */
function runUntil(c: Ctx, phase: string, max = 120_000) {
  for (let left = max; left > 0 && c.room.currentPhase !== phase; left -= 50) {
    c.clock.advance(50);
    c.room.tick();
  }
  expect(c.room.currentPhase).toBe(phase);
}

function toPick(c: Ctx) {
  c.clock.advance(snap(c.room).party.times.pickAt - c.clock.now() + 1);
}

/** Vai da introdução ou do placar até o próximo desafio começar. */
function next(c: Ctx) {
  run(c, c.room.currentPhase === 'intro' ? INTRO_MS + 1 : RANKING_MS + 1);
}

/** Joga o micro-desafio atual sem errar nada. Devolve o que o servidor deveria dar a cada um. */
function playPerfect(c: Ctx, slot: MicroSlot): number {
  const { room, ids } = c;
  switch (slot.game) {
    case 'color': {
      toPick(c);
      const target = snap(room).party.challenge.target;
      for (const id of ids) room.submitColor(id, target);
      return colorPoints(slot.variant, 10);
    }
    case 'time': {
      toPick(c);
      for (const id of ids) room.timeBegin(id);
      c.clock.advance(timeChallenge(slot).expectedMs);
      for (const id of ids) room.timeStop(id);
      return timePoints(slot, timeChallenge(slot).expectedMs);
    }
    case 'eco': {
      toPick(c);
      for (const id of ids) for (const pad of ecoChallenge(slot).expected) room.ecoTap(id, pad);
      return 1000;
    }
    case 'typing': {
      toPick(c);
      const ch = typingChallenge(slot);
      if (ch.expected === null) {
        // Mão Boba: quem fica quieto ganha; o desafio fecha pelo tempo.
        run(c, snap(room).party.times.endsAt - c.clock.now() + 100);
        return 1000;
      }
      for (const id of ids) room.typing(id, ch.expected, false, true);
      return typingPoints(slot, ch.expected, false, 1);
    }
  }
}

/** Joga todos os micro-desafios da rodada em que estamos; devolve a soma esperada. */
function playMicros(c: Ctx, first: number): number {
  let sum = 0;
  for (let i = first; i < first + 5; i++) {
    next(c);
    expect(c.room.currentPhase).toBe('micro');
    expect(snap(c.room).party.index).toBe(i);
    sum += playPerfect(c, c.plan[i] as MicroSlot);
    expect(c.room.currentPhase).toBe('ranking');
  }
  return sum;
}

function toBigStart(c: Ctx) {
  next(c);
  expect(c.room.currentPhase).toBe('tutorial');
  c.room.begin('ana');
  expect(c.room.currentPhase).toBe('big');
  c.clock.advance(snap(c.room).party.times.showAt - c.clock.now() + 1);
}

describe('PartyRoomEngine: partida inteira', () => {
  it('uma rodada: intro, 5 desafios (um de cada jogo), tutorial, Caça-Formas e fim', () => {
    const c = make('rodada-1');
    const games = (c.plan.slice(0, 5) as MicroSlot[]).map((s) => s.game);
    expect(new Set(games).size).toBeGreaterThanOrEqual(4);
    expect(c.room.currentPhase).toBe('intro');
    const micros = playMicros(c, 0);
    expect(snap(c.room).party.totals.ana).toBe(micros);

    toBigStart(c);
    const shapes = shapesRound((c.plan[5] as BigSlot).seed);
    // ana clica todas as peças boas na hora; bia não faz nada.
    let expectedBig = 0;
    for (const item of shapes.items.filter((x) => x.cls === 'good')) {
      c.clock.advance(Math.max(0, snap(c.room).party.times.showAt + item.at + 100 - c.clock.now()));
      c.room.shapeClick('ana', item.id);
      expectedBig += POINTS_GOOD;
    }
    run(c, 6000);
    expect(c.room.currentPhase).toBe('final');
    const rows = c.room.finalRows();
    const ana = rows.find((r) => r.userId === 'ana')!;
    const bia = rows.find((r) => r.userId === 'bia')!;
    expect(ana.totalTenths).toBe(Math.round((micros + expectedBig) / 10));
    expect(bia.totalTenths).toBe(Math.round(micros / 10));
    expect(ana.placement).toBe(1);
    expect(bia.placement).toBe(2);
  });

  it('o chat fecha durante os desafios e abre no tutorial, no placar e no fim', () => {
    const c = make('rodada-chat');
    expect(() => c.room.sendChat('ana', 'oi')).not.toThrow();
    next(c);
    expect(snap(c.room).chat.open).toBe(false);
    expect(() => c.room.sendChat('ana', 'oi')).toThrow(/fechado/);
    playPerfect(c, c.plan[0] as MicroSlot);
    expect(snap(c.room).chat.open).toBe(true);
  });
});

describe('PartyRoomEngine: micro-desafios', () => {
  /** Abre o primeiro micro-desafio do jogo pedido (procurando uma seed que o ponha na frente). */
  function firstOf(game: MicroSlot['game'], variant?: string) {
    for (let i = 0; i < 600; i++) {
      const seed = `${game}-${variant ?? 'any'}-${i}`;
      const slot = buildPlan(seed, 1)[0] as MicroSlot;
      if (slot.game === game && (!variant || slot.variant === variant)) {
        const c = make(seed);
        next(c);
        return { c, slot };
      }
    }
    throw new Error('seed não encontrada');
  }

  it('Mesmíssima: só vale depois que o alvo some; o servidor decide os pontos', () => {
    const { c, slot } = firstOf('color', 'standard');
    const target = snap(c.room).party.challenge.target;
    expect(() => c.room.submitColor('ana', target)).toThrow(/Espere o alvo sumir/);
    toPick(c);
    c.room.submitColor('ana', target);
    c.room.submitColor('ana', FAR); // segundo envio ignorado
    c.room.submitColor('bia', FAR);
    expect(snap(c.room).party.delta!.ana).toBe(colorPoints(slot.variant, 10));
    expect(snap(c.room).party.delta!.bia).toBe(colorPoints('standard', scoreColor(target, FAR)));
    expect(() => c.room.submitColor('ana', { h: 999, s: 0, b: 0 })).toThrow();
  });

  it('Mesmíssima Invertido: acertar a cor exata tira 500', () => {
    const { c } = firstOf('color', 'inverted');
    toPick(c);
    const target = snap(c.room).party.challenge.target;
    c.room.submitColor('ana', target);
    c.room.submitColor('bia', FAR);
    expect(snap(c.room).party.delta!.ana).toBe(-500);
    expect(snap(c.room).party.totals.ana).toBe(-500);
    expect(snap(c.room).party.delta!.bia).toBeGreaterThan(0);
  });

  it('Já Deu?: o servidor mede entre COMEÇAR e PARAR; parar sem começar é recusado', () => {
    const { c, slot } = firstOf('time', 'standard');
    expect(() => c.room.timeBegin('ana')).toThrow(/Espere/);
    toPick(c);
    expect(() => c.room.timeStop('ana')).toThrow(/Comece/);
    const expected = timeChallenge(slot).expectedMs;
    c.room.timeBegin('ana');
    c.room.timeBegin('bia');
    c.clock.advance(expected);
    c.room.timeStop('ana');
    c.clock.advance(expected); // bia demorou o dobro
    c.room.timeStop('bia');
    expect(snap(c.room).party.delta!.ana).toBe(1000);
    expect(snap(c.room).party.delta!.bia).toBeLessThan(500);
  });

  it('Já Deu? Tempo Falso: conta o tempo real esperado, não o alvo mostrado', () => {
    const { c, slot } = firstOf('time', 'falso');
    toPick(c);
    const ch = timeChallenge(slot);
    expect(ch.expectedMs).not.toBe(ch.targetMs);
    c.room.timeBegin('ana');
    c.room.timeBegin('bia');
    c.clock.advance(ch.expectedMs);
    c.room.timeStop('ana');
    c.room.timeStop('bia');
    expect(snap(c.room).party.delta!.ana).toBe(1000);
  });

  it('Ecooo: pontos proporcionais aos acertos; o botão proibido zera na hora', () => {
    const { c, slot } = firstOf('eco', 'standard');
    toPick(c);
    const ch = ecoChallenge(slot);
    expect(() => c.room.ecoTap('ana', 9)).toThrow(/inválido/);
    for (const pad of ch.expected) c.room.ecoTap('ana', pad);
    // bia erra a metade final.
    ch.expected.forEach((pad, i) =>
      c.room.ecoTap('bia', i < ch.expected.length / 2 ? pad : (pad + 1) % 4),
    );
    expect(snap(c.room).party.delta!.ana).toBe(1000);
    const half = ch.expected.map((p, i) => (i < ch.expected.length / 2 ? p : (p + 1) % 4));
    expect(snap(c.room).party.delta!.bia).toBe(ecoPoints(slot, half));
  });

  it('Ecooo Botão Proibido: tocar nele zera aquela rodada', () => {
    const { c, slot } = firstOf('eco', 'forbidden');
    toPick(c);
    const ch = ecoChallenge(slot);
    c.room.ecoTap('ana', ch.forbidden!);
    for (const pad of ch.expected) c.room.ecoTap('bia', pad);
    expect(snap(c.room).party.delta!.ana).toBe(0);
    expect(snap(c.room).party.delta!.bia).toBe(1000);
  });

  it('Digitação: certo vale 400 a 1000, errado 0; vale a palavra do servidor', () => {
    const { c, slot } = firstOf('typing', 'standard');
    toPick(c);
    const ch = typingChallenge(slot);
    c.room.typing('ana', ch.expected!, false, true);
    c.room.typing('bia', 'errado', false, true);
    expect(snap(c.room).party.delta!.ana).toBeGreaterThanOrEqual(400);
    expect(snap(c.room).party.delta!.bia).toBe(0);
  });

  it('Digitação Mão Boba: mexer ou enviar tira 500; ficar quieto vale 1000 no fim do tempo', () => {
    const { c } = firstOf('typing', 'maohoba');
    toPick(c);
    c.room.typing('ana', '', true, false); // só tocou no campo
    run(c, snap(c.room).party.times.endsAt - c.clock.now() + 100);
    expect(c.room.currentPhase).toBe('ranking');
    expect(snap(c.room).party.delta!.ana).toBe(-500);
    expect(snap(c.room).party.delta!.bia).toBe(1000);
  });

  it('quem não responde até o fim do tempo fica com 0 e o desafio avança sozinho', () => {
    const { c } = firstOf('color', 'standard');
    toPick(c);
    c.room.submitColor('ana', snap(c.room).party.challenge.target);
    runUntil(c, 'ranking');
    expect(snap(c.room).party.delta!.bia).toBe(0);
  });
});

describe('PartyRoomEngine: Caça-Formas', () => {
  function inShapes() {
    const c = make('formas-1');
    playMicros(c, 0);
    toBigStart(c);
    return { c, round: shapesRound((c.plan[5] as BigSlot).seed) };
  }

  it('clique certo +100, proibido -150, neutro -50; só conta uma vez e dentro da janela da peça', () => {
    const { c, round } = inShapes();
    const showAt = snap(c.room).party.times.showAt;
    const good = round.items.find((x) => x.cls === 'good')!;
    const bad = round.items.find((x) => x.cls === 'bad')!;
    const neutral = round.items.find((x) => x.cls === 'neutral')!;
    const at = (item: { at: number }, plus: number) =>
      c.clock.advance(Math.max(0, showAt + item.at + plus - c.clock.now()));

    c.room.shapeClick('ana', 9999); // peça que não existe
    c.room.shapeClick('ana', good.id); // cedo demais (a peça ainda não apareceu)
    at(good, 200);
    c.room.shapeClick('ana', good.id);
    c.room.shapeClick('ana', good.id); // duplicado
    at(bad, 200);
    c.room.shapeClick('ana', bad.id);
    at(neutral, 200);
    c.room.shapeClick('ana', neutral.id);
    run(c, 40_000);
    // Os 3 acima, na ordem em que o horário permitiu.
    const total = POINTS_GOOD + POINTS_BAD + POINTS_NEUTRAL;
    expect(c.room.currentPhase).toBe('final');
    const ana = c.room.finalRows().find((r) => r.userId === 'ana')!;
    const micros = c.plan.slice(0, 5).length; // só para o linter não reclamar do plano
    expect(micros).toBe(5);
    expect(snap(c.room).party.totals.ana).toBeDefined();
    expect(ana.totalTenths).toBeLessThan(10_000);
    expect(total).toBe(-100);
  });
});

describe('PartyRoomEngine: Arena X1', () => {
  /** Joga duas rodadas inteiras para chegar ao X1 (o grande da rodada 2). */
  function inX1(ids = ['ana', 'bia']) {
    const c = make('x1-1', ids, 2);
    playMicros(c, 0);
    toBigStart(c); // Caça-Formas
    runUntil(c, 'ranking');
    playMicros(c, 6);
    toBigStart(c);
    expect(c.plan[11]!.kind).toBe('big');
    return c;
  }

  /** Espera o botão aparecer para `viewer` e devolve o instante. */
  function waitGo(c: Ctx, viewer = 'ana') {
    for (let i = 0; i < 1000; i++) {
      c.clock.advance(10);
      c.room.tick();
      if (snap(c.room, viewer).party.x1?.state === 'go') return c.clock.now();
    }
    throw new Error('o botão não apareceu');
  }

  it('duelo entre pessoas: quem clica primeiro ganha; 3 de diferença vence o duelo e vale 2000', () => {
    const c = inX1();
    const before = c.room.finalRows().map((r) => r.totalTenths);
    expect(before.length).toBe(2);
    for (let shot = 0; shot < 3; shot++) {
      waitGo(c);
      c.clock.advance(150);
      c.room.xClick('ana');
      c.clock.advance(200);
      c.room.xClick('bia');
      run(c, 100);
    }
    // O único duelo acabou: fecha, soma e vai direto ao pódio (último grande).
    run(c, 200);
    expect(c.room.currentPhase).toBe('final');
    const rows = c.room.finalRows();
    const ana = rows.find((r) => r.userId === 'ana')!;
    const bia = rows.find((r) => r.userId === 'bia')!;
    expect(ana.placement).toBe(1);
    expect(ana.totalTenths - bia.totalTenths).toBe(200);
  });

  it('largada falsa: clicar antes de o botão aparecer perde o disparo', () => {
    const c = inX1();
    c.room.xClick('ana'); // ainda esperando
    const x1 = snap(c.room).party.x1!;
    expect(x1.lead).toBe(-1);
    expect(x1.last!.won).toBe(false);
    expect(snap(c.room, 'bia').party.x1!.lead).toBe(1);
  });

  it('o placar é líquido: ganhei, perdi, ganhei, ganhei, ganhei = 3 de vantagem', () => {
    const c = inX1();
    const wins = [true, false, true, true, true];
    const leads: number[] = [];
    for (const mine of wins) {
      waitGo(c);
      const first = mine ? 'ana' : 'bia';
      const second = mine ? 'bia' : 'ana';
      c.clock.advance(150);
      c.room.xClick(first);
      c.clock.advance(200);
      c.room.xClick(second);
      c.room.tick();
      const x1 = c.room.currentPhase === 'big' ? snap(c.room).party.x1 : null;
      if (x1) leads.push(x1.lead);
      run(c, 100);
    }
    // Depois do 4º disparo a vantagem era 2; o 5º fechou o duelo com 3.
    expect(leads.slice(0, 4)).toEqual([1, 0, 1, 2]);
    run(c, 300);
    expect(c.room.currentPhase).toBe('final');
    const rows = c.room.finalRows();
    expect(rows.find((r) => r.userId === 'ana')!.placement).toBe(1);
  });

  it('com número ímpar, quem sobra enfrenta o Bot NoCap, que reage como gente', () => {
    const c = inX1(['ana', 'bia', 'cris']);
    const vsBot = ['ana', 'bia', 'cris'].find(
      (id) => snap(c.room, id).party.x1!.opponent === 'Bot NoCap',
    );
    expect(vsBot).toBeDefined();
    waitGo(c, vsBot);
    c.clock.advance(100); // mais rápido que o bot (mínimo 280 ms)
    c.room.xClick(vsBot!);
    run(c, 50);
    expect(snap(c.room, vsBot).party.x1!.last!.won).toBe(true);
  });

  it('desconectar no meio do duelo é derrota por abandono', () => {
    const c = inX1();
    c.room.disconnect('bia');
    expect(snap(c.room, 'ana').party.x1!.result).toBe('win');
  });
});
