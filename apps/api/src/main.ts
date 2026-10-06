import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// O .env fica na raiz do monorepo.
config({ path: resolve(__dirname, '../../../.env') });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' });
  const port = Number(process.env.PORT ?? 3333);
  await app.listen(port);
  console.log(`api no ar em http://localhost:${port}`);
}

void bootstrap();
