# 038 · Aperta! (clicker no espaço)

Status: **rascunho reescrito em 21/10/2026 com o jogo aprovado pelo Lucas; atualizado no mesmo dia com as respostas dele (paleta, nomes, números, dados e os 30 grimórios). Faltam as decisões pendentes da seção 14.** Só desenho; nada implementado. Substitui o primeiro rascunho desta spec (baús, Biblioteca, Cartório e Sprint com ranking, tudo **descartado**).

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
`poeira por toque = (1 + nível do Pulso Solar) x combo x sinal x grimórios x Atlas x árvore`, arredondado para baixo com mínimo 1.
`energia por toque = base + nível do Reator de Aldebarã x passo` (valores na seção 6).

### 4.2 Energia e escolha de grimório
A barra enche até o **limite do passo atual**: **60, 90, 130, 180, 240, 320** nas seis primeiras escolhas, e depois cresce `x1,35` a cada escolha (proposta). Ao encher, abre a **escolha de 1 entre 3 grimórios** (seção 4.3). Toques durante a escolha **não contam** (modal aberto). Depois de escolher, a energia volta a zero.

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
Aparecem no campo a cada **9 s** (6 s com a Sonda Kepler), no máximo **2** na tela (3 com a Kepler), duram **7 s** e mostram uma **barra de vida**, **anel pulsante** e uma **etiqueta com a recompensa** antes de tocar. Não aparecem no tutorial, em modais nem com o jogo pausado. Ao capturar: anel que se expande, texto flutuante e faixa **"<Objeto> capturado: <efeito>"**. Também funcionam por teclado (cada um é um botão com `aria-label`).

| Objeto | Efeito | Valor inicial |
| --- | --- | --- |
| **Cometa** (mais comum) | poeira instantânea | `30 + 15 x nível do Pulso`, em unidades de toque após o rebalanceamento (seção 6) |
| **Estrela cadente** | energia instantânea | +4 (em passos de energia, ver 6.3) |
| **Satélite** | "Sinal forte": poeira x2 | por 8 s, com contagem no HUD |

Sorteio: cometa 50%, estrela 25%, satélite 25%. Nada pune quem não pega.

### 4.6 Tutorial guiado (obrigatório, só seguir ou pular)
Véu escuro sobre tudo, **spotlight** no elemento certo (brilho que pulsa em `opacity`), **seta** "Toque aqui" e um cartão de coach no topo ("Tutorial · passo N de 5", título, texto, **Pular tutorial**). Todo o resto fica bloqueado e esmaecido (inclusive o X das páginas).
1. **Aperte o botão:** o primeiro toque ganha poeira e abre o **Primeiro grimório** (sempre **Lua**).
2. **Entendi** fecha o modal e entrega poeira suficiente para a 1ª compra.
3. **Hora de melhorar:** seta no botão **Melhorias**.
4. **Compre sua primeira melhoria:** seta no preço do **Pulso Solar** (as outras linhas ficam bloqueadas).
5. **Agora os grimórios:** seta no ícone de livro; a página mostra o álbum, o trancado e o Atlas; botão **Começar a jogar**.
Pular marca o tutorial como feito no save. O progresso do tutorial é salvo (voltar no meio retoma no passo).

### 4.7 Proteção contra clique acidental
- Escolha de grimório: **cartas bloqueadas por 1,6 s** (barra de contagem) e **2 passos** (selecionar, depois confirmar).
- **Colapsar** e **Apagar save** também em 2 passos.
- Ao abrir um modal com o dedo ainda no botão: toques ignorados nos primeiros 300 ms.
- Botão sem saldo mostra "falta N" e não compra; nunca compra por clique duplo acidental (ignora o 2º toque em 250 ms).

## 5. Melhorias, grimórios e conquistas (catálogo)

### 5.1 Melhorias (poeira; custo `base x 1,65^nível`)
Valores de **efeito** e **base** são ponto de partida (seção 6 reescala).

