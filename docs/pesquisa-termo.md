# Pesquisa: jogo de adivinhar a palavra de 5 letras (estilo Termo e Wordle)

Pesquisa feita em 19/10/2026 para o próximo jogo do NoCap. Fontes no fim. O que não consegui confirmar está marcado como **não confirmado**.

## 1. O jogo

Uma palavra secreta de 5 letras. A pessoa tem 6 tentativas; cada tentativa é uma palavra válida de 5 letras. Depois de cada uma, o jogo pinta as letras:

- **verde**: letra certa no lugar certo;
- **amarelo**: a letra existe na palavra, mas em outro lugar;
- **cinza**: a letra não existe (ou já foi usada todas as vezes que aparece na palavra).

Todo mundo recebe a mesma palavra no dia (modo diário). Não há anúncio, notificação nem jogo infinito no original: foi uma escolha deliberada do criador do Wordle.

### Regra das letras repetidas (onde a maioria dos clones erra)
A letra do palpite só é pintada tantas vezes quanto aparece na resposta. Exemplo: resposta `AMIGO`, palpite `MAMAE`: o primeiro `M` é amarelo, o segundo `M` fica cinza, porque só há um `M`. O algoritmo certo tem **duas passadas**: primeiro marca os verdes e consome essas letras da contagem; depois marca os amarelos com o que sobrou. Vários clones citam bugs aqui (um `R` repetido pintado errado, por exemplo).

### Detalhes que o original tem e valem copiar como ideia
- **Teclado na tela que colore as letras** já descobertas (a melhor pista de estado do jogo).
- **Modo difícil:** obriga a reusar os verdes e amarelos já revelados.
- **Alto contraste** para daltônicos (laranja e azul no lugar de verde e amarelo).
- **Compartilhar sem estragar:** um quadro de quadradinhos coloridos com o resultado, sem mostrar a palavra. Foi o que fez o jogo viralizar (a ideia veio de amigos na Nova Zelândia).
- **Duas listas:** palavras que podem ser a resposta (curadas, comuns) e palavras aceitas como palpite (bem maiores). No Wordle original são 2.309 respostas; o criador filtrou 13 mil palavras para cerca de 2 mil conhecidas, porque a parceira dele não conhecia as obscuras.

## 2. O Termo (a versão brasileira)

- Criado por Fernando Serboncini, que trabalha no Google, lançado em 5/1/2022, feito em poucos dias a partir do Wordle. A primeira resposta foi `festa`. Passou de 20 mil jogadores na primeira hora, 100 mil por dia em dez dias e mais de 500 mil por dia em fevereiro de 2022 (cerca de 85% no Brasil e 7,5% em Portugal). Chegou a derrubar o servidor.
- **Lista de palavras:** o difícil foi montar o léxico: cerca de 19 mil palavras de 5 letras (dicionários de sistemas operacionais, publicações e decisões judiciais), refinadas para tirar regionalismos obscuros, palavrões, nomes próprios e **verbos conjugados**. Depois, marcas foram removidas.
- **Acentos:** o jogo **preenche os acentos sozinho** (quem digita `acucar` vê `açúcar`); letras repetidas são permitidas. A palavra é escrita sem acento no teclado e comparada sem acento. (O comportamento exato da comparação não foi confirmado por fonte; é o que os guias do jogo descrevem.)
- **Variantes dele:** Dueto (duas palavras ao mesmo tempo, 7 tentativas) e Quarteto (quatro, 9 tentativas), lançados em 23/2/2022. O mesmo palpite vale para os tabuleiros ainda abertos.
- **Críticas:** jogadores de Portugal reclamaram de palavras só do Brasil (`mamãe`, `miojo`, `sachê`, `turnê`); o criador disse que a lista é revista de vez em quando.
- **Lista pública:** o criador liberou a lista para outros jogos. O repositório `fserb/pt-br` (licença **MIT**) tem um léxico de ~145 mil palavras, verbos e conjugações (~196 mil) e uma **pontuação de frequência (ICF)** por palavra, que serve para separar palavras comuns de raras. **Não conferi** se há um arquivo pronto só com as de 5 letras; é preciso olhar os arquivos.
- A Apple removeu cópias do Termo da App Store em janeiro de 2022 (clones com anúncio).

## 3. Variantes e o que ensinam

