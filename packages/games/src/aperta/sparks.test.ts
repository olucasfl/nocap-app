// Cintilas (spec 040, etapa 16): as fontes da seção 5.1, a migração dos Fragmentos e o gasto na árvore.
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, achievementById } from './achievements';
import { GRIMOIRES, grimoireById } from './catalog';
import { FORBIDDEN } from './forbidden';
import { buyTreeNode, newSave, respecTree, type SaveState } from './engine';
import {
  ALBUM_SPARKS,
  COLLAPSES_PER_SPARK,
  RARE_CAPTURE_STEPS,
  RARE_FIRST_SPARKS,
  STAR_STEPS,
  dustMarks,
  sparkSources,
  sparksAvailable,
  sparksTotal,
  starSparks,
} from './sparks';
import { validateSave } from './save';

const base = (over: Partial<SaveState> = {}): SaveState => ({ ...newSave('sp', 1), tutorial: 'done', ...over });
const withStats = (s: SaveState, stats: Partial<SaveState['stats']>): SaveState => ({ ...s, stats: { ...s.stats, ...stats } });

describe('fonte: álbum (1ª descoberta)', () => {
  it('1 comum ou raro, 2 épico, 3 lendário, 4 proibido', () => {
    expect(ALBUM_SPARKS).toEqual({ common: 1, rare: 1, epic: 2, legendary: 3, forbidden: 4 });
    const pick = (rarity: string) => (rarity === 'forbidden' ? FORBIDDEN[0]!.id : GRIMOIRES.find((g) => g.rarity === rarity)!.id);
    for (const [rarity, value] of Object.entries(ALBUM_SPARKS)) {
      expect(sparkSources(base({ album: [pick(rarity)] })).album).toBe(value);
    }
  });

  it('descobrir de novo não paga de novo (o álbum é uma lista de ids únicos)', () => {
    const one = sparkSources(base({ album: ['moon'] })).album;
    expect(sparkSources(base({ album: ['moon', 'moon'] })).album).toBe(2 * one);
    // O motor nunca duplica: `chooseGrimoire` só acrescenta quem não está no álbum (conferido em engine.test).
    expect(new Set(GRIMOIRES.map((g) => g.id)).size).toBe(GRIMOIRES.length);
  });
});

describe('fonte: capturas raras', () => {
  it('a 1ª captura de cada raro rende 3 e os degraus 10, 50, 200 e 1.000 rendem 2, 3, 5 e 8', () => {
    expect(RARE_FIRST_SPARKS).toBe(3);
    expect(RARE_CAPTURE_STEPS.map((s) => [s.at, s.sparks])).toEqual([[10, 2], [50, 3], [200, 5], [1000, 8]]);
    expect(sparkSources(withStats(base(), { capturedKinds: ['golden'] })).rareFirst).toBe(3);
    expect(sparkSources(withStats(base(), { capturedKinds: ['golden', 'probe'] })).rareFirst).toBe(6);
    // Cometa (comum) não conta.
    expect(sparkSources(withStats(base(), { capturedKinds: ['comet'] })).rareFirst).toBe(0);
    const steps = (n: number) => sparkSources(withStats(base(), { raresCaptured: n })).rareSteps;
    expect([9, 10, 49, 50, 199, 200, 999, 1000, 5000].map(steps)).toEqual([0, 2, 2, 5, 5, 10, 10, 18, 18]);
  });
});

describe('fontes que repetem', () => {
  it('1 Cintila a cada 3 colapsos', () => {
    expect(COLLAPSES_PER_SPARK).toBe(3);
    expect([0, 2, 3, 5, 6, 25, 99].map((c) => sparkSources(base({ collapses: c })).collapseMarks)).toEqual([0, 0, 1, 1, 2, 8, 33]);
  });

  it('1 Cintila por marco de poeira total, cada um 1.000x o anterior (1e6, 1e9, 1e12...)', () => {
    expect([0, 9.9e5, 1e6, 1e9 - 1, 1e9, 1e12, 1e300].map(dustMarks)).toEqual([0, 0, 1, 1, 2, 3, 98]);
  });

  it('1 Cintila na 1ª vez que cada evento raro aparece', () => {
    expect(sparkSources(withStats(base(), { eventsSeen: ['meteor-shower'] })).eventFirst).toBe(1);
    expect(sparkSources(withStats(base(), { eventsSeen: ['meteor-shower', 'solar-storm'] })).eventFirst).toBe(2);
  });
});

