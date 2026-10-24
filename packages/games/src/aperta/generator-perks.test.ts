// Aquecimento e as 8 melhorias de gerador da spec 039 (seções 3 e 4.1).

import { describe, expect, it } from 'vitest';
import { UPGRADES, upgradeIndex } from './catalog';
import {
  AUTO_CAP_SHARE,
  BULK_MIN,
  NETWORK_PER_PROBE,
  BURST_EVERY_SEC,
  BURST_SECS,
  LURE_CAP_SEC,
  NOMINAL_TOUCHES_PER_SEC,
  PEAK_MULT,
  REVEAL_SHARE,
  ROTATION_MULT,
  WARM_AFTER_SEC,
  WARM_MULT,
  WARM_RELEASE_SEC,
} from './economy';
import {
  autoRates,
  batchCost,
  batchLevels,
  buyUpgradeBatch,
  captureObject,
  effectiveStats,
  newSave,
  nextUpgradeCost,
  press,
  syncClock,
  upgradeLock,
  type SaveState,
} from './engine';
import { validateSave } from './save';

const idx = (id: string): number => upgradeIndex(id);

/** Um save com os níveis (por id) comprados e a poeira que o teste pedir. */
function withLevels(levels: Record<string, number>, over: { dust?: number; clock?: number; lastPressAt?: number } = {}): SaveState {
  const s = newSave('perks');
  const upgradeLevels = s.run.upgradeLevels.slice();
  for (const [id, n] of Object.entries(levels)) upgradeLevels[idx(id)] = n;
  return {
    ...s,
    tutorial: 'done',
    collapses: 2,
    clock: over.clock ?? 100,
    run: { ...s.run, upgradeLevels, dust: over.dust ?? 1e9, dustLife: over.dust ?? 1e9, lastPressAt: over.lastPressAt ?? 100 },
  };
}

describe('Aquecimento (melhoria de toque, 3.000 de poeira)', () => {
  it('custa 3.000, é de toque e única', () => {
    const def = UPGRADES[idx('warmup')]!;
    expect([def.kind, def.base, def.max]).toEqual(['touch', 3000, 1]);
  });

  it(`depois de ${WARM_AFTER_SEC} s tocando sem parar o toque rende +50%, e soltar por ${WARM_RELEASE_SEC} s zera`, () => {
    // Toques a cada 0,4 s por 8 s, uma pausa de 3 s e mais 2 toques; o toque rende ~40 (100 em Lente, sem combo).
    const times: number[] = [];
    for (let t = 0.5; t < 8; t += 0.4) times.push(t);
    const restAt = times[times.length - 1]! + 3;
    times.push(restAt, restAt + 0.4);
    const run = (levels: Record<string, number>): number[] => {
      let s = { ...withLevels(levels, { dust: 0, lastPressAt: -1e6 }), clock: 0 };
      s = { ...s, run: { ...s.run, upgradeLevels: s.run.upgradeLevels.map((l, i) => (i === idx('gloves') ? 1 : i === idx('lens') ? 1 : l)) } };
      const out: number[] = [];
      for (const t of times) {
        const before = s.run.dust;
        s = press(s, t);
        out.push(s.run.dust - before);
      }
      return out;
    };
    const warm = run({ warmup: 1 });
    const plain = run({});
    const first = times[0]!;
    times.forEach((t, i) => {
      const sinceStart = t - first;
      const afterRest = t >= restAt;
      const warmed = !afterRest && sinceStart >= WARM_AFTER_SEC;
      if (warmed) expect(warm[i]!, `t=${t}`).toBe(Math.floor(plain[i]! * WARM_MULT));
      else expect(warm[i]!, `t=${t}`).toBe(plain[i]!);
    });
    expect(times.some((t) => t - first >= WARM_AFTER_SEC && t < restAt)).toBe(true);
  });

  it('sem a melhoria nada muda', () => {
    expect(effectiveStats(withLevels({})).perks.warm).toBe(false);
    expect(effectiveStats(withLevels({ warmup: 1 })).perks.warm).toBe(true);
  });
});

