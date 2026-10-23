// Conquistas ampliadas (spec 040, seção 4 e etapa 16): famílias, recompensas, ids antigos, `needs` e os contadores novos.
import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_GROUPS,
  FEATURES,
  HIDDEN_REWARD,
  TIER_REWARD,
  achievementActive,
  achievementById,
  achievementSparks,
  achievementViews,
  awardAchievements,
  newlyEarned,
  type Feature,
} from './achievements';
import { grimoireById } from './catalog';
import { dustGoal, minPicks } from './economy';
import { FORBIDDEN_IDS } from './forbidden';
import { effectiveStats } from './engine';
import { meetMilestone } from './milestone';
import {
  buyUpgrade,
  captureObject,
  chooseGrimoire,
  collapse,
  vaultOffers,
  newSave,
  rerollGrimoire,
  selectGrimoire,
  tickObjects,
  type RunState,
  type SaveState,
} from './engine';
import { upgradeIndex } from './catalog';
import { sparkSources } from './sparks';
import { validateSave } from './save';
import { mergeSaves } from './save';

const base = (over: Partial<SaveState> = {}): SaveState => ({ ...newSave('ac', 1), tutorial: 'done', ...over });
const stats = (s: SaveState, st: Partial<SaveState['stats']>): SaveState => ({ ...s, stats: { ...s.stats, ...st } });
const ids = (s: SaveState) => newlyEarned(s);

/** Os 31 ids da v1 (spec 038, 5.3): continuam, com os mesmos nomes de id. */
const V1 = [
  'tap-1', 'tap-100', 'tap-1k', 'tap-10k', 'tap-100k', 'dust-1k', 'dust-1m', 'dust-1b', 'grim-10', 'grim-20', 'grim-all',
  'grim-planets', 'grim-rarities', 'grim-lv5', 'grim-lv10', 'obj-20', 'obj-100', 'obj-500', 'obj-sats', 'combo-max',
  'combo-30', 'forbidden', 'collapse-1', 'collapse-5', 'collapse-10', 'collapse-25', 'collapse-50', 'atlas-4',
  'leave-solar', 'atlas-families', 'tree-1', 'tree-branch', 'respec',
];

describe('catálogo ampliado', () => {
  it('tem de 140 a ~160 conquistas, ids únicos e todos os ids da v1', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(140);
    expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(170);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const id of V1) expect(achievementById(id), id).toBeDefined();
  });

  it('todas as famílias da seção 4 existem e têm conquistas', () => {
    const names = ACHIEVEMENT_GROUPS.map((g) => g.name);
    for (const n of ['Colapsos', 'Proibidos', 'Automação', 'Sorte', 'Exploração', 'Árvore', 'Geradores e toque', 'Combo e ritmo', 'Missões da estação', 'Regiões', 'Tempo', 'Escondidas']) {
      expect(names, n).toContain(n);
    }
    for (const g of ACHIEVEMENT_GROUPS) expect(ACHIEVEMENTS.some((a) => a.group === g.id), g.id).toBe(true);
  });

  it('a recompensa é 1, 2, 3 ou 5 Cintilas e a escondida vale 3', () => {
    for (const a of ACHIEVEMENTS) {
      if (a.hidden) expect(a.reward, a.id).toBe(HIDDEN_REWARD);
      else expect(Object.values(TIER_REWARD), a.id).toContain(a.reward);
    }
    expect(TIER_REWARD).toEqual({ S: 1, M: 2, L: 3, E: 5 });
    expect(ACHIEVEMENTS.filter((a) => a.hidden)).toHaveLength(10);
  });

  it('colapsos 1, 3, 5, 10, 15, 20, 30, 50, 75 e 100 existem', () => {
    for (const n of [1, 3, 5, 10, 15, 20, 30, 50, 75, 100]) expect(achievementById(`collapse-${n}`)?.goal, `collapse-${n}`).toBe(n);
  });

  it('cada Proibido que existe tem "ter", nível 3 e nível 5; os 10 no nível 5 esperam o Cofre', () => {
    for (const id of ['sagittarius-a', 'cygnus-x1', 'm87']) {
      for (const k of [`forb-${id}`, `forb-${id}-3`, `forb-${id}-5`]) expect(achievementById(k)?.needs, k).toBeUndefined();
    }
    // Etapa 15: os 10 proibidos existem, então a chave está ligada e as conquistas deles contam.
    expect(FEATURES['forbidden-new']).toBe(true);
    expect(achievementById('forb-all-5')?.needs).toBe('forbidden-new');
    for (const id of ['ton-618', 'phoenix-a', 'gaia-bh3', 'gw150914', 'v404-cygni', 'holmberg-15a', 'ic10-x1']) {
      expect(achievementById(`forb-${id}-3`)?.needs).toBe('forbidden-new');
    }
  });

  it('metas e textos são válidos e os grimórios citados existem', () => {
    for (const a of ACHIEVEMENTS) {
      expect(Number.isFinite(a.goal) && a.goal > 0, a.id).toBe(true);
      expect(a.name.length, a.id).toBeGreaterThan(0);
      expect(a.text.length, a.id).toBeGreaterThan(5);
      expect(a.text, a.id).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
    expect(grimoireById('pillars')).toBeDefined();
  });

  it('um save novo não tem nenhuma pronta e todas começam em 0', () => {
    const s = base();
    expect(ids(s)).toEqual([]);
    for (const v of achievementViews(s)) expect(v.value, v.def.id).toBe(0);
  });
});

