import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Gera os ícones (PNG 64/192/512, maskable, apple-touch e favicon.ico) a partir de public/logo.svg,
// que é a cópia de brand/icon.svg. Rodar com `pnpm --filter @nocap/web generate-pwa-assets`
// quando a marca mudar (ver brand/README.md).
const ORANGE = '#FF6A2B'; // --orange: o ícone é laranja de ponta a ponta

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // O sistema recorta o maskable e o iOS arredonda o apple-touch: o fundo tem de ser a cor da marca.
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: ORANGE } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: ORANGE } },
  },
  images: ['public/logo.svg'],
});
