# Spec 088: Impostor (primeiro jogo da categoria "Dinner Table Games")

Pedido do Lucas (17/11/2026). Status: **rascunho, regras aprovadas em 17/11/2026; falta o OK do design e do conteúdo (seção 8).**

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
- **Fases:** `reveal` (cada um vê seu papel) → `clues` (dica falada, uma palavra por pessoa, a ordem aparece na tela) → `talk` (debate com **tempo da rodada configurável**, 0:30 a 5:00 ou sem limite) → `vote` → `result` → (se pego e a regra estiver ligada) `guess` → pontos.
- **Dica:** uma palavra, sem repetir a palavra secreta nem dizer parte dela. Quem quebrar a regra é acusado de boca pelo grupo (não é verificado pelo app).
- **Voto:** cada pessoa aponta uma suspeita ou se abstém; na mesa, cada um vota em sequência no mesmo aparelho (a tela esconde o voto) e na sala todos votam ao mesmo tempo. Pode trocar até enviar. Votos aparecem na revelação (o host pode ligar **voto anônimo**).
- **Pego:** com K impostores, é pego quem recebe estritamente mais votos que o (K+1)-ésimo mais votado e pelo menos 1. Empate na fronteira não pega ninguém. É a mesma conta do Intruso (`tallyVotes`), aproveitada.
- **Pego, e agora (escolha do host, padrão: ligada):** o impostor pego tem **uma chance de adivinhar a palavra**. Se acertar, o impostor ganha a rodada. Se a regra estiver desligada, ser pego é perder.
- **Mr. White:** se pego, também adivinha a palavra (mesma regra). Se for o único pego e acertar, vence sozinho.
- **Quem ganha a rodada:** inocentes, se **todos** os impostores foram pegos e nenhum adivinhou; impostores, caso contrário.
- **Resultado:** mostra quem era impostor, a palavra (e a parecida), os votos e os pontos.

## 6. Pontuação (placar acumulado, escolhido em 17/11/2026)

Por rodada: inocente que votou num impostor de verdade +2; inocentes ganham +1 se a rodada for deles; impostor que não foi pego +4; impostor pego que adivinha a palavra +3; Mr. White que adivinha +5. Vence quem somar mais depois de N rodadas (padrão 5, o host escolhe 1 a 10). Empate no placar final: ganha quem foi impostor e sobreviveu mais vezes. Sem ranking global: partida de mesa e sala nunca entram no ranking (regra do app).

## 7. Conteúdo

- **Palavras:** categorias em pt-BR com palavras e **pares parecidos** (para o modo 2/3) e **perguntas pareadas** (modo 4). Meta da primeira versão: **10 categorias, 500+ palavras com par**, 100+ pares de perguntas. Categorias iniciais: Hora da Festa, Celebridades, Comida, Apimentado (adulto, escondido atrás de aviso), Animais, Lugares, Profissões, Filmes e Séries, Esportes, Tecnologia.
- Conteúdo só no servidor para a sala; no modo Mesa vai no app (offline). Teste barra palavra repetida, par igual à palavra e categoria vazia.
- A palavra parecida precisa ser **boa**: parecida o bastante para confundir, diferente o bastante para as dicas diferirem (cachorro/lobo, não cachorro/foguete).
- **Sem assinatura, anúncio ou pacote travado** (queixa número 1 dos apps).

## 8. Design (decisão do Lucas pendente)

Referência: o Fakeit (limpo e característico): fundo vermelho-rosa com grade, cartões escuros arredondados em moldura branca, títulos grandes em caixa alta, botão branco no pé da tela ("CONTINUAR | 4 Jogadores"), bonecos 3D coloridos como avatares na votação, cartas de categoria com ícone. **A identidade do NoCap fica própria, não é cópia**: o Impostor usa suas cores, fontes e ilustração (raposas do Fox Cap! como avatares, em vez de bonecos 3D), mas o mesmo desenho de telas: **Jogadores → Categorias → Configurações → Revelar papel → Dicas/Debate (cronômetro) → Votar → Resultado → Jogar de novo**. Só `transform`/`opacity` animam, respeitando `prefers-reduced-motion`. **Isso exige uma exceção em `RULES.md` (como as dos outros jogos), que só vale com o OK do Lucas.** Mobile conforme `docs/MOBILE-GUIDE.md`.

## 9. O que muda no que já existe

- O **Intruso** (variante da Cor, spec 011) sai da Mesmíssima e do seletor de jogos da sala; a Mesmíssima volta a ter só os modos de cor. O código do Intruso fica até o Impostor novo passar nos testes, depois é removido em commit próprio (a lógica de papéis e votos é aproveitada).
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
