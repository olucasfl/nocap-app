import { describe, expect, it } from 'vitest';
import { energyCap } from './economy';
import { buyUpgrade, captureObject, pinsFirstObject, tickObjects, chooseGrimoire, newSave, nextUpgradeCost, press, selectGrimoire, type SaveState } from './engine';
import { mergeSaves, validateSave } from './save';
import {
  ACHIEVEMENT_HINT_AT,
  TUTORIAL,
  UI_BUTTONS,
  advanceTutorial,
  affordableUpgradeIndex,
  canAffordGenerator,
  canAffordUpgrade,
  finishTutorial,
  markHintSeen,
  migrateTutorial,
  objectsVisible,
  pendingHint,
  settleTutorial,
  tutorialActive,
  tutorialStep,
  unlockedButtons,
} from './tutorial';

const fresh = () => newSave('tutorial', 0);

/** Dá a poeira exata do 1º preço. */
function withDustForFirstUpgrade(s: SaveState): SaveState {
  const idx = affordableIndexAfterDust(s);
  const cost = nextUpgradeCost(s, idx) as number;
  return { ...s, run: { ...s.run, dust: cost, dustLife: cost } };
}
const affordableIndexAfterDust = (s: SaveState) => (nextUpgradeCost(s, 0) === null ? 1 : 0);

/** Leva um save novo até o passo `to` pelo mesmo caminho do jogo (toque, compra, barra, escolha). */
function reach(to: number): SaveState {
  let s = fresh();
  if (to === TUTORIAL.TOUCH) return s;
  s = settleTutorial(withDustForFirstUpgrade(s));
  if (to === TUTORIAL.UPGRADE) return s;
  const idx = affordableUpgradeIndex(s) as number;
  s = settleTutorial(buyUpgrade(s, idx));
  if (to === TUTORIAL.BACK) return s;
  s = advanceTutorial(s, TUTORIAL.BACK, TUTORIAL.FILL);
  if (to === TUTORIAL.FILL) return s;
  s = { ...s, run: { ...s.run, energy: energyCap(s.run.picks) - 0.01 } };
  s = settleTutorial(press(s, 1));
  if (to === TUTORIAL.CHOOSE) return s;
  const offer = s.run.pending?.offers[0] as string;
  s = settleTutorial(chooseGrimoire(selectGrimoire(s, offer, 3), offer, 3));
  if (to === TUTORIAL.GRIMOIRES) return s;
  return settleTutorial(advanceTutorial(s, TUTORIAL.GRIMOIRES, TUTORIAL.FREE));
}

describe('tutorial: passos', () => {
  it('um save novo começa no passo 1, ativo, sem nada liberado', () => {
    const s = fresh();
    expect(tutorialActive(s)).toBe(true);
    expect(tutorialStep(s)).toBe(1);
    expect(s.ui).toMatchObject({ unlocked: [], hints: [] });
    expect([...unlockedButtons(s)]).toEqual([]);
    expect(objectsVisible(s)).toBe(false);
  });

  it('só avança do passo em que está (toque repetido não pula passos)', () => {
    const s = advanceTutorial(fresh(), 1, 2);
    expect(s.tutorial).toBe(2);
    expect(advanceTutorial(s, 1, 2)).toBe(s);
    expect(advanceTutorial(s, 3, 4)).toBe(s);
  });

  it('pular marca como feito, libera todos os botões e não mexe no resto', () => {
    const s = fresh();
    const done = finishTutorial(s);
    expect(done.tutorial).toBe('done');
    expect(tutorialActive(done)).toBe(false);
    expect(tutorialStep(done)).toBeNull();
    expect(finishTutorial(done)).toBe(done);
    expect([...unlockedButtons(done)].sort()).toEqual([...UI_BUTTONS].sort());
    expect(objectsVisible(done)).toBe(true);
    expect({ ...done, tutorial: 1 }).toEqual(s);
  });
});

