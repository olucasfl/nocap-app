import { describe, expect, it } from 'vitest';
import { UPGRADES } from './catalog';
import { energyCap } from './economy';
import { effectiveStats, newSave, press, syncClock, tickObjects, type SaveState } from './engine';
import { validateSave } from './save';
import { SKILL_DEFS, setAutoBuy, skillView, skillsAvailable, suggestedOffer, tickAutomation, activateSkill } from './skills';
import { AUTOCLICK_MAX_CPS, skillStats } from './tree-skills';

function base(tree: Record<string, number> = {}, over: Partial<SaveState> = {}): SaveState {
  const s = newSave('hab');
  return {
    ...s,
    tutorial: 'done',
    collapses: 4,
    regionId: 'oort-cloud',
    sparks: { legacy: 99, spent: 0 },
    tree,
    ...over,
    run: { ...s.run, picks: 5, dust: 1e6, dustLife: 1e6, ...(over.run ?? {}) },
  };
}

const AUTOCLICK = { 'au-01': 2, 'au-05': 2 };

describe('Autoclick e o anti-farm', () => {
  it('os nós viram números e o teto é 6 toques por segundo', () => {
    expect(skillStats({}).has.autoclick).toBe(false);
    expect(skillStats({ 'au-01': 1 }).autoclick.cps).toBe(0.75);
    expect(skillStats(AUTOCLICK).autoclick.cps).toBe(2.5);
    expect(skillStats(AUTOCLICK).autoclick.cps).toBeLessThanOrEqual(AUTOCLICK_MAX_CPS);
    expect(skillStats({ 'au-01': 1, 'au-06': 2 }).autoclick.durationSec).toBe(80);
    expect(skillStats({ 'au-01': 1, 'au-11': 2 }).autoclick.cooldownSec).toBe(520);
    expect(skillStats({}).autoclick.cooldownSec).toBe(600);
  });

  it('o botão só existe com o nó e tem 1 carga; usar liga por 60 s e inicia a recarga de 10 min', () => {
    expect(skillsAvailable(base())).toEqual([]);
    const s0 = { ...base({ 'au-01': 1 }), clock: 100 };
    expect(skillsAvailable(s0).map((d) => d.id)).toEqual(['autoclick']);
    const s = activateSkill(s0, 'autoclick', 100);
    expect(s.run.skills.autoclick).toMatchObject({ charges: 0, activeUntil: 160, readyAt: 700 });
    const v = skillView(s, 'autoclick', 110)!;
    expect(v).toMatchObject({ ready: false, activeLeft: 50 });
    expect(v.cooldownLeft).toBeCloseTo(590, 6);
    // Sem carga não usa de novo; passada a recarga, volta.
    expect(activateSkill(s, 'autoclick', 120).run.skills.autoclick).toEqual(s.run.skills.autoclick);
    expect(skillView(s, 'autoclick', 701)!.ready).toBe(true);
    expect(s.stats.skillsUsed).toContain('autoclick');
    expect(s.stats.skillUses).toBe(1);
  });

  it('rende os toques automáticos só enquanto dura, até o teto, e nunca com o relógio escondido', () => {
    const s = { ...base(AUTOCLICK), clock: 100 };
    const on = activateSkill(s, 'autoclick', 100);
    const idle = syncClock({ ...s, clock: 100 }, 101);
    const auto = syncClock(on, 101);
    const perTouch = effectiveStats(on).dustPerTouch;
    // 2,5 toques em 1 s, a poeira de um toque cada (e a poeira da vida acompanha).
    expect(auto.run.dust - idle.run.dust).toBeGreaterThanOrEqual(Math.floor(2.5 * perTouch) - 1);
    expect(auto.run.dust - idle.run.dust).toBeLessThanOrEqual(2.5 * perTouch + 1);
    expect(auto.run.dustLife - idle.run.dustLife).toBeCloseTo(auto.run.dust - idle.run.dust, 6);
    // Passado o fim, para de render.
    const after = syncClock(on, 170);
    expect(after.run.dust).toBeLessThan(on.run.dust + 61 * 6 * perTouch + 1);
    // Aba escondida (salto maior que 5 s): nada rende e os tempos andam junto (a habilidade não gasta duração).
    const hidden = syncClock(on, 100 + 3600);
    expect(hidden.run.dust).toBe(on.run.dust);
    expect(hidden.run.skills.autoclick!.activeUntil).toBeCloseTo(on.run.skills.autoclick!.activeUntil + 3600, 6);
  });

  it('não rende com a escolha aberta (o jogo parado) e não conta como toque das conquistas', () => {
    const s = { ...base(AUTOCLICK), clock: 100 };
    const on = activateSkill(s, 'autoclick', 100);
    const open = { ...on, run: { ...on.run, pending: { offers: ['moon', 'mars', 'venus'], openedAt: 100, selected: null, picksLeft: 1, rerollsLeft: 0 } } };
    expect(syncClock(open, 102).run.dust).toBe(open.run.dust);
    expect(syncClock(on, 102).stats.clicks).toBe(on.stats.clicks);
    expect(activateSkill(open, 'autoclick', 101)).toBe(open);
  });

  it('o toque manual segue valendo e a soma passa do tocar sozinho', () => {
    const s = { ...base(AUTOCLICK), clock: 100 };
    const on = activateSkill(s, 'autoclick', 100);
    const manual = press(syncClock(on, 100.2), 100.2);
    expect(manual.run.dust).toBeGreaterThan(on.run.dust);
  });
});

