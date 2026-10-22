# 040 · Aperta!: colapso infinito, Cofre dos Proibidos e Árvore de Habilidades grande

Status: **decidida pelo Lucas em 22/10/2026 (conversa de design). Etapas 14 e 16 prontas em 22/10/2026 (seções 10 e 11); as etapas 15 e 17 a 21 não foram começadas.** Sobrepõe a spec 038 nas seções 8.2 (Atlas), 8.3 (Fragmentos e árvore), 8.4 (Ascender), 5.3 (conquistas sem recompensa) e nas etapas 14 a 16 da seção 15. "Rebirth" é o **Colapso** (nome já decidido na 038; na tela continua "Colapsar a estrela").

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
  1. **Poeira da vida** >= `meta(n)`. Meta inicial 2 mi no 1º colapso, **x3 a cada colapso** (a curva da tabela 6.6 da 038: 2 mi, 6 mi, 18 mi... 9,6 tri no 15º) e **continua crescendo depois do 15º, sem teto**. **Resultado da etapa 14 (seção 10): o simulador mostrou que o poder do jogador não acompanha x3** (as vidas 9 a 12 saíam com 9 a 21 h), então a razão virou trechos calibrados (`GOAL_SEGMENTS`); a razão sobe de novo quando as etapas 15 a 20 trouxerem poder permanente novo.
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

14. **Colapso infinito e requisitos. PRONTA em 22/10/2026 (seção 10).** *Escopo:* sem teto de colapsos, remover o Ascender (`canAscend` e tudo que o cita), `meta(n)` x3 sem teto, marcos do colapso (6 marcos que giram), números grandes sem teto, `validateSave` com o teto do colapso `n`, simulador com 3 perfis e as travas de duração (1 a 3 h até o 15º; +3% depois), conteúdo por colapso só até o 15º. *Pronto quando:* testes mostram o requisito crescendo, o simulador cumpre as travas e o save antigo abre.
15. **Cofre dos Proibidos (substitui o Atlas e a 8.2).** *Escopo:* 10 proibidos com níveis 1 a 5 e selo do nível 5, oferta de 3 no colapso (regras da seção 3), Selo Estelar, modal em 2 passos, página Cofre dos Proibidos, remover Atlas, espaços e bônus de conjunto, migração do save (páginas viram Cintilas), tutorial do Cofre. *Depende da 14.* *Pronto quando:* testes cobrem a oferta (nunca nível 5, até 3 distintas), a evolução até 5 e a migração; o simulador confere que cada proibido tem preço real.
16. **Cintilas, fontes e conquistas ampliadas (pode rodar junto com a 14). PRONTA em 22/10/2026 (seção 11).** *Escopo:* moeda `sparks` no save, ~150 conquistas em dados com recompensa, fontes do álbum, capturas raras, degraus e marcos que repetem (5.1), remover Fragmentos e migrar o save, avisos de ganho de Cintilas, página de Conquistas maior (filtros, progresso). *Pronto quando:* o **teste de balanço** da seção 5.4 passa e a página funciona em 320 a 1920 px.
17. **Árvore: motor e dados.** *Escopo:* `tree.ts` com o grafo (~120 nós, pré-requisitos, níveis, custo por tier), compra, refazer 100%, `validateSave`, **teste de não-duplicação** e de poder direto <= 15%, balanço de Cintilas (5.4) ligado à árvore real. *Depende da 16.*
18. **Árvore: tela em forma de árvore.** *Escopo:* SVG com arrastar e zoom, nós e linhas, estados, busca e centralizar, página separada do Cofre, tutorial da árvore. *Depende da 17.* *Pronto quando:* confere em 320, 390, 768, 1024, 1280 e 1920 px com toque e mouse, sem rolagem lateral da página.
19. **Habilidades ativas e automações (pode rodar junto com a 20).** *Escopo:* barra de habilidades, Autoclick (60 s, níveis de velocidade, duração e recarga), Captura automática, Compra automática, Pulso, Supernova menor, Dobra temporal, Lente, Ímã estelar, tudo dentro da regra anti-farm. *Depende da 17.*
20. **Sorte e Exploração no jogo (pode rodar junto com a 19).** *Escopo:* rerolls e 4ª carta, pity de lendário visível, objetos lendários novos, eventos (Chuva de ouro, Alinhamento, Maré de energia, Eclipse) com chance e duração por nível, Mapa estelar. *Depende da 17.* (Os nós de Sorte e Exploração da árvore só ligam o que esta etapa entrega.)
21. **Calibragem e QA da v2.** *Escopo:* simulador com os perfis (inclui "com árvore" e "com proibidos"), conteúdo por colapso 6 a 15 conferido, varredura responsiva em 6 larguras, e **o Lucas joga 1 a 2 dias** para aprovar o ritmo. *Depende de todas.*

**Ordem de dependência e paralelismo:** 14 e 16 em paralelo -> 15 (depois da 14) e 17 (depois da 16) -> 18 (depois da 17) e 19 e 20 em paralelo (depois da 17) -> 21. **Duas sessões por vez, no máximo.**

## 9. Decisões já tomadas e o que o Lucas ainda pode mudar

