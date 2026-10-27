# Spec 050: Menu (Esc) unificado, convite no meio da partida e controles na tela

Pedido do Lucas em 26/10/2026. Status: **em andamento (Fut Fox, Desmorona! e Atravessa! com o menu novo; falta jogar com amigos reais).**

## 1. O que o Lucas pediu

1. Convidar gente no meio da partida do Fut Fox, do Desmorona! e do Atravessa!: o Esc abre um menu com **Convidar**, que abre um popup (amigos, copiar link, só o código da sala, ou buscar alguém).
2. O Esc dos três jogos parecido, com o essencial de todos e o que é só de cada modo (trocar de equipe só no Fut Fox).
3. Botões na tela melhores, **mostrando as teclas**, e **os comandos aparecem na primeira vez**.
4. A parte de rede (painel de ping) em todos.

## 2. Como ficou

- **`GameMenu`** (`components/GameMenu.tsx`): Continuar, as ações do modo (`actions`), Convidar, Controles, Painel de rede (só online), Som e Sair (dois toques, vermelho). O Esc fecha; no Atravessa! o Esc pausa e volta como antes (`escCloses=false`).
  - Fut Fox: tabela (Tab), câmera (F), time ou espectar, encerrar (líder).
  - Desmorona!: sem ações próprias; no treino offline o jogo pausa com o menu aberto.
  - Atravessa!: reiniciar partida; o menu é a pausa (3-2-1 ao voltar). Na sala não pausa: abre por cima.
- **`InviteDialog`**: em sala mostra o `InvitePanel` do lobby (código, enviar/copiar link, busca por @usuário e amigos). Offline não há sala: explica e leva a `/fox-cap?aba=amigos` para criar uma.
- **`GameTips`**: controles na primeira partida (por jogo, lembrados no aparelho) e pelo item "Controles" do menu.
- **Na tela:** botão de menu com a tecla Esc (`GearButton`), teclas do jogo no canto (Desmorona!, só no computador), dica com teclas no Atravessa!, painel de rede pequeno (`NetBadge`) no Desmorona! e no Atravessa! em sala.
- Mensagens e cartaz de gol do Fut Fox ficam sempre abaixo do placar e do tempo (variável `--bola-board-bottom`, medida do placar), com 2, 3 ou 4 times.

## 3. Limites

- Entrar numa sala do Desmorona! ou do Atravessa! no meio da rodada ainda não é possível (a sala recusa: "A partida já começou"); o convite serve para o convidado já estar no lobby quando a rodada acabar. No Fut Fox já é possível (entra como espectador).
- O painel de rede dessas duas salas mostra só o ping até o servidor.

## 4. Celular deitado (26/10/2026)

Os três jogos jogam de lado: menu em duas colunas sem rolar (altura até 460 px), botão de menu com ícone e a tecla Esc só no teclado, . No Atravessa! o controle continua sendo tocar (frente) e deslizar (o Lucas pediu para não ter setas na tela, 26/10/2026). Desmorona!: joystick flutuante na metade esquerda e Pular grande no canto direito. Fut Fox já tinha o HUD compacto para altura baixa. Testado em 844x390, 667x375 e 568x320 (`e2e/landscape-games.spec.ts`, `e2e/bola-mobile.spec.ts`).

## 5. Chat na partida (27/10/2026)

Fut Fox, Desmorona! e Atravessa! em sala têm chat por cima da partida (`GameChat`): só um botão pequeno; mensagem nova aparece ao lado por 5 s e some; tocar no botão (ou Enter) abre o chat, que fica até fechar (Esc ou Fechar). O servidor deixou o chat aberto durante a partida nesses três jogos. As teclas digitadas no chat não viram controle do jogo e soltar o mouse para clicar nele não abre o menu.

O chat ganhou (27/10/2026): botão mais alto, balão com os três pontinhos e **número de mensagens novas** (1, 2... 99+); tecla **T** abre e fecha (Enter também abre; Esc ou Enter com o campo vazio fecha); ao abrir o mouse aparece e o campo já fica pronto, e ao fechar o jogo prende o mouse de novo; celular em pé: folha na largura toda embaixo; deitado: painel estreito à esquerda e aviso de uma linha só. **Quem escreve aparece com cor:** no Fut Fox a do time, no Desmorona! e no Atravessa! a da raposa, e **cinza** para espectador. O painel de rede dessas duas salas vem ligado por padrão (desliga no menu).
