# Spec 065: telas próprias dos jogos do Word's (Classic, Connect e Bee)

Status: implementada (09/11/2026), com testes e2e atualizados. Pedido do Lucas: ao clicar em um jogo do Word's, abrir uma tela personalizada para aquele jogo, no mesmo estilo das telas do Fox Cap! (`GameLanding`, spec 058 seção 10), com opções à esquerda, cenário animado e símbolo próprio de cada jogo, e redirecionamento correto, sem sobrar nada da interface antiga.

## Fluxo
`/words` (3 cartões) -> clicar no jogo -> tela própria do jogo (portal em tela cheia, z-index 40, página de trás travada). Escape e "Voltar" sobem um passo; "Voltar aos Word's" leva a `/words`.

## Classic Word's (`/words/classic`)
Menu: **Daily**, **1 Palavra**, **2 Palavras**, **4 Palavras**, **Como jogar**, **Configurações** (som, `MuteButton`), **Voltar aos Word's**.
- **Daily**: painel com a palavra do dia (#N) e o estado: não jogado ("Ainda não jogou hoje"), em andamento (tentativas usadas) ou concluído (acertou em X / não foi dessa vez, a palavra, "a próxima sai à meia-noite"); sequência atual e melhor; botão Jogar/Continuar (`/words/classic/jogar`); link do ranking. À direita o tabuleiro: vazio com guias, parcial ou o jogo inteiro colorido (`decodePattern`). Sem conta: convite para entrar/criar conta (o servidor continua recusando).
- **1, 2 e 4 Palavras**: painel com progresso (completas, em andamento, novas), botão Continuar/Começar fase N e, à direita, o catálogo (filtros, faixas Fácil a Mestre, casas com `tentativas usadas/total`, desistência em vermelho). Clicar numa casa abre `/words/classic/fase/$modo/$n`.
- **Como jogar**: cores (com exemplo AMIGO/AMBOS) e regras.

## Connect e Bee (`/words/connect`, `/words/bee`)
Menu: **Continuar/Começar** (última fase em andamento ou próxima nova), **Escolher fase** (painel + catálogo à direita), **Como jogar**, **Configurações**, **Voltar aos Word's**. Resumo e barra de progresso na tela inicial. Connect mostra perfeitas e grupos; Bee mostra pontos por fase e soma.

## Revisão de 09/11/2026 (pedido do Lucas)
- Menu principal de cada jogo: botões à esquerda e quadro à direita, como antes. Subtelas (modo, escolher fase, Daily, regras, configurações): tudo **centralizado e dividido** (logo pequena no canto, painel no centro, catálogo logo abaixo; no Daily o painel e o tabuleiro lado a lado).
- Nada animado atrás de botões e painéis: botões e painéis são sólidos e, no menu, o cenário fica só do lado do quadro.
- Daily: contador "FALTA HH:MM:SS" até a meia-noite de Brasília (UTC-3), recarrega o Daily quando zera (`secondsToBrasiliaMidnight`, testado).
- Bordas de iPhone/iPad: `e2e/safe-area-sweep.spec.ts` emula notch e barra de início (CDP) em 5 aparelhos e 28 rotas; corrigidos `.app` (largura da tela deitada ignorava a área segura) e `.gx-wrap` (altura passava da tela e o padding de segurança sumia em tela baixa).

## Rotas e compatibilidade
`/words/classic` (menu), `/words/classic/daily` (abre o Daily; volta da partida do dia), `/words/classic/fases/$modo` (abre o modo), `/words/bee|connect` (menu), `/words/bee|connect/fases` (abre o catálogo; é para onde as telas de fase voltam). Links antigos continuam valendo. `CONNECT_RULES` e `BEE_RULES` seguem exportados dos arquivos de catálogo.

## Desenho
Componente `WordsLanding` (`apps/web/src/games/words/landing/`) reusa `.gx*` de `components/game-landing.css`; `words-landing.css` traz cenários (letras caindo no Classic, barras coloridas deslizando no Connect, favo e abelhas no Bee), quadros e catálogo. Cores: Classic verde, Connect roxo, Bee âmbar. Só `transform`/`opacity` animam, com `prefers-reduced-motion`. No celular o catálogo desce para baixo do painel e a tela rola.

## Testes
`apps/web/e2e/words.spec.ts` atualizado (menu, Daily nos três estados, catálogo, rotas de volta). Removido bloco duplicado e incompleto do Connect que impedia o Playwright de carregar o arquivo. Falhas que já existiam e não vêm daqui: "o teclado da tela funciona" (Classic) e "o pangrama mostra o banner" (Bee).

## Falta
CSS antigo do hub de cartões (`cw-*`, `cx-hero`...) ficou sem uso nas páginas de catálogo; limpar depois. Conferir a tela no celular de verdade.