describe('tutorial: do primeiro toque ao jogo livre', () => {
  it('passo 1: enquanto a poeira não cobre a 1ª melhoria, nada muda', () => {
    let s = fresh();
    for (let i = 1; i <= 5; i++) s = settleTutorial(press(s, i));
    expect(s.tutorial).toBe(TUTORIAL.TOUCH);
    expect(canAffordUpgrade(s)).toBe(false);
    expect([...unlockedButtons(s)]).toEqual([]);
  });

  it('passo 2: poeira da 1ª melhoria libera Melhorias, e só ela', () => {
    const s = reach(TUTORIAL.UPGRADE);
    expect(s.tutorial).toBe(TUTORIAL.UPGRADE);
    expect([...unlockedButtons(s)]).toEqual(['upgrades']);
    expect(affordableUpgradeIndex(s)).not.toBeNull();
  });

  it('comprar leva ao passo 3 (voltar ao jogo); sem comprar, fica no 2', () => {
    expect(settleTutorial(reach(TUTORIAL.UPGRADE)).tutorial).toBe(TUTORIAL.UPGRADE);
    expect(reach(TUTORIAL.BACK).tutorial).toBe(TUTORIAL.BACK);
  });

  it('a barra cheia abre a escolha do 1º grimório e libera Grimórios', () => {
    const s = reach(TUTORIAL.CHOOSE);
    expect(s.tutorial).toBe(TUTORIAL.CHOOSE);
    expect(s.run.pending).not.toBeNull();
    expect(unlockedButtons(s).has('grimoires')).toBe(true);
    expect(unlockedButtons(s).has('achievements')).toBe(false);
    expect(unlockedButtons(s).has('tree')).toBe(false);
  });

  it('escolher o grimório leva ao passo 6; abrir a página leva ao jogo livre', () => {
    const s = reach(TUTORIAL.GRIMOIRES);
    expect(s.tutorial).toBe(TUTORIAL.GRIMOIRES);
    expect(s.album).toHaveLength(1);
    expect(reach(TUTORIAL.FREE).tutorial).toBe(TUTORIAL.FREE);
    expect(objectsVisible(reach(TUTORIAL.FREE))).toBe(true);
  });

  it('barra cheia antes de comprar pula direto para a escolha, sem perder o que já aprendeu', () => {
    let s = fresh();
    s = { ...s, run: { ...s.run, energy: energyCap(0) - 0.01 } };
    s = settleTutorial(press(s, 1));
    expect(s.tutorial).toBe(TUTORIAL.CHOOSE);
    expect(unlockedButtons(s).has('upgrades')).toBe(true);
    expect(unlockedButtons(s).has('grimoires')).toBe(true);
  });

  it('o botão de Melhorias também vem do progresso (comprou), mesmo que ui.unlocked esteja vazio', () => {
    const bought = reach(TUTORIAL.BACK);
    const stripped = { ...bought, ui: { unlocked: [], hints: [] } };
    expect(unlockedButtons(stripped).has('upgrades')).toBe(true);
  });
});