- Tomadas: colapso infinito; sem Ascender, sem Atlas, sem Fragmentos; 10 proibidos com níveis 1 a 5; oferta de 3 sem nível 5; Selo Estelar quando tudo está no 5; moeda da árvore vem de conquistas, álbum, capturas raras e marcos; ~150 conquistas; árvore de ~120 nós em forma de árvore; sem ramo de memória; Autoclick 60 s com níveis; eventos "2x tudo"; refazer a árvore devolve 100%.
- **O Lucas ainda pode mudar (não bloqueia nada):** o nome **Cintilas**, os nomes e efeitos exatos dos proibidos 4 a 10, a razão x3 do requisito depois do 15º colapso, e o tamanho final da árvore (120 nós é meta, não regra).

## 10. Etapa 14 pronta: o que foi feito, o que mudou do plano e a tabela do simulador (22/10/2026)

### 10.1 Entregue

- **Sem teto de colapsos.** `dustGoal(n)` cresce sem fim até o guarda de 1e300 (`MAX_NUMBER`); `MAX_COLLAPSE_COUNT` (8659) é o último colapso cuja meta ainda cabe e o `validateSave` recusa mais que isso.
- **Ascender removido por completo:** nenhuma linha de código, tela, teste ou texto do Aperta! o cita (a 038 perdeu a seção 8.4, a decisão 10 e as menções; `collapse-infinite.test.ts` varre `packages/games`, `apps/web` e `apps/api` e falha se ele voltar). Só esta spec guarda o registro de que foi cancelado.
- **Requisito do colapso n** (`collapseProgress`, `canCollapse`): poeira da vida >= `dustGoal(n)`; escolhas >= 20 (1º), 15 (2º ao 5º) ou 12; e o **marco da vida** (`milestone.ts`), que gira em 6 tipos por `n mod 6` na ordem objetos capturados, combo, geradores, missões, raros e combo cheio, e **pula** o que ainda não existe (missões antes do colapso 4; capturas, raros e missões enquanto os objetos estão desligados por Cygnus X-1, senão a vida ficaria impossível de colapsar). Metas: objetos `ceil(2 + n/2)`; combo `min(5 + n/3, 30)` toques seguidos; geradores `k` no nível `f(n)` (2 geradores no nível `6 + n` até o teto de 40, mais um gerador a cada 12 colapsos até 4); missões `ceil(n/4)`; raros `ceil(n/5)`; combo cheio `min(20 + n, 180)` s.
- **Contadores da vida** no `RunState` (`captured`, `rares`, `chain`/`chainBest`, `fullBest`, `missionsDone`), zerados no colapso; save antigo entra com 0 e a missão já cumprida vale 1.
- **Números grandes:** `formatNumber` mostra mil, mi, bi, tri e, de 1e15 em diante, notação científica (`4,2e250`), com testes de 1e0 a 1e300; o motor trava tudo em 1e300 (`clampNum`, `upgradeCost`, `energyCap`, `dustGoal`, teto do `validateSave`); a tela só usa `formatNumber`.
- **`validateSave`:** `collapses <= MAX_COLLAPSE_COUNT`; piso do total de poeira ganha (a menor entre a meta nova e a antiga de cada colapso, para um save antigo legítimo nunca ser recusado); teto de poeira da vida preso em 1e300; contadores do marco coerentes (capturas <= total, raros <= capturas, sequência <= toques, combo cheio <= tempo jogado). Testado com **11 saves reais antigos** (`src/aperta/fixtures/legacy-*.json`, gerados pelo simulador com o motor do commit `1293fd1`, vidas 1 a 5, com e sem escolha aberta): todos abrem, nada é cortado (a energia pode ser aparada, ver 10.2), tocam, gravam e abrem de novo; um colapso feito num deles segue as regras novas.
- **Conteúdo "por colapso" só até o 15º:** a tabela de conteúdo continua com as linhas 0 a 5 (v1) e nada novo entra por colapso depois do 15º (a spec 038 manda o resto para a árvore, os proibidos e as conquistas); testes com colapsos 15, 99, 250 e 499 conferem que nada quebra sem linha de conteúdo.
- **UI:** `RequirementBars` mostra a barra de cada requisito no botão "Estrela pronta: colapso N" (versão compacta), no modal de colapso (passo 1) e no Atlas (com "Falta ..."). Conferida com Playwright (celular emulado: isMobile, hasTouch, DPR 2) em 320, 390 e 1280 px, sem rolagem lateral (`e2e/aperta-collapse.spec.ts`, 6 testes).
- **Simulador:** 3 perfis (casual 1 toque/s e 30 min/dia; normal 2,5 toques/s e 1,5 h/dia; ativo 4 toques/s e 4 h/dia), horas **e dias** por vida, o jogador persegue o marco da vida, modela a Estrela Dourada na renda e evita o Cygnus X-1. Os testes (`sim.test.ts`, 16 sementes `v0` a `v15`, 40 colapsos) exigem as travas abaixo.

### 10.2 O que mudou do plano (decisões minhas, registradas porque a spec dizia outra coisa)

