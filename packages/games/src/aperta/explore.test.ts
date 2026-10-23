import { describe, expect, it } from 'vitest';
import { LEGENDARY_OBJECTS } from './catalog';
import { energyCap } from './economy';
import { captureObject, effectiveStats, eventDuration, newSave, press, tickObjects, type GameObject, type SaveState } from './engine';
import { starMapView } from './starmap';
import { TREE_EVENT_IDS } from './tree-fx';
import { LEGENDARY_OBJECT_KINDS } from './sparks';

/** Um save no 4º colapso, fora do tutorial, com objetos abertos. */
function base(over: Partial<SaveState> = {}): SaveState {
  const s = newSave('explora');
  return {
    ...s,
    tutorial: 'done',
    collapses: 4,
    regionId: 'oort-cloud',
    ...over,
    run: { ...s.run, picks: 5, upgradeLevels: s.run.upgradeLevels.map((_, i) => (i === 0 ? 3 : 0)), ...(over.run ?? {}) },
  };
}

const obj = (id: number, kind: GameObject['kind'], at = 0): GameObject => ({ id, kind, bornAt: at, expiresAt: at + 30 });

describe('Radar de lendários', () => {
  const tree = { 'ex-01': 1 };

  it('o limite sai do nó, cai com o Radar rápido e nunca passa do piso', () => {
    expect(effectiveStats(base({ tree })).explore.radarThreshold).toBe(60);
    expect(effectiveStats(base({ tree: { 'ex-01': 2 } })).explore.radarThreshold).toBe(45);
    expect(effectiveStats(base({ tree: { 'ex-01': 2, 'ex-07': 2 } })).explore.radarThreshold).toBe(39);
    expect(effectiveStats(base({ tree: { 'ex-01': 2, 'ex-07': 2, 'ex-13': 2 } })).explore.radarThreshold).toBeGreaterThanOrEqual(15);
    expect(effectiveStats(base()).explore.radarOn).toBe(false);
  });

  it('sem o nó nenhum lendário nasce, por mais capturas que haja', () => {
    let s = base({ run: { ...base().run, radar: 500 } });
    s = tickObjects(s, 10);
    expect(s.run.objects.some((o) => o.kind.startsWith('legend'))).toBe(false);
  });

  it('o contador cresce a cada captura e, quando enche, o lendário nasce garantido e o contador zera', () => {
    let s = base({ tree });
    // Cada captura vale 1 no radar.
    s = { ...s, run: { ...s.run, objects: [obj(1, 'comet', 5)], nextObjectId: 2, nextSpawnAt: 1e6 } };
    s = captureObject(s, 1, 6);
    expect(s.run.radar).toBe(1);
    s = { ...s, run: { ...s.run, radar: 60 } };
    const t = tickObjects(s, 7);
    const legends = t.run.objects.filter((o) => o.kind.startsWith('legend'));
    expect(legends).toHaveLength(1);
    expect(LEGENDARY_OBJECTS.map((d) => d.kind)).toContain(legends[0]!.kind);
    expect(t.run.radar).toBe(0);
    // Não nasce outro enquanto o primeiro está no campo (legendMax 1).
    const again = tickObjects({ ...t, run: { ...t.run, radar: 60 } }, 8);
    expect(again.run.objects.filter((o) => o.kind.startsWith('legend'))).toHaveLength(1);
  });

  it('o Radar certeiro devolve o radar com um quarto cheio; Lendários em dobro deixa 2 no campo', () => {
    let s = base({ tree: { ...tree, 'ex-17': 1 }, run: { ...base().run, radar: 60 } });
    s = tickObjects(s, 10);
    expect(s.run.radar).toBe(15);
    expect(effectiveStats(base({ tree: { ...tree, 'ex-22': 1 } })).explore.legendMax).toBe(2);
  });

  it('nunca no começo do jogo (tutorial) e prefere um tipo que a pessoa ainda não capturou', () => {
    const early = base({ tree, tutorial: 3, run: { ...base().run, radar: 99 } });
    expect(tickObjects(early, 10).run.objects.some((o) => o.kind.startsWith('legend'))).toBe(false);
    const seen = LEGENDARY_OBJECTS.slice(0, 3).map((d) => d.kind);
    const s = base({ tree, run: { ...base().run, radar: 99 } });
    const t = tickObjects({ ...s, stats: { ...s.stats, capturedKinds: seen } }, 10);
    expect(t.run.objects.find((o) => o.kind.startsWith('legend'))!.kind).toBe('legend-wormhole');
  });

  it('cada lendário entrega o que o catálogo promete e a 1ª captura rende Cintilas', () => {
    expect(LEGENDARY_OBJECTS).toHaveLength(4);
    expect(LEGENDARY_OBJECT_KINDS).toEqual(LEGENDARY_OBJECTS.map((d) => d.kind));
    const s = base();
    const stats = effectiveStats(s);
    const comet = captureObject({ ...s, run: { ...s.run, objects: [obj(1, 'legend-comet')], nextObjectId: 2 } }, 1, 1);
    expect(comet.run.dust).toBeGreaterThanOrEqual(Math.floor(stats.dustPerTouch * 40));
    const nebula = captureObject({ ...s, run: { ...s.run, objects: [obj(1, 'legend-nebula')], nextObjectId: 2 } }, 1, 1);
    expect(nebula.run.boostMult).toBe(2);
    expect(nebula.run.boostUntil).toBeCloseTo(11, 5);
    const worm = captureObject({ ...s, run: { ...s.run, objects: [obj(1, 'legend-wormhole')], nextObjectId: 2 } }, 1, 1);
    expect(worm.run.pending).not.toBeNull();
    expect(worm.stats.capturedKinds).toContain('legend-wormhole');
    expect(worm.stats.raresCaptured).toBe(1);
    // Lendas generosas dobra o prêmio.
    const rich = base({ tree: { 'ex-21': 1 } });
    const doubled = captureObject({ ...rich, run: { ...rich.run, objects: [obj(1, 'legend-comet')], nextObjectId: 2 } }, 1, 1);
    expect(doubled.run.dust).toBeGreaterThan(comet.run.dust * 1.9);
  });
});

