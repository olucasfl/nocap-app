import { ACHIEVEMENT_GROUPS, newSave, press, type SaveState } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AchievementsPage } from './AchievementsPage';
import { SpaceArtSprite } from './SpaceArtSprite';
import { TreePage } from './TreePage';
import { NO_FILTER, achievementChips, achievementCounts, achievementGroups, achievementSparkTotals, fold } from './achievements-logic';
import { createGameController, type GameEvent } from './game-controller';
import { createMemoryGameStore } from './game-store';
import { treeView } from './tree-logic';

const noop = () => {};
const base = (over: Partial<SaveState> = {}): SaveState => ({ ...newSave('arv', 0), tutorial: 'done', ...over });
const withFragments = (n: number, over: Partial<SaveState> = {}): SaveState =>
  base({ collapses: 1, sparks: { legacy: n, spent: 0 }, ...over });

function setup(initial: SaveState) {
  const clock = { ms: 1000 };
  const events: GameEvent[] = [];
  const store = createMemoryGameStore();
  const ctl = createGameController({ initial, store, slot: 1, perf: () => clock.ms });
  ctl.onEvent((e) => events.push(e));
  return { clock, events, ctl, state: () => ctl.getSnapshot().state };
}

describe('visão da árvore', () => {
  it('antes do 1º colapso todos os nós estão fechados', () => {
    const v = treeView(base({ sparks: { legacy: 9, spent: 0 } }));
    expect(v.open).toBe(false);
    expect(v.branches).toHaveLength(5);
    for (const b of v.branches) for (const n of b.nodes) expect(n.status).toBe('closed');
  });

  it('só o nó com os pais comprados abre; o resto espera, e os de mecânica futura ficam "em breve"', () => {
    const v = treeView(withFragments(1));
    const cosmos = v.branches.find((b) => b.id === 'cosmos')!;
    const status = (id: string) => cosmos.nodes.find((n) => n.id === id)!.status;
    expect(status('co-01')).toBe('buyable');
    expect(status('co-05')).toBe('blocked');
    expect(cosmos.nodes.find((n) => n.id === 'co-05')!.needs).toEqual(['Sintonia']);
    const auto = v.branches.find((b) => b.id === 'automation')!;
    expect(auto.nodes.find((n) => n.id === 'au-01')!.status).toBe('soon');
    const broke = treeView(withFragments(0)).branches.find((b) => b.id === 'cosmos')!;
    expect(broke.nodes[0]).toMatchObject({ status: 'short', missing: 1 });
  });

  it('refazer devolve 100% do que foi gasto, sem taxa, e só com a vida zerada', () => {
    const s = withFragments(20, { tree: { 'co-02': 1, 'co-05': 1 }, sparks: { legacy: 20, spent: 3 } });
    const v = treeView(s);
    expect(v.respec).toEqual({ can: true, refund: 3, spent: 3 });
    expect(v.earned).toBe(20);
    expect(v.sources.map((x) => x.id)).toContain('legacy');
    expect(treeView(withFragments(5)).respec.can).toBe(false);
    const playing = { ...s, run: { ...s.run, clicks: 9, picks: 1 } };
    expect(treeView(playing).respec).toMatchObject({ can: false, refund: 0, spent: 3 });
  });
});

describe('controle da árvore', () => {
  it('compra um nó, gasta Cintilas e salva na hora', async () => {
    const t = setup(withFragments(3));
    expect(t.ctl.buyTree('co-05')).toBe(false);
    expect(t.ctl.buyTree('co-02')).toBe(true);
    expect(t.state().tree['co-02']).toBe(1);
    expect(t.state().sparks.spent).toBe(1);
    expect(t.ctl.buyTree('co-05')).toBe(true);
    expect(t.state().sparks.spent).toBe(3);
    expect(t.state().achievements).toContain('tree-1');
  });

  it('refazer devolve tudo e não faz nada sem gasto', () => {
    const t = setup(withFragments(10));
    expect(t.ctl.respec()).toBe(false);
    t.ctl.buyTree('co-02');
    t.ctl.buyTree('co-05');
    expect(t.ctl.respec()).toBe(true);
    expect(t.state().tree).toEqual({});
    expect(t.state().sparks).toEqual({ legacy: 10, spent: 0 });
    expect(t.state().achievements).toContain('respec');
  });
});

describe('avisos de conquista', () => {
  it('o 1º toque avisa "Primeiro toque" uma vez só', () => {
    const t = setup(base());
    t.clock.ms += 400;
    t.ctl.press();
    t.clock.ms += 400;
    t.ctl.press();
    const got = t.events.filter((e) => e.type === 'achievement');
    expect(got).toEqual([{ type: 'achievement', id: 'tap-1', name: 'Primeiro toque' }]);
    // E a Cintila da conquista também é avisada, com o saldo.
    expect(t.events.filter((e) => e.type === 'sparks')).toEqual([{ type: 'sparks', amount: 1, available: 1 }]);
  });

  it('durante o tutorial a conquista é guardada, mas o aviso espera', () => {
    const t = setup(newSave('tut', 0));
    t.clock.ms += 400;
    t.ctl.press();
    expect(t.events.some((e) => e.type === 'achievement')).toBe(false);
    expect(t.state().achievements).toContain('tap-1');
  });
});

