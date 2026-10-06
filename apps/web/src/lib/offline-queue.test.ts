import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-client';
import { createOfflineQueue, type QueueStore } from './offline-queue';

type Item = { matchId: string };

function memoryStore(): QueueStore<Item> & { size: () => number } {
  const map = new Map<string, Item>();
  return {
    add: async (id, item) => void map.set(id, item),
    all: async () => [...map].map(([id, item]) => ({ id, item })),
    remove: async (id) => void map.delete(id),
    size: () => map.size,
  };
}

const offline = () => Promise.reject(new TypeError('Failed to fetch'));

describe('offline queue', () => {
  it('envia direto quando há conexão', async () => {
    const store = memoryStore();
    const q = createOfflineQueue(store, vi.fn().mockResolvedValue({}));
    expect(await q.submit({ matchId: 'a' })).toBe('sent');
    expect(store.size()).toBe(0);
  });

  it('guarda na fila quando está sem rede ou o servidor falha', async () => {
    const store = memoryStore();
    expect(await createOfflineQueue(store, offline).submit({ matchId: 'a' })).toBe('queued');
    const down = () => Promise.reject(new ApiError(503, 'x'));
    expect(await createOfflineQueue(store, down).submit({ matchId: 'b' })).toBe('queued');
    expect(store.size()).toBe(2);
  });

  it('não enfileira o que a API recusou de vez (4xx)', async () => {
    const store = memoryStore();
    const bad = () => Promise.reject(new ApiError(400, 'x'));
    expect(await createOfflineQueue(store, bad).submit({ matchId: 'a' })).toBe('rejected');
    expect(store.size()).toBe(0);
  });

  it('o mesmo matchId não duplica na fila', async () => {
    const store = memoryStore();
    const q = createOfflineQueue(store, offline);
    await q.submit({ matchId: 'a' });
    await q.submit({ matchId: 'a' });
    expect(store.size()).toBe(1);
  });

  it('flush envia em ordem e esvazia a fila', async () => {
    const store = memoryStore();
    await createOfflineQueue(store, offline).submit({ matchId: 'a' });
    await createOfflineQueue(store, offline).submit({ matchId: 'b' });
    const send = vi.fn().mockResolvedValue({});
    expect(await createOfflineQueue(store, send).flush()).toBe(2);
    expect(send.mock.calls.map((c) => (c[0] as Item).matchId)).toEqual(['a', 'b']);
    expect(store.size()).toBe(0);
  });

  it('flush para no primeiro erro recuperável e mantém o resto', async () => {
    const store = memoryStore();
    await createOfflineQueue(store, offline).submit({ matchId: 'a' });
    await createOfflineQueue(store, offline).submit({ matchId: 'b' });
    expect(await createOfflineQueue(store, offline).flush()).toBe(0);
    expect(store.size()).toBe(2);
  });

  it('flush descarta item que a API recusa de vez e segue em frente', async () => {
    const store = memoryStore();
    await createOfflineQueue(store, offline).submit({ matchId: 'a' });
    await createOfflineQueue(store, offline).submit({ matchId: 'b' });
    const send = vi.fn().mockRejectedValueOnce(new ApiError(422, 'x')).mockResolvedValueOnce({});
    expect(await createOfflineQueue(store, send).flush()).toBe(2);
    expect(store.size()).toBe(0);
  });

  it('flush concorrente roda uma vez só', async () => {
    const store = memoryStore();
    await createOfflineQueue(store, offline).submit({ matchId: 'a' });
    const send = vi.fn().mockResolvedValue({});
    const q = createOfflineQueue(store, send);
    await Promise.all([q.flush(), q.flush()]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