1. **A razão x3 não se sustenta.** Com x3 o simulador mostrou vidas 1 a 8 de 1 a 3 h e vidas 9 a 12 de 9 a 21 h (o poder permanente não acompanha 3^n). A meta virou trechos calibrados (`GOAL_SEGMENTS`): 1º colapso em **50 mi** (o Lucas pediu 80 mi, mas o simulador mostrou a vida 1 em 3,3 h, acima da trava de 3 h; com 50 mi fica em 2,85 h) e do 1º para o 2º x2,8 (50 mi -> 140 mi), x1,95 até o 4º (x2,1 antes da etapa 16), **x1,28 até o 30º** e **x1,08 depois**. A razão volta a subir quando as etapas 15 a 20 trouxerem poder permanente novo (proibidos, árvore, habilidades): é só trocar os números e rodar o calibrador.
2. **Energia depois da 6ª escolha: x1,22 em vez de x1,35** (`ENERGY_STEP_GROWTH`). Com x1,35 as 20 escolhas do 1º colapso levavam ~6,7 h e a trava manda no máximo 3 h; com x1,22 levam ~2,1 h. Os 6 primeiros passos (38 a 640) e a sensação do começo não mudaram. Efeito num save antigo: quem estava com a barra quase cheia passa do teto novo, a energia é aparada e a escolha abre na hora (`flagged: ['energy']`, nada se perde).
3. **"Combo" do marco = sequência de toques seguidos** (cada um dentro da janela do anterior, com o Ritmo Firme comprado), e não o nível de combo: o nível para em 3 ou 4 sem grimórios raros, então a meta 5 do 1º colapso seria impossível. Teto de 30 toques. O combo cheio tem teto de 180 s (humano).
4. **Missões da estação em sequência:** a próxima chega 5 s depois da cumprida (`MISSION_NEXT_DELAY_SEC`) e o sorteio usa só missões curtas (3, 5 e 8 objetos; 150 e 300 toques; 3 e 5 escolhas, ~8 min em média). As 4 da v1 ficam marcadas `legacy` só para validar saves antigos. O bônus de Fragmentos continua uma vez por vida.
5. **Geradores:** `k` e `f(n)` têm tetos (4 geradores no nível 40), porque o poder de uma vida não passa de ~1e10 de poeira, onde só os 4 primeiros geradores chegam ao nível 40. As etapas 15 a 20 pedem nova calibragem.
6. **O jogador simulado evita o Cygnus X-1.** Com ele as vidas ficavam 2 a 3x mais longas (a Estrela Dourada some) e a média misturava dois mundos; sem ele o simulador converge. É uma hipótese de jogador, não uma regra do jogo.
7. **Piso de poeira no `validateSave`** é novo (a spec só falava do teto): impede um save com 500 colapsos e quase nenhuma poeira.

### 10.3 Travas (testadas) e tabela do simulador

- Perfil normal, média de 16 sementes (`v`): da vida 1 à 15 cada uma fica **entre 1 h e 3 h**; da 16 em diante a **tendência** (regressão do log das horas) cresce no máximo **3% por colapso** e nenhuma média passa de 3 h x 1,03^(n-15). Uma vida isolada oscila muito (sorte dos grimórios e das missões); por isso as travas valem para a média.
- Calibração: sementes `c` (calibrador) e `e` (exploração); conferência: `v` (teste) e `r` (tabela abaixo, 12 sementes, 40 colapsos, outras que não foram usadas para calibrar).
- Comandos: `pnpm --filter @nocap/games test` (inclui o simulador, ~3 min) e `pnpm --filter @nocap/games sim` (tabela completa, ~7 min; `APERTA_SIM_SEEDS`, `APERTA_SIM_COLLAPSES`). Recalibrar: `CAL=1 CAL_LIVES=30 pnpm exec vitest run --config vitest.sim.config.ts src/aperta/calibrate.sim.ts`.

Horas de jogo aberto até cada marco (vida 1, uma semente):

```
Marco | Casual | Normal | Ativo
1ª melhoria | 0,03 h | 0,01 h | 0,01 h
1ª escolha | 0,01 h | 0 h | 0 h
10 escolhas | 0,65 h | 0,35 h | 0,21 h
1 mi de poeira | 1,19 h | 0,71 h | 0,26 h
Estrela pronta | 4,42 h | 2,36 h | 1,43 h
```

Média de 12 sementes por vida e por perfil (horas de jogo aberto e, entre parênteses, dias de calendário no ritmo do perfil). A coluna "Faixa" é a trava do perfil normal; os perfis casual e ativo só são medidos (a spec só fixa a faixa do normal):