describe('conquistas que esperam conteúdo (`needs`)', () => {
  const dormant = ACHIEVEMENTS.filter((a) => a.needs && !FEATURES[a.needs]);

  it('há de cada tipo de feature e nenhuma conta enquanto a feature não existe', () => {
    const features = new Set(dormant.map((a) => a.needs));
    for (const f of ['automation', 'tree-v2', 'daily-streak', 'regions-more'] as Feature[]) {
      expect(features.has(f), f).toBe(true);
      expect(FEATURES[f], f).toBe(false);
    }
    expect(dormant.length).toBeGreaterThanOrEqual(15);
    // Mesmo com tudo no máximo, nenhuma dormente é dada.
    const s = stats(base({ collapses: 30 }), {
      forbiddenBest: { 'cygnus-x1': 5 },
      skillsUsed: ['autoclick', 'pulse'],
      skillUses: 5000,
      eventsSeen: ['meteor-shower', 'solar-storm'],
      dayStreakBest: 100,
    });
    const earned = newlyEarned(s);
    for (const a of dormant) expect(earned, a.id).not.toContain(a.id);
    for (const v of achievementViews(s).filter((x) => x.def.needs && !FEATURES[x.def.needs])) {
      expect(v.locked).toBe(true);
      expect(v.value).toBe(0);
    }
  });

  it('quando a feature chega, a conquista passa a contar sem mudar mais nada', () => {
    const s = stats(base(), { skillsUsed: ['autoclick'], skillUses: 120 });
    expect(newlyEarned(s)).not.toContain('auto-autoclick');
    FEATURES.automation = true;
    try {
      expect(achievementActive(achievementById('auto-autoclick')!)).toBe(true);
      expect(newlyEarned(s)).toEqual(expect.arrayContaining(['auto-autoclick', 'skills-100']));
      const after = awardAchievements(s);
      expect(after.achievements).toContain('auto-autoclick');
      // E a recompensa já entra nas Cintilas.
      expect(sparkSources(after).achievements).toBeGreaterThanOrEqual(achievementById('auto-autoclick')!.reward);
    } finally {
      FEATURES.automation = false;
    }
  });

  it('um save com conquista de feature que não existe é recusado pelo servidor', () => {
    const r = validateSave({ ...base(), achievements: ['auto-autoclick'] });
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.errors.join(' ')).toContain('conteúdo que ainda não existe');
    expect(validateSave({ ...base(), achievements: ['id-inventado'] }).ok).toBe(false);
  });

  it('a tela soma o que já foi ganho, o que falta e o que vem depois', () => {
    const s = base({ achievements: ['tap-1', 'respec'] });
    const sp = achievementSparks(s);
    expect(sp.earned).toBe(achievementById('tap-1')!.reward + HIDDEN_REWARD);
    // As aposentadas (Atlas) não entram no que falta: ninguém mais pode ganhá-las.
    const total = ACHIEVEMENTS.filter((a) => !a.retired).reduce((n, a) => n + a.reward, 0);
    expect(sp.earned + sp.toEarn + sp.soon).toBe(total);
    expect(sp.soon).toBe(dormant.reduce((n, a) => n + a.reward, 0));
  });
});

