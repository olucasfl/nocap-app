# 038 · Jogo clicker (incremental): apertar o botão, abrir baús, renascer

Status: **rascunho (21/10/2026), aguardando as decisões do Lucas (seção 13).** Só pesquisa e desenho; nada foi implementado. Nome de trabalho: **Botão** (o nome final é decisão do Lucas).

Pedido do Lucas: um jogo clicker (incremental) para o NoCap, depois de estudar o Cookie Clicker e o novo Click the Button. Esta spec resume a pesquisa, propõe o jogo, a economia e o encaixe no app, e termina com as perguntas.

## 1. Pesquisa

### 1.1 Click the Button (LoopCap, Steam, lançado em 26/08/2026)

Fatos confirmados em mais de uma fonte:
- **Jogo incremental curto e barato:** US$ 3,99, só Windows (há versão nativa para Linux depois), demo lançada em 15/06/2026. Suporte completo a português do Brasil (interface, áudio e legendas), mas **não achei nada que confirme que a equipe é brasileira**: a Steam só mostra a LoopCap como desenvolvedora e distribuidora. Vale conferir com o Lucas de onde veio a informação.
- **Recepção:** "Muito positivas", 89% a 94% de aprovação conforme a fonte e o dia (entre ~1,7 mil e ~4,8 mil avaliações; os números variam porque as páginas foram capturadas em momentos diferentes). A demo tem ~92% a 93% de aprovação (236 a 282 avaliações). A comunidade comemorou "100.000 CLICKS" e o jogo ganhou Steam Cloud um dia depois do lançamento.
- **Loop principal (o mesmo descrito por todos os guias):** clicar no botão vermelho, o que faz **aparecer um baú**; abrir o baú dá **itens** de várias raridades; **vender** os itens vira dinheiro; o dinheiro compra **melhorias** (velocidade de abertura, multiplicador, valor de venda, sorte, automação); **metas de coleção** (a "Enciclopédia") pagam uma moeda roxa; **renascer** zera a corrida e guarda o progresso da **árvore de habilidades** comprada com a moeda roxa. Há baús de raridades diferentes (Real e Blindado aumentam a chance de baús raros e épicos), uma **máquina de gacha** de "cuties" (com versão dourada, desbloqueada na árvore) e uma conquista escondida.
- **Escopo:** ~30 itens em 6 raridades (de "Quebrado" a "Extraterrestre"), 15 conquistas na Steam (cliques 100/1.000/10.000, coleções por raridade, abrir cada baú 1.000 vezes, ter 1.000 de cada item, maximizar a árvore, gacha completo, escondida). **Cerca de 1 a 3 horas para 100%** (guias falam em 70 a 120 min para o primeiro 100%).
- **Por que funciona (síntese, a partir das resenhas e guias):**
  1. **Entrada instantânea:** um botão, nenhuma história, nenhum tutorial. A resenha japonesa descreve o vício como "só mais uma vez".
  2. **Cada clique tem um resultado visível e variável:** o baú é uma **máquina de recompensa variável** (raridade sorteada), não só um número subindo. Isso tira o tédio do "+1".
  3. **Duas camadas de coleção:** o dinheiro (curto prazo) e o álbum de itens (médio prazo) puxam em direções diferentes, então sempre há algo "quase lá".
  4. **Renascer com árvore de habilidades:** o reinício deixa de ser perda, porque o jogador escolhe o que fica.
  5. **Sessões curtas, preço baixo, "só mais uma"**, com um alvo de 100% alcançável.
- **O que os jogadores reclamam:** **curto demais** (reembolsos por terminar em ~1,6 h; "fun but very short, 2-3 hours"); **repetitivo/entediante** para alguns; **taxa de queda frustrante** (reclamação de que um item de "3%" não saiu em milhares de cliques, "faltou 1 item"); **cansaço do clique** (brincam que destroem o botão do mouse; há guias intitulados "No Click Fatigue"). Ninguém reclamou de trapaça; o jogo é solo e não tem ranking.

### 1.2 Cookie Clicker (Orteil, 2013)