| Colapso | Meta de poeira | Casual (0.5 h/dia) | Normal (1.5 h/dia) | Ativo (4 h/dia) | Faixa (normal) |
| --- | --- | --- | --- | --- | --- |
| 1º | 50 mi | 4,29 h (8,6 d) | 2,08 h (1,4 d) | 1,41 h (0,4 d) | 1 a 3 h |
| 2º | 140 mi | 3,19 h (6,4 d) | 1,61 h (1,1 d) | 0,89 h (0,2 d) | 1 a 3 h |
| 3º | 294 mi | 4,77 h (9,5 d) | 1,84 h (1,2 d) | 0,95 h (0,2 d) | 1 a 3 h |
| 4º | 617 mi | 4,88 h (9,8 d) | 1,86 h (1,2 d) | 1,36 h (0,3 d) | 1 a 3 h |
| 5º | 790 mi | 4,59 h (9,2 d) | 2,02 h (1,3 d) | 1,65 h (0,4 d) | 1 a 3 h |
| 6º | 1,01 bi | 4 h (8 d) | 2,49 h (1,7 d) | 1,17 h (0,3 d) | 1 a 3 h |
| 7º | 1,29 bi | 5,75 h (11,5 d) | 2,41 h (1,6 d) | 0,98 h (0,2 d) | 1 a 3 h |
| 8º | 1,66 bi | 4,18 h (8,4 d) | 2,27 h (1,5 d) | 1,21 h (0,3 d) | 1 a 3 h |
| 9º | 2,12 bi | 4,19 h (8,4 d) | 2,14 h (1,4 d) | 0,96 h (0,2 d) | 1 a 3 h |
| 10º | 2,72 bi | 2,93 h (5,9 d) | 1,56 h (1 d) | 1,35 h (0,3 d) | 1 a 3 h |
| 11º | 3,48 bi | 3,95 h (7,9 d) | 1,46 h (1 d) | 1,35 h (0,3 d) | 1 a 3 h |
| 12º | 4,45 bi | 5 h (10 d) | 1,61 h (1,1 d) | 1,16 h (0,3 d) | 1 a 3 h |
| 13º | 5,69 bi | 4,66 h (9,3 d) | 2,82 h (1,9 d) | 1,04 h (0,3 d) | 1 a 3 h |
| 14º | 7,29 bi | 6,67 h (13,3 d) | 2,06 h (1,4 d) | 0,86 h (0,2 d) | 1 a 3 h |
| 15º | 9,33 bi | 5,82 h (11,6 d) | 1,9 h (1,3 d) | 1,8 h (0,5 d) | 1 a 3 h |
| 16º | 11,9 bi | 6,37 h (12,7 d) | 2,99 h (2 d) | 1,27 h (0,3 d) | 1 a 1,95 h |
| 17º | 15,3 bi | 5,38 h (10,8 d) | 2,56 h (1,7 d) | 1,43 h (0,4 d) | 1 a 3,08 h |
| 18º | 19,6 bi | 7 h (14 d) | 2,18 h (1,5 d) | 1,1 h (0,3 d) | 1 a 2,64 h |
| 19º | 25 bi | 5,38 h (10,8 d) | 1,73 h (1,2 d) | 0,96 h (0,2 d) | 1 a 2,25 h |
| 20º | 32,1 bi | 8,08 h (16,2 d) | 2,26 h (1,5 d) | 1,11 h (0,3 d) | 1 a 1,78 h |
| 21º | 41 bi | 6,94 h (13,9 d) | 2,35 h (1,6 d) | 1,17 h (0,3 d) | 1 a 2,33 h |
| 22º | 52,5 bi | 5,56 h (11,1 d) | 1,53 h (1 d) | 1,59 h (0,4 d) | 1 a 2,42 h |
| 23º | 67,2 bi | 7,15 h (14,3 d) | 2,96 h (2 d) | 1,03 h (0,3 d) | 1 a 1,57 h |
| 24º | 86,1 bi | 6,4 h (12,8 d) | 1,68 h (1,1 d) | 1,06 h (0,3 d) | 1 a 3,05 h |
| 25º | 110 bi | 7,96 h (15,9 d) | 2,01 h (1,3 d) | 1,81 h (0,5 d) | 1 a 1,73 h |
| 26º | 141 bi | 5,86 h (11,7 d) | 2,79 h (1,9 d) | 1,54 h (0,4 d) | 1 a 2,07 h |
| 27º | 180 bi | 7,57 h (15,1 d) | 2,52 h (1,7 d) | 1,84 h (0,5 d) | 1 a 2,88 h |
| 28º | 231 bi | 6,23 h (12,5 d) | 4,03 h (2,7 d) | 1,74 h (0,4 d) | 1 a 2,6 h |
| 29º | 296 bi | 5,04 h (10,1 d) | 2,01 h (1,3 d) | 1,37 h (0,3 d) | 1 a 4,15 h |
| 30º | 378 bi | 8,88 h (17,8 d) | 2,86 h (1,9 d) | 1,65 h (0,4 d) | 1 a 2,07 h |
| 31º | 409 bi | 5,98 h (12 d) | 3,27 h (2,2 d) | 2,48 h (0,6 d) | 1 a 2,94 h |
| 32º | 441 bi | 5,75 h (11,5 d) | 2,69 h (1,8 d) | 2,28 h (0,6 d) | 1 a 3,37 h |
| 33º | 477 bi | 9,19 h (18,4 d) | 2,22 h (1,5 d) | 2,65 h (0,7 d) | 1 a 2,77 h |
| 34º | 515 bi | 6,34 h (12,7 d) | 3,24 h (2,2 d) | 2,36 h (0,6 d) | 1 a 2,29 h |
| 35º | 556 bi | 5,43 h (10,9 d) | 3,59 h (2,4 d) | 2,57 h (0,6 d) | 1 a 3,34 h |
| 36º | 601 bi | 5,47 h (10,9 d) | 3,87 h (2,6 d) | 1,9 h (0,5 d) | 1 a 3,69 h |
| 37º | 649 bi | 8,93 h (17,9 d) | 3,8 h (2,5 d) | 2,25 h (0,6 d) | 1 a 3,98 h |
| 38º | 701 bi | 5,95 h (11,9 d) | 3,59 h (2,4 d) | 2,78 h (0,7 d) | 1 a 3,91 h |
| 39º | 757 bi | 8,34 h (16,7 d) | 2,85 h (1,9 d) | 1,76 h (0,4 d) | 1 a 3,69 h |
| 40º | 817 bi | 4,6 h (9,2 d) | 3,25 h (2,2 d) | 1,96 h (0,5 d) | 1 a 2,94 h |

