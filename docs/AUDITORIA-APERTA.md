# Auditoria do Aperta! (23/10/2026, `develop` em `da7029d`)

Só leitura e execução; nenhum código, número, teste ou spec foi alterado. Cada número abaixo vem de um comando rodado nesta sessão.

## 1. Resumo

- O jogo compila e quase tudo passa: `apps/web` 567/567, `apps/api` 336 (1 ignorado), `packages/games` 901 de 903, typecheck limpo nos três pacotes.
- Vermelho de verdade: **2 testes do simulador** (`sim.test.ts`); a árvore completa encurta a vida em ~55% (limite 25%) e há vidas abaixo de 1 h.
- Faltam: calibragem da árvore (decisão do Lucas), o pior caso em 320 x 640 (avisos sobrepostos), 4 nós e 9 conquistas ainda fechados, a confirmação do banco (migration 0009) e uma sessão de jogo humana. Nada disso quebra save.

## 2. O que bloqueia

Nada impede jogar nem quebra save. Bloqueia só o "tudo verde":

1. **`sim.test.ts` > "até o 15º colapso cada vida leva de 1 h a 3 h"**. Mensagem desta rodada: `vida 9: 1.00 h: expected 0.9973 to be >= 1`. A rodada anterior (mesmo código, antes do `git pull`) falhou na vida 11 com 0,87 h; as sessões anteriores viram a vida 15 com 0,94 h. O simulador é caótico, então a vida que falha muda a cada ajuste. Causa provável: poder total da árvore alto demais (item 3 abaixo). Categoria (a), falha nova do Aperta!.
2. **`sim.test.ts` > "a árvore completa não encurta a vida mais de ~25%"**. Mensagem: `com árvore 0.76 h, sem 1.65 h: 0.463 >= 0.75`. Categoria (a).
3. **320 x 640 com tudo na tela** (save "late" do `aperta-qa.mjs`): os avisos se sobrepõem (cartão do evento sobre a dica da barra de habilidades, missão sobre os objetos, o botão "Estrela pronta" cobre a dock e corta o texto "Melhorias"), e o cenário `collapse-late` estourou o tempo (captura `qa/320x640-touch__collapse-late__FAILED.png` na pasta de rascunho da sessão). É o pior caso, mas o botão de colapso fica por cima do que ele cobre.

Testes vermelhos por categoria: (a) os 2 acima; (b) nenhum teste antigo fora do Aperta! falhou (Atravessa e `three` passaram); (c) nenhum de ambiente. Lint: 6 erros, todos fora do Aperta! ou já conhecidos (`api/scripts/words/apply-review.mjs:64`, `atravessa-room.engine.ts:17`, `atravessa.test.ts:11`, `atravessa/sim.ts:6`) mais 2 em `apps/web/src/games/aperta/api-save-store.ts:306` e `:357` (`_revision` sem uso, do Aperta!, trivial).

## 3. O que é ajuste

| Item | Onde | Esforço |
| --- | --- | --- |
| Calibrar a árvore completa. Medição (6 sementes, vidas 6 a 12, perfil normal): sem árvore 1,65 h; completa 0,71 a 0,77 h; sem Automação e Habilidades 1,28 h; só Automação e Habilidades (sem Cosmos, Sorte, Exploração) 1,01 h; sem Sorte e Exploração 0,98 h. As **duas combinações somam**: Automação + Habilidades é o maior fator (razão ~0,77 sem elas), Sorte + Exploração o segundo. Mexer em cooldown/cps de uma habilidade isolada não mudou a média (ruído de ±20%). Opções na seção 4. | `packages/games/src/aperta/tree.ts`, `tree-skills.ts` | M |
| Sobreposição dos avisos em 320 x 640 (cartão do evento, missão, botão "Estrela pronta" sobre a dock) | `apps/web/src/games/aperta/game.css`, `GameScreen.tsx` | M |
| 4 nós fechados (`co-06` Observatório, `co-14` Projeção, `co-20` Mapa do cosmos, `co-23` Constelação eterna): `TREE_FEATURES.observatory=false` (`tree.ts:40`). Precisam da tela do Observatório/Projeção/Mapa, que nenhuma etapa entregou. | `tree.ts`, nova tela | G |
| 9 conquistas dormentes (36 Cintilas): `tree-v2` (5: `tree-nodes-25/50/100/120`, `hid-spent-100`), `daily-streak` (3: `streak-3/7/30`), `regions-more` (1). `tree-v2` pode ligar assim que os 4 nós fechados abrirem ("120 nós" só é possível com eles); `daily-streak` e `regions-more` não têm etapa. | `achievements.ts:56-64` | P a G |
| Texto antigo de UI: `content/index.ts:20` "cumprir dá Fragmentos extras ao colapsar"; `tree-logic.ts:183` mostra "Fragmentos de antes" (aceitável, é o saldo migrado); `collapse.css:135` comentário diz Atlas; conquista visível "Atlas completo" (`grim-all`, `achievements.ts:197`, conta o álbum). | arquivos citados | P |
| Erro de lint `_revision` | `api-save-store.ts:306,357` | P |
| Cartão de dica do 1º colapso/Cofre é texto dentro do modal, sem passo próprio no tutorial (spec 040 seção 7 pedia passo de gatilho); a dica de Habilidades é uma linha na barra e a de Eventos existe (`GameScreen.tsx:372`). | `CollapseModal.tsx`, `SkillBar.tsx` | P |
| Zoom por pinça na árvore não existe (era opcional); painel no celular fica abaixo do grafo, não sobre ele (spec 040 15.2) | `TreeGraph.tsx` | M |
| Teste do teto de 6/s do Autoclick: depois da calibragem o teto nunca é atingido (nó mais forte = 2,5/s), o teste só confere `cps <= 6` | `skills.test.ts:30` | P |
| `text-clipped`/`text-cut` relatados pela varredura em 320 a 1920 px: `span.ap-req-ok ", cumprido"` (20, é texto só para leitor de tela: falso alarme) e `span.ap-cc-fx` no fim do modal de colapso (rolagem do modal: falso alarme). Nó fora da tela e chips fora da tela na árvore são o próprio grafo arrastável (falso alarme). | — | — |

