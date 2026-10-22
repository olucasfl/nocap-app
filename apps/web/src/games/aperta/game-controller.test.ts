import {
  CHOICE_LOCK_SEC,
  TUTORIAL,
  UI_BUTTONS,
  affordableUpgradeIndex,
  newSave,
  nextUpgradeCost,
  unlockedButtons,
  type SaveState,
} from '@nocap/games';
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
    expect(run.energy).toBeCloseTo(1);
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
  /** Uma vida com a 1ª melhoria comprada: antes dela nenhum objeto aparece (spec 038, 4.5). */
  const afterFirstUpgrade = (): SaveState => {
    const s = { ...newSave('teste', 0), tutorial: 'done' as const };
    return { ...s, run: { ...s.run, upgradeLevels: s.run.upgradeLevels.map((l, i) => (i === 0 ? 1 : l)) } };
  };

  /** Passa o tempo do aparelho em passos de 1 s, como o relógio da tela. */
  function advance(t: ReturnType<typeof setup>, seconds: number) {
    for (let i = 0; i < seconds; i++) {
      t.clock.ms += 1000;
      t.ctl.tick();
    }
  }

  it('nenhum objeto nasce antes da 1ª melhoria', () => {
    const t = setup();
    advance(t, 60);
    expect(t.ctl.getSnapshot().state.run.objects).toHaveLength(0);
  });

  it('um objeto nasce depois de uns 32 s e a tela é avisada na hora', () => {
    const t = setup(afterFirstUpgrade());
    let notified = 0;
    t.ctl.subscribe(() => (notified += 1));
    advance(t, 30);
    expect(t.ctl.getSnapshot().state.run.objects).toHaveLength(0);
    advance(t, 5);
    expect(t.ctl.getSnapshot().state.run.objects.length).toBeGreaterThan(0);
    expect(notified).toBeGreaterThan(0);
  });

  it('capturar entrega a recompensa que a etiqueta mostrou e emite o aviso', () => {
    const t = setup(afterFirstUpgrade());
    advance(t, 35);
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
    const t = setup(afterFirstUpgrade());
    advance(t, 35);
    const id = t.ctl.getSnapshot().state.run.objects[0]!.id;
    expect(t.ctl.capture(id)).toBe(true);
    expect(t.ctl.capture(id)).toBe(false);
    expect(t.ctl.capture(999)).toBe(false);
    expect(t.events.filter((e) => e.type === 'capture')).toHaveLength(1);
  });

  it('com o jogo pausado nada nasce e nada é capturado', () => {
    const t = setup(afterFirstUpgrade());
    advance(t, 35);
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
  /** Um save novo com a poeira a 1 toque do preço da 1ª melhoria (o preço vem do motor). */
  const nearFirstUpgrade = () => {
    const s = newSave('teste', 0);
    const cost = nextUpgradeCost(s, 0) as number;
    return setup({ ...s, run: { ...s.run, dust: cost - 1, dustLife: cost - 1 } });
  };

  it('começa só com o botão: o 1º toque rende poeira, não abre nada e não muda de passo', () => {
    const t = fresh();
    expect(t.tap()).toBe(true);
    expect(t.tap()).toBe(true);
    expect(state(t).tutorial).toBe(TUTORIAL.TOUCH);
    expect(state(t).run.dust).toBe(2);
    expect(state(t).run.pending).toBeNull();
    expect(state(t).ui.unlocked).toEqual([]);
    expect(t.events.map((e) => e.type)).toEqual(['press', 'press']);
  });

  it('poeira da 1ª melhoria: passo 2, Melhorias liberado e o passo salvo na hora', async () => {
    const t = nearFirstUpgrade();
    const staged: unknown[] = [];
    const store = { ...t.store, stage: (_slot: 1 | 2, s: SaveState) => staged.push(s.tutorial) };
    const ctl = createGameController({ initial: t.ctl.getSnapshot().state, store, slot: 1, perf: () => t.clock.ms });
    t.clock.ms += 200;
    ctl.press();
    expect(ctl.getSnapshot().state.tutorial).toBe(TUTORIAL.UPGRADE);
    expect(ctl.getSnapshot().state.ui.unlocked).toEqual(['upgrades']);
    expect(staged).toEqual([TUTORIAL.UPGRADE]);
    await ctl.save(true);
    expect(t.store.saved[1]?.tutorial).toBe(TUTORIAL.UPGRADE);
  });

  it('o roteiro inteiro: comprar, voltar, encher a barra, escolher, ver os grimórios', () => {
    const t = nearFirstUpgrade();
    t.tap();
    expect(state(t).tutorial).toBe(TUTORIAL.UPGRADE);
    t.clock.ms += 1000;
    expect(t.ctl.buy(affordableUpgradeIndex(state(t)) as number)).toBe(true);
    expect(state(t).tutorial).toBe(TUTORIAL.BACK);
    t.ctl.tutorialStep(TUTORIAL.BACK, TUTORIAL.FILL);
    t.ctl.tutorialStep(TUTORIAL.BACK, TUTORIAL.FILL); // repetido: nada
    expect(state(t).tutorial).toBe(TUTORIAL.FILL);
    fill(t);
    expect(state(t).tutorial).toBe(TUTORIAL.CHOOSE);
    expect(t.events.some((e) => e.type === 'choice-open')).toBe(true);
    expect(unlockedButtons(state(t)).has('grimoires')).toBe(true);
    const offer = state(t).run.pending?.offers[0] as string;
    t.clock.ms += (CHOICE_LOCK_SEC + 0.2) * 1000;
    t.ctl.select(offer);
    expect(t.ctl.choose(offer)).toBe(true);
    expect(state(t).tutorial).toBe(TUTORIAL.GRIMOIRES);
    t.ctl.tutorialStep(TUTORIAL.GRIMOIRES, TUTORIAL.FREE);
    expect(state(t).tutorial).toBe(TUTORIAL.FREE);
  });

  it('a conquista do 1º toque não aparece durante o roteiro; no jogo livre os avisos voltam', () => {
    const t = fresh();
    t.tap();
    expect(state(t).achievements).toContain('tap-1');
    expect(t.events.map((e) => e.type)).toEqual(['press']);
    const free = setup({ ...newSave('teste', 0), tutorial: TUTORIAL.FREE });
    free.tap();
    expect(free.events.map((e) => e.type)).toEqual(['press', 'achievement']);
  });

  it('cartões do jogo livre: cada um marcado uma vez; os três concluem o tutorial', () => {
    const t = setup({ ...newSave('teste', 0), tutorial: TUTORIAL.FREE });
    t.ctl.tutorialHint('objects');
    t.ctl.tutorialHint('objects');
    expect(state(t).ui.hints).toEqual(['objects']);
    t.ctl.tutorialHint('achievements');
    t.ctl.tutorialHint('tree');
    expect(state(t).tutorial).toBe('done');
  });

  it('subida em andamento não perde o passo seguinte: sobe de novo logo depois', async () => {
    const initial = nearFirstUpgrade().ctl.getSnapshot().state;
    const writes: unknown[] = [];
    let release: () => void = () => {};
    const store = {
      load: async () => null,
      save: async (_slot: 1 | 2, s: SaveState) => {
        writes.push(s.tutorial);
        if (writes.length === 1) await new Promise<void>((r) => (release = r));
      },
    };
    const ctl = createGameController({ initial, store, slot: 1, perf: () => 1300 });
    ctl.press(); // passo 2, sobe (fica pendurada)
    ctl.tutorialStep(TUTORIAL.UPGRADE, TUTORIAL.FILL); // chega durante a subida
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(writes).toEqual([TUTORIAL.UPGRADE, TUTORIAL.FILL]);
  });

  it('pular libera tudo de uma vez e fica salvo', () => {
    const t = fresh();
    expect([...unlockedButtons(state(t))]).toEqual([]);
    t.ctl.tutorialSkip();
    expect(state(t).tutorial).toBe('done');
    expect(unlockedButtons(state(t)).size).toBe(UI_BUTTONS.length);
    expect(t.tap()).toBe(true);
    expect(state(t).tutorial).toBe('done');
  });

  it('saves antigos com progresso entram com tudo liberado; um novo começa no passo 1', async () => {
    const strip = (s: SaveState) => {
      const rest: Partial<SaveState> = { ...s };
      delete rest.ui;
      return rest as SaveState;
    };
    const played = { ...newSave('x', 0), stats: { ...newSave('x', 0).stats, clicks: 40 } };
    for (const tutorial of [1, 3, 5, 'done'] as const) {
      const loaded = await loadOrCreate(createMemoryGameStore({ 1: strip({ ...played, tutorial }) }), 1, 's', 'n', 0);
      expect(loaded.tutorial, String(tutorial)).toBe('done');
      expect(unlockedButtons(loaded).size).toBe(UI_BUTTONS.length);
    }
    expect((await loadOrCreate(createMemoryGameStore(), 1, 's', 'n', 0)).tutorial).toBe(1);
    // Save já no formato novo, no meio do roteiro, continua de onde parou.
    const mid = { ...newSave('x', 0), tutorial: TUTORIAL.BACK, stats: { ...newSave('x', 0).stats, clicks: 60 } };
    expect((await loadOrCreate(createMemoryGameStore({ 1: mid }), 1, 's', 'n', 0)).tutorial).toBe(TUTORIAL.BACK);
  });
});