describe('tutorial: cartões do jogo livre', () => {
  /** Jogo livre sem poeira sobrando: o cartão de Geradores (que espera poeira) não entra no meio das outras conferências. */
  const free = () => {
    const s = reach(TUTORIAL.FREE);
    return { ...s, run: { ...s.run, dust: 0 } };
  };
  const withAchievements = (s: SaveState, n: number) => ({ ...s, achievements: ['tap-1', 'tap-100', 'dust-1k'].slice(0, n) });
  const withObject = (s: SaveState) => ({
    ...s,
    run: { ...s.run, objects: [{ id: 1, kind: 'comet' as const, bornAt: 0, expiresAt: 9 }] },
  });
  it('o primeiro objeto não some até ser pego; depois do cartão visto volta a expirar', () => {
    const s = withObject(free());
    expect(pinsFirstObject(s)).toBe(true);
    const step = (st: SaveState, to: number) => {
      let cur = st;
      for (let t = Math.ceil(cur.clock) + 1, end = t + to; t <= end; t++) cur = tickObjects(cur, t);
      return cur;
    };
    const later = step(s, 40);
    expect(later.run.objects).toHaveLength(1);
    expect(pendingHint(settleTutorial(later))).toBe('objects');
    const caught = captureObject(later, 1, later.clock + 0.5);
    expect(caught.run.objects).toHaveLength(0);

    const seen = markHintSeen(withObject(free()), 'objects');
    expect(pinsFirstObject(seen)).toBe(false);
    expect(step(seen, 40).run.objects.some((o) => o.id === 1)).toBe(false);
  });


  it('só a 1ª conquista (a do primeiro toque) não dispara o cartão de Conquistas', () => {
    expect(ACHIEVEMENT_HINT_AT).toBe(2);
    expect(pendingHint(withAchievements(free(), 1))).toBeNull();
    expect(unlockedButtons(settleTutorial(withAchievements(free(), 1))).has('achievements')).toBe(false);
  });

  it('a conquista seguinte dispara o cartão e libera o botão', () => {
    const s = settleTutorial(withAchievements(free(), 2));
    expect(pendingHint(s)).toBe('achievements');
    expect(unlockedButtons(s).has('achievements')).toBe(true);
  });

  it('o objeto no campo dispara o cartão de objetos (sem botão novo)', () => {
    const s = settleTutorial(withObject(free()));
    expect(pendingHint(s)).toBe('objects');
    expect(s.ui.unlocked).toEqual(['upgrades', 'grimoires']);
  });

  it('conquista vem antes de objeto quando os dois estão prontos', () => {
    expect(pendingHint(withObject(withAchievements(free(), 2)))).toBe('achievements');
  });

  it('a árvore é o último: só depois dos outros dois e da 1ª Cintila ganha', () => {
    let s = free();
    expect(pendingHint(s)).toBeNull();
    s = markHintSeen(withAchievements(s, 2), 'achievements');
    expect(pendingHint(s)).toBeNull();
    s = markHintSeen(s, 'objects');
    s = markHintSeen(s, 'generators');
    // O colapso é explicado depois de 2 grimórios escolhidos, antes da árvore.
    expect(pendingHint(s)).toBeNull();
    s = { ...s, run: { ...s.run, picks: 2 } };
    expect(pendingHint(s)).toBe('collapse');
    s = markHintSeen(s, 'collapse');
    expect(pendingHint(s)).toBe('tree');
    expect(unlockedButtons(settleTutorial(s)).has('tree')).toBe(true);
    // Sem nenhuma Cintila o cartão espera: o aviso é "você ganhou sua primeira Cintila".
    const broke = { ...s, achievements: [], album: [], stats: { ...s.stats, eventsSeen: [] } };
    expect(pendingHint(broke)).toBeNull();
  });

  it('o primeiro gerador que cabe na poeira dispara o cartão de Geradores (sem botão novo)', () => {
    let s = free();
    expect(pendingHint(s)).toBeNull();
    expect(canAffordGenerator(s)).toBe(false);
    s = { ...s, run: { ...s.run, dust: 1e9, dustLife: 1e9 } };
    expect(canAffordGenerator(s)).toBe(true);
    expect(pendingHint(s)).toBe('generators');
    expect(settleTutorial(s).ui.unlocked).toEqual(['upgrades', 'grimoires']);
    expect(pendingHint(markHintSeen(s, 'generators'))).toBeNull();
  });

  it('ver todos os cartões conclui o tutorial e libera tudo', () => {
    let s = free();
    s = markHintSeen(markHintSeen(markHintSeen(markHintSeen(markHintSeen(s, 'achievements'), 'objects'), 'generators'), 'collapse'), 'tree');
    expect(s.tutorial).toBe('done');
    expect(unlockedButtons(s).size).toBe(UI_BUTTONS.length);
  });

  it('marcar o mesmo cartão duas vezes não muda nada; fora do jogo livre não há cartão', () => {
    const once = markHintSeen(free(), 'objects');
    expect(markHintSeen(once, 'objects')).toBe(once);
    expect(pendingHint(withObject(reach(TUTORIAL.CHOOSE)))).toBeNull();
    expect(pendingHint(finishTutorial(withObject(free())))).toBeNull();
  });
});