## 4. O que depende do Lucas

1. **Quanto a árvore completa pode encurtar a vida?** Hoje ~55% (0,76 h contra 1,65 h; spec pede 25%). Opções: (A) **mudar a trava** para ~50%, porque quase ninguém compra os 540 pontos (o balanço diz F=679 contra T=540; consequência: o teste fica verde sem mexer no jogo, mas quem comprar tudo termina vidas em ~0,8 h e a "vida 1 a 3 h" só vale até o meio da árvore); (B) **enfraquecer Automação e Habilidades de verdade** (cortar efeito dos nós de poder, não só cooldown; consequência: a árvore fica menos empolgante e exige nova rodada do simulador, ~15 min por medida); (C) **tornar essas habilidades "conveniência"**: elas só poupam toque (sem ganho de poeira além do toque), e o ganho vem dos nós de Cosmos (consequência: o Autoclick vale para quem não quer tocar, não para acelerar; é a mudança mais coerente com a regra anti-farm, mas altera a spec 040 seção 6.2).
2. **Migration `0009_aperta.sql` está aplicada?** O `HANDOFF.md` se contradiz: a linha 67 diz "pendente, decisão do Lucas", a linha 58 diz "aplicada em 22/10/2026 (`pnpm db:migrate`)". Verifiquei só que o arquivo e o `meta/0009_snapshot.json` existem e que `_journal.json` cita 0009 (1 ocorrência). **Não verifiquei o banco** (não apliquei nem consultei). Pergunta: o banco tem a tabela `aperta_saves`? Sim: só falta testar as rotas contra ele. Não: autorizar `pnpm db:migrate`.
3. **Jogar 1 a 2 dias** e dizer: ritmo do começo (vidas 1 a 3), meta do 1º colapso em 50 mi (você pediu 80; spec 040 10.2), a sensação do Autoclick, dos eventos e do Radar de lendários, e se a árvore "completa" deve valer tanto.
4. **Nome "Cintilas"** (spec 040 seção 5 diz "nome provisório, o Lucas pode trocar"): manter ou trocar?
5. **Observatório, Projeção, Mapa do cosmos:** fazer essas telas (liga 4 nós e `tree-v2`) ou aposentar os 4 nós e as 5 conquistas `tree-v2`?
6. **Sequência de dias e "mais regiões":** entram na v2 ou saem (`daily-streak`, `regions-more`)? Hoje dormem.
7. **Revisão visual em aparelho real** (nunca feita; Chromium headless não tem som nem Safari).

## 5. O que está pronto e conferido

