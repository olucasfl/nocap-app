# 040 · Aperta!: colapso infinito, Cofre dos Proibidos e Árvore de Habilidades grande

Status: **decidida pelo Lucas em 22/10/2026 (conversa de design). Só este plano está escrito; nenhuma etapa foi começada.** Sobrepõe a spec 038 nas seções 8.2 (Atlas), 8.3 (Fragmentos e árvore), 8.4 (Ascender), 5.3 (conquistas sem recompensa) e nas etapas 14 a 16 da seção 15. "Rebirth" é o **Colapso** (nome já decidido na 038; na tela continua "Colapsar a estrela").

## 1. O que mudou (decisões do Lucas)

1. **Sem limite de colapsos e sem Ascender.** O jogo é infinito. A camada 2 (Ascender, Constelações) sai da spec e nunca existe.
2. **A duração de cada vida depende da pessoa.** Não há mais tabela fixa de horas por colapso. Para colapsar a pessoa precisa cumprir um **requisito**, e o requisito do colapso seguinte é **sempre mais difícil** (seção 2).
3. **Primeiro colapso e todos os outros:** ao colapsar a pessoa **leva algo permanente**: escolhe **1 de 3 Grimórios Proibidos**. Se sair um que ela já tem e ela o escolhe, ele **sobe de nível** (até o 5).
4. **O Atlas Eterno sai** (as páginas, os espaços e os bônus de conjunto). O Grimório Proibido ocupa o lugar dele no momento do colapso. Os **Fragmentos** também saem, substituídos pela moeda da árvore (seção 5).
5. **Árvore de Habilidades e Cofre dos Proibidos são coisas separadas**, cada uma com a sua página.
6. **Árvore bem grande**, desenhada como árvore de verdade (compra o primeiro, abre dois, compra um, abre outros...), com coisas que **não existem** nas melhorias nem nos grimórios: automações, habilidades ativas, sorte e exploração. **Sem ramo de "memória"** (o que sobrevive ao colapso é só o que a seção 3 define).
7. **A moeda da árvore vem de conquistas, do álbum, de capturas raras e de marcos**; precisam existir muito mais conquistas, e a conta fecha com o custo total da árvore (seção 5.4).

## 2. Colapso infinito e requisitos crescentes

- **Requisito do colapso `n`** (todos precisam ser cumpridos, e o jogo mostra a barra de cada um):
  1. **Poeira da vida** >= `meta(n)`. Meta inicial 2 mi no 1º colapso, **x3 a cada colapso** (é exatamente a curva da tabela 6.6 da 038: 2 mi, 6 mi, 18 mi... 9,6 tri no 15º) e **continua x3 depois do 15º, sem teto**. A razão sobe (ex. x3,2) só se o simulador mostrar que o poder do jogador deixou de acompanhar.
  2. **Escolhas de grimório** >= mínimo (20 no 1º, 15 até o 5º, 12 depois; é o `minChoices` da 6.6).
  3. **Um marco da vida** que muda a cada colapso e cresce com `n`. Ciclo de 6 marcos: capturar `ceil(2 + n/2)` objetos; chegar ao combo `min(5 + n/3, teto)`; ter `k` geradores acima do nível `f(n)`; completar `ceil(n/4)` missões da estação; acertar `ceil(n/5)` objetos raros; manter o combo cheio por `20 + n` s. O marco do colapso `n` é o de índice `n mod 6`. Marcos só entram se o conteúdo que exigem já estiver liberado (o que não existe é pulado).
- **Duração da vida:** não tem alvo fixo. O simulador mede **por perfil** (casual 30 min/dia, normal 1 a 2 h/dia, ativo 4 h/dia). Trava de balanceamento: para o perfil normal a vida `k` leva de **1 h a 3 h** até o 15º colapso; depois pode crescer no máximo **+3% por colapso** em relação à anterior (nunca vira muro).
- **Números grandes (7.5 da 038):** a notação cobre sem teto (mi, bi, tri, depois notação científica) e o motor passa a usar `Decimal` leve ou `number` com guarda de 1e300; o `validateSave` aceita qualquer valor <= o teto teórico do colapso `n` (a conta é refeita no servidor, como já é).
- **Conteúdo por colapso (tabela 5.4):** os colapsos 1 a 15 continuam liberando o que a tabela diz. **Depois do 15º nada novo vem "por colapso"**: o conteúdo novo vem da árvore, dos proibidos, das conquistas e de atualizações.
- **O que fica ao colapsar:** álbum, conquistas, Cintilas (moeda da árvore), a árvore comprada e os Grimórios Proibidos (com o nível que têm). **O que sai:** poeira, melhorias, geradores, grimórios comuns da vida, energia, combo, objetos.

