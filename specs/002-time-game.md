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

## Decisões em aberto

Brief #4 (curva), #6 (anti-trapaça).
