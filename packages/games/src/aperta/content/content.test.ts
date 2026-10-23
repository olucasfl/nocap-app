import { describe, expect, it } from 'vitest';
import { GRIMOIRES, OBJECTS, REGIONS, UPGRADES } from '../catalog';
import { EVENT_DURATION_SEC, EVENT_INTERVAL_SEC, dustGoal, minPicks } from '../economy';
import {
  activeEventId,
  captureObject,
  chooseGrimoire,
  collapse,
  drawGrimoires,
  newSave,
  press,
  selectGrimoire,
  setFavorite,
  setRegion,
  syncClock,
  tickObjects,
  unlockedContent,
  type RunState,
  type SaveState,
} from '../engine';
import { validateSave } from '../save';
import { meetMilestone } from '../milestone';
import {
  COLLAPSE_CONTENT,
  EVENT_NAMES,
  LAST_CONTENT_COLLAPSE,
  MECHANIC_NAMES,
  MISSIONS,
  eventsOpen,
  mechanicOpen,
  missionById,
  newContentAt,
} from './index';

/** Um save no colapso `k`, coerente o bastante para o `validateSave` (sem ter jogado as vidas). */
function atCollapse(k: number, patch: Partial<SaveState> = {}): SaveState {
  const s = newSave('conteudo', 1);
  const region = [...REGIONS].reverse().find((r) => r.unlockedAtCollapse <= k) ?? REGIONS[0];
  let dustTotal = 0;
  for (let j = 1; j <= k; j++) {
    dustTotal += dustGoal(j);
  }
  return {
    ...s,
    collapses: k,
    tutorial: 'done',
    regionId: (region as (typeof REGIONS)[number]).id,
    sparks: { legacy: 0, spent: 0 },
    stats: { ...s.stats, picks: k, dustTotal },
    ...patch,
  };
}

/** O mesmo save com a vida alterada. */
function run(s: SaveState, patch: Partial<RunState>): SaveState {
  return { ...s, run: { ...s.run, ...patch } };
}

const sorted = (list: readonly string[]) => [...list].sort();

