# 004: Salas multiplayer

## Objetivo

Jogar com amigos em salas presas a um jogo, em tempo real (Colyseus, um tipo de sala por jogo).

## Regras

1. Criar sala gera **código de 4 letras** e link, com compartilhamento nativo e convite direto pela aba Amigos.
2. **Lobby:** host configura as regras; todos marcam "pronto"; host pode expulsar; se o host cair, outra pessoa assume.
3. **Rodada:** o servidor sorteia a seed e inicia ao mesmo tempo para todos.
4. **Revelação:** respostas lado a lado com o alvo.
5. **Fim:** pódio, "Revanche" (mesma sala e jogo) ou "Sair".
6. **Reconexão:** quem bloqueou a tela volta e continua.
7. **Convites:** notificação diz o jogo e abre direto no lobby.

- Limite de jogadores: sugestão 2 a 8 (brief #7). Salas personalizadas nunca entram no ranking.
- Código de sala de um jogo nunca abre outro. Lobby, chat e eventos de sala não são persistidos.
- Jogos com informação escondida usam `viewFor` (estado filtrado por jogador).

## Critérios de aceite

- [ ] 2+ jogadores completam uma partida sincronizada.
- [ ] Reconexão restaura o estado.
- [ ] Host cai: outro assume.
- [ ] Resultado salvo como `kind = room`, `ranked = false` em sala personalizada.

## Decisões em aberto

Brief #1 (presencial vs remoto: chat/voz), #7, #13 (push).
