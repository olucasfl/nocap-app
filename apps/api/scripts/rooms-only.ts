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
  FoxGpRoom,
  FoxRoom,
  PingRoom,
  FoxShotRoom,
  roomDeps,
} from '../src/rooms/color.room';

// respostas mínimas do que o site pergunta a quem tem conta (sala atual, convites, sair da sala); o resto é do servidor de verdade
const http = createServer((req, res) => {
  res.setHeader('access-control-allow-origin', req.headers.origin ?? '*');
  res.setHeader('access-control-allow-headers', 'authorization, content-type');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return void res.writeHead(204).end();
  res.setHeader('content-type', 'application/json');
  const url = req.url ?? '';
  if (url.startsWith('/me/room/leave')) return void res.end('{"left":true}');
  if (url.startsWith('/me/room')) return void res.end('{"room":null}');
  if (url.startsWith('/me/invites')) return void res.end('[]');
  res.writeHead(404).end('{}');
});
const server = new Server({ transport: new WebSocketTransport({ server: http }) });
for (const [name, room] of [
  ['foxcap', FoxRoom],
  ['pingpong', PingRoom],
  ['foxshot', FoxShotRoom],
  ['desmorona', DesmoronaRoom],
  ['foxgp', FoxGpRoom],
  ['atravessa', AtravessaRoom],
  ['bola', BolaRoom],
] as const)
  server.define(name, room);
// contas de teste: o token "e2e-ana" vira a conta "e2e-ana" (o Counter Fox só aceita quem tem conta); sem token ou outro valor, convidado
roomDeps.auth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const token = headers.get('authorization')?.replace('Bearer ', '') ?? '';
      return token.startsWith('e2e-') ? { user: { id: token, username: token.slice(4), name: token.slice(4) } } : null;
    },
  },
} as never;
const port = Number(process.env.ROOMS_PORT ?? 3340);
http.listen(port, '0.0.0.0', () => console.log(`salas em ws://localhost:${port}`));
