import { describe, expect, it } from 'vitest';
import { UPGRADES } from './catalog';
import { buyUpgrade, newSave, nextUpgradeCost, press } from './engine';
import { validateSave } from './save';
import {
  TUTORIAL_GRIMOIRE,
  advanceTutorial,
  finishTutorial,
  grantTutorialDust,
  grantTutorialGrimoire,
  tutorialActive,
  tutorialAllows,
  tutorialStep,
  tutorialUpgradeIndex,
} from './tutorial';

const fresh = () => newSave('tutorial', 0);

describe('tutorial: passos', () => {
  it('um save novo começa no passo 1 e o tutorial está ativo', () => {
    const s = fresh();
    expect(tutorialActive(s)).toBe(true);
    expect(tutorialStep(s)).toBe(1);
  });

  it('só avança do passo em que está (toque repetido não pula passos)', () => {
    const s = advanceTutorial(fresh(), 1, 2);
    expect(s.tutorial).toBe(2);
    expect(advanceTutorial(s, 1, 2)).toBe(s);
    expect(advanceTutorial(s, 3, 4)).toBe(s);
  });

  it('pular ou terminar marca como feito e não mexe no resto', () => {
    const s = fresh();
    const done = finishTutorial(s);
    expect(done.tutorial).toBe('done');
    expect(tutorialActive(done)).toBe(false);
    expect(tutorialStep(done)).toBeNull();
    expect(finishTutorial(done)).toBe(done);
    expect({ ...done, tutorial: 1 }).toEqual(s);
  });

  it('o pulso é a melhoria do passo 4', () => {
    expect(UPGRADES[tutorialUpgradeIndex()]?.id).toBe('pulse');
  });
});

describe('tutorial: concessões', () => {
  it('a Lua entra como escolha de verdade e nunca deixa escolha aberta', () => {
    let s = fresh();
    s = { ...s, run: { ...s.run, energy: 55 } };
    s = grantTutorialGrimoire(press(s, 1));
    expect(s.run.build[TUTORIAL_GRIMOIRE]).toBe(1);
    expect(s.album).toContain(TUTORIAL_GRIMOIRE);
    expect(s.run.picks).toBe(1);
    expect(s.stats.picks).toBe(1);
    expect(s.run.energy).toBe(0);
    expect(s.run.pending).toBeNull();
  });

  it('repetir a concessão não conta duas escolhas nem duplica o álbum', () => {
    const once = grantTutorialGrimoire(fresh());
    const twice = grantTutorialGrimoire(once);
    expect(twice.run.picks).toBe(1);
    expect(twice.album).toEqual([TUTORIAL_GRIMOIRE]);
  });

  it('a poeira cobre exatamente a 1ª compra e a compra funciona', () => {
    const s = grantTutorialDust(grantTutorialGrimoire(press(fresh(), 1)));
    const idx = tutorialUpgradeIndex();
    const cost = nextUpgradeCost(s, idx) as number;
    expect(s.run.dust).toBeGreaterThanOrEqual(cost);
    expect(s.run.dustLife).toBeGreaterThanOrEqual(s.run.dust);
    expect(buyUpgrade(s, idx).run.upgradeLevels[idx]).toBe(1);
  });

  it('quem já tem poeira de sobra não perde nada', () => {
    const s = fresh();
    const rich = { ...s, run: { ...s.run, dust: 9000, dustLife: 9000 } };
    expect(grantTutorialDust(rich)).toBe(rich);
  });
});

describe('tutorial: o que o motor permite', () => {
  const at = (step: number | 'done') => ({ ...fresh(), tutorial: step });
  it('toque só no passo 1 (ou concluído)', () => {
    expect(tutorialAllows(at(1), 'press')).toBe(true);
    for (const n of [2, 3, 4, 5]) expect(tutorialAllows(at(n), 'press')).toBe(false);
    expect(tutorialAllows(at('done'), 'press')).toBe(true);
  });

  it('compra só do Pulso Solar e só no passo 4', () => {
    const pulse = tutorialUpgradeIndex();
    expect(tutorialAllows(at(4), 'buy', pulse)).toBe(true);
    expect(tutorialAllows(at(4), 'buy', pulse + 1)).toBe(false);
    expect(tutorialAllows(at(3), 'buy', pulse)).toBe(false);
    expect(tutorialAllows(at('done'), 'buy', pulse + 1)).toBe(true);
  });
});

describe('tutorial: save', () => {
  it('cada passo e o "done" passam em validateSave, e o passo sobrevive ao ciclo', () => {
    for (const t of [1, 2, 3, 4, 5, 'done'] as const) {
      const r = validateSave({ ...fresh(), tutorial: t });
      expect(r.ok, String(t)).toBe(true);
      if (r.ok) expect(r.save.tutorial).toBe(t);
    }
  });

  it('a poeira entregue no tutorial não é cortada pela validação de ritmo', () => {
    const base = grantTutorialDust(grantTutorialGrimoire(press(fresh(), 1)));
    const s = { ...base, playSeconds: 4, tutorial: 3 as const };
    const r = validateSave(s, { nowMs: 60_000, createdAtMs: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.flagged).toEqual([]);
      expect(r.save.run.dust).toBe(s.run.dust);
    }
  });

  it('save antigo sem campo novo continua válido (o tutorial não criou campo)', () => {
    const r = validateSave(JSON.parse(JSON.stringify(fresh())));
    expect(r.ok).toBe(true);
  });
});
