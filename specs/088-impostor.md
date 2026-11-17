# Spec 088: Impostor (primeiro jogo da categoria "Dinner Table Games")

Pedido do Lucas (17/11/2026). Status: **rascunho; regras e categorias aprovadas em 17/11/2026; falta o OK do design (seção 8).**

## 1. A categoria "Dinner Table Games"

Nova categoria no início, ao lado de Fox Cap!, Word's etc. São jogos de **roda de mesa**: família e amigos sentados juntos, **um celular passado de mão em mão** (modo Mesa, sem internet), ou cada um no seu celular numa sala (modo Sala). Cada jogo da categoria tem identidade visual própria (como o Counter Fox e o Mini Golf já têm). Próximos candidatos (fora desta spec): Cidade Dorme, Mímica, Verdade ou Desafio. **Esta spec cobre só a categoria (tela de entrada) e o Impostor.**

## 2. O que é

Todos recebem uma **palavra secreta**, menos o(s) impostor(es). Cada um dá uma dica falada; o grupo debate e vota em quem acha que é o impostor. Os jogos de referência (Fakeit, Imposter Who?, Undercover, The Chameleon, Spyfall) ficam em "Pesquisa" no fim.

## 3. Jeitos de jogar (mesma regra nos dois)

- **Mesa:** um celular. Cada pessoa toca no próprio nome, vê o papel em segredo (segura para revelar, solta para esconder) e passa o celular. Debate e voto também no mesmo aparelho. Funciona **offline**. A lógica roda toda no aparelho (`packages/games`), sem servidor.
- **Sala:** cada um no seu celular, nas salas que já existem (lobby, chat, presença). O servidor sorteia, guarda o segredo e manda a cada pessoa só o que ela pode ver (`snapshot(viewerId)`, como no Intruso, spec 011).

## 4. Modos

1. **Clássico:** todos veem a palavra, menos o(s) impostor(es). Opção "Dica para impostores": o impostor vê a **categoria** da palavra (desligada por padrão).
2. **Palavra parecida:** os impostores recebem uma **palavra diferente e parecida** (cachorro/lobo) e **não sabem que são impostores**. Eles só descobrem pelas dicas dos outros. Recomendado a partir de 5 pessoas.
3. **Sem palavra (Mr. White):** a maioria vê a palavra, um tem a palavra parecida e **um não vê nenhuma palavra**. Só a partir de 6 pessoas. O Mr. White nunca começa a rodada.
4. **Só uma resposta errada:** todos recebem uma **pergunta** e respondem em voz alta; os impostores receberam uma pergunta **parecida, mas diferente**. O grupo acha quem respondeu "ao lado". Mesmos votos e pontos.

Escolha do modo na tela de configuração, como as cartas do Fakeit.

## 5. Regras da rodada

- **Jogadores:** 3 a 15 (mesa) e 3 a 12 (sala; limite das salas). Nomes livres na mesa.
- **Impostores:** o host escolhe 1, 2 ou 3, ou **"aleatório"** (1 até o máximo do grupo, o número não é revelado). Máximo = `min(3, n - 1)`, como no Intruso.
- **Sorteio justo (reclamação número 1 dos apps):** quem foi impostor menos vezes tem mais chance; ninguém passa mais de 2 rodadas sem ser (com 4+ pessoas). Determinístico pela seed e pelo histórico, testado.
- **Quem começa a falar:** sorteado, **independente do papel** (queixa dos apps: "o impostor nunca começa"). Mr. White nunca começa.
- **Rodadas de dicas (Lucas, 17/11/2026):** o host escolhe de **1 a 5 rodadas** (padrão 3). Em cada rodada, **todos falam uma palavra, na mesma ordem**; a rodada seguinte repete a volta e cada um diz **outra palavra** (diferente das que já disse). Só **depois da última rodada** abre o debate e a votação.
- **Fases:** `reveal` (cada um vê seu papel) → `clues` (rodadas 1 a N, uma palavra por pessoa por rodada, a ordem e o número da rodada ficam na tela) → `talk` (debate livre, tempo configurável de 0:30 a 5:00 ou sem limite) → `vote` (**voto secreto, um por vez**) → `result` → (se pego e a regra estiver ligada) `guess` → pontos.
- **Quem começa:** sorteado, independente do papel; a ordem é a mesma nas N rodadas.
- **Voto secreto e individual (Lucas, 17/11/2026):** cada pessoa vota **em particular**, para os pontos irem para quem votou certo. Na mesa: o celular passa de mão em mão, cada um vê só a própria tela de voto (não pode votar em si mesmo) e confirma; o voto some da tela. Na sala: cada um vota no próprio celular ao mesmo tempo. Só depois do último voto aparece o resultado, com a contagem dos mais votados (o voto de cada pessoa só é revelado se o host desligar o voto anônimo). Não existe abstenção: quem não vota no tempo da sala fica sem pontos de voto.
- **Dica:** uma palavra por rodada, sem repetir a palavra secreta nem dizer parte dela, e sem repetir uma dica já dita na partida. Quem quebrar a regra é acusado de boca pelo grupo (não é verificado pelo app).
- **Pego:** com K impostores, é pego quem recebe estritamente mais votos que o (K+1)-ésimo mais votado e pelo menos 1. Empate na fronteira não pega ninguém. É a mesma conta do Intruso (`tallyVotes`), aproveitada.
- **Pego, e agora (escolha do host, padrão: ligada):** o impostor pego tem **uma chance de adivinhar a palavra**. Se acertar, o impostor ganha a rodada. Se a regra estiver desligada, ser pego é perder.
- **Mr. White:** se pego, também adivinha a palavra (mesma regra). Se for o único pego e acertar, vence sozinho.
- **Quem ganha a rodada:** inocentes, se **todos** os impostores foram pegos e nenhum adivinhou; impostores, caso contrário.
- **Resultado:** mostra quem era impostor, a palavra (e a parecida), os votos e os pontos.

