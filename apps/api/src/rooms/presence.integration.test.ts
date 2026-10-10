import { createServer, type Server as HttpServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { Server, matchMaker } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Auth } from '../auth/auth';
import { ColorRoom, leaveMyRoom, myRoomInfo, roomDeps } from './color.room';

/**
 * Salas de verdade (servidor Colyseus real, conexões reais), sem banco: a autenticação é trocada
 * por uma que usa o próprio token como @usuário. Prova o que os testes do motor não alcançam:
 * sair da sala, conexão que cai, expulsão e entrar em outra sala.
 *
 * O cliente é o mesmo do app (`colyseus.js`), que mora no workspace web.
 */
const webRequire = createRequire(resolve(__dirname, '../../../web/package.json'));
interface ClientRoom {
  roomId: string;
  reconnectionToken: string;
  connection: { close(): void };
  leave(consented?: boolean): Promise<number>;
  send(type: string, message?: unknown): void;
  onMessage(type: string, callback: (message: unknown) => void): void;
  onLeave(callback: (code: number) => void): void;
}
interface ClientApi {
  create(kind: string, options: object): Promise<ClientRoom>;
  joinById(id: string, options: object): Promise<ClientRoom>;
  reconnect(token: string): Promise<ClientRoom>;
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

const connect = (_who: string) => new Client(url);
const track = (r: ClientRoom) => {
  // O app registra os tipos de mensagem; aqui só importa estar conectado.
  r.onMessage('*', () => undefined);
  open.push(r);
  return r;
};
const create = async (token: string, kind = 'color') =>
  track(await connect(token).create(kind, { token }));
const join = async (token: string, code: string) =>
  track(await connect(token).joinById(code, { token }));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('tempo esgotado esperando a condição');
    await wait(15);
  }
};
const serverRoom = (code: string) => matchMaker.getLocalRoomById(code) as ColorRoom;
/** Derruba a conexão sem avisar, como uma queda de rede ou uma aba fechada. */
const dropConnection = (r: ClientRoom) =>
  (r.connection as unknown as { transport: { ws: { close: () => void } } }).transport.ws.close();

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
});

afterAll(async () => {
  for (const r of open) r.connection.close();
  // O desligamento educado espera as salas esvaziarem; o teste não precisa esperar por elas.
  await Promise.race([game.gracefullyShutdown(false).catch(() => undefined), wait(1500)]);
  http.closeAllConnections();
  http.close();
}, 15_000);

describe('sair da sala', () => {
  it('sair pelo app libera a conta na hora, e a outra pessoa vê a sala sem ela', async () => {
    const ana = await create('ana');
    const code = ana.roomId;
    const bia = await join('bia', code);
    await until(() => serverRoom(code).describeFor('ana').members === 2);

    await bia.leave(true);
    await until(() => serverRoom(code).describeFor('ana').members === 1);
    expect(myRoomInfo('bia')).toBeNull();
    // E já pode entrar em outra sala, sem esperar nada.
    const outra = await create('bia');
    expect(outra.roomId).not.toBe(code);
  });

  it('conexão caída deixa a pessoa "esperando voltar"; o Sair do servidor tira de verdade', async () => {
    const ana = await create('ana');
    const code = ana.roomId;
    const bia = await join('bia', code);
    await until(() => serverRoom(code).describeFor('ana').members === 2);

    dropConnection(bia);
    await until(() => !serverRoom(code).describeFor('bia').connected);
    // Aparece como sala dela, sem conexão: é o que o aviso "Você está na sala" mostra.
    expect(myRoomInfo('bia')).toMatchObject({ code, connected: false });

    expect(leaveMyRoom('bia')).toBe(true);
    expect(myRoomInfo('bia')).toBeNull();
    await until(() => serverRoom(code).describeFor('ana').members === 1);
    expect(leaveMyRoom('bia')).toBe(false);
  });

  it('o líder sozinho que sai encerra a sala', async () => {
    const ana = await create('ana');
    const code = ana.roomId;
    await ana.leave(true);
    await until(() => !matchMaker.getLocalRoomById(code), 3000).catch(() => undefined);
    expect(myRoomInfo('ana')).toBeNull();
  });
});

describe('uma sala por vez', () => {
  it('quem já está numa sala não entra em outra, e a mensagem diz qual é', async () => {
    const ana = await create('ana');
    const bia = await create('bia');
    await expect(join('ana', bia.roomId)).rejects.toThrow(new RegExp(`sala ${ana.roomId}`));
  });

  it('depois de sair, entra em outra normalmente', async () => {
    const ana = await create('ana');
    const bia = await create('bia');
    await ana.leave(true);
    await until(() => myRoomInfo('ana') === null);
    const entrou = await join('ana', bia.roomId);
    expect(entrou.roomId).toBe(bia.roomId);
  });

  it('registro que sobrou de sala que já não existe não trava a conta', async () => {
    roomDeps.activeRooms.set('caio', 'ZZZZ');
    expect(myRoomInfo('caio')).toBeNull();
    roomDeps.activeRooms.set('caio', 'ZZZZ');
    const sala = await create('caio');
    expect(sala.roomId).toHaveLength(4);
  });
});

describe('voltar para a sala', () => {
  it('entrar de novo com conexão nova cancela a espera da antiga (não expulsa depois)', async () => {
    const ana = await create('ana');
    const code = ana.roomId;
    const bia = await join('bia', code);
    await until(() => serverRoom(code).describeFor('ana').members === 2);

    dropConnection(bia);
    await until(() => !serverRoom(code).describeFor('bia').connected);
    // Voltou pelo código/link (conexão nova), em vez do token de reconexão.
    await join('bia', code);
    await until(() => serverRoom(code).describeFor('bia').connected);

    const room = serverRoom(code) as unknown as { waiting: Map<string, unknown> };
    expect(room.waiting.size).toBe(0);
    expect(myRoomInfo('bia')).toMatchObject({ code, connected: true });
  });

  it('o token de reconexão também traz a pessoa de volta', async () => {
    const ana = await create('ana');
    const code = ana.roomId;
    const bia = await join('bia', code);
    const token = bia.reconnectionToken;
    dropConnection(bia);
    await until(() => !serverRoom(code).describeFor('bia').connected);
    track(await connect('bia').reconnect(token));
    await until(() => serverRoom(code).describeFor('bia').connected);
    expect(serverRoom(code).describeFor('ana').members).toBe(2);
  });
});

describe('expulsão', () => {
  it('expulsar quem está sem conexão tira a pessoa e ela não volta sozinha', async () => {
    const ana = await create('ana');
    const code = ana.roomId;
    const bia = await join('bia', code);
    await until(() => serverRoom(code).describeFor('ana').members === 2);
    dropConnection(bia);
    await until(() => !serverRoom(code).describeFor('bia').connected);

    ana.send('kick', { id: 'bia' });
    await until(() => serverRoom(code).describeFor('ana').members === 1);
    expect(myRoomInfo('bia')).toBeNull();
    expect((serverRoom(code) as unknown as { waiting: Map<string, unknown> }).waiting.size).toBe(0);
  });

  it('expulsar quem está conectado avisa a pessoa e libera a conta', async () => {
    const ana = await create('ana');
    const code = ana.roomId;
    const bia = await join('bia', code);
    const closed = new Promise<number>((ok) => bia.onLeave(ok));
    await until(() => serverRoom(code).describeFor('ana').members === 2);
    ana.send('kick', { id: 'bia' });
    expect(await closed).toBe(4001);
    expect(myRoomInfo('bia')).toBeNull();
  });
});
