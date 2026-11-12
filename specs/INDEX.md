# Specs

| #   | Spec                                                                                      | Etapa | Status                                                                                                           |
| --- | ----------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| 000 | [Visão geral](000-overview.md)                                                            | 0     | rascunho                                                                                                         |
| 001 | [Jogo da Cor](001-color-game.md)                                                          | 1     | concluída (falta validar a curva)                                                                                |
| 002 | [Jogo do Tempo](002-time-game.md)                                                         | 4     | solo concluído (falta Sequência e salas)                                                                         |
| 003 | [Histórico](003-history.md)                                                               | 1     | concluída (Etapa 1)                                                                                              |
| 004 | [Salas multiplayer](004-rooms-multiplayer.md)                                             | 3     | Cor concluída, com convites                                                                                      |
| 005 | [Modo noturno](005-modo-noturno.md)                                                       | 1b    | concluída                                                                                                        |
| 006 | [Jogo rápido (1 rodada)](006-jogo-rapido.md)                                              | 1b    | concluída (Cor e Tempo)                                                                                          |
| 007 | [Contas (cadastro e login)](007-contas.md)                                                | 2     | concluída (falta e-mail e Google)                                                                                |
| 008 | [Ranking](008-ranking.md)                                                                 | 2     | concluída                                                                                                        |
| 009 | [Amigos](009-amigos.md)                                                                   | 3     | concluída (falta online agora e convites)                                                                        |
| 010 | [Daily, rankings por jogo e perfil](010-daily-rankings-profile.md)                        | 3     | concluída                                                                                                        |
| 011 | [O Intruso](011-impostor.md)                                                              | 3     | implementada; falta jogar ao vivo com 3 contas                                                                   |
| 012 | [Eco (repita a sequência)](012-eco.md)                                                    | 3     | solo, Corrida e Siga o Líder implementados; falta jogar ao vivo e calibrar                                       |
| 013 | [Lobby da sala (líder e membro)](013-lobby-sala.md)                                       | 3     | implementada; falta jogar ao vivo                                                                                |
| 014 | [Chat nas salas](014-chat-sala.md)                                                        | 3     | implementada; falta testar ao vivo                                                                               |
| 015 | [Aba separada de Rankings](015-aba-rankings.md)                                           | 5c    | implementada; falta jogar ao vivo                                                                                |
| 016 | [NoCap! (jogo-festa)](016-maratona.md)                                                    | 6     | implementado; falta validar X1 ao vivo e calibrar                                                                |
| 017 | [Presença na sala, entrar/sair e convites](017-presenca-sala.md)                          | 3     | implementada; testada com servidor real e bots                                                                   |
| 018 | [Amigos, presença, perfil, ranking e fim de partida](018-social-e-fim-de-partida.md)      | 3     | implementada; falta aplicar a migration 0005                                                                     |
| 019 | [Eco Hero (ritmo do Ecooo, estilo Guitar Hero)](019-eco-batida.md)                        | 6     | solo implementado; falta jogar ao vivo e calibrar                                                                |
| 020 | [Sinal Vermelho (correr sem ser visto)](020-sinal-vermelho.md)                            | 6     | substituída pela 028 (Sinal removido)                                                                            |
| 021 | [Block's (jogos de blocos) e o Block Classic](021-blocks.md)                              | 6     | Block Classic solo implementado; falta jogar ao vivo e calibrar                                                  |
| 022 | [Block Towers (empilhar com física)](022-block-towers.md)                                 | 6     | modo 3 vidas (solo) implementado, com ranking/histórico/perfil (servidor refaz a física); falta jogar e calibrar |
| 023 | [Convidado joga tudo (sem conta, nada é salvo)](023-convidado-joga-tudo.md)               | 2     | implementada: solo sem conta, popup, aviso de não salvo e salas com apelido; falta jogar ao vivo                 |
| 024 | [Retomar partida (Block Classic)](024-retomar-partida.md)                                 | 6     | implementada no Block Classic; falta jogar ao vivo                                                               |
| 025 | [Block Towers: câmera final e modos online](025-block-towers-online.md)                   | 6     | câmera final implementada; online com desenho e medição de CPU feitos, falta construir                           |
| 026 | [Sinal Vermelho 2 (reforma completa)](026-sinal-vermelho-2.md)                            | 6     | substituída pela 028 (Sinal removido)                                                                            |
| 027 | [Sinal: arremessadores, perseguidores, Vigia apressado e itens](027-sinal-perigos.md)     | 6     | substituída pela 028 (Sinal removido)                                                                            |
| 028 | [Atravessa! (substitui o Sinal Vermelho, estilo Crossy Road em 3D)](028-atravessa.md)     | 6     | etapas 1 a 5 implementadas (núcleo, servidor, tela, biomas e som, troca no app); falta jogar e calibrar          |
| 029 | [Atravessa!: polimento, mais perigos e marcos](029-atravessa-polimento.md)                | 6     | implementada; falta jogar e calibrar                                                                             |
| 030 | [Atravessa!: largada sempre na horta e recuo de 4 linhas](030-atravessa-largada.md)       | 6     | implementada; falta ver rodando                                                                                  |
| 031 | [Atravessa! online (sala, sem colisão, pronta para ter colisão)](031-atravessa-online.md) | 6     | implementada; falta jogar ao vivo                                                                                |

| 032 | [Word's: grupo e base de palavras](032-words-grupo-e-base.md) | 7 | rascunho (aguardando decisões) |
| 033 | [Classic Word's (1, 2 e 4 palavras e o Daily)](033-classic-words.md) | 7 | rascunho (revisado 19/10) |
| 034 | [Connect Word's (16 palavras, 4 grupos)](034-connect-words.md) | 7 | rascunho |
| 035 | [Bee Word's (7 letras, uma obrigatória)](035-bee-words.md) | 7 | rascunho |
| 036 | [Classic Word's em fases (1, 2 e 4 palavras)](036-classic-fases.md) | 7 | concluída |
| 037 | [Progresso das fases na conta](037-progresso-na-conta.md) | 7 | concluída |
| 044 | [Fox Cap! e Desmorona! (jogo de arena que desmorona)](044-fox-games-desmorona.md) | 9 | em andamento: Fases 1 (treino com bots) e 2 (salas online) no ar; Fase 3 (colisão) a seguir |
| 045 | [Telas fora do jogo, responsivas e mais claras](045-redesign-telas-fora-do-jogo.md) | 9 | plano para aprovação do Lucas (26/10/2026) |
| 046 | [Fut Fox (futebol de raposas, 2 a 4 times)](046-bola-maluca.md) | 9 | em andamento: Fase 1 (motor e bots) pronta e MVP offline jogável em `/fox-cap/bola` (26/10/2026); fases 1 a 4 prontas (motor, sala online, web e lobby); faltam som e testes em celular real |
| 048 | [Fut Fox online ponto a ponto (o líder simula)](048-fut-fox-p2p.md) | 9 | implementada (26/10/2026): lobby no Colyseus, partida no aparelho do líder por WebRTC, reserva no servidor; falta validar em aparelhos reais |
| 049 | [Fox Cap! com modos offline e sala de jogos trocáveis](049-fox-cap-hub-salas.md) | 9 | implementada (26/10/2026); falta jogar com amigos reais |
| 050 | [Menu (Esc) unificado, convite no meio da partida e controles na tela](050-menu-do-jogo-e-convite.md) | 9 | em andamento (26/10/2026): Fut Fox, Desmorona! e Atravessa! com o menu novo |
| 051 | [O app inteiro no celular deitado](051-app-no-celular-deitado.md) | 9 | implementada (27/10/2026); falta ver em aparelhos reais |
| 052 | [Fut Fox liso online, arena, física e visual](052-fut-fox-rede-e-fisica.md) | 9 | em andamento (27/10/2026): fase 1 (rede) pronta; arena, física e visual em seguida |
| 053 | [Fut Fox: corrida com fôlego, atrito da bola e curva do teto](053-fut-fox-corrida-e-curvas.md) | 9 | em andamento (27/10/2026): motor, rede e tela feitos; falta ver na tela e jogar |
| 054 | [Telas de fim de partida do Atravessa! e do Desmorona!](054-telas-de-fim-atravessa-desmorona.md) | 9 | em andamento (28/10/2026): telas feitas e testadas offline; falta ver a da sala com 2 navegadores |
| 055 | [Ping Fox! (pingue-pongue 1x1 das raposas)](055-ping-fox.md) | 9 | em andamento (01/11/2026): motor, treino offline e sala online prontos; falta jogar com amigos |
| 056 | [Counter Fox (tiro das raposas)](056-fox-shot.md) | 10 | em andamento (03/11/2026): fase 0 (arena de teste: visual, tiro, recuo, dano) pronta; falta jogar e medir no celular |
| 057 | [Counter Fox: partida mata-mata e mapa Duna](057-counter-fox-partida-e-mapa.md) | 10 | em andamento (04/11/2026): mapa, bots, pontos, telas, online, treino, espectar e conta prontos; falta jogar e ajustar |
| 058 | [Pendências: online do Counter Fox, salvar dados universal, chat estilo CS, "Outros jogos", mapa do menu, Esc ao iniciar, troca de arma instantânea, sniper com dois zooms, espectar do Ping Fox e tela própria de cada jogo](058-pendencias-online-e-salvar-dados.md) | 10 | rascunho (04/11/2026): só levantamento, nada feito ainda |
| 059 | [Counter Fox: modo Bomba (rounds, times, economia)](059-counter-fox-modo-bomba.md) | 10 | rascunho (07/11/2026): pesquisa e plano; aguarda respostas |
| 062 | [Counter Fox: modo PvP (times, sem bomba, dinheiro infinito)](062-counter-fox-modo-pvp.md) | 10 | em andamento (08/11/2026): motor, mapa de blocos, bots, sala, menu, HUD e testes prontos; falta jogar online e ajustar |
| 063 | [Counter Fox: a nova Duna (modelo USDZ da Dust 2)](063-counter-fox-mapa-duna-novo.md) | 10 | em andamento (08/11/2026): virou a Duna, a antiga foi apagada; carregamento sob demanda com tela própria; falta jogar e ajustar |
| 064 | [Counter Fox: granada de fumaça, 1 granada de cada, C4 junto das armas](064-counter-fox-granada-de-fumaca.md) | 10 | em andamento (09/11/2026): fumaça (regras do CS), limite de 1, C4 no HUD e testes prontos; falta jogar e ajustar |

| 065 | [Telas próprias dos jogos do Word's](065-words-telas-proprias.md) | 7 | implementada (09/11/2026): Classic (Daily, 1/2/4 palavras), Connect e Bee com tela no estilo do Fox Cap!; falta ver no celular |
| 066 | [Hub do Block's (Classic e Towers)](066-blocks-hub.md) | 6 | implementada (09/11/2026): tela própria com os dois jogos, continuar partida, como jogar e configurações |
| 067 | [Hubs da Mesmíssima, Já Deu? e Ecooo](067-hubs-reflexo-precisao.md) | 6 | implementada (09/11/2026): tela própria com Daily, modos, amigos, como jogar e configurações |
| 068 | [Daily, sala e partidas com o tema dos hubs](068-hubs-daily-sala-partidas.md) | 6 | implementada (09/11/2026) |
| 069 | [Tela final dos jogos de reflexo e precisão](069-final-reflexo.md) | 6 | implementada (09/11/2026) |
| 070 | [Sala que troca entre todos os jogos do NoCap](070-sala-todos-os-jogos.md) | 3 | implementada (09/11/2026) |
| 071 | [Rankings nos hubs e Dailys da Home](071-rankings-nos-hubs.md) | 2 | implementada (09/11/2026) |
| 072 | [Como jogar em páginas](072-como-jogar-em-paginas.md) | 6 | implementada (09/11/2026) |
| 073 | [Block Classic guardado na conta](073-block-classic-na-conta.md) | 6 | implementada (09/11/2026); precisa da migration 0010 aplicada |
| 074 | [Quadros animados nos menus dos hubs](074-quadros-animados-dos-hubs.md) | 6 | implementada (09/11/2026) |
| 075 | [Quadros animados no Fox Cap! e no Counter Fox](075-quadros-animados-fox-cap.md) | 6 | implementada (09/11/2026) |
| 076 | [Remover o Aperta!](076-remover-aperta.md) | 8 | código removido (09/11/2026); migration 0011 (apagar a tabela) pronta, falta o Lucas aplicar |
| 078 | [Fox GP](078-fox-gp.md) | 5 | implementada na branch `feat/fox-gp` (10/11/2026); falta calibrar jogando |
| 079 | [Fox GP, atualização](079-fox-gp-atualizacao.md) | 5 | implementada na `feat/fox-gp`; teste online com duas janelas verde (11/11/2026) |
| 080 | [Fox GP v2](080-fox-gp-v2.md) | 5 | implementada na `feat/fox-gp` (11/11/2026); falta medir celular como líder com 20 carros |
| 081 | [Fox GP v3](081-fox-gp-v3.md) | 5 | implementada na `feat/fox-gp-v3` (12/11/2026); falta calibrar jogando e medir celular como líder |

Status: rascunho → aprovada → em andamento → concluída. Criar uma nova: `/spec <nome>`.
