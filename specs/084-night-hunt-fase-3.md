# 084: Night Hunt, fase 3 (itens novos no estilo Vampire Survivors, bestiário e nova evolução)

Status: rascunho com as decisões de heróis, preços, chefe final e obstáculos já tomadas (seção 9); faltam a lista de itens e a liberação da wiki do VS. Continuação da [083](083-night-hunt.md).

## 1. Pedido (15/11/2026)

1. **Itens novos** parecidos com os do Vampire Survivors (VS), no estilo dele, com animações prontas e bem feitas **seguindo o padrão que o jogo já tem** (arte do Slash + sprites gerados em `extra-art.ts`).
2. **Pesquisar cada item no VS antes de fazer** (o que faz, como evolui, o que combina com o quê, números) e só então implementar.
3. **Bestiário** como o do VS: lista numerada dos inimigos à esquerda, painel à direita com o bicho **animado**, descrição, estatísticas e onde aparece.
4. **Evolução e uniões** como no VS (seção 5): arma no máximo + passivo evolui na próxima escolha, e a carta avisa "combina com" quando a pessoa já tem o parceiro.
5. Perguntar antes de decidir qualquer coisa duvidosa (seção 8).

## 2. O que já existe e esta fase reaproveita

- 15 + 4 melhorias (`UpgradeId`, `UPGRADES` em `rules.ts`), 7 armas (6 slots) e 12 passivos (6 slots), evolução "arma no máximo + passivo + baú" (`EVOLUTIONS`, `EVO_INFO`), baú com pegar ou recusar.
- 36 inimigos do Slash (`ENEMIES` em `settings.ts`: vida, dano, velocidade, XP, ouro, tipo de movimento), 17 tipos de gráfico com animação (`ENEMY_ANIM` em `view.ts`), 3 mapas.
- Tela de Itens (coleção) em canvas, com `save.seen`; save na conta por `user_prefs` (sem migration, `rev` maior vence).
- Hordas por tempo (`hordes.ts`), chefes com vida por `bossHp`, objetos quebráveis por mapa.

## 3. Itens novos

### 3.1 Método (obrigatório, um item por vez)

Para cada item pedido, antes de codar, escrever na seção 3.3 uma ficha com:

| Campo | Conteúdo |
| --- | --- |
| Origem no VS | nome original, tipo (arma, passivo, arcano, união), como se obtém |
| Comportamento | o que faz, alcance, padrão de ataque, o que o Poder/Alcance/Ligeireza/Sabedoria mudam nele |
| Níveis | 1 a 6 (armas) ou 1 a 5 (passivos), com o que muda em cada |
| Evolução | com qual passivo (ou qual arma, se for união), resultado, texto "Requer" |
| Ignora | quais passivos globais não afetam a arma (linha "Ignora: ..." da carta) |
| Arte | quadros do atlas do Slash a reaproveitar ou sprite novo a gerar (paleta, tamanho, frames) |
| Animação | quadros por segundo, laço, efeito de acerto, som (do Slash ou novo) |
| Equilíbrio | dano base, recarga, perfuração, comparação com as armas de hoje |

Sem ficha completa e aprovada, o item não entra.

### 3.2 Padrão de arte e animação (já combinado)

- Tudo desenhado em canvas, pixel art em escala inteira, contorno escuro, no mesmo atlas (`extra-art.ts` gera os quadros novos e eles entram no atlas estendido, nomes `X/...`).
- Animações curtas em laço (4 a 8 quadros), sempre por nome de quadro; efeitos de acerto reaproveitam `Effects/*` do Slash quando servirem.
- Ícone de 16x11 (ou 16x16) na paleta `PAL` de `extra-art.ts`, com a mesma moldura octogonal dos ícones atuais; evoluídos ganham a moldura dourada `E/*`.
- Sons: os do Slash primeiro; som novo só se o Lucas pedir (hoje as armas novas reaproveitam sons).
- Respeitar `prefers-reduced-motion` em animação decorativa fora da partida (partida segue sempre animada).

### 3.3 Fichas dos itens

Decisão do Lucas (15/11/2026): as **primeiras armas novas** vêm de mecânicas vistas nos repositórios de estudo (só a ideia, nenhuma arte, som ou código copiado) e cada uma tem **arte feita por nós no estilo do Slash**. Evoluções e uniões vêm da tabela "Evolutions & Unions" do VS que o Lucas mandou. Tamanho de ícone 16x11 na paleta `PAL`, moldura octogonal igual aos atuais; evoluídos com a moldura dourada `E/*`.

