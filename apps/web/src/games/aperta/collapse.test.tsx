import { FORBIDDEN_IDS, MILESTONE_ORDER, dustGoal, effectiveStats, meetMilestone, minPicks, newSave, type SaveState } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VaultPage } from './VaultPage';
import { CollapseModal } from './CollapseModal';
import { RequirementBars } from './Requirements';
import { GameScreen } from './GameScreen';
import { createGameController, type GameEvent } from './game-controller';
import { createMemoryGameStore } from './game-store';
import { collapseCards, collapseView, vaultSlots } from './game-logic';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const noop = () => {};

function ready(over: Partial<SaveState> = {}, build: Record<string, number> = { moon: 2, mars: 1 }): SaveState {
  const base = { ...newSave('c', 0), tutorial: 'done' as const, ...over };
  const k = base.collapses + 1;
  return { ...base, run: { ...base.run, build, picks: minPicks(k), dustLife: dustGoal(k), dust: dustGoal(k), ...meetMilestone(base.collapses, base.run.upgradeLevels, effectiveStats(base).objects.disabled) } };
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

  it('a oferta tem 3 proibidos distintos, com nível de hoje, nível de depois, bônus e preço', () => {
    const cards = collapseCards(ready());
    expect(cards).toHaveLength(3);
    expect(new Set(cards.map((c) => c.id)).size).toBe(3);
    for (const c of cards) {
      expect(c).toMatchObject({ level: 0, nextLevel: 1 });
      expect(c.bonus.length).toBeGreaterThan(0);
      expect(c.price.length).toBeGreaterThan(0);
    }
  });
});

describe('Cofre na tela', () => {
  it('mostra as 10 casas: as vazias escondem o nome e as cheias mostram o nível', () => {
    const s = ready({ collapses: 3, vault: { 'm87': 2, 'ton-618': 1 } });
    const slots = vaultSlots(s);
    expect(slots).toHaveLength(FORBIDDEN_IDS.length);
    expect(slots.filter((x) => x.owned).map((x) => x.id).sort()).toEqual(['m87', 'ton-618']);
    const markup = html(<VaultPage state={s} onCollapse={noop} />);
    expect(markup).toContain('2 de 10 proibidos no Cofre');
    expect(markup).toContain('Nível 2 de 5');
    expect(markup).toContain('???');
  });

  it('o botão de colapsar só liga com a estrela pronta', () => {
    expect(html(<VaultPage state={ready()} onCollapse={noop} />)).toMatch(/<button[^>]*class="ap-hbtn ap-hbtn-go"[^>]*>Colapsar a estrela/);
    const idle = html(<VaultPage state={{ ...newSave('c', 0), tutorial: 'done' }} onCollapse={noop} />);
    expect(idle).toMatch(/disabled=""[^>]*>Estrela ainda não está pronta/);
    expect(idle).toContain('para a estrela colapsar');
  });
});

describe('modal de colapso', () => {
  it('começa no passo 1 com 3 cartas do Cofre e "Continuar" desligado', () => {
    const markup = html(<CollapseModal state={ready()} onCancel={noop} onConfirm={noop} />);
    expect(markup).toContain('Passo 1 de 2');
    expect(markup.match(/ap-cc ap-cc-vault/g)).toHaveLength(3);
    expect(markup).toContain('Cofre dos Proibidos');
    expect(markup).toMatch(/disabled=""[^>]*>Continuar/);
  });

  it('com o Cofre todo no nível 5 oferece o Selo Estelar e libera o "Continuar"', () => {
    const all = Object.fromEntries(FORBIDDEN_IDS.map((id) => [id, 5]));
    const markup = html(<CollapseModal state={ready({ collapses: 40, vault: all })} onCancel={noop} onConfirm={noop} />);
    expect(markup).toContain('Selo Estelar');
    expect(markup).not.toContain('ap-cc-vault');
    expect(markup).not.toMatch(/disabled=""[^>]*>Continuar/);
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
    expect(markup).toContain('Geradores no nível');
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

  it('recomeça a vida, guarda o proibido no Cofre e salva na hora', () => {
    const { ctl, store, events } = setup(ready());
    const pick = collapseCards(ready())[0]!.id;
    expect(ctl.collapse(pick)).toBe(true);
    const s = ctl.getSnapshot().state;
    expect(s.collapses).toBe(1);
    expect(s.vault).toEqual({ [pick]: 1 });
    expect(s.run.build).toEqual({});
    expect(s.run.dustLife).toBe(0);
    const got = events.filter((e) => e.type === 'collapse');
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ type: 'collapse', choice: pick, level: 1 });
    expect((got[0] as { sparks: number }).sparks).toBeGreaterThan(0);
    expect(store.saved[1]?.collapses).toBe(1);
  });

  it('recusa sem a estrela pronta, escolha fora da oferta e Selo Estelar com proibidos disponíveis', () => {
    const idle = setup({ ...newSave('c', 0), tutorial: 'done' });
    expect(idle.ctl.collapse(FORBIDDEN_IDS[0]!)).toBe(false);
    const r = setup(ready());
    const outside = FORBIDDEN_IDS.find((id) => !collapseCards(ready()).some((c) => c.id === id))!;
    expect(r.ctl.collapse(outside)).toBe(false);
    expect(r.ctl.collapse(null)).toBe(false);
  });

  it('não colapsa com o tutorial em andamento', () => {
    expect(setup({ ...ready(), tutorial: 4 }).ctl.collapse(FORBIDDEN_IDS[0]!)).toBe(false);
  });
});

describe('requisitos do colapso na tela (spec 040)', () => {
  it('três barras com o que falta: poeira, escolhas e o marco da vida', () => {
    const s = { ...newSave('c', 0), tutorial: 'done' as const };
    const markup = html(<RequirementBars view={collapseView(s)} />);
    expect(markup.match(/role="progressbar"/g)).toHaveLength(3);
    expect(markup).toContain('Poeira da vida');
    expect(markup).toContain('0 de 170 mi');
    expect(markup).toContain('Escolhas de grimório');
    expect(markup).toContain('0 de 12');
    expect(markup).toContain('Geradores no nível');
    expect(markup).toContain('0 de 1');
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
    // O combo saiu do jogo (spec 043): sobram 4 tipos de marco.
    expect(labels.size).toBe(MILESTONE_ORDER.length - 2);
  });

  it('o Cofre mostra as três barras e o número do colapso', () => {
    const markup = html(<VaultPage state={{ ...newSave('c', 0), tutorial: 'done' }} onCollapse={noop} />);
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
