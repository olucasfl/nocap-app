import { createServer, type Server as HttpServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Auth } from '../auth/auth';
import { FoxGpRoom, FoxRoom, roomDeps } from './color.room';
import { FoxGpRoomEngine } from './foxgp-room.engine';

/**
 * A sala do Fox GP com o servidor Colyseus de verdade e dois aparelhos (o mesmo cliente do app): prova o caminho das
 * mensagens gpos, gq, gfin e pos (spec 078), com os tempos da partida encurtados.
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
  game: string;
  foxgp: {
    me: string | null;
    stage: string | null;
    raceAt: number | null;
    slots: Record<string, number>;
    grid: string[];
    finish: Record<string, number>;
    order: string[] | null;
    dnf: string[];
  };
}
interface Seen {
  room: ClientRoom;
  snap: Snap | null;
  pos: number[][][];
}

function watch(room: ClientRoom): Seen {
  const seen: Seen = { room, snap: null, pos: [] };
  room.onMessage('snapshot', ((s: Snap) => (seen.snap = s)) as never);
  room.onMessage('pos', ((m: number[][]) => seen.pos.push(m)) as never);
  room.onMessage('*' as never, (() => undefined) as never);
  open.push(room);
  return seen;
}

const saved = { ...FoxGpRoomEngine.timing };

beforeAll(async () => {
  Object.assign(FoxGpRoomEngine.timing, {
    countMs: 300,
    qualiMaxMs: 60_000,
    gridMs: 400,
    minLapMs: 100,
    dnfMs: 1200,
  });
  http = createServer();
  game = new Server({ transport: new WebSocketTransport({ server: http }) });
  game.define('foxgp', FoxGpRoom);
  game.define('foxcap', FoxRoom);
  await new Promise<void>((ok) => http.listen(0, '127.0.0.1', ok));
  url = `ws://127.0.0.1:${(http.address() as AddressInfo).port}`;
  roomDeps.auth = fakeAuth;
});

beforeEach(() => {
  roomDeps.activeRooms.clear();
});

afterAll(async () => {
  Object.assign(FoxGpRoomEngine.timing, saved);
  for (const r of open) r.connection.close();
  await Promise.race([game.gracefullyShutdown(false).catch(() => undefined), wait(1500)]);
  http.closeAllConnections();
  http.close();
}, 15_000);

const gpos = (prog: number) => [1, 2, 0.5, 20, prog, 0, 0, 0.1, 0];

describe('sala do Fox GP com servidor de verdade', () => {
  it('classificação, grid, posições replicadas, chegada e DNF dos 30 s', async () => {
    const created = await new Client(url).create('foxgp', { token: 'ana' });
    const ana = watch(created);
    const bia = watch(await new Client(url).joinById(created.roomId, { token: 'bia' }));
    bia.room.send('ready', { ready: true });
    await until(() => bia.snap?.foxgp.me === 'bia');
    ana.room.send('start');
    await until(() => ana.snap?.phase === 'play' && ana.snap.foxgp.stage === 'quali');
    expect(ana.snap!.foxgp.slots).toEqual({ ana: 0, bia: 1 });

    // a bia relata a posição: a ana recebe
    bia.room.send('gpos', gpos(0));
    await until(() => ana.pos.some((f) => f.some((row) => row[0] === 1)));

    // os dois marcam tempo (a bia mais rápida): o grid sai e a corrida começa
    await wait(450);
    ana.room.send('gq', { ms: 400 });
    bia.room.send('gq', { ms: 300 });
    await until(() => ana.snap?.foxgp.stage === 'grid');
    expect(ana.snap!.foxgp.grid).toEqual(['bia', 'ana']);
    await until(() => ana.snap?.foxgp.stage === 'race' && bia.snap?.foxgp.stage === 'race');

    // a bia cruza a linha; a ana não termina em tempo e fica DNF
    await wait(400);
    bia.room.send('gfin', { ms: 330, laps: [110, 110, 110], passes: 1 });
    ana.room.send('gpos', gpos(500));
    await until(() => ana.snap?.foxgp.finish.bia === 330);
    await until(() => ana.snap?.phase === 'final', 8000);
    expect(ana.snap!.foxgp.order).toEqual(['bia', 'ana']);
    expect(ana.snap!.foxgp.dnf).toEqual(['ana']);
  }, 30_000);

  it('a sala do Fox Cap! troca para o Fox GP', async () => {
    const created = await new Client(url).create('foxcap', { token: 'caio' });
    const caio = watch(created);
    await until(() => caio.snap?.game === 'foxcap');
    caio.room.send('pickgame', { game: 'foxgp' });
    await until(() => caio.snap?.game === 'foxgp');
    expect(caio.snap!.foxgp.me).toBe('caio');
  }, 15_000);
});
