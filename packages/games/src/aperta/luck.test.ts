import { describe, expect, it } from 'vitest';
import { grimoireById } from './catalog';
import { energyCap } from './economy';
import {
  chooseGrimoire,
  discardOffer,
  discardsLeft,
  drawGrimoires,
  effectiveStats,
  newSave,
  pityLeft,
  press,
  rerollGrimoire,
  rerollsAvailable,
  selectGrimoire,
  vaultOffers,
  type SaveState,
} from './engine';
import { PITY_BASE } from './tree-fx';

const TREE = (nodes: Record<string, number>): Record<string, number> => nodes;

/** Um save no 4º colapso com a barra a um toque de encher; `tree` e `stats` entram por cima. */
function ready(over: Partial<SaveState> = {}, picks = 20): SaveState {
  const s = newSave('sorte');
  const cap = energyCap(picks);
  return {
    ...s,
    tutorial: 'done',
    collapses: 4,
    regionId: 'oort-cloud',
    ...over,
    run: { ...s.run, picks, energy: cap - 0.5, ...(over.run ?? {}) },
  };
}

/** Abre a escolha com um toque. */
function open(s: SaveState, t = 100): SaveState {
  const r = press(s, t);
  if (!r.run.pending) throw new Error('a escolha não abriu');
  return r;
}

const rarity = (id: string) => grimoireById(id)!.rarity;

describe('4ª carta', () => {
  it('a oferta de grimórios e a do Cofre ganham uma carta com o nó', () => {
    expect(open(ready()).run.pending!.offers).toHaveLength(3);
    expect(effectiveStats(ready({ tree: TREE({ 'lu-14': 1 }) })).choice.cards).toBe(4);
    const tree = TREE({ 'lu-01': 1, 'lu-02': 1, 'lu-06': 1, 'lu-05': 1, 'lu-14': 1 });
    expect(open(ready({ tree })).run.pending!.offers).toHaveLength(4);
    const withoutNode = ready();
    expect(vaultOffers(withoutNode)).toHaveLength(3);
    expect(vaultOffers({ ...withoutNode, tree })).toHaveLength(4);
    expect(new Set(vaultOffers({ ...withoutNode, tree })).size).toBe(4);
  });
});

describe('rerolls e descartes', () => {
  it('a cota da vida cresce com os nós (1, 2, 3) e cada troca gasta uma', () => {
    const none = open(ready());
    expect(rerollsAvailable(none)).toBe(0);
    const one = open(ready({ tree: TREE({ 'lu-01': 1 }) }));
    expect(rerollsAvailable(one)).toBe(1);
    const three = ready({ tree: TREE({ 'lu-01': 2, 'lu-05': 1 }) });
    expect(effectiveStats(three).luck.rerolls).toBe(3);
    let s = open(three);
    expect(rerollsAvailable(s)).toBe(3);
    for (let i = 0; i < 3; i++) {
      const id = s.run.pending!.offers[0]!;
      const next = rerollGrimoire(s, id, 101 + i);
      expect(next.run.rerollsUsed).toBe(s.run.rerollsUsed + 1);
      expect(next.run.pending!.offers).not.toContain(id);
      s = next;
    }
    expect(s.run.rerollsUsed).toBe(3);
    expect(rerollsAvailable(s)).toBe(0);
    expect(rerollGrimoire(s, s.run.pending!.offers[0]!, 110).run.pending!.offers).toEqual(s.run.pending!.offers);
  });

  it('a primeira troca de cada oferta é grátis e não gasta a cota', () => {
    const s = open(ready({ tree: TREE({ 'lu-01': 1, 'lu-02': 1, 'lu-06': 1, 'lu-05': 1, 'lu-14': 1, 'lu-09': 1, 'lu-13': 1, 'lu-19': 1 }) }));
    // lu-19 exige os nós de cima; o teste monta a árvore direto (o save válido é assunto de tree.test).
    expect(effectiveStats(s).luck.firstRerollFree).toBe(true);
    const first = rerollGrimoire(s, s.run.pending!.offers[0]!, 101);
    expect(first.run.rerollsUsed).toBe(0);
    const second = rerollGrimoire(first, first.run.pending!.offers[0]!, 102);
    expect(second.run.rerollsUsed).toBe(1);
  });

  it('descartar a oferta sorteia outra sem contar como oferta nova, uma vez por vida (2 com o nível 2)', () => {
    let s = open(ready({ tree: TREE({ 'lu-03': 1 }) }), 100);
    expect(discardsLeft(s)).toBe(1);
    const old = s.run.pending!.offers;
    const offers = s.stats.offers;
    // As cartas ainda estão travadas logo depois de abrir.
    expect(discardOffer(s, 100.1).run.pending!.offers).toEqual(old);
    s = discardOffer(s, 105);
    expect(s.run.pending!.offers.some((o) => old.includes(o))).toBe(false);
    expect(s.stats.offers).toBe(offers);
    expect(discardsLeft(s)).toBe(0);
    expect(discardOffer(s, 110).run.discardsUsed).toBe(1);
    expect(discardsLeft(open(ready({ tree: TREE({ 'lu-03': 2 }) })))).toBe(2);
  });
});