| # | Melhoria (nome real) | Efeito por nível | Base (mockup) | Libera |
| --- | --- | --- | --- | --- |
| 1 | **Pulso Solar** | +1 poeira por toque | 25 | início |
| 2 | **Ressonância de Vênus** | **libera o combo**; níveis seguintes: +janela | 90 | início |
| 3 | **Reator de Aldebarã** | +energia por toque | 140 | início |
| 4 | **Alinhamento das Plêiades** | combo máx. +1 (exige a Ressonância) | 260 | após a Ressonância |
| 5 | **Sonda Kepler** | mais objetos no espaço e mais rápidos | 200 | início |
| 6 | **Telescópio Hubble** | objetos valem +10% por nível | a definir | após 3 escolhas |
| 7 | **Voyager** | satélites duram +1 s por nível | a definir | após 8 escolhas |
| 8 | **Observatório James Webb** | melhorias custam -2% por nível (teto) | a definir | após o 1º colapso |

Níveis máximos por melhoria (para não quebrar a economia): 30 na maioria, 5 a 10 nas de efeito qualitativo (Kepler, Plêiades, Voyager).

### 5.2 Grimórios (30 no lançamento, **lista aprovada pelo Lucas**)
A família define o **bônus de conjunto** do Atlas (seção 8.2). Cada grimório é **dado** (id, nome, plaquinha, raridade, família, efeito, arte), montado só com as primitivas da seção 7.3. **Arte:** livro com cor por raridade (comum cinza-azul, raro azul com borda ciano, épico roxo com dourado e anel girando, lendário dourado que flutua, proibido preto com rachadura vermelha) e uma **medalha** redonda com o astro em SVG (esfera com sombreamento radial). Os efeitos são em **percentual** (os absolutos do mockup viram "% de um toque"). Na tabela, **Arte** é o desenho da medalha.

**Comuns (10)**
| Grimório | Família | Efeito | Arte |
| --- | --- | --- | --- |
| Lua | Luas | a cada 10 toques, +5 toques de poeira | esfera cinza clara com crateras |
| Mercúrio | Planetas | energia enche 10% mais rápido | esfera marrom-cinza, crateras pequenas |
| Vênus | Planetas | objetos duram 2 s a mais | esfera creme-dourada com faixas de nuvem |
| Marte | Planetas | cometas dão +25% | esfera ferrugem com calota polar branca |
| Ceres | Pequenos corpos | melhorias custam 3% menos | rocha cinza com ponto brilhante |
| Fobos | Luas | estrelas cadentes dão +25% de energia | rocha irregular com uma cratera grande |
| Io | Luas | satélites duram +2 s | esfera amarelo-enxofre com manchas vermelhas |
| Vesta | Pequenos corpos | +5% de poeira por toque | rocha clara com faixa escura |
| Halley | Pequenos corpos | objetos aparecem 10% mais rápido | núcleo claro com cauda azul |
| Urano | Planetas | janela do combo +10% | esfera ciano-gelo com anel fino vertical |

**Raros (8)**
| Grimório | Família | Efeito | Arte |
| --- | --- | --- | --- |
| Europa | Luas | o combo dura 20% mais | esfera branca com rachaduras marrons |
| Titã | Luas | cada vida começa com poeira extra (1 nível do Pulso) | esfera laranja com névoa |
| Júpiter | Planetas | todo 10º toque vale o triplo | esfera com faixas marrons e a grande mancha vermelha |
| Saturno | Planetas | melhorias custam 8% menos | esfera dourada com anéis inclinados |
| Netuno | Planetas | satélites duram o dobro | esfera azul-profundo com faixa branca |
| Ganimedes | Luas | +10% de energia por toque | esfera cinza com sulcos claros |
| Plutão | Pequenos corpos | objetos valem +12% | esfera bege com "coração" claro |
| Tritão | Luas | cada objeto capturado dá +2% da barra de energia | esfera rosada com calota de gelo |

**Épicos (6)**
| Grimório | Família | Efeito | Arte |
| --- | --- | --- | --- |
| Sirius | Estrelas | combo máximo +2 | estrela branca de 4 pontas com halo azul |
| Vega | Estrelas | +15% de poeira por toque | estrela branco-azulada de 8 raios |
| Betelgeuse | Estrelas | troque 1 das 3 opções (1 vez por escolha) | gigante laranja com manchas |
| Polaris | Estrelas | o toque depois de capturar um objeto vale x5 | estrela azul-branca com halo fino |
| Antares | Estrelas | objetos valem +20% | gigante vermelha com brilho |
| Nebulosa do Caranguejo | Nebulosas e galáxias | grimório repetido sobe 2 níveis | filamentos laranja e azuis |

