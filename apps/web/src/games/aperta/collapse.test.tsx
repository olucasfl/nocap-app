import { MILESTONE_ORDER, atlasSlots, dustGoal, meetMilestone, milestoneKind, minPicks, newSave, type SaveState } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AtlasSection } from './AtlasSection';
import { CollapseModal } from './CollapseModal';
import { RequirementBars } from './Requirements';
import { GameScreen } from './GameScreen';
import { createGameController, type GameEvent } from './game-controller';
import { createMemoryGameStore } from './game-store';
import { atlasView, collapseCandidates, collapseView, needsReplacement } from './game-logic';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const noop = () => {};

function ready(over: Partial<SaveState> = {}, build: Record<string, number> = { moon: 2, mars: 1 }): SaveState {
  const base = { ...newSave('c', 0), tutorial: 'done' as const, ...over };
  const k = base.collapses + 1;
  return { ...base, run: { ...base.run, build, picks: minPicks(k), dustLife: dustGoal(k), dust: dustGoal(k), ...meetMilestone(base.collapses, base.run.upgradeLevels) } };
}

describe('visão do colapso', () => {
  it('antes da hora diz o que falta, sem liberar o botão', () => {
    const s = { ...newSave('c', 0), tutorial: 'done' as const };
    const v = collapseView(s);
    expect(v.ready).toBe(false);
    expect(v.hint).toMatch(/^Falta .* de poeira, \d+ escolhas e .+ para a estrela colapsar$/);
    expect(v.requirements.map((r) => r.id)).toEqual(['dust', 'picks', 'milestone']);
    expect(v.requirements.every((r) => !r.done && r.fill < 1)).toBe(true);
  });

  it('pronta quando poeira e escolhas batem; as Cintilas já aparecem', () => {
    const v = collapseView(ready());
    expect(v.ready).toBe(true);
    expect(v.sparks).toBeGreaterThanOrEqual(0);
    expect(v.requirements.every((r) => r.done && r.fill === 1)).toBe(true);
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
    const markup = screen(ready());
    expect(markup).toContain('Estrela pronta: colapso 1');
    // O botão traz a barra de cada requisito.
    expect(markup).toContain('Poeira da vida');
    expect(markup).toContain('Escolhas de grimório');
    expect(markup).toContain('Combo: toques seguidos');
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
    // Sem Fragmentos: o colapso só dá Cintilas pelas fontes que abre (conquista "Primeira estrela colapsada", por exemplo).
    expect(s.sparks).toEqual({ legacy: 0, spent: 0 });
    const got = events.filter((e) => e.type === 'collapse');
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ type: 'collapse', pageId: 'moon', pageName: 'Lua' });
    expect((got[0] as { sparks: number }).sparks).toBeGreaterThan(0);
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

describe('requisitos do colapso na tela (spec 040)', () => {
  it('três barras com o que falta: poeira, escolhas e o marco da vida', () => {
    const s = { ...newSave('c', 0), tutorial: 'done' as const };
    const markup = html(<RequirementBars view={collapseView(s)} />);
    expect(markup.match(/role="progressbar"/g)).toHaveLength(3);
    expect(markup).toContain('Poeira da vida');
    expect(markup).toContain('0 de 50 mi');
    expect(markup).toContain('Escolhas de grimório');
    expect(markup).toContain('0 de 20');
    expect(markup).toContain('Combo: toques seguidos');
    expect(markup).toContain('0 de 5');
    expect(markup).toContain('scaleX(0)');
  });

  it('a barra enche só em transform e mostra "cumprido" nos requisitos prontos', () => {
    const markup = html(<RequirementBars view={collapseView(ready())} compact />);
    expect(markup).toContain('is-compact');
    expect(markup.match(/is-done/g)).toHaveLength(3);
    expect(markup.match(/ap-req-ok/g)).toHaveLength(3);
    expect(markup.match(/scaleX\(1\)/g)).toHaveLength(3);
    expect(markup).not.toMatch(/style="[^"]*width/);
  });

  it('cada tipo de marco tem nome e texto próprios, e o tipo gira de um colapso para o outro', () => {
    const labels = new Set<string>();
    for (const c of [1, 2, 4, 5, 6, 7, 8, 9]) {
      const s = { ...newSave('c', 0), tutorial: 'done' as const, collapses: c };
      const m = collapseView(s).requirements[2]!;
      labels.add(m.label.replace(/\d+/g, 'N'));
      expect(m.missing).not.toBe('');
      expect(m.text).toContain(' de ');
    }
    expect(labels.size).toBe(MILESTONE_ORDER.length);
    expect(milestoneKind(7, 6)).not.toBe(milestoneKind(8, 7));
  });

  it('o Atlas mostra as três barras e o número do colapso', () => {
    const markup = html(<AtlasSection state={{ ...newSave('c', 0), tutorial: 'done' }} onCollapse={noop} />);
    expect(markup.match(/role="progressbar"/g)).toHaveLength(3);
    expect(markup).toContain('Colapsar a estrela (colapso 1)');
  });

  it('números enormes saem em notação científica e sem rolar a tela (colapso 300)', () => {
    const base = { ...newSave('c', 0), tutorial: 'done' as const, collapses: 300 };
    const s = { ...base, run: { ...base.run, dust: 4.2e250, dustLife: 4.2e250, picks: 30 }, stats: { ...base.stats, dustTotal: 1e280 } };
    const view = collapseView(s);
    expect(view.requirements[0]!.text).toMatch(/e\d+ de \S+e\d+$/);
    expect(view.requirements[0]!.text).not.toMatch(/NaN|Infinity|undefined/);
    expect(view.next).toBe(301);
    const screen = html(<GameScreen controller={createGameController({ initial: s, store: createMemoryGameStore(), slot: 1 })} onExit={noop} />);
    expect(screen).toContain('4,2e250');
  });

  it('o modal de colapso mostra as barras no passo 1', () => {
    const markup = html(<CollapseModal state={ready()} onCancel={noop} onConfirm={noop} />);
    expect(markup).toContain('A estrela está pronta (colapso 1)');
    expect(markup.match(/role="progressbar"/g)).toHaveLength(3);
  });
});
