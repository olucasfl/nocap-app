import { describe, expect, it } from 'vitest';
import {
  createMemorySaveStore,
  DEFAULT_SAVE_NAME,
  playedAgo,
  RECOVERY_DAYS,
  saveStats,
} from './save-store';

const DAY = 86_400_000;

function setup() {
  let t = Date.parse('2026-10-21T12:00:00Z');
  const store = createMemorySaveStore(() => t);
  return { store, advance: (ms: number) => (t += ms) };
}

describe('SaveStore', () => {
  it('começa com os 2 espaços vazios', async () => {
    expect(await setup().store.list()).toEqual([null, null]);
  });

  it('cria um novo jogo no espaço pedido, sem história vista', async () => {
    const { store } = setup();
    const save = await store.create(2);
    expect(save).toMatchObject({ slot: 2, name: DEFAULT_SAVE_NAME, collapses: 0, storySeen: false });
    const list = await store.list();
    expect(list[0]).toBeNull();
    expect(list[1]?.slot).toBe(2);
  });

  it('recusa criar em espaço ocupado', async () => {
    const { store } = setup();
    await store.create(1);
    await expect(store.create(1)).rejects.toThrow();
  });

  it('apagar esvazia o espaço, e dá para recuperar dentro do prazo', async () => {
    const { store, advance } = setup();
    await store.create(1);
    await store.remove(1);
    expect((await store.list())[0]).toBeNull();
    advance((RECOVERY_DAYS - 1) * DAY);
    expect((await store.restore(1))?.slot).toBe(1);
    expect((await store.list())[0]?.slot).toBe(1);
  });

  it('depois de 7 dias o save apagado não volta mais', async () => {
    const { store, advance } = setup();
    await store.create(1);
    await store.remove(1);
    advance(RECOVERY_DAYS * DAY + 1000);
    expect(await store.restore(1)).toBeNull();
    expect((await store.list())[0]).toBeNull();
  });

  it('não recupera um save que já está vivo', async () => {
    const { store } = setup();
    await store.create(1);
    expect(await store.restore(1)).toBeNull();
  });

  it('guarda que a história foi vista', async () => {
    const { store } = setup();
    await store.create(1);
    await store.markStorySeen(1);
    expect((await store.list())[0]?.storySeen).toBe(true);
  });
});

describe('textos da lista de saves', () => {
  it('conta colapsos e páginas no singular e no plural', () => {
    const base = { slot: 1 as const, name: 'x', lastPlayedAt: '', storySeen: true };
    expect(saveStats({ ...base, collapses: 1, atlasPages: 1 })).toBe('1 colapso · 1 página no Atlas');
    expect(saveStats({ ...base, collapses: 0, atlasPages: 3 })).toBe('0 colapsos · 3 páginas no Atlas');
  });

  it('diz há quanto tempo jogou', () => {
    const now = Date.parse('2026-10-21T12:00:00Z');
    const ago = (ms: number) => playedAgo(new Date(now - ms).toISOString(), now);
    expect(ago(30_000)).toBe('Jogado agora há pouco');
    expect(ago(15 * 60_000)).toBe('Jogado há 15 min');
    expect(ago(3 * 3_600_000)).toBe('Jogado há 3 h');
    expect(ago(DAY)).toBe('Jogado há 1 dia');
    expect(ago(2 * DAY)).toBe('Jogado há 2 dias');
  });
});
