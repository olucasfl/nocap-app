import { describe, expect, it } from 'vitest';
import { GRIMOIRES, RARE_EFFECTS, upgradeIndex, type GrimoireRarity } from './catalog';
import { RARE_MIN_INTERVAL_SEC, pickInto } from './economy';
import {
  captureObject,
  effectiveStats,
  newSave,
  objectPreview,
  syncClock,
  tickObjects,
  type RunState,
  type SaveState,
} from './engine';
import { validateSave } from './save';

/** Um save fora do tutorial e com os objetos abertos (a Estrela Dourada só nasce assim). */
function open(over: Partial<RunState> = {}): SaveState {
  const s = newSave('rare', 0);
  const upgradeLevels = s.run.upgradeLevels.slice();
  upgradeLevels[upgradeIndex('satellite')] = 1;
  // Muitas escolhas já feitas: a barra de energia é grande e não abre escolha (que congelaria o relógio) durante o teste.
  return { ...s, tutorial: 'done', run: { ...s.run, upgradeLevels, picks: 200, ...over } };
}

/** Passa o tempo em passos de 1 s (um salto maior que 5 s seria aba escondida). */
function tickTo(s: SaveState, to: number): SaveState {
  let state = s;
  for (let t = Math.floor(state.clock) + 1; t <= to; t++) state = tickObjects(state, t);
  return state;
}

/** O grimório `id` pego `levels` vezes na raridade `rarity` (o 1º vale o passo cheio, os outros metade). */
const picked = (s: SaveState, id: string, rarity: GrimoireRarity, levels = 1): SaveState => ({
  ...s,
  run: { ...s.run, ...pickInto(s.run, id, rarity, levels) },
});

describe('efeitos dos grimórios de objetos e geradores (spec 042)', () => {
  it('os grimórios não mexem nos geradores nem no ritmo parado (isso é das Melhorias e da Árvore)', () => {
    const base = open({ upgradeLevels: open().run.upgradeLevels.map((_, i) => (i === upgradeIndex('satellite') ? 10 : 0)) });
    const plain = effectiveStats(base);
    let loaded = base;
    for (const g of GRIMOIRES) loaded = picked(loaded, g.id, 'legendary', 10);
    const full = effectiveStats(loaded);
    expect(full.autoDustPerSec).toBeCloseTo(plain.autoDustPerSec, 9);
    expect(full.activeWindowSec).toBe(plain.activeWindowSec);
    expect(full.idleFactor).toBe(plain.idleFactor);
  });

  it('os objetos comuns aparecem mais cedo (com piso) e a Estrela Dourada fica mais tempo', () => {
    const base = effectiveStats(open()).objects;
    expect([base.spawnMinSec, base.spawnMaxSec]).toEqual([60, 90]);
    const halley = effectiveStats(picked(open(), 'halley', 'common')).objects;
    expect([halley.spawnMinSec, halley.spawnMaxSec]).toEqual([57, 87]);
    // A raridade multiplica o passo: Raro corta o dobro.
    const rare = effectiveStats(picked(open(), 'halley', 'rare')).objects;
    expect([rare.spawnMinSec, rare.spawnMaxSec]).toEqual([54, 84]);
    const floor = effectiveStats(picked(open(), 'halley', 'legendary', 10)).objects;
    expect(floor.spawnMinSec).toBeGreaterThanOrEqual(30);
    expect(floor.spawnMaxSec).toBeGreaterThanOrEqual(45);
    expect(base.rareLifeSec).toBe(10);
    expect(effectiveStats(picked(open(), 'antares', 'common')).objects.rareLifeSec).toBe(12);
    expect(effectiveStats(picked(open(), 'antares', 'rare')).objects.rareLifeSec).toBe(14);
  });

  it('a Estrela Dourada nunca vem em menos de 5 min, por mais que o Antares ajude', () => {
    const base = effectiveStats(open()).objects;
    expect([base.rareMinSec, base.rareMaxSec]).toEqual([360, 600]);
    const one = effectiveStats(picked(open(), 'antares', 'common')).objects;
    expect([one.rareMinSec, one.rareMaxSec]).toEqual([335, 575]);
    const stacked = effectiveStats(picked(open(), 'antares', 'legendary', 10)).objects;
    expect(stacked.rareMinSec).toBe(RARE_MIN_INTERVAL_SEC);
    expect(stacked.rareMaxSec).toBeGreaterThanOrEqual(RARE_MIN_INTERVAL_SEC);
  });
});

