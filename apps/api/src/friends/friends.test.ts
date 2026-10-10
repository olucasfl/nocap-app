import { describe, expect, it } from 'vitest';
import { escapeLike, type FriendshipRow, type FriendsRepository } from './friends.repository';
import { FriendsService, MAX_PENDING_OUT } from './friends.service';

const users = [
  { id: 'u-ana', username: 'ana' },
  { id: 'u-ana_b', username: 'ana_b' },
  { id: 'u-bia', username: 'bia' },
  { id: 'u-caio', username: 'caio' },
];

/** Repositório em memória com a mesma semântica do de Postgres. */
function fakeRepo(seed: { outgoing?: number } = {}) {
  let rows: FriendshipRow[] = Array.from({ length: seed.outgoing ?? 0 }, (_, i) => ({
    id: `seed${i}`,
    requesterId: 'u-ana',
    addresseeId: `u-ghost-${i}`,
    status: 'pending',
  }));
  let n = 0;
  const between = (a: string, b: string) =>
    rows.find(
      (r) =>
        (r.requesterId === a && r.addresseeId === b) ||
        (r.requesterId === b && r.addresseeId === a),
    ) ?? null;
  const nameOf = (id: string) => users.find((u) => u.id === id)!.username;
  const repo = {
    findUserByUsername: async (name: string) => users.find((u) => u.username === name) ?? null,
    searchUsers: async (prefix: string, exclude: string, limit: number) =>
      users.filter((u) => u.username.startsWith(prefix) && u.id !== exclude).slice(0, limit),
    findBetween: async (a: string, b: string) => between(a, b),
    relationsWith: async (me: string, others: string[]) =>
      rows.filter(
        (r) =>
          (r.requesterId === me && others.includes(r.addresseeId)) ||
          (r.addresseeId === me && others.includes(r.requesterId)),
      ),
    create: async (requesterId: string, addresseeId: string) => {
      rows.push({ id: `f${++n}`, requesterId, addresseeId, status: 'pending' });
    },
    accept: async (id: string) => {
      rows = rows.map((r) => (r.id === id ? { ...r, status: 'accepted' } : r));
    },
    remove: async (id: string) => {
      rows = rows.filter((r) => r.id !== id);
    },
    listFor: async (me: string) =>
      rows
        .filter((r) => r.requesterId === me || r.addresseeId === me)
        .map((r) => ({
          ...r,
          otherUsername: nameOf(r.requesterId === me ? r.addresseeId : r.requesterId),
        })),
    countOutgoingPending: async (me: string) =>
      rows.filter((r) => r.requesterId === me && r.status === 'pending').length,
    friendIds: async (me: string) =>
      rows
        .filter((r) => r.status === 'accepted' && (r.requesterId === me || r.addresseeId === me))
        .map((r) => (r.requesterId === me ? r.addresseeId : r.requesterId)),
  };
  return new FriendsService(repo as unknown as FriendsRepository);
}

const ANA = 'u-ana';
const BIA = 'u-bia';

describe('FriendsService', () => {
  it('pedido, aceite e amigos nos dois lados', async () => {
    const s = fakeRepo();
    expect(await s.request(ANA, 'bia')).toEqual({ state: 'outgoing' });
    expect((await s.list(BIA)).incoming).toEqual([{ username: 'ana' }]);
    expect((await s.list(ANA)).outgoing).toEqual([{ username: 'bia' }]);
    await s.accept(BIA, 'ana');
    expect((await s.list(ANA)).friends).toMatchObject([{ username: 'bia', online: false }]);
    expect((await s.list(BIA)).friends).toMatchObject([{ username: 'ana' }]);
  });

  it('pedido cruzado vira amizade na hora', async () => {
    const s = fakeRepo();
    await s.request(ANA, 'bia');
    expect(await s.request(BIA, 'ana')).toEqual({ state: 'friends' });
    expect((await s.list(ANA)).friends).toHaveLength(1);
  });

  it('recusa pedir para si, duplicar, pedir a amigo e usuário inexistente', async () => {
    const s = fakeRepo();
    await expect(s.request(ANA, 'ana')).rejects.toThrow('você mesmo');
    await expect(s.request(ANA, 'ninguem')).rejects.toThrow('Não achamos');
    await s.request(ANA, 'bia');
    await expect(s.request(ANA, 'bia')).rejects.toThrow('já enviado');
    await s.accept(BIA, 'ana');
    await expect(s.request(ANA, 'bia')).rejects.toThrow('já são amigos');
  });

  it('só quem recebeu pode aceitar ou recusar', async () => {
    const s = fakeRepo();
    await s.request(ANA, 'bia');
    await expect(s.accept(ANA, 'bia')).rejects.toThrow('Não há pedido');
    await expect(s.decline(ANA, 'bia')).rejects.toThrow('Não há pedido');
    await s.decline(BIA, 'ana');
    expect(await s.list(ANA)).toEqual({ friends: [], incoming: [], outgoing: [] });
  });

  it('cancelar pedido enviado e remover amigo apagam; quem recebeu não remove pedido', async () => {
    const s = fakeRepo();
    await s.request(ANA, 'bia');
    await expect(s.remove(BIA, 'ana')).rejects.toThrow('não são amigos');
    await s.remove(ANA, 'bia');
    expect((await s.list(ANA)).outgoing).toEqual([]);
    await s.request(ANA, 'bia');
    await s.accept(BIA, 'ana');
    await s.remove(BIA, 'ana');
    expect((await s.list(ANA)).friends).toEqual([]);
  });

  it('a busca mostra o estado da relação e só o @usuário', async () => {
    const s = fakeRepo();
    await s.request(ANA, 'bia');
    await s.request('u-caio', 'ana');
    const found = await s.search(ANA, 'a');
    expect(found).toEqual([{ username: 'ana_b', state: 'none' }]);
    const all = [...(await s.search(ANA, 'b')), ...(await s.search(ANA, 'c'))];
    expect(all).toEqual([
      { username: 'bia', state: 'outgoing' },
      { username: 'caio', state: 'incoming' },
    ]);
    expect(JSON.stringify([...found, ...all])).not.toMatch(/u-|email|"name"/);
  });

  it('o círculo para o ranking tem você e só amigos aceitos', async () => {
    const s = fakeRepo();
    await s.request(ANA, 'bia');
    expect(await s.circleOf(ANA)).toEqual([ANA]);
    await s.accept(BIA, 'ana');
    expect(await s.circleOf(ANA)).toEqual([ANA, BIA]);
  });
});

describe('limite de pedidos pendentes', () => {
  it('quem enviou pedidos demais sem resposta não consegue mandar outro', async () => {
    const s = fakeRepo({ outgoing: MAX_PENDING_OUT });
    await expect(s.request(ANA, 'bia')).rejects.toThrow('pedidos demais');
  });

  it('abaixo do limite o pedido sai normalmente', async () => {
    const s = fakeRepo({ outgoing: MAX_PENDING_OUT - 1 });
    await expect(s.request(ANA, 'bia')).resolves.toEqual({ state: 'outgoing' });
  });
});

describe('escapeLike', () => {
  it('escapa curingas do LIKE (o _ é comum em @usuário)', () => {
    expect(escapeLike('a_b%c\\d')).toBe('a\\_b\\%c\\\\d');
  });
});
