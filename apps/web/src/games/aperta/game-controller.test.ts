import { CHOICE_LOCK_SEC, newSave, type SaveState } from '@nocap/games';
import { describe, expect, it } from 'vitest';
import {
  SAVE_FAILURES_BEFORE_WARNING,
  createGameController,
  loadOrCreate,
  type GameEvent,
} from './game-controller';
import { createMemoryGameStore } from './game-store';

function setup(initial: SaveState = { ...newSave('teste', 0), tutorial: 'done' as const }) {
  const clock = { ms: 1000 };
  const store = createMemoryGameStore();
  const ctl = createGameController({ initial, store, slot: 1, perf: () => clock.ms });
  const events: GameEvent[] = [];
  ctl.onEvent((e) => events.push(e));
  /** Avança o relógio do aparelho e toca. */
  const tap = (everyMs = 200) => {
    clock.ms += everyMs;
    return ctl.press();
  };
  return { clock, store, ctl, events, tap };
}

/** Toca até a escolha de grimório abrir. */
function fill(t: ReturnType<typeof setup>) {
  let guard = 0;
  while (!t.ctl.getSnapshot().state.run.pending && guard++ < 1000) t.tap();
}

describe('toque', () => {
  it('sobe poeira e energia como o motor manda', () => {
    const t = setup();
    expect(t.tap()).toBe(true);
    const { run, stats } = t.ctl.getSnapshot().state;
    expect(run.dust).toBe(1);
    expect(run.energy).toBeCloseTo(0.25);
    expect(stats.clicks).toBe(1);
    expect(t.events[0]).toMatchObject({ type: 'press', gain: 1, combo: 0 });
  });

  it('sem multiplicador de combo no começo', () => {
    const t = setup();
    for (let i = 0; i < 10; i++) t.tap(150);
    expect(t.ctl.getSnapshot().state.run.dust).toBe(10);
  });

  it('o teto de toques por segundo vale (toque rápido demais é ignorado)', () => {
    const t = setup();
    t.tap(200);
    expect(t.tap(10)).toBe(false);
    expect(t.events.filter((e) => e.type === 'press')).toHaveLength(1);
  });
});

describe('energia cheia', () => {
  it('abre a escolha de 3 grimórios e avisa a tela', () => {
    const t = setup();
    fill(t);
    const pending = t.ctl.getSnapshot().state.run.pending;
    expect(pending?.offers).toHaveLength(3);
    expect(t.events.some((e) => e.type === 'choice-open')).toBe(true);
  });

  it('toques durante a escolha não contam', () => {
    const t = setup();
    fill(t);
    const dust = t.ctl.getSnapshot().state.run.dust;
    expect(t.tap()).toBe(false);
    expect(t.ctl.getSnapshot().state.run.dust).toBe(dust);
  });

  it('escolha em dois passos com bloqueio de 1,6 s', () => {
    const t = setup();
    fill(t);
    const id = t.ctl.getSnapshot().state.run.pending!.offers[0]!;
    // Bloqueada: nem marca.
    t.ctl.select(id);
    expect(t.ctl.getSnapshot().state.run.pending!.selected).toBeNull();
    t.clock.ms += (CHOICE_LOCK_SEC + 0.1) * 1000;
    // Confirmar sem marcar não escolhe.
    expect(t.ctl.choose(id)).toBe(false);
    t.ctl.select(id);
    expect(t.ctl.getSnapshot().state.run.pending!.selected).toBe(id);
    expect(t.ctl.choose(id)).toBe(true);
    const { state } = t.ctl.getSnapshot();
    expect(state.run.pending).toBeNull();
    expect(state.run.energy).toBe(0);
    expect(state.run.build[id]).toBe(1);
    expect(state.album).toContain(id);
    expect(t.events.at(-1)).toMatchObject({ type: 'grimoire', id });
  });

  it('escolher grava na hora', async () => {
    const t = setup();
    fill(t);
    const id = t.ctl.getSnapshot().state.run.pending!.offers[0]!;
    t.clock.ms += 2000;
    t.ctl.select(id);
    t.ctl.choose(id);
    await Promise.resolve();
    expect(t.store.saved[1]?.album).toContain(id);
  });
});

