import { CHOICE_LOCK_SEC, GRIMOIRES, drawGrimoires, newSave, unlockedContent, type PendingChoice, type SaveState } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChoiceModal } from './ChoiceModal';
import { GrimoiresPage } from './GrimoiresPage';
import { createGameController } from './game-controller';
import { createMemoryGameStore } from './game-store';
import { MODAL_OPEN_GUARD_MS, albumView, modalGuarded } from './game-logic';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const rarityOf = (id: string) => GRIMOIRES.find((g) => g.id === id)!.rarity;

function withPicks(picks: number, seed = 's'): SaveState {
  const s = newSave(seed, 0);
  return { ...s, run: { ...s.run, picks } };
}

describe('sorteio por peso (n = escolhas já feitas)', () => {
  function rarities(picks: number, runs = 300) {
    const seen = new Set<string>();
    for (let i = 0; i < runs; i++) {
      const { offers } = drawGrimoires(withPicks(picks, `seed${i}`));
      expect(offers).toHaveLength(3);
      expect(new Set(offers).size).toBe(3);
      for (const id of offers) seen.add(rarityOf(id));
    }
    return seen;
  }

  it('nas 3 primeiras escolhas só saem comuns', () => {
    for (const n of [0, 1, 2]) expect([...rarities(n)]).toEqual(['common']);
  });
  it('raro entra em n >= 3, épico em 8, lendário em 14', () => {
    expect(rarities(3).has('rare')).toBe(true);
    expect(rarities(3).has('epic')).toBe(false);
    expect(rarities(8).has('epic')).toBe(true);
    expect(rarities(8).has('legendary')).toBe(false);
    expect(rarities(14).has('legendary')).toBe(true);
    expect(rarities(14).has('forbidden')).toBe(false);
  });
  it('proibido só em n >= 22 e nunca os de colapso futuro', () => {
    expect(rarities(22, 600).has('forbidden')).toBe(true);
    const ids = new Set<string>();
    for (let i = 0; i < 600; i++) drawGrimoires(withPicks(40, `x${i}`)).offers.forEach((id) => ids.add(id));
    expect(ids.has('cygnus-x1')).toBe(false);
    expect(ids.has('m87')).toBe(false);
  });
});

describe('álbum', () => {
  it('descobertos mostram nome e nível; escondidos viram ???', () => {
    const s = newSave('a', 0);
    const state: SaveState = { ...s, album: ['moon'], run: { ...s.run, build: { moon: 3 } } };
    const view = albumView(state);
    expect(view.discovered).toBe(1);
    expect(view.total).toBe(unlockedContent(s).grimoires.length);
    expect(view.entries[0]).toMatchObject({ id: 'moon', name: 'Lua', discovered: true, level: 3 });
    const hidden = view.entries.find((e) => e.id === 'sagittarius-a')!;
    expect(hidden).toMatchObject({ name: '???', discovered: false, text: 'Ainda escondido no espaço' });
  });
  it('a página mostra a contagem, o cadeado e o Atlas', () => {
    const s = newSave('a', 0);
    const markup = html(<GrimoiresPage state={{ ...s, album: ['moon'], run: { ...s.run, build: { moon: 2 } } }} />);
    expect(markup).toContain('de 28 descobertos');
    expect(markup).toContain('Nível 2');
    expect(markup).toContain('Grimório escondido');
    expect(markup).toContain('Atlas Eterno');
    expect(markup).not.toContain('Sagitário');
  });
});

describe('proteção contra clique acidental', () => {
  it('ignora toques nos primeiros 300 ms de um modal', () => {
    expect(modalGuarded(1000, 1000 + MODAL_OPEN_GUARD_MS - 1)).toBe(true);
    expect(modalGuarded(1000, 1000 + MODAL_OPEN_GUARD_MS)).toBe(false);
  });

  const offers = ['moon', 'mercury', 'venus'];
  function open() {
    const s = newSave('g', 0);
    const pending: PendingChoice = { offers, openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };
    const initial: SaveState = { ...s, run: { ...s.run, energy: 60, pending } };
    let t = 0;
    const controller = createGameController({ initial, store: createMemoryGameStore(), slot: 1, perf: () => t });
    return { controller, at: (sec: number) => (t = sec * 1000) };
  }

  it('cartas bloqueadas não marcam durante 1,6 s', () => {
    const { controller, at } = open();
    at(CHOICE_LOCK_SEC - 0.1);
    controller.select('moon');
    expect(controller.getSnapshot().state.run.pending?.selected).toBeNull();
    at(CHOICE_LOCK_SEC + 0.1);
    controller.select('moon');
    expect(controller.getSnapshot().state.run.pending?.selected).toBe('moon');
  });

  it('confirmar sem marcar antes, ou outra carta, não escolhe', () => {
    const { controller, at } = open();
    at(2);
    expect(controller.choose('moon')).toBe(false);
    controller.select('moon');
    expect(controller.choose('venus')).toBe(false);
    expect(controller.getSnapshot().state.run.pending).not.toBeNull();
    expect(controller.choose('moon')).toBe(true);
    expect(controller.getSnapshot().state.run.pending).toBeNull();
    expect(controller.getSnapshot().state.album).toEqual(['moon']);
  });

  it('o modal mostra trocar carta só quando há trocas e o contador de 2 escolhas', () => {
    const pending: PendingChoice = { offers, openedAt: 0, selected: null, picksLeft: 2, rerollsLeft: 1 };
    const props = { lockRemaining: 0, build: {}, paused: false, onSelect: () => {}, onConfirm: () => {} };
    const withReroll = html(<ChoiceModal pending={pending} onReroll={() => {}} {...props} />);
    expect(withReroll.match(/Trocar esta carta/g)).toHaveLength(3);
    expect(withReroll).toContain('faltam 2');
    expect(html(<ChoiceModal pending={{ ...pending, rerollsLeft: 0 }} onReroll={() => {}} {...props} />)).not.toContain('Trocar');
  });
});