- **Loop:** clicar no biscoito gigante, comprar **construções** que produzem sozinhas (cada tipo é mais caro e produz mais), comprar **melhorias** que multiplicam. O custo de cada construção cresce **~15% por unidade comprada** (dobra a cada ~5), então a curva é exponencial e o jogador sempre tem uma meta a poucos minutos.
- **Prestígio (Ascensão):** zerar em troca de "chips celestiais", que dão bônus **permanente de +1% por chip**; o custo de cada nível de prestígio cresce com o **cubo** do nível, o que faz cada reinício render menos por esforço e dá o ritmo de longo prazo.
- **Biscoito dourado:** aparece em lugar aleatório por pouco tempo; clicar dá um bônus temporário. É **recompensa variável e atenção ativa** mesmo no jogo "parado".
- **Conquistas e textos:** muitas conquistas ("pequenos marcos"), notícias engraçadas no rodapé, construções cada vez mais absurdas. Cada ganho tem retorno visual e sonoro.
- **Produção parada:** o jogo continua enquanto a aba está aberta, então dá para sair e voltar para gastar.
- **Armadilhas apontadas (artigo do Game Developer, 2013):** **trapaça é fácil** sem conta (o jogo transforma isso em uma conquista de "trapaceiro"); **saturação** (o jogador para quando a mente "enjoa" e as recompensas deixam de ser novas); e o desenho depende de **laços de reforço positivo**, sem perda real.
- **O que enjoa:** depois do começo, o clique perde relevância e vira otimização passiva; recompensas ficam espaçadas; sem fim claro.

### 1.3 O que dá para adaptar
- **Do Click the Button:** baú como unidade (clique, recompensa variável e raridade), álbum de itens, renascer com árvore, escopo pequeno e sessões curtas.
- **Do Cookie Clicker:** curva exponencial de custos (1,15), recompensa ativa aleatória (o "baú dourado"), conquistas e marcos frequentes no começo.
- **O que evitar:** campanha de 2 h (fazer ter pelo menos ~8 a 10 h de conteúdo ou um modo que se repita bem); frustração de sorte (usar **proteção de azar**, ou "pity", para itens faltantes); cansaço do clique (clicar segurando a tecla ou o dedo, auto-clique como progressão, sem exigir milhares de cliques seguidos); e economia que só cheira a número.

### 1.4 Limites desta pesquisa (para o Lucas saber)
A rede em que a sessão rodou **bloqueia** (filtro corporativo ou erro de certificado) a página da Steam, os fóruns da comunidade, os wikis e as resenhas longas. Usei **resultados de busca (resumos)** em vez de ler essas páginas por completo; por isso **não li avaliações individuais nem threads de Reddit/fóruns** (as buscas não devolveram nenhuma sobre este jogo) e não tenho números de vendas. As reclamações acima vêm de trechos de avaliações da Steam citados nos resultados. Se o Lucas quiser, vale ler a página de avaliações da Steam direto antes de fechar o desenho.

