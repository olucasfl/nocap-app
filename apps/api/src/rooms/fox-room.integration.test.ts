import { createServer, type Server as HttpServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Auth } from '../auth/auth';
import { FoxRoom, roomDeps } from './color.room';

/**
 * A sala do Fox Cap! (spec 049) com o servidor Colyseus de verdade: nasce sem jogo, o líder escolhe e troca o jogo, e as
 * mensagens de cada jogo valem só enquanto o motor é dele.
 */
const webRequire = createRequire(resolve(__dirname, '../../../web/package.json'));
interface ClientRoom {
  roomId: string;
  connection: { close(): void };
  send(type: string, message?: unknown): void;
  onMessage(type: string, callback: (message: never) => void): void;
}
interface ClientApi {
  create(kind: string, options: object): Promise<ClientRoom>;
  joinById(id: string, options: object): Promise<ClientRoom>;
}
const { Client } = webRequire('colyseus.js') as { Client: new (url: string) => ClientApi };

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const token = headers.get('authorization')?.replace('Bearer ', '');
      return token ? { user: { id: token, username: token } } : null;
    },
  },
} as unknown as Auth;

let http: HttpServer;
let game: Server;
let url = '';
const open: ClientRoom[] = [];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (check: () => boolean, ms = 8000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('tempo esgotado esperando a condição');
    await wait(15);
  }
};

interface Snap {
  game: string;
  phase: string;
  flex: boolean;
  hostId: string | null;
  members: { id: string }[];
}
interface Seen {
  room: ClientRoom;
  snap: Snap | null;
  errors: string[];
}

function watch(room: ClientRoom): Seen {
  const seen: Seen = { room, snap: null, errors: [] };
  room.onMessage('snapshot', ((s: Snap) => (seen.snap = s)) as never);
  room.onMessage('error', ((e: string) => seen.errors.push(e)) as never);
  room.onMessage('*' as never, (() => undefined) as never);
  open.push(room);
  return seen;
}

beforeAll(async () => {
  http = createServer();
  game = new Server({ transport: new WebSocketTransport({ server: http }) });
  game.define('foxcap', FoxRoom);
  await new Promise<void>((ok) => http.listen(0, '127.0.0.1', ok));
  url = `ws://127.0.0.1:${(http.address() as AddressInfo).port}`;
  roomDeps.auth = fakeAuth;
});

beforeEach(() => {
  roomDeps.activeRooms.clear();
});

afterAll(async () => {
  for (const r of open) r.connection.close();
  await Promise.race([game.gracefullyShutdown(false).catch(() => undefined), wait(1500)]);
  http.closeAllConnections();
  http.close();
}, 15_000);

describe('sala do Fox Cap! com servidor de verdade', () => {
  it('nasce sem jogo, o líder escolhe e troca o jogo e as mensagens de cada jogo valem só no seu', async () => {
    const ana = watch(await new Client(url).create('foxcap', { token: 'ana' }));
    const bia = watch(await new Client(url).joinById(ana.room.roomId, { token: 'bia' }));
    await until(() => ana.snap?.members.length === 2 && bia.snap?.members.length === 2);
    expect(ana.snap).toMatchObject({ game: 'foxcap', flex: true, phase: 'lobby' });

    // sem jogo escolhido não começa
    ana.room.send('start');
    await until(() => ana.errors.length > 0);
    expect(ana.errors[0]).toContain('Escolha um jogo');

    // só o líder escolhe; jogo inválido é recusado
    bia.room.send('pickgame', { game: 'bola' });
    await until(() => bia.errors.length > 0);
    expect(bia.errors[0]).toContain('líder');
    ana.room.send('pickgame', { game: 'poker' });
    await until(() => ana.errors.length > 1);

    ana.room.send('pickgame', { game: 'bola' });
    await until(() => ana.snap?.game === 'bola' && bia.snap?.game === 'bola');
    expect(ana.snap!.flex).toBe(true);
    expect(ana.snap!.members).toHaveLength(2);
    expect(ana.snap!.hostId).toBe('ana');
    // a mensagem do Fut Fox vale agora
    ana.room.send('bformat', { teams: 2, perTeam: 2 });
    await wait(150);
    expect(
      (ana.snap as unknown as { bola: { format: { perTeam: number } } }).bola.format.perTeam,
    ).toBe(2);

    // troca para o Desmorona!: as pessoas ficam e as mensagens do Fut Fox deixam de valer
    ana.room.send('pickgame', { game: 'desmorona' });
    await until(() => ana.snap?.game === 'desmorona' && bia.snap?.game === 'desmorona');
    expect(ana.snap!.members).toHaveLength(2);
    const before = ana.errors.length;
    ana.room.send('bformat', { teams: 2, perTeam: 1 });
    await wait(200);
    expect(ana.errors.length).toBe(before);

    // e de volta ao Atravessa!
    ana.room.send('pickgame', { game: 'atravessa' });
    await until(() => ana.snap?.game === 'atravessa' && bia.snap?.game === 'atravessa');
  }, 30_000);
});