describe('tabela de conteúdo por colapso (spec 5.4)', () => {
  it('cobre os colapsos 0 a 5 (v1)', () => {
    expect(COLLAPSE_CONTENT).toHaveLength(6);
    expect(LAST_CONTENT_COLLAPSE).toBe(5);
  });

  it.each([0, 1, 2, 3, 4, 5])('o colapso %i destrava exatamente a linha da tabela', (k) => {
    const row = COLLAPSE_CONTENT[k]!;
    expect(sorted(GRIMOIRES.filter((d) => d.unlockedAtCollapse === k).map((d) => d.id))).toEqual(sorted(row.grimoires));
    expect(sorted(UPGRADES.filter((d) => d.unlockedAtCollapse === k).map((d) => d.id))).toEqual(sorted(row.upgrades));
    expect(sorted(OBJECTS.filter((d) => d.unlockedAtCollapse === k).map((d) => d.kind))).toEqual(sorted(row.objects));
    expect(REGIONS.filter((d) => d.unlockedAtCollapse === k).map((d) => d.id)).toEqual([row.region]);
  });

  it('nada no catálogo fica de fora da tabela nem fala de colapso além do 5', () => {
    for (const list of [GRIMOIRES, UPGRADES, OBJECTS, REGIONS] as readonly (readonly { unlockedAtCollapse: number }[])[]) {
      for (const d of list) expect(d.unlockedAtCollapse).toBeLessThanOrEqual(LAST_CONTENT_COLLAPSE);
    }
    const inTable = COLLAPSE_CONTENT.flatMap((r) => r.grimoires);
    expect(new Set(inTable).size).toBe(inTable.length);
    expect(sorted(inTable)).toEqual(sorted(GRIMOIRES.map((g) => g.id)));
  });

  it('os totais do lançamento batem: 55 grimórios comuns (os 10 proibidos moram no Cofre), 6 regiões, 5 objetos, 42 melhorias, 2 eventos', () => {
    expect(GRIMOIRES).toHaveLength(55);
    expect(REGIONS).toHaveLength(6);
    expect(OBJECTS).toHaveLength(5);
    expect(UPGRADES).toHaveLength(42);
    expect(COLLAPSE_CONTENT.flatMap((r) => r.events)).toHaveLength(2);
    // As mecânicas novas da v1; o Combo já existe desde o início.
    expect(COLLAPSE_CONTENT.flatMap((r) => r.mechanics)).toEqual(['favorite', 'missions']);
  });

  it('cada colapso novo traz 4 ou 5 grimórios comuns e uma região', () => {
    expect(COLLAPSE_CONTENT.slice(1).map((r) => r.grimoires.length)).toEqual([4, 4, 4, 4, 5]);
    expect(COLLAPSE_CONTENT.slice(1).every((r) => r.region)).toBe(true);
  });

  it('unlockedContent acompanha o colapso do save, sem sobras', () => {
    for (let k = 0; k <= 5; k++) {
      const open = unlockedContent(atCollapse(k));
      const expected = COLLAPSE_CONTENT.slice(0, k + 1);
      expect(sorted(open.grimoires.map((g) => g.id))).toEqual(sorted(expected.flatMap((r) => r.grimoires)));
      expect(sorted(open.upgrades.map((u) => u.id))).toEqual(sorted(expected.flatMap((r) => r.upgrades)));
      expect(sorted(open.objects.map((o) => o.kind))).toEqual(sorted(expected.flatMap((r) => r.objects)));
      expect(open.regions.map((r) => r.id)).toEqual(expected.map((r) => r.region));
    }
  });

  it('a faixa "Novo no espaço" lista a região primeiro e tudo da linha', () => {
    expect(newContentAt(0).map((i) => i.id)).toContain('inner-solar-system');
    const two = newContentAt(2);
    expect(two[0]).toMatchObject({ kind: 'region', id: 'jupiter-saturn' });
    expect(two.map((i) => i.name)).toEqual(
      expect.arrayContaining(['Calisto', 'Encélado', 'Sonda Voyager', MECHANIC_NAMES.favorite, EVENT_NAMES['meteor-shower']]),
    );
    expect(newContentAt(4).map((i) => i.name)).toEqual(
      expect.arrayContaining(['Sedna', 'Hale-Bopp', MECHANIC_NAMES.missions, EVENT_NAMES['solar-storm']]),
    );
    expect(newContentAt(99)).toEqual([]);
  });

  it('as mecânicas e os eventos abrem só no colapso da tabela', () => {
    expect(mechanicOpen('favorite', 1)).toBe(false);
    expect(mechanicOpen('favorite', 2)).toBe(true);
    expect(mechanicOpen('missions', 3)).toBe(false);
    expect(mechanicOpen('missions', 4)).toBe(true);
    expect(eventsOpen(1)).toEqual([]);
    expect(eventsOpen(2)).toEqual(['meteor-shower']);
    expect(eventsOpen(5)).toEqual(['meteor-shower', 'solar-storm']);
  });
});

describe('sorteio e objetos respeitam o colapso', () => {
  it('um grimório de colapso futuro nunca é oferecido', () => {
    const s = run(atCollapse(1), { picks: 40 });
    const allowed = new Set(unlockedContent(s).grimoires.map((g) => g.id));
    for (let i = 0; i < 40; i++) {
      for (const id of drawGrimoires(run(s, { rngState: i * 7919 })).offers) expect(allowed.has(id)).toBe(true);
    }
  });

  it('o Asteroide só nasce a partir do colapso 1 e a Sonda a partir do 2', () => {
    const kinds = (k: number) => {
      const seen = new Set<string>();
      for (let seed = 0; seed < 20; seed++) {
        let s = run(atCollapse(k), { rngState: seed * 104729 });
        // Passos de 1 s: um salto maior que 5 s conta como aba escondida e congela o campo.
        for (let t = 1; t < 300; t += 1) {
          s = tickObjects(s, t);
          for (const o of s.run.objects) seen.add(o.kind);
          s = run(s, { objects: [] });
        }
      }
      return seen;
    };
    expect(kinds(0).has('asteroid')).toBe(false);
    expect(kinds(1).has('asteroid')).toBe(true);
    expect(kinds(1).has('probe')).toBe(false);
    expect(kinds(2).has('probe')).toBe(true);
  });
});

