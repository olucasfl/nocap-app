# Spec 067: hubs da Mesmíssima, do Já Deu? e do Ecooo

Status: implementada (09/11/2026). Pedido do Lucas: os três jogos de reflexo e precisão ganham um hub com tela própria, no estilo das telas de jogo (specs 065 e 066), em vez das abas e fichas antigas.

## Fluxo
Início -> clicar no jogo -> hub (`/cor`, `/tempo`, `/eco`, componente `GameHubLanding` sobre `WordsLanding`):
- **Daily** (botão em destaque, com "disponível hoje" ou "feito · nota"): abre a tela própria do Daily de sempre (`DailyScreen`).
- **Modos de jogo**: cartões de cada modo; cada um abre um painel com recorde, regras em números, explicação e o botão **Jogar** (Intruso, da Mesmíssima, cria sala).
- **Jogar com amigos**: criar sala ou entrar com código (mesma lógica de sala de antes, com apelido e conflito de sala).
- **Como jogar**: a explicação de cada modo.
- **Configurações**: som do jogo.
- A rota com `?tab=friends` abre direto em amigos.

## Desenho
Cenário de bolhas (Mesmíssima), anéis (Já Deu?) e botões (Ecooo) só do lado do quadro no menu; botões e painéis sólidos; subtelas centralizadas. Os emblemas são próprios (paleta, relógio, quatro botões). Sem animação rítmica no Já Deu?: só deriva lenta.

## Mantido
Partidas, Daily, telas finais e salas continuam como estavam; o ranking segue na página própria.
