import { createServer, type Server as HttpServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Auth } from '../auth/auth';
import { AtravessaRoom, roomDeps } from './color.room';

/**
 * A sala do Atravessa! com o servidor Colyseus de verdade e dois aparelhos (o mesmo cliente do app):
 * prova o caminho completo das mensagens `run`, `ack` e `pos` (spec 031), que os testes do motor
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
  atravessa: { startAt: number | null; slots: Record<string, number>; me: string | null };
}
interface Seen {
  room: ClientRoom;
  snap: Snap | null;
  acks: number[];
  pos: number[][][];
}

function watch(room: ClientRoom): Seen {
  const seen: Seen = { room, snap: null, acks: [], pos: [] };
  room.onMessage('snapshot', ((s: Snap) => (seen.snap = s)) as never);
  room.onMessage('ack', ((m: { n: number }) => seen.acks.push(m.n)) as never);
  room.onMessage('pos', ((m: number[][]) => seen.pos.push(m)) as never);
  room.onMessage('*' as never, (() => undefined) as never);
  open.push(room);
  return seen;
}

beforeAll(async () => {
  http = createServer();
  game = new Server({ transport: new WebSocketTransport({ server: http }) });
  game.define('atravessa', AtravessaRoom);
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

describe('sala do Atravessa! com servidor de verdade', () => {
  it('largada marcada, relatos confirmados e posições de todos transmitidas', async () => {
    const created = await new Client(url).create('atravessa', { token: 'ana' });
    const ana = watch(created);
    const bia = watch(await new Client(url).joinById(created.roomId, { token: 'bia' }));

    // cada um ouve o próprio snapshot; o convite e o estado mais novo vêm por ações
    bia.room.send('ready', { ready: true });
    await until(() => bia.snap?.atravessa.me === 'bia');
    ana.room.send('start');
    await until(() => ana.snap?.phase === 'show' && bia.snap?.phase === 'show');
    const startAt = ana.snap!.atravessa.startAt!;
    expect(ana.snap!.atravessa.slots).toEqual({ ana: 0, bia: 1 });
    expect(ana.snap!.atravessa.me).toBe('ana');

    // a corrida começa na hora marcada
    await until(() => ana.snap?.phase === 'play');
    expect(Date.now()).toBeGreaterThanOrEqual(startAt - 5);

    // a bia (coluna -1) dá um passo para a esquerda no tick 5 e relata o tick 40
    await wait(Math.max(0, startAt + 900 - Date.now()));
    const tick = Math.floor(((Date.now() - startAt) * 60) / 1000);
    expect(tick).toBeGreaterThan(40);
    bia.room.send('run', { t: 40, i: [{ t: 5, d: 2 }], n: 0 });
    await until(() => bia.acks.includes(1));
    // a ana não ganha confirmação do relato da bia
    expect(ana.acks).toEqual([]);

    // a ana vê a bia na coluna -2 (largou em -1 e andou uma casa), viva
    await until(() => ana.pos.some((frame) => frame.some((row) => row[0] === 1 && row[2] === -2)));
    const frame = [...ana.pos]
      .reverse()
      .find((f) => f.some((row) => row[0] === 1 && row[2] === -2))!;
    const row = frame.find((r) => r[0] === 1)!;
    expect(row[1]).toBe(40);
    expect(row[6]! & 1).toBe(1);
    // e a ana (que nunca relatou) ainda está na largada, na coluna 0
    expect(frame.find((r) => r[0] === 0)![2]).toBe(0);

    // relato com tick além do relógio da sala não vale (nem confirmação)
    const before = bia.acks.length;
    bia.room.send('run', { t: 5000, i: [], n: 1 });
    await wait(400);
    expect(bia.acks.length).toBe(before);
  }, 20_000);
});
