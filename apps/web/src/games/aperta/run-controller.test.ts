import { newSave } from '@nocap/games';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameController } from './game-controller';
import { createMemoryGameStore } from './game-store';
import { runController } from './useApertaGame';

/** Só o que `runController` toca no navegador: visibilidade, listeners e timers. */
function fakeBrowser() {
  const doc = new EventTarget() as EventTarget & { visibilityState: string };
  doc.visibilityState = 'visible';
  const win = new EventTarget() as EventTarget & {
    setInterval: typeof setInterval;
    clearInterval: typeof clearInterval;
  };
  win.setInterval = setInterval;
  win.clearInterval = clearInterval;
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', win);
  return {
    hide() {
      doc.visibilityState = 'hidden';
      doc.dispatchEvent(new Event('visibilitychange'));
    },
    show() {
      doc.visibilityState = 'visible';
      doc.dispatchEvent(new Event('visibilitychange'));
    },
    pagehide: () => win.dispatchEvent(new Event('pagehide')),
  };
}

describe('runController: aba escondida', () => {
  let clock: { ms: number };
  beforeEach(() => {
    vi.useFakeTimers();
    clock = { ms: 0 };
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function setup() {
    const browser = fakeBrowser();
    const store = createMemoryGameStore();
    const ctl = createGameController({
      initial: newSave('teste', 0),
      store,
      slot: 1,
      perf: () => clock.ms,
    });
    const stop = runController(ctl);
    return { browser, store, ctl, stop };
  }

  it('esconder pausa o relógio e salva; mostrar retoma sem contar o tempo escondido', async () => {
    const t = setup();
    clock.ms += 200;
    t.ctl.press();
    t.browser.hide();
    expect(t.ctl.getSnapshot().paused).toBe(true);
    await Promise.resolve();
    expect(t.store.saved[1]?.stats.clicks).toBe(1);

    const frozen = t.ctl.now();
    clock.ms += 10 * 60_000;
    vi.advanceTimersByTime(5000);
    expect(t.ctl.now()).toBe(frozen);

    t.browser.show();
    expect(t.ctl.getSnapshot().paused).toBe(false);
    expect(t.ctl.now()).toBeCloseTo(frozen, 3);
    t.stop();
  });

  it('começar com a aba já escondida nasce pausado', () => {
    const browser = fakeBrowser();
    (document as unknown as { visibilityState: string }).visibilityState = 'hidden';
    const ctl = createGameController({
      initial: newSave('teste', 0),
      store: createMemoryGameStore(),
      slot: 1,
      perf: () => clock.ms,
    });
    const stop = runController(ctl);
    expect(ctl.getSnapshot().paused).toBe(true);
    browser.show();
    expect(ctl.getSnapshot().paused).toBe(false);
    stop();
  });

  it('pagehide salva e desmontar remove os listeners', async () => {
    const t = setup();
    clock.ms += 200;
    t.ctl.press();
    t.browser.pagehide();
    await Promise.resolve();
    expect(t.store.saves).toBe(1);
    t.stop();
    t.browser.hide();
    expect(t.ctl.getSnapshot().paused).toBe(false);
  });
});