describe('Favorito (colapso 2)', () => {
  const withAlbum = (k: number) => atCollapse(k, { album: ['moon', 'mars', 'callisto'] });

  it('só abre no colapso 2 e só marca grimório descoberto e liberado', () => {
    expect(setFavorite(withAlbum(1), 'moon').favorite).toBeNull();
    const s = withAlbum(2);
    expect(setFavorite(s, 'moon').favorite).toBe('moon');
    expect(setFavorite(s, 'venus').favorite).toBeNull();
    expect(setFavorite(s, 'sedna').favorite).toBeNull();
    expect(setFavorite(setFavorite(s, 'moon'), null).favorite).toBeNull();
  });

  it('pesa o dobro dentro da raridade', () => {
    const s = run(withAlbum(2), { picks: 1 });
    const count = (fav: string | null) => {
      let hits = 0;
      for (let i = 0; i < 3000; i++) {
        const r = drawGrimoires({ ...run(s, { rngState: Math.imul(i + 1, 2654435761) }), favorite: fav }, [], 1);
        if (r.offers[0] === 'moon') hits++;
      }
      return hits;
    };
    const ratio = count('moon') / count(null);
    expect(ratio).toBeGreaterThan(1.6);
    expect(ratio).toBeLessThan(2.4);
  });

  it('o favorito de um save abaixo do colapso 2 não pesa', () => {
    const s = { ...atCollapse(1, { album: ['moon'] }), favorite: 'moon' };
    expect(drawGrimoires(s, [], 3).offers).toEqual(drawGrimoires({ ...s, favorite: null }, [], 3).offers);
  });
});

describe('regiões (menu)', () => {
  it('rever uma região aberta não custa nada; uma fechada é recusada', () => {
    const s = atCollapse(3);
    expect(s.regionId).toBe('kuiper-belt');
    expect(setRegion(s, 'asteroid-belt').regionId).toBe('asteroid-belt');
    expect(setRegion(s, 'alpha-centauri')).toBe(s);
    expect(setRegion(s, 'nao-existe')).toBe(s);
    expect(setRegion(s, 'kuiper-belt')).toBe(s);
  });

  it('colapsar leva à região nova, mesmo se o jogador estava vendo uma antiga', () => {
    const s = run(atCollapse(0, { album: ['moon'] }), { dustLife: dustGoal(1), picks: minPicks(1), build: { moon: 1 }, ...meetMilestone(0, []) });
    const next = collapse(setRegion({ ...s, collapses: 0 }, 'inner-solar-system'));
    expect(next.collapses).toBe(1);
    expect(next.regionId).toBe('asteroid-belt');
  });
});

describe('Chuva de meteoros e Tempestade solar', () => {
  /** Avança o campo de 1 em 1 s até o evento `id` começar. */
  function runUntilEvent(s0: SaveState, id: 'meteor-shower' | 'solar-storm') {
    let s = s0;
    for (let t = 1; t < EVENT_INTERVAL_SEC * 2; t += 1) {
      s = tickObjects(s, t);
      if (activeEventId(s, t) === id) return { s, t };
      s = run(s, { objects: [] });
    }
    throw new Error('o evento não começou');
  }

  it('não acontece antes do colapso que o abre', () => {
    let s = atCollapse(1);
    for (let t = 1; t < EVENT_INTERVAL_SEC * 3; t += 1) s = tickObjects(s, t);
    expect(s.run.event).toBeNull();
    expect(s.run.nextEventAt).toBeNull();
  });

  it('começa em ~8 min (±25%), dura 15 s e marca o próximo', () => {
    const { s, t } = runUntilEvent(atCollapse(2), 'meteor-shower');
    expect(t).toBeGreaterThanOrEqual(EVENT_INTERVAL_SEC * 0.75 - 1);
    expect(t).toBeLessThanOrEqual(EVENT_INTERVAL_SEC * 1.25 + 1);
    expect(s.run.event?.until).toBeCloseTo(t + EVENT_DURATION_SEC, 5);
    expect(s.run.nextEventAt).toBeGreaterThan(t + EVENT_DURATION_SEC);
    let after = s;
    for (let dt = 1; dt <= EVENT_DURATION_SEC + 1; dt += 1) after = tickObjects(after, t + dt);
    expect(after.run.event).toBeNull();
  });

  it('a chuva faz nascer só estrelas cadentes, muito mais que o normal', () => {
    const { s, t } = runUntilEvent(atCollapse(2), 'meteor-shower');
    let cur = run(s, { objects: [] });
    const born = new Set<number>();
    for (let dt = 0.5; dt <= EVENT_DURATION_SEC; dt += 0.5) {
      cur = tickObjects(cur, t + dt);
      for (const o of cur.run.objects) {
        born.add(o.id);
        expect(o.kind).toBe('shooting-star');
      }
    }
    expect(born.size).toBeGreaterThanOrEqual(8);
  });

  it('a tempestade dobra a energia por toque, e só durante os 15 s', () => {
    const { s, t } = runUntilEvent(atCollapse(4), 'solar-storm');
    const energyAfterPress = (x: SaveState, at: number) => press({ ...x, clock: at - 0.5 }, at).run.energy;
    const storm = run(s, { energy: 0 });
    const calm = run(s, { energy: 0, event: null });
    expect(energyAfterPress(storm, t + 1)).toBeCloseTo(energyAfterPress(calm, t + 1) * 2, 6);
    expect(energyAfterPress(storm, t + EVENT_DURATION_SEC + 1)).toBeCloseTo(energyAfterPress(calm, t + EVENT_DURATION_SEC + 1), 6);
  });

  it('o evento congela com o jogo parado (aba escondida)', () => {
    const { s, t } = runUntilEvent(atCollapse(2), 'meteor-shower');
    const synced = syncClock({ ...s, clock: t }, t + 600);
    expect(synced.run.event?.until).toBeCloseTo((s.run.event?.until ?? 0) + 600, 5);
    expect(synced.run.nextEventAt).toBeCloseTo((s.run.nextEventAt ?? 0) + 600, 5);
  });
});