describe('eventos da árvore', () => {
  const open = { 'ex-02': 1, 'ex-03': 1, 'ex-05': 1, 'ex-06': 1 };

  it('chance e duração vêm do nível do nó, e os nós de duração somam', () => {
    const e1 = effectiveStats(base({ tree: open })).explore.events;
    expect(e1['gold-rain']).toEqual({ chance: 10, sec: 30 });
    const e2 = effectiveStats(base({ tree: { ...open, 'ex-02': 2, 'ex-11': 2, 'ex-19': 1 } })).explore.events;
    expect(e2['gold-rain']).toEqual({ chance: 15, sec: 40 + 20 + 5 });
    expect(e2.alignment.sec).toBe(30 + 5);
    expect(effectiveStats(base()).explore.events['gold-rain'].chance).toBe(0);
    expect(eventDuration(base({ tree: open }), 'eclipse', false)).toBe(30);
    // O 1º evento da vida dura o dobro com o Grande evento.
    expect(eventDuration(base({ tree: { ...open, 'ex-23': 1 } }), 'eclipse', true)).toBe(60);
    expect(eventDuration(base({ tree: { ...open, 'ex-23': 1 } }), 'eclipse', false)).toBe(30);
  });

  it('o sorteio respeita a chance: só sai o que o nó libera e todos os quatro aparecem', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      let s = base({ tree: open, collapses: 0, run: { ...base().run, nextEventAt: 100 } });
      s = { ...s, run: { ...s.run, objects: [], nextObjectId: 1 + i * 3 }, playSeconds: i * 13.7 };
      const t = tickObjects({ ...s, clock: 100 + i * 0.37 - 0.1 }, 100 + i * 0.37);
      if (t.run.event) seen.add(t.run.event.id);
    }
    expect([...seen].sort()).toEqual([...TREE_EVENT_IDS].sort());
  });

  it('sem nenhum nó de evento e no colapso 0, nenhum evento começa', () => {
    const s = base({ collapses: 0, run: { ...base().run, nextEventAt: 10 } });
    expect(tickObjects(s, 50).run.event).toBeNull();
  });

  it('o evento acaba na hora e o seguinte é marcado depois', () => {
    let s = base({ tree: { 'ex-02': 2 }, run: { ...base().run, nextEventAt: 1 } });
    s = tickObjects(s, 2);
    // 'ex-02' sozinho: chance 30 de 100; se não caiu nele, caem os eventos do colapso 4 (meteoro/tempestade).
    if (s.run.event?.id === 'gold-rain') expect(s.run.event.until).toBeCloseTo(2 + 40, 5);
    expect(s.run.nextEventAt).toBeGreaterThan(2);
  });

  it('Chuva de ouro: o toque e a captura rendem o dobro', () => {
    const s = { ...base({ tree: open }), clock: 9.9 };
    const plain = press(s, 10);
    const rain = press({ ...s, run: { ...s.run, event: { id: 'gold-rain', until: 50 } } }, 10);
    expect(rain.run.dust).toBe(plain.run.dust * 2);
    const cap = captureObject({ ...s, run: { ...s.run, objects: [obj(1, 'comet', 9)], nextObjectId: 2 } }, 1, 10);
    const capRain = captureObject({ ...s, run: { ...s.run, objects: [obj(1, 'comet', 9)], nextObjectId: 2, event: { id: 'gold-rain', until: 50 } } }, 1, 10);
    expect(cap.run.dust).toBeGreaterThan(0);
    expect(capRain.run.dust).toBe(cap.run.dust * 2);
    // Passado o fim, volta ao normal.
    const done = press({ ...s, run: { ...s.run, event: { id: 'gold-rain', until: 5 } } }, 10);
    expect(done.run.dust).toBe(plain.run.dust);
  });

  it('Alinhamento: o combo não cai com a pausa longa; sem o evento cai', () => {
    const lv = base().run.upgradeLevels;
    // Liga o combo (Ritmo Firme) para o teste.
    const rhythm = (s: SaveState): SaveState => ({ ...s, run: { ...s.run, upgradeLevels: s.run.upgradeLevels.map((_, i) => (i === 3 ? 1 : s.run.upgradeLevels[i]!)) } });
    expect(lv.length).toBeGreaterThan(3);
    let a = { ...rhythm(base({ tree: open })), clock: 9.9 };
    a = press(a, 10);
    a = press(a, 10.3);
    const combo = a.run.combo;
    expect(combo).toBeGreaterThanOrEqual(1);
    const falls = press({ ...a, clock: 29.9 }, 30);
    expect(falls.run.combo).toBe(0);
    const kept = press({ ...a, clock: 29.9, run: { ...a.run, event: { id: 'alignment', until: 100 } } }, 30);
    expect(kept.run.combo).toBe(combo + 1);
  });

  it('Maré de energia: a barra enche em dobro', () => {
    const s = base({ tree: open });
    const plain = press(s, 10).run.energy;
    const tide = press({ ...s, run: { ...s.run, event: { id: 'energy-tide', until: 50 } } }, 10).run.energy;
    expect(tide).toBeCloseTo(plain * 2, 9);
  });

  it('Eclipse: cada oferta traz uma carta extra enquanto dura', () => {
    const s = base({ tree: open });
    const cap = energyCap(5);
    const filled = { ...s, run: { ...s.run, energy: cap - 0.5 } };
    expect(press(filled, 10).run.pending!.offers).toHaveLength(3);
    const eclipse = { ...filled, clock: 9, run: { ...filled.run, event: { id: 'eclipse' as const, until: 50 } } };
    expect(press(eclipse, 10).run.pending!.offers).toHaveLength(4);
  });

  it('o 1º aparecimento de cada evento vira Cintila e conquista (uma vez)', () => {
    let s = base({ tree: open, run: { ...base().run, nextEventAt: 1 } });
    for (let i = 0; i < 40 && s.stats.eventsSeen.length === 0; i++) s = tickObjects({ ...s, run: { ...s.run, nextEventAt: 1, event: null } }, 2 + i * 0.7);
    expect(s.stats.eventsSeen.length).toBe(1);
    const id = s.stats.eventsSeen[0]!;
    const before = s.stats.eventsSeen.length;
    const again = tickObjects(s, 3);
    expect(again.stats.eventsSeen.length).toBe(before);
    if (['gold-rain', 'alignment', 'energy-tide', 'eclipse'].includes(id)) {
      const map: Record<string, string> = { 'gold-rain': 'explore-gold-rain', alignment: 'explore-alignment', 'energy-tide': 'explore-energy-tide', eclipse: 'explore-eclipse' };
      expect(s.achievements).toContain(map[id]);
    }
  });
});

