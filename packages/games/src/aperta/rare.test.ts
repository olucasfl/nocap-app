import { describe, expect, it } from 'vitest';
import { RARE_EFFECTS, upgradeIndex } from './catalog';
import { RARE_MIN_INTERVAL_SEC } from './economy';
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

const withBuild = (s: SaveState, build: Record<string, number>): SaveState => ({ ...s, run: { ...s.run, build } });

/** Passa o tempo em passos de 1 s (um salto maior que 5 s seria aba escondida). */
function tickTo(s: SaveState, to: number): SaveState {
  let state = s;
  for (let t = Math.floor(state.clock) + 1; t <= to; t++) state = tickObjects(state, t);
  return state;
}

describe('efeitos novos dos grimórios (spec 039, seção 7)', () => {
  it('os geradores de poeira e de energia rendem mais (multiplicador, não valor por toque)', () => {
    const base = open({ upgradeLevels: open().run.upgradeLevels.map((_, i) => (i === upgradeIndex('satellite') ? 10 : 0)) });
    const plain = effectiveStats(base).autoDustPerSec;
    expect(effectiveStats(withBuild(base, { hygiea: 1 })).autoDustPerSec).toBeCloseTo(plain * 1.06, 9);
    expect(effectiveStats(withBuild(base, { 'milky-way': 1 })).autoDustPerSec).toBeCloseTo(plain * 1.3, 9);
    const energy = open({ upgradeLevels: open().run.upgradeLevels.map((_, i) => (i === upgradeIndex('antenna') ? 10 : 0)) });
    const e0 = effectiveStats(energy).autoEnergyPerSec;
    expect(effectiveStats(withBuild(energy, { pallas: 1 })).autoEnergyPerSec).toBeCloseTo(e0 * 1.15, 9);
  });

  it('a janela do toque ativo e o ganho parado crescem, mas parado nunca passa de 50%', () => {
    const base = effectiveStats(open());
    expect(base.activeWindowSec).toBe(4);
    expect(base.idleFactor).toBe(0.25);
    expect(effectiveStats(withBuild(open(), { haumea: 1 })).activeWindowSec).toBe(6);
    expect(effectiveStats(withBuild(open(), { ganymede: 1 })).idleFactor).toBeCloseTo(0.35, 9);
    // Empilhar tudo não passa do teto.
    const stacked = effectiveStats(withBuild(open(), { ganymede: 10 }));
    expect(stacked.idleFactor).toBeLessThanOrEqual(0.5);
    expect(stacked.idleFactor).toBeLessThan(1);
  });

  it('os objetos comuns aparecem mais cedo, com piso, e a Estrela Dourada fica mais tempo', () => {
    const base = effectiveStats(open()).objects;
    expect([base.spawnMinSec, base.spawnMaxSec]).toEqual([60, 90]);
    const halley = effectiveStats(withBuild(open(), { halley: 1 })).objects;
    expect([halley.spawnMinSec, halley.spawnMaxSec]).toEqual([56, 86]);
    const floor = effectiveStats(withBuild(open(), { halley: 10, pluto: 10 })).objects;
    expect(floor.spawnMinSec).toBeGreaterThanOrEqual(30);
    expect(floor.spawnMaxSec).toBeGreaterThanOrEqual(45);
    expect(base.rareLifeSec).toBe(10);
    expect(effectiveStats(withBuild(open(), { 'proxima-centauri': 1 })).objects.rareLifeSec).toBe(15);
  });

  it('a Estrela Dourada nunca vem em menos de 5 min, por mais grimórios que ajudem', () => {
    const base = effectiveStats(open()).objects;
    expect([base.rareMinSec, base.rareMaxSec]).toEqual([360, 600]);
    const one = effectiveStats(withBuild(open(), { antares: 1 })).objects;
    expect([one.rareMinSec, one.rareMaxSec]).toEqual([315, 555]);
    const stacked = effectiveStats(withBuild(open(), { antares: 10 })).objects;
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
    const pending = { offers: ['moon', 'vesta', 'mars'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 };
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
    expect(idle).toBeCloseTo(st.autoDustCap * 0.25 * 2, 9);
    let s = captureObject(gold('surge', base), 1, 2);
    expect(s.run.surgeUntil).toBe(47);
    const before = s.run.dust;
    s = syncClock(s, 4);
    expect(s.run.dust - before).toBeCloseTo(Math.min(st.autoDustPerSec, st.autoDustCap * 3) * 2, 9);
    expect(s.run.dust - before).toBeGreaterThan(idle * 4);
    // Depois dos 45 s volta ao normal.
    const after = syncClock({ ...s, run: { ...s.run, surgeUntil: 4 } }, 6);
    expect(after.run.dust - s.run.dust).toBeCloseTo(st.autoDustCap * 0.25 * 2, 9);
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
