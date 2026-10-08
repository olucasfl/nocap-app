# 016 · Maratona (nome de trabalho): o jogo-festa com micro-desafios e minijogos grandes

Status: **em planejamento (nada implementado)**. Pedido do Lucas em 08/10/2026, com documento de conceito. É o jogo mais complexo e mais investido do NoCap. Este arquivo organiza o plano, o que já temos para reaproveitar, os riscos e as **perguntas que precisam de resposta antes de codar** (seção 9).

> Nome: o documento do Lucas chama o jogo de "NoCap!", que já é o nome do app. Aqui vai como **Maratona** (provisório). Ver pergunta 4.

## 1. O que é

Party game online para 2 a 12 pessoas, só em sala (sem solo). Cada **rodada** são **5 micro-desafios rápidos** (todos jogam ao mesmo tempo, com pegadinhas) seguidos de **1 minijogo grande** (tela própria, tutorial e "pronto"). O líder escolhe quantas rodadas (1 rodada = 5 rápidos + 1 grande; N rodadas repetem o padrão). A pontuação soma ao longo da partida, com ranking animado entre os micro-desafios, e a última rodada pula o ranking e vai direto para a **revelação final**.

Ideia central do jogo: **piloto automático**. Os comandos são sempre no mesmo estilo e no mesmo lugar, e 20% deles mudam a regra (pegadinha). Quem lê rápido ganha de quem age no reflexo.

## 2. Fluxo da partida (resumo do documento do Lucas)

1. Lobby: líder escolhe rodadas; todos "PRONTO"; líder "INICIAR". Introdução animada.
2. Por rodada: 5 vezes [entrada do micro-desafio, todos jogam, espera todos (ou tempo limite), saída, ranking somado entra e sai].
3. Minijogo grande: tela dedicada, tutorial com as regras sorteadas, "PRONTO" de todos, líder inicia, execução, fim.
4. Se não é a última rodada: ranking de tensão e volta ao loop. Se é a última: revelação final com pódio, estatísticas, "Jogar de novo" e "Voltar".
5. Trocas de estado dentro do mesmo palco (container), por fade/slide; só os minijogos grandes têm layout próprio.

## 3. Catálogo

**Micro-desafios (80% normal, 20% pegadinha):**

- **Mesmíssima:** Padrão (parecer o máximo); Invertido (ficar o mais diferente possível); Às cegas adaptado (alvo 1,5 s, depois cobre, ajusta sem ver, "CRAVAR").
- **Já Deu?:** Padrão (tempo exato); Tempo Falso ("relógio X% mais rápido/lento"); Cego (números somem após 1 s).
- **Ecooo:** sequência fixa de 8 a 12 passos; Padrão (sem feedback de acerto durante; nota X/Y só no ranking); Reverso; Botão Proibido (ignorar uma cor; tocar nela zera a rodada).
- **Digitação Ligeira:** Padrão (palavra exata); Mão Boba (comando diz "mantenha o campo limpo": digitar ou enviar perde pontos); Invertido (de trás para frente); exceções (sem vogais, sem acentos, sem a letra A).

**Minijogos grandes:** Caça-Formas Caótico (30 a 45 s, regra de clicar + regra de evitar sorteadas; +100 certo, -150 proibido) e Arena X1 (duelos de reflexo; ímpar enfrenta o Bot NoCap; botão verde aparece em posição aleatória; vence quem abrir a vantagem; teto de 15 disparos).

## 4. O que já temos e reaproveita