## 3. Cofre dos Proibidos (a recompensa do colapso)

- **10 Grimórios Proibidos** (mínimo pedido era 8; com 10 o teto de evolução é exatamente 50 escolhas, 10 x nível 5). Hoje existem 3 (Sagitário A*, Cygnus X-1, M87*); entram 7 novos. Cada um tem **um bônus forte e um preço** (como os 3 atuais) e **efeito em números fixos**, não em %. Conceitos (efeitos e números saem da etapa 15 e do simulador):

| # | Proibido | Ideia |
| --- | --- | --- |
| 1 | Sagitário A* | toque rende muito mais poeira; a energia por toque cai (já existe) |
| 2 | Cygnus X-1 | combo no máximo e toque mais forte; objetos param de aparecer (já existe) |
| 3 | M87* | melhorias mais baratas; barra de energia maior (já existe) |
| 4 | TON 618 | geradores produzem muito mais; os toques rendem menos |
| 5 | Phoenix A | energia vem do tempo, não do toque; o toque deixa de dar energia |
| 6 | Gaia BH3 | os grimórios comuns somem das ofertas; as cartas raras e acima ficam mais frequentes |
| 7 | GW150914 | um pulso grande de poeira a cada N toques; entre os pulsos o toque rende 1 |
| 8 | V404 Cygni | objetos aparecem muito mais e duram mais; os geradores param de render durante a vida do objeto |
| 9 | Holmberg 15A | a primeira compra de cada melhoria na vida sai de graça; as seguintes custam mais |
| 10 | IC 10 X-1 | cada captura de objeto dá poeira em dobro; sem captura por 30 s o ganho cai para metade |

- **Níveis 1 a 5.** Repetir o proibido sobe 1 nível. Cada nível soma **um valor fixo** ao bônus e o preço cresce mais devagar que o bônus; o **nível 5 tem um selo extra** (um efeito a mais, definido por proibido). Todos os proibidos que a pessoa tem ficam **ativos** (sem "espaços").
- **Oferta no colapso:** 3 opções distintas. **Nunca aparece um proibido já no nível 5.** Se sobram menos de 3 elegíveis, aparecem só os que sobram. Se não sobra nenhum (todos no 5), o colapso continua valendo e dá um **Selo Estelar** (contador de prestígio: bônus pequeno de poeira por toque somado, por selo, e conta para conquistas). A árvore pode dar **1 reroll** e uma **4ª opção** (seção 6).
- **Tela:** modal de colapso em 2 passos mostra as 3 cartas (nome, nível atual -> novo, bônus, preço, selo do nível 5); página **Cofre dos Proibidos** (10 espaços, pontos de nível, descrição) separada da página da árvore.
- **Migração de saves:** páginas do Atlas viram Cintilas (valor fixo por página); Fragmentos gastos e nós antigos da árvore são devolvidos em Cintilas; o save sobe de versão e o `validateSave` continua aceitando saves antigos.

## 4. Conquistas muito mais numerosas

- De 31 para **cerca de 150** (meta mínima 140), com ícone, barra, N/M e **recompensa em Cintilas**: pequena 1, média 2, grande 3, épica 5 (escondidas valem 3).
- Famílias novas além das da 5.3: **Colapsos** (1, 3, 5, 10, 15, 20, 30, 50, 75, 100), **Proibidos** (ter cada um, nível 3 e 5 de cada, os 10 no nível 5), **Automação** (usar cada habilidade, X usos no total), **Sorte** (lendário na 1ª oferta, 5 raros seguidos), **Exploração** (cada evento visto, cada objeto lendário capturado), **Árvore** (nós por ramo, ramo completo, árvore completa), **Geradores e Toque** (marcos de nível), **Combo e Ritmo**, **Missões da estação**, **Regiões** (visitar cada uma), **Tempo** (dias seguidos, total jogado), **Escondidas** (10 surpresas).
- As conquistas existentes mantêm os ids; as novas entram em dados (`achievements.ts`), e **cada uma conta no total da árvore** (seção 5.4).

