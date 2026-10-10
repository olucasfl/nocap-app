import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A API tem que conseguir montar todos os módulos. Um provider com dependência que o Nest não sabe
 * injetar derruba a inicialização, e em produção isso deixa a versão antiga no ar sem ninguém ver
 * (foi o que aconteceu com o `PresenceService`).
 *
 * Roda sobre o build (`nest build`): só o compilador do TypeScript emite os metadados de injeção;
 * o esbuild dos testes não. Sem `dist/` (build ainda não feito) o teste é pulado.
 */
const dist = resolve(__dirname, '../dist');
const built = existsSync(resolve(dist, 'app.module.js'));

describe.skipIf(!built)('inicialização da API (build)', () => {
  it('monta todos os módulos e provedores, sem banco', async () => {
    const req = createRequire(resolve(dist, 'main.js'));
    const { NestFactory } = req('@nestjs/core') as typeof import('@nestjs/core');
    const { AppModule } = req('./app.module') as { AppModule: never };
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    expect(app).toBeDefined();
    await app.close();
  }, 30_000);
});
