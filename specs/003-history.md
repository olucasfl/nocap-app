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
