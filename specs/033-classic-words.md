# 033 · Classic Word's (a base do Termo, com 1, 2 e 4 palavras e o Daily)

Status: **aprovada (19/10/2026), em construção.** Faz parte do grupo [032 Word's](032-words-grupo-e-base.md), que define a base de palavras, as corridas no servidor, o Daily, o compartilhar e as regras comuns. Pesquisa em [docs/pesquisa-termo.md](../docs/pesquisa-termo.md).

## Objetivo

O jogo de adivinhar a **palavra secreta de 5 letras**, com a identidade do NoCap. Uma página própria com quatro entradas: o **Daily** e os modos **1 palavra**, **2 palavras** (Dueto) e **4 palavras** (Quarteto). Tudo calculado no servidor, que guarda a palavra.

## Decisões do Lucas (19/10/2026)

- Nome: **Classic Word's**; é a **base do Termo**.
- Modos: **1, 2 e 4 palavras** e o **Daily**.
- **Interface própria**: ao tocar no Classic abre uma página para escolher Daily, 1, 2 ou 4 palavras, com as **regras que já existem** para cada modo.
- O **Daily tem interface própria** para controlar se a pessoa já jogou e mostrar o que precisa.
- **Respostas às decisões em aberto (19/10/2026):** tentativas **como no Termo** (6, 7 e 9); **os modos livres não têm ranking, só o Daily**; convidado joga os modos livres sem salvar, o Daily só com conta.

## Regras

### O jogo
- Há uma palavra secreta de **5 letras** (ou 2 ou 4 palavras ao mesmo tempo). A pessoa digita um **palpite de 5 letras que seja uma palavra aceita** (a lista de aceitas da spec 032) e aperta **Enter**.
- O jogo pinta cada letra do palpite:
  - **verde** (e o símbolo traço embaixo): letra certa no lugar certo;
  - **amarelo** (símbolo ponto): a letra existe na palavra, mas em outro lugar;
  - **cinza**: a letra não existe, ou já foi contada todas as vezes que aparece na palavra (a regra das duas passadas da spec 032).
- Palpite que **não é palavra aceita** ou tem **menos de 5 letras** não gasta tentativa: a casa balança e aparece o aviso ("Palavra não aceita", "Faltam letras").
- Letras repetidas são permitidas. O palpite não precisa reaproveitar as pistas (não há modo difícil nesta etapa; ver decisões em aberto).
- No **Dueto** e no **Quarteto** o mesmo palpite vale para **todos os tabuleiros ainda abertos**. Um tabuleiro resolvido **trava** (não recebe mais palpites). Palavras de uma mesma partida **nunca se repetem**.
- A partida acaba quando **todas as palavras foram acertadas** (vitória) ou **acabaram as tentativas** (derrota). Ao acabar, o jogo **mostra as palavras certas**, com acento.

### Os modos

| Modo | Palavras | Tentativas | Daily |
| --- | --- | --- | --- |
| **Daily** | 1 | 6 | sim: uma palavra por dia, igual para todos, uma partida por conta |
| **1 palavra** (`classic`) | 1 | 6 | não |
| **2 palavras** (`dueto`) | 2 | 7 | não |
| **4 palavras** (`quarteto`) | 4 | 9 | não |

(Os números de tentativas são os do Termo, que são os que o gênero já usa; ver decisões em aberto.)

### Nota (0 a 10, calculada no servidor)
Para cada palavra acertada no palpite de número `k` de `N` tentativas: **`nota da palavra = 10 x (N + 1 - k) / N`**. Palavra não acertada vale **0**. A nota da partida é a **média** das palavras.

| Modo (N) | acertou no 1º | 2º | 3º | 4º | 5º | 6º | 7º | 8º | 9º |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 palavra e Daily (6) | 10 | 8,3 | 6,7 | 5,0 | 3,3 | 1,7 | | | |
| Dueto (7) | 10 | 8,6 | 7,1 | 5,7 | 4,3 | 2,9 | 1,4 | | |
| Quarteto (9) | 10 | 8,9 | 7,8 | 6,7 | 5,6 | 4,4 | 3,3 | 2,2 | 1,1 |

Nos modos de várias palavras, `k` é o número do palpite que **resolveu aquele tabuleiro** (contado no total de palpites da partida). Sem pressão de tempo: o relógio do servidor só registra quando começou e quando terminou (para as estatísticas), **não entra na nota**.

### Escolha das palavras (no servidor, nunca no aparelho)
- **Daily:** a palavra do dia é `respostas[ordem[n]]`, onde `n` é o número do dia desde o lançamento e `ordem` é a ordem fixa da spec 032 (só acrescenta; o dia N nunca muda).
- **Modos livres:** a seed da corrida (sorteada no servidor) escolhe as palavras da lista de respostas, **sem repetir as últimas 60 palavras que a conta já jogou** e sem repetir entre si na mesma partida. A seed sozinha não revela a palavra.

## Telas e fluxo

### 1. Página do Classic (`/words/classic`)
- Cabeçalho com o nome, botão voltar e o botão "Como jogar" (explicação curta com um exemplo de linha pintada).
- **Cartão do Daily** em destaque (retângulo largo, arte própria, igual ao padrão do Cor e do Tempo), com o estado do dia: **Jogar** (não jogou), **Continuar** (no meio, mostrando as tentativas usadas) ou **Você já jogou hoje** (com a nota e as tentativas). Mostra o número do dia ("#123"), a sequência de dias e, para quem já jogou, quando sai a próxima palavra.
- **Três cartões de modo**: 1 palavra, 2 palavras, 4 palavras, cada um com a miniatura dos tabuleiros (1, 2 ou 4 grades), as tentativas e uma linha das regras. Tocar abre a **ficha do modo** (regras, tentativas, "Seu melhor aqui", **Jogar**), como nos outros jogos.
- Abas como as dos outros jogos: **Modos**, **Ranking** (o Daily à parte) e, quando houver, **Amigos**.

### 2. Tela do Daily (`DailyScreen`)
- Cabeçalho com o dia, o cartão do dia e três abas: **Resumo** (quantos jogaram, quantos acertaram, tentativas médias, sua posição, sua sequência), **Ranking** (Hoje, Semana, Sempre; Todos ou Amigos) e **Amigos** (quem já jogou hoje e a nota; **sem revelar a palavra nem as letras de ninguém antes de você terminar**).
- **Quem não jogou:** botão Jogar. **Quem está no meio:** Continuar. **Quem terminou:** vê o resultado, a palavra, o compartilhar, e a contagem para a próxima.
- O servidor decide o estado; o aparelho nunca "acha" que não jogou.

### 3. Tela de jogo
- **Um tabuleiro:** grade de 6 linhas por 5 colunas. **Dueto:** duas grades lado a lado (7 linhas). **Quarteto:** quatro grades em 2x2 (9 linhas), com casas menores. Tudo cabe na tela do celular sem rolar (as casas se ajustam à altura disponível).
- **Teclado na tela** em 3 fileiras (A a Z), **Enter** e **apagar**. Cada tecla mostra a melhor situação conhecida da letra; no Dueto e no Quarteto a tecla é **dividida em 2 ou 4 partes**, uma por tabuleiro. O teclado físico funciona igual.
- **Animações** (só `transform` e `opacity`): ao enviar, as casas **viram uma a uma** (`rotateX`, uns 250 ms cada, com pequeno atraso entre elas); palpite inválido **balança**; acertar uma palavra faz a linha **pular** e o tabuleiro travar; vitória e derrota têm o selo do Pop Brutal (carimbo). Movimento reduzido: sem virar nem balançar, só troca de cor.
- **Sons** sintetizados: tecla, enviar, cada cor (grave, médio, agudo), palavra inválida, acerto, vitória, derrota.
- **Mensagens** em pt-BR, em etiquetas no topo (nada de emoji): "Palavra não aceita", "Faltam letras", "Faltam N tentativas".
- Botão de pausa/saída: sair **não** perde a corrida (ela fica no servidor; o Daily continua aberto até a meia-noite).

### 4. Resultado
- Mostra a(s) **palavra(s) com acento**, as **tentativas usadas**, a **nota** (0 a 10, animada como as dos outros jogos) com a frase da faixa, o **"Novo recorde"** quando houver, e os botões **Compartilhar** (imagem e texto, spec 032), **Jogar de novo** (modos livres) ou **Ver ranking** (Daily) e **Voltar aos modos**.
- O detalhe da partida no histórico mostra os palpites e as cores (a resposta já foi revelada).

## Modelo de dados e API

Usa as rotas genéricas da spec 032 (`/words/wclassic/...`).

- `POST /words/wclassic/runs` com `{ kind: 'daily' | 'solo', mode: 'classic' | 'dueto' | 'quarteto' }` cria ou retoma a corrida. Resposta: `runId`, número de tabuleiros, tentativas, jogadas já feitas com as cores de cada uma.
- `POST /words/wclassic/runs/:id/moves` com `{ guess }` (5 letras, com ou sem acento). Respostas: `{ accepted: false, reason }` (não aceita, não gasta tentativa) ou `{ accepted: true, shown, patterns: [...], solved: [...], over, answers? }`. `shown` é a forma acentuada do palpite; `patterns` traz uma linha de 5 estados por tabuleiro (`hit`, `near`, `miss`); `answers` só vem quando `over` é verdadeiro.
- Partida salva em `matches`: `game: 'wclassic'`, `mode` (`daily` usa `classic` com `kind: 'daily'`, como o resto do app), `settings: { words, tries, scoreVersion: 1 }`, `encodedAnswers` com os palpites, nota em décimos.
- `GameId`, `RANKING_GAMES`, `BOARDS_OF`, estatísticas, recordes e histórico passam a conhecer `wclassic`. Quadro do ranking: **só `daily`** (soma das notas dos dias). Os modos livres aparecem nos recordes (vitórias, sequência de vitórias, tentativas médias) e no histórico, sem ranking.
- Código novo: `packages/games/src/words/classic/` (cores, nota, regras, testes), `apps/api/src/words/` (rotas e serviço), `apps/web/src/games/words/classic/` (páginas e tela de jogo), `apps/web/src/lib/words-audio.ts` (sons).

## Critérios de aceite

- **Dado** resposta `AMIGO` e palpite `MAMAE`, **então** a 1ª `M` é amarela e a 2ª é cinza (tabela completa de repetições testada).
- **Dado** o modo Dueto e um palpite, **então** os dois tabuleiros recebem o mesmo palpite e cada um é calculado separado; **quando** um é resolvido, **então** ele trava e o outro continua.
- **Dado** um palpite fora da lista aceita, **então** a resposta é `accepted: false`, a tentativa não é gasta e a casa balança.
- **Dado** que acertei no 3º palpite do modo de 1 palavra, **então** a nota é **6,7**.
- **Dado** que errei as 9 tentativas do Quarteto acertando só 2 palavras no 5º e no 7º palpites, **então** a nota é **(5,6 + 3,3 + 0 + 0) / 4 = 2,2** (arredondando para 1 casa).
- **Dado** que terminei o Daily, **quando** abro o Classic, **então** o cartão mostra a nota e o botão não permite jogar de novo.
- **Dado** que fechei o app no 4º palpite do Daily, **quando** volto, **então** vejo os 4 palpites e continuo.
- **Dado** o Daily de hoje, **então** todos os jogadores recebem a mesma palavra e ela **não aparece** em nenhuma resposta antes do fim da minha partida.
- **Dado** `prefers-reduced-motion`, **então** as casas trocam de cor sem virar.
- **Dado** a tela de 360 px de largura, **então** o Quarteto cabe sem rolar e as casas têm pelo menos 28 px.

## Fora de escopo

Salas (corrida, duelo, poderes); modo difícil; Daily de Dueto e de Quarteto; palavras de outros tamanhos (4 e 6 letras); dicionário de significados; treino offline.

## Decisões em aberto

1. ~~Número de tentativas~~ **Decidido: 6, 7 e 9, como no Termo.**
2. **Modo difícil** (obriga a reusar as dicas): entra agora como opção nos modos livres? (proposta: **não** nesta etapa).
3. **Daily também de Dueto e Quarteto?** (proposta: só o de 1 palavra por enquanto; os outros viram "Dailies extras" depois, se o Daily simples pegar).
4. **Tecla do `Ç`**: proposta é não ter, e mostrar `ç` automaticamente (`coracao` vira `coração`). Alguém pode querer digitar `ç` com o teclado físico: aceitar como `c`.
5. ~~Ranking dos modos livres~~ **Decidido: não há; só o Daily tem ranking.**
6. **A palavra do Daily revela o significado** no fim? Só depois de acharmos uma fonte de definições livre.

## Melhorias e acréscimos sugeridos

- **Gráfico de tentativas** (em quantas tentativas você costuma acertar) no perfil e no resultado do Daily.
- **Aviso de sequência em risco** no cartão do Daily quando o dia está acabando.
- **Modo "Sem pistas de cor"** (só a quantidade de acertos) como desafio.
- **Dailies com tema** em datas especiais (a palavra do dia "combina" com a data, sem exagero).
- Salas: **corrida** (mesma palavra para todos; os tabuleiros dos outros aparecem só com as cores, sem letras) e **duelo**; em spec própria depois do Classic estar jogável.

## Revisão (19/10/2026): mais palavras, ç, sem nota na tela, sem compartilhar, envio instantâneo

- **Palavras aceitas:** a lista de aceitas (`aceitas5.txt`, ~10,4 mil) passou a incluir plurais e formas comuns (ex.: "arcos", "bolos"). As respostas e a ordem do Daily não mudam.
- **ç é uma letra própria na cor:** `colorKey` mantém o ç; amarelo/verde no ç só se a palavra certa tem ç (os outros acentos continuam ignorados). A busca no dicionário segue tratando c e ç como iguais; o servidor pontua sempre a forma canônica.
- **Fim da partida:** não mostra nota; mostra quantas tentativas usou ("acertou em N de M"). A nota continua existindo no servidor só para o ranking do Daily.
- **Compartilhar foi removido** (texto e imagem).
- **Envio instantâneo:** `GET /words/wclassic/accepted` entrega a lista (cache de 1 dia); palavra inválida é recusada na hora no aparelho. Palavra válida é enviada ao servidor com a linha em estado de carregamento (onda animada, só `transform`/`opacity`) e depois vira. O servidor faz um único `UPDATE ... array_append ... RETURNING` por jogada.