Leitura: o normal fica em 1,5 a 2,8 h de jogo da vida 1 à 15 (1 a 2 dias de calendário por vida); o ativo, em 0,9 a 2,1 h; o casual, em 3 a 7 h (6 a 14 dias por vida), o que é esperado para 30 min por dia. Depois do 30º colapso o normal sobe devagar (de ~2,5 h para ~3,3 h até o 40º).

### 10.4 O que não foi testado

- **Ninguém jogou isto a mão:** o ritmo (1 a 3 h) vem só do simulador; o Lucas ainda precisa jogar 1 a 2 dias (etapa 21). Os marcos de combo (sequência de toques seguidos e combo cheio por 20 + n s) e de missões em sequência em especial pedem mão humana: o simulador toca num ritmo constante.
- A tela só foi vista no Chromium headless emulando celular (Pixel/DPR 2) em 320, 390 e 1280 px; não em aparelho real, Safari nem Firefox. O Chromium headless não tem Web Audio, então o som do colapso não foi ouvido.
- As rotas da API do Aperta! seguem testadas só com repositório em memória (`apps/api/src/aperta/aperta.test.ts`), não contra o banco real.
- Os testes de ponta a ponta (Playwright) foram rodados só para o colapso; os de regiões, árvore e tutorial não foram repetidos (nenhum mexe no que mudou além do botão "Estrela pronta", que não aparece neles).

## 11. Etapa 16 pronta: Cintilas, fontes e conquistas ampliadas (22/10/2026)

### 11.1 Entregue

- **Moeda `sparks` no save** (`SaveState.sparks = { legacy, spent }`; `sparks.ts`). O saldo **não é um contador que sobe**: é calculado do que o save já guarda (conquistas, álbum, capturas raras, colapsos, poeira total, eventos vistos, níveis dos proibidos) mais `legacy` (o que os Fragmentos antigos valiam). Só o gasto é contador. Assim nenhuma fonte paga duas vezes nem fica sem pagar, e o servidor refaz a mesma conta (`sparkSources`, `sparksTotal`, `sparksAvailable`).
- **Migração 1:1:** um save com `fragments { earned, spent }` vira `sparks { legacy: earned, spent }` na leitura (`migrateSparks` no `validateSave`); a árvore comprada continua paga. Testado com os 11 saves reais antigos (`fixtures/legacy-*.json`): saldo e gasto idênticos, e o saldo novo nunca é menor porque as fontes só somam (quem já tinha conquistas ou álbum ganha as Cintilas deles).
- **Fragmentos removidos:** `fragments`, `fragmentsFor`, `fragmentsAvailable`, `respecFee`, `missionBonus` e `MISSION_FRAGMENTS` saíram do motor; a tela e os textos (HUD, modal de colapso, Atlas, tutorial, árvore, chip da missão) falam de Cintilas. O colapso não dá mais Fragmentos por conta própria: dá Cintilas pelas fontes que abre.
- **Fontes (seção 5.1):** álbum (1 comum ou raro, 2 épico, 3 lendário, 4 proibido, na 1ª descoberta); 1ª captura de cada objeto raro ou lendário (Estrela Dourada e Sonda hoje; lendários na etapa 20) = 3, e degraus de 10, 50, 200 e 1.000 capturas raras = 2, 3, 5 e 8; marcos que repetem (1 a cada 3 colapsos, 1 a cada marco de poeira total 1e6, 1e9, 1e12..., 1 na 1ª vez de cada evento raro); **Estrela dos Proibidos** (nível 3 = 2 e nível 5 = 4, uma vez por proibido) ligada a `stats.forbiddenBest`, que o motor já atualiza ao escolher um proibido: funciona hoje com Sagitário A*, Cygnus X-1 e M87*, e o Cofre (etapa 15) só precisa manter esse campo.
- **Conquistas:** de 31 para **159** em dados (`achievements.ts`), com os 31 ids antigos intactos e 16 famílias (Toques, Poeira, Grimórios, Objetos, Combo e ritmo, Colapsos, Proibidos, Automação, Sorte, Exploração, Árvore, Geradores e toque, Missões da estação, Regiões, Tempo, Escondidas). Recompensa por tamanho: pequena 1 (16), média 2 (52), grande 3 (60), épica 5 (31); as 10 escondidas valem 3. **127 contam hoje e 32 esperam conteúdo** (`needs`): novos proibidos, automação e habilidades, objetos lendários, eventos novos, árvore nova, sequência de dias e mais regiões; `FEATURES` guarda as chaves e a etapa que entregar a feature liga a sua. Enquanto a chave está desligada a conquista nunca é dada, aparece como "em breve" e o servidor recusa um save que a traga.
- **Contadores novos em `SaveStats`** (saves antigos entram com 0; `mergeSaves` junta pelo maior ou pela união): `raresCaptured`, `capturedKinds`, `chainBest`, `missionsDone`, `eventsSeen`, `genBest`, `upgradesBought`, `touchBest`, `offers`, `legendaryOffers`, `firstOfferLegendary`, `rareStreak`/`rareStreakBest`, `rerolls`, `forbiddenBest`, e os de habilidades e dias seguidos que as etapas 19 e 20 vão ligar. O motor os atualiza em `press`, `captureObject`, `buyUpgrade`, `chooseGrimoire`, `rerollGrimoire`, na abertura da oferta e no início de cada evento.
- **`validateSave`:** `sparks.legacy` limitado ao que os Fragmentos antigos podiam dar; gasto <= saldo; árvore <= gasto; conquista só do catálogo e só de conteúdo que existe; contadores novos coerentes (raros <= capturas, tipos e eventos válidos, `forbiddenBest` só de proibidos já abertos).
- **Tela:** faixa de aviso `+N Cintilas` (`.ap-pickup-sparks`, em `transform`/`opacity`, com o saldo para gastar) logo depois do aviso da conquista; contador de Cintilas no botão da árvore (já existia para os Fragmentos) e, na página da árvore, o saldo, o ganho e o gasto e "De onde vêm as Cintilas" (por fonte); refazer a árvore devolve 100% (seção 5.3). **Página de Conquistas maior:** filtro por família (com N/M de cada), busca sem acento, estado (todas, faltam, ganhas), recompensa em cada card, Cintilas ganhas, a ganhar e em breve, e as que esperam conteúdo em tracejado.
- **Balanço (5.4):** `balance.ts` + `tree-targets.ts` + `balance.test.ts` (a conta abaixo).