describe('melhorias de gerador (spec 039, 4.1): compra única, na aba Geradores', () => {
  it('são 8, do tipo `perk`, únicas e na ordem do preço', () => {
    const perks = UPGRADES.filter((u) => u.kind === 'perk');
    expect(perks.map((u) => u.id)).toEqual(['network', 'lure', 'burst', 'scale', 'peak', 'queue', 'convert', 'rotation']);
    for (const u of perks) expect([u.max, u.growth]).toEqual([1, 1]);
    perks.forEach((u, i) => {
      if (i > 0) expect(u.base).toBeGreaterThan(perks[i - 1]!.base);
    });
  });

  it('Rede: cada nível da Sonda dá +2% aos Satélites', () => {
    const sat = (UPGRADES[idx('satellite')] as { perSec: number }).perSec * 4;
    const plain = effectiveStats(withLevels({ satellite: 4, probe: 5 })).autoDustPerSec;
    const net = effectiveStats(withLevels({ satellite: 4, probe: 5, network: 1 })).autoDustPerSec;
    expect(net - plain).toBeCloseTo(sat * NETWORK_PER_PROBE * 5, 9);
  });

  it('Escala: a cada 4 níveis de um gerador, +1 de poeira por toque', () => {
    const plain = effectiveStats(withLevels({ satellite: 8 })).dustPerTouch;
    const scaled = effectiveStats(withLevels({ satellite: 8, scale: 1 })).dustPerTouch;
    expect(scaled - plain).toBeGreaterThanOrEqual(2); // floor(8/4) = 2, antes dos multiplicadores
  });

  it('Isca: cada 2 níveis do Satélite encurtam 1 s a espera do próximo objeto, com teto', () => {
    const base = effectiveStats(withLevels({ satellite: 6 })).objects.spawnMinSec;
    const lure = effectiveStats(withLevels({ satellite: 6, lure: 1 })).objects.spawnMinSec;
    expect(base - lure).toBeCloseTo(3, 9);
    const full = effectiveStats(withLevels({ satellite: 8, lure: 1 })).objects.spawnMinSec;
    const none = effectiveStats(withLevels({ satellite: 8 })).objects.spawnMinSec;
    expect(none - full).toBeLessThanOrEqual(LURE_CAP_SEC + 1e-9);
  });

  it('Revezamento: o gerador menos comprado rende o dobro', () => {
    const probe = (UPGRADES[idx('probe')] as { perSec: number }).perSec * 2;
    const plain = effectiveStats(withLevels({ satellite: 5, probe: 2 })).autoDustPerSec;
    const rot = effectiveStats(withLevels({ satellite: 5, probe: 2, rotation: 1 })).autoDustPerSec;
    // A Sonda (2 níveis) é a menos comprada: +1x o que ela rende.
    expect(rot - plain).toBeCloseTo(probe * (ROTATION_MULT - 1), 9);
  });

  it('Conversão: os geradores também enchem a barra (1 toque por minuto)', () => {
    const plain = effectiveStats(withLevels({ satellite: 5 })).autoEnergyPerSec;
    const conv = effectiveStats(withLevels({ satellite: 5, convert: 1 })).autoEnergyPerSec;
    const e = effectiveStats(withLevels({ satellite: 5, convert: 1 })).energyPerTouch;
    expect(conv - plain).toBeCloseTo(e / 60, 9);
    // Sem gerador de poeira rodando, não há o que converter.
    expect(effectiveStats(withLevels({ convert: 1 })).autoEnergyPerSec).toBe(0);
  });

  it('Rajada: a cada 60 s os geradores soltam 10 s de produção, sem passar do teto', () => {
    // Poucos geradores (bem abaixo do teto): a rajada soma 10 s de produção a cada 60 s.
    const s = withLevels({ satellite: 3, burst: 1 }, { clock: 100, lastPressAt: 99.9 });
    const rate = autoRates(s).dust;
    let cur = syncClock(s, 101); // arma a conta
    const armed = cur.run.nextBurstAt;
    expect(armed).toBeCloseTo(100 + BURST_EVERY_SEC, 6);
    const beforeDust = cur.run.dust;
    // Avança até logo depois da hora da rajada, em passos de 1 s (o relógio não pula mais que 5 s).
    let t = 101;
    while (t < armed!) {
      t += 1;
      cur = syncClock({ ...cur, run: { ...cur.run, lastPressAt: t - 0.1 } }, t);
    }
    const gained = cur.run.dust - beforeDust;
    const steady = rate * (t - 101);
    expect(gained - steady).toBeGreaterThan(rate * BURST_SECS * 0.5);
    expect(gained - steady).toBeLessThanOrEqual(rate * BURST_SECS + 1e-3);
    expect(cur.run.nextBurstAt).toBeGreaterThan(t);
    // No teto, a rajada não soma nada (a média nunca passa do teto).
    const capped = withLevels({ satellite: 200, probe: 200, telescope: 200, burst: 1 }, { clock: 100, lastPressAt: 99.9 });
    const rc = autoRates(capped);
    const st = effectiveStats(capped);
    expect(rc.dust).toBeCloseTo(st.autoDustCap, 6);
    let c2 = syncClock(capped, 101);
    const d0 = c2.run.dust;
    let u = 101;
    const due2 = c2.run.nextBurstAt!;
    while (u < due2) {
      u += 1;
      c2 = syncClock({ ...c2, run: { ...c2.run, lastPressAt: u - 0.1 } }, u);
    }
    expect(c2.run.dust - d0).toBeCloseTo(rc.dust * (u - 101), 3);
  });

  it('Hora de pico: capturar um objeto dá +50% nos geradores por 20 s (sem passar do teto)', () => {
    const s0 = withLevels({ satellite: 3, peak: 1 }, { clock: 100, lastPressAt: 99.9 });
    const obj = { id: 1, kind: 'comet' as const, bornAt: 99, expiresAt: 200 };
    const s = { ...s0, run: { ...s0.run, objects: [obj], nextObjectId: 2 } };
    const before = autoRates(s).dust;
    const cap = captureObject(s, 1, 100);
    expect(cap.run.peakUntil).toBeCloseTo(120, 6);
    expect(autoRates({ ...cap, clock: 101 }).dust).toBeCloseTo(before * PEAK_MULT, 9);
    expect(autoRates({ ...cap, clock: 121, run: { ...cap.run, lastPressAt: 120.9 } }).dust).toBeCloseTo(before, 9);
    // No teto o pico não passa disso.
    const c0 = withLevels({ satellite: 200, probe: 200, telescope: 200, peak: 1 }, { clock: 100, lastPressAt: 99.9 });
    const peaked = { ...c0, run: { ...c0.run, peakUntil: 120 } };
    expect(autoRates(peaked).dust).toBeLessThanOrEqual(effectiveStats(peaked).autoDustCap + 1e-9);
  });

  it('Fila de pedidos: completar o gerador de uma vez (os níveis que faltam) sai 5% mais barato, e só com a melhoria', () => {
    const s = withLevels({ queue: 1, satellite: 2 }, { dust: 1e6 });
    const sat = idx('satellite');
    const max = (UPGRADES[sat] as { max: number }).max;
    let each = 0;
    for (let k = 2; k < max; k++) {
      const probe = { ...s, run: { ...s.run, upgradeLevels: s.run.upgradeLevels.map((l, i) => (i === sat ? k : l)) } };
      each += nextUpgradeCost(probe, sat) ?? 0;
    }
    expect(batchLevels(s, sat)).toBe(max - 2);
    expect(batchCost(s, sat)).toBeCloseTo(each * 0.95, 6);
    const bought = buyUpgradeBatch(s, sat);
    expect(bought.run.upgradeLevels[sat]).toBe(max);
    expect(s.run.dust - bought.run.dust).toBeCloseTo(each * 0.95, 6);
    // Sem dinheiro para completar, não compra nenhum.
    const poor = withLevels({ queue: 1, satellite: 2 }, { dust: each * 0.9 });
    expect(buyUpgradeBatch(poor, sat)).toBe(poor);
    // Sem a melhoria não há lote.
    const none = withLevels({ satellite: 2 }, { dust: 1e6 });
    expect(batchCost(none, sat)).toBeNull();
    expect(buyUpgradeBatch(none, sat)).toBe(none);
    // Com menos de BULK_MIN níveis faltando, o botão não aparece.
    expect(batchLevels(withLevels({ queue: 1, satellite: max - (BULK_MIN - 1) }), sat)).toBe(0);
  });
});