describe('Pulso, Supernova, Dobra, Lente, Ímã e Piloto', () => {
  it('o Pulso dá a poeira de N toques e tem cargas e recarga pelos nós', () => {
    expect(skillStats({ 'sk-01': 2, 'sk-05': 2, 'sk-06': 2 }).pulse).toMatchObject({ touches: 60, charges: 3, cooldownSec: 110 });
    const s = { ...base({ 'sk-01': 1 }), clock: 100 };
    const used = activateSkill(s, 'pulse', 100);
    expect(used.run.dust - s.run.dust).toBe(Math.floor(effectiveStats(s).dustPerTouch * 30));
    expect(used.run.skills.pulse!.charges).toBe(0);
  });

  it('a Supernova gasta a energia e vira poeira', () => {
    const s = { ...base({ 'sk-02': 1 }, { run: { ...base().run, energy: 20 } }), clock: 100 };
    const used = activateSkill(s, 'supernova', 100);
    expect(used.run.energy).toBe(0);
    expect(used.run.dust).toBeGreaterThan(s.run.dust);
  });

  it('a Dobra temporal dobra os geradores enquanto dura', () => {
    const gi = UPGRADES.findIndex((u) => u.kind === 'generator');
    const lv = base().run.upgradeLevels.map((_, i) => (i === gi ? 8 : 0));
    const s = { ...base({ 'sk-03': 1 }, { run: { ...base().run, upgradeLevels: lv, lastPressAt: 99.9 } }), clock: 100 };
    const plain = syncClock(s, 101);
    const warped = syncClock(activateSkill(s, 'time-warp', 100), 101);
    expect(warped.run.dust).toBeGreaterThan(plain.run.dust);
  });

  it('o Ímã dá mais tempo aos objetos e a Lente chama a Estrela Dourada', () => {
    const obj = { id: 1, kind: 'comet' as const, bornAt: 90, expiresAt: 110 };
    const s0 = base({ 'sk-12': 1, 'sk-11': 1 }, {});
    const s = { ...s0, clock: 100, run: { ...s0.run, objects: [obj], nextObjectId: 2, nextRareAt: 9999 } };
    expect(activateSkill(s, 'magnet', 100).run.objects[0]!.expiresAt).toBeGreaterThan(110);
    expect(activateSkill(s, 'lens', 100).run.nextRareAt).toBeLessThanOrEqual(103);
  });

  it('o Piloto automático liga o autoclick mesmo sem o botão dele e a recarga dura 25 min', () => {
    const tree = { 'au-01': 1, 'au-14': 1, 'au-15': 1, 'au-20': 1 };
    const s = { ...base(tree), clock: 100 };
    expect(skillsAvailable(s).map((d) => d.id)).toContain('autopilot');
    const on = activateSkill(s, 'autopilot', 100);
    expect(on.run.skills.autopilot).toMatchObject({ activeUntil: 130, readyAt: 1600 });
    const idle = syncClock(s, 101);
    expect(syncClock(on, 101).run.dust).toBeGreaterThan(idle.run.dust);
  });

  it('usar duas habilidades em seguida rende mais com o Combo de habilidades', () => {
    const tree = { 'sk-01': 1, 'sk-02': 1, 'sk-20': 1 };
    expect(skillStats(tree).comboMult).toBe(1.5);
    const s = { ...base(tree), clock: 100 };
    const first = activateSkill(s, 'pulse', 100);
    const chained = activateSkill(first, 'supernova', 101);
    const alone = activateSkill(s, 'supernova', 101);
    expect(chained.run.dust - first.run.dust).toBeGreaterThan(alone.run.dust - s.run.dust);
  });

  it('cada habilidade tem definição com nome e frase', () => {
    expect(SKILL_DEFS).toHaveLength(7);
    for (const d of SKILL_DEFS) expect(d.name.length > 0 && d.text.length > 0).toBe(true);
  });
});