Convenções das fichas: "Ignora" lista os passivos globais que **não** afetam a arma (linha laranja da carta); números base são ponto de partida para calibrar com o robô. Ligeireza (+10% de velocidade de projétil por nível) e Alcance (+10% de tamanho por nível) valem para tudo que tem velocidade ou tamanho, a menos que a ficha diga que ignora.

#### 3.3.1 Chicote (arma, corpo a corpo, golpes em sequência)

| Campo | Conteúdo |
| --- | --- |
| Origem no VS | Whip (Chicote); evolui em Bloody Tear (Laceração Sangrenta) com Hollow Heart (Coração Vazio) |
| Comportamento | Estala para a frente e logo depois para trás, em linha reta e larga (retângulo), acertando tudo no caminho. Cada nível acrescenta **mais um corte em sequência**, com 0,12 s entre eles, alternando os lados (frente, trás, frente...). Mira para onde o jogador anda por último |
| Níveis | 1: dois cortes (frente e trás). 2: dano +30%. 3: +1 corte. 4: dano +30%. 5: +1 corte. 6: +1 corte e comprimento +20% |
| Evolução | **Laceração Sangrenta** = Chicote no 6 + **Coração** (qualquer nível), em escolha de nível ou baú. Vermelho, comprimento x2, 40% mais rápido, dano crítico (x2 em 15% dos golpes) e **absorve 1% do dano causado como vida** |
| Ignora | Ligeireza (não é projétil) |
| Arte | Quadro do corte: arco branco-azulado largo (como o rastro da espada do Slash) e versão vermelha de brasa para a evolução; ícone: chicote enrolado em laranja com contorno escuro; evoluído com gotas vermelhas |
| Animação | Corte desenhado em 5 quadros por golpe (abre, estala, some em 0,15 s), leve tremor de tela no acerto; o personagem faz o gesto de ataque do Slash |
| Som | `Weapon/Sword` do Slash com tom mais agudo; critico da evolução com o som de acerto forte |
| Equilíbrio | Dano base 3, recarga 1,4 s; no nível 6 são 4 cortes (8 acertos com dois lados) por recarga |

#### 3.3.2 Varinha Arcana (arma, projétil com alvo automático)

| Campo | Conteúdo |
| --- | --- |
| Origem no VS | Magic Wand (Varinha Mágica); evolui em Holy Wand (Santa Varinha) com Empty Tome (Diário de Caça, que reduz recarga) |
| Comportamento | Escolhe sozinha inimigos aleatórios dentro de um raio (260) e dispara um projétil rápido em cada um; **a quantidade de projéteis por salva sobe por nível** (cada projétil mira um alvo diferente quando há vários). Sem inimigo no alcance, não dispara |
| Níveis | 1: 1 projétil. 2: +1. 3: recarga -15%. 4: +1. 5: dano +40%. 6: +1 projétil e atravessa 1 inimigo |
| Evolução | **Santa Varinha** = Varinha no 6 + **Diário de Caça** (qualquer nível). Dispara sem pausa entre as salvas (recarga mínima), projéteis dourados que atravessam 2 inimigos e deixam rastro |
| Ignora | Nada (é projétil: Ligeireza, Alcance e Poder valem) |
| Arte | Projétil: bola azul-clara com cauda de 3 quadros girando; ícone: varinha com gema azul brilhando; evoluída: dourada com estrela; efeito de acerto reaproveita `Effects/PickBonus` azulado |
| Animação | A varinha aparece na mão do personagem por 0,2 s a cada salva; projétil pulsa em 4 quadros; rastro some em 0,2 s |
| Som | `Weapon/Shot` do Slash agudo |
| Equilíbrio | Dano base 2, recarga 1,2 s, alcance 260; nível 6 = 4 projéteis |

#### 3.3.3 Aura de Alho (arma, aura contínua com empurrão)