| Peça                                                                                               | Onde                                     | Uso na Maratona                                                                    |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Núcleo da Mesmíssima (HSB, ΔE2000, nota 0 a 10, seed)                                              | `packages/games/src/color`               | Micro Mesmíssima (3 variantes só mudam a regra de nota e de exibição)              |
| Núcleo do Já Deu? (alvo, nota, servidor mede)                                                      | `packages/games/src/time`                | Micro Já Deu?                                                                      |
| Núcleo do Ecooo (sequência pela seed, `evaluateRun`)                                               | `packages/games/src/eco`                 | Micro Ecooo (sequência curta fixa; Reverso já existe; Botão Proibido é regra nova) |
| Motor de sala (lobby, líder, pronto, expulsar, revanche, reconexão, chat, histórico por colocação) | `apps/api/src/rooms/*`                   | A Maratona é mais um motor de sala (`PartyRoomEngine`)                             |
| Telas de jogo (sliders HSB, tela de contar, botões do Ecooo, Countdown)                            | `apps/web/src/games/*`, `screens/room/*` | Viram componentes do palco                                                         |
| Lobby novo (abas, regras, convidar, chat flutuante)                                                | `screens/room/lobby/*`                   | Reaproveita; regras: nº de rodadas                                                 |
| Fonte de verdade no servidor (recalcula a nota)                                                    | regra do projeto                         | Vale para tudo, inclusive os minijogos grandes                                     |

**O que não existe e é novo:** sincronização de relógio entre aparelhos, palco com transições, motor de múltiplas fases com sorteio de variantes, Digitação Ligeira (banco de palavras), Caça-Formas, Arena X1 (duelos, bot, latência), introdução e tutoriais animados, pontuação unificada entre jogos diferentes.

## 5. Arquitetura proposta

- **`packages/games/src/party/`** (lógica pura, testada): `plan(seed, rounds)` monta a partida (quais micro-desafios e variantes, qual minijogo grande); uma interface comum por desafio com `generate(seed, variant)` (o que vai ao cliente, sem segredo), `score(challenge, submission)` (pontos) e `describe(variant)` (texto do comando). Um arquivo por desafio (`color.ts`, `time.ts`, `eco.ts`, `typing.ts`, `shapes.ts`, `x1.ts`). Reusa os núcleos existentes.
- **API:** `PartyRoomEngine` (estende o motor de sala). Fases: lobby, intro, micro-entrada, micro-jogo, micro-saída, ranking, grande-tutorial, grande-pronto, grande-jogo, grande-fim, revelação final. **O servidor manda `startsAt`/`endsAt` em relógio do servidor** e cada aparelho calcula o desvio do relógio (ping de ida e volta) para todos verem o mesmo instante. Timeout por desafio para ninguém travar a sala.
- **Web:** `screens/room/party/` com o **Palco** (gerencia as transições; só `transform` e `opacity`; `prefers-reduced-motion`), um registro de componentes de micro-desafio (cada um recebe `challenge` e devolve `submission`), os dois grandes, ranking suave, introdução, tutorial e revelação.
- **Dados:** partida de sala gravada com colocação (modo `party`), como as outras. **Sem migration prevista.** Sem ranking global (sala nunca entra, regra 2).
- **Anti-trapaça:** o cliente nunca manda pontos; manda a resposta (cor travada, ms de parar, toques, texto, cliques) e o servidor calcula. Reação (X1) e Caça-Formas exigem cuidado extra (seção 7).

## 6. Plano em fases (cada uma termina com testes, build verde, commit e push)

Tamanhos: P pequena, M média, G grande. A ordem prioriza uma **fatia vertical jogável cedo** e deixa o mais difícil (X1) por último.

