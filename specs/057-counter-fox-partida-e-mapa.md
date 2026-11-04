# 057: Counter Fox, partida mata-mata e primeiro mapa (Duna)

Status: em andamento (04/11/2026). Continua a spec 056 (fase 0: arena de teste).

## 1. O que é

Uma partida de **mata-mata** (deathmatch) do Counter Fox contra bots, no primeiro mapa de verdade, **Duna**, inspirado na estrutura da Dust 2 do CS 1.6
(só a *ideia* do mapa: o modelo e as texturas do zip de referência não entram no repositório).

- **Duração** à escolha: 2, 3, 5, 7 ou 10 minutos.
- **Bots** à escolha: 1 a 9 (com você são no máximo 10 jogadores).
- **Pontos**: abate = **100**, assistência = **50**. Vence quem tiver mais pontos quando o tempo acaba; empate no topo = empate (todos empatados vencem).
- Quem morre renasce depois de 3 s num ponto de nascimento longe dos inimigos (sem colete; a arma inicial é a pistola, a loja continua com dinheiro infinito; bots escolhem uma arma ao nascer).
- Salas personalizadas/partidas com bots **nunca** entram em ranking (regra 2 do RULES.md).

## 2. O mapa Duna (28 x 34 células de 2 m = 56 x 68 m)

Lido da Dust 2 (vista de cima do OBJ): base dos terroristas no sul/oeste, base dos CTs no norte/centro, bombas A (nordeste) e B (noroeste), meio, túneis, Long A.

| Lugar | O que é |
|---|---|
| **Base TR** | sala grande no canto sudoeste, três saídas: túneis (norte), meio (norte/leste), Long A (leste) |
| **Base CT** | sala no topo, no centro: saídas para o B (portas do B, oeste), o A (rampa CT, leste) e o meio (sul) |
| **Bomba A** | pátio no nordeste com plataforma (0,9 m, sobe pulando) e caixotes; entradas: Long A (sul), Passarela (oeste), Rampa CT |
| **Bomba B** | pátio no noroeste com caixotes empilhados e plataforma; entradas: Túneis (sul) e Portas do B (leste) |
| **Meio** | corredor central, de 4 m de largura, do norte (sala do meio) à base TR; caixotes como cobertura |
| **Túneis / Túnel baixo** | corredores cobertos (teto) a oeste; o túnel baixo liga os túneis ao meio |
| **Passarela** | liga o topo do meio ao A |
| **Long A** | corredor largo a leste, de 8 m, da base TR ao A |

Os blocos são caixas (como `FS_ARENA`): paredes de 4,2 m (maciças), caixotes de 1,2 m (madeira, atravessável pela bala), caixotes altos de 2,4 m e plataformas de 0,9 m.
O mapa é um desenho em texto (`FS_DUST_GRID`) de que saem as caixas, os pontos de nascimento, as zonas (nomes) e a malha de navegação dos bots.

## 3. Visual (livre, decisão do Lucas: "o que vier na sua cabeça")

Arenito quente e céu claro. Paredes de reboco areia, túneis de tijolo escuro com teto, caixotes de madeira, plataformas de metal; os pátios têm marcas no chão, **A** laranja e **B** azul, e as bases têm a cor da equipe (CT azul-claro, TR laranja). A regra do visual realista (RULES.md, 2ª exceção) vale para o mapa; menus, HUD e telas finais seguem Pop Brutal.

## 4. Bots de mata-mata

Cada bot é um jogador completo: anda pelo mapa (A* na grade, caminhos suavizados), usa as mesmas armas, o mesmo dano, o mesmo movimento e as mesmas regras que o jogador.
- Escolhe uma arma ao nascer (pesos por arma) e compra colete/capacete ao acaso.
- **Percepção**: vê quem está no cone de 140 graus, sem parede no meio e a menos de 70 m; ouve passos a até 12 m e tiros de armas sem silenciador a até a distância de `FS_HEAR_RANGE`; reage 0,25 a 0,45 s depois de ver.
- **Combate**: para ou anda de lado (strafe), mira com erro que cresce com a distância e a velocidade, atira em rajadas conforme a arma, recarrega, mira na cabeça às vezes. Escopeta só avança até ~12 m; sniper segura ângulo.
- **Granadas**: 0 a 1 de cada tipo ao nascer; jogam quando o alvo está entre 9 e 26 m.
- Sem trapaça: o bot só mira em quem enxerga (ou em onde ouviu/viu por último).
- Quatro dificuldades **não** fazem parte desta spec (uma só, "normal"); fica como evolução.

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

## 8. Fora do escopo

Online, bomba de verdade (A/B são só pontos de referência do mapa), dificuldade dos bots, rampas inclinadas (só degraus/plataformas), ranking.
