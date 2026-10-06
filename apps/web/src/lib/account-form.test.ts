import { describe, expect, it } from 'vitest';
import { isEmail, normalizeUsername, validateLogin, validateRegister } from './account-form';

const ok = {
  username: 'lucas_01',
  name: 'Lucas Farias',
  email: 'lucas@exemplo.com',
  password: 'senha-forte',
  confirm: 'senha-forte',
};

describe('validateRegister', () => {
  it('aceita um cadastro válido', () => {
    expect(validateRegister(ok)).toEqual({});
  });

  it('aceita usuário com maiúscula e espaço nas pontas (é normalizado)', () => {
    expect(validateRegister({ ...ok, username: '  Lucas_01 ' })).toEqual({});
    expect(normalizeUsername('  Lucas_01 ')).toBe('lucas_01');
  });

  it('recusa usuário curto, longo ou com caractere inválido', () => {
    for (const username of ['ab', 'a'.repeat(21), 'lu cas', 'lucas!', 'lúcas']) {
      expect(validateRegister({ ...ok, username }).username).toBeDefined();
    }
  });

  it('recusa nome vazio, e-mail inválido e senha curta', () => {
    expect(validateRegister({ ...ok, name: ' ' }).name).toBeDefined();
    expect(validateRegister({ ...ok, email: 'lucas@' }).email).toBeDefined();
    const short = validateRegister({ ...ok, password: '1234567', confirm: '1234567' });
    expect(short.password).toBeDefined();
  });

  it('recusa senhas diferentes', () => {
    expect(validateRegister({ ...ok, confirm: 'outra-senha' }).confirm).toBeDefined();
  });
});

describe('login', () => {
  it('distingue e-mail de usuário pelo @', () => {
    expect(isEmail('lucas@exemplo.com')).toBe(true);
    expect(isEmail('lucas_01')).toBe(false);
  });

  it('exige os dois campos', () => {
    expect(validateLogin('', '')).toEqual({
      identifier: expect.any(String),
      password: expect.any(String),
    });
    expect(validateLogin('lucas', 'x')).toEqual({});
  });
});
