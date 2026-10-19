# 035 · Bee Word's (7 letras, uma delas obrigatória, o estilo Spelling Bee)

Status: **reformulada em 19/10/2026: jogo offline só com fases (200), do mais fácil ao mais difícil, progresso salvo no aparelho, sem Daily, ranking ou servidor. As seções de Daily, arquivo e API abaixo ficam como histórico.** Faz parte do grupo [032 Word's](032-words-grupo-e-base.md) (base de palavras, corridas no servidor, Daily, compartilhar, acessibilidade). Pesquisa em [docs/pesquisa-termo.md](../docs/pesquisa-termo.md).

## Objetivo

Formar o **maior número de palavras** com **7 letras** dispostas num favo de mel, sendo **uma letra obrigatória** no centro. Não há tentativas nem tempo: é um jogo de **achar, achar mais e subir de patente**, com a emoção do **pangrama** (a palavra que usa as 7 letras).

## O que a pesquisa mostrou (como o Spelling Bee funciona)

- 7 letras em um favo, **uma no centro que tem de estar em toda palavra**; palavras com **4 letras ou mais**; letras podem **repetir**; não valem nomes próprios, palavras obscuras ou ofensivas (a lista é **curada**).
- **Pontos:** 4 letras valem 1 ponto; palavras maiores valem 1 ponto por letra; o **pangrama** vale o tamanho **mais 7** de bônus.
- **Patentes** sobem conforme a porcentagem do máximo de pontos do dia; **Gênio** aos **70%** e **Rainha das Abelhas** (achar **todas** as palavras).
- É um jogo **diário**, o mesmo para todos. Um guia de terceiros diz que o original **evita a letra S** (para a pessoa não ganhar pontos à toa com plurais); não confirmei isso na regra oficial, mas faz muito sentido para o português, onde quase toda palavra tem plural.
- **Não achei versão brasileira estabelecida** nas buscas (só o "Spelling Bee" de escolas), então o espaço está livre.

## Decisões do Lucas (19/10/2026)

- Nome: **Bee Word's**, "igual ao Spelling Bee".
- Base de palavras em português, **sem palavras distantes ou difíceis**; a lógica tem de estar boa.
- **Respostas às decisões em aberto (19/10/2026):** **sem a letra S** nos favos e **formas verbais valem**; o resto segue as propostas (palavra rara digitada = "não está na lista", nota 10 no Gênio, patentes do original, dicas sempre abertas).

## Regras

### O jogo
- O tabuleiro tem **7 letras**: **1 no centro** (amarela) e **6 em volta**. Toda palavra precisa:
  1. ter **4 letras ou mais**;
  2. usar **só as 7 letras** (cada uma quantas vezes quiser);
  3. conter a **letra do centro**;
  4. estar na **lista de palavras do dia** (curada, no servidor).
- A pessoa forma a palavra tocando nas letras (ou digitando) e aperta **Enviar**. O jogo responde na hora:
  - **Valeu:** a palavra entra na lista de achadas, com os pontos (e um aviso se for pangrama);
  - **Já achada**, **Muito curta**, **Falta a letra do centro**, **Tem letra fora do conjunto**, **Não está na lista**.
- **Acentos e `ç`:** as letras aparecem **sem acento** e a pessoa digita sem acento (`acao`); o jogo **mostra a forma correta** (`ação`) e vale. A chave de comparação é a palavra sem acento (spec 032).
- **Sem a letra `S`** em nenhum puzzle (plural e conjugação em `-s` dariam pontos de graça); **sem `Ç`**; pelo menos **2 vogais**.

### Pontos
| Palavra | Pontos |
| --- | --- |
| 4 letras | 1 |
| 5 ou mais | o número de letras |
| **Pangrama** (usa as 7 letras) | o número de letras **+ 7** |

Exemplos: `ROTA` = 1, `CARTA` = 5, `ACORDE` = 6; um pangrama de 7 letras = 14.

### Patentes (porcentagem do máximo de pontos do dia)
| Patente | % do máximo |
| --- | --- |
| Iniciante | 0% |
| Bom começo | 2% |
| Pegando o jeito | 5% |
| Zunindo | 8% |
| Sólida | 15% |
| Ótima | 25% |
| Incrível | 40% |
| **Gênio** | **70%** |
| **Rainha das Abelhas** | **100% (todas as palavras)** |

(As porcentagens são as do original e ficam ajustáveis depois de ver como as pessoas jogam.)

### Nota (0 a 10, no servidor, para o ranking)
**`nota = 10 x mínimo(1, pontos / (0,70 x máximo do dia))`**: chegar a **Gênio dá 10**. Para desempatar no ranking usa-se os **pontos** e depois a **hora em que chegou neles**. Quem passa de Gênio continua acumulando pontos (aparecem no resumo e nos recordes), mas a nota é 10.

### Modos
| Modo | O que é |
| --- | --- |
| **Daily** | o favo do dia, igual para todos, uma corrida por conta e por dia; **a partida fica aberta até a meia-noite** (ou até a pessoa tocar em **Encerrar**) |
| **Arquivo** (`archive`) | favos de **dias passados** que a pessoa ainda não jogou; sem ranking do dia |

O Daily **não tem fim por tentativas**: a nota do dia vai subindo com os pontos e o ranking do dia **acompanha ao vivo**. Quando o dia vira (ou a pessoa encerra), a partida fecha e o resultado fica no histórico.

## A base: palavras e favos

### De onde vêm as palavras do Bee
Da mesma coleção do grupo (spec 032): léxico + plurais (sem `S`, então não entram) + **formas verbais** (que no português são palavras reais e fazem parte da graça). Para cada favo, a **lista de palavras do dia** é calculada e **revista por uma pessoa**.

### Como um favo é escolhido (gerador + revisão)
Script (`apps/api/scripts/words/gerar-bee.mjs`) que enumera os conjuntos de 7 letras e propõe favos que respeitem **todos** estes critérios:

1. Existe **pelo menos 1 pangrama** e **no máximo 2**, e o pangrama é uma **palavra comum** (frequência alta, ICF até ~12). Exemplos reais que a coleção dá: `trabalho`, `durante`, `qualidade`, `enquanto`, `publico`.
2. A lista tem **de 25 a 80 palavras** (com 20 a 70 eu já achei **5.141 combinações possíveis**; há de sobra).
3. Todas as palavras são **comuns o bastante** (ICF até ~13,5); as raras ficam **de fora da lista** (a pessoa pode até digitar, mas o jogo responde "Não está na lista"; ver decisão 3).
4. Nenhuma palavra é **nome próprio**, país, estado, município, marca ou da lista de negativas; a **revisão** tira o que o filtro automático deixou passar (a coleção mistura nomes como `joão` e `joana`).
5. A letra do centro **rende uma lista equilibrada**: nenhuma raiz domina (por exemplo, 15 formas do mesmo verbo).
6. **Sem `S`**, sem `Ç`, ao menos 2 vogais.
7. **Pontos máximos** entre uns **60 e 300**, para a escada de patentes ter degraus de verdade.

A **revisão** é o mesmo processo do Connect: eu preparo lotes (por exemplo, **30 favos**), imprimindo letra, pangramas, **a lista inteira** e os pontos; o **Lucas** aprova ou corta; as palavras cortadas vão para `fora-bee.txt` (global) ou para a lista do favo. Lançar com **60 favos** (2 meses) e crescer.

### Exemplo (dos dados reais)
Letras `A D E N R T U`, **centro `D`**, pangrama `durante`. Palavras da lista (amostra): `nada`, `data`, `rede`, `tarde`, `renda`, `andar`, `dentre`, `entrada`, `entender`, `atender`... A lista bruta tem 62 palavras; a revisão vai cortar o que for estranho e fechar o tamanho.

### Formato de um favo (servidor)
```json
{
  "id": "b-0001",
  "center": "d",
  "letters": ["a", "e", "n", "r", "t", "u"],
  "words": [
    { "w": "durante", "pangram": true },
    { "w": "tarde" },
    { "w": "entrada" }
  ]
}
```
Os pontos de cada palavra e o máximo do dia **saem da conta**, não ficam no arquivo. O calendário (`calendario.json`) é **só de acrescentar**, como no Connect e no Classic.

## Telas e fluxo

### Página do Bee (`/words/bee`)
- **Cartão do Daily** como nos outros: Jogar, Continuar (com a patente e os pontos até agora) ou o resultado do dia (patente, pontos, pangramas, nota), a sequência e o número do dia.
- Abas: **Modos** (Daily e Arquivo), **Ranking** (Hoje, Semana, Sempre) e **Amigos**.

### Tela de jogo
- **Favo em SVG:** o hexágono do centro amarelo e 6 em volta (Pop Brutal: contorno de tinta e sombra dura). Tocar numa letra a coloca na **palavra em montagem** (no topo), em que a letra do centro aparece **destacada** de amarelo.
- **Botões:** **Apagar**, **Embaralhar** (as 6 de fora giram de lugar com animação de `transform`; a do centro não muda) e **Enviar**. O teclado do aparelho também funciona (letras, Enter, Backspace).
- **Palavras achadas:** contador "N palavras" e a lista, em ordem alfabética, num painel que abre/fecha (no celular fica recolhido para o favo caber). A mais recente aparece destacada.
- **Barra de patentes:** um trilho com os 9 degraus e a patente atual. Subir de patente mostra uma **faixa** (e um som). **Gênio** e **Rainha** têm comemoração própria.
- **Pangrama:** efeito especial (os 7 hexágonos **pulam** em onda; confete de pedaços de `transform`) e som de bônus.
- **Dicas (sem entregar palavras):** um painel mostra **quantas palavras faltam**, **quantos pangramas há**, a **contagem por tamanho** e **por letra inicial**, que se atualizam conforme se acha (como o original). Nunca mostra letras das palavras que faltam.
- **Encerrar** (Daily): confirmação em dois toques; depois disso a partida do dia está fechada.
- Movimento reduzido: sem animações além de cor e opacidade; as cores nunca são a única informação (o centro tem um símbolo).

### Resultado
Patente e **pontos**, nota, número de **pangramas**, lista das palavras achadas e **quantas faltaram** (sem mostrar quais, a não ser **depois** que o dia acabou: o arquivo mostra todas as palavras de um dia passado). **Compartilhar** (imagem: o favo vazio de letras com a patente e o número de palavras; texto: "Bee Word's #123, Gênio, 47 palavras, link", sem emoji).

## Modelo de dados e API

Rotas genéricas da spec 032 (`/words/wbee/...`).
- `POST /words/wbee/runs` com `{ kind: 'daily' | 'archive', day? }`. Resposta: as **7 letras** e a letra do centro, as palavras já achadas e os pontos, e o **máximo do dia** (para a barra), sem a lista.
- `POST /words/wbee/runs/:id/moves` com `{ word }`. Respostas: `{ result: 'ok', shown, points, pangram, total, rank }` ou `{ result: 'rejected', reason }` (`short`, `center`, `letters`, `dup`, `notlisted`).
- `GET /words/wbee/runs/:id/hints`: as contagens do painel de dicas (sem palavras).
- `POST /words/wbee/runs/:id/finish`: encerra.
- A partida é salva e **atualizada** em `matches` a cada palavra nova (`game: 'wbee'`, `kind: 'daily' | 'archive'`, nota em décimos, `settings: { puzzle, words, points, rank, scoreVersion: 1 }`), para o ranking do dia andar ao vivo; fecha à meia-noite ou no Encerrar.
- Dados em `apps/api/data/words/bee/` (servidor, fora do pacote do web). Código em `packages/games/src/words/bee/` (pontos, patentes, nota, normalização, testes), `apps/api/src/words/`, `apps/web/src/games/words/bee/`.

## Critérios de aceite

- **Dado** a palavra `rota` num favo com `a` no centro, **então** vale 1 ponto; `carta` vale 5; `acorde` vale 6.
- **Dado** uma palavra de 7 letras que usa as 7 letras, **então** vale 7 + 7 = 14 e a tela mostra o efeito de pangrama.
- **Dado** um envio sem a letra do centro, **então** a resposta é `center` e nada é pontuado.
- **Dado** um envio já achado, **então** a resposta é `dup` e os pontos não somam duas vezes.
- **Dado** `acao` e a lista que tem `ação`, **então** o jogo aceita e mostra `ação`.
- **Dado** o máximo do dia de 200 pontos, **quando** chego a 140 pontos (70%), **então** a patente é Gênio e a nota é 10.
- **Dado** que o dia virou à meia-noite, **então** a partida fecha com os pontos que eu tinha e entra no ranking.
- **Dado** qualquer resposta do servidor durante o jogo, **então** ela não contém palavras ainda não achadas.
- **Dado** um favo novo no lote, **quando** a validação roda, **então** ele só passa com 1 ou 2 pangramas, 25 a 80 palavras, sem `S`, sem `Ç`, e sem palavra da lista de negativas.
- **Dado** `prefers-reduced-motion`, **então** o embaralhar e o pangrama não animam movimento.

## Fora de escopo

Salas (corrida de favos); modo de favo aleatório sem revisão; letra `S` e `Ç`; favos de 5 ou 9 letras; dicionário de significados.

## Decisões em aberto

1. ~~Excluir a letra `S`~~ **Decidido: sim.**
2. ~~Formas verbais valem?~~ **Decidido: sim**, com revisão para não haver 15 formas do mesmo verbo.
3. **Palavra rara digitada:** "Não está na lista" (como o original) ou **valer sem pontos** (para não frustrar quem conhece a palavra)? Proposta: **não está na lista**, simples e justo.
4. **Nota máxima no Gênio (70%)** ou em 100%? Proposta: **Gênio**.
5. **Patentes com esses nomes** (e as porcentagens do original) ou nomes do NoCap?
6. **Dicas sempre abertas** ou só a partir de uma patente (como no original)? Proposta: **sempre abertas**.

## Melhorias e acréscimos sugeridos

- **"Palavra do dia" em destaque** quando alguém acha o pangrama (aviso discreto aos amigos: "@fulano achou o pangrama").
- **Corrida de favos em sala:** mesmo favo para todos, tempo curto (3 minutos), cada um vê só **quantos pontos** os outros fizeram, não as palavras; vence quem mais pontuar. É onde **poderes** cabem (congelar o favo de um rival por 5 segundos, embaralhar o dele, letra dobrada).
- **Favo de fim de semana** maior e mais difícil (9 letras).

## Revisão (19/10/2026): dicas claras, catálogo com pontos e dificuldade em faixas

- **Dicas:** "Começa com" (letra, barra proporcional e "N vezes") e "Quantidade de letras" ("N letras: M palavras").
- **Catálogo:** cada fase mostra pontos/máximo (ex.: 14/83); fase completa mostra só "completo".
- **Dificuldade:** 200 fases em 4 faixas de 50. A lista de cada favo é aparada por faixa: Fácil usa palavras comuns de até 7 letras (pangrama até 8), 10 a 22 palavras; Médio até 8, 18 a 34; Difícil até 9, 28 a 52; Mestre é o favo inteiro. Palavras reais que ficaram de fora vão em `x` e são recusadas com "Existe, mas não vale nesta fase".
- Progresso em `nocap-bee-v2` (`nocap-words-bee-v2`); o v1 é apagado.
