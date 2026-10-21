import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apertaSfx,
  apertaVibrate,
  clackFrequency,
  setVibrationEnabled,
  vibrationEnabled,
} from './aperta-audio';
import { isMuted, toggleMute } from './sfx';

function stubStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('clack do Aperta!', () => {
  it('sobe de tom a cada nível do combo e trava na nota mais aguda', () => {
    const freqs = Array.from({ length: 12 }, (_, i) => clackFrequency(i));
    for (let i = 1; i < 10; i++) expect(freqs[i]).toBeGreaterThan(freqs[i - 1]!);
    expect(freqs[10]).toBe(freqs[9]);
    expect(freqs[11]).toBe(freqs[9]);
  });

  it('combo inválido ou negativo cai na nota mais grave', () => {
    expect(clackFrequency(-3)).toBe(clackFrequency(0));
    expect(clackFrequency(Number.NaN)).toBe(clackFrequency(0));
  });

  it('não quebra em navegador sem Web Audio', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', {});
    expect(() => apertaSfx.clack(3)).not.toThrow();
  });
});

describe('vibração', () => {
  it('não vibra quando está desligada', () => {
    stubStorage({ 'nocap-aperta-vibrate': '0' });
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    expect(apertaVibrate()).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('vibra quando ligada e guarda a escolha', () => {
    stubStorage();
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    expect(vibrationEnabled()).toBe(true);
    expect(apertaVibrate(12)).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(12);
    setVibrationEnabled(false);
    expect(vibrationEnabled()).toBe(false);
  });

  it('sem navigator.vibrate (iOS) é silencioso', () => {
    stubStorage();
    vi.stubGlobal('navigator', {});
    expect(apertaVibrate()).toBe(false);
  });
});

describe('vibração e mudo', () => {
  it('o mudo cala a vibração e desmudar a devolve', () => {
    stubStorage();
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    vi.stubGlobal('window', {}); // sem AudioContext: o clack do botão de mudo vira silêncio
    if (isMuted()) toggleMute();
    expect(apertaVibrate(8)).toBe(true);
    toggleMute();
    expect(isMuted()).toBe(true);
    vibrate.mockClear();
    expect(apertaVibrate(8)).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
    toggleMute();
    expect(apertaVibrate(8)).toBe(true);
  });
});
