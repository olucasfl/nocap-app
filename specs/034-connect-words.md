# 034 · Connect Word's (16 palavras, 4 grupos, o estilo Conexo e Connections)

Status: **reformulada em 19/10/2026: jogo offline só com fases (130), do mais fácil ao mais difícil, progresso salvo no aparelho, sem Daily, ranking ou servidor. As seções de Daily, arquivo e API abaixo ficam como histórico.** Faz parte do grupo [032 Word's](032-words-grupo-e-base.md) (corridas no servidor, Daily, compartilhar, acessibilidade). Pesquisa em [docs/pesquisa-termo.md](../docs/pesquisa-termo.md).

## Objetivo

Um jogo de **conectar palavras**: aparecem **16 palavras** e a pessoa separa em **4 grupos de 4**, cada grupo com uma ligação em comum. O valor do jogo está **nas ligações**: elas precisam ser **justas, claras depois que se descobrem, e com pegadinhas boas**. Por isso esta spec trata o **conteúdo** (os puzzles) com o mesmo peso que o código.

## O que a pesquisa mostrou (como o Conexo e o Connections funcionam)

- **Conexo** (brasileiro, conexo.ws, da Daydash): grade de 16 palavras, 4 grupos de 4, grupo por tema (cinema, música, ciência, esportes, cultura geral), puzzle **diário** com **arquivo** dos anteriores, sem cadastro, sem limite de tempo. Os grupos têm **cores de dificuldade** e o jogo explora **palavras ambíguas** distribuídas no tabuleiro. As regras exatas (número de erros) variam entre as fontes; **não consegui confirmar na página oficial**.
- **Connections** (NYT): mesmas 16 palavras e 4 grupos; **4 erros**; ao acertar, o grupo trava com o nome da categoria; se **só uma palavra** do palpite está errada o jogo avisa **"falta uma"**; amarelo é o mais fácil, depois verde, azul e **roxo** (o mais difícil, com jogo de palavras); embaralhar e desmarcar; ao perder, revela os grupos.
- **Decifra** (projeto aberto em português) também tem um "Conexões".

O que o NoCap adota: as regras do Connections (4 erros, "falta uma", embaralhar, desmarcar, revelar ao perder), **4 níveis de dificuldade** e o **Daily com arquivo** do Conexo.

## Decisões do Lucas (19/10/2026)

- Nome: **Connect Word's**; "tipo o Conexo e o Connections do NY Times".
- **As palavras precisam realmente se conectar bem**; nada distante, difícil demais ou "forçado".
- Usa a **base em português** do grupo e a mesma infraestrutura do Word's.
- **Respostas às decisões em aberto (19/10/2026):** **5 vidas** (não 4); **eu preparo os puzzles em lotes de 30 e o Lucas aprova**, com **90 no lançamento**; expressões de 2 palavras valem (até 14 letras).

## Regras

### O jogo
- **16 palavras** numa grade 4x4, em ordem embaralhada (a ordem inicial sai da seed da corrida). A pessoa **toca em 4 palavras** e aperta **Enviar**.
  - **Acertou:** o grupo **trava no topo** com a cor do nível e o **nome da categoria**, e as outras 12 palavras se reorganizam.
  - **Errou:** perde **1 de 5 vidas** (corações). Se **3 das 4** palavras são de um mesmo grupo, aparece **"Falta uma"** (nada mais é revelado). Palpite com 2 ou menos acertos num mesmo grupo não dá pista.
  - **Repetir** exatamente o mesmo palpite errado não gasta vida ("Você já tentou esse grupo").
- **Embaralhar** (reorganiza as palavras ainda soltas, só visual) e **Limpar seleção**.
- A partida acaba ao **achar os 4 grupos** (vitória) ou ao **perder as 5 vidas** (derrota: o jogo **revela os grupos que faltam** com os nomes).
- Os grupos têm **4 níveis**, e o **nível só é revelado quando o grupo é achado**:

| Nível | Cor (tokens do Pop Brutal) | Tipo de ligação |
| --- | --- | --- |
| 1 | amarelo | **pertencem à mesma coisa**, óbvio (frutas, partes da casa, posições do futebol) |
| 2 | verde | pertencem à mesma coisa, mas mais **específico** ou menos óbvio (partes da camisa, instrumentos de percussão) |
| 3 | azul | **completar a expressão** ("guarda-___", "dor de ___") ou uma **característica em comum** (coisas que têm asa) |
| 4 | roxo (ou laranja) | **jogo de palavras**: palíndromos, palavras que mudam de sentido com o/a, palavras que **escondem** outra palavra |

### Nota (0 a 10, no servidor)
- **Vitória** com `e` erros: **10** (0 erros), **8,5** (1), **7** (2), **5,5** (3), **4** (4).
- **Derrota** (5 erros) com `g` grupos achados: **0** (0), **1** (1), **2** (2), **3** (3).
- O tempo não conta. O servidor registra só quando começou e terminou.

### Modos
| Modo | O que é |
| --- | --- |
| **Daily** | o puzzle do dia, igual para todos, **uma partida por conta**; entra no ranking e na sequência |
| **Arquivo** (`archive`) | puzzles de **dias passados** que a pessoa ainda **não jogou**, sorteados ou escolhidos pela data; sem ranking do dia (conta nos recordes e no histórico) |

Não há "treino aleatório infinito": o conteúdo é feito à mão, então o arquivo é a fonte de partidas extras. Quando todos os puzzles do arquivo foram jogados, a tela diz "Você jogou todos até aqui".

## A base: o conteúdo dos puzzles

### Formato de um puzzle (arquivo do servidor, nunca vai inteiro ao aparelho)
```json
{
  "id": "c-0001",
  "groups": [
    { "level": 1, "title": "Frutas", "words": ["CAJU", "GOIABA", "MAMÃO", "UVA"] },
    { "level": 2, "title": "Partes da camisa", "words": ["GOLA", "PUNHO", "BOTÃO", "MANGA"] },
    { "level": 3, "title": "Palavras que vêm depois de \"guarda-\"", "words": ["CHUVA", "ROUPA", "SOL", "COSTAS"] },
    { "level": 4, "title": "Palíndromos", "words": ["ARARA", "RADAR", "OVO", "OSSO"] }
  ],
  "traps": [{ "word": "MANGA", "alsoFits": "Frutas" }],
  "themes": ["roupa", "fruta"],
  "notes": "Armadilha: MANGA parece fruta, mas só fecha como parte da camisa."
}
```
A ordem em que os puzzles vão ao ar vem de um arquivo `calendario.json` **só de acrescentar**: o dia N sempre usa o puzzle N. O Daily nunca muda depois de publicado.

### O que faz um puzzle ser bom (a lista de qualidade)
1. **Cada grupo tem uma ligação que cabe em uma frase curta** (até ~6 palavras) e que qualquer pessoa **entende e concorda** quando lê ("Ah, claro").
2. **Palavras comuns no Brasil.** Nada que exija um dicionário. Nomes próprios só quando **muito conhecidos** (países, capitais, marcas e personagens de uso geral) e **nunca** no nível 1 sem necessidade.
3. **Nada de ligação subjetiva** ("coisas legais", "palavras fortes") e **nada que dependa de opinião**, política, religião ou piada com grupos de pessoas.
4. **Pelo menos 1 e no máximo 3 pegadinhas** por puzzle: uma palavra que **também parece servir a outro grupo**. Mas **só existe uma divisão certa**: o outro grupo tem **mais de 4 candidatas**, então a pegadinha se resolve por **eliminação**. (No exemplo, 5 candidatas a fruta, mas só 4 partes de camisa: `MANGA` vai para a camisa.)
5. **Os 4 níveis aparecem em todo puzzle**, e o 4 (jogo de palavras) **não depende de trivia**: depende de **olhar a palavra de outro jeito**.
6. **Variedade de temas** ao longo do mês: comida, corpo, casa, cidade, natureza, esportes, música, TV e cinema, ciência, tecnologia, história, língua. O mesmo tema não repete em **dias seguidos**.
7. **Sem repetir palavra em 14 dias** (nem no mesmo puzzle), para a pessoa não decorar.
8. **Tamanho:** cada palavra até **14 letras** (uma expressão curta de 2 palavras, como `PÃO DE QUEIJO`, cabe se couber na casa).
9. **Palavras fora do tabuleiro de dúvida:** nada que seja **errado** em ortografia; `GUARDA-CHUVA` é `CHUVA` no grupo "guarda-___", com o hífen explicado no título.

### Dois puzzles de exemplo (para calibrar o tom)

**Exemplo A**: `CAJU · GOIABA · MAMÃO · UVA · GOLA · PUNHO · BOTÃO · MANGA · CHUVA · ROUPA · SOL · COSTAS · ARARA · RADAR · OVO · OSSO`
- 1 amarelo **Frutas**: CAJU, GOIABA, MAMÃO, UVA.
- 2 verde **Partes da camisa**: GOLA, PUNHO, BOTÃO, MANGA.
- 3 azul **Vêm depois de "guarda-"**: CHUVA, ROUPA, SOL, COSTAS.
- 4 roxo **Palíndromos** (leem igual de trás para a frente): ARARA, RADAR, OVO, OSSO.
- Pegadinha: **MANGA** (fruta ou camisa).

**Exemplo B**: `GOLEIRO · ZAGUEIRO · LATERAL · ATACANTE · SALA · QUARTO · COZINHA · VARANDA · CABEÇA · DENTE · BARRIGA · GARGANTA · GRAMA · CAPITAL · RÁDIO · CURA`
- 1 amarelo **Posições no futebol**: GOLEIRO, ZAGUEIRO, LATERAL, ATACANTE.
- 2 verde **Cômodos de casa**: SALA, QUARTO, COZINHA, VARANDA.
- 3 azul **Dor de ...**: CABEÇA, DENTE, BARRIGA, GARGANTA.
- 4 roxo **Mudam de sentido com "o" ou "a"** (o grama / a grama, o capital / a capital, o rádio / a rádio, o cura / a cura): GRAMA, CAPITAL, RÁDIO, CURA.
- Pegadinhas: **LATERAL** (a lateral da casa) e **QUARTO** (um quarto, fração).

### Como o conteúdo é produzido e conferido
- **Quem escreve:** eu preparo os puzzles em lotes de **30**, seguindo a lista de qualidade; o **Lucas aprova** cada lote (corta o que for ruim, troca o que não gostar). Nenhum puzzle vai ao ar sem aprovação.
- **Validação automática** (`apps/api/scripts/words/validar-connect.mjs`), que roda no lote e nos testes do repositório e **recusa** o que falhar:
  - exatamente 4 grupos de 4, 16 palavras **diferentes**, tamanhos e níveis certos (1 a 4, um de cada);
  - **só uma divisão possível** pelas listas de candidatas declaradas (`traps` e a lista de candidatas por grupo), conferida por um pequeno solucionador;
  - cada palavra comum existe na **lista de aceitas** ou na lista de **nomes permitidos** (`permitidas.txt`), o que pega erro de digitação;
  - palavra rara (ICF alto) vira **aviso**; palavra da lista de **negativas** vira erro;
  - nenhuma palavra repete em 14 dias, nenhum tema igual em dias seguidos;
  - os títulos não revelam as palavras do grupo.
- **Volume:** lançar com **90 puzzles** (3 meses) e acrescentar **30 por mês**. Para o lançamento ser possível, aprovar o primeiro lote de 30 já permite abrir o jogo com o arquivo vazio e crescer.
- **Calibragem depois do lançamento:** o servidor guarda por puzzle a taxa de acerto e a média de erros; puzzles muito mais difíceis ou fáceis que a média viram nota para os próximos lotes.

## Telas e fluxo

### Página do Connect (`/words/connect`)
- **Cartão do Daily** (igual ao Classic): Jogar, Continuar ou o resultado do dia (nota, erros, os 4 grupos coloridos em miniatura) e a sequência.
- Abas: **Modos** (Daily e Arquivo), **Ranking** (Hoje, Semana, Sempre) e **Amigos**. O **Arquivo** lista os dias passados com o estado de cada um (não jogado, vitória com nota, derrota).
- Ficha do modo com as regras e um **exemplo animado** de um grupo achado.

### Tela de jogo
- Grade 4x4 de **casas grandes** (Pop Brutal: borda de tinta, sombra dura). Tocar **levanta** a casa (`translateY`) e muda a borda; selecionar uma quinta troca a primeira. Texto da palavra **se ajusta** ao tamanho da casa (nenhum corte).
- **Enviar**, **Embaralhar**, **Limpar**; **5 corações** (o que se perde estoura). "Falta uma" aparece como etiqueta no topo.
- **Grupo achado:** as 4 casas **voam** para a linha de cima (`transform`), a faixa fica da cor do nível e mostra o **nome da categoria**; um som por nível.
- **Erro:** a seleção **balança** e perde o coração. Palpite repetido: aviso, sem custo.
- **Fim:** vitória (carimbo, nota, os 4 grupos coloridos com os nomes) ou derrota (os grupos que faltam são **revelados** e ficam esmaecidos com os nomes).
- Movimento reduzido: sem voo nem balanço, só troca de cor e opacidade. As cores nunca são a única informação: cada nível tem um **símbolo** na faixa (1 a 4 marcas).
- Teclado: setas movem o foco entre casas, espaço seleciona, Enter envia (acessível).

### Resultado
Os **4 grupos** com nomes e níveis, **erros**, **nota** e a frase da faixa; **Compartilhar** (imagem: uma grade 4x4 de blocos coloridos pelo nível em que cada palavra foi achada, e a ordem em que a pessoa achou os grupos; texto: "Connect Word's #123, 2 erros, link"); **Ver ranking** ou **Próximo do arquivo**.

## Modelo de dados e API

Rotas genéricas da spec 032 (`/words/wconnect/...`).
- `POST /words/wconnect/runs` com `{ kind: 'daily' | 'archive', day? }`. Resposta: as **16 palavras em ordem embaralhada** (com um `id` por casa, sem nível nem grupo), as vidas, e os grupos já achados se for retomada.
- `POST /words/wconnect/runs/:id/moves` com `{ ids: [4 ids] }`. Respostas: `{ result: 'correct', group: { level, title, words } }`, `{ result: 'one_away' }`, `{ result: 'wrong' }` ou `{ result: 'repeat' }`, mais `lives`, `over` e, ao fim, `reveal` com os grupos que faltavam.
- O puzzle completo **nunca** sai do servidor antes de a partida acabar. A resposta "falta uma" só diz isso, não qual palavra.
- Partida salva em `matches`: `game: 'wconnect'`, `mode: 'daily' | 'archive'`, `settings: { puzzle: 'c-0001', errors, scoreVersion: 1 }`.
- Dados: `apps/api/data/words/connect/puzzles.json` e `calendario.json` (servidor, **fora** do pacote do web).
- Código: `packages/games/src/words/connect/` (nota, regra do "falta uma" e solucionador, testes), `apps/api/src/words/` (serviço), `apps/web/src/games/words/connect/` (telas), arte e sons próprios.

## Critérios de aceite

- **Dado** um palpite com 4 palavras do mesmo grupo, **então** o grupo trava com nome e cor e as outras 12 se reorganizam.
- **Dado** um palpite com 3 palavras de um grupo e 1 de outro, **então** aparece "Falta uma" e perco 1 vida.
- **Dado** o mesmo palpite errado duas vezes, **então** a segunda não gasta vida.
- **Dado** que perdi as 5 vidas, **então** os grupos que faltam são revelados com nomes e a nota é a da tabela.
- **Dado** o Daily concluído, **quando** tento jogar de novo, **então** o servidor recusa (409) e a tela mostra o resultado.
- **Dado** qualquer resposta durante a partida, **então** ela não contém grupos ainda não achados nem o nível deles.
- **Dado** um puzzle novo no lote, **quando** a validação roda, **então** ele só passa com uma divisão possível, 16 palavras distintas e sem palavra da lista de negativas.
- **Dado** `prefers-reduced-motion`, **então** os grupos mudam de lugar sem voar.
- **Dado** a tela de 360 px, **então** as 16 casas cabem sem rolar e o texto de `GUARDA-CHUVA` ou `PÃO DE QUEIJO` não é cortado.

## Fora de escopo

Salas (separar mais rápido, cooperativo); editor de puzzles no app; criar o próprio puzzle e mandar para amigos; dicas que revelam palavras; modo cronometrado.

## Decisões em aberto

1. ~~Vidas~~ **Decidido: 5 vidas.**
2. **Dica**: uma dica por partida que revela **uma palavra** de um grupo ainda não achado e **tira 2 pontos da nota**. Entra agora ou depois?
3. **Cores do nível 4**: roxo (não está nos tokens atuais?) ou laranja; escolher com o design.
4. **Arquivo**: escolher a data livremente ou receber o próximo não jogado? Proposta: os dois (lista por data).
5. ~~Quem escreve os puzzles e o volume do lançamento~~ **Decidido:** eu preparo os lotes de 30, o Lucas aprova, 90 no lançamento.
6. ~~Aceitar expressões de 2 palavras~~ **Decidido: sim**, até 14 letras.

## Melhorias e acréscimos sugeridos

- **Temas da semana** (segunda de esportes, sexta de música), ajudando a escrever e a querer voltar.
- **Estatística de grupos**: "só 23% acharam o roxo hoje", mostrada depois do fim (vem de graça do servidor).
- **Conexão relâmpago** (sala): vários jogadores no mesmo puzzle, ganha quem separa os 4 grupos primeiro; o tabuleiro dos outros aparece sem as palavras, só com quantos grupos cada um já achou.
- **Puzzles feitos por amigos**: um jogador monta 4 grupos e manda para a sala (precisa de moderação do conteúdo; só em spec futura).

## Revisão (19/10/2026): sem vidas, dica, desistir e dificuldade em faixas

- **Sem vidas:** cada palpite errado soma 1 ao contador de **erros** (não há derrota por erro).
- **Dica (1 por fase):** mostra "Nome do conjunto: ..." de um grupo que ainda falta (o de menor nível), sem palavras.
- **Desistir:** pede confirmação; revela os grupos que faltam e classifica como **Desistência**.
- **Classificação ao concluir:** 0 erros Perfeito; 1 a 2 Muito bom; 3 a 5 Bom; mais que isso Concluída. A tela final mostra só o número de erros e a classificação.
- **Dificuldade:** 166 fases em 4 faixas (Fácil, Médio, Difícil, Mestre). A faixa Fácil é um lote novo (36 puzzles, só categorias comuns, sem jogo de palavras); o resto é ordenado pela dureza dos títulos. Conteúdo com erro (palavras inexistentes, categorias sobrepostas) foi corrigido.
- Progresso em `nocap-words-connect-v2` (o v1 é apagado).