describe('páginas', () => {
  const html = (node: React.ReactNode) =>
    renderToStaticMarkup(
      <>
        <SpaceArtSprite />
        {node}
      </>,
    );

  it('árvore: 5 ramos, 120 nós, custo e botão de refazer desligado sem gasto', () => {
    const out = html(<TreePage state={withFragments(1)} onBuy={noop} onRespec={noop} />);
    expect(out.match(/class="ap-branch[ "]/g)).toHaveLength(5);
    expect(out.match(/class="ap-node /g)).toHaveLength(120);
    expect(out).toContain('Comprar · 1');
    expect(out).toContain('1</b><span>Cintila para gastar');
    expect(out).toContain('De onde vêm as Cintilas');
    expect(out).toMatch(/<button[^>]*disabled[^>]*>Refazer árvore/);
  });

  it('árvore fechada avisa que abre depois do 1º colapso', () => {
    const out = html(<TreePage state={base()} onBuy={noop} onRespec={noop} />);
    expect(out).toContain('Abre depois do primeiro colapso');
  });

  it('conquistas: grupos, barra, N/M e a escondida como ???', () => {
    const s = base({ stats: { ...newSave('x').stats, clicks: 40 }, achievements: ['tap-1'] });
    const out = html(<AchievementsPage state={s} />);
    expect(out).toContain('40/100');
    expect(out).toContain('Ganha');
    expect(out).toContain('???');
    expect(out).not.toContain('Mudei de ideia');
    expect(out).toContain('scaleX(0.4)');
    const groups = achievementGroups(s);
    expect(groups.map((g) => g.name)).toEqual(ACHIEVEMENT_GROUPS.map((g) => g.name));
    expect(achievementCounts(s).earned).toBe(1);
  });

  it('a conquista escondida aparece com o nome depois de ganha', () => {
    const out = html(<AchievementsPage state={base({ achievements: ['respec'] })} />);
    expect(out).toContain('Mudei de ideia');
  });

  it('um toque real sobe a barra no estado do motor', () => {
    const s = press(base(), 1);
    expect(achievementGroups(s)[0]!.rows[0]).toMatchObject({ earned: true, fraction: 1 });
  });
});

describe('página de Conquistas ampliada', () => {
  const s = base({ stats: { ...newSave('x').stats, clicks: 40, dustTotal: 5e6 }, achievements: ['tap-1', 'dust-1k'] });

  it('filtra por família, por busca (sem acento) e por estado', () => {
    expect(achievementGroups(s, { ...NO_FILTER, group: 'taps' }).map((g) => g.id)).toEqual(['taps']);
    const found = achievementGroups(s, { ...NO_FILTER, query: 'POEIRA' }).flatMap((g) => g.rows.map((r) => r.id));
    expect(found).toContain('dust-1m');
    expect(found).not.toContain('tap-100');
    expect(fold('Poeíra Cósmica')).toBe('poeira cosmica');
    const todo = achievementGroups(s, { ...NO_FILTER, status: 'todo' }).flatMap((g) => g.rows);
    expect(todo.some((r) => r.earned)).toBe(false);
    const done = achievementGroups(s, { ...NO_FILTER, status: 'earned' }).flatMap((g) => g.rows.map((r) => r.id));
    expect(done.sort()).toEqual(['dust-1k', 'tap-1']);
    expect(achievementGroups(s, { ...NO_FILTER, query: 'zzzz' })).toEqual([]);
  });

  it('a escondida não vaza pela busca enquanto não for ganha', () => {
    const q = achievementGroups(s, { ...NO_FILTER, query: 'refaca a arvore' }).flatMap((g) => g.rows);
    expect(q).toEqual([]);
    expect(achievementGroups(s, { ...NO_FILTER, query: 'escondida' }).flatMap((g) => g.rows).every((r) => r.secret)).toBe(true);
  });

  it('os botões de família trazem N/M e somam o total', () => {
    const chips = achievementChips(s);
    expect(chips[0]).toMatchObject({ id: 'all', earned: 2 });
    expect(chips.slice(1).reduce((n, c) => n + c.total, 0)).toBe(chips[0]!.total);
    expect(chips.find((c) => c.id === 'taps')!.earned).toBe(1);
  });

  it('mostra Cintilas ganhas, a ganhar e em breve, e a recompensa de cada card', () => {
    const t = achievementSparkTotals(s);
    expect(t.earned).toBe(2);
    expect(t.toEarn).toBeGreaterThan(100);
    expect(t.soon).toBeGreaterThan(50);
    const out = renderToStaticMarkup(<AchievementsPage state={s} />);
    expect(out).toContain('Cintilas das conquistas');
    expect(out).toContain('em breve');
    expect(out).toMatch(/class="ap-ach-reward"[^>]*>\+\d+/);
    expect(out).toContain('Buscar conquista');
    expect(out.match(/aria-pressed/g)!.length).toBeGreaterThanOrEqual(1 + 3 + 17 - 1);
  });

  it('conquistas que esperam conteúdo aparecem como "em breve", sem barra e sem número', () => {
    const out = renderToStaticMarkup(<AchievementsPage state={s} />);
    expect(out).toContain('Em breve: precisa d');
    const soonCard = out.split('<li class="ap-ach').find((c) => c.includes('is-soon'))!;
    expect(soonCard).not.toContain('ap-ach-bar');
  });
});
