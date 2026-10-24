import { CHOICE_LOCK_SEC, GRIMOIRES, drawGrimoires, newSave, pickInto, unlockedContent, type PendingChoice, type SaveState } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChoiceModal } from './ChoiceModal';
import { EvolutionFx } from './EvolutionFx';
import { GrimoiresPage } from './GrimoiresPage';
import { createGameController } from './game-controller';
import { createMemoryGameStore } from './game-store';
import { MODAL_OPEN_GUARD_MS, albumView, modalGuarded } from './game-logic';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const rarityOf = (d: ReturnType<typeof drawGrimoires>, id: string) => d.rarities[id] as string;

function withPicks(picks: number, seed = 's'): SaveState {
  const s = newSave(seed, 0);
  return { ...s, run: { ...s.run, picks } };
}

describe('sorteio por peso (n = escolhas já feitas)', () => {
  function rarities(picks: number, runs = 300) {
    const seen = new Set<string>();
    for (let i = 0; i < runs; i++) {
      const d = drawGrimoires(withPicks(picks, `seed${i}`));
      const { offers } = d;
      expect(offers).toHaveLength(3);
      expect(new Set(offers).size).toBe(3);
      for (const id of offers) seen.add(rarityOf(d, id));
    }
    return seen;
  }

  it('nas 2 primeiras escolhas só saem comuns', () => {
    for (const n of [0, 1]) expect([...rarities(n)]).toEqual(['common']);
  });
  it('raro entra em n >= 2, épico em 5, lendário em 9 (spec 041: mais cedo e com mais chance)', () => {
    expect(rarities(2).has('rare')).toBe(true);
    expect(rarities(2).has('epic')).toBe(false);
    expect(rarities(5).has('epic')).toBe(true);
    expect(rarities(5).has('legendary')).toBe(false);
    expect(rarities(9).has('legendary')).toBe(true);
    expect(rarities(9).has('forbidden')).toBe(false);
  });
  it('proibido nunca sai no sorteio: mora no Cofre', () => {
    expect(rarities(40, 600).has('forbidden')).toBe(false);
    const ids = new Set<string>();
    for (let i = 0; i < 600; i++) drawGrimoires(withPicks(40, `x${i}`)).offers.forEach((id) => ids.add(id));
    expect(ids.has('cygnus-x1')).toBe(false);
    expect(ids.has('m87')).toBe(false);
    expect(GRIMOIRES).toHaveLength(22);
  });
});

describe('livro de grimórios (4 versões por astro)', () => {
  it('descobertos mostram nome, nível e as versões achadas; escondidos viram ???', () => {
    const s = newSave('a', 0);
    const state: SaveState = { ...s, album: ['moon:common', 'moon:rare'], run: { ...s.run, build: { moon: 3 } } };
    const view = albumView(state);
    expect(view.discovered).toBe(2);
    expect(view.total).toBe(unlockedContent(s).grimoires.length * 4);
    expect(view.entries[0]?.slots.map((x) => x.found)).toEqual([true, true, false, false]);
    expect(view.entries[0]).toMatchObject({ found: 2, rarity: 'raro' });
    expect(view.entries[0]).toMatchObject({ id: 'moon', name: 'Lua', discovered: true, level: 3 });
    const hidden = view.entries.find((e) => e.id === 'mercury')!;
    expect(hidden).toMatchObject({ name: '???', discovered: false, text: 'Ainda escondido no espaço' });
  });
  it('a página mostra a contagem e o cadeado', () => {
    const s = newSave('a', 0);
    const markup = html(<GrimoiresPage state={{ ...s, album: ['moon:common', 'moon:epic'], run: { ...s.run, build: { moon: 2 } } }} />);
    expect(markup).toContain('de 60 versões descobertas');
    // Os espaços não descobertos viram ??? e os achados mostram a raridade.
    expect(markup).toContain('???');
    expect(markup).toContain('Épico');
    // O descoberto mostra a categoria (Toque); os escondidos não entregam nada.
    expect(markup).toContain('data-cat="touch"');
    expect(markup).toContain('Toque');
    expect(markup).toContain('Nível 2');
    expect(markup).toContain('Grimório escondido');
    expect(markup).not.toContain('Atlas Eterno');
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
    expect(controller.getSnapshot().state.album).toEqual(['moon:common']);
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

describe('evolução de raridade (spec 042)', () => {
  const props = { lockRemaining: 0, paused: false, onSelect: () => {}, onConfirm: () => {} };

  it('a carta de raridade maior mostra "RARO -> LENDÁRIO" e some o selo quando não evolui', () => {
    const pending: PendingChoice = { offers: ['moon', 'mercury'], rarities: { moon: 'legendary', mercury: 'rare' }, openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };
    const markup = html(<ChoiceModal pending={pending} build={{ moon: 2, mercury: 1 }} buildRarity={{ moon: 1, mercury: 1 }} {...props} />);
    // Lua: Raro -> Lendário evolui. Mercúrio: Raro no livro e Raro na oferta só sobe de nível.
    expect(markup.match(/class="ap-pick-evo"/g)).toHaveLength(1);
    expect(markup).toContain('Evolui de Raro para Lendário');
    expect(markup).toContain('Vai evoluir');
  });

  it('grimório novo ou raridade igual não é evolução', () => {
    const pending: PendingChoice = { offers: ['moon'], rarities: { moon: 'rare' }, openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };
    expect(html(<ChoiceModal pending={pending} build={{}} {...props} />)).not.toContain('ap-pick-evo');
    expect(html(<ChoiceModal pending={pending} build={{ moon: 1 }} buildRarity={{ moon: 1 }} {...props} />)).not.toContain('ap-pick-evo');
  });

  it('escolher a carta que evolui avisa o controlador com a raridade de antes e a de depois', () => {
    const s = newSave('evo', 0);
    const book = pickInto(s.run, 'moon', 'rare', 1);
    const pending: PendingChoice = { offers: ['moon'], rarities: { moon: 'legendary' }, openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };
    const initial: SaveState = { ...s, album: ['moon:rare'], run: { ...s.run, ...book, energy: 60, picks: 1, pending } };
    let t = 0;
    const events: unknown[] = [];
    const controller = createGameController({ initial, store: createMemoryGameStore(), slot: 1, perf: () => t });
    controller.onEvent((e) => events.push(e));
    t = 2000;
    controller.select('moon');
    expect(controller.choose('moon')).toBe(true);
    expect(events.find((e) => (e as { type: string }).type === 'grimoire')).toMatchObject({ id: 'moon', rarity: 'legendary', evolvedFrom: 'rare' });
    const after = controller.getSnapshot().state;
    expect(after.album).toContain('moon:legendary');
    expect(after.run.buildRarity.moon).toBe(3);
  });

  it('a animação mostra o selo com as duas raridades e o nível', () => {
    const markup = html(<EvolutionFx name="Lua" astro="moon" from="raro" to="lendario" level={4} onDone={() => {}} />);
    expect(markup).toContain('ap-evo-seal');
    expect(markup).toContain('Raro');
    expect(markup).toContain('Lendário');
    expect(markup).toContain('NVL');
  });
});
