import { describe, expect, it } from 'vitest';
import { cleanNickname, createGuestLimiter, isGuestId, nickKey, usernameLookalikes } from './guest-nick';

describe('apelido de convidado', () => {
  it('aceita apelidos comuns e arruma os espaços', () => {
    expect(cleanNickname('  Zé   da Silva ')).toEqual({ ok: true, nick: 'Zé da Silva' });
    expect(cleanNickname('ana_01')).toEqual({ ok: true, nick: 'ana_01' });
  });
  it('recusa curto, longo, vazio e caracteres estranhos', () => {
    for (const bad of ['', 'a', 'x'.repeat(17), '@lucas', '<b>oi</b>', '   ', '___', 42, null]) {
      expect(cleanNickname(bad).ok).toBe(false);
    }
  });
  it('a chave ignora acento, maiúscula e separadores', () => {
    expect(nickKey('Zé.Da_Silva')).toBe('zedasilva');
    expect(usernameLookalikes('Lu Cas')).toContain('lucas');
  });
  it('reconhece o id de convidado', () => {
    expect(isGuestId('guest:abc')).toBe(true);
    expect(isGuestId('7b1c')).toBe(false);
  });
  it('limita entradas por origem e libera depois da janela', () => {
    let t = 0;
    const ok = createGuestLimiter(2, 1000, () => t);
    expect([ok('ip'), ok('ip'), ok('ip')]).toEqual([true, true, false]);
    expect(ok('outro')).toBe(true);
    t = 1500;
    expect(ok('ip')).toBe(true);
  });
});
