import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { toNodeHandler } from 'better-auth/node';
import { Server } from 'colyseus';
import { AppModule } from './app.module';
import { AUTH } from './auth/auth.constants';
import type { Auth } from './auth/auth';
import { ColorRoom, ImpostorRoom, TimeRoom, roomDeps } from './rooms/color.room';
import { InvitesService } from './rooms/invites.service';
import { RoomsRepository } from './rooms/rooms.repository';

// O .env fica na raiz do monorepo.
config({ path: resolve(__dirname, '../../../.env') });

async function bootstrap() {
  // O Better Auth lê o corpo da requisição sozinho: o JSON do Nest entra depois da rota dele.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  // Atrás do proxy do Render: o IP do cliente vem em X-Forwarded-For (limites por IP dependem disto).
  app.set('trust proxy', 1);
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    allowedHeaders: ['content-type', 'authorization'],
    // O token da sessão volta neste header (plugin bearer).
    exposedHeaders: ['set-auth-token'],
  });
  const auth = app.get<Auth | null>(AUTH);
  if (auth) app.getHttpAdapter().getInstance().all('/api/auth/*splat', toNodeHandler(auth));
  app.useBodyParser('json');
  // Salas em tempo real (Colyseus) no mesmo servidor HTTP da API.
  await app.init();
  roomDeps.auth = auth;
  roomDeps.repo = app.get(RoomsRepository);
  roomDeps.invites = app.get(InvitesService);
  const rooms = new Server({
    transport: new WebSocketTransport({ server: app.getHttpServer() }),
  });
  rooms.define('color', ColorRoom);
  rooms.define('time', TimeRoom);
  rooms.define('impostor', ImpostorRoom);
  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
  console.log(`api no ar em http://localhost:${port}`);
}

void bootstrap();
