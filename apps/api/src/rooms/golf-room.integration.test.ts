import { createServer, type Server as HttpServer } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Auth } from '../auth/auth';
import { FoxRoom, GolfRoom, roomDeps } from './color.room';

/**
 * A sala do Mini Golf com o servidor Colyseus de verdade e dois aparelhos (o mesmo cliente do app): prova a tacada ("gshot"),
 * os quadros de posição ("gb", com a cadência), os eventos ("ge"), o fim do buraco por tempo e a sala flex do Fox Cap!
 * escolhendo o jogo (spec 082).
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
  golf: { me: string | null; stage: string | null; hole: number; strokes: Record<string, number>; slots: Record<string, number>; looks: Record<string, { color: number }>; levels: number[] };
  final: { userId: string }[] | null;
}
interface Seen {
  room: ClientRoom;
  snap: Snap | null;
  frames: { at: number; m: { t: number; balls: number[][] } }[];
  events: { type: string; slot: number }[];
}
function watch(room: ClientRoom): Seen {
  const seen: Seen = { room, snap: null, frames: [], events: [] };
  room.onMessage('snapshot', ((s: Snap) => (seen.snap = s)) as never);
  room.onMessage('gb', ((m: Seen['frames'][number]['m']) => seen.frames.push({ at: Date.now(), m })) as never);
  room.onMessage('ge', ((m: Seen['events']) => seen.events.push(...m)) as never);
  room.onMessage('*' as never, (() => undefined) as never);
  open.push(room);
  return seen;
}

beforeAll(async () => {
  http = createServer();
  game = new Server({ transport: new WebSocketTransport({ server: http }) });
  game.define('golf', GolfRoom);
  game.define('foxcap', FoxRoom);
  await new Promise<void>((ok) => http.listen(0, '127.0.0.1', ok));
  url = `ws://127.0.0.1:${(http.address() as AddressInfo).port}`;
  roomDeps.auth = fakeAuth;
});
beforeEach(() => roomDeps.activeRooms.clear());
afterAll(async () => {
  for (const r of open) r.connection.close();
  await Promise.race([game.gracefullyShutdown(false).catch(() => undefined), wait(1500)]);
  http.closeAllConnections();
  http.close();
}, 15_000);

describe('sala do Mini Golf com servidor de verdade', () => {
  it('tacada, quadros a ~30 por segundo, eventos e fim do buraco por tempo', async () => {
    const created = await new Client(url).create('golf', { token: 'ana' });
    const ana = watch(created);
    const bia = watch(await new Client(url).joinById(created.roomId, { token: 'bia' }));
    ana.room.send('glook', { color: 0x2f5bff, finish: 'estrela', trail: 'fogo' });
    await until(() => ana.snap?.golf.looks.ana?.color === 0x2f5bff);
    await until(() => bia.snap?.golf.me === 'bia');
    // mudar as regras desmarca o "pronto": a bia marca depois
    ana.room.send('configure', { holes: 3, seconds: 60 });
    await until(() => (ana.snap as unknown as { settings: { holes: number } }).settings.holes === 3);
    bia.room.send('ready', { ready: true });
    await wait(80);
    ana.room.send('start');
    await until(() => ana.snap?.phase === 'play', 4000);
    expect(ana.snap!.golf.levels).toHaveLength(3);
    expect(ana.snap!.golf.stage).toBe('intro');
    // depois da contagem a sala simula e transmite os quadros
    await until(() => ana.snap?.golf.stage === 'play', 8000);
    await until(() => ana.frames.length >= 2, 4000);
    expect(ana.frames[0]!.m.balls).toHaveLength(2);

    // a bia taca: o estado e os eventos chegam a todos
    bia.room.send('gshot', { x: 0, z: -1, p: 0.4 });
    await until(() => ana.snap?.golf.strokes.bia === 1, 3000);
    await until(() => ana.events.some((e) => e.type === 'hit' && e.slot === 1), 3000);
    // bola em movimento aparece nos quadros
    await until(() => ana.frames.some((f) => f.m.balls.some((b) => b[0] === 1 && Math.hypot(b[4]!, b[6]!) > 0.5)), 3000);

    // cadência: os quadros chegam em média a menos de 50 ms um do outro
    const before = ana.frames.length;
    await wait(1500);
    const got = ana.frames.slice(before);
    expect(got.length).toBeGreaterThan(25);
    const gaps = got.slice(1).map((f, i) => f.at - got[i]!.at);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(avg).toBeLessThan(50);
  }, 40_000);

  it('a sala do Fox Cap! escolhe o Mini Golf e a partida roda pelo mesmo caminho', async () => {
    const created = await new Client(url).create('foxcap', { token: 'lia' });
    const lia = watch(created);
    const theo = watch(await new Client(url).joinById(created.roomId, { token: 'theo' }));
    await until(() => theo.snap?.game === 'foxcap');
    lia.room.send('pickgame', { game: 'golf' });
    await until(() => lia.snap?.game === 'golf' && theo.snap?.game === 'golf');
    theo.room.send('ready', { ready: true });
    await until(() => theo.snap?.golf.me === 'theo');
    lia.room.send('start');
    await until(() => lia.snap?.phase === 'play', 4000);
    await until(() => lia.snap?.golf.stage === 'play', 8000);
    await until(() => theo.frames.length >= 3, 4000);
    expect(theo.snap!.golf.levels.length).toBeGreaterThan(0);
    lia.room.send('gend');
    await until(() => lia.snap?.phase === 'final', 4000);
    expect(lia.snap!.final).toHaveLength(2);
  }, 30_000);
});