describe('Estrela dos Proibidos (gancho pronto, ligado a proibidos que já existem)', () => {
  it('nível 3 rende 2, nível 5 rende 4, uma vez por proibido', () => {
    expect(STAR_STEPS).toEqual([{ level: 3, sparks: 2 }, { level: 5, sparks: 4 }]);
    expect(starSparks({ 'cygnus-x1': 2 })).toBe(0);
    expect(starSparks({ 'cygnus-x1': 3 })).toBe(2);
    expect(starSparks({ 'cygnus-x1': 5 })).toBe(6);
    expect(starSparks({ 'cygnus-x1': 5, m87: 3, 'sagittarius-a': 4 })).toBe(6 + 2 + 2);
    // Grimório que não é proibido nunca conta.
    expect(grimoireById('moon')?.rarity).not.toBe('forbidden');
    expect(starSparks({ moon: 5 })).toBe(0);
  });

  it('entra no saldo pelo `forbiddenBest` do save', () => {
    const s = withStats(base(), { forbiddenBest: { 'cygnus-x1': 5 } });
    expect(sparkSources(s).stars).toBe(6);
  });
});

describe('saldo', () => {
  it('é a soma das fontes mais o que veio dos Fragmentos, menos o gasto', () => {
    const s = base({ collapses: 6, album: ['moon'], sparks: { legacy: 10, spent: 4 }, achievements: ['tap-1'] });
    const src = sparkSources(s);
    expect(src.collapseMarks).toBe(2);
    expect(src.achievements).toBe(achievementById('tap-1')!.reward);
    expect(sparksTotal(s)).toBe(10 + src.total);
    expect(sparksAvailable(s)).toBe(10 + src.total - 4);
    expect(sparksAvailable({ ...s, sparks: { legacy: 0, spent: 99999 } })).toBe(0);
  });

  it('cada conquista ganha soma a recompensa dela e uma desconhecida não soma nada', () => {
    const all = base({ achievements: ACHIEVEMENTS.map((a) => a.id) });
    expect(sparkSources(all).achievements).toBe(ACHIEVEMENTS.reduce((n, a) => n + a.reward, 0));
    expect(sparkSources(base({ achievements: ['nao-existe'] })).achievements).toBe(0);
  });

  it('comprar na árvore gasta e refazer devolve 100%, mesmo sem nenhuma fonte', () => {
    let s = base({ collapses: 1, sparks: { legacy: 7, spent: 0 } });
    s = buyTreeNode(buyTreeNode(buyTreeNode(s, 'co-02'), 'co-05'), 'co-11');
    expect(s.sparks.spent).toBe(1 + 2 + 3);
    const back = respecTree(s);
    expect(back.sparks).toEqual({ legacy: 7, spent: 0 });
    expect(respecTree(back)).toBe(back);
  });
});

describe('migração dos Fragmentos para Cintilas', () => {
  const old = (fragments: { earned: number; spent: number }, collapses = 2): Record<string, unknown> => {
    const s = { ...base({ collapses, regionId: 'jupiter-saturn' }) } as unknown as Record<string, unknown>;
    (s.stats as { picks: number; dustTotal: number }).picks = 40;
    (s.stats as { dustTotal: number }).dustTotal = 3e8;
    delete s.sparks;
    s.fragments = fragments;
    return s;
  };

  it('saldo e gasto passam 1:1', () => {
    const r = validateSave(old({ earned: 9, spent: 3 }));
    expect(r.ok, r.ok ? '' : r.errors.join(' | ')).toBe(true);
    if (!r.ok) return;
    expect(r.save.sparks).toEqual({ legacy: 9, spent: 3 });
    expect((r.save as unknown as Record<string, unknown>).fragments).toBeUndefined();
    // O saldo de quem migrou nunca é menor que o de antes.
    expect(sparksAvailable(r.save)).toBeGreaterThanOrEqual(9 - 3);
  });

  it('a árvore antiga é descartada e o gasto dela volta', () => {
    const raw = old({ earned: 9, spent: 7 });
    raw.tree = { 'alpha-centauri': 3 };
    raw.version = 3;
    const r = validateSave(raw);
    expect(r.ok, r.ok ? '' : r.errors.join(' | ')).toBe(true);
    // A árvore antiga é descartada e o gasto volta como Cintilas livres (spec 040, etapa 17).
    if (r.ok) {
      expect(r.save.tree).toEqual({});
      expect(r.save.sparks.spent).toBe(0);
    }
  });

  it('um save já migrado (com `sparks`) não é tocado, e os dois campos juntos valem o novo', () => {
    const fresh = base({ sparks: { legacy: 0, spent: 0 } });
    const r = validateSave(fresh);
    expect(r.ok && r.save.sparks).toEqual({ legacy: 0, spent: 0 });
    const both = { ...(fresh as unknown as Record<string, unknown>), fragments: { earned: 50, spent: 50 } };
    const r2 = validateSave(both);
    expect(r2.ok && r2.save.sparks).toEqual({ legacy: 0, spent: 0 });
  });

  it('fragments inválidos continuam recusados', () => {
    expect(validateSave(old({ earned: -1, spent: 0 })).ok).toBe(false);
    expect(validateSave(old({ earned: 5, spent: 9 })).ok).toBe(false);
  });
});
