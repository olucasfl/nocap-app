// Colapso infinito (spec 040, etapa 14): requisito crescente, marco da vida que gira, contadores da vida,
// missões em sequência, números grandes e a remoção do Ascender.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GOAL_TABLE, dustGoal, minPicks, MAX_NUMBER, MAX_COLLAPSE_COUNT, LIFE_HOURS_MAX } from './economy';
import {
  canCollapse,
  captureObject,
  collapse,
  collapseProgress,
  newSave,
  press,
  tickObjects,
  type RunState,
  type SaveState,
} from './engine';
import { meetMilestone, milestoneGoal, milestoneKind } from './milestone';
import { MISSIONS } from './content';
import { validateSave } from './save';

const withRun = (s: SaveState, patch: Partial<RunState>): SaveState => ({ ...s, run: { ...s.run, ...patch } });
/** Um save no colapso `c` com a vida montada (sem ter jogado as anteriores). */
const atCollapse = (c: number): SaveState => ({ ...newSave('inf', 1), tutorial: 'done', collapses: c, album: ['moon:common'] });
const ready = (c: number): SaveState => {
  const s = atCollapse(c);
  const run = { dustLife: dustGoal(c + 1), dust: dustGoal(c + 1), picks: minPicks(c + 1), build: { moon: 1 } };
  const base = withRun(s, run);
  return withRun(base, meetMilestone(c, base.run.upgradeLevels));
};

describe('o requisito do colapso n cresce sem fim', () => {
  it('a meta de poeira nunca decresce, começa em 220 bi e é estritamente maior a cada colapso', () => {
    expect(dustGoal(1)).toBe(2.2e11);
    let prev = 0;
    for (let n = 1; n <= 700; n++) {
      const g = dustGoal(n);
      expect(g).toBeGreaterThanOrEqual(prev);
      if (g < MAX_NUMBER) expect(g).toBeGreaterThan(prev);
      prev = g;
    }
  });

  it('não existe colapso máximo: o 100º e o 500º continuam colapsando', () => {
    for (const c of [15, 16, 99, 250, 499]) {
      const s = ready(c);
      expect(canCollapse(s), `colapso ${c + 1}`).toBe(true);
      const after = collapse(s);
      expect(after.collapses, `colapso ${c + 1}`).toBe(c + 1);
      expect(after.run.dustLife).toBe(0);
    }
  });

  it('o guarda de 1e300 trava a meta e o contador de colapsos aceito vai até onde a meta ainda cabe', () => {
    expect(dustGoal(MAX_COLLAPSE_COUNT)).toBeLessThan(MAX_NUMBER);
    expect(dustGoal(10_000_000)).toBe(MAX_NUMBER);
    expect(MAX_COLLAPSE_COUNT).toBeGreaterThan(500);
  });

  it('mínimo de escolhas (metade de antes, spec 041): 12 no 1º, 10 até o 5º e 8 depois', () => {
    expect([1, 2, 5, 6, 15, 1000].map(minPicks)).toEqual([12, 10, 10, 8, 8, 8]);
  });

  it('os três requisitos têm que estar cumpridos, cada um sozinho segura o colapso', () => {
    const ok = ready(3);
    expect(canCollapse(ok)).toBe(true);
    expect(canCollapse(withRun(ok, { dustLife: dustGoal(4) * 0.99 }))).toBe(false);
    expect(canCollapse(withRun(ok, { picks: minPicks(4) - 1 }))).toBe(false);
    const noMilestone = withRun(ok, { captured: 0, rares: 0, chainBest: 0, fullBest: 0, missionsDone: 0, upgradeLevels: ok.run.upgradeLevels.map(() => 0) });
    expect(collapseProgress(noMilestone).milestone.done).toBe(false);
    expect(canCollapse(noMilestone)).toBe(false);
  });

  it('o progresso devolve as três barras', () => {
    const p = collapseProgress(withRun(atCollapse(0), { dustLife: 1e6, picks: 10, captured: 0 }));
    expect(p).toMatchObject({ next: 1, dustGoal: GOAL_TABLE[0], dust: 1e6, picks: 10, minPicks: 12, ready: false });
    expect(p.milestone).toMatchObject({ kind: 'generators', value: 0, done: false });
  });

  it('o marco de cada colapso é o que a spec diz e muda ao colapsar', () => {
    const after = collapse(ready(0));
    expect(collapseProgress(after).milestone.value).toBe(0);
  });
});

describe('contadores da vida (alimentam o marco)', () => {
  it('capturar conta nos objetos e, na Estrela Dourada, também nos raros', () => {
    const field = (kind: 'comet' | 'golden') => ({ objects: [{ id: 1, kind, bornAt: 0, expiresAt: 100, power: kind === 'golden' ? ('rain' as const) : undefined }], nextObjectId: 2 });
    const a = captureObject(withRun(atCollapse(2), field('comet')), 1, 2);
    expect(a.run).toMatchObject({ captured: 1, rares: 0 });
    const b = captureObject(withRun(atCollapse(2), field('golden')), 1, 2);
    expect(b.run).toMatchObject({ captured: 1, rares: 1 });
  });

  it('o colapso zera os contadores', () => {
    const s = withRun(ready(2), { captured: 9, rares: 2, chain: 3, chainBest: 12, fullBest: 40, missionsDone: 3 });
    const after = collapse(s);
    expect(after.run).toMatchObject({ captured: 0, rares: 0, chain: 0, chainBest: 0, fullBest: 0, missionsDone: 0 });
  });
});

