import { newSave, press, type SaveState } from '@nocap/games';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AchievementsPage } from './AchievementsPage';
import { SpaceArtSprite } from './SpaceArtSprite';
import { TreePage } from './TreePage';
import { achievementCounts, achievementGroups } from './achievements-logic';
import { createGameController, type GameEvent } from './game-controller';
import { createMemoryGameStore } from './game-store';
import { treeView } from './tree-logic';

const noop = () => {};
const base = (over: Partial<SaveState> = {}): SaveState => ({ ...newSave('arv', 0), tutorial: 'done', ...over });
const withFragments = (n: number, over: Partial<SaveState> = {}): SaveState =>
  base({ collapses: 1, fragments: { earned: n, spent: 0 }, ...over });

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
    const v = treeView(base({ fragments: { earned: 9, spent: 0 } }));
    expect(v.open).toBe(false);
    expect(v.branches).toHaveLength(6);
    for (const b of v.branches) for (const n of b.nodes) expect(n.status).toBe('closed');
  });

  it('só o próximo nível do ramo pode ser comprado; os outros esperam', () => {
    const v = treeView(withFragments(1));
    const alpha = v.branches.find((b) => b.id === 'alpha-centauri')!;
    expect(alpha.nodes.map((n) => n.status)).toEqual(['buyable', 'blocked', 'blocked']);
    expect(alpha.nodes.map((n) => n.cost)).toEqual([1, 2, 4]);
    const broke = treeView(withFragments(0)).branches[0]!;
    expect(broke.nodes[0]).toMatchObject({ status: 'short', missing: 1 });
  });

  it('refazer mostra o que volta e a taxa de 20%', () => {
    const s = withFragments(20, { tree: { 'alpha-centauri': 3 }, fragments: { earned: 20, spent: 7 } });
    const v = treeView(s);
    expect(v.respec).toEqual({ can: true, fee: 2, refund: 5 });
    expect(v.branches[0]!.nodes.every((n) => n.status === 'owned')).toBe(true);
    expect(treeView(withFragments(5)).respec.can).toBe(false);
  });
});

describe('controle da árvore', () => {
  it('compra um nó, gasta Fragmentos e salva na hora', async () => {
    const t = setup(withFragments(3));
    expect(t.ctl.buyTree('alpha-centauri:2')).toBe(false);
    expect(t.ctl.buyTree('alpha-centauri:1')).toBe(true);
    expect(t.state().tree['alpha-centauri']).toBe(1);
    expect(t.state().fragments.spent).toBe(1);
    expect(t.ctl.buyTree('alpha-centauri:2')).toBe(true);
    expect(t.ctl.buyTree('alpha-centauri:3')).toBe(false);
    expect(t.state().achievements).toContain('tree-1');
  });

  it('refazer devolve com a taxa e não faz nada sem gasto', () => {
    const t = setup(withFragments(10));
    expect(t.ctl.respec()).toBe(false);
    t.ctl.buyTree('alpha-centauri:1');
    t.ctl.buyTree('alpha-centauri:2');
    expect(t.ctl.respec()).toBe(true);
    expect(t.state().tree).toEqual({});
    expect(t.state().fragments).toEqual({ earned: 10, spent: 1 });
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

  it('árvore: 6 ramos, 18 nós, custo e botão de refazer desligado sem gasto', () => {
    const out = html(<TreePage state={withFragments(1)} onBuy={noop} onRespec={noop} />);
    expect(out.match(/class="ap-branch[ "]/g)).toHaveLength(6);
    expect(out.match(/class="ap-node /g)).toHaveLength(18);
    expect(out).toContain('Comprar · 1');
    expect(out).toContain('1</b><span>Fragmento para gastar');
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
    expect(groups.map((g) => g.name)).toEqual(['Toques', 'Poeira', 'Grimórios', 'Objetos', 'Combo', 'Colapsos', 'Árvore', 'Escondida']);
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