describe('mais objetos e Mapa estelar', () => {
  it('Mais objetos soma 1 vaga (e os dois níveis não passam do teto 6)', () => {
    const none = effectiveStats(base()).objects.maxOnField;
    expect(effectiveStats(base({ tree: { 'ex-13': 1 } })).objects.maxOnField).toBe(none + 1);
    expect(effectiveStats(base({ tree: { 'ex-13': 2 } })).objects.maxOnField).toBe(none + 1);
    expect(effectiveStats(base({ tree: { 'ex-13': 2 } })).objects.maxOnField).toBeLessThanOrEqual(6);
  });

  it('o Mapa estelar revela a região do próximo colapso; os outros nós dão o detalhe, o marco e o horizonte', () => {
    expect(starMapView(base())).toBeNull();
    const map = starMapView(base({ collapses: 2, tree: { 'ex-08': 1 } }))!;
    expect(map.regions).toHaveLength(1);
    expect(map.regions[0]!.regionName).toBe('Cinturão de Kuiper');
    expect(map.regions[0]!.items.some((i) => i.kind === 'grimoire')).toBe(false);
    expect(map.milestone).toBeNull();
    const full = starMapView(base({ collapses: 2, tree: { 'ex-08': 1, 'ex-14': 1, 'ex-20': 1, 'ex-24': 1 } }))!;
    expect(full.regions).toHaveLength(2);
    expect(full.regions[0]!.items.some((i) => i.kind === 'grimoire')).toBe(true);
    expect(full.milestone).not.toBeNull();
  });
});

describe('o que ainda não existe', () => {
  it('os nós de Sorte e Exploração estão ligados e o Observatório continua fechado', async () => {
    const { TREE_FEATURES, TREE_NODES, nodeLive } = await import('./tree');
    expect(TREE_FEATURES.luck && TREE_FEATURES.exploration).toBe(true);
    const live = (branch: string) => TREE_NODES.filter((n) => n.branch === branch && nodeLive(n)).length;
    expect(live('luck')).toBe(24);
    expect(live('exploration')).toBe(24);
    expect(nodeLive(TREE_NODES.find((n) => n.id === 'co-06')!)).toBe(false);
  });
});
