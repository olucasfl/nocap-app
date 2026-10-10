import { describe, expect, it } from 'vitest';
import { ONLINE_MS, PresenceService } from './presence.service';

function setup() {
  let t = 1_000_000;
  // Sem banco: só a memória (o caminho do banco é o mesmo, com a tabela user_presence).
  const service = new PresenceService(null, () => t);
  return { service, advance: (ms: number) => (t += ms) };
}

describe('PresenceService', () => {
  it('quem nunca bateu é offline e sem última visita', async () => {
    const { service } = setup();
    expect((await service.of(['ana'])).get('ana')).toEqual({ online: false, lastSeenAt: null });
  });

  it('depois do batimento a pessoa fica online, com a hora da última visita', async () => {
    const { service } = setup();
    await service.touch('ana');
    const p = (await service.of(['ana'])).get('ana')!;
    expect(p.online).toBe(true);
    expect(new Date(p.lastSeenAt!).getTime()).toBe(1_000_000);
  });

  it('sem batimento por mais que o limite vira offline, mas lembra quando saiu', async () => {
    const { service, advance } = setup();
    await service.touch('ana');
    advance(ONLINE_MS - 1);
    expect((await service.of(['ana'])).get('ana')!.online).toBe(true);
    advance(2);
    const p = (await service.of(['ana'])).get('ana')!;
    expect(p.online).toBe(false);
    expect(new Date(p.lastSeenAt!).getTime()).toBe(1_000_000);
  });

  it('um novo batimento renova o online e a última visita', async () => {
    const { service, advance } = setup();
    await service.touch('ana');
    advance(ONLINE_MS + 10);
    await service.touch('ana');
    const p = (await service.of(['ana'])).get('ana')!;
    expect(p.online).toBe(true);
    expect(new Date(p.lastSeenAt!).getTime()).toBe(1_000_000 + ONLINE_MS + 10);
  });

  it('cada conta tem o seu estado', async () => {
    const { service } = setup();
    await service.touch('ana');
    const m = await service.of(['ana', 'bia']);
    expect(m.get('ana')!.online).toBe(true);
    expect(m.get('bia')!.online).toBe(false);
  });
});
