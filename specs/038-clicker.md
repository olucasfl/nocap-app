# 038 · Aperta! (clicker no espaço)

Status: **aprovada pelo Lucas em 21/10/2026 (todas as decisões resolvidas, inclusive o conteúdo da v1).** **Etapa 1 (motor e simulador) pronta** em `packages/games/src/aperta`; números finais na seção 6.7.

Fontes de verdade: as regras ditadas pelo Lucas em 21/10/2026 (seção 2) e o design aprovado no artifact "Aperta! Espaço" (`project/Main.dc.html`, mockup para idealizar o visual; a lógica complexa é desta spec). O Lucas aprovou a paleta, os gradientes e as fontes do mockup para esta tela (seção 13); o resto das regras do projeto continua valendo.

## 1. Resumo e lore

**Aperta!** é um jogo clicker (incremental) do **Arcade**, com tema **espaço** e nomes de coisas reais (planetas, luas, estrelas, nebulosas, buracos negros). Visual limpo, realista, com toque arcade, sem exagero tecnológico. Inspirações: Click the Button e Cookie Clicker.

**Lore (história curta de 4 telas, igual ao mockup):**
1. Ano 2187. A estação **Perigeu** perdeu contato com o Sistema Solar e todos os instrumentos se apagaram.
2. Todos, menos um: um **botão vermelho** no centro da cabine, ainda aceso, esperando alguém.
3. Cada vez que você o aperta, uma estrela distante acende de volta e deixa cair **poeira estelar**.
4. Os **grimórios**, registros de quem apertou antes de você, estão espalhados pelos planetas. Aperte, e reencontre todos.

**Vocabulário do jogo** (nomes do mockup, **aprovados pelo Lucas**): **poeira estelar** (moeda), **energia** (barra que dá grimórios), **grimórios** (poderes, registros de quem apertou antes), **Melhorias**, **Álbum de grimórios**, **Atlas Eterno** (livro que sobrevive aos colapsos), **Colapsar a estrela** (rebirth), **Fragmentos** (moeda do colapso), **Árvore de Habilidades**, **objetos no espaço** (cometa, estrela cadente, satélite).

