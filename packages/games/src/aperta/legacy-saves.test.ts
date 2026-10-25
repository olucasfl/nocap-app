// Saves reais de antes da reformulação (spec 043): o modelo de itens mudou por completo, então o save antigo
// vira um save novo que só guarda o nome, a data de criação e a história já vista.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAVE_VERSION } from './engine';
import { validateSave } from './save';

const dir = join(__dirname, 'fixtures');
const names = readdirSync(dir).filter((f) => f.startsWith('legacy-') && f.endsWith('.json'));
const load = (name: string): Record<string, unknown> => JSON.parse(readFileSync(join(dir, name), 'utf8')) as Record<string, unknown>;
const opts = (raw: Record<string, unknown>) => {
  const created = raw.createdAt as number;
  return { createdAtMs: created, nowMs: created + (raw.playSeconds as number) * 1000 + 60_000 };
};

describe('saves antigos (antes da reformulação)', () => {
  it('há saves de várias fases', () => {
    expect(names.length).toBeGreaterThanOrEqual(10);
  });

  it.each(names)('%s abre como um save novo, mantendo nome, data e história vista', (name) => {
    const raw = load(name);
    const r = validateSave(raw, opts(raw));
    expect(r.ok, r.ok ? '' : r.errors.join(' | ')).toBe(true);
    if (!r.ok) return;
    const s = r.save;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.collapses).toBe(0);
    expect(s.run.dust).toBe(0);
    expect(s.run.upgradeLevels.every((l) => l === 0)).toBe(true);
    expect(s.name).toBe(raw.name);
    expect(s.createdAt).toBe(raw.createdAt);
  });
});
