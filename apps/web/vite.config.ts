import { execSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type HtmlTagDescriptor } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Prévia de link (WhatsApp, Discord...) exige URL ABSOLUTA da imagem. Se VITE_SITE_URL estiver
 * definida (ex.: https://nocap.vercel.app), as tags com URL entram no HTML; senão ficam de fora.
 */
function socialUrlTags(site: string | undefined): HtmlTagDescriptor[] {
  if (!site) return [];
  const base = site.replace(/\/$/, '');
  const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({
    tag: 'meta',
    attrs,
    injectTo: 'head',
  });
  return [
    meta({ property: 'og:url', content: base }),
    meta({ property: 'og:image', content: `${base}/og-image.png` }),
    meta({ name: 'twitter:image', content: `${base}/og-image.png` }),
    { tag: 'link', attrs: { rel: 'canonical', href: base }, injectTo: 'head' },
  ];
}

/** O identificador desta versão (commit): aparece no painel de rede para saber qual versão cada aparelho está rodando. */
function buildId(): string {
  const fromHost = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromHost) return fromHost.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '../..', 'VITE_');
  return {
    define: { __BUILD_ID__: JSON.stringify(buildId()) },
    // O .env fica na raiz do monorepo (VITE_API_URL etc.).
    envDir: '../..',
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // em desenvolvimento o jogo lê o motor direto do código-fonte: nunca fica com o pacote compilado desatualizado
        ...(command === 'serve'
          ? {
              '@nocap/games': fileURLToPath(
                new URL('../../packages/games/src/index.ts', import.meta.url),
              ),
            }
          : {}),
      },
    },
    plugins: [
      react(),
      {
        name: 'nocap-social-url',
        transformIndexHtml: () => socialUrlTags(env.VITE_SITE_URL),
      },
      VitePWA({
        registerType: 'prompt',
        manifest: {
          name: 'NoCap',
          short_name: 'NoCap',
          description: 'Jogos para jogar com amigos.',
          display: 'standalone',
          // Em computador e tablet o app abre em janela própria; vale qualquer orientação.
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'any',
          theme_color: '#F4F4EF',
          background_color: '#F4F4EF',
          lang: 'pt-BR',
          id: '/',
          categories: ['games', 'entertainment'],
          // Atalhos ao segurar o ícone do app (Android/Windows).
          shortcuts: [
            {
              name: 'Jogar Cor',
              short_name: 'Cor',
              url: '/cor',
              icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'Jogar Tempo',
              short_name: 'Tempo',
              url: '/tempo',
              icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'Jogar em sala',
              short_name: 'Sala',
              url: '/sala',
              icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
            },
          ],
          // Gerados por `pnpm --filter @nocap/web generate-pwa-assets` a partir de public/logo.svg.
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          // A prévia de compartilhamento é só para crawlers: não precisa ficar no cache do app.
          globIgnores: ['og-image.png'],
          runtimeCaching: [
            {
              // Fontes do Google: ficam em cache para o app abrir offline com a cara certa.
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'nocap-fonts',
                expiration: { maxEntries: 20, maxAgeSeconds: 31536000 },
              },
            },
          ],
        },
      }),
    ],
  };
});
