# Spec 069: tela final dos jogos de reflexo e precisão

Status: implementada (09/11/2026). Pedido do Lucas: as telas finais da Mesmíssima, do Já Deu? e do Ecooo estavam empilhadas sem organização.

- Componente `ReflexFinal`: cabeçalho com o modo, cartão da pontuação (nota, palavra da faixa, motivo do fim), cartão do recorde, cartão dos detalhes (rodada por rodada; no Ecooo, como terminou; no Eco Hero, a música) e cartão do lugar no ranking (ou o painel do Daily). Botões: Revanche/Jogar de novo, Ranking, Modos e Jogos.
- Celular: tudo em uma coluna, na ordem nota, recorde, detalhes, ranking, e a barra de botões presa embaixo. Computador: nota e recorde à esquerda, detalhes e ranking à direita, botões embaixo.
- Vale para todos os modos: partidas normais, Sobrevivência (`SurvivalFinal`), Daily (sem revanche, painel do dia no lugar do ranking) e Eco Hero (`BatidaFinal`).
- `MatchSummary` ganhou `part` ('record' | 'ranking') para separar o recorde do ranking.
- Hub do Block's: o menu principal tem **Jogar**, que abre a escolha entre Block Classic e Block Towers, cada um com a sua tela.