describe('Missões da estação (colapso 4)', () => {
  const started = (k: number) => tickObjects(atCollapse(k), 1);

  it('sorteia uma missão por vida só a partir do colapso 4', () => {
    expect(started(3).run.mission).toBeNull();
    const m = started(4).run.mission;
    expect(m).not.toBeNull();
    expect(missionById(m!.id)).toBeDefined();
    expect(m).toMatchObject({ progress: 0, done: false });
  });

  it('cada missão avança pela sua métrica e termina no alvo', () => {
    const def = MISSIONS.find((x) => x.metric === 'touch')!;
    const s = run(started(4), { mission: { id: def.id, progress: def.target - 1, done: false, doneAt: -1e9 } });
    const after = press(s, s.clock + 1);
    expect(after.run.mission).toMatchObject({ progress: def.target, done: true });
    expect(after.run.missionsDone).toBe(1);
    expect(after.stats.missionsDone).toBe(1);
    expect(press(after, s.clock + 2).run.mission?.progress).toBe(def.target);
  });

  it('capturar objetos conta só nas missões de captura', () => {
    const cap = MISSIONS.find((x) => x.metric === 'capture')!;
    const field = { objects: [{ id: 1, kind: 'comet' as const, bornAt: 0, expiresAt: 100 }], nextObjectId: 2 };
    const s = run(started(4), { ...field, mission: { id: cap.id, progress: 0, done: false, doneAt: -1e9 } });
    expect(captureObject(s, 1, 2).run.mission?.progress).toBe(1);
    const touch = MISSIONS.find((x) => x.metric === 'touch')!;
    const other = run(s, { mission: { id: touch.id, progress: 0, done: false, doneAt: -1e9 } });
    expect(captureObject(other, 1, 2).run.mission?.progress).toBe(0);
  });

  it('escolher grimório conta nas missões de escolha', () => {
    const def = MISSIONS.find((x) => x.metric === 'pick')!;
    const s = run(started(4), {
      mission: { id: def.id, progress: 0, done: false, doneAt: -1e9 },
      pending: { offers: ['moon'], openedAt: 0, selected: null, picksLeft: 1, rerollsLeft: 0 },
    });
    const chosen = chooseGrimoire(selectGrimoire(s, 'moon', 5), 'moon', 5);
    expect(chosen.run.mission?.progress).toBe(1);
  });

  it('a missão cumprida conta no total da conta e a vida nova começa sem missão', () => {
    const build = (done: boolean) =>
      run(atCollapse(4, { album: ['moon'], stats: { ...atCollapse(4).stats, picks: 30 } }), {
        dustLife: dustGoal(5),
        picks: minPicks(5),
        build: { moon: 1 },
        ...meetMilestone(4, []),
        mission: { id: 'touch-600', progress: done ? 600 : 10, done, doneAt: -1e9 },
      });
    const plain = collapse(build(false));
    const bonus = collapse(build(true));
    expect(plain.collapses).toBe(5);
    // Sem Fragmentos por missão: a missão vale pelas conquistas (spec 040).
    expect(bonus.sparks).toEqual(plain.sparks);
    expect(bonus.run.mission).toBeNull();
  });
});