| Campo | Conteúdo |
| --- | --- |
| Origem no VS | Garlic (Alho); evolui em Soul Eater (Devorador de Almas) com Pummarola (Regeneração) |
| Comportamento | Círculo em volta do jogador que causa dano a todos dentro dele a cada 0,6 s. **Empurra** os inimigos que acerta (sistema de empurrão, seção 6.1). Cresce com os níveis |
| Níveis | 1: raio 70, dano 2. 2: raio +10%. 3: raio +15%. 4: dano +50%. 5: raio +20%. 6: empurrão forte e intervalo 0,5 s |
| Evolução | **Devorador de Almas** = Aura no 6 + **Regeneração** (qualquer nível). Aura roxa maior (raio x1,6), dano x2 e **cura 1 de vida a cada 5 inimigos atingidos** |
| Ignora | Ligeireza (não é projétil), Diário de Caça (não recarrega: é contínua) |
| Arte | Anel pulsante translúcido verde-pálido com bulbos de alho em volta, desenhado em canvas (círculo com borda dentada e partículas subindo); ícone: bulbo de alho; evoluída: anel roxo com rostos de fumaça |
| Animação | Anel "respira" (raio ±4%) e emite um pulso mais forte a cada acerto em grupo; partículas verdes sobem; no empurrão, os inimigos têm um quique curto |
| Som | `Effects/Hit` do Slash baixo e contínuo, com um som de pulso a cada ciclo |
| Equilíbrio | Dano baixo por golpe mas acerta todos ao mesmo tempo; boa para quem foge pouco |

#### 3.3.4 Poças de Magma (arma, zonas no chão)

| Campo | Conteúdo |
| --- | --- |
| Origem no VS | Santa Water (Água Benta) com ideia de poças do Anel de Magma do repositório; evolui em La Borra (Imã) |
| Comportamento | Joga um frasco de magma em pontos aleatórios perto do jogador (raio 250); cada frasco deixa uma **poça que queima por 3 s**, causando dano a cada 0,4 s a quem estiver em cima. Mais frascos e poças maiores por nível |
| Níveis | 1: 1 poça. 2: área +30%. 3: 2 poças. 4: dano +40%. 5: duração +25%. 6: 3 poças |
| Evolução | **Lava Viva** (La Borra) = Poças no 6 + **Imã** (qualquer nível). As poças deslizam lentamente por conta própria, crescem com o tempo e duram 6 s |
| Ignora | Ligeireza (a poça não voa) |
| Arte | Frasco em arco (3 quadros girando) e poça ovalada de magma laranja com bolhas, borda escura, desenhada em canvas; ícone: frasco de vidro com líquido vermelho-laranja; evoluída: poça com veios dourados e fagulhas |
| Animação | Frasco cai com sombra no chão; a poça "abre" em 0,25 s, as bolhas sobem em laço de 6 quadros e a poça encolhe nos últimos 0,5 s |
| Som | `Weapon/ThrowAxe` do Slash grave ao lançar; chiado curto ao abrir |
| Equilíbrio | Dano por tique 1,5; fica forte contra hordas que cercam o jogador |

#### 3.3.5 Círculo de Brasas (arma, bolas de fogo em órbita que aparecem e somem)

| Campo | Conteúdo |
| --- | --- |
| Origem no VS | Fire Wand / King Bible (ideia do repositório: anel de bolas de fogo que nasce e gira); evolui em Anel Infernal (união com Ligeireza) |
| Comportamento | A cada 3 s nasce um **anel de bolas de fogo** em volta do jogador, gira por 2,5 s e some. A quantidade de bolas sobe por nível, e o raio cresce um pouco enquanto gira. Diferente dos Orbes Guardiões (que ficam o tempo todo) |
| Níveis | 1: 3 bolas. 2: +1. 3: dano +30%. 4: +1. 5: duração +25%. 6: +2 |
| Evolução | **Anel Infernal** = Círculo no 6 + **Ligeireza** (qualquer nível). Dois anéis (um por dentro girando ao contrário), bolas azuladas que deixam rastro de fogo |
| Ignora | Diário de Caça não ignora (muda o intervalo); nada ignorado |
| Arte | Bola de fogo de 4 quadros (laranja, amarelo, branco) com cauda; ícone: três bolas em círculo; evoluída: anéis azul-claro |
| Animação | Bolas giram com leve oscilação; surgem com um "pop" de 2 quadros e somem encolhendo |
| Som | `Weapon/Shot` do Slash grave ao nascer |
| Equilíbrio | Dano 2 por bola, acerta cada inimigo a cada 0,4 s; boa defesa próxima, fraca contra quem atira de longe |

#### 3.3.6 O que muda nas armas atuais

