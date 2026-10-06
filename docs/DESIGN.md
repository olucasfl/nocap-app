# Design: Pop Brutal

Direção visual aprovada do NoCap. Os tokens vivem em `apps/web/src/styles/tokens.css`.

## Telas de referência (abrir no navegador)

| Arquivo                                      | O que é                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `docs/reference/prototipo-cor.html`          | **Jogo da Cor jogável.** Fonte da verdade de fluxo, animações, sons (Web Audio) e cálculo ΔE2000. Portar, não reinventar. |
| `docs/reference/design-hub.html`             | Hub (aba Jogos) e bottom nav                                                                                              |
| `docs/reference/design-cor-resultado.html`   | Resultado da rodada da Cor                                                                                                |
| `docs/reference/design-tempo-resultado.html` | Resultado do Tempo (linha do tempo)                                                                                       |

Atenção: os `design-*.html` dependem de um `support.js` (runtime "x-dc") que **não veio junto** na pasta; abertos direto no navegador eles não renderizam. Para ver as telas, use o `prototipo-cor.html` (autônomo) ou o app rodando (`pnpm dev`); o código das telas desses arquivos serve de referência de layout. Eles usam placeholders `{{accent}}` = `#FF6A2B` e `{{accent2}}` = `#2F5BFF`; se aparecerem
literais ao abrir, é isso.

## Tokens

| Token      | Valor     | Uso               |
| ---------- | --------- | ----------------- |
| `--paper`  | `#F4F4EF` | fundo             |
| `--ink`    | `#111111` | texto e bordas    |
| `--orange` | `#FF6A2B` | accent            |
| `--blue`   | `#2F5BFF` | accent 2          |
| `--yellow` | `#FFD23F` | selos e destaques |
| `--white`  | `#FFFFFF` | cartas            |

Bordas de **2.5px** em `--ink`, raio 12 a 20px, **sombras duras sem blur** (`5px 5px 0 var(--ink)`).
Fontes: **Archivo** (900/700/500; itálico 900 no logo "no cap!") e **Space Mono** (números e rótulos).
Ícones: SVG inline de traço. **Nunca emoji.** Sem gradiente genérico, sem Inter/Roboto.

## Animação (faz parte do design)

- Botão afunda na própria sombra no `:active`, com quique curto na volta.
- Cor entra virando como carta (`rotateY`).
- Nota conta de 0 até o valor com tiques; depois cai um carimbo amarelo com overshoot e tremor de tela.
- Swatches do resultado entram pelos lados, levemente rotacionados.
- Listas entram em sequência com stagger de 40 a 50 ms.
- Só `transform` e `opacity`. Respeitar `prefers-reduced-motion`.

## Sons (Web Audio, zero arquivos)

`clack` (botão), `flip` (cor aparece), `vanish` (cor some), `slide` (tique do slider), `tick(n)` (contagem
subindo de tom), `thunk` (carimbo), `win` (nota ≥ 9.5), `boing` (nota < 5). Botão de mudo salvo no
aparelho; áudio desbloqueado no primeiro toque; `navigator.audioSession.type = 'ambient'` quando existir;
`navigator.vibrate` só onde houver (Android).

**Jogo do Tempo: nenhum som, animação rítmica, número ou barra durante a contagem.**

## Telas ainda sem design

Lobby da sala, configuração de regras, Cor jogando (desktop), Tempo jogando, Histórico, Amigos, Perfil,
Ranking. Desenhar no Pop Brutal antes de implementar cada uma.
