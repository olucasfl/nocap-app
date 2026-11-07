import { beforeEach, describe, expect, it } from 'vitest';
import { FS_DEFAULTS, useFsSettings } from '@/games/foxshot/fs-settings';
import { applyPrefs, collectPrefs } from './prefs-sync';

describe('preferências na conta', () => {
  beforeEach(() => useFsSettings.getState().reset());

  it('sobe só o que vale em qualquer aparelho (sem desempenho nem tela cheia)', () => {
    const p = collectPrefs();
    expect(p.fs).toHaveProperty('sens');
    expect(p.fs).toHaveProperty('binds');
    expect(p.fs).not.toHaveProperty('quality');
    expect(p.fs).not.toHaveProperty('showTelemetry');
    expect(p.fs).not.toHaveProperty('fullscreenLock');
  });

  it('aplica o que veio da conta e ignora valor de tipo errado', () => {
    applyPrefs({ fs: { sens: 0.3, fov: 'x' as never, binds: { fire: 'KeyX' } } });
    const s = useFsSettings.getState();
    expect(s.sens).toBe(0.3);
    expect(s.fov).toBe(FS_DEFAULTS.fov);
    expect(s.binds.fire).toBe('KeyX');
    expect(s.binds.jump).toBe('Space');
  });
});
