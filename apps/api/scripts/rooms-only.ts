/**
 * Servidor só das salas (sem banco, sem contas): serve para testar o jogo em duas janelas de verdade. Só entra como
 * convidado. `pnpm exec vite-node scripts/rooms-only.ts` (porta 3340, ou ROOMS_PORT).
 */
import { createServer } from 'node:http';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Server } from 'colyseus';
import {
  AtravessaRoom,
  BolaRoom,
  DesmoronaRoom,
  FoxRoom,
  PingRoom,
  roomDeps,
} from '../src/rooms/color.room';

const http = createServer();
const server = new Server({ transport: new WebSocketTransport({ server: http }) });
for (const [name, room] of [
  ['foxcap', FoxRoom],
  ['pingpong', PingRoom],
  ['desmorona', DesmoronaRoom],
  ['atravessa', AtravessaRoom],
  ['bola', BolaRoom],
] as const)
  server.define(name, room);
roomDeps.auth = { api: { getSession: async () => null } } as never;
const port = Number(process.env.ROOMS_PORT ?? 3340);
http.listen(port, '0.0.0.0', () => console.log(`salas em ws://localhost:${port}`));
