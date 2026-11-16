# MOBILE-GUIDE.md: como o NoCap funciona no celular

Regras de responsividade para **todas** as telas e jogos: iPhone, Android, tablet, PWA instalado e navegador. Valem junto com
`.claude/rules/RULES.md` (que tem precedência). Toda tela nova ou alterada passa pela lista de verificação da seção 10 antes do commit.

Fontes da pesquisa (fóruns, documentação e artigos): [Chrome edge-to-edge](https://developer.chrome.com/docs/css-ui/edge-to-edge),
[web.dev viewport units](https://web.dev/blog/viewport-units), [web.dev PWA app design](https://web.dev/learn/pwa/app-design),
[firt.dev PWA no iOS](https://firt.dev/notes/pwa-ios/), [Polypane safe-area](https://polypane.app/blog/using-safe-area-inset-to-build-mobile-safe-layouts/),
[Sizzy safe-area](https://sizzy.co/blog/safe-area-insets), [interactive-widget](https://htmhell.dev/adventcalendar/2024/4/),
[VirtualKeyboard API](https://ishadeed.com/article/virtual-keyboard-api/), [html5gamedevs (barra do Safari)](https://www.html5gamedevs.com/topic/25114-ios-address-bar-horizontal/),
[WebKit bug 135198](https://bugs.webkit.org/show_bug.cgi?id=135198), [tamanhos de toque](https://blog.openreplay.com/improving-tap-targets-mobile-ux/),
[tamanhos de tela](https://sizzy.co/blog/responsive-viewport-sizes).

## 1. Aparelhos que precisam funcionar

Testamos por **largura útil em CSS px** (não pela resolução). Cada tela é verificada em retrato **e** paisagem.

| Classe | Exemplo | Retrato (CSS px) | Paisagem | Bordas |
|---|---|---|---|---|
| Celular pequeno com botão | iPhone SE, Android antigo | 375x667, 360x640 | 667x375, 640x360 | nenhuma (sem notch) |
| Android comum | Galaxy A, Pixel 7 | 360x800, 412x915 | 800x360, 915x412 | barra de gestos embaixo, furo de câmera no alto |
| iPhone com notch/ilha | iPhone 13 a 17 | 390x844, 393x852 | 844x390, 852x393 | topo 47 a 59, base 34; paisagem: lados 47 a 59, base 21 |
| iPhone grande | Pro Max, Plus | 430x932, 440x956 | 932x430, 956x440 | idem |
| Dobrável | Fold fechado/aberto | 344x882, 673x841 | 882x344 | pode mudar de largura com o app aberto |
| Tablet | iPad mini, iPad | 768x1024, 820x1180 | 1024x768, 1180x820 | topo 24, base 20 |
| Desktop | notebook | 1280x800, 1440x900 | n/a | nenhuma |

Altura mínima útil em paisagem: **320 px** (menos que isso não é suportado, mas nada pode quebrar: rola).

## 2. Meta viewport e PWA

- `viewport-fit=cover` é obrigatório (sem ele o iOS devolve 0 em todo `env(safe-area-inset-*)`). Já está no `index.html`.
- O app **não escala por zoom** (`user-scalable=no`): por isso os alvos de toque e a fonte precisam ser grandes o bastante sem zoom.
- PWA instalado no iOS só aceita `display: standalone`; `fullscreen` e `orientation` do manifest **não funcionam no iOS**. Nada de depender
  de travar orientação: o jogo precisa funcionar nas duas e, onde só uma serve, mostrar o aviso "vire a tela" (`rotate-hint`).
- iOS não tem a API de tela cheia para páginas. No navegador (não instalado), a barra do Safari aparece ao tocar na borda de baixo/cima:
  **nenhum botão de jogo fica colado na borda** (use a margem da seção 3), e o canvas de jogo usa `dvh`, não `vh`.
- Android edge-to-edge: o conteúdo corre por baixo da barra de gestos; `safe-area-inset-bottom` muda quando a barra aparece. Sempre variável, nunca número fixo.
- Android (Chrome) pode reportar `safe-area-inset-left/right` estranho em paisagem; por isso a regra é "margem mínima + inset" (`max()`), não só o inset.
- Armazenamento e login do app instalado são separados do Safari (iOS): não assumir sessão compartilhada.

## 3. Áreas seguras (notch, ilha, câmera no furo, barra de gestos)

1. Toda tela de largura total usa as variáveis `--sa-top/right/bottom/left` (definidas em `styles/responsive.css`, já divididas pelo zoom da moldura).
2. **Margem de respiro mínima**: `max(12px, var(--sa-x))` nas bordas onde há controle. Em celular sem notch o inset é 0; o respiro de 12 px impede o botão de colar na borda.
3. Em paisagem o notch fica **dos lados**: HUD, botões e joystick usam `--sa-left` e `--sa-right`; conteúdo de fundo (cenário, canvas, imagem) pode sangrar até a borda.
4. Fundo e cor de fundo vão até a borda física (sem faixa branca/preta); só **controles e texto** respeitam a área segura.
5. Barra inferior (menu de abas, botões de ação): `padding-bottom: calc(Xpx + var(--sa-bottom))`.
6. Nunca posicionar com `top:0` ou `left:0` fixos algo que o usuário toca ou lê, sem a margem.

## 4. Altura e unidades

- `100vh` é proibido para altura de tela: no mobile ele inclui a barra do navegador e corta o rodapé. Usar `100dvh` (com `100vh` de reserva
  antes) para telas que acompanham a barra, e `100svh` para o que não pode pular (hero, modal, tela de jogo que anima altura).
- Canvas de jogo: tamanho vem do `ResizeObserver`/`visualViewport`, não de `window.innerHeight` lido uma vez. Recalcular em `resize`,
  `orientationchange` e `visualViewport.resize` (a barra do Safari muda a altura sem avisar).
- Rotação: depois de girar o aparelho, esperar ~300 ms e recalcular (o iOS atualiza as medidas atrasado).
- Teclado virtual: telas com campo de texto usam `interactive-widget=resizes-content` ou `visualViewport` para o campo não ficar escondido;
  o campo focado precisa estar visível acima do teclado.

## 5. Layout: o que fazer quando não cabe

Mudar a organização é permitido e esperado (foi o que o Counter Fox fez). Ordem de preferência:

1. **Empilhar em colunas** (retrato) e **dividir em duas colunas** (paisagem): título e ação principal de um lado, conteúdo do outro.
2. **Menu de abas embaixo** em retrato; **barra lateral estreita** em paisagem baixa e tablet (já existe em `responsive.css`).
3. **Trocar texto por ícone** quando faltar largura (sempre com `aria-label`).
4. **Passar a lista para rolagem** dentro de um painel com altura limitada; a ação principal fica fixa e sempre visível.
5. **Dividir em etapas** (assistente de 2 ou 3 passos, como o menu "Antes de correr") em vez de espremer tudo numa tela.
6. Reduzir espaçamento/fonte com `clamp()` até o limite de legibilidade (seção 6); abaixo disso, trocar a organização, não o tamanho.

Proibido: rolagem **horizontal** da página, texto cortado sem reticências intencional, botão coberto por outro, conteúdo além da área
segura, `position: fixed` que cobre o conteúdo no retrato pequeno.

## 6. Tipografia e alvos de toque

- Alvo de toque mínimo **44x44 px** (Apple) / **48 dp** (Google); em controles de jogo, **56 a 80 px**. Espaço entre alvos: **8 px** ou mais.
  Exceção documentada: ícone pequeno cuja área clicável (padding) chega a 44 px.
- Texto de leitura **14 px** ou mais (campos de texto sempre 16 px: abaixo disso o iOS dá zoom no foco). Texto secundário **12 px** no mínimo; rótulo em caixa-alta (mono) **10,5 px** declarado; a varredura mede o tamanho real na tela (já com o `zoom` da paisagem) e acusa abaixo de 9,5 px (caixa-alta) ou 11 px (demais).
- Fontes e espaçamentos com `clamp()` entre o celular pequeno (360) e o grande (440).
- Unidade de tamanho de jogo em CSS px; nunca assumir DPR (1 a 3).

## 7. Toque e gestos

- Área de jogo: `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`, `-webkit-user-select: none`;
  `overscroll-behavior: contain` no corpo durante o jogo (Safari 16+).
- Telas de menu: `touch-action: manipulation` (sem atraso de toque duplo).
- `preventDefault()` nos eventos de toque da área de jogo (senão a página rola, dá zoom ou puxa para atualizar).
- Polegar: controles de movimento à esquerda embaixo, ações à direita embaixo; informação no terço de cima. Nada importante no meio do caminho do polegar.
- Gestos do sistema reservam as bordas (voltar no iOS na borda esquerda, gestos do Android na base): controles ficam a **16 px** ou mais delas.
- Multitoque: joystick e botão de ação ao mesmo tempo precisam funcionar (pointer events por `pointerId`).
- Hover não existe: nada depende de `:hover`; tudo tem estado `:active` visível.

## 8. Desempenho no celular

- Alvo: 60 fps nos médios; 30 fps estáveis nos fracos. Qualidade `baixa` por padrão em ponteiro "coarse" (já existe no Fox GP).
- Pixel ratio máximo 1,5 (médio) e 1 (baixo) em canvas; sombras e pós-processamento desligados na qualidade baixa.
- Animar só `transform` e `opacity` (regra do projeto). Respeitar `prefers-reduced-motion`.
- Imagens do cenário em `webp`, carregamento em pacotes (o pacote de detalhe só no computador).

## 9. Telas especiais

- **Tela de morte/fim de jogo:** cabe em uma tela em retrato e paisagem; botões "Jogar de novo" e "Sair" sempre visíveis sem rolar; placar rola dentro do painel.
- **Pausa/menu do jogo:** cobre a tela inteira, respeita as bordas, botão de voltar com 44 px.
- **Lobby/sala:** lista de jogadores rola dentro do painel; código da sala e "Iniciar" fixos.
- **Modal/folha:** altura máxima `calc(100svh - 24px - safe-area)`; conteúdo rola; botão fechar sempre visível.
- **Aviso de orientação:** só quando o jogo realmente não cabe; nunca bloqueia o resto do app.

## 10. Lista de verificação (antes de todo commit de tela)

1. Retrato e paisagem em: 360x640, 375x667, 390x844 (com notch), 412x915, 430x932, 800x360, 844x390 (com notch), 932x430, 820x1180 e 1180x820.
2. Sem rolagem horizontal da página; nada além da área segura (varredura automática `mobile-audit`).
3. Nenhum alvo de toque menor que 44 px (varredura reporta; exceções precisam de motivo).
4. Texto legível (>= 12 px) e sem corte; botão principal visível sem rolar.
5. Barra do navegador recolhendo/aparecendo não esconde nada (usar `dvh`/`svh`).
6. Teclado virtual aberto: o campo continua visível.
7. Tema claro e escuro; `prefers-reduced-motion`.
8. Se o layout teve de mudar para caber, anotar no commit e na spec da tela.

## 11. Como verificar

- `pnpm --filter web exec playwright test e2e/mobile-audit.spec.ts --project=desktop --trace off` roda a matriz de aparelhos (com
  áreas seguras emuladas por CDP) em todas as telas e grava o relatório em `test-results/mobile-audit/` (JSON e capturas).
- Emulação não substitui aparelho real: barra do Safari, teclado, gesto de voltar e FPS reais só se confirmam no celular. Antes de uma
  versão importante, conferir à mão em um iPhone com ilha, um iPhone SE/pequeno e um Android com gestos.