| Variante | Ideia | Lição para o NoCap |
| --- | --- | --- |
| **Quordle / Dueto / Quarteto** | várias palavras ao mesmo tempo | tensão sobe sem regra nova; fácil de fazer sobre o mesmo motor |
| **Absurdle** | o jogo escolhe a resposta mais cruel depois de cada palpite | modo "difícil de verdade"; é um adversário, não uma palavra fixa |
| **Semantle** | feedback por proximidade de sentido, sem limite | ritmo lento; exige modelo de linguagem (fora do escopo) |
| **Worldle e outros "dle"** | mesma estrutura, outro tema | o laço "palpite + feedback + compartilhar" aguenta qualquer tema |
| **Squabble** | multijogador: 100 de vida que se gasta com o tempo; palpite errado tira vida, verde e acerto recuperam; Blitz de 2 a 5 e Royale de 6 a 99 | competir ao vivo é emocionante, mas **tira o ritmo tranquilo** que é a graça do original |
| **Word Fight** | duelo entre duas pessoas, no ritmo de quem joga | versões muito competitivas ou com limite de tempo não pegam com amigos; o duelo leve pega |

**Tensão central do multijogador:** tempo e pressão dão emoção e afastam quem gosta de pensar com calma. Para jogar com amigos, a corrida "mesma palavra, quem acerta com menos palpites ou mais rápido" e o duelo por turnos são os formatos que as fontes indicam como mais sustentáveis.

## 4. Questões legais

- O Wordle é de uma ideia antiga (Mastermind, Jotto, o programa de TV Lingo). **A mecânica de adivinhar e receber feedback não é protegida** por direito autoral, segundo comentários jurídicos; o que se protege é a expressão (visual, textos, nome).
- O New York Times, dono do Wordle desde 31/1/2022, registrou a marca, mandou notificações DMCA contra centenas de clones no GitHub em 2024 e processou o dono do Worldle. Depois disse que não se opõe a jogos de palavras parecidos que **não usem a marca nem copiem o jogo**.
- **Conclusão prática (não é parecer jurídico):** não usar os nomes "Wordle" nem "Termo" (que é de outra pessoa); fazer visual e textos próprios (o NoCap já tem a identidade Pop Brutal); não copiar a tela do Wordle nem a do Termo.

## 5. Como encaixa no NoCap

O que o projeto já tem e ajuda: Daily por jogo com ranking, salas (código de 4 letras, lobby, revanche, chat, convites), contas e convidados, o princípio de que **o servidor guarda o segredo e recalcula tudo** (como no Intruso) e a mesma seed para todos.

### Anti-trapaça
A palavra secreta **nunca vai para o aparelho** (nem pelo DevTools). O aparelho manda o palpite, o **servidor valida e devolve só as cores**. A nota (tentativas e tempo) sai do servidor. No modo diário, a palavra vem de uma seed do dia no servidor; o cliente só recebe a palavra depois de acabar. (O Wordle original roda tudo no navegador, e por isso as respostas podem ser lidas no código; o NoCap não pode fazer assim se houver ranking.)

### Regras do projeto que o jogo precisa seguir
- **Sem emoji:** o quadro de compartilhar não pode ser de emoji; tem que ser desenhado (imagem ou texto com blocos no estilo Pop Brutal).
- Animações só em `transform` e `opacity` (virar a casa é um `rotateX`), respeitando `prefers-reduced-motion`.
- Telas nos tokens Pop Brutal; lógica só em `packages/games`; ranking só com presets (Daily e modos fixos; salas nunca).
- Spec antes de código e testes junto com a lógica (cores com letras repetidas têm testes obrigatórios).
- Itens da seção 6 do brief são decisão do Lucas.

### Modos possíveis
1. **Diário:** a palavra do dia, igual para todos, 6 tentativas; ranking do dia por tentativas e tempo; sequência de dias (o NoCap já faz isso nos outros jogos).
2. **Treino infinito:** palavras sorteadas pela seed, sem ranking de dia (ou com ranking por modo fixo).
3. **Dueto e Quarteto:** várias palavras no mesmo motor.
4. **Sala, corrida:** todos recebem a mesma palavra e jogam ao mesmo tempo; vê-se o **tabuleiro dos outros só com as cores, sem as letras** (não entrega a resposta); vence quem acerta com menos palpites, desempate por tempo. Sem pressão de tempo obrigatória (lição do Squabble).
5. **Sala, duelo:** dois jogadores, mesma palavra, quem acertar primeiro leva o ponto; melhor de 3 ou 5 palavras.
6. **Sala, "Intruso das letras"** (ideia solta): cada um recebe uma pista diferente. Fora do escopo agora.
7. **Absurdle/adversário** como modo extra (o servidor escolhe a pior resposta possível): idéia de longo prazo.