### 11.2 A conta do balanço

`T` vem de `tree-targets.ts` (5 ramos de 24 nós = **120 nós**; por ramo: tier 1 = 4 nós de 2 níveis, tier 2 = 6 de 2, tier 3 = 3 de 2 e 3 de 1, tier 4 = 5 de 1, tier 5 = 3 de 1; custo por nível 1, 2, 3, 5 e 8 Cintilas = 108 por ramo). Quando a árvore real existir (etapa 17) o teste passa a lê-la.

| Termo | Cálculo (dos dados) | Valor |
| --- | --- | --- |
| **T** (custo da árvore alvo) | 5 ramos x 108 | **540** |
| conquistas | soma de `reward` das 159 | 455 |
| álbum | 17 comuns x 1 + 19 raros x 1 + 13 épicos x 2 + 6 lendários x 3 + 3 proibidos x 4 | 92 |
| raros | 2 tipos (Sonda e Estrela Dourada) x 3 + degraus 2 + 3 + 5 + 8 | 24 |
| Estrela dos Proibidos | 3 proibidos x (2 + 4) | 18 |
| **F** (fontes finitas) | 455 + 92 + 24 + 18 | **589** |
| **R25** (repetem até o colapso 25) | 8 (a cada 3 colapsos) + 2 (poeira total passa de 1e6 e 1e9, não de 1e12) + 6 (eventos: 2 de hoje e 4 planejados) | **16** |

- `F >= 0,80 x T`: 589 >= 432 (F/T = 1,09). `F + R25 >= 1,10 x T`: 605 >= 594 ((F+R25)/T = 1,12). O teste também confere que uma árvore 2x mais cara quebra a regra.
- **F hoje** (só as conquistas que já contam, sem as 32 que esperam conteúdo): 354 + 92 + 24 + 18 = **488**. O resto (101 Cintilas) chega com as etapas 15 a 20.

### 11.3 Desvios do plano

