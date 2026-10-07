# 003: Histórico

## Objetivo

Aba própria com as partidas do jogador.

## Regras

- Lista: jogo, modo, tipo (solo/sala/daily), data, nota, colocação. Paginação por keyset.
- Filtros: jogo, tipo, amigo (amigo na Etapa 3).
- Detalhe rodada a rodada (Cor: alvo × você, alvo regenerado pela seed; Tempo: linha do tempo).
- Confronto direto ("Você 12 × 8 Pedro na Cor") também no perfil do amigo (Etapa 3).
- Retenção: detalhe das rodadas só nas últimas 200 partidas por jogo (brief #10); resumo e agregados para sempre.

## API

`GET /players/:guestId/matches?cursor=&limit=`. Cada item traz a `seed`, para o app regenerar os alvos.

## Estado

Etapa 1: lista paginada ("Carregar mais") e detalhe rodada a rodada da Cor. Filtros, colocação e amigos ficam para as Etapas 2 e 3.

## Critérios de aceite

- [ ] Partida jogada aparece no topo da lista.
- [ ] Lista pagina sem duplicar nem pular itens.
- [ ] Partida antiga sem `answers` mostra só o resumo.

## Pendente: partida de sala mostra quem jogou e como ficou (pedido do Lucas em 07/10/2026)

> **Decisão final do Lucas: histórico de sala de TODOS os jogos (inclusive Intruso e Siga o Líder), mostrando só quem jogou e a colocação, sem notas nem rodadas.** Intruso entra na aba da Mesmíssima (modo `impostor`) e Siga o Líder na do Ecooo (modo `leader`). **Status: implementado (falta testar ao vivo).** Feito: ao abrir uma partida de sala aparecem todos os jogadores com colocação e nota (`GET /me/matches/:id/room`, só @usuário, só quem participou). Falta: rodadas de todos, resumo no cartão da lista, filtro por amigo e guardar Intruso/Siga o Líder. Pedido: "no histórico, quando tem uma partida com amigos em uma sala, essa partida deve mostrar quem jogou e como ficou."

**Hoje:** uma partida de sala já é guardada (`kind = room`, nunca no ranking, uma linha em `match_players` por jogador, com `placement` e a nota). No histórico ela aparece só como a **minha** linha ("2º lugar", minha nota). Não mostra os outros jogadores nem as notas deles, embora os dados estejam no banco.

**O que mostrar ao abrir uma partida de sala:**

- **Quem jogou:** todos os jogadores da sala, com @usuário, em ordem de colocação (1º, 2º, 3º...), destacando a minha linha.
- **Como ficou:** a nota ou os pontos de cada um, o jogo e o modo, a data, e quantas rodadas teve. Empate aparece como empate.
- **Rodada a rodada:** o detalhe de cada rodada de todos os jogadores (Mesmíssima: a cor alvo contra a de cada um; Já Deu?: a linha do tempo com o ponto onde cada um parou), no mesmo desenho da revelação da sala.
- No cartão da lista, um resumo curto: "Sala com @ana, @bia e +2" e a minha colocação.

**O que muda no servidor**

- O item de histórico de sala devolve também os **outros jogadores** da mesma partida: `@usuário`, colocação, nota, e (se ainda guardado) as respostas.
- Privacidade: só aparecem os participantes **da mesma sala**, só o @usuário e as notas daquela partida (nunca nome real nem e-mail). Quem saiu da sala antes do fim aparece como saiu.
- A regra de retenção continua: o detalhe de rodada só existe nas últimas 200 partidas por jogo; as mais antigas mostram só o resumo e a classificação.
- Filtro "Sala" do histórico já existe; ganha a busca por amigo (partidas em que joguei **com** tal pessoa).

**Salas que ainda não salvam:** hoje o Intruso (e o futuro Siga o Líder do Ecooo) **não** gravam histórico. Para essas aparecerem aqui é preciso decidir guardar o resultado delas (pódio e pontos por pessoa). Pergunta aberta para o Lucas.

**Perguntas abertas**

- Quer guardar também a partida do Intruso e do Siga o Líder no histórico, com quem era intruso (depois da revelação)?
- O resumo da lista mostra todos os nomes ou só os três primeiros?

**Critérios de aceite (pendentes)**

- [ ] Abrir uma partida de sala mostra todos os jogadores, a colocação e a nota de cada um, em ordem.
- [ ] A minha linha vem destacada e o empate aparece como empate.
- [ ] Mostra as rodadas de todos os jogadores enquanto o detalhe ainda existe, e só o resumo depois.
- [ ] Só os participantes daquela sala aparecem, só com @usuário (nada de nome real nem e-mail).
- [ ] O filtro por amigo mostra as partidas em que joguei com ele.
