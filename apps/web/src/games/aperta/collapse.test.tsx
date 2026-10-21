import { atlasSlots, dustGoal, minPicks, newSave, type SaveState } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AtlasSection } from './AtlasSection';
import { CollapseModal } from './CollapseModal';
import { GameScreen } from './GameScreen';
import { createGameController, type GameEvent } from './game-controller';
import { createMemoryGameStore } from './game-store';
import { atlasView, collapseCandidates, collapseView, needsReplacement } from './game-logic';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const noop = () => {};

function ready(over: Partial<SaveState> = {}, build: Record<string, number> = { moon: 2, mars: 1 }): SaveState {
  const base = { ...newSave('c', 0), tutorial: 'done' as const, ...over };
  const k = base.collapses + 1;
  return { ...base, run: { ...base.run, build, picks: minPicks(k), dustLife: dustGoal(k), dust: dustGoal(k) } };
}

describe('visão do colapso', () => {
  it('antes da hora diz o que falta, sem liberar o botão', () => {
    const s = { ...newSave('c', 0), tutorial: 'done' as const };
    const v = collapseView(s);
    expect(v.ready).toBe(false);
    expect(v.hint).toMatch(/^Falta .* de poeira e \d+ escolhas para a estrela colapsar$/);
  });

  it('pronta quando poeira e escolhas batem; os Fragmentos já aparecem', () => {
    const v = collapseView(ready());
    expect(v.ready).toBe(true);
    expect(v.fragments).toBe(4);
    expect(v.dustFill).toBe(1);
  });

  it('com a escolha de grimório aberta, espera ela', () => {
    const s = ready();
    const open = { ...s, run: { ...s.run, pending: { offers: ['moon', 'vesta', 'mars'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 } } };
    expect(collapseView(open)).toMatchObject({ ready: false, waitingChoice: true });
  });

  it('lista os grimórios da vida do maior nível para o menor', () => {
    expect(collapseCandidates(ready()).map((c) => [c.id, c.level])).toEqual([['moon', 2], ['mars', 1]]);
  });

  it('só pede a página que sai com o Atlas cheio e a escolha nova', () => {
    const full = ready({
      collapses: 2,
      atlas: { slots: 3, pages: [{ grimoireId: 'venus', level: 1 }, { grimoireId: 'mars', level: 1 }, { grimoireId: 'vega', level: 1 }] },
    });
    expect(needsReplacement(full, null)).toBe(false);
    expect(needsReplacement(full, 'moon')).toBe(true);
    expect(needsReplacement(full, 'mars')).toBe(false);
    expect(needsReplacement(ready(), 'moon')).toBe(false);
  });
});

describe('Atlas na tela', () => {
  it('mostra espaços, família e bônus de conjunto ativos e a conquistar', () => {
    const s = ready({
      collapses: 3,
      atlas: { slots: 3, pages: [{ grimoireId: 'moon', level: 2 }, { grimoireId: 'europa', level: 1 }, { grimoireId: 'mars', level: 1 }] },
    });
    const view = atlasView(s);
    const moons = view.bonuses.find((b) => b.family === 'moons')!;
    expect(moons).toMatchObject({ count: 2, tier: 0, active: '+5% de energia por toque', missing: 1 });
    expect(view.bonuses.find((b) => b.family === 'planets')).toMatchObject({ count: 1, tier: -1, active: null, missing: 1 });
    expect(view.nextSlotAt).toBe(5);
    const markup = html(<AtlasSection state={s} onCollapse={noop} />);
    expect(markup).toContain('3 de 3 espaços');
    expect(markup).toContain('+5% de energia por toque');
    expect(markup).toContain('Um espaço novo chega no colapso 5');
  });

  it('o próximo espaço acompanha 5, 10, 25 e 50', () => {
    const at = (collapses: number) => atlasView({ ...newSave('c', 0), collapses, atlas: { slots: atlasSlots(collapses), pages: [] } }).nextSlotAt;
    expect([at(0), at(5), at(10), at(25), at(50)]).toEqual([5, 10, 25, 50, null]);
  });

  it('o botão de colapsar só liga com a estrela pronta', () => {
    expect(html(<AtlasSection state={ready()} onCollapse={noop} />)).toMatch(/<button[^>]*class="ap-hbtn ap-hbtn-go"[^>]*>Colapsar a estrela/);
    const idle = html(<AtlasSection state={{ ...newSave('c', 0), tutorial: 'done' }} onCollapse={noop} />);
    expect(idle).toMatch(/disabled=""[^>]*>Estrela ainda não está pronta/);
    expect(idle).toContain('para a estrela colapsar');
  });
});

describe('modal de colapso', () => {
  it('começa no passo 1 com a lista dos grimórios e "Continuar" desligado', () => {
    const markup = html(<CollapseModal state={ready()} onCancel={noop} onConfirm={noop} />);
    expect(markup).toContain('Passo 1 de 2');
    expect(markup).toContain('Lua');
    expect(markup).toMatch(/disabled=""[^>]*>Continuar/);
  });
});

describe('tela de jogo com a estrela pronta', () => {
  const screen = (s: SaveState) => html(<GameScreen controller={createGameController({ initial: s, store: createMemoryGameStore(), slot: 1 })} onExit={noop} />);

  it('mostra o botão "Estrela pronta"', () => {
    expect(screen(ready())).toContain('Estrela pronta: colapsar');
    expect(screen({ ...newSave('c', 0), tutorial: 'done' })).not.toContain('Estrela pronta');
  });

  it('nunca durante o tutorial', () => {
    expect(screen({ ...ready(), tutorial: 3 })).not.toContain('Estrela pronta');
  });
});

describe('controlador: colapsar', () => {
  function setup(initial: SaveState) {
    const store = createMemoryGameStore();
    const ctl = createGameController({ initial, store, slot: 1, perf: () => 1000 });
    const events: GameEvent[] = [];
    ctl.onEvent((e) => events.push(e));
    return { ctl, store, events };
  }

  it('recomeça a vida, guarda a página e salva na hora', () => {
    const { ctl, store, events } = setup(ready());
    expect(ctl.collapse('moon')).toBe(true);
    const s = ctl.getSnapshot().state;
    expect(s.collapses).toBe(1);
    expect(s.atlas.pages).toEqual([{ grimoireId: 'moon', level: 2 }]);
    expect(s.run.build).toEqual({});
    expect(s.run.dustLife).toBe(0);
    expect(s.fragments.earned).toBe(4);
    expect(events).toEqual([{ type: 'collapse', pageId: 'moon', pageName: 'Lua', fragments: 4 }]);
    expect(store.saved[1]?.collapses).toBe(1);
  });

  it('recusa sem a estrela pronta, sem o grimório e com o Atlas cheio sem trocar', () => {
    const idle = setup({ ...newSave('c', 0), tutorial: 'done' });
    expect(idle.ctl.collapse('moon')).toBe(false);
    const r = setup(ready());
    expect(r.ctl.collapse('vega')).toBe(false);
    const fullState = ready({
      collapses: 2,
      atlas: { slots: 3, pages: [{ grimoireId: 'venus', level: 1 }, { grimoireId: 'mars', level: 1 }, { grimoireId: 'vega', level: 1 }] },
    });
    const full = setup(fullState);
    expect(full.ctl.collapse('moon')).toBe(false);
    expect(full.ctl.collapse('moon', 1)).toBe(true);
    expect(full.ctl.getSnapshot().state.atlas.pages.map((p) => p.grimoireId)).toEqual(['venus', 'moon', 'vega']);
  });

  it('não colapsa com o tutorial em andamento', () => {
    expect(setup({ ...ready(), tutorial: 4 }).ctl.collapse('moon')).toBe(false);
  });
});