describe('relógio', () => {
  it('conta o tempo jogado enquanto visível', () => {
    const t = setup();
    t.clock.ms += 3000;
    t.ctl.tick();
    expect(t.ctl.getSnapshot().state.playSeconds).toBeCloseTo(3, 1);
  });

  it('pausa com a aba escondida: o tempo escondido não conta para o jogo', () => {
    const t = setup();
    t.tap(500);
    t.ctl.pause();
    const before = t.ctl.now();
    t.clock.ms += 600_000;
    t.ctl.tick();
    expect(t.ctl.now()).toBe(before);
    expect(t.ctl.getSnapshot().paused).toBe(true);
    // Parado, o toque não vale.
    expect(t.ctl.press()).toBe(false);

    t.ctl.resume();
    expect(t.ctl.getSnapshot().paused).toBe(false);
    expect(t.ctl.now()).toBeCloseTo(before, 3);
    t.clock.ms += 1000;
    t.ctl.tick();
    expect(t.ctl.getSnapshot().state.playSeconds).toBeCloseTo(before + 1, 1);
  });

  it('continua do relógio guardado no save', () => {
    const saved = { ...newSave('teste', 0), clock: 5000, playSeconds: 5000 };
    const t = setup(saved);
    expect(t.ctl.now()).toBeCloseTo(5000, 3);
    expect(t.tap()).toBe(true);
  });

  it('esconder a aba salva', async () => {
    const t = setup();
    t.tap();
    t.ctl.pause();
    await Promise.resolve();
    expect(t.store.saved[1]?.stats.clicks).toBe(1);
  });
});

describe('salvamento', () => {
  it('sem mudança não regrava', async () => {
    const t = setup();
    await t.ctl.save();
    expect(t.store.saves).toBe(0);
    t.tap();
    await t.ctl.save();
    await t.ctl.save();
    expect(t.store.saves).toBe(1);
  });

  it(`${SAVE_FAILURES_BEFORE_WARNING} falhas seguidas ligam o aviso e salvar de novo limpa`, async () => {
    const t = setup();
    t.tap();
    for (let i = 0; i < SAVE_FAILURES_BEFORE_WARNING; i++) {
      t.store.failNext = true;
      await t.ctl.save();
    }
    expect(t.ctl.getSnapshot().saveFailures).toBe(SAVE_FAILURES_BEFORE_WARNING);
    await t.ctl.save();
    expect(t.ctl.getSnapshot().saveFailures).toBe(0);
    expect(t.store.saved[1]?.stats.clicks).toBe(1);
  });
});

describe('objetos no espaço', () => {
  /** Passa o tempo do aparelho em passos de 1 s, como o relógio da tela. */
  function advance(t: ReturnType<typeof setup>, seconds: number) {
    for (let i = 0; i < seconds; i++) {
      t.clock.ms += 1000;
      t.ctl.tick();
    }
  }

  it('um objeto nasce depois de uns 9 s e a tela é avisada na hora', () => {
    const t = setup();
    let notified = 0;
    t.ctl.subscribe(() => (notified += 1));
    advance(t, 8);
    expect(t.ctl.getSnapshot().state.run.objects).toHaveLength(0);
    advance(t, 12);
    expect(t.ctl.getSnapshot().state.run.objects.length).toBeGreaterThan(0);
    expect(notified).toBeGreaterThan(0);
  });

  it('capturar entrega a recompensa que a etiqueta mostrou e emite o aviso', () => {
    const t = setup();
    advance(t, 12);
    const { run } = t.ctl.getSnapshot().state;
    const obj = run.objects[0]!;
    expect(t.ctl.capture(obj.id)).toBe(true);
    const ev = t.events.find((e) => e.type === 'capture');
    expect(ev).toMatchObject({ type: 'capture', objectId: obj.id, kind: obj.kind });
    const after = t.ctl.getSnapshot().state;
    expect(after.run.objects.find((o) => o.id === obj.id)).toBeUndefined();
    expect(after.stats.objectsCaptured).toBe(1);
    if (ev?.type === 'capture') expect(after.run.dust - run.dust).toBe(ev.preview.dust);
  });

  it('capturar duas vezes, ou um id que não existe, não entrega nada', () => {
    const t = setup();
    advance(t, 12);
    const id = t.ctl.getSnapshot().state.run.objects[0]!.id;
    expect(t.ctl.capture(id)).toBe(true);
    expect(t.ctl.capture(id)).toBe(false);
    expect(t.ctl.capture(999)).toBe(false);
    expect(t.events.filter((e) => e.type === 'capture')).toHaveLength(1);
  });

  it('com o jogo pausado nada nasce e nada é capturado', () => {
    const t = setup();
    advance(t, 12);
    const id = t.ctl.getSnapshot().state.run.objects[0]!.id;
    t.ctl.pause();
    expect(t.ctl.capture(id)).toBe(false);
    expect(t.ctl.getSnapshot().state.run.objects.some((o) => o.id === id)).toBe(true);
  });

  it('o satélite liga o Sinal forte no estado', () => {
    const base = newSave('teste', 0);
    const t = setup({
      ...base,
      run: { ...base.run, objects: [{ id: 1, kind: 'satellite', bornAt: 0, expiresAt: 100 }], nextObjectId: 2, nextSpawnAt: 1e6 },
    });
    expect(t.ctl.capture(1)).toBe(true);
    const { run } = t.ctl.getSnapshot().state;
    expect(run.boostMult).toBe(2);
    expect(run.boostUntil).toBeGreaterThan(t.ctl.now());
  });
});

