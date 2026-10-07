# 002: Jogo do Tempo

> **Status: solo implementado e verificado (2026-10-06): Clássico, Rápido, Sem estourar e Daily.** A curva da nota (brief #4) e as checagens anti-trapaça (#6) são **propostas minhas, aguardando a validação do Lucas**. Faltam: modo Sequência e salas do Tempo.

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

- [x] Nenhum elemento mostra ou sugere a passagem do tempo durante a contagem.
- [x] Nota sempre em [0, 10]; mesma seed, mesmos alvos.
- [x] Servidor recalcula a nota a partir dos ms.
- [x] Checagens de plausibilidade para ranking (brief #6).

## Pendente: jogo rápido (pedido do Lucas)

O Tempo também terá o modo **Rápido**, de 1 rodada (preset `quick`, ranking próprio, nota máxima 10). Detalhes em [006-jogo-rapido.md](006-jogo-rapido.md).

## Pendente: nota generosa

Feedback sobre a Cor: a nota estava dura demais (0 para "longe, mas não tanto"; 7 a 8 para "bem perto"). Ao definir a curva do Tempo (brief #4), seguir a mesma filosofia: cauda longa embaixo (erro grande ainda rende uma "pontuaçãozinha") e topo largo (erro pequeno rende ~9). Ver a tabela de metas em [001-color-game.md](001-color-game.md).

## Pendente: modo noturno

A tela do Tempo (alvo, contagem neutra e resultado) deve nascer já nos dois temas. Ver [005-modo-noturno.md](005-modo-noturno.md).

## Como ficou

- **Lógica:** `packages/games/src/time` (alvos por seed em múltiplos de 100 ms, nota, plausibilidade). Presets: `classic` (5 rodadas, alvos de 5 a 15 s), `quick` (1 rodada), `strict` ("Sem estourar": passou do alvo, zero).
- **Curva da nota (PROPOSTA, brief #4):** erro relativo `e = |resposta − alvo| / alvo`; `nota = 10 / (1 + (e / 0.15)^1.6)`, em [0, 10], 1 casa. Mesma filosofia da Cor: topo largo, cauda longa.

  | erro | 1%  | 3%  | 5%  | 10% | 20% | 40% | 80% |
  | ---- | --- | --- | --- | --- | --- | --- | --- |
  | nota | 9,9 | 9,3 | 8,5 | 6,6 | 3,9 | 1,7 | 0,6 |

  Ajustar o 0,15 e o 1,6 jogando. A curva está numa função só (`scoreFromError`) e versionada (`TIME_SCORE_VERSION = 1`, guardada em `matches.settings`).

- **Anti-trapaça (PROPOSTA, brief #6):**
  1. **Sessão assinada pelo servidor** (`POST /games/time/session`): o servidor sorteia a seed (Daily: a do dia) e assina o instante de início (HMAC com `BETTER_AUTH_SECRET`).
  2. Ao enviar, o servidor **recusa tempos que somam mais do que o relógio dele viu** passar desde o início (folga de 1,5 s). Responder o alvo exato sem esperar de verdade não funciona.
  3. **Sessão solo é de uso único** (409 se reusar) e expira em 7 dias (cobre a fila offline).
  4. **Plausibilidade por rodada:** entre 200 ms e 3× o alvo (recusa toque duplo e contagem absurda).
  5. A nota é sempre recalculada no servidor, a partir dos ms.
- **Limite honesto:** quem cronometra por fora (um relógio de verdade) e toca no instante certo **não é detectável**, porque a medição é no aparelho. O que o servidor impede é inventar o resultado sem esperar o tempo. Para entre-amigos basta; para ranking aberto de verdade, seria preciso medir no servidor (o que o lag de rede estraga).
- **Telas:** início (modos), alvo, **contagem** (um botão do tamanho da tela, texto fixo, sem número, barra, animação, som nem vibração; verificado no navegador: 0 mudanças no DOM, 0 animações, 0 sons), resultado (alvo × você, diferença com sinal, carimbo) e final. O Rápido termina no resultado.
- **Sem conexão:** o Tempo precisa de internet para **começar** (a sessão vem do servidor). A Cor continua jogável offline.
- Histórico, recordes e ranking cobrem os dois jogos (`/rankings/:game`). O Daily conta para a mesma sequência do Daily da Cor.

## Decisões em aberto

- **Brief #4 (curva) e #6 (anti-trapaça): propostas acima, falta o Lucas validar jogando.**
- Modo **Sequência** (3 intervalos seguidos) ainda não implementado.
- **Salas do Tempo** (alvo igual para todos, linha do tempo na revelação) ainda não implementadas.