- Todas ganham a linha **"Ignora: ..."** e, nas evoluídas, "Evolução do X" e "Requer: Y" na carta (seção 5.2).
- Evolução das atuais conferida contra o guia do VS (a revisar com o Lucas, uma a uma): Adagas + Ligeireza (no VS, Faca + Bracer), Machado + Armadura (hoje; no VS é Candelabro, que é o nosso Alcance), Nova Ígnea + Coração.

## 4. Bestiário

### 4.1 Tela (canvas, mesmo estilo de Itens e Conquistas)

- Entrada no início do jogo, ao lado de Itens e Conquistas.
- **Esquerda:** lista rolável numerada (`001 Morcego`, `002 Esqueleto`...), nomes dos já encontrados em branco, os já derrotados mas ainda sem leitura em amarelo, os nunca vistos como `----------------`. Cabeçalho "BESTIÁRIO: 58/180" (encontrados / total).
- **Direita:** cartão do bicho selecionado:
  - "Derrotou: N" (contador da conta).
  - Palco com o chão do mapa onde ele aparece e **o bicho animado em laço** (andando; chefes alternam andar e atacar), escala inteira.
  - Descrição curta em pt-BR com humor leve (uma ou duas frases por inimigo).
  - Estatísticas com ícone: Vida (PV), Poder (dano de contato), Velocidade, XP, Ouro; para os que atiram, a habilidade ("Arremessa machados", "Lança orbes"); Resistências quando houver.
  - "Encontra-se em:" mapas e faixa de tempo em que aparece (vem de `hordes.ts`).
- Mobile e PC: lista e cartão lado a lado quando a tela é larga; em pé, lista em cima e cartão embaixo (mesma regra de caixa expansível dos outros menus, `MENU_MAX_W`).
- Selecionar com toque, mouse, setas e Enter; rolagem por arrastar e roda.

### 4.2 Dados

- Uma entrada por inimigo de `ENEMIES` (36 hoje) mais os chefes; a ordem é a da primeira aparição na partida. Cada entrada: `id`, nome, descrição, quadro/animação (`graphicsType`), mapas, ordem.
- Estatísticas lidas direto de `ENEMIES` (vida, dano, velocidade, XP, ouro) para nunca divergir do jogo, com a vida mostrada já com o fator do mapa selecionado.
- Local: `packages/games/src/nighthunt/bestiary.ts` (dados puros, testados); desenho no web.

### 4.3 Save

- Por inimigo: `seen` (aparece na lista) e `kills` (contador). Alimentado ao fim da partida a partir do que o `NhWorld` contou (novo `killsById` no resultado) e ao ver o inimigo pela primeira vez (`seen` no meio da partida, para o bestiário abrir mesmo se a pessoa morrer cedo).
- Vai no save da conta. Atenção: `stats` no schema da API é limitado a 6.000 caracteres; com 40 entradas, usar um campo próprio `bestiary` (número de abates por id, ids curtos) e subir o schema junto, sem migration (é JSON em `user_prefs`).
- Conquistas novas: "Zoólogo" (ver todos), "Caçador de chefes" (derrotar todos os chefes), por mapa.

## 5. Evolução e uniões, como no Vampire Survivors

Referência enviada pelo Lucas: o guia "Evolutions & Unions" do VS e as fichas de item do jogo (Chicote e Laceração Sangrenta).

### 5.1 Regras

1. **Evolução (arma + passivo):** uma arma no **nível máximo**, com o **passivo certo** na mochila (em qualquer nível), pode evoluir para uma versão bem mais forte (o Chicote vira Laceração Sangrenta: vermelho, vai muito mais longe, bate mais rápido, critica e absorve vida). Exemplos do guia: Chicote + Coração Vazio, Varinha Mágica + Livro de Magia (Tomo Vazio), Faca + Bracer, Machado + Candelabro, Cruz + Trevo, Rei da Bíblia + Espinafre, entre outros.
2. **União (duas ou três armas no máximo):** coluna do meio e da direita do guia: duas armas no nível máximo (ou arma + passivo + arma) se fundem numa arma nova (ex.: Chicote + Laceração = Rosa de Sangue; Anel + Anel = União de anéis; trios com três itens no nível máximo).
3. **A evolução aparece na hora de escolher:** quando a arma chega ao máximo e o passivo está na mochila, **a próxima janela de nível entrega a evolução no lugar da melhoria dessa arma** (carta dourada com o nome novo). O baú continua entregando evolução quando aparecer primeiro (regra atual). Ao escolher, a arma antiga some e a evoluída ocupa o mesmo slot.
4. **Aviso "combina com":** na carta de qualquer item oferecido (arma ou passivo), se a pessoa **já tem** o parceiro dele, a carta mostra uma faixa "Combina com [Item]" (e, quando já está tudo no máximo, "Pronta para evoluir"). Vale nos dois sentidos: passivo oferecido que evolui uma arma que a pessoa tem, e arma oferecida cujo passivo a pessoa tem. Itens sem combinação não mostram faixa.
5. **Slot pronto:** no HUD, o slot da arma que já pode evoluir ganha moldura piscando (só `opacity`), como pista visual enquanto a evolução não chega.
6. **Itens sem evolução:** a lista "No evolutions" do guia (passivos de efeito único e itens de chão) não mostram faixa.
7. **Regra especial do guia (relíquia + nível 80):** fora do escopo agora, anotada para depois.