## 5. Cintilas (a moeda da árvore)

Nome provisório, o Lucas pode trocar. Substitui os Fragmentos.

### 5.1 Fontes
1. **Conquistas** (seção 4): a maior fonte, 1 a 5 cada.
2. **Álbum:** **1 Cintila por grimório comum ou raro novo**, 2 por épico, 3 por lendário e 4 por proibido, **na primeira vez que é descoberto**.
3. **Capturas raras:** a primeira captura de cada objeto raro ou lendário rende 3; há degraus de 10, 50, 200 e 1.000 capturas totais (2, 3, 5 e 8).
4. **Marcos que repetem** (a única fonte infinita): a cada 3 colapsos 1 Cintila; a cada marco de **poeira total ganha na conta** (x1.000 do anterior) 1 Cintila; e a **primeira vez** que um evento raro aparece.
5. **Estrela dos Proibidos:** subir um proibido para o nível 3 e para o 5 rende 2 e 4 (uma vez por proibido).

### 5.2 Gasto
Só a árvore. Custo por nível de nó: tier 1 = 1, tier 2 = 2, tier 3 = 3, tier 4 = 5, tier 5 = 8.

### 5.3 Refazer a árvore
Devolve **100%** das Cintilas gastas (a moeda é finita; o jogador deve poder testar builds), sem custo, só **fora de uma vida em andamento** (na tela de colapso ou ao abrir um save). Sem limite de vezes.

### 5.4 O cálculo que precisa fechar (teste automático)
- `T` = soma do custo de **todos** os nós da árvore.
- `F` = fontes **finitas** (conquistas + álbum + capturas raras + degraus + Estrela dos Proibidos) calculadas **a partir dos dados**, sem número escrito à mão.
- `R25` = o que as fontes repetíveis dão até o colapso 25 para o perfil normal.
- Regras: **`F >= 0,80 x T`** (a árvore quase toda é alcançável só jogando e colecionando) e **`F + R25 >= 1,10 x T`** (a árvore completa fica ao alcance, com folga, até o colapso 25). Se um teste falhar, a mudança que adiciona nó, conquista ou fonte precisa ajustar o outro lado no mesmo commit.
- Alvo inicial: **~120 nós, T entre 500 e 600**; **F entre 420 e 480**; o resto vem das fontes que repetem.

## 6. Árvore de Habilidades (grande, em forma de árvore)

### 6.1 Forma
- **Grafo de verdade:** um **nó raiz** no centro e 5 ramos que saem dele; cada nó tem **pré-requisitos** (comprou o pai, abre os filhos; alguns nós exigem **dois** pais para criar rotas). Os ramos têm **ligações cruzadas** raras entre si.
- **~120 nós** em 5 ramos de ~24 nós; cada nó tem 1 a 5 níveis (em dados, `tree.ts`). Tiers 1 a 5 conforme a profundidade; o custo cresce com a profundidade.
- **Tela:** SVG leve numa área **que arrasta** (toque e mouse) e dá zoom (2 níveis e botões `+`/`-`, mais teclado), nós como "estrelas" ligadas por linhas (`opacity`/`transform` só). Estados: comprado, comprável, bloqueado (mostra o pré-requisito) e "falta N Cintilas". Busca por ramo e botão "centralizar". Funciona em 320 px sem rolagem lateral da página.
- Cada nó só faz o que **melhorias e grimórios não fazem** (sem "+X% de poeira").