1. **Alvo da conta:** a spec pedia `T` 500 a 600, `F` 420 a 480 e as duas regras juntas. Com `R25` perto de 16 (as fontes que repetem dão pouco até o colapso 25) a regra `F + R25 >= 1,10 x T` exige `F` perto de 1,1 x `T`, o que as duas faixas do texto não permitem. Mantive `T` em 540 (dentro da faixa) e subi `F` para 589 ajustando a lista e as recompensas, como a seção 5.4 manda; `F` ficou **acima** dos 480 do alvo inicial.
2. **O saldo é derivado, não guardado:** a spec dizia "moeda `sparks` no save". Guardo `legacy` e `spent`; o total vem das fontes. Foi a forma de a migração e o servidor não poderem divergir.
3. **Refazer a árvore devolve 100% já nesta etapa** (a 5.3 é da etapa 17, mas a taxa de 20% dependia dos Fragmentos). A restrição "só fora de uma vida em andamento" fica para a etapa 17.
4. **"Dias seguidos" e habilidades** ficam em `needs`: o motor não tem relógio de parede (nada rende offline) e as habilidades são da etapa 19.
5. **Metas de poeira a partir do 4º colapso ~14% menores** (passo x1,95 em vez de x2,1 entre o 2º e o 4º): as Cintilas das conquistas chegam mais devagar que os Fragmentos de antes (3 + nº por colapso), então a árvore enche mais tarde e as vidas 13 e 19 passaram da trava. A tabela da seção 10.3 foi gerada com o passo antigo; o teste do simulador (`sim.test.ts`) passa com o novo.
6. **Ordem e valores das famílias são decisão minha** (a spec só dava as famílias e exemplos): tabela de recompensas e metas em `achievements.ts`.

### 11.4 O que não foi testado

- Ninguém jogou isto à mão: o ritmo de ganho de Cintilas e o preço dos nós da árvore real (etapa 17) ainda não foram sentidos; o balanço é uma conta, não uma sessão de jogo.
- As Cintilas das 32 conquistas dormentes só podem ser testadas ligando `FEATURES` num teste; as features reais chegam depois.
- A página só foi vista no Chromium headless emulando celular, em 320, 390 e 1280 px (ver o relatório); sem aparelho real, sem Safari nem Firefox e sem som (o aviso toca `chime`, que não roda no Chromium headless).
- A API do Aperta! continua testada só com repositório em memória.

## 12. Etapa 15 pronta: Cofre dos Proibidos no lugar do Atlas (22/10/2026)

### 12.1 Entregue

- `packages/games/src/aperta/forbidden.ts`: 10 proibidos em dados (Sagitário A*, Cygnus X-1, M87*, TON 618, Phoenix A, Gaia BH3, GW150914, V404 Cygni, Holmberg 15A, IC 10 X-1). Cada um tem bônus, preço e selo com números fixos por nível (1 a 5); o selo vale só no nível 5.
- Colapso: `vaultOffers(state)` dá até 3 proibidos distintos fora do nível 5 (a semente é a da vida); `collapse(state, escolha)` sobe 1 nível (ou guarda um novo no nível 1). Com os 10 no nível 5 a oferta é vazia e o colapso dá um Selo Estelar (+100 de poeira por toque, conta para as conquistas `seal-*`).
- Atlas removido por inteiro (páginas, espaços, bônus de conjunto, família Buracos Negros, textos e tela). Os 3 grimórios proibidos antigos saíram do sorteio.
- Save v3: `vault` e `seals`; a migração v2 para v3 apaga o Atlas, converte cada página em `ATLAS_PAGE_SPARKS` (2) Cintilas em `sparks.legacy` e tira os proibidos antigos da vida em andamento (testada com os `fixtures/legacy-*.json`). `validateSave` confere níveis, selos, álbum e `forbiddenBest`.
- Cintilas dos proibidos (nível 3 e 5, primeira descoberta no álbum) e as conquistas `needs: forbidden-new` ligadas; `vault-4/7/10` e `seal-1/10` novas; `atlas-*` aposentadas (`retired`).
- Tela: modal de colapso com 3 cartas (nome, nível de hoje para o de depois, bônus, preço, selo) e passo 2; página própria "Cofre dos Proibidos" (10 casas com pontos de nível, descrição e o bloco de colapsar), aberta por um botão novo na dock a partir do 1º colapso.
- Simulador: `bestVault` escolhe o proibido da oferta; as travas da seção 10 seguem as mesmas.

### 12.2 Desvios do plano

- O passo de tutorial do Cofre é um texto de apresentação dentro do modal do 1º colapso (o tutorial já acabou nesse ponto, então não há cartão de dica novo nem botão novo no `UiState`).
- Dois bônus levam um efeito extra para não copiar um grimório comum (TON 618: parado, mantém ritmo; Phoenix A: janela do combo maior).
- `apertaSfx` e a arte não ganharam nada específico do Cofre; o aviso do colapso usa o texto "Cofre: nome, nível N".

### 12.3 Simulador: as travas não fechavam (RESOLVIDO na etapa 17, seção 13)

- Depois de duas rodadas de ajuste nos números dos proibidos (soma dos níveis, bônus geométrico por nível, preços mais leves), as vidas 1 a 5 e a maioria das 7 a 15 ficam na faixa de 1 a 3 h, mas **3 testes de `sim.test.ts` seguem vermelhos**: a vida 6 sai em 0,93 h (abaixo de 1 h), a média da vida 16 fica em ~6 h (limite 3,09 h) e algumas sementes travam (40 h) a partir do colapso ~16. A variação entre sementes é grande porque a sorte da oferta (Sagitário A* e GW150914 aceleram muito; Gaia BH3 e Holmberg 15A quase nada) decide a vida.
- Causa: o Atlas dava poder acumulado (páginas e bônus de conjunto) que o Cofre (no máximo 50 níveis, 1 por colapso) não repõe sozinho depois do colapso ~15. O resto do poder tardio é da árvore grande (etapa 17). Próximo passo: nivelar os 10 proibidos (os fracos sobem, os que aceleram demais descem) e recalibrar junto com a árvore real; as travas não foram mexidas.

