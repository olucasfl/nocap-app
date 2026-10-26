import { createServer, type Server as HttpServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Auth } from '../auth/auth';
import { BolaRoom, roomDeps } from './color.room';

/**
 * A sala do Bola Maluca! com o servidor Colyseus de verdade e dois aparelhos (o mesmo cliente do app):
 * prova o caminho completo das mensagens de times, `bin` e do fluxo `bs` (spec 046), que os testes do motor não alcançam.
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
  bola: {
    teamOf: Record<string, number>;
    roster: { slot: number; id: string; team: number; bot: boolean }[];
    format: { teams: number; perTeam: number };
  };
}
interface Frame {
  ph: string;
  ck: number;
  p: number[][];
  b: number[];
}
interface Seen {
  room: ClientRoom;
  snap: Snap | null;
  frames: Frame[];
  errors: string[];
}

function watch(room: ClientRoom): Seen {
  const seen: Seen = { room, snap: null, frames: [], errors: [] };
  room.onMessage('snapshot', ((s: Snap) => (seen.snap = s)) as never);
  room.onMessage('bs', ((f: Frame) => seen.frames.push(f)) as never);
  room.onMessage('error', ((e: string) => seen.errors.push(e)) as never);
  room.onMessage('*' as never, (() => undefined) as never);
  open.push(room);
  return seen;
}

beforeAll(async () => {
  http = createServer();
  game = new Server({ transport: new WebSocketTransport({ server: http }) });
  game.define('bola', BolaRoom);
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

describe('sala do Bola Maluca! com servidor de verdade', () => {
  it('times, começo, entrada que move a raposa, fluxo de estado e encerramento', async () => {
    const created = await new Client(url).create('bola', { token: 'ana' });
    const ana = watch(created);
    const bia = watch(await new Client(url).joinById(created.roomId, { token: 'bia' }));
    await until(
      () => ana.snap?.bola.teamOf.bia !== undefined && bia.snap?.bola.teamOf.ana !== undefined,
    );
    // cada um no seu time (1x1 automático)
    expect(ana.snap!.bola.format).toMatchObject({ teams: 2, perTeam: 1 });
    expect(new Set(Object.values(ana.snap!.bola.teamOf)).size).toBe(2);
    // time cheio dá erro claro
    ana.room.send('bteam', { team: ana.snap!.bola.teamOf.bia });
    await until(() => ana.errors.length > 0);
    expect(ana.errors[0]).toContain('cheio');
    bia.room.send('ready', { ready: true });
    await until(() => bia.snap?.bola.teamOf.bia !== undefined);
    await wait(100);
    ana.room.send('start');
    await until(() => ana.snap?.phase === 'play' && bia.snap?.phase === 'play');
    expect(ana.snap!.bola.roster).toHaveLength(2);
    // passa da contagem de 3 s e a bia anda para a direita
    await until(() => ana.frames.some((f) => f.ph === 'p'), 10_000);
    const bslot = ana.snap!.bola.roster.find((r) => r.id === 'bia')!.slot;
    const rowOf = (f: Frame) => f.p.find((r) => r[0] === bslot)!;
    const x0 = rowOf(ana.frames[ana.frames.length - 1]!)[1]!;
    for (let i = 1; i <= 12; i++) {
      bia.room.send('bin', [1, 0, 0, i]);
      await wait(40);
    }
    await until(() => rowOf(ana.frames[ana.frames.length - 1]!)[1]! !== x0);
    const last = ana.frames[ana.frames.length - 1]!;
    expect(Math.abs(rowOf(last)[1]! - x0)).toBeGreaterThan(0.3);
    expect(rowOf(last)[9]).toBeGreaterThan(0);
    expect(last.b).toHaveLength(6);
    // o líder encerra
    ana.room.send('bend');
    await until(() => ana.snap?.phase === 'final' && bia.snap?.phase === 'final');
  }, 40_000);
});