**Lendários (3)**
| Grimório | Família | Efeito | Arte |
| --- | --- | --- | --- |
| Nebulosa de Órion | Nebulosas e galáxias | ao encher a energia, escolha 2 grimórios | nuvem rosa, turquesa e violeta com estrelas |
| Via Láctea | Nebulosas e galáxias | cada grimório raro vale +10% de poeira | galáxia espiral de 4 braços |
| Andrômeda | Nebulosas e galáxias | cada colapso já feito dá +3% de poeira por toque | espiral inclinada com núcleo claro |

**Proibidos (3)** (mudam uma regra, com preço; o preço aparece em vermelho no cartão)
| Grimório | Família | Efeito e preço | Condição | Arte |
| --- | --- | --- | --- | --- |
| Sagitário A* | Buracos negros | poeira por toque x3, **mas a energia enche 70% mais devagar** | `n >= 22` | disco de acreção dourado ao redor de círculo preto |
| Cygnus X-1 | Buracos negros | combo máximo x2 e janela x2, **mas os objetos no espaço param de aparecer** | só depois do 3º colapso | buraco negro com estrela azul companheira |
| M87* | Buracos negros | melhorias custam 30% menos, **mas cada energia para o próximo grimório custa +25%** | só depois do 5º colapso | buraco negro com jato de luz |

Famílias: **Planetas 7 · Luas 7 · Pequenos corpos 4 · Estrelas 5 · Nebulosas e galáxias 4 · Buracos negros 3** (30). Livros escondidos aparecem como "???" com a medalha de cadeado até a descoberta.

### 5.3 Conquistas (~24 no lançamento)
Cada uma com ícone, barra de progresso e "N/M"; ao ganhar, faixa de aviso (`transform`/`opacity`). Sem recompensa de poder na v1 (decisão 14.16).
- **Toques:** Primeiro toque (1), 100, 1.000, 10.000, 100.000 toques.
- **Poeira:** juntar 1 mil, 1 mi, 1 bi (na vida e no total).
- **Grimórios:** Colecionador de planetas (10 descobertos), 20 descobertos, os 30, um de cada raridade, a primeira vez em cada nível 5 e 10.
- **Objetos:** Caçador de cometas (20), 100, 500 capturados; capturar 10 satélites em sequência.
- **Combo:** chegar ao combo máximo; manter 30 s.
- **Colapsos:** Horizonte de eventos (pegar um grimório proibido), colapsar 1, 5, 10, 25 e 50 vezes; Atlas com todas as famílias.
- **Árvore:** comprar o 1º nó; completar um ramo.
- **Escondida:** uma conquista surpresa (por exemplo, apertar o botão no título sem entrar).

## 6. Economia e balanceamento

### 6.1 Metas de duração
- **1º colapso: 6 a 10 horas de jogo aberto, espalhadas em vários dias** (sem renda offline). Uma sessão boa tem 20 a 40 min.
- Cada colapso seguinte: **~60% do tempo do anterior** no começo, subindo de novo com o Atlas e a árvore; o 10º colapso em ~40 a 60 h de jogo.
- **Ascender (camada 2):** meta de dezenas de colapsos por ciclo, "quase infinito".
- Primeira escolha de grimório: **~2 a 4 min** de jogo (para o jogador ver a graça antes de enjoar); as escolhas seguintes se espaçam (seção 6.3).