- Typecheck `packages/games`, `apps/web`, `apps/api`: sem erro (`npx tsc --noEmit`).
- Testes: `apps/web` 56 arquivos, 567 verdes; `apps/api` 31 arquivos, 336 verdes, 1 ignorado; `packages/games` 40 de 41 arquivos verdes (901 testes; só `sim.test.ts` falha). Inclui `legacy-saves.test.ts`, `save.test.ts`, `balance.test.ts`, `skills.test.ts`, `tree.test.ts`.
- Árvore: 120 nós, **116 ativos**, 4 fechados por `observatory` (lista acima).
- Balanço de Cintilas (`balance.test.ts`, verde): T=540, F=679 (conquistas 463, álbum 120, raros 36, estrelas 60), R25=16 (marcos de colapso 8, de poeira 2, eventos 6). F>=0,8T e F+R25>=1,1T fecham. Mesmo tirando as 9 conquistas dormentes (36 pontos) F=643, ainda acima de 0,8T=432 e F+R25=659 acima de 1,1T=594.
- Conquistas: 164 definidas, 3 aposentadas (`retired`), 9 dormentes; **152 contáveis hoje**. A página mostra "161 conquistas" (164 menos as 3 aposentadas).
- Cofre: 10 proibidos em `forbidden.ts`, oferta de 3, Selo Estelar quando todos estão no nível 5, página separada (`VaultPage`) e modal em 2 passos; e2e do colapso passa nos 3 tamanhos. Não conferi item a item a regra "nunca oferecer proibido no nível 5" lendo o código; o teste `collapse-infinite.test.ts` passa.
- Atlas/Fragmentos/Ascender: restam só a migração de save (`save.ts:215-217`, `forbidden.ts:15 ATLAS_PAGE_SPARKS`), as conquistas aposentadas (`atlas-4`, `atlas-7`, `atlas-families`), testes de migração, comentários e os textos do item 3. Nenhuma tela usa o Atlas.
- Save: `SAVE_VERSION` com migrações v2 -> v3 (Cofre) e v3 -> v4 (árvore) em `save.ts:210-243`; 11 fixtures `fixtures/legacy-*.json` (vida 1 a 5) validadas por `legacy-saves.test.ts` (verde). Risco restante: saves reais de contas nunca foram lidos (a API só foi testada com repositório em memória).
- e2e Playwright (Chromium local): `aperta-collapse`, `aperta-tree`, `aperta-tutorial`, `aperta-regions` e `aperta-tree-graph` passam (35 testes, rodados na etapa 21 desta sessão; não repeti agora).
- Varredura responsiva (`apps/web/scripts/aperta-qa.mjs`, Chromium, 320/390/768/1024/1280/1920, toque e mouse): 150 pontos OK; achados reais só o item 3 da seção 2. Sem rolagem lateral de página, sem alvo de toque < 44 px (os botões de filtro da árvore foram para 44 px), sem foco invisível relatado.

## 6. Próximos prompts sugeridos

1. "Leia `docs/AUDITORIA-APERTA.md`. Decisão do Lucas sobre a árvore completa: aplique a opção C (Automação e Habilidades só poupam toque; sem ganho de poeira além do toque), refaça a calibragem com 16 sementes até `sim.test.ts` ficar verde e atualize a seção 17 da spec 040. Não mude as travas."
2. "Corrija a sobreposição dos avisos em 320 x 640 (cartão de evento, missão, botão 'Estrela pronta' e dock) em `game.css`/`GameScreen.tsx`, rode `aperta-qa.mjs` em 320 e 390 px e confira a captura do cenário `collapse-late`."
3. "Faça a tela do Observatório/Projeção/Mapa do cosmos (spec 040 seção 6) ou aposente os 4 nós `co-06/14/20/23` e as 5 conquistas `tree-v2`, conforme a minha resposta: ______. Atualize o teste de balanço."
4. "Limpe as sobras: texto 'Fragmentos extras' em `content/index.ts:20`, comentário do Atlas em `collapse.css:135`, os 2 erros de lint de `api-save-store.ts` e o teste do teto de 6/s do Autoclick; sem mudar números."
5. "Confirme a migration `0009_aperta.sql` no banco (eu autorizo `pnpm db:migrate` em: ______) e rode as rotas do Aperta! contra o banco real com um save de `fixtures/legacy-life2-1h.json`."


---

## Atualização de 23/10/2026: o que foi resolvido

- **Simulador:** `sim.test.ts` 17 de 17 verde (as 2 travas vermelhas fecharam com a decisão C, a calibragem de Sorte, Exploração e Cosmos e a economia v3 da spec 041).
- **Observatório:** os 4 nós e as 5 conquistas `tree-v2` foram aposentados (116 nós ativos, nenhum fechado por `needs`).
- **Sobreposição em 320 x 640:** avisos numa faixa só, botão de colapso sem cobrir a dock (a varredura em 320, 390 e 1280 px não achou problema novo; o pior caso com todos os avisos juntos ainda corta um subtítulo).
- **Sobras e lint:** texto de missão, comentário do Atlas e a conquista Álbum completo; os 2 erros de lint do `api-save-store` saíram (restam os 4 de fora do Aperta!).
- **Pendente (Lucas):** jogar para sentir o ritmo, nome Cintilas, `daily-streak` e `regions-more` seguem dormentes.