### 12.4 O que não foi testado

- Nenhum Playwright nem varredura responsiva (320/390/1280); os specs e2e do colapso, da árvore e do tutorial ainda falam do Atlas e precisam ser atualizados na rodada de telas.
- Ninguém jogou o Cofre à mão: o equilíbrio dos números de cada proibido vem do simulador, não de sessão real.

## 13. Etapa 17 pronta: Árvore de Habilidades, motor e dados (22/10/2026)

### 13.1 Entregue

- `tree.ts`: 120 nós em 5 ramos de 24 (Automação, Habilidades ativas, Sorte, Exploração, Cosmos). Cada nó tem id (`au-01`...), tier 1 a 5, 1 a 2 níveis, 1 a 3 pais (6 ligações cruzadas entre ramos), custo por nível 1/2/3/5/8 e o efeito em dados (`effect: { kind, params }`). Por ramo: tier 1 = 4 nós, tier 2 = 6, tier 3 = 6, tier 4 = 5, tier 5 = 3.
- `needs`: os nós de mecânica futura (Autoclick, captura e compra automáticas, habilidades, rerolls, 4ª carta, pity, eventos, lendários, Mapa) ficam fechados por `TREE_FEATURES` (Automação e Habilidades ligam na 19; Sorte e Exploração na 20). Um nó cujo pai está fechado também está. Hoje existem 29 nós (115 Cintilas).
- Funcionam já: poder direto (15 nós, 12,5%: poeira por toque, energia por toque, geradores), Reforço dos proibidos (`forbiddenPower`), Sintonia (poeira por nível de proibido), Constelação (por ramo com 5 nós), Eco do colapso (primeiros toques da vida), Cartas de capa (o favorito comum começa a vida em nível) e Largada (energia inicial).
- `buyNode` (pais, nível máximo, Cintilas, árvore aberta no 1º colapso), `respecTree` devolve 100% e só com `canRespec` (estrela pronta ou vida zerada).
- Save v4: a árvore antiga (6 ramos x 3 níveis) é descartada e `sparks.spent` volta a 0 (o gasto vira Cintilas livres); `validateSave` confere nós, níveis, pais e mecânica aberta. Testado com os 11 `fixtures/legacy-*.json`.
- Testes: grafo (pais de tier menor, alcançável, custo por tier), compra, pais, refazer, validação, migração, poder direto <= 15%, não-duplicação (domínios de melhorias, grimórios e proibidos) e o balanço com a árvore real. A tela atual da árvore virou uma lista provisória (a tela em grafo é a etapa 18).

### 13.2 Balanço das Cintilas (seção 5.4, árvore real)

| Termo | Valor |
| --- | --- |
| T (120 nós) | 540 |
| F (conquistas 463 + álbum 120 + raros 24 + Estrela dos Proibidos 60) | 667 |
| R25 | 16 |

F/T = 1,24 (>= 0,80) e (F + R25)/T = 1,27 (>= 1,10). Não precisou ajustar custos.

### 13.3 Nivelamento e tabela do simulador (perfil normal, 16 sementes, 40 vidas)

- Os 10 proibidos passaram a ter um fator de poeira por toque que cresce por nível (geométrico) além do efeito de cada um, para o poder dos fracos acompanhar o dos fortes; o preço ficou mais leve. Os nós de poder direto e o Eco do colapso foram reduzidos (o Eco, com tudo comprado, encurtava as vidas em ~34%). As travas e `GOAL_SEGMENTS` não foram tocados.
- Horas por vida, jogador que compra os nós implementáveis na ordem de custo: 2,85 2,29 2,33 2,51 2,26 1,90 1,83 1,52 1,55 1,37 1,22 1,96 2,07 2,72 2,14 (vidas 1 a 15, todas entre 1 e 3 h), depois 1,88 1,62 1,81 1,95 1,60 1,66 1,89 1,36 1,92 2,71 1,71 1,91 1,67 1,38 1,76 1,56 1,23 1,53 1,44 1,23 1,48 1,09 1,09 2,36 1,47 (vidas 16 a 40, sem crescer).
- Sem árvore as vidas 6 a 15 ficam em 2 a 4,5 h; com a árvore completa (os nós que existem) a média das vidas 6 a 15 cai menos de 25% (`sim.test.ts`). O `sim.test.ts` passa inteiro (17 testes).

### 13.4 Desvios e o que não foi testado

- A chave `tree-v2` das conquistas segue desligada: com só 29 nós alcançáveis, "120 nós" seria impossível; liga junto com as etapas 19 e 20.
- Poder direto ficou em 15 nós; o nivelamento usou o Eco, o Reforço e o poder direto, e a oferta de proibidos não mudou.
- Cartas de capa e Largada só têm teste de unidade; o simulador não define favorito, então a capa não entrou na conta das vidas.
- Os specs e2e da árvore (`aperta-tree`) ainda falam da árvore antiga; sem Playwright nesta etapa.