### 6.2 Valores iniciais fixados (o Lucas pediu que eu decidisse; o simulador da etapa 1 ajusta)
Escolhi o conjunto mais balanceado que a simulação rápida (6.3) sustentou: **1º colapso em ~6 a 10 h para o ritmo normal**, começo lento e sem "paredes". É a versão 0 das tabelas do motor; o simulador oficial corrige em arquivos de dados, não no código.
- **Custo:** `custo(nível) = base x 1,65^nível`, arredondado; descontos (Ceres, Saturno, M87*, Webb, árvore) **multiplicativos com piso de 40%** do custo.
- **Melhorias (base já x60 do mockup):** Pulso Solar **1.500** (máx. 30), Ressonância de Vênus **5.400** (máx. 10), Reator de Aldebarã **8.400** (máx. 20), Alinhamento das Plêiades **15.600** (máx. 5), Sonda Kepler **12.000** (máx. 5), Telescópio Hubble **30.000** (máx. 20), Voyager **60.000** (máx. 8), Observatório James Webb **120.000** (máx. 10).
- **Efeito do Pulso Solar:** +1 poeira por toque por nível. **Reator:** +0,125 de energia por toque por nível (máx. +2,5).
- **Energia:** base **0,25 por toque**; passos de escolha **60, 90, 130, 180, 240, 320** e depois **x1,35** por escolha.
- **Objetos:** cometa = **20 toques de poeira** (cresce com Hubble e grimórios), estrela cadente = **+10% da barra atual** (mín. 2), satélite = **x2 por 8 s**.
- **Grimório repetido:** +50% do efeito por nível, **nível máx. 10**.
- **Colapso:** estrela pronta com **2 mi de poeira acumulada na vida e >= 20 escolhas**; `meta(k) = 2 mi x 3^(k-1)` (a calibrar para o 2º colapso levar ~60% do 1º com Atlas e árvore).
- **Atlas:** página a **60%**, 3 espaços iniciais, bônus de conjunto da seção 8.2.
- **Metas de tempo:** 1º colapso em **6 a 10 h** de jogo aberto no ritmo normal (2,5 toques/s); 10º colapso em **40 a 60 h**.

### 6.3 O que o simulador de rascunho mostrou (e por que reescalar)
Rodei uma simulação rápida e **descartável** (jogador que toca 2,5 vezes por segundo, compra sempre a melhoria de melhor retorno, grimórios dando +3% de poeira por escolha, combo cheio) com os números do mockup (base 25 a 260, **+1 energia por toque**, passos 60 a 320 e depois x1,25):
- **Com os números do mockup, a 1ª hora já chega ao nível ~14 em todas as melhorias e a ~24 grimórios.** Mais de **8 a 10 vezes mais rápido** que a meta. Não serve.
- Com **custos base x60**, energia base de 1 por toque (+0,25 por nível do Reator) e passos x1,35 depois do 6º: em 8 h os níveis ficaram em ~10/8/7/6/6 e ~2,2 mi de poeira acumulada, **na faixa de 6 a 10 h**. Mas saíram **~12 escolhas de grimório na 1ª hora**, rápido demais para "começo MUITO mais lento"; por isso a energia base fixada em 6.2 é **0,25**, que leva a 1ª barra (60) a ~2 min no ritmo normal.
- O jogador real tem sessões, pausas, objetos e combo; o simulador oficial (6.5) modela **três perfis** (casual 1 toque/s, normal 2,5, compulsivo 6 com o teto) e dá as horas de jogo aberto de cada marco.

### 6.4 Ganhos por colapso
- **Fragmentos** por colapso: `3 + nº do colapso` + `floor(log10(poeira da vida / 2 mi))` quando positivo.
- **Atlas:** a página fica com 60% do poder (8.2).

### 6.5 Simulador de economia (proposta)
Um script em `packages/games` (`aperta/sim`, rodado por um comando `pnpm`) que **usa o próprio motor do jogo** (mesmas funções, sem cópia da regra) e simula jogadores por perfil e estratégia de compra (gulosa, só toque, mista). Entradas: tabelas de custo, efeitos, pesos, passos de energia. Saídas: tabela de **horas de jogo aberto até cada marco** (1ª melhoria, 1ª escolha, 10 escolhas, ~1 mi, estrela pronta, 2º colapso, 10º colapso), **distribuição de grimórios**, quanto cada grimório vale (retorno por escolha) e **alertas** (grimório que domina, ramo da árvore que quebra, valor que passa de 1e15). Testes automatizados: "1º colapso do perfil normal entre 6 e 10 h" falha o build se uma mudança de número sair da faixa; "nenhum caminho dá infinito ou NaN".