describe('carregar', () => {
  it('abre o save guardado ou começa um novo jogo', async () => {
    const store = createMemoryGameStore();
    const fresh = await loadOrCreate(store, 1, 'semente', 'Missão Perigeu', 123);
    expect(fresh).toMatchObject({ name: 'Missão Perigeu', createdAt: 123, collapses: 0 });
    store.saved[1] = { ...fresh, collapses: 2 };
    expect((await loadOrCreate(store, 1, 'outra', 'x')).collapses).toBe(2);
  });
});

describe('tutorial pelo controlador', () => {
  const fresh = () => setup(newSave('teste', 0));
  const state = (t: ReturnType<typeof setup>) => t.ctl.getSnapshot().state;

  it('o 1º toque entrega a Lua, vai ao passo 2 e não abre escolha', () => {
    const t = fresh();
    expect(t.tap()).toBe(true);
    expect(state(t).tutorial).toBe(2);
    expect(state(t).run.build.moon).toBe(1);
    expect(state(t).run.pending).toBeNull();
    expect(t.events.map((e) => e.type)).toEqual(['press']);
  });

  it('depois do 1º toque o motor recusa toque e compra até o passo certo', () => {
    const t = fresh();
    t.tap();
    expect(t.tap()).toBe(false);
    expect(state(t).stats.clicks).toBe(1);
    expect(t.ctl.buy(0)).toBe(false);
  });

  it('Entendi leva ao passo 3 e entrega a poeira da 1ª compra; passo repetido não faz nada', () => {
    const t = fresh();
    t.tap();
    t.ctl.tutorialStep(2, 3);
    expect(state(t).tutorial).toBe(3);
    expect(state(t).run.dust).toBeGreaterThanOrEqual(1500);
    const dust = state(t).run.dust;
    t.ctl.tutorialStep(2, 3);
    expect(state(t).tutorial).toBe(3);
    expect(state(t).run.dust).toBe(dust);
  });

  it('no passo 4 só o Pulso Solar compra, e a compra leva ao passo 5', () => {
    const t = fresh();
    t.tap();
    t.ctl.tutorialStep(2, 3);
    expect(t.ctl.buy(0)).toBe(false); // passo 3: ainda não
    t.ctl.tutorialStep(3, 4);
    t.clock.ms += 1000;
    expect(t.ctl.buy(1)).toBe(false);
    expect(t.ctl.buy(0)).toBe(true);
    expect(state(t).tutorial).toBe(5);
    expect(state(t).run.upgradeLevels[0]).toBe(1);
    t.clock.ms += 1000;
    expect(t.ctl.buy(0)).toBe(false);
  });

  it('cada passo guarda o save na hora (cópia local e subida)', async () => {
    const t = fresh();
    const staged: unknown[] = [];
    const store = { ...t.store, stage: (_slot: 1 | 2, s: SaveState) => staged.push(s.tutorial) };
    const ctl = createGameController({ initial: newSave('teste', 0), store, slot: 1, perf: () => t.clock.ms });
    t.clock.ms += 200;
    ctl.press();
    ctl.tutorialStep(2, 3);
    ctl.tutorialStep(3, 4);
    expect(staged).toEqual([2, 3, 4]);
    await ctl.save(true);
    expect(t.store.saved[1]?.tutorial).toBe(4);
  });

  it('subida em andamento não perde o passo seguinte: sobe de novo logo depois', async () => {
    const initial = newSave('teste', 0);
    const writes: unknown[] = [];
    let release: () => void = () => {};
    const store = {
      load: async () => null,
      save: async (_slot: 1 | 2, s: SaveState) => {
        writes.push(s.tutorial);
        if (writes.length === 1) await new Promise<void>((r) => (release = r));
      },
    };
    const ctl = createGameController({ initial, store, slot: 1, perf: () => 1000 + writes.length * 0 + 300 });
    ctl.press(); // passo 2, sobe (fica pendurada)
    ctl.tutorialStep(2, 3); // chega durante a subida
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(writes).toEqual([2, 3]);
  });

  it('pular libera tudo e fica salvo', () => {
    const t = fresh();
    t.ctl.tutorialSkip();
    expect(state(t).tutorial).toBe('done');
    expect(t.tap()).toBe(true);
    expect(state(t).tutorial).toBe('done');
    expect(state(t).run.build.moon).toBeUndefined();
  });

  it('save de antes do tutorial (passo 1 com toques) abre sem tutorial; um novo continua no passo 1', async () => {
    const old = { ...newSave('x', 0), stats: { ...newSave('x', 0).stats, clicks: 40 } };
    const store = createMemoryGameStore({ 1: old });
    expect((await loadOrCreate(store, 1, 's', 'n', 0)).tutorial).toBe('done');
    expect((await loadOrCreate(createMemoryGameStore(), 1, 's', 'n', 0)).tutorial).toBe(1);
    const mid = { ...newSave('x', 0), tutorial: 3 as const, stats: { ...newSave('x', 0).stats, clicks: 1 } };
    expect((await loadOrCreate(createMemoryGameStore({ 1: mid }), 1, 's', 'n', 0)).tutorial).toBe(3);
  });
});
