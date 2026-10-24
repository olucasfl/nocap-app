import { afterEach, describe, expect, it, vi } from 'vitest';
import { releaseOrientation, tryLockLandscape } from './aperta-orientation';

function env(opts: { coarse: boolean; lock?: () => Promise<void>; fullscreen?: () => Promise<void> }) {
  vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: opts.coarse && q.includes('coarse') }) });
  vi.stubGlobal('screen', { orientation: { lock: opts.lock, unlock: vi.fn() } });
  vi.stubGlobal('document', {
    fullscreenElement: null,
    documentElement: { requestFullscreen: opts.fullscreen ?? vi.fn().mockResolvedValue(undefined) },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('travar em paisagem (Aperta!)', () => {
  it('não faz nada com mouse', async () => {
    const lock = vi.fn().mockResolvedValue(undefined);
    env({ coarse: false, lock });
    await tryLockLandscape();
    expect(lock).not.toHaveBeenCalled();
  });

  it('trava em paisagem no toque', async () => {
    const lock = vi.fn().mockResolvedValue(undefined);
    env({ coarse: true, lock });
    await tryLockLandscape();
    expect(lock).toHaveBeenCalledWith('landscape');
  });

  it('se o navegador recusa, entra em tela cheia, tenta de novo e nunca lança', async () => {
    const lock = vi.fn().mockRejectedValueOnce(new Error('NotSupported')).mockResolvedValue(undefined);
    const fullscreen = vi.fn().mockResolvedValue(undefined);
    env({ coarse: true, lock, fullscreen });
    await expect(tryLockLandscape()).resolves.toBeUndefined();
    expect(fullscreen).toHaveBeenCalled();
    expect(lock).toHaveBeenCalledTimes(2);
  });

  it('sem suporte a lock (iOS) não lança', async () => {
    env({ coarse: true });
    await expect(tryLockLandscape()).resolves.toBeUndefined();
  });

  it('soltar a trava não lança sem suporte', () => {
    vi.stubGlobal('screen', {});
    vi.stubGlobal('document', { fullscreenElement: null });
    expect(() => releaseOrientation()).not.toThrow();
  });
});
