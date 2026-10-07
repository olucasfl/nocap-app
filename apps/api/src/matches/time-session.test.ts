import { describe, expect, it } from 'vitest';
import { SESSION_MAX_AGE_MS, issueTimeSession, verifyTimeSession } from './time-session';

const KEY = 'chave-de-teste';
const NOW = 1_800_000_000_000;

describe('sessão do Tempo', () => {
  it('uma sessão emitida é verificada, com a seed e o instante de início', () => {
    const token = issueTimeSession('abc', NOW, KEY);
    expect(verifyTimeSession(token, NOW + 5000, KEY)).toEqual({ seed: 'abc', issuedAt: NOW });
  });

  it('assinatura adulterada, outra chave e lixo são recusados', () => {
    const token = issueTimeSession('abc', NOW, KEY);
    const [payload] = token.split('.');
    expect(verifyTimeSession(`${payload}.assinatura-falsa`, NOW, KEY)).toBeNull();
    expect(verifyTimeSession(token, NOW, 'outra-chave')).toBeNull();
    expect(verifyTimeSession('lixo', NOW, KEY)).toBeNull();
    expect(verifyTimeSession('a.b.c', NOW, KEY)).toBeNull();
    expect(verifyTimeSession('', NOW, KEY)).toBeNull();
  });

  it('não dá para trocar a seed de uma sessão assinada', () => {
    const token = issueTimeSession('abc', NOW, KEY);
    const [, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ seed: 'facil', issuedAt: NOW })).toString(
      'base64url',
    );
    expect(verifyTimeSession(`${forged}.${sig}`, NOW, KEY)).toBeNull();
  });

  it('recusa sessão do futuro e sessão expirada', () => {
    const token = issueTimeSession('abc', NOW, KEY);
    expect(verifyTimeSession(token, NOW - 1, KEY)).toBeNull();
    expect(verifyTimeSession(token, NOW + SESSION_MAX_AGE_MS, KEY)).not.toBeNull();
    expect(verifyTimeSession(token, NOW + SESSION_MAX_AGE_MS + 1, KEY)).toBeNull();
  });
});
