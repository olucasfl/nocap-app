import { describe, expect, it } from 'vitest';
import { INVITE_TTL_MS, InvitesStore, MAX_PENDING_PER_USER } from './invites.store';

function setup() {
  let t = 1_000;
  const clock = { advance: (ms: number) => (t += ms) };
  return { store: new InvitesStore(() => t), clock };
}

const invite = (over: Partial<Parameters<InvitesStore['add']>[0]> = {}) => ({
  toUserId: 'bia',
  fromUserId: 'ana',
  fromUsername: 'ana',
  code: 'ABCD',
  ...over,
});
const open = () => true;

describe('InvitesStore', () => {
  it('guarda e lista o convite de quem recebeu, e só dele', () => {
    const { store } = setup();
    store.add(invite());
    expect(store.listFor('bia', open)).toHaveLength(1);
    expect(store.listFor('caio', open)).toHaveLength(0);
  });

  it('convites repetidos da mesma pessoa para a mesma sala viram um só, com o mesmo id', () => {
    const { store, clock } = setup();
    const first = store.add(invite());
    clock.advance(10);
    const second = store.add(invite());
    const list = store.listFor('bia', open);
    expect(list).toHaveLength(1);
    // Mesmo id: quem recebe não ganha aviso nem som novo por um reenvio.
    expect(list[0]!.id).toBe(first.id);
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBeGreaterThan(first.createdAt);
  });

  it('reenviar renova o prazo do convite', () => {
    const { store, clock } = setup();
    store.add(invite());
    clock.advance(INVITE_TTL_MS - 5);
    store.add(invite());
    clock.advance(10);
    expect(store.listFor('bia', open)).toHaveLength(1);
  });

  it('depois de recusado, um convite novo da mesma pessoa é aviso novo', () => {
    const { store } = setup();
    const first = store.add(invite());
    store.remove('bia', first.id);
    expect(store.add(invite()).id).not.toBe(first.id);
  });

  it('pessoas ou salas diferentes são convites diferentes, os mais novos primeiro', () => {
    const { store, clock } = setup();
    store.add(invite({ code: 'AAAA' }));
    clock.advance(10);
    store.add(invite({ code: 'BBBB', fromUserId: 'caio', fromUsername: 'caio' }));
    expect(store.listFor('bia', open).map((i) => i.code)).toEqual(['BBBB', 'AAAA']);
  });

  it('expira depois do prazo', () => {
    const { store, clock } = setup();
    store.add(invite());
    clock.advance(INVITE_TTL_MS - 1);
    expect(store.listFor('bia', open)).toHaveLength(1);
    clock.advance(2);
    expect(store.listFor('bia', open)).toHaveLength(0);
  });

  it('some quando a sala já não aceita gente (acabou, começou ou lotou)', () => {
    const { store } = setup();
    store.add(invite({ code: 'AAAA' }));
    store.add(invite({ code: 'BBBB', fromUserId: 'caio', fromUsername: 'caio' }));
    expect(store.listFor('bia', (code) => code === 'BBBB').map((i) => i.code)).toEqual(['BBBB']);
    // e não volta quando a sala "reabre"
    expect(store.listFor('bia', open).map((i) => i.code)).toEqual(['BBBB']);
  });

  it('recusar remove só aquele convite; id alheio não remove nada', () => {
    const { store } = setup();
    const a = store.add(invite({ code: 'AAAA' }));
    store.add(invite({ code: 'BBBB', fromUserId: 'caio', fromUsername: 'caio' }));
    expect(store.remove('bia', 'nao-existe')).toBe(false);
    expect(store.remove('caio', a.id)).toBe(false);
    expect(store.remove('bia', a.id)).toBe(true);
    expect(store.listFor('bia', open).map((i) => i.code)).toEqual(['BBBB']);
  });

  it('entrar na sala consome os convites dela', () => {
    const { store } = setup();
    store.add(invite({ code: 'AAAA' }));
    store.add(invite({ code: 'AAAA', fromUserId: 'caio', fromUsername: 'caio' }));
    store.add(invite({ code: 'BBBB', fromUserId: 'duda', fromUsername: 'duda' }));
    store.consumeCode('bia', 'AAAA');
    expect(store.listFor('bia', open).map((i) => i.code)).toEqual(['BBBB']);
  });

  it('limita os pendentes por pessoa, descartando os mais antigos', () => {
    const { store, clock } = setup();
    for (let i = 0; i < MAX_PENDING_PER_USER + 5; i++) {
      clock.advance(1);
      store.add(invite({ fromUserId: `u${i}`, fromUsername: `u${i}` }));
    }
    const list = store.listFor('bia', open);
    expect(list).toHaveLength(MAX_PENDING_PER_USER);
    expect(list.some((i) => i.fromUsername === 'u0')).toBe(false);
    expect(list[0]!.fromUsername).toBe(`u${MAX_PENDING_PER_USER + 4}`);
  });
});
