# 057: Counter Fox, partida mata-mata e primeiro mapa (Duna)

Status: em andamento (04/11/2026): mapa, bots, pontos, menu, sala online e servidor prontos e testados (106 testes de lógica, 2 testes com servidor real, e2e offline e com 2 janelas); falta jogar e ajustar. Continua a spec 056 (fase 0: arena de teste).

## 1. O que é

Uma partida de **mata-mata** (deathmatch) do Counter Fox contra bots, no primeiro mapa de verdade, **Duna**, inspirado na estrutura da Dust 2 do CS 1.6
(só a *ideia* do mapa: o modelo e as texturas do zip de referência não entram no repositório).

- **Duração** à escolha: 2, 3, 5, 7 ou 10 minutos.
- **Bots** à escolha: 1 a 9 (com você são no máximo 10 jogadores).
- **Pontos**: abate = **10**, assistência = **5**. Vence quem tiver mais pontos quando o tempo acaba; empate no topo = empate (todos empatados vencem).
- Quem morre renasce depois de 3 s num ponto de nascimento longe dos inimigos (sem colete; você mantém as armas que comprou, a loja continua com dinheiro infinito; bots escolhem uma arma ao nascer).
- Salas personalizadas/partidas com bots **nunca** entram em ranking (regra 2 do RULES.md).

## 2. O mapa Duna (57 x 68 células de 1 m = 57 x 68 m, chão em degraus de 0,3 m)

Reformulado em 04/11/2026 depois do primeiro teste do Lucas ("muito simples, áreas abertas do nada, caixas soltas, túnel aleatório"). O esqueleto agora segue o **princípio** da Dust 2 (corredores estreitos, portas, salas fechadas, três rotas, dois pátios de bomba, alturas diferentes), feito em retângulos próprios (`FS_DUST_CARVES` em `dust.ts`); o que não é retângulo de chão é parede.

**Três rotas a partir da Base TR (sul):**
1. **Oeste, Túneis:** pátio de saída, túnel coberto de 3 m e 10 m de comprimento, cruzamento; dali sobe ao **B** (norte) ou segue pelo **Túnel baixo** (coberto, um degrau abaixo) até o Meio.
2. **Centro, Meio:** corredor de 4 m com **portas** de 2 m no meio, até a **Base CT**; do Meio sai a **Passarela**, uma rampa em degraus que sobe ao **A**.
3. **Leste, Pátio e Long A:** pátio, **portas do Long** (3 m), e o corredor largo do Long, que sobe em degraus até o **A**.

| Lugar | O que é |
|---|---|
| **Base TR** | sala larga no sul (nível 1) com blocos que a dividem em baias; 3 saídas |
| **Base CT** | sala no norte (nível 0, mais baixa) com dois blocos que formam pistas; liga ao B (portas do B, 2 m), ao A (Rampa CT) e ao Meio |
| **Bomba A** | plataforma alta (nível 3, +0,9 m) no nordeste, com um degrau extra, caixotes e um bloco; 3 entradas: Long (sul), Passarela (sudoeste) e Rampa CT (oeste) |
| **Bomba B** | sala no noroeste (nível 2) com bloco central, plataforma e caixotes; 2 entradas: Túneis (sul) e Portas do B (leste) |
| **Túneis / Túnel baixo** | corredores estreitos e cobertos de tijolo |

Alturas: níveis de 0,3 m (`FS_DUST_STEP`); o corpo sobe 1 degrau andando (limite do movimento) e o bot só anda entre células com diferença de até 1 nível. Plataformas altas (0,9 m) sobem pulando.
O mundo é uma lista de retângulos de chão com nível, zona e piso; dela saem as caixas de colisão (paredes juntadas, pisos elevados, caixotes, tetos), os pontos de nascimento, a navegação e os enfeites.

## 3. Visual (livre, decisão do Lucas: "o que vier na sua cabeça")

Arenito quente. Cada zona tem o seu piso (terra na base TR e no pátio, pedra no Meio e nos túneis, ladrilho na Base CT, arenito nas bombas, concreto nas rampas) e as paredes mudam com a zona (tijolo nos túneis, arenito nas bombas e na CT, reboco nas ruas). Os pátios de bomba têm marcas no chão, **A** laranja e **B** azul, e as bases a cor da equipe.
**Enfeites com modelos de terceiros** (ver `docs/CREDITS-3D.md`): fachadas com arcos coladas nas paredes das salas, postes, barreiras e grades, e prédios de vários tamanhos sobre o miolo maciço e em volta do mapa, formando um horizonte (no lugar de paredes retas e vazias). Sem colisão. A regra do visual realista (RULES.md, 2ª exceção) vale para o mapa; menus, HUD e telas finais seguem Pop Brutal.

## 4. Bots de mata-mata