| Fase | Entrega                                                                                                                                                                     | Tam. | Pronto quando                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| 0    | Fechar as perguntas da seção 9; telas de referência em `docs/reference/` (palco, transições, ranking, tutorial, Caça-Formas, X1, revelação); tabela de pontuação final      | M    | Lucas aprova o desenho e a pontuação                                                  |
| 1    | Motor + Palco: máquina de fases, relógio sincronizado, transições, ranking suave, revelação, histórico; **um micro-desafio provisório**; simulador de 12 jogadores em teste | G    | 2 a 12 pessoas completam uma partida com um desafio só, transições suaves, sem travar |
| 2    | Micro Mesmíssima (3 variantes)                                                                                                                                              | M    | jogável e pontuado pelo servidor                                                      |
| 3    | Micro Já Deu? (3 variantes)                                                                                                                                                 | M    | idem (depende da pergunta 2)                                                          |
| 4    | Micro Ecooo (3 variantes)                                                                                                                                                   | M    | idem                                                                                  |
| 5    | Micro Digitação Ligeira (4 famílias de regra) + banco de palavras                                                                                                           | G    | idem, no celular e no computador                                                      |
| 6    | Grande: Caça-Formas                                                                                                                                                         | G    | 30 a 45 s, regras sorteadas, pontuação conferida no servidor                          |
| 7    | Grande: Arena X1 (pares, bot, latência justa)                                                                                                                               | G    | duelos simultâneos sem vantagem de ping                                               |
| 8    | Introdução animada, tutoriais, sons, balanceamento, teste de carga com 12 reais, deploy                                                                                     | G    | partida completa de 2 rodadas jogada ao vivo                                          |

Marco útil: **ao fim da fase 2** já dá para jogar uma Maratona completa com Mesmíssima nos 5 rápidos e um grande provisório, e só depois ir encaixando os outros desafios.

## 7. Riscos e pontos que não fecham ainda (resumo; detalhe nas perguntas)

1. **Conflito com decisão do brief (seção 2):** "jogos independentes, sem placar entre jogos". A Maratona mistura jogos e soma pontos.
2. **Conflito com a regra 3 do RULES.md:** nenhum cronômetro/número durante a contagem do Já Deu?. "Tempo Falso" e "Cego" mostram relógio/números.
3. **Justiça de latência no X1:** quem tem ping melhor leva vantagem. Medir no servidor com compensação, e mostrar o tempo sem prometer milissegundo exato.
4. **Acessibilidade:** regras só por cor ("evite peças verdes") excluem quem não distingue cores; comandos "não destacados" não podem ser ilegíveis.
5. **Digitação no celular:** teclado virtual, autocorreção e sugestões dão vantagem e atrapalham; exceções ("sem vogais", "sem acentos") têm casos de borda.
6. **Tempo morto:** 5 entradas e saídas de ranking por rodada somam muito tempo; esperar o mais lento de 12 pessoas trava o ritmo. Precisa de tempo limite e ranking curto (top 5 + eu).
7. **Pontuação:** notas 0 a 10, +100/-150, -500 e vitória de duelo precisam virar uma escala única; penalidade de -500 contra micro de 1000 pode deixar a pontuação negativa.
8. **Carga:** Caça-Formas com 12 pessoas clicando; enviar cliques em lotes e validar contra um cronograma de formas gerado pela seed.

## 8. Fora de escopo desta versão (sugestão)

Solo, Daily, ranking global, modo de times, mais de 2 minijogos grandes (a lista cresce depois: com 2 grandes, as rodadas 3 em diante repetem), e espectadores.

## 9. Perguntas para o Lucas (cada uma com a minha recomendação)

**A. Regras do projeto que esta ideia toca (precisam do seu "sim" explícito)**

1. **Jogos independentes (brief, seção 2).** A Maratona soma pontos entre jogos. Posso tratá-la como um **jogo novo à parte** (5º cartão do Hub), com versões "adaptadas" dos micro-desafios, sem mexer nos jogos originais, que continuam independentes? _Recomendo: sim._
2. **Já Deu? sem relógio (regra 3).** No Tempo Falso e no Cego aparece relógio/números. Dentro da Maratona abrimos **exceção só para este modo**? E o que é exatamente o "Tempo Falso": mostrar um relógio que anda mais rápido/lento que o real? _Recomendo: exceção só na Maratona, e explique o Tempo Falso._
3. **Ranking.** Sala nunca entra no ranking. A Maratona fica **sem ranking e sem solo** por enquanto (só histórico de sala com quem jogou)? _Recomendo: sim; um "Daily da Maratona" pode vir depois._

