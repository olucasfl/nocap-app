import { createServer, type Server as HttpServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Auth } from '../auth/auth';
import { DesmoronaRoom, roomDeps } from './color.room';

/**
 * A sala do Desmorona! com o servidor Colyseus de verdade e dois aparelhos (o mesmo cliente do app):
 * prova o caminho completo das mensagens `dpos`, `dstep`, `ddead` e `pos` (spec 044), que os testes do motor
 * não alcançam.
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
  phase: string;
  desmorona: { startAt: number | null; slots: Record<string, number>; me: string | null; dead: Record<string, number>; winnerId: string | null };
}
interface Seen {
  room: ClientRoom;
  snap: Snap | null;
  steps: number[][][];
  pos: number[][][];
}

function watch(room: ClientRoom): Seen {
  const seen: Seen = { room, snap: null, steps: [], pos: [] };
  room.onMessage('snapshot', ((s: Snap) => (seen.snap = s)) as never);
  room.onMessage('dsteps', ((m: number[][]) => seen.steps.push(m)) as never);
  room.onMessage('pos', ((m: number[][]) => seen.pos.push(m)) as never);
  room.onMessage('*' as never, (() => undefined) as never);
  open.push(room);
  return seen;
}

beforeAll(async () => {
  http = createServer();
  game = new Server({ transport: new WebSocketTransport({ server: http }) });
  game.define('desmorona', DesmoronaRoom);
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

describe('sala do Desmorona! com servidor de verdade', () => {
  it('largada marcada, posições e ladrilhos replicados, queda e vitória', async () => {
    const created = await new Client(url).create('desmorona', { token: 'ana' });
    const ana = watch(created);
    const bia = watch(await new Client(url).joinById(created.roomId, { token: 'bia' }));
    bia.room.send('ready', { ready: true });
    await until(() => bia.snap?.desmorona.me === 'bia');
    ana.room.send('start');
    await until(() => ana.snap?.phase === 'show' && bia.snap?.phase === 'show');
    expect(ana.snap!.desmorona.slots).toEqual({ ana: 0, bia: 1 });
    await until(() => ana.snap?.phase === 'play' && bia.snap?.phase === 'play', 12_000);
    const startAt = ana.snap!.desmorona.startAt!;
    await wait(Math.max(0, startAt + 2000 - Date.now()));

    // a bia relata a posição e pisa num ladrilho: a ana recebe os dois
    bia.room.send('dpos', [1, 0, 2, 0, 0, 0.5, 1]);
    bia.room.send('dstep', { l: 0, q: 1, r: 0 });
    await until(() => ana.pos.some((f) => f.some((row) => row[0] === 1 && row[1] === 1)));
    await until(() => ana.steps.length > 0 && bia.steps.length > 0);
    expect(ana.steps[0]![0]!.slice(0, 3)).toEqual([0, 1, 0]);
    // a ana pisa no mesmo ladrilho: a hora oficial continua a da bia
    ana.room.send('dstep', { l: 0, q: 1, r: 0 });
    await wait(400);
    expect(ana.steps).toHaveLength(1);

    // a bia cai na lava: a sala dá a vitória à ana
    bia.room.send('ddead');
    await until(() => ana.snap?.phase === 'final');
    expect(ana.snap!.desmorona.winnerId).toBe('ana');
    expect(Object.keys(ana.snap!.desmorona.dead)).toEqual(['bia']);
  }, 30_000);
});
