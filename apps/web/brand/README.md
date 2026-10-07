# Marca do NoCap

Uma marca só, no estilo Pop Brutal: o **"!" itálico** do logotipo em adesivo (miolo claro, contorno de tinta e **sombra dura sem blur**) sobre o **laranja** de ponta a ponta. O logotipo é "NO CAP" em tinta com o "!" laranja. Os glifos vêm da fonte **Archivo** (SIL OFL) convertidos em curvas, então nenhum arquivo depende de fonte instalada.

## Arquivos

| Arquivo (fonte, em `brand/`) | Uso                                                                       |
| ---------------------------- | ------------------------------------------------------------------------- |
| `icon.svg`                   | Ícone mestre, quadrado e laranja de ponta a ponta. Dele saem todos os PNG |
| `icon-rounded.svg`           | Mesmo ícone com cantos arredondados (favicon do navegador)                |
| `wordmark.svg`               | Logotipo "NO CAP!" para fundo **claro** (tinta + "!" laranja)             |
| `wordmark-light.svg`         | Logotipo para fundo **escuro** (papel + "!" laranja)                      |
| `og.svg`                     | Imagem de compartilhamento (1200 x 630)                                   |
| `build-brand.mjs`            | Gera todos os SVG acima (ver abaixo)                                      |

## O que o app usa (`public/`)

| Arquivo                                               | Onde aparece                                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `favicon.svg`, `favicon.ico`                          | Aba do navegador (SVG nos modernos, ICO nos antigos)                                   |
| `apple-touch-icon-180x180.png`                        | Tela de início do **iPhone/iPad**                                                      |
| `pwa-192x192.png`, `pwa-512x512.png`, `pwa-64x64.png` | App instalado (Android, Windows, macOS, Linux) e atalhos                               |
| `maskable-icon-512x512.png`                           | Android com ícone adaptativo (círculo, quadrado, gota...): a marca fica na zona segura |
| `safari-pinned-tab.svg`                               | Aba fixada do Safari (silhueta monocromática)                                          |
| `logo.svg`                                            | Cópia de `icon.svg` que o gerador de ícones lê                                         |
| `logo-wordmark.svg`                                   | Logotipo para uso fora do app                                                          |
| `og-image.png`                                        | Prévia ao compartilhar o link (WhatsApp, Discord, X...)                                |

Configuração: `index.html` (links dos ícones, `theme-color`, metas de compartilhamento), `vite.config.ts` (manifesto da PWA com ícones, atalhos e a URL absoluta da prévia) e `pwa-assets.config.ts`.

## Combina com o tema

O ícone é laranja de ponta a ponta, então lê bem tanto em tela clara quanto escura e deixa o sistema aplicar o recorte (iOS arredonda, Android usa a máscara). O logotipo tem as duas versões (`wordmark.svg` e `wordmark-light.svg`). Dentro do app o logotipo é texto estilizado pelo CSS (`.logo`) e já troca de cor com o tema.

## Regras de uso

- Cores: só os tokens (`--orange #FF6A2B`, `--ink #111111`, `--paper #F4F4EF`). Nada de gradiente.
- Sem emoji. Não girar, esticar nem trocar a fonte do logotipo.
- Área livre ao redor: pelo menos a largura do ponto do "!".
- Tamanho mínimo do logotipo: 80 px de largura. O ícone vale até 16 px (favicon).

## Como regenerar

1. Em uma pasta temporária: `npm i opentype.js @expo-google-fonts/archivo` e copie `build-brand.mjs` para dentro dela (o módulo resolve `opentype.js` a partir da própria pasta).
2. Lá, `node build-brand.mjs ./saida` gera os SVG.
3. Copie `icon.svg` para `public/logo.svg` (e `icon-rounded.svg` para `public/favicon.svg`, `safari-pinned-tab.svg`).
4. `pnpm --filter @nocap/web generate-pwa-assets` refaz os PNG e o `favicon.ico`.
5. A imagem `og-image.png` é o `og.svg` renderizado em 1200 x 630.

## Compartilhamento (prévia do link)

Defina `VITE_SITE_URL` (ex.: `https://nocap.vercel.app`) no ambiente do build na Vercel. Sem ela, as tags com URL absoluta (`og:image`, `og:url`, `canonical`) ficam de fora, porque as prévias exigem URL absoluta.

## Não coberto

Telas de abertura (splash) do iPhone por modelo, ícone de loja (App Store/Play Store) e animação de logotipo.