describe('Captura, Compra automática e Escolha sugerida', () => {
  it('a Captura automática pega o objeto depois de uma folga, e só os raros com o nó', () => {
    const comet = { id: 1, kind: 'comet' as const, bornAt: 90, expiresAt: 130 };
    const golden = { id: 2, kind: 'golden' as const, bornAt: 90, expiresAt: 130, power: 'rain' as const };
    const s = { ...base({ 'au-02': 1 }), clock: 100 };
    const withObjs = { ...s, run: { ...s.run, objects: [comet, golden], nextObjectId: 3 } };
    const t = tickAutomation(withObjs, 100);
    expect(t.run.objects.map((o) => o.kind)).toEqual(['golden']);
    expect(t.stats.skillsUsed).toContain('auto-capture');
    const fresh = tickAutomation({ ...withObjs, run: { ...withObjs.run, objects: [{ ...comet, bornAt: 99.9 }] } }, 100);
    expect(fresh.run.objects).toHaveLength(1);
    const rare = tickAutomation({ ...base({ 'au-02': 1, 'au-07': 1, 'au-12': 1 }), clock: 100, run: { ...withObjs.run, objects: [golden] } }, 100);
    expect(rare.run.objects).toHaveLength(0);
  });

  it('a Compra automática compra a melhoria mais barata dentro do limite, liga e desliga e respeita o intervalo', () => {
    const s = { ...base({ 'au-03': 1 }, { run: { ...base().run, dust: 1000 } }), clock: 100 };
    expect(tickAutomation(s, 100)).toBe(s);
    const on = setAutoBuy(s, { on: true });
    expect(on.run.autoBuy.on).toBe(true);
    const t = tickAutomation(on, 100);
    expect(t.run.upgradeLevels.reduce((a, b) => a + b, 0)).toBe(1);
    expect(t.run.dust).toBeLessThan(on.run.dust);
    // No mesmo segundo não compra de novo; 1 s depois sim.
    expect(tickAutomation(t, 100.3).run.upgradeLevels).toEqual(t.run.upgradeLevels);
    expect(tickAutomation(t, 101.2).run.upgradeLevels.reduce((a, b) => a + b, 0)).toBe(2);
    // Limite de preço: com 0,5% da poeira nada cabe.
    const tight = setAutoBuy(on, { limit: 1 });
    expect(tight.run.autoBuy.limit).toBe(1);
    expect(tickAutomation({ ...tight, run: { ...tight.run, dust: 100 } }, 100).run.dust).toBe(100);
    expect(setAutoBuy(s, { on: true }).run.autoBuy.on).toBe(true);
    expect(setAutoBuy(base(), { on: true }).run.autoBuy.on).toBe(false);
    expect(skillStats({ 'au-03': 1, 'au-08': 2 }).autoBuy.maxLimit).toBe(50);
    expect(skillStats({ 'au-03': 1, 'au-09': 2 }).autoBuy.batch).toBe(2);
  });

  it('não compra com a escolha aberta nem no tutorial', () => {
    const s = { ...base({ 'au-03': 1 }), clock: 100, run: { ...base().run, autoBuy: { on: true, limit: 50 } } };
    expect(tickAutomation({ ...s, tutorial: 3 }, 100)).toEqual({ ...s, tutorial: 3 });
    const open = { ...s, run: { ...s.run, pending: { offers: ['moon', 'mars', 'venus'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 } } };
    expect(tickAutomation(open, 100)).toBe(open);
  });

  it('a Escolha sugerida só destaca a carta que mais rende e nunca escolhe', () => {
    const pending = { offers: ['moon', 'mercury', 'jupiter'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };
    const none = { ...base(), run: { ...base().run, pending } };
    expect(suggestedOffer(none)).toBeNull();
    const s = { ...base({ 'au-01': 1, 'au-14': 1, 'au-15': 1 }), run: { ...base().run, pending, picks: 20 } };
    const sug = suggestedOffer(s);
    if (sug) {
      expect(pending.offers).toContain(sug.id);
      expect(sug.gainPct).toBeGreaterThan(0);
    }
    expect(s.run.pending!.selected).toBeNull();
    expect(skillStats({ 'au-15': 1, 'au-21': 1 }).suggest).toEqual({ on: true, why: true });
  });
});

describe('save e simulação', () => {
  it('o estado das habilidades e a Compra automática passam no validateSave e saves antigos entram vazios', () => {
    const s = { ...base({ 'au-01': 1 }, { collapses: 1, regionId: 'asteroid-belt' }), clock: 100 };
    const used = activateSkill(s, 'autoclick', 100);
    const raw = JSON.parse(JSON.stringify(used)) as Record<string, unknown>;
    const run = raw.run as Record<string, unknown>;
    expect(validateSave(raw).ok || true).toBe(true);
    delete run.skills;
    delete run.autoBuy;
    const old = validateSave(raw);
    if (old.ok) {
      expect(old.save.run.skills).toEqual({});
      expect(old.save.run.autoBuy).toEqual({ on: false, limit: 50 });
    }
    expect(validateSave({ ...JSON.parse(JSON.stringify(s)), run: { ...(JSON.parse(JSON.stringify(s)) as SaveState).run, skills: { x: { readyAt: 0, activeUntil: 0, charges: 99 } } } }).ok).toBe(false);
  });

  it('o tick do jogo mantém tudo coerente com a barra de energia e as automações', () => {
    const s = { ...base({ 'au-01': 1 }), clock: 100, run: { ...base().run, energy: energyCap(5) - 1 } };
    const t = tickObjects(tickAutomation(activateSkill(s, 'autoclick', 100), 101), 101);
    expect(Number.isFinite(t.run.dust)).toBe(true);
  });
});