describe('o farm automático nunca rende mais que tocar', () => {
  const rich = { satellite: 8, probe: 8, telescope: 8, observatory: 10, station: 10, antenna: 6, receiver: 6 };
  const all = { ...rich, network: 1, lure: 1, burst: 1, scale: 1, peak: 1, queue: 1, convert: 1, rotation: 1, warmup: 1, echo: 1, lens: 1, lens2: 1 };

  it('com todas as melhorias, parado rende o mesmo que tocando e o auto fica sob o teto do toque', () => {
    for (const levels of [rich, all]) {
      const active = withLevels(levels, { clock: 100, lastPressAt: 99.9 });
      const idle = withLevels(levels, { clock: 100, lastPressAt: 0 });
      const st = effectiveStats(active);
      const a = autoRates(active);
      const i = autoRates(idle);
      expect(a.active && !i.active).toBe(true);
      expect(i.dust).toBeCloseTo(a.dust, 9);
      expect(a.dust).toBeLessThanOrEqual(st.autoDustCap + 1e-9);
      expect(a.dust).toBeLessThanOrEqual(st.dustPerTouch * NOMINAL_TOUCHES_PER_SEC * AUTO_CAP_SHARE + 1e-9);
      expect(a.energy).toBeLessThanOrEqual(st.autoEnergyCap + st.dustPerTouch > 0 ? a.energy : 0);
    }
  });

  it('em 60 s, tocar sempre rende mais que ficar parado, mesmo com a Rajada e a Hora de pico', () => {
    const run = (touching: boolean): number => {
      let s = withLevels(all, { clock: 0, lastPressAt: touching ? 0 : -1e6 });
      // Muitas escolhas já feitas: a barra de energia não enche e não abre escolha durante o minuto (a escolha congela tudo).
      s = { ...s, run: { ...s.run, peakUntil: 90, picks: 200 } };
      const start = s.run.dust;
      for (let t = 0.4; t <= 60; t += 0.4) s = touching ? press(s, t) : syncClock(s, t);
      return s.run.dust - start;
    };
    expect(run(true)).toBeGreaterThan(run(false));
  });
});

