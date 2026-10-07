# 004: Salas multiplayer

> **Status: Cor implementada e verificada (2026-10-06).** Faltam o convite pela aba Amigos (notificação) e salas de outros jogos.

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

- Limite de jogadores: **2 a 12** (decidido pelo Lucas, brief #7). Salas personalizadas nunca entram no ranking.
- Código de sala de um jogo nunca abre outro. Lobby, chat e eventos de sala não são persistidos.
- Jogos com informação escondida usam `viewFor` (estado filtrado por jogador).

## Critérios de aceite

- [x] 2+ jogadores completam uma partida sincronizada.
- [x] Reconexão restaura o estado.
- [x] Host cai: outro assume.
- [x] Resultado salvo como `kind = room`, `ranked = false` em sala personalizada.
- [x] Sala exige conta; convidado não entra. Mesma conta em outro aparelho assume a vaga do primeiro.

## Como ficou

- **Servidor:** Colyseus 0.16 no mesmo servidor HTTP da API (`apps/api/src/rooms/`). Uma sala por código de 4 letras (sem I, O, 0, 1). As regras estão em `color-room.engine.ts`, sem rede e com relógio injetado (testado a fundo); `color.room.ts` só faz a rede.
- **Estado:** o servidor manda um `snapshot` completo a todos a cada mudança (salas pequenas). As respostas dos outros só aparecem na revelação.
- **Fluxo:** lobby (pronto, regras do host, expulsar) -> memorizar -> recriar (acaba quando todos travam ou no tempo) -> revelação (12 s ou o host avança) -> pódio -> revanche na mesma sala.
- **Regras do host:** rodadas (1 a 10), tempo de memorizar (0,1 a 10 s) e de recriar (10 a 60 s). Host que cai passa para o mais antigo conectado.
- **Reconexão:** 60 s para voltar (tela bloqueada, rede). O app guarda o token da sala na sessão e volta sozinho ao recarregar.
- **Salvamento:** ao fim, uma `matches` (`kind = room`, `mode = room`, `ranked = false`) e uma `match_players` por conta, com colocação.
- **Limitação:** as salas ficam na memória; reiniciar o servidor derruba todas (ver `docs/DEPLOY.md`).
- **Cor:** a seed da sala é sorteada pelo servidor, mas os alvos saem dela no app (mesma limitação de anti-trapaça da spec 008).

## Decisões em aberto

Brief #1 (presencial vs remoto: chat/voz), #7, #13 (push).