## 7. Motor (lógica em `packages/games/src/aperta/`)

### 7.1 Estado
`SaveState` = { `version`, `name`, `createdAt`, `playSeconds`, `tutorial` (passo ou concluído), `storySeen`, `run` { `dust`, `dustLife`, `energy`, `picks`, `upgradeLevels[]`, `build` { grimórioId -> nível }, `clicks`, `combo`, `boostUntil`, `rngState` }, `album` (descobertos), `atlas` { `slots`, `pages` [{ grimórioId, nível }] }, `collapses`, `fragments` { `earned`, `spent` }, `tree` (nós e níveis), `achievements`, `stats` (toques, objetos, etc.) } e, mais tarde, `ascensions` e `constellations`.

### 7.2 Funções puras (todas testadas)
`newSave(seed)`, `press(state, now)`, `tickObjects(state, now)`, `captureObject(state, id)`, `buyUpgrade(state, i)`, `drawGrimoires(state)` (3 sem repetir, por peso), `chooseGrimoire(state, id)`, `canCollapse(state)`, `collapse(state, pageId)`, `respecTree(state)`, `buyTreeNode(state, id)`, `effectiveStats(state)` (junta melhorias, grimórios, Atlas, bônus de conjunto e árvore em números finais), `validateSave(raw)` (formato e coerência, seção 10), `mergeSaves(a, b)`.

### 7.3 Primitivas de efeito (todo grimório e nó da árvore usa só estas)
`dustPerTouchPct`, `energyPerTouchPct`, `energyFillRate`, `everyNthTouch(n, mult)`, `objectDuration`, `objectSpawnRate`, `objectValuePct` (por tipo), `comboMax`, `comboWindow`, `upgradeCostPct`, `startDust`, `choiceExtra` (reroll, 2 escolhas, repetido +2 níveis), `forbiddenTradeoff`. Isso mantém os 30 grimórios (e os futuros) como **dados** e o motor pequeno.

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
Proposta: quando o jogador chega a **N colapsos** (a calibrar, ~25), pode **Ascender**: zera colapsos, Fragmentos e árvore (mantém **álbum, conquistas e Atlas**) e ganha **Constelações** (moeda permanente) que dão um multiplicador global e destravam grimórios e espaços novos. Cada ascensão pede mais colapsos que a anterior. Fica fora da v1 (etapa 12) para a economia da camada 1 ser calibrada antes.

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
- **Por save (dentro do `data`):** vida atual (poeira, energia, melhorias, grimórios e níveis, combo), **álbum de grimórios**, **Atlas Eterno**, **Fragmentos e árvore**, **colapsos**, **conquistas**, **estatísticas**, **passo do tutorial** e **história vista**. Os **2 saves por conta são independentes** (álbum e conquistas por save).
- **Por conta:** preferências (som ligado, efeitos reduzidos). Nada de progresso fica só no aparelho.
- Colunas desnormalizadas (`collapses`, `picks`, `dust_log10`, `play_seconds`) servem para validar e mostrar a lista de saves sem abrir o JSON. `ON DELETE CASCADE` só ao apagar a conta.

### 10.2 API (módulo `apps/api/src/aperta/`)
- `GET /me/aperta/saves` (resumo dos 2 saves), `GET /me/aperta/saves/:slot` (completo) e `GET/PUT /me/aperta/settings`.
- `PUT /me/aperta/saves/:slot` `{ data, baseRevision, deviceId }`: valida, junta e grava; `409` com o save atual se `baseRevision` ficou velho ou se outro aparelho está ativo.
- `POST /me/aperta/saves/:slot/takeover` `{ deviceId }`: assume o save neste aparelho (o outro passa a receber `409` e vira somente leitura).
- `DELETE /me/aperta/saves/:slot` (apagar; 2 passos no cliente).
- Convidado (sem conta) recebe `401`.

