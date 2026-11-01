import { createServer, type Server as HttpServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import type { PpNetEvent } from '@nocap/games';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Auth } from '../auth/auth';
import { FoxRoom, roomDeps } from './color.room';

/** O Ping Fox! em sala (spec 055, fase 3) com o servidor Colyseus de verdade: dois clientes trocam saque e batida. */
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
const until = async (check: () => boolean, ms = 12_000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('tempo esgotado esperando a condição');
    await wait(15);
  }
};

interface Snap {
  game: string;
  phase: string;
  members: { id: string }[];
  pingpong?: { startAt: number | null; firstServer: number; players: string[] | null };
}
interface Seen {
  room: ClientRoom;
  snap: Snap | null;
  errors: string[];
  events: PpNetEvent[];
  rejected: PpNetEvent[];
  pads: number[][][];
}

function watch(room: ClientRoom): Seen {
  const seen: Seen = { room, snap: null, errors: [], events: [], rejected: [], pads: [] };
  room.onMessage('snapshot', ((s: Snap) => (seen.snap = s)) as never);
  room.onMessage('error', ((e: string) => seen.errors.push(e)) as never);
  room.onMessage('pev', ((list: PpNetEvent[]) => seen.events.push(...list)) as never);
  room.onMessage('prej', ((ev: PpNetEvent) => seen.rejected.push(ev)) as never);
  room.onMessage('ppads', ((f: number[][]) => seen.pads.push(f)) as never);
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

describe('sala do Ping Fox! com servidor de verdade', () => {
  it('o líder escolhe o Ping Fox!, a partida começa e o saque lançado por um chega ao outro', async () => {
    const ana = watch(await new Client(url).create('foxcap', { token: 'ana' }));
    const bia = watch(await new Client(url).joinById(ana.room.roomId, { token: 'bia' }));
    await until(() => ana.snap?.members.length === 2 && bia.snap?.members.length === 2);
    ana.room.send('pickgame', { game: 'pingpong' });
    await until(() => ana.snap?.game === 'pingpong' && bia.snap?.game === 'pingpong');
    bia.room.send('ready', { ready: true });
    await wait(100);
    ana.room.send('start');
    await until(() => ana.snap?.phase === 'show' || ana.errors.length > 0);
    expect(ana.errors).toEqual([]);
    await until(() => bia.snap?.phase === 'show');
    const info = ana.snap!.pingpong!;
    expect(info.players).toEqual(['ana', 'bia']);
    await until(() => ana.snap?.phase === 'play' && bia.snap?.phase === 'play', 15_000);

    // quem saca primeiro (a seed decide) lança; a sala repassa ao outro
    const server = info.firstServer;
    const sender = server === 0 ? ana : bia;
    const receiver = server === 0 ? bia : ana;
    // a hora da partida agora, no relógio da sala
    const tick = Math.max(2, Math.floor((Date.now() - (info.startAt ?? 0)) / (1000 / 60)) + 1);
    sender.room.send('ptoss', { k: 'toss', t: tick, p: server, x: 0.2 });
    await until(() => receiver.events.some((e) => e.k === 'toss' && e.t === tick));
    // o evento de volta nunca chega a quem enviou (ele já aplicou na hora)
    expect(sender.events.some((e) => e.k === 'toss' && e.t === tick)).toBe(false);

    // batida de quem não é a vez: a sala recusa e avisa só a quem mandou
    const bad: PpNetEvent = {
      k: 'hit',
      t: tick + 1,
      p: server === 0 ? 1 : 0,
      serve: false,
      smash: false,
      kmh: 50,
      quality: 'normal',
      spin: 0,
      b: [0, 1.4, 2.4, 0, 1, 7, 0, 0, 0],
    };
    (server === 0 ? bia : ana).room.send('phit', bad);
    await until(() => (server === 0 ? bia : ana).rejected.length > 0);

    // a raquete de cada um vai para o outro
    ana.room.send('ppad', [0.5, 1.4, 0]);
    await until(() => bia.pads.some((f) => f.some((r) => r[0] === 0 && r[1] === 0.5)));

    // quem pede o histórico recebe o que já aconteceu (o lançamento)
    bia.events.length = 0;
    bia.room.send('psync');
    await until(() => bia.events.some((e) => e.k === 'toss'));
  }, 40_000);
});
