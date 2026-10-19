import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Se o Chromium da versão exata do Playwright não está instalado, usa o mais novo que já existe na máquina
 * (evita baixar de novo). `PLAYWRIGHT_CHROMIUM_PATH` força um caminho.
 */
function chromiumPath(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(homedir(), 'AppData', 'Local', 'ms-playwright');
  if (!existsSync(root)) return undefined;
  const shells = readdirSync(root).filter((d) => d.startsWith('chromium_headless_shell-')).sort();
  const last = shells[shells.length - 1];
  const exe = last && join(root, last, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
  return exe && existsSync(exe) ? exe : undefined;
}
const executablePath = chromiumPath();

/**
 * Testes de ponta a ponta do Word's. A API é simulada no navegador (`e2e/mock-api.ts`), então não
 * precisam de banco, conta nem servidor da API: só o web em modo de desenvolvimento.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'pnpm exec vite --port 5199 --strictPort',
    port: 5199,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
