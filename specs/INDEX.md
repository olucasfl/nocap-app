# Specs

| #   | Spec                                                               | Etapa | Status                                                                     |
| --- | ------------------------------------------------------------------ | ----- | -------------------------------------------------------------------------- |
| 000 | [Visão geral](000-overview.md)                                     | 0     | rascunho                                                                   |
| 001 | [Jogo da Cor](001-color-game.md)                                   | 1     | concluída (falta validar a curva)                                          |
| 002 | [Jogo do Tempo](002-time-game.md)                                  | 4     | solo concluído (falta Sequência e salas)                                   |
| 003 | [Histórico](003-history.md)                                        | 1     | concluída (Etapa 1)                                                        |
| 004 | [Salas multiplayer](004-rooms-multiplayer.md)                      | 3     | Cor concluída, com convites                                                |
| 005 | [Modo noturno](005-modo-noturno.md)                                | 1b    | concluída                                                                  |
| 006 | [Jogo rápido (1 rodada)](006-jogo-rapido.md)                       | 1b    | concluída (Cor e Tempo)                                                    |
| 007 | [Contas (cadastro e login)](007-contas.md)                         | 2     | concluída (falta e-mail e Google)                                          |
| 008 | [Ranking](008-ranking.md)                                          | 2     | concluída                                                                  |
| 009 | [Amigos](009-amigos.md)                                            | 3     | concluída (falta online agora e convites)                                  |
| 010 | [Daily, rankings por jogo e perfil](010-daily-rankings-profile.md) | 3     | concluída                                                                  |
| 011 | [O Intruso](011-impostor.md)                                       | 3     | implementada; falta jogar ao vivo com 3 contas                             |
| 012 | [Eco (repita a sequência)](012-eco.md)                             | 3     | solo, Corrida e Siga o Líder implementados; falta jogar ao vivo e calibrar |
| 013 | [Lobby da sala (líder e membro)](013-lobby-sala.md)                | 3     | implementada; falta jogar ao vivo                                          |
| 014 | [Chat nas salas](014-chat-sala.md)                                 | 3     | implementada; falta testar ao vivo                                         |
| 015 | [Aba separada de Rankings](015-aba-rankings.md)                    | 5c    | implementada; falta jogar ao vivo                                          |
| 016 | [NoCap! (jogo-festa)](016-maratona.md)                             | 6     | implementado; falta validar X1 ao vivo e calibrar                          |
| 017 | [Presença na sala, entrar/sair e convites](017-presenca-sala.md)   | 3     | implementada; testada com servidor real e bots                             |
| 018 | [Amigos, presença, perfil, ranking e fim de partida](018-social-e-fim-de-partida.md) | 3 | implementada; falta aplicar a migration 0005 |
| 019 | [Eco Hero (ritmo do Ecooo, estilo Guitar Hero)](019-eco-batida.md) | 6 | solo implementado; falta jogar ao vivo e calibrar |
| 020 | [Sinal Vermelho (correr sem ser visto)](020-sinal-vermelho.md) | 6 | substituída pela 028 (Sinal removido) |
| 021 | [Block's (jogos de blocos) e o Block Classic](021-blocks.md) | 6 | Block Classic solo implementado; falta jogar ao vivo e calibrar |
| 022 | [Block Towers (empilhar com física)](022-block-towers.md) | 6 | modo 3 vidas (solo) implementado, com ranking/histórico/perfil (servidor refaz a física); falta jogar e calibrar |
| 023 | [Convidado joga tudo (sem conta, nada é salvo)](023-convidado-joga-tudo.md) | 2 | implementada: solo sem conta, popup, aviso de não salvo e salas com apelido; falta jogar ao vivo |
| 024 | [Retomar partida (Block Classic)](024-retomar-partida.md) | 6 | implementada no Block Classic; falta jogar ao vivo |
| 025 | [Block Towers: câmera final e modos online](025-block-towers-online.md) | 6 | câmera final implementada; online com desenho e medição de CPU feitos, falta construir |
| 026 | [Sinal Vermelho 2 (reforma completa)](026-sinal-vermelho-2.md) | 6 | substituída pela 028 (Sinal removido) |
| 027 | [Sinal: arremessadores, perseguidores, Vigia apressado e itens](027-sinal-perigos.md) | 6 | substituída pela 028 (Sinal removido) |
| 028 | [Atravessa! (substitui o Sinal Vermelho, estilo Crossy Road em 3D)](028-atravessa.md) | 6 | etapas 1 a 5 implementadas (núcleo, servidor, tela, biomas e som, troca no app); falta jogar e calibrar |
| 029 | [Atravessa!: polimento, mais perigos e marcos](029-atravessa-polimento.md) | 6 | implementada; falta jogar e calibrar |
| 030 | [Atravessa!: largada sempre na horta e recuo de 4 linhas](030-atravessa-largada.md) | 6 | implementada; falta ver rodando |
| 031 | [Atravessa! online (sala, sem colisão, pronta para ter colisão)](031-atravessa-online.md) | 6 | implementada; falta jogar ao vivo |

| 032 | [Word's: grupo e base de palavras](032-words-grupo-e-base.md) | 7 | rascunho (aguardando decisões) |
| 033 | [Classic Word's (1, 2 e 4 palavras e o Daily)](033-classic-words.md) | 7 | rascunho (revisado 19/10) |
| 034 | [Connect Word's (16 palavras, 4 grupos)](034-connect-words.md) | 7 | rascunho |
| 035 | [Bee Word's (7 letras, uma obrigatória)](035-bee-words.md) | 7 | rascunho |
| 036 | [Classic Word's em fases (1, 2 e 4 palavras)](036-classic-fases.md) | 7 | concluída |
| 037 | [Progresso das fases na conta](037-progresso-na-conta.md) | 7 | concluída |
| 038 | [Aperta! (clicker no espaço, solo, saves na conta)](038-clicker.md) | 8 | em andamento na `develop`: etapas 1, 2 (falta aplicar a migration), 3, 4, 5 (Melhorias), 6 (grimórios e álbum), 7 (objetos no espaço), 8 (tutorial), 9 (colapso e Atlas), 11 (arte e sons do que já existe) e 12 (conteúdo dos colapsos 1 a 5) prontas; ver seção 16 da spec |

Status: rascunho → aprovada → em andamento → concluída. Criar uma nova: `/spec <nome>`.
