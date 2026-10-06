import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Gera os ícones PWA (192/512, maskable, apple-touch, favicon) a partir de public/logo.svg.
// Rodar com `pnpm --filter @nocap/web generate-pwa-assets` quando o logo mudar.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // O fundo do logo já é o papel do design; mantém a cor igual no maskable e no iOS.
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#F4F4EF' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#F4F4EF' } },
  },
  images: ['public/logo.svg'],
});
