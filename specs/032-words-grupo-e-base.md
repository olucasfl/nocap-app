# 032 · Word's: o grupo de jogos de palavras e a base de palavras em português

Status: **aprovada (19/10/2026): decisões do Lucas registradas abaixo; construção começa pela base de palavras e pelo Classic.** Pesquisa de base em [docs/pesquisa-termo.md](../docs/pesquisa-termo.md). Specs dos jogos: [033 Classic Word's](033-classic-words.md), [034 Connect Word's](034-connect-words.md) e [035 Bee Word's](035-bee-words.md).

## Objetivo

Criar o **Word's**, um grupo de jogos de palavras dentro do NoCap, no mesmo molde do **Block's**: um cartão na tela inicial que abre uma página própria com os jogos. Três jogos, cada um com a sua página, os seus modos, o seu Daily, o seu histórico e os seus recordes:

| Jogo | Inspirado em | Ideia |
| --- | --- | --- |
| **Classic Word's** | Termo, Wordle | adivinhar a palavra de 5 letras (modos 1, 2 e 4 palavras, e o Daily) |
| **Connect Word's** | Conexo, Connections (NYT) | separar 16 palavras em 4 grupos de 4 |
| **Bee Word's** | Spelling Bee (NYT) | formar palavras com 7 letras, uma delas obrigatória |

Este arquivo cobre o que os três têm em comum: o grupo, a **base de palavras**, a regra das cores, as "corridas" (o estado de uma partida no servidor), o Daily, o compartilhar e a integração com o resto do app.

## Decisões do Lucas (19/10/2026)

- O grupo chama **Word's**; dentro dele ficam os jogos, e cada jogo tem os seus modos.
- Ordem pedida: **Classic Word's**, **Connect Word's**, **Bee Word's**.
- O **Classic** tem uma **página própria**: tocar nele abre uma tela para escolher **Daily**, **1 palavra**, **2 palavras** ou **4 palavras**, com as regras já conhecidas de cada modo. O **Daily tem uma interface própria**, que controla se a pessoa já jogou e mostra o que precisa.
- **Os três precisam de uma base de palavras em português boa.** Sem palavras distantes ou difíceis demais. No Connect as palavras **precisam combinar de verdade**.
- **Respostas às decisões em aberto (19/10/2026):** (1) **convidado joga os modos livres sem salvar; o Daily só com conta**; (2) **os modos livres NÃO têm ranking, só o Daily**; (3) **pode usar a coleção MIT `fserb/pt-br` e o esquema de revisão** (eu monto o corte e leio as listas, o Lucas dá a palavra final); (4) corrida em banco (`word_runs`), como proposto; (5) vale para os três jogos o que está em cada spec.
- Não é para só copiar o Termo e os outros: o que for igual ao original segue o gênero; o que diferencia (poderes, modos de sala, etc.) é tratado nas melhorias da seção final e em specs futuras.

## Regras comuns

### Nomes e ids
- Grupo: **Word's** (rota `/words`). Jogos: **Classic Word's** (`/words/classic`, id `wclassic`), **Connect Word's** (`/words/connect`, id `wconnect`), **Bee Word's** (`/words/bee`, id `wbee`).
- Os ids entram nas mesmas listas dos outros jogos (`GameId` em `packages/games` e em `apps/web/src/lib/stats.ts`, ranking, histórico, perfil e recordes). O nome na tela é "Classic Word's" etc.; o apóstrofo segue o padrão do "Block's".
- **Não se usa** "Wordle" nem "Termo" em lugar nenhum (nome, texto, imagem), e o visual é o Pop Brutal do NoCap, sem copiar a tela de nenhum deles.

### O servidor guarda o segredo (anti-trapaça)
A palavra secreta, o puzzle e a lista de respostas **nunca vão para o aparelho**. O aparelho manda a jogada, o **servidor valida e devolve só o resultado** (as cores, "falta uma", "palavra aceita"). A resposta só aparece quando a partida acaba. Consequências:
- Os jogos do Word's **exigem internet** (como as salas). Sem rede, a tela explica e oferece voltar. Um modo de treino offline exigiria mandar a lista de respostas ao aparelho, que revelaria também as palavras dos próximos Dailies; por isso **não existe** nesta etapa.
- O servidor limita jogadas por minuto por conta e por IP (a mesma ideia dos 30 partidas/min da spec 010) para ninguém usar o jogo como oráculo.

### Corrida (run): o estado da partida fica no servidor
Cada partida é uma **corrida**, guardada no banco (tabela nova `word_runs`, migration só de criação, nada destrutivo):

| Campo | O que guarda |
| --- | --- |
| `id`, `user_id`, `game` (`wclassic`, `wconnect`, `wbee`), `mode` | quem e o quê |
| `seed` | de onde saem a palavra, o puzzle ou as letras (a seed sozinha não revela nada: a lista de respostas fica no servidor) |
| `kind` | `daily` ou `solo` |
| `day` | data do Daily (`dailyDate`, fuso de São Paulo); nulo no solo |
| `moves` | as jogadas feitas, em ordem (palpites, grupos tentados, palavras enviadas) |
| `state` | `open`, `won`, `lost` ou `done` |
| `started_at`, `finished_at` | relógio do servidor |

- A cada jogada o servidor **anexa à corrida e responde**. Fechar o app e voltar **retoma exatamente de onde parou**, em qualquer aparelho. É assim que o Daily não pode ser "reiniciado" para ganhar tentativas novas.
- Ao terminar, o servidor grava a partida em `matches` (como os outros jogos: nota em décimos, `kind`, `mode`, `scoreVersion`) e a corrida vira `won`, `lost` ou `done`. Corridas `open` de solo com mais de 24 h são descartadas; as de Daily seguem até a meia-noite.
- Retenção e limites de histórico: os mesmos do resto do app (200 partidas por jogo).

### Daily dos três jogos
- Mesmo desenho dos outros jogos (spec 010): **uma partida por conta por dia** (fuso `America/Sao_Paulo`, o dia vira à meia-noite), válida em qualquer aparelho, `dailySeed(game)` para a escolha do dia e `dailyStreak` para a sequência.
- Cada jogo tem **a sua tela de Daily** (reaproveitando `DailyScreen`/`DailyPanel`): quem ainda não jogou vê o convite; quem está no meio vê "Continuar"; quem já jogou vê o resultado, a nota e a parte social do dia (quantos jogaram, melhor nota, média, sua posição, sequência) e o ranking (Hoje, Semana, Sempre; Todos ou Amigos). Os detalhes de cada jogo estão nas specs 033 a 035.
- O número do dia ("#123") conta dias desde a data de lançamento, para o compartilhar.
- **Daily nunca repete e nunca muda depois de publicado.** As listas de respostas e de puzzles são **só de acrescentar** (append-only) e o dia N sempre usa o item N de uma ordem embaralhada e fixa (ver abaixo).

### Nota e ranking
- Cada jogo dá **nota de 0 a 10** (1 casa), calculada **no servidor**, guardada em décimos (nota x 10) como os demais.
- O Daily entra no ranking do jogo (soma das notas dos dias, como na spec 010).
- **Ranking só com presets** (regra do projeto): os modos fixos valem; salas nunca entram. O ranking dos modos livres está em "Decisões em aberto".

### Compartilhar sem emoji
O resultado se compartilha como **imagem desenhada** (Canvas, no estilo Pop Brutal: o quadro de casas coloridas, o número do dia e a nota), sem a palavra, e como **texto simples** (nome do jogo, número do dia, resultado e o link), **sem emoji** (regra 6 do projeto). O botão usa o compartilhar nativo do aparelho quando existe e cai para "copiar" quando não.

### Acessibilidade e movimento
- **Alto contraste** (laranja e azul no lugar de verde e amarelo) e as cores nunca são a única informação: cada casa também mostra um **símbolo** (traço embaixo = lugar certo, ponto = lugar errado), como no Decifra.
- Animações só em `transform` e `opacity` (virar a casa é um `rotateX`); com `prefers-reduced-motion` tudo aparece sem movimento.
- Teclado físico e na tela; botões de 44 px no mínimo.

## A base de palavras

Esta é a peça que mais pesa na qualidade dos três jogos. Cada jogo usa uma **lista própria**, todas derivadas da mesma coleção.

### Fonte
A coleção **`fserb/pt-br`** (licença **MIT**), a mesma que o criador do Termo liberou para outros jogos e que o projeto Decifra usa. Tem o **léxico** (145.744 palavras, minúsculas, com acento), as **conjugações** (195.751 formas), a lista de **verbos**, listas de **países, estados e municípios** e de **palavras negativas**, e o **ICF** (419.486 palavras com uma nota de raridade: quanto **menor**, mais comum). O aviso da licença MIT fica no repositório (`LICENSE-palavras.txt`, no formato do Decifra). Não se usam listas de sites sem licença (Dicio e semelhantes).

Eu baixei a coleção e medi o que ela dá (19/10/2026):

| O que | Quanto |
| --- | --- |
| Palavras de 5 letras no léxico | 6.300 |
| ... sem formas verbais | 5.452 |
| ... sem países, estados, municípios e palavras negativas | 5.308 |
| Com plurais simples somados (o léxico quase não tem plural) | 6.578 |
| **Candidatas a resposta** com ICF até 13 / 14 / 15 | **1.442 / 1.980 / 2.576** |
| **Palpites aceitos** (léxico + plurais + formas verbais de 5 letras) | **9.049** |
| Palavras de 4 letras ou mais (ICF até 13,5), sem acento | 18.967 |
| Conjuntos de 7 letras que formam pelo menos 1 pangrama (Bee) | 2.416 (1.479 sem a letra S) |
| Combinações para o Bee com 20 a 70 palavras e 1 ou 2 pangramas | 5.141 |

### O que está ruim na coleção (e como tratamos)
- **Quase não tem plural nem feminino** (`amigos` não está no léxico). Tratamento: somar os **plurais simples** (`+s`, `+es`) de entradas do léxico que tenham frequência, e as formas verbais só como **palpite aceito**, nunca como resposta.
- **Mistura nomes próprios e coisas obscuras** (`césar`, `ávila`, `bangu`, `joão`, `jóias` com grafia antiga, `caput`). Tratamento: filtros automáticos (países, estados, municípios, negativas) e depois **revisão humana de todas as respostas**.
- **Palavras comuns demais para serem respostas boas** (`muito`, `mesmo`, `todos`, `ainda`) estão no topo da frequência. Não é problema: são aceitas como palpite e podem ser resposta, mas a revisão tira as que parecem artigo ou advérbio sem graça.

### Como as listas são montadas
Um script no repositório (`apps/api/scripts/words/`, em Node, determinístico) lê a coleção, aplica os filtros e escreve os arquivos. Quem decide o que entra e sai é o **Lucas** (e eu, no papel de revisor), por arquivos de ajuste que ficam no repositório, como no Decifra:

| Arquivo | Para quê |
| --- | --- |
| `fora.txt` | palavras que **saem** das respostas (nomes, regionalismos fortes, grafia antiga, ofensivas, marcas) |
| `extras.txt` | palavras que **entram** (comuns que a coleção não tem) |
| `aceitas-extra.txt` | palavras aceitas como palpite que faltam |
| `ordem.txt` | a ordem fixa das respostas (embaralhada com seed fixa; **só acrescenta no fim**) |

Regras de qualidade de uma **resposta** (Classic): 5 letras, substantivo, adjetivo ou verbo no infinitivo curto (sem conjugação), de uso comum no Brasil, **sem** nome próprio, marca, gíria só regional, palavrão, termo técnico obscuro, abreviação, sigla ou grafia que mudou. Meta: **2.500 a 3.000 respostas** (mais de 7 anos de Daily), todas lidas por uma pessoa. As palavras **mais comuns** entram primeiro na ordem do Daily para os primeiros meses serem justos.

### Acentos e `ç`
- O teclado tem só **A a Z**. A pessoa digita sem acento e o jogo **mostra a forma correta** depois do envio (`aviao` vira `avião`; `coracao` vira `coração`), como o Termo.
- A comparação usa a **chave sem acento** (`avião` e `aviao` têm a mesma chave). **Duas respostas nunca têm a mesma chave.** Entre palpites aceitos com a mesma chave, vale a mais frequente.
- No Bee as letras são mostradas sem acento e as palavras acentuadas valem normalmente.

### Regra das cores (função única, usada pelo servidor e pelos testes)
`packages/games/src/words/feedback.ts`, com **duas passadas**: primeiro marca os **verdes** e consome essas letras da contagem da resposta; depois marca os **amarelos** só com o que sobrou; o resto fica **cinza**. Exemplo: resposta `AMIGO`, palpite `MAMAE`: o 1º `M` amarelo, o 2º `M` cinza. Testes obrigatórios com letras repetidas em todas as combinações (resposta com 1, 2 e 3 repetições; palpite com mais repetições que a resposta; palavra toda igual). No Dueto e no Quarteto cada tabuleiro é calculado de forma independente com o mesmo palpite.

## Telas e fluxo do grupo

- **Tela inicial:** novo cartão **Word's** (arte própria no estilo da `GameArt`), com o selo "HOJE 0/3" quando houver Dailies não jogados.
- **`/words`:** três cartões grandes (Classic, Connect, Bee), cada um com o estado do Daily do dia (não jogado, em andamento com o resumo, feito com a nota). No futuro, as salas entram aqui.
- Cada jogo abre a sua página, com a sua tela de modos e o seu Daily (specs 033 a 035). Sons por toque (`data-sfx`) como nos outros jogos, sons de jogo sintetizados (Web Audio), nada de emoji.

## Modelo de dados e API

Rotas novas do módulo `apps/api/src/words/` (um módulo Nest por domínio): 

| Rota | O que faz |
| --- | --- |
| `GET /words/:game/daily` | o estado do Daily de hoje para a conta (não jogado, em andamento, feito) e a parte social do dia |
| `POST /words/:game/runs` | começa (ou retoma) uma corrida: `{ kind, mode }`; devolve o que o aparelho pode ver (tabuleiro vazio, 16 palavras do Connect, 7 letras do Bee) e o `runId` |
| `POST /words/:game/runs/:id/moves` | uma jogada; devolve o resultado dela e o estado novo |
| `POST /words/:game/runs/:id/finish` | encerra (o Bee usa; nos outros a corrida fecha sozinha) |
| `GET /words/:game/runs/:id` | o estado atual (para retomar) |

- Validação com Zod (como as outras rotas), erros em pt-BR, 401 sem sessão, 409 para o segundo Daily do dia, 429 para excesso de jogadas.
- Migration nova `word_runs` (e índices por `user_id`, `game`, `day`). Sem mudança em tabelas existentes além de aceitar os novos valores de `game` (já é texto) e a lista `RANKING_GAMES`/`BOARDS_OF` em código.

## Critérios de aceite

- **Dado** um palpite com letras repetidas, **quando** o servidor calcula as cores, **então** o resultado bate com a tabela de testes das duas passadas.
- **Dado** que a palavra é `avião` e eu digito `aviao`, **então** o jogo aceita e mostra `avião`.
- **Dado** que respondi o Daily de hoje, **quando** tento começar outro, **então** o servidor recusa (409) e a tela mostra o resultado.
- **Dado** que fechei o app no meio do Daily, **quando** volto, **então** o tabuleiro está igual e as jogadas feitas continuam gastas.
- **Dado** qualquer resposta de qualquer rota antes do fim da partida, **então** ela não contém a palavra secreta, o puzzle completo nem a lista de respostas.
- **Dado** que a conta passa do limite de jogadas por minuto, **então** recebe 429.
- **Dado** o app sem internet, **então** o Word's mostra a explicação e não deixa começar partida.
- **Dado** o script de listas, **quando** roda duas vezes, **então** gera arquivos idênticos e nenhuma resposta repete a chave sem acento.
- **Dado** `prefers-reduced-motion`, **então** nenhum movimento além de trocas de cor e opacidade.

## Fora de escopo (nesta etapa)

Salas e modos de vários jogadores; modo de treino offline; dicionário com significados; conquistas; outros idiomas; app de loja.

## Decisões em aberto

1. ~~Convidado joga?~~ **Decidido:** convidado joga os modos livres sem salvar; Daily só com conta. (Proposta original: convidado joga os **modos livres** sem salvar (spec 023) e o **Daily só com conta**. O servidor precisa de uma corrida mesmo para convidado (de vida curta), com limite por IP.)
2. ~~Ranking dos modos livres.~~ **Decidido: não tem ranking, só o Daily.** Os modos livres mostram sequência de vitórias, tentativas médias e vitórias nos recordes. (Proposta original: **sem ranking de nota máxima**; mostrar **sequência de vitórias**, **tentativas médias** e **vitórias** nos recordes, e deixar um quadro de "melhor sequência" para uma etapa seguinte.)
3. ~~Posso usar a coleção `fserb/pt-br` (MIT) como base?~~ **Decidido: sim.**
4. ~~Quem revisa as respostas?~~ **Decidido:** (proposta aprovada) eu monto o primeiro corte e leio a lista inteira marcando o que sai; o Lucas dá a palavra final em amostras e nas dúvidas.
5. ~~Corrida em banco ou em memória?~~ **Decidido:** banco (a tabela `word_runs`), porque o Daily não pode perder tentativas se o servidor reiniciar.

## Melhorias e acréscimos sugeridos (para o Lucas decidir)

- **"Trinca do dia"**: o cartão do Word's mostra os 3 Dailies e uma **sequência combinada** (dias seguidos em que fez os 3) e um ranking Word's que soma os 3.
- **Estatísticas no perfil**: distribuição de tentativas do Classic, taxa de acerto do Connect, patente máxima do Bee.
- **Arquivo**: jogar Dailies passados (sem valer ranking), útil para quem entrou depois.
- **Salas** (spec futura): corrida de palavras, duelo e os modos "fora da caixa" da conversa de ideias (Bomba de sílabas, Adedonha, Letras caindo, etc.) como novos jogos do grupo.
- **Significado da palavra** depois do fim da partida (precisa de uma fonte livre de definições; ver depois).
