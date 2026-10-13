# 021 · Block's (jogos de blocos) e o modo Block Classic

Status: **implementada (solo, com servidor, ranking, histórico, recordes, som e arte); falta jogar ao vivo e calibrar a jogada secreta e as dicas.** Aprovada pelo Lucas (12/10/2026) como padrão do gênero. Primeira etapa: **Block Classic solo**, com ranking, histórico, recordes, amigos, som e arte próprios. Salas, Daily e os outros modos de blocos ficam para depois e entram na mesma aba.

## A ideia

**Block's** é a aba (o jogo, na tela inicial) dos jogos de blocos. Dentro dela cada **modo** é um jeito de jogar com blocos. O primeiro é o **Block Classic**: o quebra-cabeça de encaixar peças numa grade 8x8 e limpar linhas e colunas, no padrão do gênero.

Mais modos de blocos entram depois como novos modos de Block's (mesma tela, mesmo ranking por modo), do mesmo jeito que a Cor tem Clássico, Flash e os outros.

## Decisões do Lucas

- Nome da aba: **Block's**. Nome do primeiro modo: **Block Classic**. O id interno do jogo é `blocks` e o do modo é `classic`.
- **Regras do padrão do gênero**, sem inventar mecânica nova nesta etapa.
- As peças **não são aleatórias puras**: o trio é montado com um propósito (veja "Geração das peças"). Em **50 a 70%** dos trios existe uma **jogada secreta** que rende bem mais do que jogar de qualquer jeito.
- **Joinha** quando a peça foi colocada na posição certa da jogada secreta, e **PERFECT** quando as três seguiram a melhor jogada. Colocar a peça de qualquer jeito **não diz nada**.
- **3 dicas por partida**, dadas antes de começar. Acabaram as dicas, acabou a ajuda (a partida continua).
- **Identidade**: Pop Brutal (bordas de tinta, sombra dura, amarelo/laranja/azul), **tudo desenhado em SVG** (peças, tabuleiro, joinha, carimbo PERFECT, dicas) e **sons gerados por código** (Web Audio), sem emoji.

## Regras

### Tabuleiro e peças
- Grade **8x8**, começa vazia.
- A cada rodada vêm **3 peças**. A pessoa escolhe a ordem e arrasta cada uma para a grade. Só encaixa onde **todas** as casas da peça estão livres.
- As peças **não giram**.
- Quando as três foram colocadas, vêm outras três.

### Catálogo de peças
Todas as formas abaixo existem, cada uma com um peso de sorteio (as grandes são mais raras):

| Grupo | Formas |
|---|---|
| Ponto e barras | 1x1, 1x2, 2x1, 1x3, 3x1, 1x4, 4x1, 1x5, 5x1 |
| Quadrados e retângulos | 2x2, 2x3, 3x2, 3x3 |
| Cantos pequenos (3 casas) | 4 rotações |
| Cantos grandes (5 casas, 3x3) | 4 rotações |
| L (4 casas) | 4 rotações e 4 espelhadas |
| T (4 casas) | 4 rotações |
| S e Z (4 casas) | 2 rotações de cada |

### Limpeza
- Linha ou coluna **inteira cheia** some. Várias de uma vez somem **juntas** (linhas e colunas ao mesmo tempo).
- Não existe gravidade: o que sobra fica onde está.

### Pontos (o servidor recalcula tudo)
- Colocar uma peça: **1 ponto por casa** da peça.
- Limpar `L` linhas/colunas de uma vez: `10 x L x (L + 1) / 2` (1 → 10, 2 → 30, 3 → 60, 4 → 100...).
- **Sequência (combo)**: cada jogada que limpa algo aumenta a sequência; **três jogadas seguidas sem limpar** a quebram. O bônus de limpeza é multiplicado pela sequência (de 1 a 6).
- **Tabuleiro limpo** (nenhuma casa ocupada depois da jogada): **+300**.
- A nota é a **pontuação**. No ranking e no histórico ela é guardada em décimos (como nos outros jogos), mas mostrada em pontos.

### Fim de partida
Acaba quando **nenhuma** das peças que restam cabe em lugar nenhum. Não existe tempo.

## Geração das peças (o "pensamento por trás")

Tudo sai da **seed** e do **estado do tabuleiro**, então o servidor refaz a partida igual.

1. **Sempre tem solução.** Cada trio é testado: existe pelo menos uma ordem e uma posição para as três peças. Trio sem solução é descartado.
2. **Jogada secreta em 50 a 70% dos trios.** No começo de cada rodada a seed decide se esta será "com jogada" (60%). Sendo, o trio escolhido tem uma sequência que limpa **3 ou mais linhas no total** (2 quando o tabuleiro já passa de 45% cheio). Se em 16 tentativas nenhum trio serve, vale o melhor trio com solução.
3. **Dificuldade pelo tabuleiro e pela partida.** Tabuleiro cheio → mais peças pequenas. Tabuleiro vazio → mais peças grandes. Com o passar das rodadas as peças grandes e difíceis ficam um pouco mais frequentes.
4. Nunca tem trio impossível. A partida só acaba porque a pessoa foi deixando o tabuleiro sem espaço.