### 5.2 Cartas e telas (padrão das fichas do VS)

- Carta de item: nome, descrição curta, e linhas de apoio em laranja: **"Ignora: Velocidade, Duração."** (quais passivos globais não afetam aquela arma) e, nas evoluídas, **"Evolução do Chicote."** e **"Requer: Coração Vazio."**
- Ícone evoluído com a moldura dourada (`E/*`) e a arte vermelha/mais viva própria de cada evolução.
- **Guia de combinações** (tela nova ou aba em Itens), no formato do terceiro print: linhas "ARMA (MAX) + PASSIVO = EVOLUÇÃO", uniões com 2 ou 3 itens, e o bloco "Sem evolução". Itens ainda não descobertos aparecem como `?`.
- A coleção mostra a receita de cada evolução gerada pela tabela de dados (nunca texto escrito à mão).

### 5.3 Dados e motor

- `EVOLUTIONS` (`data.ts`) vira uma tabela de receitas: `{ id, kind: 'evolution' | 'union', weapons: UpgradeId[] (máximo), passives: UpgradeId[] (qualquer nível), result: EvoId }`. Hoje já existe o formato arma + passivo; a união acrescenta mais de uma arma.
- `availableEvolutions()` passa a alimentar também `drawOptions()` (janela de nível) além do baú.
- `drawOptions` marca cada opção com `combo: UpgradeId | null` (parceiro que a pessoa já tem) para a carta mostrar a faixa.
- Evento `evolve` e animação de evolução já existem (fase 2); as uniões reaproveitam, com o efeito dourado.
- Robô e simulador aprendem a perseguir receitas (priorizar o passivo parceiro da arma mais forte).
- Testes: receita certa libera a opção na janela de nível; sem o passivo não libera; união exige todas as armas no máximo; a faixa "combina com" só aparece com o parceiro na mochila; a evolução substitui a arma antiga no slot.

## 6. Sistemas novos da fase

### 6.1 Empurrão (knockback) nos inimigos

- Cada inimigo ganha um vetor de empurrão (`pushX/pushY`) e um tempo de empurrão que reduz a velocidade própria enquanto dura (0,15 a 0,3 s). Armas passam a ter `knockback` (força em px) e a força é dividida por um fator de peso por inimigo (chefes e Ent Ancião/Golem quase não saem do lugar, morcegos voam longe).
- Quem empurra: Aura de Alho (nível 6 e evoluída), Espada no acerto final do giro, evolução do Machado, Nova Ígnea evoluída. Inimigos "imunes" (chefe final) têm peso infinito.
- Animação: o inimigo desliza para trás com uma leve esticada e um quadro de poeira; sem empurrar para dentro de obstáculos (a colisão resolve primeiro).

### 6.2 Separação entre inimigos

- Quem está muito perto de outro soma uma força de afastamento (proporcional à sobreposição), como no repositório de estudo. Resultado: a horda cerca o jogador em vez de virar um bolo num ponto só, e dá para ver os bichos.
- Custo: grade espacial (células de 64 px) para só olhar os vizinhos; limite de vizinhos olhados por inimigo. Meta: 460 inimigos a 60 quadros no celular médio (medir antes e depois).
- Chefes empurram os pequenos; pequenos nunca empurram chefes.

### 6.3 Obstáculos no mapa, com colisão e tema de cada mapa

