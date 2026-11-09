# Spec 066: hub do Block's com tela própria

Status: implementada (09/11/2026). Pedido do Lucas: o Block's vira um hub no estilo das telas dos jogos (spec 065 / `GameLanding`), com os dois jogos juntos; a tela de cartões antiga deixa de existir.

## Fluxo
Início -> Block's -> hub (`/blocks`, `BlocksStart` sobre `WordsLanding game="blocks"`): **Block Classic**, **Block Towers**, **Como jogar**, **Configurações** (som) e **Voltar aos jogos**.
- **Block Classic**: painel com recorde, partida em andamento (pontos, rodada, dicas) e **Continuar partida** / **Começar do zero**, ou **Jogar** quando não há partida guardada; ao lado, o quadro com arte, regras e passo a passo. O botão do menu mostra "continuar · N pts" quando há partida guardada.
- **Block Towers**: igual, com recorde em peças e as teclas do computador.
- Cor do painel por jogo (Classic laranja, Towers azul); cenário de blocos caindo só do lado do quadro; botões e painéis sólidos.
- Celular deitado: painel e quadro lado a lado, enxutos, para os botões caberem sem rolar.

## Testes
`blocks-resume`, `blocks-fit` e `blocks-safe-area` atualizados para o novo fluxo; `theme-sweep` e `safe-area-sweep` já cobrem `/blocks`.