describe('validateSave e o conteúdo dos colapsos 1 a 5', () => {
  const errorsOf = (raw: unknown) => {
    const r = validateSave(raw);
    return r.ok ? '' : r.errors.join(' | ');
  };
  /** Um save no colapso `k` que já tem o grimório `id` na vida (e no álbum). */
  const holding = (k: number, id: string) =>
    run(atCollapse(k, { album: [id], stats: { ...atCollapse(k).stats, picks: 5 } }), { picks: 1, build: { [id]: 1 } });
  const withUpgrade = (k: number, id: string) => {
    const s = atCollapse(k, { stats: { ...atCollapse(k).stats, dustTotal: 1e9 } });
    const levels = s.run.upgradeLevels.slice();
    levels[UPGRADES.findIndex((u) => u.id === id)] = 1;
    return run(s, { upgradeLevels: levels, dustLife: 1e9 });
  };
  const withObject = (k: number, kind: 'probe' | 'asteroid') =>
    run(atCollapse(k), { objects: [{ id: 1, kind, bornAt: 0, expiresAt: 5 }], nextObjectId: 2 });

  it('aceita o save de cada colapso de 0 a 5', () => {
    for (let k = 0; k <= 5; k++) expect(validateSave(atCollapse(k)).ok, `colapso ${k}`).toBe(true);
  });

  it.each([
    ['grimório do colapso 4 no colapso 3', holding(3, 'sedna'), 'colapso futuro'],
    ['região fechada', atCollapse(1, { regionId: 'jupiter-saturn' }), 'Região ainda fechada'],
    ['Sonda Voyager no colapso 1', withObject(1, 'probe'), 'Objeto de colapso futuro'],
    ['Asteroide no colapso 0', withObject(0, 'asteroid'), 'Objeto de colapso futuro'],
    ['James Webb no colapso 0', withUpgrade(0, 'webb'), 'Melhoria de colapso futuro'],
    ['Chandra no colapso 2', withUpgrade(2, 'chandra'), 'Melhoria de colapso futuro'],
    ['Gaia no colapso 4', withUpgrade(4, 'gaia'), 'Melhoria de colapso futuro'],
    ['Chuva de meteoros no colapso 1', run(atCollapse(1), { event: { id: 'meteor-shower', until: 10 }, nextEventAt: 20 }), 'Evento de colapso futuro'],
    ['Tempestade solar no colapso 3', run(atCollapse(3), { event: { id: 'solar-storm', until: 10 }, nextEventAt: 20 }), 'Evento de colapso futuro'],
    ['missão no colapso 3', run(atCollapse(3), { mission: { id: 'touch-600', progress: 0, done: false, doneAt: -1e9 } }), 'Missão de colapso futuro'],
    ['favorito no colapso 1', atCollapse(1, { album: ['moon'], favorite: 'moon' }), 'Favorito inválido'],
    ['missão com progresso incoerente', run(atCollapse(4), { mission: { id: 'touch-600', progress: 10, done: true, doneAt: -1e9 } }), 'Missão incoerente'],
  ])('recusa: %s', (_, save, message) => {
    expect(errorsOf(save)).toContain(message);
  });

  it('aceita o conteúdo quando o colapso já chegou', () => {
    const s = run(atCollapse(4, { album: ['moon', 'sedna'], favorite: 'moon', stats: { ...atCollapse(4).stats, picks: 6 } }), {
      picks: 2,
      build: { sedna: 1, moon: 1 },
      event: { id: 'solar-storm', until: 10 },
      nextEventAt: 500,
      mission: { id: 'touch-600', progress: 10, done: false, doneAt: -1e9 },
    });
    const r = validateSave(s);
    expect(r.ok, r.ok ? '' : r.errors.join(' | ')).toBe(true);
  });

  it('save antigo (sem favorito, evento nem missão) continua válido', () => {
    const old = JSON.parse(JSON.stringify(atCollapse(3))) as { favorite?: unknown; run: Record<string, unknown> };
    delete old.favorite;
    delete old.run.event;
    delete old.run.nextEventAt;
    delete old.run.mission;
    const r = validateSave(old);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.save.favorite).toBeNull();
      expect(r.save.run.event).toBeNull();
      expect(r.save.run.mission).toBeNull();
    }
  });

  it('as Cintilas migradas cabem no teto do servidor, e muito mais que ele não', () => {
    const s = atCollapse(5);
    let legacyMax = 0;
    for (let k = 1; k <= 5; k++) legacyMax += 3 + k + 2 + 25;
    expect(validateSave({ ...s, sparks: { legacy: 40, spent: 0 } }).ok).toBe(true);
    expect(errorsOf({ ...s, sparks: { legacy: legacyMax + 1000, spent: 0 } })).toContain('Cintilas migradas não batem');
  });
});