describe('tutorial: save', () => {
  it('cada passo, o "done" e o ui passam em validateSave e sobrevivem ao ciclo', () => {
    for (let t = 1; t <= TUTORIAL.FREE; t++) {
      const r = validateSave({ ...fresh(), tutorial: t, ui: { unlocked: ['upgrades'], hints: ['objects'] } });
      expect(r.ok, String(t)).toBe(true);
      if (r.ok) {
        expect(r.save.tutorial).toBe(t);
        expect(r.save.ui).toMatchObject({ unlocked: ['upgrades'], hints: ['objects'] });
      }
    }
    const done = validateSave({ ...fresh(), tutorial: 'done' });
    expect(done.ok && done.save.tutorial).toBe('done');
  });

  it('ui com botão ou cartão desconhecido é recusado', () => {
    expect(validateSave({ ...fresh(), ui: { unlocked: ['segredo'], hints: [] } }).ok).toBe(false);
    expect(validateSave({ ...fresh(), ui: { unlocked: [], hints: ['segredo'] } }).ok).toBe(false);
  });

  describe('saves de antes do tutorial dinâmico (sem ui)', () => {
    const old = (patch: Partial<SaveState>) => {
      const rest: Partial<SaveState> = { ...fresh(), ...patch };
      delete rest.ui;
      return rest;
    };
    const played = { stats: { ...fresh().stats, clicks: 40 } };

    it('com progresso entram com o tutorial concluído, mesmo parados num passo do roteiro antigo', () => {
      for (const t of ['done', 1, 3, 5] as const) {
        const r = validateSave(old({ ...played, tutorial: t }));
        expect(r.ok, String(t)).toBe(true);
        if (r.ok) {
          expect(r.save.tutorial).toBe('done');
          expect(r.save.ui).toMatchObject({ unlocked: [], hints: [] });
          expect(unlockedButtons(r.save).size).toBe(UI_BUTTONS.length);
        }
      }
    });

    it('sem nenhum toque recomeçam do passo 1 (o roteiro antigo não vale mais)', () => {
      const r = validateSave(old({ tutorial: 3 }));
      expect(r.ok && r.save.tutorial).toBe(1);
    });

    it('migrateTutorial não mexe em save que já tem ui', () => {
      const s = reach(TUTORIAL.BACK);
      expect(migrateTutorial(s)).toBe(s);
    });
  });

  it('juntar saves une o que cada aparelho já mostrou', () => {
    const a = { ...reach(TUTORIAL.FREE), ui: { unlocked: ['upgrades', 'grimoires'] as const, hints: ['objects'] as const } };
    const b = { ...reach(TUTORIAL.FREE), ui: { unlocked: ['achievements'] as const, hints: ['achievements'] as const } };
    const { save } = mergeSaves(
      { ...a, ui: { unlocked: [...a.ui.unlocked], hints: [...a.ui.hints] } },
      { ...b, ui: { unlocked: [...b.ui.unlocked], hints: [...b.ui.hints] } },
    );
    expect(new Set(save.ui.unlocked)).toEqual(new Set(['upgrades', 'grimoires', 'achievements']));
    expect(new Set(save.ui.hints)).toEqual(new Set(['objects', 'achievements']));
  });
});

describe('conquistas ainda não vistas (spec 041, A1)', () => {
  it('conta as ganhas além das vistas e abrir a página zera', async () => {
    const { markAchievementsSeen, unseenAchievements } = await import('./tutorial');
    const s = { ...newSave('conq'), achievements: ['tap-1', 'dust-1k', 'tap-100'] };
    expect(unseenAchievements(s)).toBe(3);
    const seen = markAchievementsSeen(s);
    expect(unseenAchievements(seen)).toBe(0);
    expect(markAchievementsSeen(seen)).toBe(seen);
    expect(unseenAchievements({ ...seen, achievements: [...seen.achievements, 'tap-1000'] })).toBe(1);
  });
});
