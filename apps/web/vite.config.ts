import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // O .env fica na raiz do monorepo (VITE_API_URL etc.).
  envDir: '../..',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'NoCap',
        short_name: 'NoCap',
        description: 'Jogos para jogar com amigos.',
        display: 'standalone',
        theme_color: '#F4F4EF',
        background_color: '#F4F4EF',
        lang: 'pt-BR',
        // Ícones (192/512/maskable) entram na Etapa 1, passo 5: ver docs/ROADMAP.md.
        icons: [],
      },
    }),
  ],
});