### 10.3 Validações no servidor (sem ranking, mas sem valor impossível)
O servidor usa a **mesma função de validação de `packages/games`** (`validateSave`, `mergeSaves`):
1. **Formato:** zod do `SaveState`; limites de tamanho; ids só do catálogo; níveis dentro dos máximos.
2. **Coerência de gastos:** soma dos custos dos níveis de melhoria <= poeira total ganha na vida; grimórios por nível somam <= escolhas feitas (`picks`); páginas do Atlas <= espaços do nº de colapsos; Fragmentos gastos <= `earned`; `earned` coerente com `collapses`.
3. **Ritmo possível:** `dustLife <= playSeconds x teto de poeira por segundo` calculado pelo motor para o que foi comprado (com teto de 12 toques/s) e `playSeconds <= tempo desde created_at`. Estourou: **corta ao valor possível** e marca `flagged` (não bane).
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
| **Aba em segundo plano e relógio** | Relógio do jogo pausa; nada rende parado; o servidor não usa a hora do aparelho para progresso. |
| **Mockup fora dos tokens Pop Brutal** | Resolvido: exceção nomeada só para a tela do Aperta! (seções 11 e 13); falta o Lucas confirmar o registro em RULES.md. |
| **Desempenho em celular fraco** | Camadas `transform`, sem animar sombra/filtro, redução automática de efeitos, medir no QA. |

## 13. Mockup e regras do projeto (resolvido pelo Lucas)

O Lucas decidiu em 21/10/2026 que o Aperta! usa o **tema do mockup**: paleta azul-noite/azul/ouro/vermelho, **gradientes e sombreamento radial** nos astros e as fontes **Chakra Petch** e **Space Grotesk**. Isso deixa de ser divergência e vira uma **exceção nomeada e restrita à tela do jogo** (seção 11). Passos de implementação:
1. **Registrar a exceção em `.claude/rules/RULES.md` (e em `CLAUDE.md`, onde a regra 6 é citada):** "o tema espaço do Aperta! usa tokens próprios `--space-*`, definidos em um só arquivo; o resto do app continua Pop Brutal". **Esse arquivo é de regras permanentes e quem registra é o Lucas (ou um commit dele); fica fora do commit desta spec** até ele confirmar, porque a mudança veio por mensagem entre sessões. Texto pronto na seção 14.
2. **O que continua proibido, mesmo no tema espaço:** emoji; animar qualquer propriedade que não seja `transform`/`opacity`; ignorar `prefers-reduced-motion`.
3. **Ajustes do mockup que ainda são necessários** (não são paleta): o destaque do tutorial e o afundar do botão animam `box-shadow`; no oficial viram `opacity`/`transform` de um elemento irmão. O "Modo demonstração" (20x mais rápido) vira flag de desenvolvimento, fora da tela final.

## 14. Decisões (resolvidas e em aberto)

### Resolvidas pelo Lucas (21/10/2026)
1. **Paleta, gradientes e fontes:** **RESOLVIDA.** Tema do mockup, com tokens `--space-*` em um só arquivo; resto do app segue Pop Brutal (seções 11 e 13).
2. **Nomes:** **RESOLVIDA.** Poeira estelar, Fragmentos, Colapsar a estrela, Atlas Eterno, Árvore de Habilidades, grimórios, Cometa, Estrela cadente e Satélite.
3. **Números de balanceamento e custos:** **RESOLVIDA** (Lucas delegou; valores fixados na seção 6.2, inclusive o custo de refazer a árvore). O simulador da etapa 1 calibra. As antigas 4 (meta de tempo: 6 a 10 h no ritmo normal, 40 a 60 h até o 10º colapso) e 5 (repetido +50% por nível, máx. 10) ficam **resolvidas por esta**.
6. **Os 30 grimórios:** **RESOLVIDA.** Lista aprovada e detalhada com nome, efeito e arte (seção 5.2).
9. **Fragmentos e árvore:** **RESOLVIDA** (`3 + nº do colapso` + bônus por poeira; refazer devolve tudo menos 20%; seção 8.3).
11. **Álbum/conquistas por save ou por conta:** **RESOLVIDA.** Tudo no banco, ligado à conta, e **2 saves independentes** por conta, cada um com álbum, Atlas e conquistas próprios.
12 (parte de dados). **RESOLVIDA.** Exige conta; o servidor é a fonte da verdade; qualquer aparelho carrega o mesmo save (seção 10).
18. **Mesmo save em dois aparelhos:** **RESOLVIDA.** Sincroniza entre aparelhos e avisa em caso de conflito (seção 10.4).