### Lista de palavras
- Base proposta: léxico MIT de `fserb/pt-br` (ou o dicionário Hunspell pt_BR VERO, licença LGPLv3/MPL, que precisa ser expandido com `unmunch`); filtrar para 5 letras; **tirar verbos conjugados, nomes próprios, palavrões e regionalismos fortes**; usar a frequência (ICF) para formar a lista de **respostas** (mais comuns, uns 2 mil a 3 mil) e deixar uma lista **maior de palpites aceitos** (uns 10 mil a 18 mil).
- Palavras com acento: aceitar o palpite **sem acento** e mostrar a palavra acentuada (como o Termo); decidir como tratar `ç` e `ã`.
- Revisão humana de pelo menos as respostas (o Termo ainda ajusta a lista depois do lançamento).
- Licenças: guardar o aviso da licença (MIT) no repositório; não copiar listas de sites sem licença (como a do Dicio).

## 6. Perguntas para decidir (do Lucas)

1. **Nome do jogo** (não pode ser Wordle nem Termo; "Letreco" já existe como clone). Sugestões: Cinco Letras, Decifra, Cravou, Chute, Palavrão (descartado), outras.
2. **Quais modos entram primeiro?** Minha sugestão: Diário + Treino, depois Dueto/Quarteto, depois sala (corrida e duelo).
3. **Na sala, mostrar o tabuleiro dos outros** só com cores (minha sugestão) ou esconder até o fim?
4. **Tempo** vale na nota do diário (desempate) ou só tentativas?
5. **Modo difícil** (reusar as dicas) e **alto contraste**: entram desde o começo?
6. **Lista de palavras:** posso usar o léxico MIT do `fserb/pt-br` como base?
7. **Compartilhar o resultado:** em imagem desenhada, em texto com blocos, ou os dois (sem emoji)?
8. **Convidado joga o diário?** (nos outros jogos o convidado joga sem salvar).

## Fontes

- [Wordle (Wikipedia, espelho de 2026)](https://en.wikipedia.org/wiki/Wordle) e [Wikipedia espelho](https://wiki.krisyotam.com/content/wikipedia_en_all_nopic_2026-03/Wordle)
- [NPR: o que está por trás do Wordle](https://www.npr.org/2022/01/12/1071840091)
- [Termo (Wikipedia)](https://en.wikipedia.org/wiki/Termo_(video_game))
- [Olhar Digital: entrevista com o criador do Termo](https://olhardigital.com.br/2022/02/23/games-e-consoles/o-jogo-alcancar-tanta-gente-me-surpreendeu-diz-criador-do-termo/)
- [Olhar Digital: Apple remove cópias do Termo](https://olhardigital.com.br/2022/01/13/games-e-consoles/apple-remove-copias-de-termo-da-app-store/)
- [Repositório fserb/pt-br (MIT)](https://github.com/fserb/pt-br)
- [Dicionário Hunspell pt_BR (VERO), licença](https://cdn.jsdelivr.net/npm/dictionary-pt@4.0.0/license)
- [Squabble: Tom's Guide](https://www.tomsguide.com/news/squabble-is-wordle-but-in-battle-royale-form-and-its-both-brilliant-and-stressful)
- [Word Fight: Boston Globe](https://www.bostonglobe.com/2022/07/01/games-comics/want-play-wordle-against-your-friends-try-word-fight)
- [Variantes do Wordle (TapSmart)](https://www.tapsmart.com/games/best-wordle-variants/) e [Around the World(le)](https://itswhatever.substack.com/p/around-the-worldle)
- [NYT e as notificações contra clones (Techdirt)](https://www.techdirt.com/2024/03/08/the-ny-times-war-on-all-wordle-clones-continues/)
- [Análise jurídica canadense sobre clones do Wordle](https://iplaw.allard.ubc.ca/?p=10381)
- [Erros comuns com letras repetidas em clones (Cemetech)](https://www.cemetech.net/forum/viewtopic.php?p=309931)