**B. Desenho e regras do jogo** 4. **Nome.** "NoCap!" já é o app. Qual o nome do jogo? (Maratona, Piloto Automático, Reflexo, Circuito...) 5. **Sorteio dos 5 rápidos.** Como escolher os 5 entre 4 jogos? _Recomendo: todo jogo aparece ao menos uma vez por rodada, nunca o mesmo duas vezes seguidas, tudo pela seed._ E como alternar os minijogos grandes (são só 2)? 6. **Comandos "não destacados".** Mesma posição e mesmo estilo sempre, mas **legíveis** (contraste normal, nunca menor que 14 px). A pegadinha vem de ler com pressa, não de esconder. Confirma? 7. **Ecooo, Botão Proibido.** A sequência mostrada inclui o botão proibido (a pessoa pula ele ao repetir) ou ele nunca aparece? E "sem feedback durante" quer dizer que o botão **acende ao tocar** mas sem indicar certo/errado? 8. **X1, condição de vitória.** "Abrir 3 pontos de vantagem" é (a) **3 vitórias seguidas** ou (b) diferença de 3 no placar? O texto diz que perder reseta, o que combina com (a). Teto de 15 disparos = empate. _Recomendo (a)._ Quem termina o duelo antes assiste os outros ou já volta ao ranking? Quantos pontos vale vitória, empate e derrota? O Bot ganha pontos? 9. **Digitação.** Vale no celular (autocorreção, sugestões)? _Recomendo: sim, com campo sem autocorreção e tolerância de maiúsculas._ "Sem vogais" significa digitar a palavra mostrada **omitindo** as vogais (casa vira "cs")? 10. **Pontuação.** Proponho 0 a 1000 por micro-desafio e o minijogo grande valendo **2x ou 3x** um micro. "Nota maior que 6 pontua proporcional" significa que nota 6 ou menos vale 0? _Recomendo: nota 10 = 1000, curva linear a partir de 5._ Pontuação pode ficar **negativa** ou o piso por desafio é 0? _Recomendo: piso 0 por desafio, e as penalidades só tiram do que a pessoa ganharia._ 11. **Cores como regra.** "Evite peças verdes" exclui quem não vê cores. Aceita que toda regra por cor venha também com o **nome da cor escrito e um padrão** (listrado, pontilhado) na peça? _Recomendo: sim._ 12. **Quem cai no meio.** Fica com 0 nos desafios que perder e pode voltar? Mínimo para continuar: 2 pessoas? Se o líder cair, outro assume (já existe)? 13. **"Pronto" antes de cada grande.** Líder inicia, mas com **início automático após 15 s** se todos prontos ou se alguém demora? _Recomendo: sim._ 14. **Chat durante a partida.** Fecha durante os desafios e fica aberto no ranking, no tutorial e na revelação (mesmo critério do Já Deu?). Confirma?

**C. Prioridade** 15. A Maratona passa na frente do **Tribunal do Absurdo** e do **Intervalo** na fila? Antes dela, falta **jogar o Ecooo ao vivo e calibrar**; isso bloqueia algo? _Recomendo: Maratona vira o projeto principal; Tribunal e Intervalo ficam depois._ 16. Posso começar pela **fatia vertical** (fases 0 a 2: Palco + Mesmíssima + um grande provisório) para você jogar cedo e só depois encaixar os outros desafios?

## 10. Critérios de aceite (macro)

- [ ] 2 a 12 pessoas jogam uma partida de 1 rodada (5 rápidos e 1 grande) e de 2 rodadas sem travar.
- [ ] Nenhum ponto é decidido no cliente; o servidor recalcula tudo.
- [ ] Todos veem os desafios no mesmo instante (desvio de relógio compensado) e ninguém trava a sala (tempo limite).
- [ ] As trocas de estado são suaves (só `transform`/`opacity`) e respeitam `prefers-reduced-motion`.
- [ ] Pontuação final igual para todos os aparelhos; colocação gravada no histórico de sala.
- [ ] Regras por cor também aparecem por nome e padrão; textos legíveis nos temas claro e escuro.
