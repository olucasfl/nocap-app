// Saves reais de antes da spec 040 (etapa 14): instantâneos do simulador com o motor daquela época
// (`fixtures/legacy-*.json`, gerados com o código do commit 1293fd1, sem os contadores do marco da vida,
// sem `doneAt` na missão e com as metas de poeira antigas). Eles têm que continuar abrindo e jogando.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dustGoal, minPicks } from './economy';
import { canCollapse, collapse, collapseProgress, press, type SaveState } from './engine';
import { meetMilestone } from './milestone';
import { mergeSaves, validateSave } from './save';
import { achievementById } from './achievements';
import { sparksAvailable } from './sparks';
import { ATLAS_PAGE_SPARKS } from './forbidden';

const dir = join(__dirname, 'fixtures');
const names = readdirSync(dir).filter((f) => f.startsWith('legacy-') && f.endsWith('.json'));
const load = (name: string): Record<string, unknown> => JSON.parse(readFileSync(join(dir, name), 'utf8')) as Record<string, unknown>;
const opts = (raw: Record<string, unknown>) => {
  const created = raw.createdAt as number;
  return { createdAtMs: created, nowMs: created + (raw.playSeconds as number) * 1000 + 60_000 };
};

describe('saves antigos (anteriores à spec 040)', () => {
  it('há saves de várias fases: vida 1 a 5, com e sem escolha aberta', () => {
    expect(names.length).toBeGreaterThanOrEqual(10);
    const collapses = new Set(names.map((n) => (load(n).collapses as number)));
    expect([...collapses].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(names.some((n) => load(n).run && (load(n).run as { pending: unknown }).pending !== null)).toBe(true);
  });

  it.each(names)('%s abre, sem recusar nem cortar nada', (name) => {
    const raw = load(name);
    // Prova de que é antigo: não tem os campos novos.
    expect((raw.run as Record<string, unknown>).captured).toBeUndefined();
    expect((raw.run as Record<string, unknown>).chainBest).toBeUndefined();
    const r = validateSave(raw, opts(raw));
    expect(r.ok, r.ok ? '' : r.errors.join(' | ')).toBe(true);
    if (!r.ok) return;
    // Só a energia pode ser aparada: a barra do grimório ficou mais curta (passo x1,22 em vez de x1,35), e quem
    // estava com a barra quase cheia passa do teto novo e ganha a escolha na hora. Poeira e o resto ficam como estavam.
    expect(r.flagged.filter((f) => f !== 'energy')).toEqual([]);
    if (r.flagged.includes('energy')) expect(r.save.run.energy).toBeLessThan(raw.run ? (raw.run as { energy: number }).energy : Infinity);
    // Os campos novos entram zerados.
    const mission = (raw.run as { mission?: { done?: boolean } | null }).mission;
    expect(r.save.run).toMatchObject({ captured: 0, rares: 0, chain: 0, chainBest: 0, fullBest: 0, missionsDone: mission?.done ? 1 : 0 });
    // Nada do que a pessoa tem se perdeu.
    expect(r.save.collapses).toBe(raw.collapses);
    expect(r.save.run.build).toEqual((raw.run as { build: unknown }).build);
    expect(r.save.run.dustLife).toBe((raw.run as { dustLife: number }).dustLife);
    expect(r.save.album).toEqual(raw.album);
    // O Atlas virou Cintilas (valor fixo por página) e o Cofre começa vazio.
    expect((r.save as unknown as Record<string, unknown>).atlas).toBeUndefined();
    expect(r.save.version).toBe(3);
    expect(r.save.vault).toEqual({});
    expect(r.save.seals).toBe(0);
  });

  it.each(names)('%s continua jogando: toca, grava e abre de novo', (name) => {
    const raw = load(name);
    const r = validateSave(raw, opts(raw));
    if (!r.ok) throw new Error(r.errors.join(' | '));
    let s: SaveState = r.save;
    for (let i = 1; i <= 20; i++) s = press(s, s.clock + 0.3);
    expect(s.run.dust).toBeGreaterThanOrEqual(r.save.run.dust);
    const again = validateSave(JSON.parse(JSON.stringify(s)), { createdAtMs: s.createdAt, nowMs: s.createdAt + s.playSeconds * 1000 + 60_000 });
    expect(again.ok, again.ok ? '' : again.errors.join(' | ')).toBe(true);
  });

  it.each(names)('%s: os Fragmentos viram Cintilas 1:1 (saldo e gasto) e os totais novos entram zerados', (name) => {
    const raw = load(name);
    const frag = raw.fragments as { earned: number; spent: number };
    expect(frag).toBeDefined();
    expect(raw.sparks).toBeUndefined();
    const r = validateSave(raw, opts(raw));
    if (!r.ok) throw new Error(r.errors.join(' | '));
    const pages = (raw.atlas as { pages: unknown[] }).pages.length;
    expect(r.save.sparks).toEqual({ legacy: frag.earned + pages * ATLAS_PAGE_SPARKS, spent: frag.spent });
    expect((r.save as unknown as Record<string, unknown>).fragments).toBeUndefined();
    // Quem migrou nunca fica com saldo menor que o de antes (as fontes novas só somam).
    expect(sparksAvailable(r.save)).toBeGreaterThanOrEqual(frag.earned - frag.spent);
    expect(r.save.stats).toMatchObject({ raresCaptured: 0, rareStreak: 0, forbiddenBest: {}, eventsSeen: [] });
    // As conquistas que o save já tinha continuam e valem Cintilas.
    for (const id of r.save.achievements) expect(achievementById(id), id).toBeDefined();
  });

  it('a junção entre um save antigo e ele mesmo não perde nada', () => {
    const raw = load(names[0] as string);
    const r = validateSave(raw, opts(raw));
    if (!r.ok) throw new Error('save antigo recusado');
    const merged = mergeSaves(r.save, r.save);
    expect(merged.conflict).toBe(false);
    expect(merged.save.run.dustLife).toBe(r.save.run.dustLife);
  });

  it('a vida de 8 h já passou da meta de poeira nova, mas o colapso espera o marco da vida', () => {
    const raw = load('legacy-life1-7h.json');
    const r = validateSave(raw, opts(raw));
    if (!r.ok) throw new Error(r.errors.join(' | '));
    const p = collapseProgress(r.save);
    expect(p.dust).toBeGreaterThan(dustGoal(1));
    expect(p.picks).toBeGreaterThanOrEqual(minPicks(1) - 5);
    expect(p.milestone.done).toBe(false);
    expect(canCollapse(r.save)).toBe(false);
    // Cumprido o marco (e as escolhas), o colapso funciona e a vida nova segue as regras novas.
    const ok: SaveState = {
      ...r.save,
      run: { ...r.save.run, picks: Math.max(r.save.run.picks, minPicks(1)), ...meetMilestone(0, r.save.run.upgradeLevels) },
      stats: { ...r.save.stats, picks: Math.max(r.save.stats.picks, minPicks(1)) },
    };
    const after = collapse(ok);
    expect(after.collapses).toBe(1);
    expect(collapseProgress(after).dustGoal).toBe(dustGoal(2));
    const v = validateSave(JSON.parse(JSON.stringify(after)));
    expect(v.ok, v.ok ? '' : v.errors.join(' | ')).toBe(true);
  });

  it('missão cumprida num save antigo vira uma missão feita no contador novo', () => {
    const raw = load('legacy-life5-1h.json');
    const run = raw.run as { mission?: unknown };
    run.mission = { id: 'touch-600', progress: 600, done: true };
    const r = validateSave(raw, opts(raw));
    expect(r.ok, r.ok ? '' : r.errors.join(' | ')).toBe(true);
    if (r.ok) {
      expect(r.save.run.missionsDone).toBe(1);
      expect(r.save.run.mission).toMatchObject({ id: 'touch-600', done: true });
    }
  });

  it('um save antigo no colapso 4 cuja poeira total é menor que a exigida pelas regras antigas é recusado', () => {
    const raw = load('legacy-life5-1h.json');
    (raw.stats as { dustTotal: number }).dustTotal = 1000;
    const r = validateSave(raw, opts(raw));
    expect(r.ok).toBe(false);
    expect(r.ok ? '' : r.errors.join(' ')).toContain('Poeira total menor');
  });
});
