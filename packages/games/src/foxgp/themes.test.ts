import { describe, expect, it } from 'vitest';
import { GP_THEMES, gpValidKartPaint, gpValidPaint } from './paint';

describe('temas da garagem', () => {
  it('são 8, com nomes e ids únicos, e todos valem para a sala', () => {
    expect(GP_THEMES).toHaveLength(8);
    expect(new Set(GP_THEMES.map((t) => t.id)).size).toBe(8);
    expect(new Set(GP_THEMES.map((t) => t.name)).size).toBe(8);
    for (const t of GP_THEMES) {
      expect(gpValidPaint(t.f1), t.id).not.toBeNull();
      expect(gpValidKartPaint(t.kart), t.id).not.toBeNull();
      expect(t.f1.body, t.id).not.toBe(t.f1.accent);
    }
  });
});