### 6.2 Ramos e exemplos de nós (a lista final de ~120 sai da etapa 17)
1. **Automação:** **Autoclick** (botão de habilidade que, ao tocar, dá toques automáticos por **60 s**, recarga de 10 min; níveis: velocidade 2 -> 6 toques/s, duração 60 -> 180 s, recarga menor, "autoclick cheio de combo"), **Captura automática** (pega objetos no alcance; níveis: alcance, raros também, lendários também), **Compra automática** (compra a melhoria mais barata sozinha quando passa de um limite que a pessoa define), **Escolha sugerida** (destaca a carta mais forte para o plano atual), **Piloto automático** (liga os 3 ao mesmo tempo por um tempo). Tudo respeita a regra anti-farm do ritmo ativo (spec 039, seção 5): o autoclick conta como toque **até o teto de 6/s** e a árvore não dá poeira com a aba fechada.
2. **Habilidades ativas** (botões da barra de habilidades, cada um com recarga e níveis): **Pulso**, **Supernova menor** (gasta a energia e dá poeira), **Dobra temporal** (o relógio dos geradores anda 2x por 15 s), **Lente** (mostra raros no campo por 30 s), **Ímã estelar** (puxa os objetos para perto).
3. **Sorte:** **Rerolls** de grimório (1, 2, 3 por vida), **4ª carta** na oferta, **Pity de lendário** (o contador de ofertas sem lendário aparece na tela e cada nível reduz o que falta), **Cartas raras mais frequentes** (pesos em números, não em %), **Garantia** (a cada N ofertas uma é pelo menos épica), **Segunda chance** (descartar uma oferta ruim uma vez por vida).
4. **Exploração:** **Mais objetos** na tela (+1 por nível, teto 6), **Radar de lendários** (o objeto lendário **deixa de ser sorte**: um contador de capturas enche e, quando enche, ele nasce garantido), **Eventos:** chance de **Chuva de ouro** (todo ganho 2x por 30 s), **Alinhamento** (combo não cai por 30 s), **Maré de energia** (a barra enche 2x por 30 s), **Eclipse** (grimórios dão uma carta extra), cada um com chance e duração que sobem por nível; **Mapa estelar** (revela a região do próximo colapso e o que ela traz).
5. **Cosmos** (ramo de fechamento, mais caro e com combinações): **Cartas de capa** (um slot extra para um grimório comum "fixado" que não sai na oferta), **Constelação pessoal** (combine 3 nós de ramos diferentes e ganhe um bônus de combinação nomeado), **Observatório** (resumo da vida e projeção do próximo colapso), **Sintonia** (os proibidos que a pessoa tem dão um bônus pequeno juntos), **Eco do colapso** (o primeiro minuto da vida nova tem um impulso fixo).

### 6.3 Balanço da árvore
- Nós de **poder direto** (mais poeira ou mais energia) são **no máximo ~15%** do total: o resto é mecânica nova. Isto evita competir com melhorias e grimórios.
- Nenhum nó da árvore duplica um efeito de melhoria ou grimórios (**teste de não-duplicação**, como o já existente entre melhorias e grimórios).
- O simulador ganha o perfil "com árvore" e confere que a árvore completa não encurta a vida mais de ~25% em relação ao jogador sem árvore.

## 7. Tutorial

O tutorial dinâmico (spec 038, 4.6, refeita em 22/10/2026) ganha passos de gatilho para: **Cofre dos Proibidos** (no 1º colapso), **Cintilas e Árvore** (na 1ª Cintila ganha, com o aviso "Você ganhou sua primeira Cintila: abra a Árvore"), **Habilidades** (na compra do 1º nó que dá botão) e **Eventos raros** (no 1º evento). Nada entra no começo do jogo.

## 8. Etapas (cada uma = uma sessão; no máximo 2 em paralelo; nada na `main`)

Numeração continua a da 038. Todas terminam com testes, typecheck, docs e commit na `develop`. Substituem as antigas 14, 15 e 16 da 038.

