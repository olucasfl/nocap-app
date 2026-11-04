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
 * O Counter Fox online (spec 057) com o servidor Colyseus de verdade: o líder escolhe o jogo, ajusta tempo e bots, a partida
 * começa para todos, as entradas viram movimento no servidor e o quadro volta a cerca de 20 por segundo.
 */
const webRequire = createRequire(resolve(__dirname, '../../../web/package.json'));
interface ClientRoom {
  roomId: string;
  connection: { close(): void };
  send(type: string, message?: unknown): void;
  leave(consented?: boolean): Promise<number>;
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
  settings?: { minutes?: number; bots?: number };
  foxshot?: { roster: { id: string; bot: boolean }[] | null; startAt: number | null };
}
interface Seen {
  room: ClientRoom;
  snap: Snap | null;
  errors: string[];
  closed: boolean;
  notices: string[];
  frames: { f: { k: number; p: number[][] }; s: { seq: number; x: number; z: number; alive: boolean } | null; e: { k: string }[] }[];
}

function watch(room: ClientRoom): Seen {
  const seen: Seen = { room, snap: null, errors: [], closed: false, notices: [], frames: [] };
  room.onMessage('snapshot', ((s: Snap) => (seen.snap = s)) as never);
  room.onMessage('fss', ((m: Seen['frames'][number]) => seen.frames.push(m)) as never);
  room.onMessage('error', ((e: string) => seen.errors.push(e)) as never);
  room.onMessage('closed', (() => (seen.closed = true)) as never);
  room.onMessage('notice', ((n: { text: string }) => seen.notices.push(n.text)) as never);
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


const input = (seq: number, o: Record<string, unknown> = {}) => ({ seq, fwd: 0, strafe: 0, jump: false, crouch: false, walk: false, yaw: 0, pitch: 0, trigger: false, alt: false, reload: false, inspect: false, viewTick: 0, ...o });

describe('Counter Fox online com servidor de verdade', () => {
  it('lobby, regras, começar, entradas viram movimento e o quadro volta para todos', async () => {
    const ana = watch(await new Client(url).create('foxcap', { token: 'ana' }));
    const bia = watch(await new Client(url).joinById(ana.room.roomId, { token: 'bia' }));
    await until(() => ana.snap?.members.length === 2 && bia.snap?.members.length === 2);
    ana.room.send('pickgame', { game: 'foxshot' });
    await until(() => ana.snap?.game === 'foxshot' && bia.snap?.game === 'foxshot');

    // regras inválidas são recusadas; só o líder muda
    ana.room.send('configure', { minutes: 4 });
    await until(() => ana.errors.length > 0);
    ana.room.send('configure', { bots: 12 });
    await until(() => ana.errors.length > 1);
    bia.room.send('configure', { bots: 1 });
    await until(() => bia.errors.length > 0);
    ana.room.send('configure', { minutes: 2, bots: 2 });
    await until(() => ana.snap?.settings?.minutes === 2 && ana.snap?.settings?.bots === 2);

    // só começa com todo mundo pronto
    ana.room.send('start');
    await until(() => ana.errors.length > 2);
    expect(ana.errors[2]).toContain('pronto');
    bia.room.send('ready', { ready: true });
    await until(() => (bia.snap as unknown as { members: { id: string; ready: boolean }[] }).members.find((m) => m.id === 'bia')!.ready);
    ana.room.send('start');
    await until(() => ana.snap?.phase === 'show' && bia.snap?.phase === 'show');
    expect(ana.snap!.foxshot!.roster).toHaveLength(4);
    await until(() => ana.snap?.phase === 'play' && bia.snap?.phase === 'play', 9000);

    // entradas: ana anda para a frente (30 pacotes por segundo com as 3 últimas entradas)
    let seq = 0;
    const sent: ReturnType<typeof input>[] = [];
    for (let i = 0; i < 45; i++) {
      for (let k = 0; k < 2; k++) sent.push(input(++seq, { fwd: 1 }));
      ana.room.send('fsin', sent.slice(-4));
      bia.room.send('fsin', [input(i + 1)]);
      await wait(33);
    }
    await until(() => ana.frames.length > 10 && bia.frames.length > 10);
    const first = ana.frames.find((f) => f.s && f.s.seq > 0)!;
    const last = ana.frames[ana.frames.length - 1]!;
    expect(last.s!.seq).toBeGreaterThan(first.s!.seq);
    expect(Math.hypot(last.s!.x - first.s!.x, last.s!.z - first.s!.z)).toBeGreaterThan(0.5);
    // todo mundo recebe o quadro com os 4 jogadores; a taxa fica perto de 20 por segundo
    expect(last.f.p).toHaveLength(4);
    const span = (last.f.k - ana.frames[0]!.f.k) / 60;
    expect(ana.frames.length / Math.max(0.5, span)).toBeGreaterThan(8);
    expect(ana.frames.length / Math.max(0.5, span)).toBeLessThan(30);
  }, 40_000);

  it('quem sai no meio da partida vira bot e a sala segue', async () => {
    const ana = watch(await new Client(url).create('foxcap', { token: 'ana' }));
    const bia = watch(await new Client(url).joinById(ana.room.roomId, { token: 'bia' }));
    await until(() => ana.snap?.members.length === 2);
    ana.room.send('pickgame', { game: 'foxshot' });
    await until(() => ana.snap?.game === 'foxshot');
    ana.room.send('configure', { minutes: 2, bots: 0 });
    bia.room.send('ready', { ready: true });
    await until(() => (ana.snap as unknown as { members: { ready: boolean }[] }).members.some((m) => m.ready));
    ana.room.send('start');
    await until(() => ana.snap?.phase === 'play', 9000);
    await bia.room.leave(true);
    await until(() => ana.frames.some((f) => f.f.p.some((r) => (r[8]! & 4) !== 0)), 8000);
    expect(ana.snap!.phase).toBe('play');
  }, 40_000);

  it('convidado chega no meio da partida, espectando, e pede para jogar', async () => {
    const ana = watch(await new Client(url).create('foxcap', { token: 'ana' }));
    await until(() => ana.snap?.members.length === 1);
    ana.room.send('pickgame', { game: 'foxshot' });
    await until(() => ana.snap?.game === 'foxshot');
    ana.room.send('configure', { minutes: 2, bots: 3 });
    await until(() => ana.snap?.settings?.bots === 3);
    ana.room.send('start');
    await until(() => ana.snap?.phase === 'play', 9000);
    const rosterBefore = ana.snap!.foxshot!.roster!.length;
    // entra com a partida rolando (antes dava "já começou")
    const cris = watch(await new Client(url).joinById(ana.room.roomId, { token: 'cris' }));
    await until(() => cris.snap?.phase === 'play' && ana.snap?.members.length === 2);
    expect(cris.snap!.foxshot!.roster!.some((r) => r.id === 'cris')).toBe(false);
    await until(() => cris.frames.length > 3);
    expect(cris.frames[cris.frames.length - 1]!.s).toBeNull();
    // pede para jogar: entra no lugar de um bot
    cris.room.send('fsplay');
    await until(() => cris.snap!.foxshot!.roster!.some((r) => r.id === 'cris' && !r.bot));
    expect(cris.snap!.foxshot!.roster!).toHaveLength(rosterBefore);
    await until(() => cris.frames.some((f) => f.s !== null), 6000);
    // convidar no meio da partida vale
    ana.room.send('invite', { username: 'zeca' });
    await wait(300);
    expect(ana.errors.join('|')).not.toContain('Só dá para convidar no lobby');
  }, 40_000);
});