describe('prateleira, revelação e save', () => {
  it('a 1ª melhoria de gerador aparece na fila dos geradores e a próxima fica como "???" até 70% do preço', () => {
    const s = { ...withLevels({ satellite: 1 }, { dust: 0 }), collapses: 0 }; // depois do 1º colapso os nomes já aparecem
    expect(upgradeLock(withLevels({}, { dust: 0 }), idx('network'))).toEqual({ kind: 'shelf' }); // sem gerador, nem aparece
    expect(upgradeLock(s, idx('network'))).toBeNull(); // a 1ª da fila é visível
    const lure = UPGRADES[idx('lure')]!;
    expect(upgradeLock(s, idx('lure'))).toEqual({ kind: 'mystery', cost: lure.base });
    const rich = { ...s, run: { ...s.run, dustLife: REVEAL_SHARE * lure.base } };
    expect(upgradeLock(rich, idx('lure'))).toBeNull();
    // As de trás da fila nem aparecem.
    expect(upgradeLock(s, idx('rotation'))).toEqual({ kind: 'shelf' });
  });

  it('saves antigos (sem os campos novos nem as 9 melhorias) continuam válidos', () => {
    const s = newSave('velho');
    const run = { ...s.run } as Record<string, unknown>;
    delete run.warmSince;
    delete run.peakUntil;
    delete run.nextBurstAt;
    run.upgradeLevels = (s.run.upgradeLevels as number[]).slice(0, 29);
    const result = validateSave({ ...s, run });
    if (!result.ok) throw new Error(result.errors.join('; '));
    expect(result.save.run.upgradeLevels).toHaveLength(UPGRADES.length);
    expect(result.save.run.nextBurstAt).toBeNull();
  });
});