14. **Colapso infinito e requisitos.** *Escopo:* sem teto de colapsos, remover o Ascender (`canAscend` e tudo que o cita), `meta(n)` x3 sem teto, marcos do colapso (6 marcos que giram), números grandes sem teto, `validateSave` com o teto do colapso `n`, simulador com 3 perfis e as travas de duração (1 a 3 h até o 15º; +3% depois), conteúdo por colapso só até o 15º. *Pronto quando:* testes mostram o requisito crescendo, o simulador cumpre as travas e o save antigo abre.
15. **Cofre dos Proibidos (substitui o Atlas e a 8.2).** *Escopo:* 10 proibidos com níveis 1 a 5 e selo do nível 5, oferta de 3 no colapso (regras da seção 3), Selo Estelar, modal em 2 passos, página Cofre dos Proibidos, remover Atlas, espaços e bônus de conjunto, migração do save (páginas viram Cintilas), tutorial do Cofre. *Depende da 14.* *Pronto quando:* testes cobrem a oferta (nunca nível 5, até 3 distintas), a evolução até 5 e a migração; o simulador confere que cada proibido tem preço real.
16. **Cintilas, fontes e conquistas ampliadas (pode rodar junto com a 14).** *Escopo:* moeda `sparks` no save, ~150 conquistas em dados com recompensa, fontes do álbum, capturas raras, degraus e marcos que repetem (5.1), remover Fragmentos e migrar o save, avisos de ganho de Cintilas, página de Conquistas maior (filtros, progresso). *Pronto quando:* o **teste de balanço** da seção 5.4 passa e a página funciona em 320 a 1920 px.
17. **Árvore: motor e dados.** *Escopo:* `tree.ts` com o grafo (~120 nós, pré-requisitos, níveis, custo por tier), compra, refazer 100%, `validateSave`, **teste de não-duplicação** e de poder direto <= 15%, balanço de Cintilas (5.4) ligado à árvore real. *Depende da 16.*
18. **Árvore: tela em forma de árvore.** *Escopo:* SVG com arrastar e zoom, nós e linhas, estados, busca e centralizar, página separada do Cofre, tutorial da árvore. *Depende da 17.* *Pronto quando:* confere em 320, 390, 768, 1024, 1280 e 1920 px com toque e mouse, sem rolagem lateral da página.
19. **Habilidades ativas e automações (pode rodar junto com a 20).** *Escopo:* barra de habilidades, Autoclick (60 s, níveis de velocidade, duração e recarga), Captura automática, Compra automática, Pulso, Supernova menor, Dobra temporal, Lente, Ímã estelar, tudo dentro da regra anti-farm. *Depende da 17.*
20. **Sorte e Exploração no jogo (pode rodar junto com a 19).** *Escopo:* rerolls e 4ª carta, pity de lendário visível, objetos lendários novos, eventos (Chuva de ouro, Alinhamento, Maré de energia, Eclipse) com chance e duração por nível, Mapa estelar. *Depende da 17.* (Os nós de Sorte e Exploração da árvore só ligam o que esta etapa entrega.)
21. **Calibragem e QA da v2.** *Escopo:* simulador com os perfis (inclui "com árvore" e "com proibidos"), conteúdo por colapso 6 a 15 conferido, varredura responsiva em 6 larguras, e **o Lucas joga 1 a 2 dias** para aprovar o ritmo. *Depende de todas.*

**Ordem de dependência e paralelismo:** 14 e 16 em paralelo -> 15 (depois da 14) e 17 (depois da 16) -> 18 (depois da 17) e 19 e 20 em paralelo (depois da 17) -> 21. **Duas sessões por vez, no máximo.**

## 9. Decisões já tomadas e o que o Lucas ainda pode mudar

- Tomadas: colapso infinito; sem Ascender, sem Atlas, sem Fragmentos; 10 proibidos com níveis 1 a 5; oferta de 3 sem nível 5; Selo Estelar quando tudo está no 5; moeda da árvore vem de conquistas, álbum, capturas raras e marcos; ~150 conquistas; árvore de ~120 nós em forma de árvore; sem ramo de memória; Autoclick 60 s com níveis; eventos "2x tudo"; refazer a árvore devolve 100%.
- **O Lucas ainda pode mudar (não bloqueia nada):** o nome **Cintilas**, os nomes e efeitos exatos dos proibidos 4 a 10, a razão x3 do requisito depois do 15º colapso, e o tamanho final da árvore (120 nós é meta, não regra).