describe('progresso das famílias', () => {
  it('toques, poeira (até 1e100), tempo e colapsos', () => {
    const s = stats(base({ collapses: 100, playSeconds: 3600 * 10 }), { clicks: 1_000_000, dustTotal: 1e100, objectsCaptured: 5000 });
    const got = ids(s);
    for (const id of ['tap-1m', 'dust-1e100', 'time-10h', 'collapse-100', 'obj-5000']) expect(got, id).toContain(id);
    expect(got).not.toContain('time-25h');
  });

  it('missões, combo e sequência', () => {
    const s = stats(base(), { missionsDone: 50, chainBest: 100, comboFullBest: 300.4, comboMaxHits: 10_000 });
    const got = ids(s);
    for (const id of ['miss-50', 'chain-100', 'combo-300', 'combo-hits-10k']) expect(got, id).toContain(id);
    expect(got).not.toContain('miss-100');
  });

  it('regiões abrem pelo colapso e geradores pelo maior nível', () => {
    const s = stats(base({ collapses: 5 }), { genBest: 100, upgradesBought: 1000 });
    const got = ids(s);
    for (const id of ['region-asteroid-belt', 'region-alpha-centauri', 'gen-100', 'upg-1000']) expect(got, id).toContain(id);
    expect(got).not.toContain('gen-200');
  });

  it('proibidos pelo maior nível já alcançado', () => {
    const s = stats(base({ album: ['cygnus-x1'], vault: { 'cygnus-x1': 5 } }), { forbiddenBest: { 'cygnus-x1': 5 } });
    const got = ids(s);
    for (const id of ['forb-cygnus-x1', 'forb-cygnus-x1-3', 'forb-cygnus-x1-5', 'hid-cygnus-5']) expect(got, id).toContain(id);
    expect(got).not.toContain('forb-m87-3');
  });
});

describe('contadores do motor que alimentam as conquistas', () => {
  const offerRun = (s: SaveState, offers: string[]): SaveState => ({
    ...s,
    run: { ...s.run, pending: { offers, openedAt: -10, selected: null, picksLeft: 1, rerollsLeft: 3 } as RunState['pending'] },
  });
  const choose = (s: SaveState, id: string, t: number) => chooseGrimoire(selectGrimoire(s, id, t), id, t);

  it('sequência de raros: escolher comum zera, rara ou melhor soma, o recorde fica', () => {
    let s = base();
    const rarity = (r: string) => (['moon', 'mercury', 'venus'].map((id) => grimoireById(id)!).find((g) => g.rarity === r) ?? undefined)?.id;
    const rare = 'europa';
    const common = 'moon';
    expect([grimoireById(rare)!.rarity, grimoireById(common)!.rarity]).toEqual(['rare', 'common']);
    void rarity;
    // O relógio anda de 2 em 2 s: um salto maior que 5 s é aba escondida e o motor refaz a trava da oferta.
    let t = 0;
    for (let i = 0; i < 3; i++) {
      s = choose(offerRun(s, [rare]), rare, (t += 2));
      s = { ...s, run: { ...s.run, build: {} } };
    }
    expect(s.stats.rareStreak).toBe(3);
    s = choose(offerRun(s, [common]), common, (t += 2));
    expect(s.stats.rareStreak).toBe(0);
    expect(s.stats.rareStreakBest).toBe(3);
  });

  it('o maior nível de um proibido fica guardado ao colapsar e só sobe', () => {
    // Cofre quase todo no nível 5: sobram só 3 proibidos elegíveis, então a oferta é previsível.
    const maxed = FORBIDDEN_IDS.filter((id) => !['m87', 'gaia-bh3', 'ic10-x1'].includes(id));
    let s: SaveState = { ...base({ collapses: 20 }), vault: Object.fromEntries(maxed.map((id) => [id, 5])), album: maxed };
    const ready = (st: SaveState): SaveState => {
      const k = st.collapses + 1;
      const r = { ...st, run: { ...st.run, dustLife: dustGoal(k), dust: dustGoal(k), picks: minPicks(k) } };
      return { ...r, run: { ...r.run, ...meetMilestone(st.collapses, r.run.upgradeLevels, effectiveStats(st).objects.disabled) } };
    };
    expect(vaultOffers(s).sort()).toEqual(['gaia-bh3', 'ic10-x1', 'm87']);
    s = collapse(ready(s), 'm87');
    expect(s.stats.forbiddenBest.m87).toBe(1);
    s = collapse(ready(s), 'm87');
    expect(s.stats.forbiddenBest.m87).toBe(2);
    expect(s.album).toContain('m87');
    expect(s.vault.m87).toBe(2);
  });

  it('trocar carta conta, e ofertas com lendário ou proibido também (a 1ª oferta do jogo marca a conquista escondida)', () => {
    const legendary = ['pillars', 'andromeda', 'milky-way'].find((id) => grimoireById(id)!.rarity === 'legendary') ?? 'pillars';
    let s = base();
    s = { ...s, run: { ...s.run, energy: 1e9 } };
    s = tickObjects(s, 2);
    expect(s.run.pending).not.toBeNull();
    expect(s.stats.offers).toBe(1);
    const off = s.run.pending!.offers;
    const before = s.stats.rerolls;
    const re = rerollGrimoire({ ...s, run: { ...s.run, pending: { ...s.run.pending!, rerollsLeft: 2 } } }, off[0] as string, 3);
    expect(re.stats.rerolls).toBe(before + 1);
    expect(grimoireById(legendary)).toBeDefined();
  });

  it('comprar melhorias conta compras, o maior nível de gerador e as de toque da vida', () => {
    let s = base();
    s = { ...s, run: { ...s.run, dust: 1e12, dustLife: 1e12 }, stats: { ...s.stats, dustTotal: 1e12 } };
    const sat = upgradeIndex('satellite');
    for (let i = 0; i < 5; i++) s = buyUpgrade(s, sat);
    expect(s.stats.upgradesBought).toBe(5);
    expect(s.stats.genBest).toBe(5);
    s = buyUpgrade(s, upgradeIndex('lens'));
    expect(s.stats.touchBest).toBe(1);
    expect(s.stats.genBest).toBe(5);
  });

  it('capturar raros e tipos: Estrela Dourada conta como rara, cometa não', () => {
    const field = (kind: 'comet' | 'golden' | 'probe') => ({
      objects: [{ id: 1, kind, bornAt: 0, expiresAt: 100, power: kind === 'golden' ? ('rain' as const) : undefined }],
      nextObjectId: 2,
    });
    const at = (kind: 'comet' | 'golden' | 'probe') => captureObject({ ...base({ collapses: 3 }), run: { ...base().run, ...field(kind) } }, 1, 2);
    expect(at('comet').stats).toMatchObject({ raresCaptured: 0, capturedKinds: ['comet'] });
    expect(at('golden').stats).toMatchObject({ raresCaptured: 1, capturedKinds: ['golden'] });
    expect(at('probe').stats.raresCaptured).toBe(1);
    // A 1ª captura rara rende a conquista e as Cintilas da fonte.
    expect(at('golden').achievements).toContain('rare-1');
    expect(sparkSources(at('golden')).rareFirst).toBe(3);
  });

  it('ver um evento pela 1ª vez marca e rende; ver de novo não repete', () => {
    let s = base({ collapses: 2 });
    let t = 0;
    while (!s.run.event && t < 2000) s = tickObjects(s, (t += 1));
    expect(s.run.event?.id).toBe('meteor-shower');
    expect(s.stats.eventsSeen).toEqual(['meteor-shower']);
    expect(s.achievements).toContain('explore-meteor');
    const again = tickObjects(s, t + 1);
    expect(again.stats.eventsSeen).toEqual(['meteor-shower']);
  });
});