### 1.5 Fontes
- [Click the Button (Steam)](https://store.steampowered.com/app/3946950/Click_the_Button/) e [em português](https://store.steampowered.com/app/3946950/Click_the_Button/?l=portuguese) · [Demo (Steam)](https://store.steampowered.com/app/4805850/Click_the_Button_Demo/)
- [Steam Community: Click the Button](https://steamcommunity.com/app/3946950) · [SteamDB](https://steamdb.info/app/3946950/) · [Wasdland (números de avaliações)](https://www.wasdland.com/game/click-the-button-3946950/)
- [Resenha (note.com, 4/5)](https://note.com/inari_229/n/nc00b3a54753a?hl=en) · [Resenha Minna no Indie](https://minna-no-indie.com/articles/click-the-button-incremental-review/)
- Guias e wikis: [Click the Button Wiki](https://clickthebutton.wiki/) · [Gacha](https://clickthebutton.wiki/guides/gacha/) · [How to play](https://clickthisbutton.wiki/guides/how-to-play/) · [Conquistas](https://clickthisbutton.wiki/achievements/) · [Walkthrough 100% (9Puz)](https://9puz.com/5287-click-the-button-100-walkthrough/) · [Guia sem cansaço do clique (Prodigy Gamers)](https://prodigygamers.com/2026/08/28/click-the-button-100-achievement-guide-walkthrough-no-click-fatigue/) · [GameFAQs: conquistas](https://gamefaqs.gamespot.com/pc/638648-click-the-button/achievements)
- Cookie Clicker: [The recipe behind Cookie Clicker (Game Developer)](https://www.gamedeveloper.com/design/the-recipe-behind-cookie-clicker) · [Wikipedia](https://en.wikipedia.org/wiki/Cookie_Clicker) · [Wiki de construções](https://cookieclicker.wiki.gg/wiki/Building) · [How Cookie Clicker's progression works](https://dinogame.gg/blog/how-cookie-clicker-progression-works/) · [Incremental game (Wikipedia)](https://en.wikipedia.org/wiki/Incremental_game)

## 2. Conceito

Um botão enorme no meio da tela. **Cada toque abre um baú** que solta um item de raridade sorteada; o item **vira moedas**; as moedas compram melhorias; a coleção de itens enche um **álbum**; quando a corrida emperra, a pessoa **renasce** e escolhe o que fica para sempre numa **árvore**. É o Click the Button com a curva de custos do Cookie Clicker, no visual Pop Brutal.

Dois modos, porque jogo incremental e ranking brigam entre si:

1. **Campanha** (o jogo principal, offline, salvo no aparelho e na conta). Longa, sem ranking.
2. **Sprint** (60 segundos, mesma regra para todos, com **ranking e Daily**). É onde mora a competição, e é verificável no servidor (seção 7).

## 3. Loop principal (campanha)

1. **Tocar** no botão (mouse, toque, tecla Espaço/Enter; segurar repete a 6 toques/s no máximo).
2. O toque abre um **baú**: sorteia o item (raridade pela tabela de chance do baú) e ele cai na **mochila**.
3. **Vender** os itens (automático por padrão, com a opção de guardar duplicatas no álbum) vira **moedas**.
4. **Gastar moedas** em melhorias (seção 5): valor, sorte, clique duplo, autoclique, baús melhores.
5. **Primeira vez que cada item sai** entra no **álbum** e paga **fichas** (a moeda do renascer); metas de coleção pagam mais.
6. A cada 60 a 120 s aparece o **Baú Dourado** (toque rápido para um bônus de 10 a 20 s).
7. Quando a corrida emperra, **Renascer**: zera moedas, melhorias e baús, **mantém o álbum, as conquistas e a árvore**; ganha fichas e um bônus permanente.

Sessão alvo: **3 a 10 minutos** sem culpa; progresso offline de até 8 h (decisão aberta 13.4).

## 4. Economia e números iniciais (ponto de partida; calibrar com simulador)

Todos os valores abaixo são **chutes de partida**; a etapa 1 do plano cria um **simulador** em `packages/games` para ajustar até a campanha durar o alvo (seção 12).

### Itens e raridades (30 itens, 5 por raridade)
| Raridade | Chance base por baú | Valor de venda |
| --- | --- | --- |
| Comum | 74% | 1 |
| Incomum | 20% | 3 |
| Raro | 5% | 12 |
| Épico | 0,9% | 60 |
| Lendário | 0,095% | 400 |
| Mítico | 0,005% | 3.000 |

Valor esperado do primeiro toque: **~3 moedas por clique**. Os nomes dos 30 itens e a arte são trabalho de conteúdo (decisão aberta 13.9); formas de objetos do cotidiano que ficam mais absurdas a cada raridade (estilo Cookie Clicker).

### Baús (tiers), que sobem a chance das raridades altas
Madeira (padrão), **Bronze** (500 moedas para destravar), **Prata** (8 mil), **Ouro** (150 mil), **Cósmico** (5 milhões). Cada tier multiplica as chances de Raro ou melhor (x1,5; x2; x3; x5 ...), sem mexer no valor de venda.

### Melhorias (moedas; custo = base x 1,5^n, como o 1,15 do Cookie Clicker mas por nível)
| Melhoria | Efeito por nível | Custo base | Máximo |
| --- | --- | --- | --- |
| Valor de venda | +10% | 25 | 50 |
| Sorte | +4% de chance relativa nas raridades altas | 60 | 25 |
| Clique duplo | +3% de chance de abrir 2 baús | 40 | 30 |
| Autoclique | +0,5 baú por segundo | 150 | 40 |
| Velocidade de abertura | -4% no tempo da animação do baú | 100 | 20 |

### Renascer e árvore
- **Libera** com 1 milhão de moedas ganhas na corrida; cada renascimento seguinte pede **4x o anterior**.
- **Fichas ganhas** = `floor(sqrt(moedas da corrida / 100 mil))` + **3 por item novo** no álbum. Cada renascimento dá também **+25% de moedas** permanente (multiplicativo com a árvore, com teto a definir no simulador).
- **Árvore** com ~24 nós em 3 ramos (**Cliques**, **Sorte**, **Automação**), custo de 1 a 6 fichas; inclui o "Gacha" (item de coleção extra, seção 6). Pode **refazer a árvore** de graça? (decisão aberta 13.6.)

### Baú Dourado
Aparece em ponto aleatório da área do botão por **13 s**; ao tocar, um destes (sorteado): **Chuva de baús** (10 baús por toque por 10 s), **Sorte lendária** (chances altas x5 por 15 s), **Cofre** (moedas de 10 minutos de produção, com teto). Nunca pune quem não toca.

### Proteção de azar
Cada item que ainda falta no álbum ganha chance extra a cada baú sem ele (**pity**): depois de ~500 baús abertos sem o item, a chance dele cresce até 100% em ~1.000. Resolve a reclamação de "3% que nunca sai". Detalhes na etapa de calibragem.

### Fim de jogo
Campanha com final (álbum completo + árvore maximizada + 1 renascimento por raridade), mais um **modo contínuo** depois (continuar renascendo com números maiores, em notação pt-BR: mil, mi, bi, tri...). Meta de conteúdo para a campanha principal: **~8 a 10 h** até o final, para não repetir o "curto demais".

## 5. Upgrades, álbum e conquistas

- **Melhorias:** tabela da seção 4. Em cada compra mostrar **o ganho** ("+0,5 baú/s; passa de 3,0 para 3,5") para decidir sem planilha.
- **Álbum (Enciclopédia):** 30 itens e 6 coleções de raridade; cada item mostra quantos já saíram, quantos foram vendidos e a chance atual.
- **Conquistas** (~30; sem tela cheia de pop-up: uma faixa que aparece e some, só `transform`/`opacity`):
  - Cliques: 100, 1.000, 10.000, 100.000.
  - Coleções por raridade; "todos os itens"; "1.000 de cada".
  - Baús: abrir cada tier 1.000 vezes.
  - Renascer 1, 5, 25 vezes; árvore completa.
  - Ouro: tocar 10, 100 baús dourados.
  - Gacha: coleção completa e versão dourada.
  - Sprint: nota mínima por faixa; Daily em sequência de 7 dias.
  - Uma escondida (parte da graça do original).
  - Conquista que **marca cheats** não existe aqui (o servidor invalida o que não bate).

## 6. Gacha (opcional, na árvore)
Nó da árvore libera uma máquina que gasta **fichas** para sortear "figurinhas" colecionáveis (e a versão dourada, mais rara). **Sem dinheiro de verdade, sem compra** (regra do projeto: nenhum pagamento no app). Entra só se o Lucas aprovar (decisão aberta 13.10).

## 7. Sprint: o modo competitivo (com ranking e Daily)

Problema: em clicker a economia roda toda no cliente e é trivial de adulterar. Por isso a **campanha não tem ranking** e o ranking é uma **corrida curta que o servidor consegue refazer**.

- **Regra:** 60 segundos, mesma árvore de melhorias **reduzida e fixa** (5 melhorias baratas, nenhuma coisa da campanha entra), mesma seed para todos no Daily. Pontos = moedas ganhas no fim. É um mini-incremental dentro do tempo, ótimo para repetir.
- **Presets:** `sprint-60` (ranking global/amigos, diário/semanal/sempre) e o **Daily Sprint** (seed do dia `"clicker:YYYY-MM-DD"`, fuso America/Sao_Paulo). Salas personalizadas, quando existirem, **não rankeiam** (regra 2).
- **Anti-trapaça (o servidor sempre recalcula, regra 3 de RULES.md):**
  1. `POST /clicker/sprint/start` devolve uma **sessão assinada** (seed, horário do servidor, uso único), como o anti-trapaça do Tempo (brief #6).
  2. O cliente envia no fim a **lista de eventos** (instante em ms de cada toque e cada compra). O servidor **refaz o sorteio pela seed e recalcula o placar**; a nota enviada é ignorada.
  3. Rejeita: soma de tempo maior que o relógio do servidor, sessão repetida, mais de **N toques/s** (teto de 12 cps sustentado e 20 de pico), intervalos "perfeitos" demais (variância mínima), compras impossíveis (sem moedas) ou fora de ordem.
  4. Guarda só **seed, contagem de toques e placar** (não a lista inteira, para caber no orçamento de ~150 B por jogador por partida).
- **Limite assumido:** um macro bem feito, que imita um humano em ≤12 cps, **não é detectável** só pelo servidor (mesmo limite do Já Deu? e do Ecooo). O teto de cps **limita o ganho**; o resto é moderação (tirar do ranking por denúncia). Aceitar ou não esse limite é decisão aberta 13.3.

## 8. Encaixe no NoCap

- **Home:** nova faixa ou entrada dentro de **Arcade** (decisão 13.2); cartão com o ícone do botão e o texto "Campanha" e "Sprint". Daily Sprint aparece na faixa **Hoje** junto com os outros dailys.
- **Ranking** (spec 008/015): só o **Sprint**, por preset; abas Hoje/Semana/Sempre, global e amigos. A campanha não rankeia; no perfil ela aparece como **estatística pessoal** (renascimentos, itens no álbum, moedas ganhas), sem comparação pública, a menos que o Lucas queira (13.5).
- **Perfil e amigos:** recordes do Sprint, % do álbum, renascimentos e conquistas; o amigo vê o seu perfil. Confronto direto (head-to-head) no Sprint.
- **Offline vs conta (mesmo padrão da spec 037):**
  - A campanha **joga offline**, salva no aparelho (`localStorage`/IndexedDB) a cada ~5 s e ao sair.
  - Com conta, sobe para a tabela `clicker_save (user_id, data jsonb, version, updated_at)` e desce em outro aparelho. **Juntar duas versões nunca diminui**: fica com a mais avançada (mais renascimentos, depois mais moedas ganhas; álbum e conquistas são a **união**).
  - O servidor valida formato e **plausibilidade** (moedas ganhas ≤ tempo desde a criação x teto de produção do que foi comprado) e **corta o que for impossível**, sem punir.
  - **Convidado** (spec 023): joga a campanha no aparelho, sem sincronização; o Sprint e o Daily pedem conta.
  - **Mesmo aparelho, outra conta:** repete a regra do `nocap-words-owner` (o progresso local é da primeira conta; a outra começa do zero ou do que tiver na própria conta).
- **O que fica no servidor:** `clicker_save`, as sessões e partidas do Sprint (via `matches`, `match_players` e `user_game_stats` existentes), ranking (Redis) e Daily. A **lógica de jogo (tabelas, sorteio, economia, replay do Sprint) mora só em `packages/games`** e é usada nos dois lados (regra 2).
- **Servidor sempre recalcula:** no Sprint, sim. Na campanha, só valida plausibilidade e formato, porque não há ranking dela.

## 9. UI/UX (Pop Brutal; celular e computador; sem emoji)

- **Celular (coluna única, sem scroll horizontal):** topo com **moedas** (Space Mono, notação pt-BR) e "por segundo"; meio com o **botão gigante** (circular, 2,5 px de borda `--ink`, sombra dura, afunda ao tocar com quique na volta) e o baú que brota e abre acima dele; embaixo uma **barra de 4 abas de largura igual** (Melhorias, Álbum, Árvore, Conquistas) e o painel da aba, que rola só na vertical. Alvo do botão >= 120 px e todos os controles >= 44 px.
- **Computador:** duas colunas (botão e baús à esquerda, painel das abas à direita), largura máxima que respeita a coluna do app; teclado: Espaço/Enter toca, `1` a `4` trocam de aba.
- **Cores:** raridades usam os tokens (Comum `--paper`/cinza, Incomum `--blue`, Raro `--orange`, Épico `--yellow`, Lendário e Mítico com combinações de tokens e borda dupla); nada fora dos tokens, sem gradiente genérico, sem Inter/Roboto, Archivo + Space Mono.
- **Animação (só `transform`/`opacity`, desligam com `prefers-reduced-motion`):** afundar do botão; baú que **sobe, balança e abre** (rotação/escala); item que "pula" para a mochila; números que flutuam e somem; **carimbo** amarelo ao tirar item novo (reaproveita o da nota); Baú Dourado que atravessa a tela. Com movimento reduzido: trocas por fade de 120 ms e sem tremor de tela.
- **Som (módulo `sfx`, Web Audio):** `clack` no toque (com tom subindo com a sequência rápida), um som por raridade (do `tick` ao `win`), `thunk` no carimbo, `boing` ao comprar sem moedas; mudo respeitado. Sem som de ritmo regular (não há regra do Tempo aqui, mas o autoclique usa tick **espaçado e aleatório** para não virar metrônomo que cansa).
- **Acessibilidade:** botão é um `<button>`; segurar Espaço/Enter repete (com teto); alternativa "autoclique manual" para quem não consegue clicar rápido; contraste AA; rótulos de leitor de tela para cada baú e item; nenhum dado só por cor.
- **Telas:** Home (cartão), **Jogo** (as abas acima), **Sprint** (contagem 3-2-1, 60 s com barra de tempo; aqui o tempo **pode** aparecer, não é o jogo do Tempo), **Resultado do Sprint** (nota com carimbo, posição no ranking, melhor pessoal), **Renascer** (resumo do que fica e o que sai, botão grande com confirmação de 2 passos), e a árvore.

## 10. Riscos

| Risco | O que fazer |
| --- | --- |
| **Trapaça no ranking** (macro, edição de cliente) | Ranking só no Sprint, com replay no servidor, teto de cps, sessão assinada (seção 7). Assumir que macro humano passa; moderação por denúncia. |
| **Salvar manipulado** (editar `localStorage` para ter 1e300 moedas) | Campanha sem ranking, então só o próprio jogador se prejudica; o servidor ainda corta o impossível e **não deixa a conta virar ranking**. |
| **Economia quebrada** (curva fácil demais ou grind absurdo) | Simulador com testes que garantem tempo-alvo por fase; custos exponenciais com **teto de níveis**; revisão no jogo ao vivo. |
| **Estouro numérico** (`number` perde precisão acima de ~9e15) | Teto de moedas e notação; se o modo contínuo passar disso, usar `BigInt`/mantissa-expoente. Testes de borda. |
| **Cansaço do clique / acessibilidade** | Autoclique cedo, segurar para repetir, teto de 12 cps, avisos de descanso opcionais. |
| **Relógio do aparelho mexido** (adiantar o horário para ganhar offline) | Offline só conta para frente, com teto de 8 h; logado, o relógio do servidor decide ao sincronizar. |
| **Peso do bundle** | Tudo em lazy-load como os demais jogos; imagens dos itens em SVG inline, sem arquivo pesado. |
| **Escopo** (30 itens, arte, texto) | Começar com 12 itens e 3 raridades; o resto entra por etapa. |
| **Regras do projeto** | Sem emoji, tokens Pop Brutal, só `transform`/`opacity`, ranking só presets, lógica só em `packages/games`. |

## 11. Dados e API (rascunho)

- Tabela `clicker_save (user_id uuid pk -> users, data jsonb, version smallint, updated_at timestamptz)`; migration só de `CREATE TABLE` (não destrutiva).
- `GET /me/clicker-save` e `PUT /me/clicker-save` (junta sem diminuir, valida formato e plausibilidade), módulo `clicker` em `apps/api/src/clicker/`.
- `POST /clicker/sprint/start` e `POST /clicker/sprint/finish` (sessão assinada, replay, grava em `matches` com `game: 'clicker'`, `mode: 'sprint-60'`, `kind: solo | daily`, `ranked: true` só para presets).
- Contrato no pacote: `packages/games/src/clicker/` (tabelas, `rollChest(seed, i, state)`, `applyAction`, `replaySprint`, simulador e testes).

## 12. Plano de entrega (etapas pequenas, cada uma com testes e commit)

1. **Núcleo em `packages/games`:** tabelas de itens/chances, sorteio por seed, melhorias, custos e **simulador** com testes (tempo-alvo por fase, nenhum caminho dá infinito). Sem UI.
2. **Campanha jogável offline (versão mínima):** botão, baú, venda, 5 melhorias, salvar no aparelho, notação pt-BR, sons. Celular e computador.
3. **Álbum, conquistas, Baú Dourado e proteção de azar.**
4. **Renascer e árvore** (com os números calibrados no simulador).
5. **Salvar na conta** (`clicker_save`, sincronização, junção sem perda, troca de conta).
6. **Sprint solo** local, depois **servidor** (sessão, replay, teto de cps) e ranking com o resultado.
7. **Home, perfil, amigos e Daily Sprint** (faixa Hoje); atualizar `specs/INDEX.md`, `ARCHITECTURE.md`, `docs/ROADMAP.md` e o brief.
8. **Calibrar jogando** (Lucas), gacha e conteúdo extra se aprovados, modo contínuo.

Cada etapa só começa com o "sim" do Lucas para a etapa anterior ter ficado boa.

## 13. Decisões em aberto (perguntas para o Lucas)

1. **Nome do jogo:** "Botão" está bom, ou prefere outro (ex.: "Aperta!", "Baú", "Clica!")? E o tema dos itens: objetos absurdos do dia a dia, bichos, comida, ou outro?
2. **Onde entra na Home:** nova faixa "Clicker" ou dentro de Arcade? E o Daily Sprint na faixa Hoje?
3. **Ranking:** concorda que **só o Sprint de 60 s rankeia** e a campanha não? Aceita o limite de que um macro humano bem feito passa pelo servidor (teto de 12 cps)? Ou prefere **nada de ranking** e só estatística pessoal?
4. **Progresso parado (offline):** a campanha produz enquanto o app está fechado? Se sim, com teto de **8 h**, ou prefere só enquanto a aba está aberta, ou nada?
5. **A campanha aparece no perfil/amigos** como comparação pública (renascimentos, % do álbum) ou fica só pessoal?
6. **Árvore:** pode **refazer a árvore de graça** a qualquer hora (mais livre) ou só gasta fichas uma vez (mais permanente)?
7. **Duração da campanha:** alvo de **8 a 10 h** até o final ou prefere algo mais curto (2 a 3 h como o original) com fim claro?
8. **Convidado:** joga a campanha no aparelho sem sincronizar (proposta) ou deve pedir conta para salvar?
9. **Conteúdo:** quem escolhe os 30 itens, nomes e textos de conquista (você ou eu proponho uma lista para você aprovar)? Começar com 12 itens e 3 raridades e crescer?
10. **Gacha** de figurinhas na árvore: quer, ou deixa de fora? (Sem dinheiro de verdade em nenhum caso.)
11. **Som e vibração:** o clique com som a cada toque é ok? Quer vibração no celular (só Android)?
12. **Salas:** quer um dia um **Sprint em sala com amigos** (todos jogam os mesmos 60 s ao vivo, sem ranking), ou fica só solo e Daily?
13. **Prioridade:** onde entra na fila em relação ao Tribunal do Absurdo e ao resto de `docs/JOGOS-FUTUROS.md`?