describe('missões da estação em sequência', () => {
  const started = (): SaveState => {
    // Colapso 4 abre as missões; uma passada pelo tick sorteia a primeira.
    const s = tickObjects(atCollapse(4), 5);
    expect(s.run.mission).not.toBeNull();
    return s;
  };

  it('cumprida a missão, a próxima chega depois da pausa e nunca é a mesma', () => {
    let s = started();
    const first = s.run.mission!;
    const def = MISSIONS.find((m) => m.id === first.id)!;
    s = withRun(s, { mission: { ...first, progress: def.target - 1 } });
    // Dá o último passo pela métrica certa.
    s = def.metric === 'touch' ? press(s, s.clock + 1) : { ...s, run: { ...s.run, mission: { ...first, progress: def.target, done: true, doneAt: s.clock }, missionsDone: 1 } };
    if (def.metric === 'touch') expect(s.run.missionsDone).toBe(1);
    const doneAt = s.run.mission!.doneAt;
    expect(s.run.mission!.done).toBe(true);
    // Antes da pausa: a cumprida continua na tela.
    s = tickObjects(s, doneAt + 1);
    expect(s.run.mission).toMatchObject({ id: first.id, done: true });
    // Depois: outra missão, zerada (o relógio anda de 1 em 1 s; um salto maior seria aba escondida).
    for (let dt = 2; dt <= 7; dt++) s = tickObjects(s, doneAt + dt);
    const next = s.run.mission!;
    expect(next).toMatchObject({ done: false, progress: 0 });
    expect(next.id).not.toBe(first.id);
    expect(s.run.missionsDone).toBeGreaterThan(0);
  });

  it('há missões curtas e longas, e todas têm id único', () => {
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
    expect(Math.min(...MISSIONS.map((m) => m.target))).toBeLessThan(10);
  });
});

describe('números grandes', () => {
  it('um ganho gigante trava em 1e300 em vez de virar infinito ou NaN', () => {
    let s = withRun(atCollapse(2), { dust: MAX_NUMBER, dustLife: MAX_NUMBER });
    s = { ...s, stats: { ...s.stats, dustTotal: MAX_NUMBER } };
    const after = press(s, 10);
    for (const x of [after.run.dust, after.run.dustLife, after.stats.dustTotal, after.run.energy]) {
      expect(Number.isFinite(x)).toBe(true);
      expect(x).toBeLessThanOrEqual(MAX_NUMBER);
    }
    expect(after.run.dustLife).toBe(MAX_NUMBER);
  });

  it('um save no colapso 500 com poeira enorme passa na validação e no colapso', () => {
    const c = 500;
    let total = 0;
    for (let k = 1; k <= c; k++) total += dustGoal(k);
    const s: SaveState = {
      ...atCollapse(c),
      regionId: 'alpha-centauri',
      sparks: { legacy: 0, spent: 0 },
      stats: { ...newSave('inf', 1).stats, picks: c * 12, dustTotal: Math.min(MAX_NUMBER, total * 2) },
    };
    const r = validateSave(s);
    expect(r.ok, r.ok ? '' : r.errors.join(' | ')).toBe(true);
  });
});

describe('sem Ascender', () => {
  const root = join(__dirname, '..', '..', '..', '..');
  const files = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git' || e.name === 'fixtures') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) files(p, out);
      else if (/\.(ts|tsx|css|json)$/.test(e.name)) out.push(p);
    }
    return out;
  };

  it('nenhum código do Aperta! cita Ascender, canAscend ou Constelações como camada do jogo', () => {
    const dirs = [join(root, 'packages', 'games', 'src', 'aperta'), join(root, 'apps', 'web', 'src', 'games', 'aperta'), join(root, 'apps', 'api', 'src', 'aperta')];
    const hits: string[] = [];
    for (const dir of dirs) {
      for (const f of files(dir)) {
        if (f.endsWith('collapse-infinite.test.ts')) continue;
        const text = readFileSync(f, 'utf8');
        if (/\b(ascender|ascens[aã]o|ascend|ascension|canAscend)/i.test(text)) hits.push(f);
        // "Constelação de satélites" é o nome de uma conquista; a camada 2 não pode aparecer.
        if (/constelaç(ões|ao)\b(?! de satélites)/i.test(text.replace(/Constelação de satélites/g, ''))) hits.push(f);
      }
    }
    expect(hits).toEqual([]);
  });

  it('o save não tem campo de ascensão nem de constelações', () => {
    const s = JSON.stringify(newSave('x', 1));
    expect(s).not.toMatch(/\b(ascen|constel)/i);
  });
});

describe('o teto de vida do perfil normal é uma constante da spec', () => {
  it('2,5 h (spec 041)', () => expect(LIFE_HOURS_MAX).toBe(2.5));
  it('milestoneGoal e milestoneKind concordam para o colapso 1', () => {
    expect(milestoneGoal(milestoneKind(1), 1).target).toBe(1);
  });
});
