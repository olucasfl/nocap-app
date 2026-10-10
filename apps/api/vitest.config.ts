import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Os testes com servidor Colyseus real não rodam em processo filho (o canal de mensagens dele
    // colide com o do Colyseus); em threads funcionam.
    poolMatchGlobs: [['**/*.integration.test.ts', 'threads']],
  },
});
