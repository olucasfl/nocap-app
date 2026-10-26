import { createServer, type Server as HttpServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { Server, matchMaker } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Auth } from '../auth/auth';
import { ColorRoom, guestLimit, roomDeps } from './color.room';
import type { ColorRoomEngine } from './color-room.engine';
import type { RoomsRepository } from './rooms.repository';

/** Sala de verdade (Colyseus real): quem entra sem conta usa só um apelido, válido só ali. */
const webRequire = createRequire(resolve(__dirname, '../../../web/package.json'));
interface ClientRoom {
  roomId: string;
  connection: { close(): void };
  leave(consented?: boolean): Promise<number>;
  send(type: string, message?: unknown): void;
  onMessage(type: string, callback: (message: unknown) => void): void;
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
const track = (r: ClientRoom) => {
  r.onMessage('*', () => undefined);
  open.push(r);
  return r;
};
const asGuest = (nickname: unknown) => ({ guest: true, nickname });
const guestCreate = async (nickname: unknown) =>
  track(await new Client(url).create('color', asGuest(nickname)));
const guestJoin = async (code: string, nickname: unknown) =>
  track(await new Client(url).joinById(code, asGuest(nickname)));
const userJoin = async (code: string, token: string) =>
  track(await new Client(url).joinById(code, { token }));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('tempo esgotado esperando a condição');
    await wait(15);
  }
};
const serverRoom = (code: string) => matchMaker.getLocalRoomById(code) as ColorRoom;

const engineOf = (code: string) =>
  (serverRoom(code) as unknown as { engine: ColorRoomEngine }).engine;

beforeAll(async () => {
  http = createServer();
  game = new Server({ transport: new WebSocketTransport({ server: http }) });
  game.define('color', ColorRoom);
  await new Promise<void>((ok) => http.listen(0, '127.0.0.1', ok));
  url = `ws://127.0.0.1:${(http.address() as AddressInfo).port}`;
  roomDeps.auth = fakeAuth;
});

beforeEach(() => {
  roomDeps.activeRooms.clear();
  roomDeps.repo = null;
  guestLimit.reset();
});

afterAll(async () => {
  for (const r of open) r.connection.close();
  await Promise.race([game.gracefullyShutdown(false).catch(() => undefined), wait(1500)]);
  http.closeAllConnections();
  http.close();
}, 15_000);

describe('sala sem conta (apelido)', () => {
  it('entra só com apelido e aparece com ele, marcado como visitante', async () => {
    const ana = await guestCreate('  Ana   Paula ');
    const code = ana.roomId;
    await guestJoin(code, 'Beto');
    await until(() => serverRoom(code).describeFor('x').members === 2);
    const snap = engineOf(code).snapshot();
    expect(snap.members.map((m) => m.username).sort()).toEqual(['Ana Paula', 'Beto']);
    expect(snap.members.every((m) => m.guest)).toBe(true);
  });

  it('convidado e conta jogam na mesma sala; só a conta não é visitante', async () => {
    const ana = await guestCreate('Ana');
    const code = ana.roomId;
    await userJoin(code, 'lucas');
    await until(() => serverRoom(code).describeFor('x').members === 2);
    const snap = engineOf(code).snapshot();
    expect(snap.members.find((m) => m.username === 'lucas')?.guest).toBe(false);
    expect(snap.members.find((m) => m.username === 'Ana')?.guest).toBe(true);
  });

  it('recusa apelido repetido na sala (mesmo com acento, maiúscula e ponto)', async () => {
    const ana = await guestCreate('Zé da Silva');
    await expect(guestJoin(ana.roomId, 'ze.da.SILVA')).rejects.toThrow(/já está na sala/);
  });

  it('recusa apelido inválido', async () => {
    await expect(guestCreate('a')).rejects.toThrow(/pelo menos/);
    await expect(guestCreate('<script>')).rejects.toThrow(/Use só/);
    await expect(guestCreate(undefined)).rejects.toThrow(/apelido/);
  });

  it('recusa apelido que imita o @ de uma conta', async () => {
    roomDeps.repo = {
      usernameTaken: async (names: string[]) => names.includes('lucas'),
    } as unknown as RoomsRepository;
    await expect(guestCreate('Lucas')).rejects.toThrow(/é de uma conta/);
    const ok = await guestCreate('Outro');
    expect(ok.roomId).toHaveLength(4);
  });

  it('convidado não convida amigos', async () => {
    const ana = await guestCreate('Ana');
    let error = '';
    ana.onMessage('error', (m) => (error = String(m)));
    ana.send('invite', { username: 'lucas' });
    await until(() => error !== '');
    expect(error).toMatch(/Crie uma conta/);
  });

  it('o id do convidado nunca é de uma conta', async () => {
    const ana = await guestCreate('Ana');
    const snap = engineOf(ana.roomId).snapshot();
    expect(snap.members[0]!.id.startsWith('guest:')).toBe(true);
  });
});
