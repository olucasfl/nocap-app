# Spec 049: Fox Cap! com modos offline e sala de jogos trocáveis

Pedido do Lucas em 26/10/2026. Status: **implementada; falta jogar com amigos reais.**

## 1. O que o Lucas pediu

1. Ao entrar no **Fox Cap!**, uma lista com todos os modos **offline** para jogar direto: "Atravessa! Infinito", "Desmorona! Treino" e "Fut Fox Treino".
2. Uma aba **Com amigos**: cria uma sala **sem jogo escolhido**. Dentro dela o líder convida a galera e **escolhe e troca o jogo** (Fut Fox, Atravessa! ou Desmorona!); as **regras e a interface se adaptam** ao jogo escolhido.

## 2. Como ficou

- **Tela** (`FoxCapPage`): abas `Offline` e `Com amigos`. Os três cartões offline levam à página do jogo com `?treino=1`, que já abre a partida (Atravessa!) ou a escolha de formato/bots (Fut Fox e Desmorona!). "Criar sala" leva a `/sala?jogo=foxcap`.
- **Servidor** (`FoxRoom`, tipo de sala `foxcap`): nasce com o `FoxLobbyEngine` (só reúne a galera; `start` recusa com "Escolha um jogo antes de começar"). O líder manda `pickgame {game}` no lobby e a sala **troca o motor** (mesmo padrão do Ecooo, `adoptFrom`: pessoas, líder e chat vão junto; todo mundo volta a "não pronto"). A troca é recusada se há mais gente do que o jogo aceita (Atravessa! e Desmorona!: 8; Fut Fox: 15). As mensagens de cada jogo (`bin`, `bteam`, `run`, `dpos`...) valem só enquanto o motor é daquele jogo; tipos repetidos (`color` do Atravessa! e do Desmorona!) viram um despachante pelo jogo atual. Os jogos de 10 passos por segundo rodam a cada ~100 ms dentro do passo de 16 ms da sala.
- **Cliente:** o snapshot traz `flex: true`. A aba **Regras** do lobby mostra o seletor `Jogo da sala` (só o líder clica) acima das regras do jogo escolhido; a aba aberta é lembrada ao trocar de jogo. Sem jogo, o lobby (`FoxLobby`) mostra só Jogadores, Regras (seletor) e Convidar, com Começar desligado. Ao sair da sala o app volta ao Fox Cap!.
- **Sem ranking** em nenhum modo da sala (como antes). O Atravessa! offline continua com recorde e ranking.

## 3. Testes

- `fox-room.integration.test.ts` (servidor real): nasce sem jogo, só o líder escolhe, jogo inválido recusado, troca entre os três jogos mantendo as pessoas, mensagens de outro jogo ignoradas.
- `e2e/foxcap-hub.spec.ts` (abas, atalhos offline e "Criar sala").
- Verificado à mão com dois navegadores: criar a sala, o convidado entrar e a tela dele acompanhar a escolha e as trocas do líder.

## 4. Limites

- Trocar o jogo só no lobby (não durante a partida).
- As salas criadas pelo botão "Com amigos" dentro de cada jogo (por exemplo `/sala?jogo=bola`) continuam existindo, fixas no jogo.
