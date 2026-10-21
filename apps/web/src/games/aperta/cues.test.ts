import { describe, expect, it } from 'vitest';
import { cuesFor, type CueInput } from './cues';

const base: CueInput = { starReady: false, eventId: null, missionDone: false, region: 'solar', freshKey: null };

describe('sons de transição do Aperta!', () => {
  it('montar a tela (sem estado anterior) não faz barulho, mesmo com tudo ligado', () => {
    expect(cuesFor(null, { ...base, starReady: true, eventId: 'solar-storm', missionDone: true })).toEqual([]);
  });

  it('só dispara na borda de subida e não repete enquanto o estado fica igual', () => {
    const ready = { ...base, starReady: true };
    expect(cuesFor(base, ready)).toEqual(['ready']);
    expect(cuesFor(ready, ready)).toEqual([]);
    expect(cuesFor(ready, base)).toEqual([]);
  });

  it('cada evento tem seu som, e um evento já ativo não toca de novo', () => {
    expect(cuesFor(base, { ...base, eventId: 'meteor-shower' })).toEqual(['shower']);
    expect(cuesFor(base, { ...base, eventId: 'solar-storm' })).toEqual(['storm']);
    const live = { ...base, eventId: 'solar-storm' };
    expect(cuesFor(live, live)).toEqual([]);
    expect(cuesFor(live, base)).toEqual([]);
  });

  it('missão cumprida soa uma vez; nova missão (done volta a falso) é silêncio', () => {
    const done = { ...base, missionDone: true };
    expect(cuesFor(base, done)).toEqual(['mission']);
    expect(cuesFor(done, base)).toEqual([]);
  });

  it('trocar de região pelo menu faz warp; trocar ao colapsar só toca o sino da faixa nova', () => {
    expect(cuesFor(base, { ...base, region: 'belt' })).toEqual(['warp']);
    expect(cuesFor(base, { ...base, region: 'belt', freshKey: 'collapse:1' })).toEqual(['chime']);
    expect(cuesFor({ ...base, freshKey: 'collapse:1' }, { ...base, freshKey: null })).toEqual([]);
  });
});