- Gerados como os objetos quebráveis (células de 420 px com hash da seed), mas **maiores, sólidos e indestrutíveis**; nunca na partida nem em cima de quebráveis; sem formar paredes que prendam o jogador (no máximo 2 obstáculos adjacentes).
- Colisão: o jogador e os inimigos deslizam em volta (círculo ou caixa pequena na base do sprite, não no sprite todo). **Projéteis, aura e poças passam por cima** (não bloqueiam armas). Perseguição simples: o inimigo contorna pelo lado mais curto.
- Temas (arte nossa, 2 a 3 variantes por mapa, ordenada por altura com os personagens):
  - **Campo Verde:** tronco caído, toco largo, pedra coberta de musgo, arbusto alto.
  - **Deserto Seco:** pedra de arenito, cacto grande, costelas de um esqueleto gigante, coluna quebrada.
  - **Planície Gelada:** bloco de gelo, árvore congelada, estátua coberta de neve.
- Animação: nenhuma por padrão, só balançar de leve (arbusto, cacto) e um brilho nos blocos de gelo; sombra no chão. Aviso sonoro nenhum.

### 6.4 Condição de vitória por mapa e modo infinito

- **Primeira vez no mapa, ou enquanto o chefe final ainda não caiu:** a partida corre normal e, num tempo fixo do mapa (proposta: Campo 15 min, Deserto 20 min, Gelo 25 min), **o chefe final do mapa aparece** (com vida pelo `bossHp`, fase de escolta e arena aberta). A partida só vira vitória quando o chefe final morre; se o jogador morrer antes, nada é concluído.
- **Ao derrotar o chefe final:** tela de vitória (nova, no estilo da de fim de jogo), prêmio em ouro maior, selo "Concluído" no mapa e nova conquista; o jogo oferece **continuar jogando** (modo infinito) ou voltar ao início.
- **Modo infinito do mapa:** só liberado **depois** de concluir o mapa. Igual ao jogo de hoje (hordas sem fim, chefe a cada 2,5 min), mas **sem o chefe final** (decidido: ele só aparece na partida de conclusão do mapa). Cada mapa guarda os **recordes** do modo infinito: maior tempo, mais abates e maior nível, mostrados na tela de mapas (e na conta).
- Cada mapa tem um **chefe final próprio**, com regra própria: Campo Verde = Golem de Pedra (o `FinalBoss` do Slash, empurrando com pisadas), Deserto Seco = Dragão Dourado maior (anel de orbes mais denso, mergulho), Planície Gelada = Golem de Cristal gigante (estilhaços em anel, fase de gelo). Arte: sprites existentes ampliados com a regra, nunca arte nova copiada.
- Save: `stats.mapsDone` (mapas concluídos) e `stats.mapRecords` (por mapa: tempo, abates, nível do infinito). A API valida o formato (campo próprio, sem migration).

### 6.5 Duas distâncias de coleta

- **Alcance de atração:** o item só começa a voar até o jogador quando entra neste raio (base 70). **Alcance de coleta:** o item só conta como pego quando entra neste raio menor (base 24, hoje é o contato do corpo).
- O passivo Pedra Atrativa/Imã aumenta o alcance de atração (+40% por nível, 5 níveis); o item Ímã de chão continua puxando tudo do mapa de uma vez.
- Opção nas configurações: "Mostrar o alcance de coleta" (círculo tracejado fino), desligado por padrão.

### 6.6 Heróis refeitos (cada um com uma arma boa que sempre tem evolução)

Regra de desenho: o herói começa com **uma arma que tem evolução e tem um papel diferente**, e uma característica pequena e clara. **Decidido (Lucas, 15/11/2026):** só o Kael começa com a Espada. Cada um dos outros heróis começa com a arma dele no lugar dela, e a Espada passa a ser uma arma comum que pode aparecer nas escolhas durante a partida.