### O que é "melhor posição" (só para o joinha, PERFECT e a dica)
- No começo de cada rodada o aparelho busca **todas as sequências** possíveis (as 6 ordens, todas as posições), valora cada uma pelos pontos que ela rende **mais uma nota de qualidade do tabuleiro final** (buracos isolados custam, espaço contínuo vale) e guarda as que empatam no máximo.
- A rodada é **"com jogada"** (vale elogio) só se o máximo for bem melhor que o das jogadas comuns (mediana das primeiras jogadas possíveis, com folga de 8 pontos). Em rodada sem diferença nenhuma, colocar de qualquer jeito não diz nada, nem o certo.
- **Joinha**: depois de colocar uma peça, as jogadas feitas até agora ainda batem com alguma sequência ótima. Mostra o joinha.
- **PERFECT**: as três jogadas bateram com a mesma sequência ótima.
- Isso é **só apresentação**: não muda a pontuação e o servidor não depende disso. (Os números de joinhas e PERFECTs aparecem no fim da partida.)

## Dicas
- **3 por partida.** O botão mostra quantas restam, em 3 selos que vão se apagando.
- A dica **destaca a peça e a casa** da melhor jogada naquele momento (se você já saiu da melhor sequência, busca a melhor a partir de onde você está).
- Acabaram: o botão fica apagado e a partida segue sem ajuda.
- A dica **não custa pontos** nem entra na nota.

## Controles
- **Arrastar** a peça (dedo ou mouse) até a grade; um **fantasma** mostra onde ela vai cair, em verde se cabe e em vermelho se não, e as linhas que vão sumir ficam realçadas.
- A peça sobe um pouco acima do dedo para não ficar escondida atrás dele (celular).
- Soltou fora de um lugar válido: a peça **volta** para a bandeja com animação.
- Teclado: **setas** movem a peça escolhida, **Enter** confirma, **1 2 3** escolhem a peça.

## Visual (todos os desenhos em SVG)
- Tabuleiro 8x8 em papel claro, bordas de tinta de 2,5 px, sombra dura; no tema escuro, as cores dos tokens.
- Cada peça tem uma **cor** (laranja, azul, amarelo, rosa, verde, roxo...) com bloco biselado desenhado em SVG (face, luz, sombra).
- **Limpeza**: as casas da linha piscam e estouram em pedaços (transform/opacity), a tela treme conforme o tamanho da limpeza, e o número de pontos sobe flutuando.
- **Joinha**: ícone SVG de mão com o polegar para cima, num selo amarelo que carimba na tela.
- **PERFECT**: carimbo grande amarelo/laranja caindo com overshoot e tremor.
- **Sequência**: contador "x2, x3..." ao lado do placar, com selo que pulsa.
- **Fim de partida**: pontuação, recorde, joinhas, PERFECTs, linhas limpas e maior sequência.
- Animar só `transform`/`opacity` (RULES.md), respeitando `prefers-reduced-motion`.

## Sons (Web Audio, sem arquivos)
`pick` (pegar a peça), `drop` (encaixar, com tom pelo tamanho), `bad` (soltar errado), `clear(n)` (limpeza com tom que sobe pelo número de linhas e pela sequência), `thumb` (joinha), `perfect` (acorde), `hint` (dica), `over` (fim). Respeita o botão de mudo.

## Servidor
- `POST /games/blocks/session`: sorteia a seed e assina o início (como no Sinal).
- `POST /matches` com `game: 'blocks'`, `mode: 'classic'`, `kind: 'solo'`, a seed, a sessão e os **movimentos**: lista de inteiros `slot x 64 + linha x 8 + coluna` (slot 0 a 2).
- O servidor **refaz a partida inteira** pela seed (gera os trios, confere que cada movimento é legal, soma os pontos). Movimento ilegal recusa a partida. A partida precisa ter **terminado** (nenhuma peça cabe) para valer.
- Ranking: `blocks` com o quadro `classic` (pontuação). Histórico e recordes como nos outros jogos. Sem Daily nesta etapa.

## Efeitos da versão atual (pedido do Lucas em 12/10/2026: nível profissional)
- **Prévia ao arrastar**: a peça sobe acima do dedo com sombra dura, o fantasma aparece no tabuleiro com entrada e "respiração", e as linhas que vão sumir pulsam na cor da peça.
- **Encaixe**: a peça cai com impacto (escala que passa do ponto e assenta), clarão branco nas casas e pontos flutuando.
- **Quebra**: faixa de luz varre a linha, os blocos piscam em branco, estouram em onda a partir da peça e soltam cacos; tela treme mais quanto maior a limpeza; palavra de elogio (DUPLO, TRIPLO, QUÁDRUPLO, MEGA, TABULEIRO LIMPO) e selo de combo; limpeza grande dá clarão amarelo.
- **Pontuação**: o número sobe contando e dá um pulo a cada ganho.
- **Derrota**: o tabuleiro treme, os blocos desabam em onda e o cartão "SEM ESPAÇO" cai.

## Fora desta etapa
Salas e amigos ao vivo, Daily, aposta "Cap ou No Cap", modo às cegas (tabuleiro que some), peças coloridas com combo de cor, outros modos de blocos.

## Testes
Lógica: encaixe, limpeza de linhas e colunas, limpeza simultânea, pontuação e sequência, tabuleiro limpo, fim de partida, o catálogo de peças, geração determinística pela seed, **todo trio com solução**, proporção de rodadas "com jogada" entre 50 e 70%, análise (melhor sequência, joinha, PERFECT, dica). API: partida refeita pela seed, movimento ilegal e partida incompleta recusados, sessão reaproveitada recusada.