Cada bot é um jogador completo: anda pelo mapa (A* na grade, caminhos suavizados), usa as mesmas armas, o mesmo dano, o mesmo movimento e as mesmas regras que o jogador.
- Escolhe uma arma ao nascer (pesos por arma) e compra colete/capacete ao acaso.
- **Percepção**: vê quem está no cone de 140 graus, sem parede no meio e a menos de 70 m; ouve passos a até 12 m e tiros de armas sem silenciador a até a distância de `FS_HEAR_RANGE`; reage 0,25 a 0,45 s depois de ver.
- **Combate**: para ou anda de lado (strafe), mira com erro que cresce com a distância e a velocidade, atira em rajadas conforme a arma, recarrega, mira na cabeça às vezes. Escopeta só avança até ~12 m; sniper segura ângulo.
- **Granadas**: 0 a 1 de cada tipo ao nascer; jogam quando o alvo está entre 9 e 26 m.
- Sem trapaça: o bot só mira em quem enxerga (ou em onde ouviu/viu por último).
- Níveis de dificuldade **não** fazem parte desta spec (uma só, "normal"); fica como evolução.

## 5. Partida (lógica pura em `packages/games`)

`FS_MATCH_MINUTES = [2,3,5,7,10]`, `FS_MATCH_BOTS = {min:1,max:9}`. `fsMatchScore({kills,assists}) = 100*k + 50*a`.
`fsMatchResult(players)` ordena por pontos (desempate: mais abates, depois menos mortes) e diz quem venceu (`winners` pode ter mais de um se empatar em pontos, abates e mortes).
Assistência: o último dano de outro jogador antes do abate, em até 10 s (`fsAssister`, spec 056).

## 6. Telas

1. **Preparar partida** (rota `/fox-cap/counter-fox`): escolher minutos, bots e "Jogar". O mapa de teste continua em `/fox-cap/fox-shot-teste`.
2. **Em jogo**: HUD igual ao de teste, com o tempo da partida, o placar (Tab) com pontos e a minimapa do Duna.
3. **Fim**: tabela com posição, jogador, pontos, abates, assistências e mortes; vencedor em destaque; "Jogar de novo" e "Voltar".

## 7. Etapas

1. Spec, mapa em dados, navegação, nascimento e testes. 
2. Cena do mapa (materiais, marcas dos pátios, teto dos túneis).
3. Cérebro dos bots + integração (dano, assistência, renascer).
4. Tela de preparar, tempo, pontos e tela final.
5. Docs e e2e.

## 8. Menu, sala e online (pedido de 04/11/2026)

**Menu principal** (`/fox-cap/counter-fox`, tema próprio, tudo animado): logo, fundo de deserto à noite, **Jogar**, **Opções** e **Sair do Counter Fox** (vermelho, embaixo).
- **Jogar** → **Offline** (tempo e bots, entra) ou **Com amigos** (Criar sala / Entrar com código).
- **Opções**: Mira e câmera, Imagem e som (qualidade, tela cheia e trava de teclas, mapa, fps, som), Comandos.

**Sala online** (jogo `foxshot` dentro da sala do Fox Cap!, reaproveita código, convite por link e amigos, líder, "pronto", chat e reconexão): lobby com abas **Sala** (código grande, resumo, o que falta), **Jogadores** (cartões, remover, bots), **Modo** (hoje só Mata-mata; tempo e bots, só o líder muda), **Convidar** (copiar código e link, buscar @usuário, amigos) e **Chat**. Começar: líder, com todo mundo pronto e ao menos 2 jogadores (pessoas + bots). Até 10 no total.

**Servidor** (`FsNetSim` em `packages/games`, `FoxShotRoomEngine` e `FoxShotRoom` em `apps/api/src/rooms`): a sala manda em tudo (regra "o servidor sempre recalcula").
- Entradas de 1/60 s (teclas, mira, botões, comandos de troca e compra) em pacotes de até 4 entradas (`fsin`, ~30 por segundo: o que se perde é coberto pelo pacote seguinte).
- Quadro para todos (`fss`) a cada ~50 ms: uma linha de inteiros por jogador, granadas no ar, eventos (tiro, acerto, abate, granada, explosão, luz, renascer) e, só para cada pessoa, o corpo exato dela (para a previsão).
- **Compensação de atraso**: o tiro é conferido contra os corpos como estavam na tela de quem atirou (até 250 ms atrás).
- **Cliente**: prevê o próprio movimento com o mesmo `fsStepMover`, refaz as entradas não vistas ao receber o quadro (correção suave: a câmera desliza o erro), interpola os outros 100 ms atrás, e o relógio da simulação segue o tempo real (tela lenta roda vários passos por quadro).
- Quem sai no meio vira bot. Sem ranking nem histórico. Sem arma no chão (largar e pegar) online e sem controles de celular nesta versão.

## 9. Fora do escopo

Online, bomba de verdade (A/B são só pontos de referência do mapa), dificuldade dos bots, rampas inclinadas (só degraus/plataformas), ranking.