### 1.1 O que a pesquisa ensinou (resumo; só o que vale para este jogo)
- **Click the Button (LoopCap, 26/08/2026, US$ 3,99, ~89% a 94% de aprovação na Steam):** o que prende é **entrada instantânea** (um botão, sem tutorial longo), **recompensa variável a cada ação**, **duas camadas de coleção** (dinheiro e álbum) e **renascer com árvore** (o reinício vira escolha). O que reclamam: **curto demais** (100% em 1 a 3 h), **repetitivo**, sorte frustrante em item raro e **cansaço do clique**. Fontes: [Steam](https://store.steampowered.com/app/3946950/Click_the_Button/), [resenha note.com](https://note.com/inari_229/n/nc00b3a54753a?hl=en), [Click the Button Wiki](https://clickthebutton.wiki/), [conquistas](https://clickthisbutton.wiki/achievements/), [guia 100%](https://9puz.com/5287-click-the-button-100-walkthrough/).
- **Cookie Clicker:** custo exponencial (~x1,15 por unidade), prestígio com bônus permanente, evento aleatório que pede atenção (biscoito dourado), muitos marcos no começo, ganho visual a cada compra. Armadilhas: saturação e trapaça fácil sem conta. Fontes: [Game Developer](https://www.gamedeveloper.com/design/the-recipe-behind-cookie-clicker), [wiki de construções](https://cookieclicker.wiki.gg/wiki/Building), [Wikipedia](https://en.wikipedia.org/wiki/Cookie_Clicker).
- **Limite da pesquisa:** a rede da sessão bloqueou Steam, fóruns e wikis; usei resumos de busca e não li avaliações individuais.
- **Aplicação aqui:** começo muito lento (pedido do Lucas), escolha de 1 entre 3 (a variação do "baú"), álbum com itens escondidos, colapso com livro permanente (Atlas) e uma segunda camada (Ascender) para ser quase infinito; salvar na conta resolve a trapaça de salvamento local.

## 2. Regras já decididas pelo Lucas (não perguntar de novo)

- **Escopo v1:** solo, **sem Daily, ranking, histórico, perfil público, salas ou gacha**. **Convidado NÃO joga** (precisa de conta). Salva **tudo na conta**, **até 2 saves** ao mesmo tempo. **Sem renda offline** (só rende com o jogo aberto). Tela própria, estilo jogo, responsiva (celular, tablet, PC). Abre com história curta e tutorial guiado.
- **Ritmo:** começo MUITO mais lento; **sem multiplicador de cliques no começo** (combo só depois de comprar a melhoria); moedas e grimórios balanceados para demorar. Grimórios simples no começo, **só comuns nas primeiras escolhas**; raridades maiores entram aos poucos. A energia para ganhar grimório **sobe a cada escolha**.
- **Grimórios:** escolha de **1 entre 3**; raridades **comum, raro, épico, lendário, proibido**. Proibidos mudam uma regra **com preço**, dentro da lore. Álbum com grimórios **escondidos** que vão sendo descobertos. **~30 no lançamento** e crescer.
- **Rebirth:** recomeça do zero e guarda **uma página no Atlas Eterno** (60% do poder; bônus de conjunto por família; mais espaços nos rebirths **5, 10, 25 e 50**). O **primeiro rebirth leva 6 a 10 h espalhadas em vários dias**; **camada 2 (Ascender)** para ser quase infinito. Árvore de habilidades **refazível pagando**.
- **Clique acidental:** ao abrir a escolha, as cartas ficam **bloqueadas ~1,6 s** e a escolha é **em dois passos** (selecionar, depois confirmar).
- **Objetos no espaço** (cometa, estrela cadente, satélite): têm de **mostrar o que dão** e **avisar o que foi capturado**.
- **Tutorial obrigatório:** spotlight com seta, bloqueia o resto; só dá para **seguir ou pular** (aperta o botão, ganha o 1º grimório, vai a Melhorias comprar, vai a Grimórios).
- **Interface:** tudo é botão que abre uma **página temática**, com notificações e avisos.
- **Regras do projeto que valem aqui:** sem emoji; animar só `transform`/`opacity` com `prefers-reduced-motion`; código em inglês, UI em pt-BR; lógica só em `packages/games`; spec e testes no mesmo commit.

## 3. Telas (celular e PC)

Base de layout do mockup (viewport inteiro, sem scroll da página; só os painéis rolam na vertical; **nunca scroll horizontal**; alvos de toque >= 44 px).

### 3.1 Título
Céu animado, ilustração do planeta com anéis e da cabine, logo **Aperta!** (o "!" em vermelho quica). Menu: **Jogar** (abre o modal de saves), **Som: ligado/desligado**, **Voltar ao Arcade**. Celular: ilustração atrás do texto, coluna única; PC: texto à esquerda e arte à direita. Convidado que chega aqui vê **"Entre para jogar"** com o botão da conta (decisão 14.19).

### 3.2 Saves (modal "Escolha um jogo salvo")
Dois cartões lado a lado (PC) ou empilhados (celular). Cada um: **Save 1/2**; se usado, nome ("Missão Perigeu"), "N colapsos · N páginas no Atlas", "Jogado há X h", botões **Continuar** e **Apagar** (2 passos, decisão 14.13); se vazio, **Novo jogo**. **Voltar** fecha.

### 3.3 História (4 telas)
Ilustração SVG por tela (estação, botão, estrela acendendo, planetas), texto que sobe com `transform`/`opacity`, pontos de progresso, **Continuar** e **Pular história**. Só no **primeiro** jogo de cada save (depois, só o tutorial se não concluído).

### 3.4 Jogo (tela limpa)
- **Topo (HUD):** painel com **poeira** (número grande, "pulo" ao ganhar) e **colapsos**; chip **"Sinal forte x2"** com barra de tempo quando o satélite está ativo; botão **Árvore de Habilidades** com selo de Fragmentos disponíveis (some até o 1º colapso).
- **Centro:** o **botão vermelho** sobre a base metálica, com sombra, brilho, onda (anel) e faíscas ao tocar, número "+N" que sobe, e o **combo** (depois da melhoria). Alvo >= 120 px (cresce até ~330 px).
- **Direita:** barra vertical de **Energia** ("N/máx"), que fica em destaque a partir de 85%.
- **Objetos no espaço** flutuam na área do centro (seção 4.5).
- **Rodapé (dock):** **Conquistas** (troféu), **Grimórios** (livro, selo "!" se há novo) e **Melhorias** (botão grande, selo com quantas dá para comprar). Tocar de novo no mesmo botão fecha a página.
- **Avisos (pickup):** faixa no topo por ~2,3 s ("Cometa capturado: +N poeira", "Novo grimório: ...").

### 3.5 Páginas (abrem entre o HUD e o dock, largura máx. 900 px, rolagem vertical)
Todas têm cabeçalho com ícone, título e **X**, e uma faixa de aviso.
- **Melhorias:** lista de cartões (planeta-ícone, nome, descrição com o ganho, "nível N", botão com preço; cinza se não dá). Aviso: "Você pode comprar N melhorias agora." Mostrar o **ganho da próxima compra** ("+1 poeira por toque: 4 -> 5").
- **Grimórios:** "N de 30 descobertos"; grade de **livros** (2 colunas no celular, 4 a partir de 1000 px) com cor por raridade, medalha com a arte, plaquinha, gemas (1 a 5), nível; escondidos aparecem **trancados** ("???", "Ainda escondido no espaço"). Embaixo, o **Atlas Eterno** (espaços de página, família de cada uma, bônus de conjunto ativos) e o botão **Colapsar a estrela**.
- **Conquistas:** lista com ícone, nome, descrição, barra e "N/M".
- **Árvore de Habilidades:** 2 colunas (1 no celular) de nós por ramo; custo em Fragmentos; botão **Refazer árvore** (devolve os Fragmentos gastos menos 20%, seção 8.3). Aviso: "Os ramos se abrem depois do seu primeiro colapso."

### 3.6 Modais
- **Primeiro grimório** (tutorial): livro da Lua com brilho, explicação, **Entendi**.
- **Escolha de grimório ("A energia transbordou"):** 3 livros (3 colunas no PC; no celular, uma coluna com o livro à esquerda e o texto à direita), barra "Aguarde um instante..." de 1,6 s (cartas bloqueadas), toque **seleciona** (contorno ciano, sobe), botão **Escolher este grimório** (desligado até haver seleção e passar o bloqueio). Dica: "Pegar o mesmo de novo sobe o nível dele."
- **Colapsar a estrela:** explica o que fica e o que sai; escolha **uma** página do Atlas entre os grimórios da vida; mostra os Fragmentos que ganha; **Colapsar** e **Voltar** (confirmação em 2 passos, e só aparece quando a estrela está pronta, seção 8).

## 4. Loop e regras do jogo

### 4.1 Toque
Cada toque no botão (clique, toque, Espaço ou Enter) dá **poeira** e **energia**. Segurar Espaço/Enter **repete** a no máximo 6 toques/s (decisão 14.20). Dedos múltiplos contam como toques separados, com o mesmo teto de 12/s no total por segurança.
**O save novo começa com 0 de poeira e o 1º toque dá exatamente 1** (a primeira melhoria custa 25, então são 25 toques).
`poeira por toque = (1 + nível do Pulso Solar + 5 x nível do Webb + números dos grimórios) x (1 + % do Atlas e da árvore) x combo x sinal`, arredondado para baixo com mínimo 1. Os grimórios somam **números** (+0,5 por toque, +1...), não percentuais (5.2).
`energia por toque = (1 + 0,25 x nível do Reator de Aldebarã) x Atlas e árvore` mais as bonificações de situação dos grimórios (valores na seção 6).
**Ganho passivo:** `poeira por segundo = 1 x nível do Telescópio Hubble`, só com o jogo aberto, sem escolha aberta e sem a aba escondida.

### 4.2 Energia e escolha de grimório
A barra enche até o **limite do passo atual**: **38, 80, 150, 260, 420, 640** de energia nas seis primeiras escolhas (1 de energia por toque no início) e depois cresce `x1,35` a cada escolha. O 1º passo fecha com **~50 de poeira ganha** (25 toques, a 1ª melhoria de 25 e ~13 toques de 2 de poeira): a dinâmica é "1ª melhoria, depois o 1º grimório". As barras do começo ficam bem mais curtas que as da calibragem anterior (60, 90, 130... a 0,25 de energia por toque, ou seja 240, 360, 520... toques). Ao encher, abre a **escolha de 1 entre 3 grimórios** (seção 4.3). Toques durante a escolha **não contam** (modal aberto). Depois de escolher, a energia volta a zero.

### 4.3 Sorteio dos 3 grimórios
Sem repetir carta na mesma oferta, com **pesos por raridade que liberam aos poucos** (nº de escolhas já feitas `n`):

| Raridade | Peso | Libera em |
| --- | --- | --- |
| Comum | 100 | sempre (as 3 primeiras escolhas só têm comuns) |
| Raro | 24 | `n >= 3` |
| Épico | 9 | `n >= 8` |
| Lendário | 3 | `n >= 14` |
| Proibido | 1 | `n >= 22` e a condição própria do grimório |

Escolher um grimório que já se tem **sobe o nível dele** (efeito x `1 + 0,5 x (nível - 1)`, nível máx. 10). O sorteio usa o gerador com seed do save (determinístico e testável).

### 4.4 Combo
**Só existe depois de comprar a Ressonância de Vênus.** Cada toque dentro da janela (1,3 s + 0,2 s por nível) soma +1 de combo; cada ponto vale +20% de poeira; máximo 3 (+1 por nível do Alinhamento das Plêiades). O combo cai ao passar a janela. Mostra "COMBO x1,6" sob o botão.

### 4.5 Objetos no espaço
**Raros e fracos no começo (reformulação de 22/10/2026).** **Nada aparece antes da 1ª melhoria da vida** (`objectsOpen(state)`; depois do 1º colapso já abrem). Aparecem no campo a cada **32 s** (cada nível da Sonda Kepler tira 3 s, piso de 4 s), **1** na tela por vez (2 com a Kepler), duram **7 s** (+0,5 s por nível do Chandra) e mostram uma **barra de vida**, **anel pulsante** e uma **etiqueta com a recompensa** antes de tocar. Não aparecem no tutorial, em modais nem com o jogo pausado. Ao capturar: anel que se expande, texto flutuante e faixa **"<Objeto> capturado: <efeito>"**. Também funcionam por teclado (cada um é um botão com `aria-label`).

| Objeto | Efeito | Valor inicial | O que melhora |
| --- | --- | --- | --- |
| **Cometa** (mais comum) | poeira instantânea | **6 toques** de poeira | Vênus +3, Sedna +15, Hale-Bopp +10, Halley, Plutão, Antares (+1, +2, +4) |
| **Estrela cadente** | energia instantânea | **2 toques** de energia | Marte +2, Encélado +4 e os "todo objeto" |
| **Satélite** | "Sinal forte": poeira x2 | por 8 s, com contagem no HUD | Voyager (+1 s por nível), Io (+0,5) e Netuno (+1) no multiplicador, Calisto (+4 toques de poeira ao capturar) |

Sorteio: cometa 50%, estrela 25%, satélite 25%. Nada pune quem não pega. Antes: 9 s entre objetos, 2 na tela e cometa de 20 toques, o que dava um quarto da renda logo no começo.

### 4.6 Tutorial guiado (obrigatório, só seguir ou pular)
Véu escuro sobre tudo, **spotlight** no elemento certo (brilho que pulsa em `opacity`), **seta** "Toque aqui" e um cartão de coach no topo ("Tutorial · passo N de 5", título, texto, **Pular tutorial**). Todo o resto fica bloqueado e esmaecido (inclusive o X das páginas).
1. **Aperte o botão:** o primeiro toque ganha poeira e abre o **Primeiro grimório** (sempre **Lua**).
2. **Entendi** fecha o modal e entrega poeira suficiente para a 1ª compra.
3. **Hora de melhorar:** seta no botão **Melhorias**.
4. **Compre sua primeira melhoria:** seta no preço do **Pulso Solar** (as outras linhas ficam bloqueadas).
5. **Agora os grimórios:** seta no ícone de livro; a página mostra o álbum, o trancado e o Atlas; botão **Começar a jogar**.
Pular marca o tutorial como feito no save. O progresso do tutorial é salvo (voltar no meio retoma no passo).

*Como ficou (etapa 8):* o passo vai em `SaveState.tutorial` (1 a 5 ou `'done'`; sem campo novo, saves antigos seguem válidos; save com toques e passo 1 vem de antes do tutorial e abre como concluído). O véu são quatro faixas ao redor do alvo (o alvo fica tocável, o resto recebe o toque e não faz nada), cliques e Enter/Espaço em botões de fora e os atalhos G, M e Esc também são barrados, e o motor recusa toque fora do passo 1 e compra que não seja o Pulso Solar no passo 4. O cartão vai para baixo quando o alvo está na metade de cima da tela. Retomar no passo 4 ou 5 sem a página aberta aponta de volta ao botão da dock. Cada passo guarda a cópia do aparelho na hora (`store.stage`) e sobe em seguida. O Aperta! não sorteia objetos no tutorial (`tutorialActive(state)` em `packages/games`, para a etapa 7).

### 4.7 Proteção contra clique acidental
- Escolha de grimório: **cartas bloqueadas por 1,6 s** (barra de contagem) e **2 passos** (selecionar, depois confirmar).
- **Colapsar** e **Apagar save** também em 2 passos.
- Ao abrir um modal com o dedo ainda no botão: toques ignorados nos primeiros 300 ms.
- Botão sem saldo mostra "falta N" e não compra; nunca compra por clique duplo acidental (ignora o 2º toque em 250 ms).

## 5. Melhorias, grimórios e conquistas (catálogo)

### 5.1 Melhorias (poeira; poder básico contínuo; liberação progressiva)
**Reformulação de 22/10/2026 (pedido direto do Lucas, sobrepõe o que a spec dizia antes).** Melhoria e grimório **não competem**: a melhoria é o **poder básico contínuo** (poeira por toque, ganho passivo, energia por toque, o combo em si, o ritmo e a duração dos objetos); o grimório é **estilo e situação** (5.2). Cada melhoria declara os **domínios** que controla (`UpgradeDef.domains`) e `catalog.test.ts` exige que nenhum grimório use um desses domínios.

**Liberação progressiva.** No começo existe **só a 1ª melhoria** (Pulso Solar, **25 de poeira**). As outras aparecem **"em breve"** com a condição escrita, e abrem por **marco**: **poeira total ganha na vida** OU **nível de outra melhoria** (o que vier primeiro). Uma melhoria pode estar **aberta e cara**: o jogador evolui para alcançá-la (a página mostra "Falta N"). Depois do 1º colapso as melhorias já conhecidas abrem no início de cada vida (o marco só vale na 1ª). Pelo motor: `upgradeUnlocks(state)` devolve, na ordem do catálogo, `{ unlocked, hidden, lock }` com a condição (`milestone`, `requires` ou `collapse`); `upgradeLock(state, i)` e `upgradeAvailable(state, i)` fazem o mesmo para uma só.

**Preço.** `custo(nível) = base x g^nível`, com **g ≈ 1,12 a 1,3 nas primeiras compras** (Pulso: 25, 28, 31, 35, 39...) e um trecho **íngreme** depois (`steep`: ×1,5 a ×1,7 por nível, porque o ganho é linear e o preço exponencial). As seguintes custam **bem mais** que a primeira (base de 150 a 1,5 mi).

| # | Melhoria | Efeito por nível | Base | Cresce | Máx. | Libera (poeira da vida OU nível) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Pulso Solar** | +1 poeira por toque | 25 | x1,12; x1,7 depois do nível 5 | 40 | início |
| 2 | **Ressonância de Vênus** | nível 1 **liga o combo**; depois, cada ponto de combo soma +0,05 ao toque | 150 | x1,35 | 5 | 100 ou Pulso 4 |
| 3 | **Reator de Aldebarã** | +0,25 de energia por toque | 400 | x1,3; x1,7 depois do nível 3 | 20 | 300 ou Pulso 8 |
| 4 | **Alinhamento das Plêiades** | combo máx. +1 (exige a Ressonância) | 1.500 | x1,9 | 5 | 1 mil ou Ressonância 2 |
| 5 | **Sonda Kepler** | objetos aparecem 3 s mais cedo; o nível 1 abre mais um lugar no campo | 4.000 | x1,9 | 5 | 2,5 mil ou Reator 4 |
| 6 | **Telescópio Hubble** | **+1 poeira por segundo** sem tocar (ganho passivo) | 800 | x1,3; x1,7 depois do nível 4 | 30 | 600 ou Pulso 10 |
| 7 | **Voyager** | satélites duram +1 s | 12.000 | x1,7 | 8 | 8 mil ou Kepler 2 |
| 8 | **Observatório James Webb** | +5 poeira por toque | 120.000 | x1,45 | 20 | colapso 1 |
| 9 | **Telescópio Chandra** | objetos ficam +0,5 s no campo | 300.000 | x1,6 | 10 | colapso 3 |
| 10 | **Observatório Gaia** | a carta mostra o efeito | 1,5 mi | x1,5 | 1 | colapso 5 |

O Webb deixou de reduzir o custo (isso é efeito de grimório: Ceres, Saturno e M87*) e passou a somar poeira por toque; o Hubble deixou de valorizar objetos (isso é do Antares, Plutão...) e passou a render poeira por segundo; a Kepler, o Voyager e o Chandra ficaram com o **ritmo e a duração** dos objetos. Passivo: o ganho por segundo só corre com o jogo aberto, sem escolha aberta e sem a aba escondida (7.4).

### 5.2 Grimórios (40 no catálogo; **lista aprovada pelo Lucas**, efeitos reformulados em 22/10/2026)
A família define o **bônus de conjunto** do Atlas (seção 8.2). Cada grimório é **dado** (id, nome, plaquinha, raridade, família, efeito, arte), montado só com as primitivas da seção 7.3. **Arte:** livro com cor por raridade (comum cinza-azul, raro azul com borda ciano, épico roxo com dourado e anel girando, lendário dourado que flutua, proibido preto com rachadura vermelha) e uma **medalha** redonda com o astro em SVG (esfera com sombreamento radial).

**Os efeitos são em NÚMEROS, não em %** (pedido do Lucas): "+0,5 poeira por toque", "+2 de energia", "+3 toques de poeira", "+0,5 s". Só ficam como fator os multiplicadores sem outra forma ("o toque vale o dobro", "x3", "x5") e as trocas dos proibidos (M87* mantém o desconto de 30% e o preço de +25%). **Nível por repetição:** cada nível soma **metade do número base** (um "+0,5" vira +0,75 no nível 2, +1 no 3... até o 10); efeitos de contagem (trocar carta, escolher 2) não crescem. A página do Atlas guarda 60% do número.

**Grimório não repete melhoria.** A melhoria é o poder básico contínuo (poeira por toque, por segundo, energia por toque, combo e ritmo/duração dos objetos); o grimório é **estilo e situação**: toques especiais (a cada N toques), bônus com o **combo no máximo**, **janela** do combo, **recompensa** dos objetos e do sinal, o que acontece **ao capturar**, **sorte** (trocar, escolher 2, subir de nível), poeira inicial, devolução na compra e escala por coleção/colapsos. Efeitos que só duplicavam uma melhoria (+% de poeira ou de energia por toque, combo máximo, objetos mais rápidos ou que duram mais, melhorias mais baratas) foram trocados por uma versão de situação, por exemplo "+5% de poeira por toque" virou "com o combo no máximo, +0,5 poeira por toque". Os exemplos do pedido em formato de melhoria ("+2 poeira por segundo", "+1 de energia por toque") ficaram **com a melhoria** (Hubble, Reator) e a versão do grimório exige uma condição. `catalog.test.ts` lista os domínios de efeito das melhorias e dos grimórios e **garante que não coincidem**.

**Comuns (13)**
| Grimório | Família | Efeito | Libera | Arte |
| --- | --- | --- | --- | --- |
| Lua | Luas | A cada 10 toques, o toque vale o dobro | início | esfera cinza clara com crateras |
| Mercúrio | Planetas | A cada 5 toques, +2 de energia | início | esfera marrom-cinza, crateras pequenas |
| Vênus | Planetas | Cometas dão +3 toques de poeira | início | esfera creme-dourada com faixas de nuvem |
| Marte | Planetas | Estrelas cadentes dão +2 toques de energia | início | esfera ferrugem com calota polar branca |
| Ceres | Pequenos corpos | Cada melhoria comprada devolve a poeira de 2 toques | início | rocha cinza com ponto brilhante |
| Fobos | Luas | Cada objeto capturado dá a energia de 1 toque | início | rocha irregular com uma cratera grande |
| Io | Luas | O sinal dos satélites vale x2,5 em vez de x2 | início | esfera amarelo-enxofre com manchas vermelhas |
| Vesta | Pequenos corpos | Com o combo no máximo, +0,5 poeira por toque | início | rocha clara com faixa escura |
| Halley | Pequenos corpos | Todo objeto vale +1 toque a mais | início | núcleo claro com cauda azul |
| Urano | Planetas | A janela do combo dura +0,2 s | início | esfera ciano-gelo com anel fino vertical |
| Palas | Pequenos corpos | Com o combo no máximo, +0,25 de energia por toque | colapso 1 | rocha acinzentada com sulcos |
| Hygiea | Pequenos corpos | A cada 8 toques, +3 de energia | colapso 1 | esfera escura quase redonda |
| Haumea | Pequenos corpos | A janela do combo dura +0,3 s | colapso 3 | elipsoide branco com anel |

**Raros (13)**
| Grimório | Família | Efeito | Libera | Arte |
| --- | --- | --- | --- | --- |
| Europa | Luas | A janela do combo dura +0,5 s | início | esfera branca com rachaduras marrons |
| Titã | Luas | Cada vida começa com 200 de poeira | início | esfera laranja com névoa |
| Júpiter | Planetas | A cada 10 toques, o toque vale o triplo | início | esfera com faixas marrons e a grande mancha vermelha |
| Saturno | Planetas | Cada melhoria comprada devolve a poeira de 5 toques | início | esfera dourada com anéis inclinados |
| Netuno | Planetas | O sinal dos satélites vale x3 em vez de x2 | início | esfera azul-profundo com faixa branca |
| Ganimedes | Luas | Com o combo no máximo, +0,5 de energia por toque | início | esfera cinza com sulcos claros |
| Plutão | Pequenos corpos | Todo objeto vale +2 toques a mais | início | esfera bege com "coração" claro |
| Tritão | Luas | Cada objeto capturado dá a energia de 3 toques | início | esfera rosada com calota de gelo |
| Calisto | Luas | Satélites capturados dão +4 toques de poeira | colapso 2 | esfera cinza-marrom com crateras claras |
| Encélado | Luas | Estrelas cadentes dão +4 toques de energia | colapso 2 | esfera branca com jatos de gelo |
| Éris | Pequenos corpos | Asteroides dão +6 toques de poeira | colapso 3 | esfera clara com lua pequena |
| Hale-Bopp | Pequenos corpos | Cometas dão +10 toques de poeira | colapso 4 | núcleo com duas caudas, azul e branca |
| Proxima Centauri | Estrelas | Com o combo no máximo, +1 poeira por toque | colapso 5 | anã vermelha com chama pequena |

**Épicos (8)**
| Grimório | Família | Efeito | Libera | Arte |
| --- | --- | --- | --- | --- |
| Sirius | Estrelas | Com o combo no máximo, +2 poeira por toque | início | estrela branca de 4 pontas com halo azul |
| Vega | Estrelas | Cada grimório comum no livro soma +0,5 poeira por toque | início | estrela branco-azulada de 8 raios |
| Betelgeuse | Estrelas | Troque 1 das opções (1 vez por escolha) | início | gigante laranja com manchas |
| Polaris | Estrelas | O toque depois de capturar um objeto vale x5 | início | estrela azul-branca com halo fino |
| Antares | Estrelas | Todo objeto vale +4 toques a mais | início | gigante vermelha com brilho |
| Nebulosa do Caranguejo | Nebulosas e galáxias | Grimório repetido sobe 2 níveis | início | filamentos laranja e azuis |
| Sedna | Pequenos corpos | Cometas dão +15 toques de poeira | colapso 4 | esfera vermelho-escura distante |
| Alfa Centauri A | Estrelas | A cada 25 toques, o toque vale x6 | colapso 5 | estrela amarela com halo dourado |

**Lendários (3)**
| Grimório | Família | Efeito | Libera | Arte |
| --- | --- | --- | --- | --- |
| Nebulosa de Órion | Nebulosas e galáxias | Ao encher a energia, escolha 2 grimórios | início | nuvem rosa, turquesa e violeta com estrelas |
| Via Láctea | Nebulosas e galáxias | Cada grimório raro no livro soma +1 poeira por toque | início | galáxia espiral de 4 braços |
| Andrômeda | Nebulosas e galáxias | Cada colapso já feito soma +1 poeira por toque | início | espiral inclinada com núcleo claro |

**Proibidos (3)**
| Grimório | Família | Efeito | Libera | Arte |
| --- | --- | --- | --- | --- |
| Sagitário A* | Buracos negros | Poeira por toque x3, mas a energia por toque cai para x0,3 | início | disco de acreção dourado ao redor de círculo preto |
| Cygnus X-1 | Buracos negros | Com o combo no máximo, a poeira vale x2 e a janela dura o dobro, mas os objetos no espaço param de aparecer | colapso 3 | buraco negro com estrela azul companheira |
| M87* | Buracos negros | Melhorias custam 30% menos, mas cada energia para o próximo grimório custa +25% | colapso 5 | buraco negro com jato de luz |


Famílias: **Planetas 7 · Luas 7 · Pequenos corpos 4 · Estrelas 5 · Nebulosas e galáxias 4 · Buracos negros 3** nos 30 iniciais; os 10 dos colapsos 1 a 5 vêm na 5.4. Livros escondidos aparecem como "???" com a medalha de cadeado até a descoberta.

### 5.3 Conquistas (~24 no lançamento, mais ~2 por colapso, ver 5.4)
Cada uma com ícone, barra de progresso e "N/M"; ao ganhar, faixa de aviso (`transform`/`opacity`). Sem recompensa de poder na v1 (decisão 14.16).
- **Toques:** Primeiro toque (1), 100, 1.000, 10.000, 100.000 toques.
- **Poeira:** juntar 1 mil, 1 mi, 1 bi (na vida e no total).
- **Grimórios:** Colecionador de planetas (10 descobertos), 20 descobertos, os 30, um de cada raridade, a primeira vez em cada nível 5 e 10.
- **Objetos:** Caçador de cometas (20), 100, 500 capturados; capturar 10 satélites em sequência.
- **Combo:** chegar ao combo máximo; manter 30 s.
- **Colapsos:** Horizonte de eventos (pegar um grimório proibido), colapsar 1, 5, 10, 25 e 50 vezes; Atlas com todas as famílias.
- **Árvore:** comprar o 1º nó; completar um ramo.
- **Escondida:** uma conquista surpresa (por exemplo, apertar o botão no título sem entrar).

### 5.4 Conteúdo por colapso (cada colapso traz coisas novas, não só números)
Cada colapso **destrava conteúdo novo para a vida seguinte**: uma **região do espaço** (cenário próprio), **2 grimórios novos**, e mais um ou dois itens entre objetos, melhorias, mecânicas, eventos e conquistas. Tudo com nomes de astros reais, dentro da lore (a estação Perigeu segue o sinal das estrelas até o Horizonte de Eventos) e **orientado a dados**: cada linha da tabela é um registro no catálogo e cabe numa etapa pequena. Ao colapsar, o jogo mostra a **faixa "Novo no espaço"** com o que chegou.

**Totais do catálogo completo (colapsos 0 a 15):**
| Tipo | Lançamento (v1, colapsos 0 a 5) | Total (colapso 15) |
| --- | --- | --- |
| Grimórios | **30** + 10 novos = **40** (proibidos Cygnus e M87* chegam nos colapsos 3 e 5) | **60** |
| Regiões (cenários) | 6 (início + colapsos 1 a 5) | **16** |
| Objetos no espaço | 3 + 2 = 5 | **8** |
| Melhorias | 8 + 2 = 10 | **14** |
| Mecânicas simples | 3 | **6** |
| Eventos | 2 | **6** |
| Conquistas | ~24 + 10 = ~34 | ~54 |

**Grimórios novos (30; entram 2 por colapso, na tabela abaixo). Efeitos só com as primitivas da 7.3; arte = medalha SVG do astro.**
| Colapso | Grimório (raridade, família) | Efeito |
| --- | --- | --- |
| 1 | Palas (comum, Pequenos corpos) | objetos duram +1,5 s |
| 1 | Hygiea (comum, Pequenos corpos) | +8% de energia por toque |
| 2 | Calisto (raro, Luas) | satélites dão x2,5 em vez de x2 |
| 2 | Encélado (raro, Luas) | estrela cadente dá +50% de energia |
| 3 | Éris (raro, Pequenos corpos) | objetos valem +10% |
| 3 | Haumea (comum, Pequenos corpos) | janela do combo +10% |
| 4 | Sedna (épico, Pequenos corpos) | objetos aparecem 20% mais rápido |
| 4 | Hale-Bopp (raro, Pequenos corpos) | cometas duram o dobro |
| 5 | Proxima Centauri (raro, Estrelas) | +8% de poeira por toque |
| 5 | Alfa Centauri A (épico, Estrelas) | todo 25º toque vale x6 |
| 6 | Sirius B (épico, Estrelas) | combo máximo +1 e +10% de energia |
| 6 | Canopus (raro, Estrelas) | melhorias custam 6% menos |
| 7 | Alcíone (raro, Estrelas) | +1 objeto máximo na tela |
| 7 | Maia (comum, Estrelas) | +5% de poeira por toque com o combo cheio |
| 8 | Rigel (épico, Estrelas) | +12% de poeira e +6% de energia por toque |
| 8 | Trapézio de Órion (raro, Nebulosas e galáxias) | grimórios comuns valem +15% |
| 9 | Pulsar do Caranguejo (épico, Estrelas) | todo 50º toque dá +5% da barra de energia |
| 9 | Cabeça de Cavalo (raro, Nebulosas e galáxias) | satélites também dão +5% de energia |
| 10 | Omega Centauri (épico, Nebulosas e galáxias) | melhorias custam 4% menos por grimório diferente ativo (até 20%) |
| 10 | Pilares da Criação (lendário, Nebulosas e galáxias) | estrelas cadentes enchem +25% da barra |
| 11 | Grande Nuvem de Magalhães (lendário, Nebulosas e galáxias) | cada grimório diferente descoberto dá +0,5% de poeira por toque (máx. +15%) |
| 11 | SN 1987A (épico, Estrelas) | 3 objetos capturados em sequência: o próximo toque vale x10 |
| 12 | Quasar 3C 273 (épico, Buracos negros) | +25% de poeira por toque com o combo cheio |
| 12 | Galáxia do Triângulo, M33 (lendário, Nebulosas e galáxias) | +10% de poeira e de energia por família com 2+ grimórios ativos (máx. +40%) |
| 13 | Galáxia do Sombrero (lendário, Nebulosas e galáxias) | páginas do Atlas valem 70% em vez de 60% |
| 13 | Aglomerado de Virgem (lendário, Nebulosas e galáxias) | escolhas mostram 4 cartas |
| 14 | Grande Atrator (lendário, Nebulosas e galáxias) | o objeto mais próximo é capturado sozinho a cada 40 s |
| 14 | TON 618 (**proibido**, Buracos negros) | poeira por toque x6, **mas a energia enche 85% mais devagar** |
| 15 | Horizonte de Eventos (lendário, Buracos negros) | bônus de conjunto de todas as famílias +50% |
| 15 | Phoenix A (**proibido**, Buracos negros) | cada colapso feito dá +10% de poder total, **mas melhorias custam +40%** |

**Tabela dos 15 colapsos: o que cada um destrava** (o colapso 0 é o início do jogo).
| Colapso | Região nova (cenário) | Grimórios | Objeto, melhoria ou mecânica | Evento ou conquista | Entra em |
| --- | --- | --- | --- | --- | --- |
| 0 (início) | **Sistema Solar interno** (cabine Perigeu; Mercúrio a Marte ao fundo) | os 30 iniciais (os não proibidos) | Cometa, Estrela cadente, Satélite; 5 melhorias base | conquistas básicas (24) | v1 |
| 1 | **Cinturão de Asteroides** (rochas girando em camadas, tom marrom) | Palas, Hygiea | objeto **Asteroide** (poeira e um pouco de energia, lento); melhoria **Observatório James Webb** | conquista "Primeira estrela colapsada" | v1 |
| 2 | **Júpiter e Saturno** (planetas grandes e anéis ao fundo) | Calisto, Encélado | objeto **Sonda Voyager** (próxima escolha ganha 1 troca grátis); mecânica **Favorito** (marca 1 grimório para pesar x2 no sorteio) | evento **Chuva de meteoros** (15 s de estrelas cadentes) | v1 |
| 3 | **Cinturão de Kuiper** (gelo azulado, Plutão ao longe) | Éris, Haumea + libera **Cygnus X-1** (proibido) | melhoria **Telescópio Chandra** (objetos +% de duração) | conquista "Pegar um proibido" | v1 |
| 4 | **Nuvem de Oort** (bolhas de gelo, tom violeta escuro) | Sedna, Hale-Bopp | mecânica **Missões da estação** (1 objetivo por vida, dá Fragmentos extras) | evento **Tempestade solar** (15 s de energia x2) | v1 |
| 5 | **Alfa Centauro** (3 sóis, planeta Proxima b) | Proxima Centauri, Alfa Centauri A + libera **M87\*** (proibido) | melhoria **Observatório Gaia** (sorteio mostra o efeito já na carta) | conquistas "Atlas com 4 páginas" e "Saí do Sistema Solar" | v1 |
| 6 | **Sirius** (estrela azul-branca e anã companheira) | Sirius B, Canopus | objeto **Pulsar** (próximos 10 toques x3) | conquista "10 pulsares" | v1.1 |
| 7 | **Plêiades** (aglomerado azul com nebulosidade) | Alcíone, Maia | mecânica **Combo de objetos** (2 objetos em 3 s dão bônus) | evento **Eclipse** (a cada ~10 min, 20 s de poeira x2) | v1.1 |
| 8 | **Nebulosa de Órion** (nuvens rosa e turquesa) | Rigel, Trapézio de Órion | melhoria **Telescópio Spitzer** (+energia por toque) | conquista "Todos os grimórios de Estrelas" | v1.1 |
| 9 | **Nebulosa do Caranguejo** (filamentos laranja e azuis, pulsar) | Pulsar do Caranguejo, Cabeça de Cavalo | objeto **Supernova** (poeira grande e energia grande, raro) | evento **Supernova próxima** (objetos raros por 20 s) | v1.1 |
| 10 | **Via Láctea** (núcleo galáctico e braço espiral) | Omega Centauri, Pilares da Criação | melhoria **LIGO** (ondas gravitacionais: combo máx. +1 por nível) | evento **Alinhamento galáctico** (combo máx. +2 por 30 s); conquista "10 colapsos" | v1.1 |
| 11 | **Grandes Nuvens de Magalhães** (duas galáxias-anãs) | Grande Nuvem de Magalhães, SN 1987A | mecânica **4ª carta** (ver uma carta extra na escolha, 1 vez por vida) | conquista "Todas as regiões da Via Láctea" | v1.2 |
| 12 | **Andrômeda** (galáxia espiral enorme se aproximando) | Quasar 3C 273, Galáxia do Triângulo (M33) | objeto **Quasar** (x3 por 6 s, raro) | evento **Passagem do cometa Halley** (cometas grandes por 20 s) | v1.2 |
| 13 | **Aglomerado de Virgem** (centenas de galáxias, tom dourado) | Galáxia do Sombrero, Aglomerado de Virgem | mecânica **Captura automática** (a Perigeu pega 1 objeto a cada 60 s) | conquista "Todas as famílias com 2 páginas" | v1.2 |
| 14 | **Grande Atrator** (fluxo de galáxias, tom vermelho) | Grande Atrator, TON 618 (proibido) | melhoria **Event Horizon Telescope** (+% de poder dos proibidos) | evento **Maré gravitacional** (objetos atraídos para o botão por 15 s) | v1.2 |
| 15 | **Horizonte de Eventos** (buraco negro com disco, fim da viagem) | Horizonte de Eventos, Phoenix A (proibido) | **desbloqueia o Ascender** (8.4) | conquista "Estrela final" e final da história | v1.2 (Ascender: depois da v1, etapa 16) |

- **Regiões:** cada uma é um **tema de cenário** em dados (cores do céu, 2 a 3 camadas de decoração em SVG que se movem só em `transform`, ilustração do fundo, cor do brilho do botão). Mudam a cada colapso; a região fica no save (`regionId`) e dá para **rever as já abertas** no menu de regiões do HUD (sem custo).
- **Ordem do jogo:** todo o conteúdo de um colapso entra **no mesmo release**; o jogador vê só o que o colapso atual já abriu (os demais grimórios aparecem como "???" no álbum, e o total "N de 60" cresce a cada colapso).
- **Lançamento (v1) = colapsos 0 a 5.** O que vem depois chega por atualização: **v1.1** (colapsos 6 a 10) e **v1.2** (colapsos 11 a 15). Se o jogador passar do colapso 5 antes de v1.1, os colapsos seguintes só dão Fragmentos e Atlas (sem novidade), com aviso "Mais espaço chegando". **Recomendação, ainda por confirmar** (decisão 21).

## 6. Economia e balanceamento

### 6.1 Metas de duração
- **1º colapso: 6 a 10 horas de jogo aberto, espalhadas em vários dias** (sem renda offline). Uma sessão boa tem 20 a 40 min.
- **Cada colapso seguinte é MAIS RÁPIDO que o anterior** (decisão do Lucas): a vida encurta por causa das páginas do Atlas, da árvore e do conteúdo acumulado. A **tabela-alvo dos 15 colapsos está na seção 6.6**; o 1º segue o mais longo (8 h), o 15º chega ao piso de ~1,2 h.
- **Ascender (camada 2):** libera **depois de 15 colapsos** (decisão do Lucas), "quase infinito" depois disso; **fora da v1** (decidido pelo Lucas; etapa 16, 8.4).
- Primeira escolha de grimório: **~2 a 4 min** de jogo (para o jogador ver a graça antes de enjoar); as escolhas seguintes se espaçam (seção 6.3).

### 6.2 Valores iniciais fixados (o Lucas pediu que eu decidisse; o simulador ajusta)
Reformulado em 22/10/2026 a pedido do Lucas, que testou a versão anterior à mão (começava com 1,5 mil de poeira do tutorial, objetos demais e fortes, 1ª barra lenta, melhorias e grimórios se sobrepondo, grimórios em %). Fica o que o simulador sustentou (6.7); o resto é só dado em `catalog.ts` e `economy.ts`.
- **Começo:** **0 de poeira**, o toque dá **1**, a 1ª melhoria (Pulso Solar) custa **25** e o 1º grimório sai com **~50 de poeira ganha no total**. O tutorial entrega só os 25 que faltam (`TUTORIAL_DUST_ALLOWANCE` lê a base do Pulso).
- **Custo:** `custo(nível) = base x g^nível`, arredondado, com `g` por melhoria (x1,12 no Pulso, x1,3 a x1,9 nas outras) e trecho íngreme (`steep`) nas que ficam muito longas; descontos (Ceres devolve poeira na compra, M87*, árvore, Atlas) **multiplicativos com piso de 40%**.
- **Melhorias e liberação:** tabela da 5.1. Só a 1ª existe no começo; as outras abrem por marco (poeira ganha na vida ou nível da anterior) e custam bem mais.
- **Efeito do Pulso Solar:** +1 poeira por toque por nível (máx. 40). **Reator:** +0,25 de energia por toque por nível (máx. 20). **Hubble:** +1 poeira por segundo por nível (máx. 30).
- **Energia:** base **1 por toque**; passos de escolha **38, 80, 150, 260, 420, 640** e depois **x1,35** por escolha.
- **Objetos:** cometa = **6 toques de poeira**, estrela cadente = **2 toques de energia**, satélite = **x2 por 8 s**; um a cada 32 s, 1 na tela, e só depois da 1ª melhoria (4.5).
- **Grimório repetido:** +50% do número base por nível, **nível máx. 10**.
- **Colapso:** estrela pronta com a **meta de poeira acumulada na vida** da tabela 6.7 e **>= 20 escolhas** no 1º colapso (**15** do 2º ao 5º e **12** a partir do 6º); a meta é **a variável que o simulador ajusta** para a vida k durar o tempo-alvo da tabela 6.6.
- **Atlas:** página a **60%**, 3 espaços iniciais, bônus de conjunto da seção 8.2 (esses seguem em %: não são grimórios).
- **Metas de tempo:** 1º colapso em **6 a 10 h** (alvo 8 h) de jogo aberto no ritmo normal (2,5 toques/s); cada colapso seguinte mais rápido, até o piso de ~1,2 h no 15º (tabela 6.6); **15 colapsos em ~38 h** de jogo aberto.

### 6.3 O que o simulador de rascunho mostrou (e por que reescalar)
Rodei uma simulação rápida e **descartável** (jogador que toca 2,5 vezes por segundo, compra sempre a melhoria de melhor retorno, grimórios dando +3% de poeira por escolha, combo cheio) com os números do mockup (base 25 a 260, **+1 energia por toque**, passos 60 a 320 e depois x1,25):
- **Com os números do mockup, a 1ª hora já chega ao nível ~14 em todas as melhorias e a ~24 grimórios.** Mais de **8 a 10 vezes mais rápido** que a meta. Não serve.
- Com **custos base x60**, energia base de 1 por toque (+0,25 por nível do Reator) e passos x1,35 depois do 6º: em 8 h os níveis ficaram em ~10/8/7/6/6 e ~2,2 mi de poeira acumulada, **na faixa de 6 a 10 h**. Mas saíram **~12 escolhas de grimório na 1ª hora**, rápido demais para "começo MUITO mais lento"; por isso a energia base fixada em 6.2 é **0,25**, que leva a 1ª barra (60) a ~2 min no ritmo normal.
- O jogador real tem sessões, pausas, objetos e combo; o simulador oficial (6.5) modela **três perfis** (casual 1 toque/s, normal 2,5, compulsivo 6 com o teto) e dá as horas de jogo aberto de cada marco.

### 6.4 Ganhos por colapso
- **Fragmentos** por colapso: `3 + nº do colapso` + `floor(log10(poeira da vida / 2 mi))` quando positivo.
- **Atlas:** a página fica com 60% do poder (8.2).

### 6.6 Curva de duração e tabela-alvo dos 15 colapsos (para o simulador calibrar)
Regra: a **duração da vida k** (do início até colapsar) parte de **8 h** e cai com **razão crescente** (a vida encurta rápido no começo e se aproxima de um **piso de 1,2 h**). Razão entre vidas consecutivas ~0,63 no 2º colapso, subindo até ~0,96 no 15º. A tabela é a **meta**; o simulador mexe em `meta(k)`, nos pesos e nos ganhos do Atlas/árvore até o perfil normal bater **±15%** em cada linha.

| Colapso | Duração da vida (alvo) | Acumulado | Meta de poeira (inicial) | Mín. de escolhas |
| --- | --- | --- | --- | --- |
| 1º | 8,0 h | 8,0 h | 2 mi | 20 |
| 2º | 5,0 h | 13,0 h | 6 mi | 15 |
| 3º | 3,5 h | 16,5 h | 18 mi | 15 |
| 4º | 3,0 h | 19,5 h | 54 mi | 15 |
| 5º | 2,6 h | 22,1 h | 160 mi | 15 |
| 6º | 2,3 h | 24,4 h | 490 mi | 12 |
| 7º | 2,1 h | 26,5 h | 1,5 bi | 12 |
| 8º | 1,9 h | 28,4 h | 4,4 bi | 12 |
| 9º | 1,75 h | 30,15 h | 13 bi | 12 |
| 10º | 1,6 h | 31,75 h | 40 bi | 12 |
| 11º | 1,5 h | 33,25 h | 120 bi | 12 |
| 12º | 1,4 h | 34,65 h | 350 bi | 12 |
| 13º | 1,3 h | 35,95 h | 1,1 tri | 12 |
| 14º | 1,25 h | 37,2 h | 3,2 tri | 12 |
| 15º | 1,2 h | 38,4 h | 9,6 tri | 12 |

- Isto **substitui** a meta anterior "10º colapso em 40 a 60 h": com a vida encurtando, o 10º colapso chega em ~32 h (faixa 27 a 37 h) e o 15º em ~38 h (faixa 33 a 44 h).
- **Pesos de raridade nas vidas seguintes:** como cada vida zera as escolhas, os limiares da 4.3 (`n >= 3 / 8 / 14 / 22`) caem para **60%** depois do 1º colapso e **40%** depois do 5º, para os raros e épicos aparecerem mais cedo em vidas curtas. O simulador confirma.
- Os "mín. de escolhas" e as metas de poeira são o ponto de partida; o simulador também valida que **nenhuma vida fica mais longa que a anterior**.

### 6.7 Calibração (economia reformulada em 22/10/2026; números finais do motor)
Simulador: `pnpm --filter @nocap/games sim` (fora do `pnpm test`; `simulate({ ..., trace })` dá o estado a cada minuto para diagnóstico). Os testes (`sim.test.ts`) exigem, no perfil normal (2,5 toques/s), a **média de 60 sementes** (`v0` a `v59`) de cada vida 1 a 5 a ±15% da tabela 6.6, 1º colapso entre 6 e 10 h e nenhuma vida mais longa que a anterior. A calibragem usou 60 sementes `c0` a `c59`; as duas colunas abaixo são as médias de cada conjunto.

| Vida | Meta de poeira (final) | Duração (sementes `c`) | Duração (sementes `v`, as do teste) | Alvo | Desvio (`c` / `v`) |
| --- | --- | --- | --- | --- | --- |
| 1º | 17,53 mi | 8,00 h | 7,50 h | 8 h | 0% / -6% |
| 2º | 66,21 mi | 4,99 h | 5,06 h | 5 h | 0% / +1% |
| 3º | 54 mi | 3,60 h | 3,18 h | 3,5 h | +3% / -9% |
| 4º | 65 mi | 3,04 h | 2,65 h | 3 h | +1% / -12% |
| 5º | 63 mi | 2,58 h | 2,48 h | 2,6 h | -1% / -5% |

- **Por que as metas são maiores que antes (5,9 a 8,2 mi):** a poeira por toque agora cresce com preço exponencial íngreme e ganhos lineares, então a renda de cada fase é menor no começo e a meta da vida sobe junto com o Atlas e a árvore (a vida 2 abre o Webb e todas as melhorias sem marco). As vidas 6 a 15 seguem provisórias (6,3 a 8,1 mi x 10).
- **Marcos da 1ª vida (uma semente, perfil normal):** 1ª melhoria ~10 s, 1ª escolha ~18 s (~50 de poeira ganha), 3 escolhas em 2 min, 9 em 10 min, 15 em 1 h, 1 mi de poeira ~1 h, 20 escolhas em ~4 h, estrela pronta em ~8 h. Melhorias no fim: Pulso 27, Ressonância 5, Reator 19, Plêiades 5, Kepler 5, Hubble 14.
- **O que mudou no motor para isso:** energia base 1 por toque e passos 38, 80, 150, 260, 420, 640 (x1,35 depois); Pulso base 25 com preço x1,12 e trecho íngreme x1,7; objetos a cada 32 s, 1 no campo, 6 toques de poeira no cometa e só depois da 1ª melhoria; grimórios em números (5.2); Webb soma poeira por toque e o Hubble rende poeira por segundo (5.1).
- **Alerta aberto do simulador:** a Lua e o Mercúrio dominam 25% a 30% das escolhas da 1ª vida porque o jogador simulado pega o ganho imediato; não trava nenhum teste.

#### Calibração anterior (etapas 1 e 13, economia antiga; histórico)
Simulador: `pnpm --filter @nocap/games sim` (fora do `pnpm test`). Os testes (`sim.test.ts`) exigem, no perfil normal (2,5 toques/s), a **média de 60 sementes** (`v0` a `v59`, nenhuma usada para calibrar) de cada vida 1 a 5 a ±15% da tabela 6.6, 1º colapso entre 6 e 10 h e nenhuma vida mais longa que a anterior. Uma semente isolada varia de 1 a 6 h na mesma vida (a sorte dos grimórios), por isso a tabela impressa de uma semente só é indicativa. A etapa 13 recalibrou: a calibração da etapa 1 usava 3 sementes e estava ajustada a elas (com 16 sementes diferentes as vidas 1, 3 e 5 saíam 8 a 15% abaixo e a 4ª 20% acima), e o simulador travava quando o Atlas enchia (agora a página nova substitui a mais fraca).

| Vida | Meta de poeira (final) | Duração (média de 60 sementes) | Alvo | Desvio |
| --- | --- | --- | --- | --- |
| 1º | 5,9 mi | 7,72 h | 8 h | -3% |
| 2º | 7,7 mi | 4,73 h | 5 h | -5% |
| 3º | 6,57 mi | 3,56 h | 3,5 h | +2% |
| 4º | 8,15 mi | 3,13 h | 3 h | +4% |
| 5º | 6,82 mi | 2,61 h | 2,6 h | 0% |

As metas das vidas 4 e 5 ficam de propósito um pouco fora do centro (3,1 h e 2,45 h na calibração) para a média continuar decrescente apesar do ruído da sorte.

- **Vidas 6 a 15:** metas provisórias (5,5 a 7,3 mi), **sem calibrar**: o conteúdo desses colapsos só chega nas etapas 14 e 15.
- **Ajustes de número feitos na calibração:** (1) **energia dos objetos em toques de energia** e não em % da barra (estrela 8 toques, asteroide 3, Tritão 2): com % da barra o simulador fazia 180 escolhas em 8 h, porque a barra cresce x1,35 e a estrela dava 10% dela em qualquer fase; agora a 1ª vida fecha com ~21 escolhas; (2) Lua +1 toque a cada 10 (antes +5); (3) Caranguejo = +1 nível extra no repetido; (4) as metas de poeira acima (a de 2 mi do rascunho deixava o 1º colapso em ~1,5 h). Custos, bases, passos de energia e níveis máximos ficaram como na 6.2.
- **Marcos da 1ª vida, perfil normal (uma semente):** 1ª melhoria ~7 min, 1ª escolha ~2 min, 10 escolhas ~1 h, 1 mi de poeira ~3,5 h, estrela pronta ~8 a 9 h.
- **Regras de motor decididas na etapa 1:** o toque exige 1/12 s entre toques; salto de relógio maior que 5 s é aba escondida (nada conta, objetos/boost/combo congelam); com a escolha aberta o campo congela; escolha em 2 passos (`selectGrimoire` e `chooseGrimoire`, bloqueio de 1,6 s); sorteio escolhe a raridade pelo peso e depois a carta; grimório no nível 10 sai do sorteio; efeitos de preço dos proibidos têm a marca `price` (é o `forbiddenTradeoff`) e a página do Atlas reduz preço e ganho a 60% (a escolha dupla de Órion não é guardada na página); descontos de custo são multiplicativos com piso de 40%; combo máximo com teto 12; `startDust` do Titã = 1.500 de poeira por nível.
- **Não feito nesta etapa:** `validateSave`, `mergeSaves`, `eventTick`, `canAscend`, conquistas, mecânica Favorito (etapa 2 em diante).

### 6.5 Simulador de economia (proposta)
Um script em `packages/games` (`aperta/sim`, rodado por um comando `pnpm`) que **usa o próprio motor do jogo** (mesmas funções, sem cópia da regra) e simula jogadores por perfil e estratégia de compra (gulosa, só toque, mista). Entradas: tabelas de custo, efeitos, pesos, passos de energia. Saídas: tabela de **horas de jogo aberto até cada marco** (1ª melhoria, 1ª escolha, 10 escolhas, ~1 mi, estrela pronta, 2º colapso, 10º colapso), **distribuição de grimórios**, quanto cada grimório vale (retorno por escolha) e **alertas** (grimório que domina, ramo da árvore que quebra, valor que passa de 1e15). Testes automatizados: "cada vida do perfil normal fica a ±15% da tabela 6.6, e nenhuma é mais longa que a anterior"; "1º colapso do perfil normal entre 6 e 10 h" falha o build se uma mudança de número sair da faixa; "nenhum caminho dá infinito ou NaN".

## 7. Motor (lógica em `packages/games/src/aperta/`)

### 7.1 Estado
`SaveState` = { `version`, `name`, `createdAt`, `playSeconds`, `tutorial` (passo ou concluído), `storySeen`, `run` { `dust`, `dustLife`, `energy`, `picks`, `upgradeLevels[]`, `build` { grimórioId -> nível }, `clicks`, `combo`, `boostUntil`, `rngState` }, `album` (descobertos), `atlas` { `slots`, `pages` [{ grimórioId, nível }] }, `collapses` (colapso atual), `regionId` (região em que está), `seenUnlocks` (conteúdo novo já avisado), `eventState` (recargas dos eventos), `fragments` { `earned`, `spent` }, `tree` (nós e níveis), `achievements`, `stats` (toques, objetos, etc.) } e, mais tarde, `ascensions` e `constellations`.

### 7.2 Funções puras (todas testadas)
O **conteúdo liberado é derivado** do colapso atual: cada grimório, região, objeto, melhoria, mecânica e evento do catálogo tem um campo `unlockedAtCollapse`, e `unlockedContent(state)` devolve só o que já está aberto (o save **não** guarda a lista, para não ter como desalinhar). Funções extras: `unlockedContent`, `regionFor(state)`, `eventTick(state, now)`, `canAscend(state)`.
`newSave(seed)`, `press(state, now)`, `tickObjects(state, now)`, `captureObject(state, id)`, `buyUpgrade(state, i)`, `drawGrimoires(state)` (3 sem repetir, por peso), `chooseGrimoire(state, id)`, `canCollapse(state)`, `collapse(state, pageId)`, `respecTree(state)`, `buyTreeNode(state, id)`, `effectiveStats(state)` (junta melhorias, grimórios, Atlas, bônus de conjunto e árvore em números finais), `validateSave(raw)` (formato e coerência, seção 10), `mergeSaves(a, b)`.

### 7.3 Primitivas de efeito (todo grimório e nó da árvore usa só estas)
**Grimórios (em números):** `everyNthTouch(n, mult, energy)` (a cada N toques o toque vale x e soma energia), `comboFullDust(add)` e `comboFullEnergy(add)` (com o combo no máximo, +poeira e +energia por toque), `comboFullMult(mult)`, `comboWindow(sec | mult)`, `objectReward(alvo, add)` (+toques de recompensa por tipo de objeto), `satelliteMult(add)`, `onCapture(energyTouches)`, `afterCaptureMult(mult)`, `startDust(amount)`, `buyRefund(touches)` (a compra devolve a poeira de N toques), `dustPerOwned(raridade, add)`, `dustPerCollapse(add)`, `choiceExtra` (reroll, 2 escolhas, repetido +2 níveis), `dustMult`, `energyMult`, `objectsDisabled`, `upgradeCostPct` e `energyStepPct` (proibidos) e `forbiddenTradeoff`.
**Atlas e árvore (em %):** `dustPerTouchPct`, `energyPerTouchPct`, `objectDuration` (% de vida), `maxObjects`, `comboMax`, `comboWindow(pct)`, `upgradeCostPct`, `freeUpgradeLevels`, `forbiddenUnlock`, `forbiddenPower`.
**Melhorias:** não usam primitivas de efeito: o motor lê o nível de cada uma em `effectiveStats` (Pulso, Webb, Hubble, Reator, Ressonância, Plêiades, Kepler, Voyager, Chandra). `effectDomain(efeito)` e `UpgradeDef.domains` dão o domínio de cada lado para o teste de não-duplicação. Isso mantém os 40 grimórios (e os futuros) como **dados** e o motor pequeno.

### 7.4 Tempo e jogo parado
O motor é **orientado a eventos** (toque, captura, compra) e a um relógio de jogo que **só avança com a aba visível** (`document.visibilityState`); ao esconder a aba/app, o relógio pausa e objetos e boosts congelam. **Nada rende offline.** O servidor nunca confia no relógio do aparelho para progresso (seção 10).

### 7.5 Números grandes
`number` (double) basta até ~1e15 sem perda relevante; o formato mostra mil, mi, bi, tri e depois notação científica com Space Mono. O motor **trava em 1e300** e os testes cobrem estouro. Se o Ascender ultrapassar isso, trocar para mantissa-expoente (decisão futura).

## 8. Colapso (rebirth), Atlas Eterno, Fragmentos e árvore

### 8.1 Colapsar a estrela
- Disponível quando a estrela fica **pronta** (poeira da vida >= meta do próximo colapso e escolhas >= mínimo; seção 6). Antes, o botão aparece desabilitado com "Falta N para a estrela colapsar" e uma barra.
- Modal: lista os grimórios da vida; a pessoa **escolhe 1** para guardar como página; mostra os **Fragmentos** que ganha e o que **fica** (álbum, conquistas, Atlas, árvore) e o que **sai** (poeira, melhorias, grimórios ativos, energia, combo). **Colapsar** em 2 passos. Depois, faixa "Estrela colapsada: página guardada no Atlas: <nome>".
- Cada colapso começa uma **vida nova** do zero, com o tutorial concluído.

### 8.2 Atlas Eterno (livro pessoal do save)
- Espaços iniciais **3** (decisão 14.8); **+1 espaço** nos colapsos **5, 10, 25 e 50** (máx. 7).
- Uma página mantém o grimório (com o nível que tinha) a **60% do poder** em **todas** as vidas.
- **Bônus de conjunto por família:** com 2, 3 e 4+ páginas da mesma família ativa o bônus daquela família (valores iniciais a calibrar):
  - Planetas: +5% / +12% / +25% de poeira por toque.
  - Luas: +5% / +12% / +25% de energia por toque.
  - Pequenos corpos: +10% / +20% / +35% de duração dos objetos.
  - Estrelas: +1 / +2 / +3 de combo máximo.
  - Nebulosas e galáxias: -3% / -6% / -10% de custo de melhorias.
  - Buracos negros: +20% / +40% / +80% de poder dos proibidos (e reduz o preço deles em 25% / 50% / 75%).
- Com os espaços cheios, um novo colapso **troca** uma página por escolha do jogador (a antiga some).
- A página mostra os espaços, a família de cada página, os bônus ativos e os que faltam.

### 8.3 Fragmentos e Árvore de Habilidades
- A árvore **abre no 1º colapso**. Seis ramos (nomes do mockup) com 3 níveis cada (18 nós; custo em Fragmentos **1, 2 e 4** por nível):
  - **Sistema Alfa Centauro:** poeira por toque +10% / +20% / +35%.
  - **Nebulosa do Caranguejo:** energia por toque +10% / +20% / +35%.
  - **Cinturão de Kuiper:** +1 / +2 / +3 objetos máximos na tela.
  - **Anéis de Saturno:** janela do combo +15% / +30% / +50%.
  - **Plêiades:** cada vida começa com 1 / 2 / 4 níveis do Pulso Solar de graça.
  - **Horizonte de Eventos:** proibidos liberam em `n >= 18 / 14 / 10` e custam 20% / 40% / 60% menos.
- **Refazer árvore (decidido por mim, ajustável pelo simulador):** devolve **todos os Fragmentos gastos menos 20%** (arredonda para cima; mínimo 1 de taxa se houver gasto), com confirmação em 2 passos, sem limite de vezes e sem cobrar poeira, para ninguém ser punido por testar builds.

### 8.4 Ascender (camada 2, depois da v1)
Regra (gatilho decidido pelo Lucas em 21/10/2026): o jogador pode **Ascender depois de 15 colapsos** (o 15º é o do **Horizonte de Eventos**, fim da primeira viagem). Ascender zera colapsos, Fragmentos e árvore (mantém **álbum, conquistas e Atlas**) e ganha **Constelações** (moeda permanente) que dão um multiplicador global e destravam grimórios e espaços novos; a viagem recomeça do Sistema Solar interno com os 15 colapsos de novo, mais rápidos pelo bônus. Cada ascensão pede os mesmos 15 colapsos (e o piso de duração sobe com as Constelações, a calibrar). **Fica fora da v1 (etapa 16), decidido pelo Lucas**, para a economia da camada 1 ser calibrada antes.

## 9. Encaixe no NoCap

- **Home:** cartão **Aperta!** na faixa **Arcade** (ícone: botão vermelho sobre a base). Convidado vê o cartão com "Entre para jogar" (decisão 14.19). Sem Daily, sem entrada em Hoje.
- **Rotas:** `/arcade/aperta` (título) e a tela de jogo própria em tela cheia, com **Sair** que volta ao título e ao Arcade. Sem barra de abas do app dentro do jogo (como o Atravessa!).
- **Fora da v1:** Ranking, histórico, perfil público, amigos, salas, gacha, Daily. O perfil pode ganhar depois uma estatística pessoal (colapsos, grimórios), sem comparação (decisão futura).
- **Contas (spec 007/023):** exige conta; sem conta, abre o cartão com o botão de entrar.
- **Sons:** módulo `sfx` (Web Audio, sem arquivos) com receitas novas: `clack` no toque (tom sobe com o combo), `whoosh` do objeto, `ding` na captura, `flip` ao revelar cartas, `thunk` ao confirmar grimório e ao colapsar, `win` em conquista, `boing` sem saldo; botão de mudo salvo no aparelho e na conta (decisão 14.14).

## 10. Dados, API e anti-valor-impossível

### 10.1 Tudo no banco, ligado à conta (mesma conta, mesmo jogo em qualquer aparelho)
O **jogo exige conta**. O servidor é a **fonte da verdade**: tudo que der fica no Postgres, e o aparelho só guarda uma **cópia de segurança** para jogar sem internet por pouco tempo. Migration só de criação (`0009_aperta.sql`, não destrutiva):
```
aperta_saves(id uuid pk, user_id uuid -> players, slot smallint check (slot in (1,2)),
  name text, data jsonb, version smallint, revision int, play_seconds int,
  collapses int, fragments_earned int, picks int, dust_log10 real,
  active_device text null, active_until timestamptz null,
  created_at timestamptz, updated_at timestamptz, unique(user_id, slot))
aperta_save_history(save_id uuid, revision int, data jsonb, saved_at timestamptz,
  pk(save_id, revision))                 -- últimas 5 revisões por save, para desfazer conflito
aperta_settings(user_id uuid pk, data jsonb, updated_at timestamptz)   -- som, efeitos reduzidos, avisos vistos
```
- **Por save (dentro do `data`):** vida atual (poeira, energia, melhorias, grimórios e níveis, combo), **álbum de grimórios**, **Atlas Eterno**, **Fragmentos e árvore**, **colapso atual** e **região**, **conteúdo novo já avisado**, **conquistas**, **estatísticas**, **passo do tutorial** e **história vista**. Os **2 saves por conta são independentes** (álbum e conquistas por save).
- **Por conta:** preferências (som ligado, efeitos reduzidos). Nada de progresso fica só no aparelho.
- Colunas desnormalizadas (`collapses`, `picks`, `dust_log10`, `play_seconds`) servem para validar e mostrar a lista de saves sem abrir o JSON. `ON DELETE CASCADE` só ao apagar a conta.

> **Como ficou na etapa 2 (21/10/2026):** a implementação ficou menor que o desenho acima. Existe só `aperta_saves` (sem `active_device`/`active_until`; com `deleted_at`, que guarda o save apagado por 7 dias), e **não** foram criadas `aperta_save_history` nem `aperta_settings`. A trava entre aparelhos é só a `revision` (409 com o save da conta e a junção proposta); o aviso "aberto em outro aparelho" e o `takeover` não existem. A versão que perde um conflito fica numa cópia no aparelho (`backup`), não no servidor. As preferências de som ficam no aparelho por enquanto. Se quisermos o histórico de 5 revisões, as preferências na conta ou a reserva por aparelho, é migration nova e decisão do Lucas.

### 10.2 API (módulo `apps/api/src/aperta/`)
- `GET /me/aperta/saves` (resumo dos 2 saves), `GET /me/aperta/saves/:slot` (completo) e `GET/PUT /me/aperta/settings`.
- `PUT /me/aperta/saves/:slot` `{ data, baseRevision, deviceId }`: valida, junta e grava; `409` com o save atual se `baseRevision` ficou velho ou se outro aparelho está ativo.
- `POST /me/aperta/saves/:slot/takeover`: **não implementado** (ver o quadro acima).
- `POST /me/aperta/saves/:slot/restore`: desfaz o apagar dentro de 7 dias.
- `DELETE /me/aperta/saves/:slot` (apagar; 2 passos no cliente).
- Convidado (sem conta) recebe `401`.

### 10.3 Validações no servidor (sem ranking, mas sem valor impossível)
O servidor usa a **mesma função de validação de `packages/games`** (`validateSave`, `mergeSaves`):
1. **Formato:** zod do `SaveState`; limites de tamanho; ids só do catálogo; níveis dentro dos máximos.
2. **Coerência de gastos:** soma dos custos dos níveis de melhoria <= poeira total ganha na vida; grimórios por nível somam <= escolhas feitas (`picks`); páginas do Atlas <= espaços do nº de colapsos; Fragmentos gastos <= `earned`; `earned` coerente com `collapses`; **todo grimório, melhoria e objeto usado tem `unlockedAtCollapse` <= colapso atual** (conteúdo de colapso futuro é rejeitado); `regionId` é uma região já aberta.
3. **Ritmo possível:** `dustLife <= playSeconds x teto de poeira por segundo` calculado pelo motor para o que foi comprado (com teto de 12 toques/s, bônus de combo cheio, objetos e o ganho passivo do Hubble) e `playSeconds <= tempo desde created_at`. Estourou: **corta ao valor possível** e marca `flagged` (não bane). **Saves da economia antiga** (anteriores à reformulação de 22/10/2026) seguem válidos: o formato não mudou, a lista de melhorias menor é completada com zeros e as compras antigas cabem nos marcos novos (cada compra antiga já custou mais que o marco). Se a poeira da vida de um save antigo passar do teto novo (objetos mais raros e grimórios em número valem menos), ela é **cortada ao teto** (`dustLife` e `dust`, com `stats.dustTotal` ajustado) e marcada, sem recusar e sem tirar melhorias, grimórios, Atlas ou Fragmentos. Uma melhoria comprada que o marco ainda não liberou (`Melhoria trancada`) é recusada, e o marco só vale na 1ª vida (depois do 1º colapso todas as conhecidas estão abertas).
4. **Nunca diminui por engano:** a junção automática fica com o mais avançado (mais colapsos; empate, mais escolhas e mais poeira da vida); álbum, conquistas e Atlas são **união**.
5. Rate limit de 1 `PUT` a cada 5 s por save.

### 10.4 Vários aparelhos e conflito
- **Abrir:** o jogo baixa o save da conta e compara com a cópia local; vale o de **maior `revision`** (a cópia local só ganha se for mais nova e o servidor não mudou).
- **Salvar:** a cada **30 s**, ao esconder a aba, ao sair da tela e após escolher grimório, comprar melhoria cara, colapsar ou concluir conquista. Sem internet continua com a cópia local e sobe quando voltar.
- **Um aparelho por vez:** quem está jogando "reserva" o save por 60 s (`active_device`, renovado a cada gravação). Se outro aparelho abre o mesmo save, aparece **"Este save está aberto em outro aparelho"** com **Assumir aqui** (o outro vira somente leitura, com aviso) ou **Voltar**.
- **Conflito de gravação (`409`):** o jogo mostra **"Este save mudou em outro aparelho"** com **Juntar (recomendado)**, **Usar o da conta** e **Usar o deste aparelho** (2 passos; a versão que perde vai para `aperta_save_history` e dá para restaurar das últimas 5). Sem escolha, nada é sobrescrito.
- **Sem renda offline:** a hora do aparelho nunca gera progresso; o relógio do jogo só avança com a aba visível.

### 10.5 Testes
- **`packages/games` (Vitest):** economia (custos e descontos com piso), sorteio de grimórios (pesos, libera por `n`, sem repetir, determinístico por seed), cada efeito em isolamento, combo (janela e teto), objetos (vida, máximo na tela), colapso e Atlas (60%, espaços 5/10/25/50, conjuntos), refazer árvore, `validateSave` (rejeita impossíveis), `mergeSaves`, números grandes e formato pt-BR, **simulador**.
- **API:** serviço com repositório em memória (validar, juntar, 409, convidado 401).
- **Web:** a engine em cenários completos (tutorial, primeira escolha, colapso), reduced-motion, bloqueio de 1,6 s com timers falsos, sem scroll horizontal em larguras 320, 390, 768, 1280.

## 11. UI/UX (design e regras do projeto)

- **Tema espaço próprio (aprovado pelo Lucas em 21/10/2026):** a tela do Aperta! usa a **paleta do mockup** (azul-noite `#04060f`/`#0f1838`, azul `#3c9cf0`, ouro `#ffc857`, vermelho `#ee3a2f`, ciano `#5ce1ff`, violeta `#9b7bff`), **sombreamento radial nos astros** e as fontes **Chakra Petch** (títulos e números) e **Space Grotesk** (texto). Tudo vira **tokens `--space-*` definidos em um só arquivo** (`apps/web/src/games/aperta/space-tokens.css`); o **resto do app continua Pop Brutal**, sem vazar token nem fonte para fora do jogo. Continua valendo: **sem emoji**, **animar só `transform`/`opacity`** e **`prefers-reduced-motion`**. Fontes carregadas só quando o Aperta! abre (sem peso no resto do app).
- **Responsivo:** celular (320 a 720 px): HUD em duas linhas, campo com botão menor, energia à direita, dock com 3 botões de >= 62 px, páginas a partir de 140 px do topo, escolhas em coluna única. Tablet (720 a 1000): páginas centralizadas, escolhas em 3 colunas. PC (>= 1000): páginas de até 900 px, grade de grimórios em 4 colunas, teclado: Espaço/Enter toca; `G` Grimórios, `M` Melhorias, `Esc` fecha.
- **Sem emoji;** ícones em SVG de traço (troféu, livro, seta, árvore); arte dos astros em SVG inline (sem imagens pesadas).
- **Animação só `transform`/`opacity`;** com `prefers-reduced-motion`: sem deriva de estrelas, sem estrela cadente, sem flutuar de objetos e livros, sem brilho que passa, sem quique do logo; troca por fade de 120 ms; os valores continuam atualizando.
- **Acessibilidade:** botão central é `<button>` com `aria-label`; objetos e cartas são botões; foco visível (contorno dourado); contraste AA; modais com foco preso e `Esc`; avisos importantes em `role="status"`; nada só por cor (raridade tem rótulo e gemas); tamanho de alvo >= 44 px.
- **Desempenho:** céu e estrelas por camadas `transform`; animações em loop param quando a aba some; sem `box-shadow` animado; efeitos pesados desligados em aparelhos fracos (`navigator.hardwareConcurrency <= 4`); carregamento sob demanda (lazy) como os outros jogos; meta de peso do jogo < ~60 KB gzip além do núcleo.
- **Estado vazio e erros:** sem internet mostra "Jogando sem conexão: salvaremos quando voltar"; falha ao salvar três vezes mostra aviso persistente com "Tentar de novo".

## 12. Riscos

| Risco | O que fazer |
| --- | --- |
| **Economia rápida demais** (o mockup chega ao nível 14 em 1 h) | Simulador primeiro (etapa 1), custos x60 como ponto de partida, teste que falha fora da faixa de horas; jogar ao vivo antes de liberar. |
| **Economia lenta demais / grind** | Marcos curtos a cada 2 a 4 min no começo, objetos e combo para variar, grimórios a cada vez mais longos mas sempre com algo "quase lá"; calibrar com 3 perfis. |
| **Valor impossível no save** (editar o JSON) | Validação de coerência e de ritmo no servidor; sem ranking, o dano é só do próprio jogador. |
| **Dois aparelhos ao mesmo tempo** | `revision`, `409` e sessão única por save. |
| **Clique acidental** | Bloqueio de 1,6 s, 2 passos, ignorar toques logo após abrir modais. |
| **Cansaço do clique** | Segurar tecla repete (teto 6/s), objetos e grimórios dão "respiro", sem exigir milhares de cliques seguidos. |
| **Estouro numérico** | Teto de 1e300, formato pt-BR, testes de borda; mantissa-expoente só se o Ascender exigir. |
| **Escopo** (30 grimórios, arte, textos) | Entrega em etapas; a arte de astros é SVG reaproveitável; 12 grimórios no primeiro playtest. |
| **Conteúdo por colapso é muito trabalho (16 regiões, 30 grimórios novos, 5 objetos, 6 eventos)** | Tudo em dados e em etapas pequenas (12 a 15), v1 só até o colapso 5, simulador valida a curva a cada pacote. |
| **Aba em segundo plano e relógio** | Relógio do jogo pausa; nada rende parado; o servidor não usa a hora do aparelho para progresso. |
| **Mockup fora dos tokens Pop Brutal** | Resolvido: exceção nomeada só para a tela do Aperta! (seções 11 e 13); falta o Lucas confirmar o registro em RULES.md. |
| **Desempenho em celular fraco** | Camadas `transform`, sem animar sombra/filtro, redução automática de efeitos, medir no QA. |

## 13. Mockup e regras do projeto (resolvido pelo Lucas)

O Lucas decidiu em 21/10/2026 que o Aperta! usa o **tema do mockup**: paleta azul-noite/azul/ouro/vermelho, **gradientes e sombreamento radial** nos astros e as fontes **Chakra Petch** e **Space Grotesk**. Isso deixa de ser divergência e vira uma **exceção nomeada e restrita à tela do jogo** (seção 11). Passos de implementação:
1. **Registrar a exceção em `.claude/rules/RULES.md` (e em `CLAUDE.md`, onde a regra 6 é citada):** "o tema espaço do Aperta! usa tokens próprios `--space-*`, definidos em um só arquivo; o resto do app continua Pop Brutal". **Esse arquivo é de regras permanentes e quem registra é o Lucas (ou um commit dele); fica fora do commit desta spec** até ele confirmar, porque a mudança veio por mensagem entre sessões. Texto pronto na seção 14.
2. **O que continua proibido, mesmo no tema espaço:** emoji; animar qualquer propriedade que não seja `transform`/`opacity`; ignorar `prefers-reduced-motion`.
3. **Ajustes do mockup que ainda são necessários** (não são paleta): o destaque do tutorial e o afundar do botão animam `box-shadow`; no oficial viram `opacity`/`transform` de um elemento irmão. O "Modo demonstração" (20x mais rápido) vira flag de desenvolvimento, fora da tela final.

## 14. Decisões (resolvidas e em aberto)

Todas respondidas pelo Lucas em 21/10/2026. Nada pendente.

### Resolvidas
1. **Paleta, gradientes e fontes:** **RESOLVIDA.** Usar a paleta do mockup (azul-noite, azul, ouro, vermelho, sombreamento radial, Chakra Petch e Space Grotesk) e **mudar as regras**: exceção nomeada só para a tela do Aperta!, com tokens `--space-*` em um só arquivo (seções 11 e 13).
2. **Nomes:** **RESOLVIDA.** Poeira estelar, Fragmentos, Colapsar a estrela, Atlas Eterno, Árvore de Habilidades, grimórios, Cometa, Estrela cadente e Satélite.
3. **Números iniciais:** **RESOLVIDA ("sim").** Custos base x60, energia por toque 0,25, passos x1,35 depois do 6º, estrela pronta em ~2 mi de poeira e 20 escolhas (seção 6.2). O simulador da etapa 1 calibra.
4. **Meta de tempo:** **RESOLVIDA ("sim") e atualizada.** "6 a 10 h até o 1º colapso" (alvo 8 h) conta **só tempo de jogo aberto**, ritmo normal (2,5 toques/s). Cada colapso seguinte é **mais rápido**, com a tabela-alvo da seção 6.6 (5 h, 3,5 h... até ~1,2 h no 15º; 15 colapsos em ~38 h). Isto substitui a meta antiga "10º colapso em 40 a 60 h".
5. **Grimório repetido:** **RESOLVIDA (Lucas delegou; decidi o mais balanceado).** +50% do efeito por nível, máximo nível 10; o simulador calibra.
6. **Os 30 grimórios:** **RESOLVIDA.** Lista aprovada, com nome, efeito e arte (seção 5.2).
7. **Proibidos:** **RESOLVIDA.** Aprovados: Sagitário A* (a partir de 22 escolhas), Cygnus X-1 (após o 3º colapso) e M87* (após o 5º), com os preços da tabela.
8. **Atlas:** **RESOLVIDA (Lucas delegou; decidi o mais balanceado).** 3 espaços iniciais, +1 nos colapsos 5, 10, 25 e 50 (máx. 7); com tudo cheio, o colapso troca uma página; bônus de conjunto da seção 8.2; o simulador calibra.
9. **Fragmentos e árvore:** **RESOLVIDA (Lucas delegou; decidi o mais balanceado).** `3 + nº do colapso` Fragmentos mais bônus por poeira; **refazer a árvore devolve tudo menos 20%** (seção 8.3).
11. **Saves:** **RESOLVIDA.** Tudo no banco, ligado à conta; mesma conta carrega igual em qualquer aparelho; **2 saves independentes** por conta, cada um com álbum, Atlas e conquistas próprios.
12. **Offline:** **RESOLVIDA.** O jogo exige conta; o servidor é a fonte da verdade; depois de aberto continua se a internet cair (cópia local, sobe depois), mas começa só com internet (seção 10).
13. **Apagar save:** **RESOLVIDA ("ok").** 2 passos e recuperável por 7 dias.
14. **Sons:** **RESOLVIDA ("ok").** `clack` com tom subindo no combo, `whoosh`, `ding`, `flip`, `thunk`, `win`, `boing`; sem música na v1; vibração só no Android, desligável.
15. **Modo demonstração:** **RESOLVIDA ("ok").** Só como flag de desenvolvimento, fora do app final.
16. **Conquistas:** **RESOLVIDA ("ok").** Lista da 5.3, só medalha na v1.
17. **Ordem das etapas:** **RESOLVIDA ("ok").** A da seção 15, começando pelo motor e simulador.
18. **Mesmo save em vários aparelhos:** **RESOLVIDA.** Sincronização com aviso em caso de conflito (seção 10.4).
19. **Convidado:** **RESOLVIDA ("ok").** O cartão aparece no Arcade com "Entre para jogar".
20. **Segurar a tecla:** **RESOLVIDA ("ok").** Permitido, até 6 toques/s.
10. **Ascender (camada 2):** **RESOLVIDA.** Gatilho **depois de 15 colapsos** (seção 8.4) e entra **depois da v1** (etapa 16), decidido pelo Lucas em 21/10/2026.
21. **Conteúdo na v1:** **RESOLVIDA (Lucas: "tudo certo, vamos de recomendado").** A v1 traz **colapsos 0 a 5** (6 regiões, 40 grimórios); o resto chega por atualização (v1.1: colapsos 6 a 10; v1.2: colapsos 11 a 15).

### Pendentes
Nenhuma. A spec está **aprovada pelo Lucas** (21/10/2026) e a etapa 1 (motor e simulador) pode começar.

### Exceção de regra (item 1)
Registrada em `.claude/rules/RULES.md` e `CLAUDE.md` (commit `docs(rules): excecao do tema espaco do Aperta!`), por pedido direto do Lucas.

## 15. Plano de entrega (etapas pequenas)

Cada etapa só começa com o "sim" do Lucas para a anterior; cada uma termina com **testes verdes (`pnpm test`, `pnpm typecheck`, `pnpm lint`)**, atualização de `specs/INDEX.md`, `ARCHITECTURE.md`, `docs/ROADMAP.md` e do brief, e **um commit em Conventional Commits** com o trailer de coautoria.

1. **Motor e simulador.** *Escopo:* `packages/games/src/aperta/` com tabelas (melhorias, grimórios do 5.2, pesos, energia), `press`, `buyUpgrade`, `drawGrimoires`, `chooseGrimoire`, `effectiveStats`, formato pt-BR e o **simulador** por perfil. *Arquivos:* `catalog.ts`, `economy.ts`, `engine.ts`, `format.ts`, `sim.ts`, testes. *Pronto quando:* o simulador cospe a tabela de horas por marco, o perfil normal fica em 6 a 10 h até a "estrela pronta" (ou ajusta os números) e nenhum caminho dá NaN/infinito. *Commit:* `feat(games): motor e simulador do Aperta!`.
2. **Persistência na conta.** *Escopo:* migration `0009_aperta.sql`, módulo `aperta` da API (GET/PUT/DELETE, `validateSave`, `mergeSaves`, 409, 401 para convidado), cliente de sincronização (autosave 30 s, cópia local). *Arquivos:* `apps/api/src/aperta/*`, `apps/api/src/db`, `packages/games/src/aperta/validate.ts`, `apps/web/src/games/aperta/sync.ts`. *Pronto quando:* testes de formato, coerência, junção, concorrência e convidado passam; migration só cria tabela. *Commit:* `feat(api): saves do Aperta! na conta`.
3. **Título, saves e história.** *Escopo:* rota, tela de título, modal de 2 saves (novo, continuar, apagar em 2 passos), história de 4 telas, som ligado/desligado, convidado. *Pronto quando:* dá para criar, continuar e apagar saves nos dois aparelhos, em 320/390/768/1280 px sem scroll horizontal e com reduced-motion. *Commit:* `feat(web): título, saves e história do Aperta!`.
4. **Tela de jogo e toque.** *Escopo:* HUD, botão com afundar/onda/faíscas/+N, barra de energia, dock e avisos (pickup), relógio que pausa com a aba escondida, repetição de tecla. *Pronto quando:* tocar sobe poeira e energia, a energia enche e abre o modal de escolha (ainda com cartas simples). *Commit:* `feat(web): tela de jogo e toque do Aperta!`.
5. **Melhorias.** *Escopo:* página de Melhorias (5 do 5.1 mais as de liberação), preço, ganho da próxima compra, selo de quantas dá para comprar, combo só depois da Ressonância. *Pronto quando:* compra e custo `x1,65^n` batem com os testes do motor; combo só liga após a compra. *Commit:* `feat(web): melhorias do Aperta!`.
6. **Grimórios e álbum.** *Escopo:* modal de escolha (bloqueio de 1,6 s, 2 passos, 3 cartas por peso), álbum com escondidos, nível por repetição, página de Grimórios. *Pronto quando:* só saem comuns nas 3 primeiras escolhas e os pesos aparecem de acordo com `n`; testes de proteção contra clique acidental. *Commit:* `feat(web): grimórios e álbum do Aperta!`.
7. **Objetos no espaço.** *Escopo:* cometa, estrela cadente, satélite, etiqueta de recompensa, vida, captura com aviso e efeitos, acessibilidade por teclado. *Pronto quando:* a recompensa aparece antes de pegar e o aviso aparece depois; satélite liga o chip "Sinal forte" no HUD. *Commit:* `feat(web): objetos no espaço do Aperta!`.
8. **Tutorial guiado.** *Escopo:* véu, spotlight (`opacity`), seta, cartão de coach de 5 passos, bloqueio do resto, "Pular tutorial", retomar passo salvo. *Pronto quando:* o tutorial não deixa clicar fora do alvo, é pulável e funciona em celular e PC. *Commit:* `feat(web): tutorial guiado do Aperta!`.
9. **Colapso e Atlas.** *Escopo:* `canCollapse`/`collapse`, modal em 2 passos, Atlas com espaços e bônus de conjunto, Fragmentos, "estrela pronta" na UI. *Pronto quando:* a vida recomeça, a página guarda 60%, os espaços sobem nos colapsos 5/10/25/50 (teste), e o servidor aceita o save. *Commit:* `feat(games): colapso e Atlas Eterno do Aperta!`.
10. **Árvore e conquistas.** *Escopo:* Árvore de Habilidades (6 ramos x 3 níveis, refazer pagando), página de Conquistas, avisos de conquista. *Pronto quando:* os nós alteram `effectiveStats` com teste, refazer devolve com a taxa decidida, conquistas contam e salvam. *Commit:* `feat(web): árvore e conquistas do Aperta!`.
11. **Polimento visual e sons.** *Escopo:* arte dos astros e livros, receitas de `sfx`, transições, animações só `transform`/`opacity`, `prefers-reduced-motion`, desempenho em celular fraco. *Pronto quando:* revisão manual aprovada pelo Lucas e nenhuma animação de propriedade proibida (checagem automática do CSS). *Commit:* `feat(web): arte, sons e polimento do Aperta!`.
12. **Conteúdo por colapso: base de dados e colapsos 1 a 5 (v1).** *Escopo:* campo `unlockedAtCollapse` em todo o catálogo, `unlockedContent`, **regiões** em dados (cores, camadas de SVG, troca ao colapsar, menu de regiões), faixa "Novo no espaço", e o conteúdo dos colapsos 1 a 5 da tabela 5.4 (10 grimórios, Asteroide, Sonda Voyager, James Webb, Chandra, Gaia, Favorito, Missões da estação, Chuva de meteoros, Tempestade solar, 5 regiões e as conquistas). *Pode dividir em 12a (base, regiões e colapso 1), 12b (colapsos 2 e 3) e 12c (colapsos 4 e 5), cada uma com seu commit.* *Arquivos:* `packages/games/src/aperta/content/*`, `apps/web/src/games/aperta/regions/*`. *Pronto quando:* testes mostram que cada colapso destrava exatamente a linha da tabela, o servidor rejeita conteúdo de colapso futuro e cada região renderiza em 320, 390, 768 e 1280 px. *Commit:* `feat(games): conteúdo dos colapsos 1 a 5 do Aperta!`.
13. **QA responsivo e calibragem ao vivo (fecha a v1).** *Escopo:* 320, 390, 768, 1024, 1280 e 1920 px, toque, mouse e teclado; calibrar a economia **jogando com o Lucas** (ajustar tabelas pelo simulador até as vidas 1 a 5 da tabela 6.6 baterem ±15%). *Pronto quando:* o Lucas aprova jogar por 1 a 2 dias e o ritmo bate com a meta. *Commit:* `fix(games): calibragem do Aperta!`.
14. **Conteúdo dos colapsos 6 a 10 (v1.1).** *Escopo:* itens da tabela 5.4 (10 grimórios, Pulsar, Supernova, Spitzer, LIGO, Combo de objetos, Eclipse, Alinhamento galáctico e Supernova próxima, 5 regiões, conquistas). *Pode dividir em 14a (6 e 7), 14b (8 e 9) e 14c (10).* *Pronto quando:* o simulador confirma as vidas 6 a 10 da tabela 6.6 e os testes de desbloqueio passam. *Commit:* `feat(games): conteúdo dos colapsos 6 a 10 do Aperta!`.
15. **Conteúdo dos colapsos 11 a 15 (v1.2).** *Escopo:* itens da tabela 5.4 (10 grimórios com TON 618 e Phoenix A, Quasar, 4ª carta, Captura automática, Event Horizon Telescope, Passagem do Halley, Maré gravitacional, 5 regiões, final da história no Horizonte de Eventos). *Pode dividir em 15a (11 e 12), 15b (13 e 14) e 15c (15).* *Pronto quando:* as vidas 11 a 15 da tabela 6.6 batem ±15% e o 15º colapso mostra o final. *Commit:* `feat(games): conteúdo dos colapsos 11 a 15 do Aperta!`.
16. **Ascender (camada 2, depois de 15 colapsos; fora da v1, decidido).** *Escopo:* `canAscend`, Constelações, reinício da viagem, calibragem pelo simulador. *Commit:* `feat(games): Ascender no Aperta!`.

**Ordem de dependência:** 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12 -> 13 (v1) -> 14 (v1.1) -> 15 (v1.2) -> 16 (Ascender). As etapas 5, 6 e 7 só dependem da 4 e podem trocar de ordem se o Lucas preferir (decisão 14.17).

## 16. Estado atual e o que falta (atualizado em 21/10/2026, fim do dia; etapa 2 fechada no código)

Todo o trabalho está na branch **`develop`** (nada na `main`, por ordem do Lucas). Testes: `packages/games` 564, `apps/web` 301, `apps/api` 334 passando; typecheck limpo. Duas sessões foram interrompidas por limite de uso e o que elas deixaram foi mesclado na `develop` como está.

### Pronto na `develop`
- **Etapa 1 (motor e simulador):** completa e calibrada para as vidas 1 a 5 (seção 6.7). Vidas 6 a 15 provisórias.
- **Etapa 3 (título, saves e história):** completa, conferida no navegador.
- **Etapa 11, parte feita (21/10/2026, branch `claude/aperta-etapa-11-d75c04`):** kit de arte e sons ligados a todos os eventos existentes (toque, objetos, captura, grimórios, compra, saves, história, tutorial), vibração calada pelo mudo, fade entre telas, modo aparelho fraco (`is-lite`) e `motion-css.test.ts` (nenhum CSS do Aperta! anima fora de `transform`/`opacity`). Conferida em 320, 390 e 1280 px com toque e movimento reduzido. Falta o polimento de colapso, Atlas, Árvore e conquistas junto das etapas 9 e 10.
- **Etapa 2 (saves na conta), pronta no código (branch `claude/aperta-etapa-2-300247`):** migration `0009_aperta.sql` (revisada: só cria `aperta_saves`, batendo com o schema do Drizzle; **não aplicada**), `validateSave` e `mergeSaves` em `packages/games/src/aperta/save.ts`, módulo Nest `apps/api/src/aperta/` (GET/PUT/DELETE/restaurar, 401, 409, 7 dias, limite de 5 s por save; testes com repositório em memória e no controlador), `api-save-store.ts` (autosave 30 s, cópia local, subida ao voltar a internet), `SyncNotice` (faixa de offline/erro e diálogo de conflito entre aparelhos) e a partida em curso salva pela conta (`createSyncedGameStore`). Testes verdes.
- **Etapa 4 (tela de jogo e toque), pronta (21/10/2026):** `GameScreen`, `GamePage`, `ChoiceModal` provisório, `game-controller`, `useApertaGame`, `game-store`, CSS e testes verdes. Conferida no navegador (celular emulado com toque e DPR 2) em 320, 390 e 1280 px: sem rolagem lateral, texto cortado ou sobreposição. Pausa com a aba escondida coberta por `run-controller.test.ts`; tecla segurada medida em 12 toques em 2 s (limite de 6/s).

- **Etapa 5 (Melhorias), pronta (21/10/2026, branch `claude/aperta-etapa-5-2dde26`):** `UpgradesPage`, `upgrades-logic.ts`, `upgrades.css`, `controller.buy` com trava de 250 ms (4.7). Mostra as melhorias que o colapso atual abriu; as de liberação (Plêiades, Hubble, Voyager) aparecem trancadas com a dica. Ganho da próxima compra vem do `effectiveStats` do motor; botão "Falta N" sem saldo. Combo só liga após a Ressonância (teste). Conferida em 320, 390 e 1280 px sem rolagem lateral.
- **Etapa 6 (grimórios e álbum), pronta (21/10/2026, branch `claude/aperta-etapa-6-1f9010`):** modal de escolha completo, página de Grimórios com álbum e Atlas (espaços; bônus de conjunto e botão Colapsar ficam na etapa 9), testes de pesos por `n` e de clique acidental. Conferida em 320, 390 e 1280 px.
- **Etapa 7 (objetos no espaço), pronta (21/10/2026, branch `claude/aperta-etapa-7-e2dc63`):** `FieldObjects`, `SignalChip`, `controller.capture`, `objectPreview` (motor, testado), etiqueta com a recompensa antes de tocar, aviso "<Objeto> capturado" depois, chip "Sinal forte" (fica na pilha de avisos sob o HUD, não dentro do painel, para caber em 320 px), teclado (Tab e Enter/Espaço). Decisão: a posição vem do id (faixas de cima e de baixo do campo, longe do botão). Falta ligar o bloqueio no tutorial (etapa 8). Conferida em 320, 390 e 1280 px.
- **Etapa 8 (tutorial guiado), pronta (21/10/2026, branch `claude/aperta-etapa-8-88d554`):** `tutorial.ts` no motor (concessões da Lua e da poeira, `tutorialAllows`, `tutorialActive`), `Tutorial.tsx` (véu, anel em `opacity`, seta, cartão, modal "Primeiro grimório"), `tutorial-logic.ts`, `tutorial.css`, passos no `game-controller`. Playwright `e2e/aperta-tutorial.spec.ts` (toque emulado, DPR 2, 320, 390 e 1280 px): bloqueio fora do alvo, pular, retomar o passo 5 após recarregar e sem rolagem lateral.
- **Etapa 10 (Árvore e conquistas), pronta (21/10/2026, branch `claude/aperta-etapa-10-ff7591`):** `achievements.ts` no motor (31 conquistas da 5.3 em dados; `awardAchievements` ao fim de toque, escolha, captura, colapso, compra de nó e refazer), contadores novos em `stats` e `run.comboFullSince` (saves antigos entram zerados em `validateSave`; `mergeSaves` fica com o maior), `TreePage` (6 ramos, refazer em 2 passos devolvendo o gasto menos 20%), `AchievementsPage` e faixa dourada de conquista (some durante o tutorial). Decisão: a escondida é "Mudei de ideia" (refazer a árvore). "Horizonte de eventos" depende dos proibidos entrarem no sorteio (etapa 12). Conferida em 320, 390 e 1280 px (`e2e/aperta-tree.spec.ts`).
- **Etapa 9 (colapso e Atlas), pronta (21/10/2026, branch `claude/aperta-etapa-9-04381f`):** `CollapseModal` (2 passos; com o Atlas cheio pede a página que sai), `AtlasSection` (espaços, bônus de conjunto e botão Colapsar, na página de Grimórios), botão "Estrela pronta: colapsar" sob o HUD (fora do tutorial), `controller.collapse` com salvamento na hora e faixa "Estrela colapsada". Motor: `collapse` deixa o tutorial como `'done'`; testes de espaços 5/10/25/50 e de `validateSave` com cadeia de 10 colapsos. Decisão: o botão desabilitado com "Falta N para a estrela colapsar" e a barra ficam na página de Grimórios (no HUD só aparece quando está pronta, para caber em 320 px). Conferida em 320, 390 e 1280 px (`e2e/aperta-collapse.spec.ts`).

- **Etapa 12 (conteúdo dos colapsos 1 a 5), pronta (21/10/2026, branch `claude/aperta-etapa-12-cd2404`):** tabela de conteúdo por colapso em dados, regiões em dados com menu e troca ao colapsar, faixa "Novo no espaço", Favorito, Chuva de meteoros, Tempestade solar, Missões da estação (4 missões, +2 Fragmentos) e Gaia (a carta mostra o que muda nos números). `validateSave` rejeita conteúdo futuro e aceita saves antigos. Decisões: eventos a cada ~8 min (±25%) por 15 s, sorteados pelo tempo de jogo; o simulador não os dispara (a calibragem fica para a etapa 13). Playwright (320, 390, 768, 1280 px): `e2e/aperta-regions.spec.ts`. **Falta:** as conquistas dos colapsos 1 a 5 ("Primeira estrela colapsada", "Pegar um proibido", "Atlas com 4 páginas", "Saí do Sistema Solar"), junto da etapa 10.
- **Economia reformulada (22/10/2026, branch `claude/aperta-economia-7e0f6f`, sem push; sobrepõe a spec onde discordava):** começo com 0 de poeira (toque = 1, 1ª melhoria = 25, 1º grimório com ~50 de poeira ganha), objetos raros e fracos e só depois da 1ª melhoria, melhorias com liberação progressiva (`upgradeUnlocks`) e preço crescente (seção 5.1), grimórios em números e sem repetir melhoria (5.2, `catalog.test.ts`), ganho passivo (Hubble), `validateSave` coerente (marcos, teto de ritmo com o passivo; saves antigos válidos, poeira acima do teto novo cortada e marcada, 10.3) e vidas 1 a 5 recalibradas a ±15% (6.7). Web: só textos de Melhorias e das linhas das cartas (Gaia). **Falta:** conferir o ritmo ao vivo (a economia nova foi calibrada só pelo simulador); vidas 6 a 15 seguem provisórias.
- **Etapa 11b (arte e sons das telas novas), pronta (21/10/2026, branch `claude/aperta-etapa-11b-b6e3b5`):** nove sons novos (`page`, `ready`, `collapse`, `warp`, `chime`, `shower`, `storm`, `mission`, `star`) e variações de `whoosh`/`ding` para Asteroide e Sonda, ligados por `cues.ts` (só na mudança de estado) e pelos componentes; clarão do colapso, fade ao trocar de região, riscos da Chuva de meteoros, brilho da Tempestade solar, ícones nos chips de evento, entrada das páginas do Atlas, nó da Árvore e giro da medalha de conquista (`polish.css`), tudo em `transform`/`opacity` com reduced-motion e `is-lite`. Webb e Chandra seguem como melhorias (medalha de astro), não como objetos no campo. Conferida em 320, 390 e 1280 px. **Falta:** revisão visual do Lucas; a pilha de avisos sobrepõe a página aberta em celular quando há muitos chips (etapa 13).

### O que falta, na ordem
1. **Etapa 2, só falta o banco:** (a) o Lucas decide quando **aplicar `0009_aperta.sql`** (`pnpm db:migrate`; só cria tabela); (b) depois, conferir as rotas contra o banco real (criar, gravar, 409 com dois aparelhos, apagar e restaurar) e o diálogo de conflito no navegador com duas abas. Pendência de desenho: aviso "aberto em outro aparelho" e histórico de 5 revisões não foram feitos (ver o quadro em 10.1).
2. **Etapa 4: fechada** (ver acima).
3. **Etapa 10: fechada** (ver acima).
4. **Etapa 11: fechada no código** (11 e 11b); falta só a revisão visual do Lucas.
5. **Etapa 13:** QA responsivo com calibragem ao vivo (fecha a v1).
6. **Depois da v1:** etapas 14 a 16.

### Como retomar
- Trabalhar em worktree/branch própria cortada da `develop`, uma sessão por vez enquanto o limite de uso estiver baixo; mesclar na `develop` e dar push dela; **nada na `main` sem ordem do Lucas**.
- Comandos: `pnpm --filter @nocap/games test`, `pnpm --filter @nocap/games sim` (calibração, fora do `pnpm test`), `pnpm typecheck`. Depois de mudar `packages/games`, rebuild: `npx tsup src/index.ts --format esm,cjs --dts --clean` dentro do pacote.
- Lint geral tem erros antigos fora do Aperta! (Atravessa); não são desta spec.