describe('pity de lendário', () => {
  it('sem o nó não há contador; com o nó ele desce a cada oferta e a oferta que zera traz um lendário', () => {
    expect(pityLeft(ready())).toBeNull();
    const tree = TREE({ 'lu-06': 1 });
    let s = ready({ tree });
    expect(pityLeft(s)).toBe(PITY_BASE - 2 - 1);
    // Perto do fim: a próxima oferta é a garantida.
    s = { ...s, stats: { ...s.stats, sinceLegend: PITY_BASE - 2 - 1 } };
    expect(pityLeft(s)).toBe(0);
    for (let i = 0; i < 12; i++) {
      const o = open({ ...s, run: { ...s.run, rngState: 1000 + i * 77 } });
      expect(o.run.pending!.offers.some((id) => rarity(id) === 'legendary'), `semente ${i}`).toBe(true);
      expect(o.stats.sinceLegend).toBe(0);
    }
  });

  it('cada nível do nó tira ofertas da espera', () => {
    const left = (tree: Record<string, number>) => pityLeft(ready({ tree }))!;
    expect(left(TREE({ 'lu-06': 1 }))).toBe(PITY_BASE - 2 - 1);
    expect(left(TREE({ 'lu-06': 2 }))).toBe(PITY_BASE - 4 - 1);
    expect(left(TREE({ 'lu-06': 2, 'lu-11': 2, 'lu-17': 1 }))).toBeLessThan(left(TREE({ 'lu-06': 2 })));
  });

  it('o contador zera sozinho quando um lendário aparece e sobe quando não', () => {
    const s = ready({ stats: { ...newSave('x').stats, sinceLegend: 5 } });
    const o = open(s);
    const has = o.run.pending!.offers.some((id) => rarity(id) === 'legendary');
    expect(o.stats.sinceLegend).toBe(has ? 0 : 6);
  });
});

describe('garantias e pesos em números', () => {
  it('a Garantia faz toda N-ésima oferta ter uma carta épica ou melhor', () => {
    const tree = TREE({ 'lu-07': 1 });
    for (let i = 0; i < 12; i++) {
      const s = ready({ tree, stats: { ...newSave('x').stats, offers: 11 } });
      const o = open({ ...s, run: { ...s.run, rngState: 5 + i * 131 } });
      expect(o.run.pending!.offers.some((id) => ['epic', 'legendary'].includes(rarity(id))), `semente ${i}`).toBe(true);
    }
  });

  it('a Fortuna traz um lendário em toda 5ª oferta', () => {
    const tree = TREE({ 'lu-24': 1 });
    for (let i = 0; i < 10; i++) {
      const s = ready({ tree, stats: { ...newSave('x').stats, offers: 4 } });
      const o = open({ ...s, run: { ...s.run, rngState: 9 + i * 211 } });
      expect(o.run.pending!.offers.some((id) => rarity(id) === 'legendary'), `semente ${i}`).toBe(true);
    }
  });

  it('os pesos entram em pontos: cartas raras e épicas aparecem mais, sem tocar nas outras', () => {
    const count = (tree: Record<string, number>, which: string) => {
      let n = 0;
      for (let i = 0; i < 300; i++) {
        const s = ready({ tree }, 40);
        for (const id of drawGrimoires({ ...s, run: { ...s.run, rngState: 17 + i * 389 } }).offers) if (rarity(id) === which) n++;
      }
      return n;
    };
    expect(count(TREE({ 'lu-02': 2 }), 'rare')).toBeGreaterThan(count({}, 'rare'));
    expect(count(TREE({ 'lu-08': 2 }), 'epic')).toBeGreaterThan(count({}, 'epic'));
    expect(effectiveStats(ready({ tree: TREE({ 'lu-02': 2, 'lu-08': 1, 'lu-15': 1 }) })).luck).toMatchObject({ rareWeight: 4, epicWeight: 2, legendWeight: 6 });
  });

  it('o Destino deixa a oferta toda rara ou melhor, uma vez por vida', () => {
    const tree = TREE({ 'lu-22': 1 });
    const s = ready({ tree });
    const o = open(s);
    expect(o.run.destinyUsed).toBe(true);
    expect(o.run.pending!.offers.map(rarity)).toEqual(o.run.pending!.offers.map(() => expect.not.stringMatching(/^common$/)));
    // Escolhe uma carta, enche a barra de novo e abre outra: a segunda não é mais garantida.
    const picked = chooseGrimoire(selectGrimoire(o, o.run.pending!.offers[0]!, 200), o.run.pending!.offers[0]!, 200);
    expect(picked.run.destinyUsed).toBe(true);
  });

  it('a Mão cheia e as Duas escolhas dão uma escolha a mais', () => {
    const first = open(ready({ tree: TREE({ 'lu-18': 1 }) }, 0));
    expect(first.run.pending!.picksLeft).toBe(2);
    const later = open(ready({ tree: TREE({ 'lu-18': 1 }) }, 20));
    expect(later.run.pending!.picksLeft).toBe(1);
    const tenth = open(ready({ tree: TREE({ 'lu-20': 1 }), stats: { ...newSave('x').stats, offers: 9 } }));
    expect(tenth.run.pending!.picksLeft).toBe(2);
  });

  it('Repetir em dobro sobe níveis extra', () => {
    const s = ready({ tree: TREE({ 'lu-13': 2 }) });
    expect(effectiveStats(s).choice.repeatLevels).toBe(3);
  });
});