## 6. Pontuação (placar acumulado, escolhido em 17/11/2026)

Por rodada (a partida inteira, depois das N rodadas de dicas): inocente que votou num impostor de verdade +2; inocentes ganham +1 se a rodada for deles; impostor que não foi pego +4; impostor pego que adivinha a palavra +3; Mr. White que adivinha +5. Vence quem somar mais depois de N rodadas (padrão 5, o host escolhe 1 a 10). Empate no placar final: ganha quem foi impostor e sobreviveu mais vezes. Sem ranking global: partida de mesa e sala nunca entram no ranking (regra do app).

## 7. Conteúdo

**Regra de ouro (Lucas, 17/11/2026): toda palavra tem que ser conhecida e famosa. Nada difícil, nada obscuro** (cidade ou país desconhecido, jogador pouco famoso, marca de nicho). Cada palavra entra com uma nota de fama (1 = todo mundo conhece, 2 = a maioria conhece); só 1 e 2 são aceitas, e o teste barra o resto.

**As 10 categorias da primeira versão** (decididas em 17/11/2026):

| Categoria | O que entra | Personalização (tela de configuração) |
|---|---|---|
| Comida | pratos, doces, bebidas, frutas, lanches | tipo: pratos, doces, bebidas, frutas, lanches (marcar vários) |
| Animais | bichos conhecidos de casa, fazenda, selva, mar | tipo: de casa, fazenda, selva, mar, aves |
| Lugares | **cidades e países famosos** (Paris, Nova York, Rio de Janeiro, Japão, Itália) | só países, só cidades; Brasil ou mundo todo |
| Marcas | marcas famosas (Nike, Coca-Cola, Apple, Netflix, McDonald's) | tipo: tecnologia, comida e bebida, roupa e esporte, entretenimento |
| Esportes | modalidades, equipamentos e eventos conhecidos | modalidades, equipamentos, eventos (Copa, Olimpíada) |
| Filmes e Séries | títulos famosos | filmes, séries, animações; nacionais ou internacionais |
| Super-heróis e vilões | Marvel, DC e clássicos | heróis, vilões, os dois; Marvel, DC |
| Músicas e bandas | artistas e músicas muito conhecidos | bandas, cantores, músicas; Brasil ou mundo todo |
| Clash Royale | **só cartas** (tropas, campeões, feitiços, construções, torres), as mais conhecidas, conferidas no wiki do jogo; nada de arena, baú, elixir ou ouro | tipo: tropas, campeões, feitiços, construções, torres |
| Futebol | jogadores, times, seleções, estádios | ver abaixo |

**Futebol, personalização completa (pedido do Lucas):** o host escolhe o que entra:
- **O quê:** jogadores, times, seleções (marcar um ou mais; também estádios e técnicos famosos, desligados por padrão).
- **Times:** só do Brasil ou do mundo todo (ou os dois).
- **Jogadores:** só do Brasil ou do mundo todo; **só jogadores famosos** (lista curada, atuais e lendas).
- **Seleções:** entram ou não.

**Como a personalização funciona (vale para todas):** cada palavra tem etiquetas (`tipo`, `origem: brasil|mundo`, `fama`). A tela de configuração mostra, para cada categoria marcada, as opções dela; o jogo sorteia só entre as palavras que passam no filtro. Se o filtro deixar menos de 30 palavras, o app avisa e não deixa começar. Várias categorias podem ser marcadas ao mesmo tempo (a palavra sai de qualquer uma).

**Pares parecidos e perguntas pareadas:** cada palavra precisa de um par para o modo "palavra parecida" (Mega Cavaleiro/P.E.K.K.A., Messi/Cristiano Ronaldo, Paris/Londres, Coca-Cola/Pepsi) e as categorias têm perguntas pareadas para o modo "resposta errada". O par também tem que ser famoso e do mesmo tipo.

**Tamanho da primeira versão:** 60 a 100 palavras por categoria (de 600 a 1000 no total), cada uma com par e etiquetas, mais 100+ pares de perguntas.

**Aprovação das listas (pedido do Lucas, 17/11/2026): antes de entrar no jogo, cada lista de palavras é enviada ao Lucas inteira, categoria por categoria, e só entra depois do OK dele.** Nada de palavra nova sem ele ver.

**Sem categoria apimentada/adulta.** Sem assinatura, anúncio ou pacote travado.

**Onde mora:** no modo Mesa (offline) o conteúdo vai no app; na sala vai no servidor. Testes barram palavra repetida, par igual à palavra, par de outro tipo, fama fora de 1 a 2 e categoria com menos de 60 palavras.

## 8. Design (decisão do Lucas pendente)

Referência: o Fakeit (limpo e característico): fundo vermelho-rosa com grade, cartões escuros arredondados em moldura branca, títulos grandes em caixa alta, botão branco no pé da tela ("CONTINUAR | 4 Jogadores"), bonecos 3D coloridos como avatares na votação, cartas de categoria com ícone. **A identidade do NoCap fica própria, não é cópia**: o Impostor usa suas cores, fontes e ilustração (raposas do Fox Cap! como avatares, em vez de bonecos 3D), mas o mesmo desenho de telas: **Jogadores → Categorias → Configurações → Revelar papel → Dicas/Debate (cronômetro) → Votar → Resultado → Jogar de novo**. Só `transform`/`opacity` animam, respeitando `prefers-reduced-motion`. **Isso exige uma exceção em `RULES.md` (como as dos outros jogos), que só vale com o OK do Lucas.** Mobile conforme `docs/MOBILE-GUIDE.md`.

## 9. O que muda no que já existe

- O **Intruso** (variante da Cor, spec 011) **saiu da lista de modos da Mesmíssima em 17/11/2026** (pedido do Lucas). O Impostor novo reaproveita o id de sala `impostor`; o código do Intruso na sala (servidor e telas) é substituído na etapa 5 e removido em commit próprio.
- A sala ganha o Impostor no seletor (categoria "Mesa") e atividade "jogando Impostor" na presença (spec 087).
- Nada de migration: partidas de mesa e sala não ficam salvas no histórico nesta versão.

## 10. Etapas

1. Lógica pura em `packages/games/src/impostor` (papéis, sorteio justo, fases, votos, pontos, quatro modos) com testes.
2. Conteúdo (categorias, pares, perguntas) com testes de qualidade.
3. Categoria "Dinner Table Games" no início + tela do jogo + modo Mesa (offline).
4. Telas de configuração, revelar papel, voto e resultado (design, mobile).
5. Modo Sala (servidor autoritativo + lobby).
6. Retirar o Intruso da Mesmíssima; documentos e testes de celular.

## Pesquisa

Fakeit (smak apps, 5M+ downloads, 4,5): palavra secreta, impostor sem palavra, dicas, debate, voto, dicas opcionais para impostores, duração da rodada, 1 a 3 impostores, 10 categorias e 1000+ palavras, offline. Imposter Who? (Sokak, 10M+): impostor vê só "Imposter", 3 a 15 pessoas num aparelho. Undercover: civis, undercover com palavra parecida e Mr. White sem palavra, eliminação, Mr. White pego adivinha. The Chameleon: grade de 16 palavras, uma palavra por pessoa. Reclamações dos jogadores: sorteio que repete quem é impostor, impostor nunca começa a falar, assinatura e anúncios, poucas categorias.
