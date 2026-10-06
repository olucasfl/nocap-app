# 002: Jogo do Tempo

## Objetivo

Contar o tempo de cabeça. O jogador vê o alvo, toca para iniciar e toca para parar, **sem nunca ver o tempo correndo**.

## Regras

- Proibido durante a contagem: cronômetro, número, barra de progresso, animação em loop ou rítmica, qualquer som.
- Nota por **erro relativo** ao alvo (errar 0.3 s em 2 s pesa mais que em 10 s). Curva exata em aberto (brief #4).
- Medição no aparelho com `performance.now()`; só a duração (ms) vai ao servidor.
- Modos: **Clássico** (inicia e para), **Sequência** (3 intervalos seguidos, resultado no final), **Sem estourar** (passou do alvo, vale zero).
- Descartados: Contador que some, Segurar, Distração, Alvo relâmpago.
- Sala: rodadas, faixa de alvos (curtos 1–5 s, médios 5–15 s, longos 15–30 s), modo, resultado por rodada ou só no fim.
- Multiplayer: todos recebem o mesmo alvo; revelação com linha do tempo mostrando onde cada jogador parou.

## Telas

Alvo → tocar para iniciar (tela neutra, sem feedback) → tocar para parar → resultado "5.60 s vs 5.91 s, +0.31 s" + nota.
Referência: `docs/reference/design-tempo-resultado.html`.

## Critérios de aceite

- [ ] Nenhum elemento mostra ou sugere a passagem do tempo durante a contagem.
- [ ] Nota sempre em [0, 10]; mesma seed, mesmos alvos.
- [ ] Servidor recalcula a nota a partir dos ms.
- [ ] Checagens de plausibilidade para ranking (brief #6).

## Pendente: jogo rápido (pedido do Lucas)

O Tempo também terá o modo **Rápido**, de 1 rodada (preset `quick`, ranking próprio, nota máxima 10). Detalhes em [006-jogo-rapido.md](006-jogo-rapido.md).

## Pendente: nota generosa

Feedback sobre a Cor: a nota estava dura demais (0 para "longe, mas não tanto"; 7 a 8 para "bem perto"). Ao definir a curva do Tempo (brief #4), seguir a mesma filosofia: cauda longa embaixo (erro grande ainda rende uma "pontuaçãozinha") e topo largo (erro pequeno rende ~9). Ver a tabela de metas em [001-color-game.md](001-color-game.md).

## Pendente: modo noturno

A tela do Tempo (alvo, contagem neutra e resultado) deve nascer já nos dois temas. Ver [005-modo-noturno.md](005-modo-noturno.md).

## Decisões em aberto

Brief #4 (curva), #6 (anti-trapaça).