describe('Estrela Dourada: nascimento', () => {
  it('só nasce fora do tutorial', () => {
    const s = { ...open(), tutorial: 3 as const };
    const later = tickTo(s, 2000);
    expect(later.run.objects.some((o) => o.kind === 'golden')).toBe(false);
    expect(later.run.nextRareAt).toBeNull();
  });

  it('a primeira vem entre 6 e 10 min, dura 10 s e traz o efeito já sorteado', () => {
    let s = tickObjects(open(), 0);
    const at = s.run.nextRareAt as number;
    expect(at).toBeGreaterThanOrEqual(360);
    expect(at).toBeLessThanOrEqual(600);
    s = tickTo(s, at - 2);
    expect(s.run.objects.some((o) => o.kind === 'golden')).toBe(false);
    s = tickTo(s, at + 1);
    const g = s.run.objects.find((o) => o.kind === 'golden');
    expect(g).toBeDefined();
    expect(g!.expiresAt - g!.bornAt).toBeCloseTo(10, 9);
    expect(RARE_EFFECTS).toContain(g!.power);
    // Some sozinha se ninguém pega.
    s = tickTo(s, at + 14);
    expect(s.run.objects.some((o) => o.kind === 'golden')).toBe(false);
  });

  it('uma só por vez e sempre a 5 min ou mais da anterior', () => {
    let s = tickObjects(open(), 0);
    const births: number[] = [];
    const seen = new Set<number>();
    for (let t = 1; t <= 6000; t++) {
      s = tickObjects(s, t);
      const golds = s.run.objects.filter((o) => o.kind === 'golden');
      expect(golds.length).toBeLessThanOrEqual(1);
      for (const g of golds) {
        if (!seen.has(g.id)) {
          seen.add(g.id);
          births.push(g.bornAt);
        }
      }
    }
    expect(births.length).toBeGreaterThanOrEqual(8);
    for (let i = 1; i < births.length; i++) expect(births[i]! - births[i - 1]!).toBeGreaterThanOrEqual(RARE_MIN_INTERVAL_SEC - 1);
  });

  it('não nasce com a escolha aberta nem sem objetos abertos', () => {
    const pending = { offers: ['moon', 'sirius', 'mars'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };
    expect(tickObjects(open({ pending, nextRareAt: 0 }), 5).run.objects).toHaveLength(0);
    const closed = { ...newSave('c', 0), tutorial: 'done' as const };
    expect(tickTo(closed, 2000).run.nextRareAt).toBeNull();
  });
});

describe('Estrela Dourada: efeitos', () => {
  const gold = (power: 'frenzy' | 'rain' | 'surge', s: SaveState = open()): SaveState => ({
    ...s,
    run: { ...s.run, objects: [{ id: 1, kind: 'golden', bornAt: 0, expiresAt: 50, power }], nextObjectId: 2 },
  });

  it('o Frenesi vale toque x7 por 30 s', () => {
    const p = objectPreview(open(), 'golden', 'frenzy');
    expect(p).toMatchObject({ boostMult: 7, boostSec: 30, frenzy: true, dust: 0 });
    const s = captureObject(gold('frenzy'), 1, 1);
    expect(s.run.boostMult).toBe(7);
    expect(s.run.boostUntil).toBe(31);
    expect(s.run.objects).toHaveLength(0);
    expect(s.stats.objectsCaptured).toBe(1);
  });

  it('o Surto liga os geradores cheios com o teto x3 por 45 s, mesmo parado', () => {
    const levels = open().run.upgradeLevels.map((_, i) => (i === upgradeIndex('satellite') ? 20 : 0));
    const base = open({ upgradeLevels: levels });
    const st = effectiveStats(base);
    // 20 Satélites: 4/s de potencial contra um teto de 0,875/s.
    const idle = syncClock(base, 2).run.dust;
    expect(idle).toBeCloseTo(st.autoDustCap * 2, 9);
    let s = captureObject(gold('surge', base), 1, 2);
    expect(s.run.surgeUntil).toBe(47);
    const before = s.run.dust;
    s = syncClock(s, 4);
    expect(s.run.dust - before).toBeCloseTo(Math.min(st.autoDustPerSec, st.autoDustCap * 3) * 2, 9);
    expect(s.run.dust - before).toBeGreaterThan(idle);
    // Depois dos 45 s volta ao normal.
    const after = syncClock({ ...s, run: { ...s.run, surgeUntil: 4 } }, 6);
    expect(after.run.dust - s.run.dust).toBeCloseTo(st.autoDustCap * 2, 9);
  });

  it('a Chuva entrega 5 min do ritmo normal, e a etiqueta mostra o mesmo valor', () => {
    const base = open();
    const st = effectiveStats(base);
    const p = objectPreview(base, 'golden', 'rain');
    expect(p.dust).toBe(Math.floor((st.dustPerTouch * 2.5 + Math.min(st.autoDustPerSec, st.autoDustCap)) * 300));
    const s = captureObject(gold('rain', base), 1, 1);
    // O 1 s até a captura também rende o gerador parado; a Chuva é o que sobra.
    const idle = syncClock(base, 1);
    expect(s.run.dust - idle.run.dust).toBe(p.dust);
    expect(s.run.dustLife - idle.run.dustLife).toBe(p.dust);
    expect(s.stats.dustTotal - idle.stats.dustTotal).toBe(p.dust);
  });

  it('o Surto mostra a duração na prévia', () => {
    expect(objectPreview(open(), 'golden', 'surge')).toMatchObject({ surgeSec: 45, boostMult: 0, frenzy: false });
    expect(objectPreview(open(), 'comet').surgeSec).toBe(0);
  });
});

describe('save com a Estrela Dourada', () => {
  it('guarda o objeto raro, o próximo raro e o surto, e confere o formato', () => {
    const base = open();
    const s = open({
      dustLife: 1000,
      nextRareAt: 400,
      surgeUntil: 30,
      objects: [{ id: 1, kind: 'golden', bornAt: 0, expiresAt: 10, power: 'rain' }],
      nextObjectId: 2,
    });
    s.stats = { ...base.stats, dustTotal: 1000, picks: 200 };
    const r = validateSave(JSON.parse(JSON.stringify(s)));
    expect(r.ok, r.ok ? '' : r.errors.join(';')).toBe(true);
    if (r.ok) {
      expect(r.save.run.nextRareAt).toBe(400);
      expect(r.save.run.surgeUntil).toBe(30);
      expect(r.save.run.objects[0]).toMatchObject({ kind: 'golden', power: 'rain' });
    }
  });

  it('um efeito inventado é recusado', () => {
    const s = open({ objects: [{ id: 1, kind: 'golden', bornAt: 0, expiresAt: 10, power: 'rain' }], nextObjectId: 2 });
    const bad = JSON.parse(JSON.stringify(s));
    bad.run.objects[0].power = 'infinite';
    expect(validateSave(bad).ok).toBe(false);
  });
});