| Herói | Preço | Arma inicial (evolução) | Característica | Por que escolher |
| --- | --- | --- | --- | --- |
| Kael, o Guerreiro | 0 | Espada (Lâmina Real, com Poder) | +20% de XP | O simples e equilibrado para aprender |
| Vesper, a Açoitadora | 600 | Chicote (Laceração Sangrenta, com Coração) | +20% de vida máxima, dano crítico pequeno desde o início | Corpo a corpo largo, ótimo contra hordas dos dois lados |
| Mara, a Caçadora | 1.200 | Varinha Arcana (Santa Varinha, com Diário de Caça) | +15% de velocidade de projétil, -10% de vida | Alcance e alvo automático para quem quer só desviar |
| Brann, o Guardião | 1.800 | Aura de Alho (Devorador de Almas, com Regeneração) | +25% de vida, -8% de velocidade | Tanque que aguenta no meio da horda |
| Dorian, o Alquimista | 2.400 | Poças de Magma (Lava Viva, com Imã) | +15% de duração de zonas e raio de atração +20% | Controle de área: encurrala os inimigos nas poças |
| Selene, a Piromante | 3.000 | Círculo de Brasas (Anel Infernal, com Ligeireza) | +12% de dano, -15% de vida | Defesa giratória de risco e dano altos |
| Ysolde, a Tempestade | 3.600 | Raio Lunar (Tempestade, com Trevo) | recarga 12% menor, -20% de vida | Dano alto em alvos aleatórios sem mirar |
| Rurik, o Lenhador | 4.200 | Machado Giratório (evolução, com Armadura) | +18% de dano, +15% de ouro | Dano em arco que atravessa tudo |

Preços **nivelados**, de 600 em 600 (600, 1.200, 1.800, 2.400, 3.000, 3.600, 4.200), na economia nova (15 vezes a do Slash). As características pequenas ficam em `HEROES` (`data.ts`), e a descrição de cada herói na carta mostra a arma inicial, a evolução e o passivo que ela pede. O robô testa cada herói com a arma inicial dele.

## 7. Etapas

1. **Bestiário** (não depende da lista de itens): dados, contagem no mundo, save e schema, tela, conquistas, testes e e2e.
   1b. **Sistemas** (seção 6): empurrão, separação, obstáculos temáticos, duas distâncias de coleta, vitória por mapa com chefe final e modo infinito com recordes.
2. **Fichas dos itens** (com a pesquisa de cada um) e aprovação do Lucas.
3. **Armas novas** (Chicote, Varinha Arcana, Aura de Alho, Poças de Magma, Círculo de Brasas) e evoluções: motor + arte + animação + som + ícones, uma por vez, com teste unitário e print; depois os **heróis refeitos** (7.6) e a revisão das evoluções antigas.
4. **Nova evolução**: motor, janela, coleção, robô.
5. **Equilíbrio** com o robô e jogando; documentação (`docs/ASSETS-NIGHTHUNT.md`, ARCHITECTURE, ROADMAP, HANDOFF) e INDEX.

## 8. Critérios de pronto

- Cada item novo tem ficha aprovada, ícone, animação em laço, descrição pt-BR, níveis e (se couber) evolução; aparece na coleção.
- Bestiário abre pelo início, mostra o bicho animado, descrição e números iguais aos de `ENEMIES`, conta abates e sincroniza com a conta.
- Testes: dados do bestiário (todo inimigo de `ENEMIES` tem entrada), contagem, schema da API, e2e da tela em celular e computador.
- Nada de lógica de jogo fora de `packages/games`; UI em pt-BR; sem emoji.

## 9. Decisões

### Respondidas pelo Lucas (15/11/2026)

- **Espada:** só o Kael começa com ela; os outros começam com a arma própria (6.6).
- **Preços dos heróis:** nivelados, 600 por degrau (6.6).
- **Chefe final:** tempos aprovados (Campo 15 min, Deserto 20, Gelo 25); **não aparece no modo infinito** (6.4).
- **Obstáculos:** tiros, armas, aura e poças **passam por cima** deles; só o jogador e os inimigos colidem (6.3).

### Ainda abertas

1. **A lista de itens** além das 5 armas desta spec (a regra de evolução já está na seção 5).
2. **Wiki do Vampire Survivors:** a rede desta sessão bloqueia `vampire-survivors.fandom.com` (e `medium.com`); libere os endereços ou cole as páginas para a pesquisa por item.
3. **Bestiário:** só os inimigos do Slash e os 15 do Dungeon Crawl, ou também bichos novos? Abre por botão novo no início (ao lado de Itens, minha sugestão) ou como aba de Itens?
4. **Evolução na janela de nível:** a evolução entra no lugar da melhoria da arma na próxima janela, e o baú continua podendo entregar também? As uniões de 3 itens entram já na primeira leva?
5. **Guia de combinações:** aba dentro de Itens (sugestão) ou tela própria?
6. **Evoluções das armas atuais** (Adagas, Machado, Nova Ígnea): conferir uma a uma com o guia do VS.