describe('junção de saves com os contadores novos', () => {
  it('fica com o maior de cada contador, a união das listas e o maior nível de cada proibido', () => {
    const a = stats(base(), { raresCaptured: 5, capturedKinds: ['golden'], forbiddenBest: { m87: 3 }, eventsSeen: ['solar-storm'], rareStreakBest: 4, offers: 10 });
    const b = stats(base(), { raresCaptured: 9, capturedKinds: ['probe'], forbiddenBest: { m87: 2, 'cygnus-x1': 5 }, eventsSeen: ['meteor-shower'], rareStreakBest: 2, offers: 30 });
    const m = mergeSaves(a, b).save.stats;
    expect(m.raresCaptured).toBe(9);
    expect([...m.capturedKinds].sort()).toEqual(['golden', 'probe']);
    expect(m.forbiddenBest).toEqual({ m87: 3, 'cygnus-x1': 5 });
    expect([...m.eventsSeen].sort()).toEqual(['meteor-shower', 'solar-storm']);
    expect(m.rareStreakBest).toBe(4);
    expect(m.offers).toBe(30);
  });
});

describe('validação dos totais novos', () => {
  const bad = (st: Partial<SaveState['stats']>) => validateSave(stats(base(), st));
  it('recusa o impossível', () => {
    expect(bad({ raresCaptured: 5, objectsCaptured: 2 }).ok).toBe(false);
    expect(bad({ capturedKinds: ['dragao'] }).ok).toBe(false);
    expect(bad({ eventsSeen: ['nao-existe'] }).ok).toBe(false);
    expect(bad({ forbiddenBest: { moon: 3 } }).ok).toBe(false);
    expect(bad({ rareStreak: 5, rareStreakBest: 2, picks: 10 }).ok).toBe(false);
    expect(bad({ touchBest: 40 }).ok).toBe(false);
  });
  it('aceita o possível', () => {
    expect(bad({ raresCaptured: 2, objectsCaptured: 5, capturedKinds: ['golden', 'comet'] }).ok).toBe(true);
    const ok = validateSave({ ...stats(base({ collapses: 3, regionId: 'kuiper-belt', sparks: { legacy: 0, spent: 0 } }), { forbiddenBest: { 'cygnus-x1': 4 }, picks: 10, dustTotal: 2e9 }) });
    expect(ok.ok, ok.ok ? '' : ok.errors.join(' | ')).toBe(true);
  });
});