### Ainda pendentes (com a minha recomendação)
4 e 5: já resolvidas por 3 (acima). Restam:
7. **Proibidos:** aprova Sagitário A* (a partir de 22 escolhas), Cygnus X-1 (após o 3º colapso) e M87* (após o 5º), com os preços da tabela? *Recomendo sim.*
8. **Atlas:** começa com **3 espaços** (+1 nos colapsos 5, 10, 25 e 50, total 7) e, com tudo cheio, o colapso **troca** uma página? Os bônus de conjunto por família da 8.2 servem? *Recomendo sim aos dois.*
10. **Ascender (camada 2):** entra **depois da v1** (etapa 12) com a regra proposta (zera colapsos e árvore, guarda álbum, conquistas e Atlas, dá Constelações a partir de ~25 colapsos) ou na v1? *Recomendo depois da v1: calibrar a camada 1 primeiro.*
12 (parte restante). **Jogar sem rede:** depois de aberto, o jogo **continua se a internet cair** (cópia local, sobe depois), mas **exige conta e internet para começar**? *Recomendo sim.*
13. **Apagar save:** 2 passos e **recuperável por 7 dias**, ou definitivo? *Recomendo 2 passos e 7 dias.*
14. **Sons:** aprova a lista (`clack` com tom subindo no combo, `whoosh`, `ding`, `flip`, `thunk`, `win`, `boing`)? Música de fundo e vibração no Android? *Recomendo a lista, sem música na v1 e vibração só no Android, desligável.*
15. **Modo demonstração** do mockup (20x): fica só como flag de desenvolvimento? *Recomendo sim (fora do app final).*
16. **Conquistas:** a lista da 5.3 serve? Dão só **medalha** ou também **bônus pequeno**? *Recomendo só medalha na v1.*
17. **Ordem das etapas:** confirma a ordem da seção 15, começando pelo **motor e simulador**? *Recomendo sim.*
19. **Convidado:** o cartão aparece no Arcade com "Entre para jogar" ou **só aparece para quem tem conta**? *Recomendo aparecer com "Entre para jogar".*
20. **Segurar a tecla:** permitir **segurar Espaço/Enter** para repetir (até 6/s) ou só toque a toque? *Recomendo permitir, por causa do cansaço do clique.*

### Para o Lucas confirmar: exceção de regra (item 1)
A mudança em `.claude/rules/RULES.md` e `CLAUDE.md` **não foi feita nesta sessão** (regras permanentes só mudam por pedido direto do Lucas, não por mensagem de outra sessão). Texto pronto, para colar quando o Lucas disser "sim":
- `RULES.md`, na lista "Nunca", trocar "Usar emoji, gradiente genérico, Inter/Roboto, ou cores fora dos tokens Pop Brutal." por: "Usar emoji, gradiente genérico, Inter/Roboto, ou cores fora dos tokens Pop Brutal, **exceto a tela do Aperta! (spec 038)**: o tema espaço do Aperta! usa tokens próprios `--space-*`, definidos em um só arquivo; o resto do app continua Pop Brutal."
- `CLAUDE.md`, regra 6: acrescentar "(exceção: tela do Aperta!, tokens `--space-*`; spec 038)".

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
12. **QA responsivo e calibragem ao vivo.** *Escopo:* 320, 390, 768, 1024, 1280 e 1920 px, toque e mouse e teclado, calibrar a economia jogando com o Lucas (ajustar tabelas pelo simulador), `Ascender` (camada 2) se aprovada. *Pronto quando:* o Lucas aprova jogar por 1 a 2 dias e o ritmo bate com a meta. *Commit:* `fix(games): calibragem do Aperta!` (e, depois, `feat(games): Ascender no Aperta!`).

**Ordem de dependência:** 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12. As etapas 5, 6 e 7 só dependem da 4 e podem trocar de ordem se o Lucas preferir (decisão 14.17).
