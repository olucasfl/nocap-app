# HANDOFF: retomando o NoCap em outro computador

Leia este arquivo primeiro. Ele diz onde o projeto parou e como voltar a trabalhar em 10 minutos.

## Estado atual (atualizado em 07/10/2026)

Tudo está em `main` e publicado (API no Render, web na Vercel, banco no Supabase). O Lucas escreve em português, muitas vezes em caixa alta; responda em português e trabalhe direto na `main` (commit só quando ele pedir; mensagem em inglês, Conventional Commits, com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`).

**Pronto e no ar** (detalhes em `specs/010-daily-rankings-profile.md`, que é atualizada a cada mudança):

- **Cor:** Clássico e Flash (3 rodadas), Rápido (1), Às cegas (5), Sobrevivência (3 vidas, nota mínima de 6 a 9, até 30 rodadas) e Daily (5 rodadas, tela própria com abas).
- **Tempo:** Clássico e Sem estourar (3), Rápido (1), Sequência (5 alvos), Sobrevivência (mesma regra da Cor) e Daily. Alvos de 1 a 18 s com centésimos e espaçados entre si. Nada de cronômetro, número ou som rítmico durante a contagem.
- **Contas obrigatórias para jogar**, histórico com filtros e paginação, perfil com recordes, amigos e perfil de amigo, rankings por jogo, salas (host, pronto, convites, revanche por votação) para Cor e Tempo.
- **App:** PWA com splash animada, offline (continua logado, avisos, pull to refresh), layouts de tablet e desktop, sons por toque real, vidas em corações, animações de nota, aviso de **atualização obrigatória** (tela cheia até tocar em Atualizar).

**Em andamento: o Intruso** (`specs/011-impostor.md`). Variante da Cor só para sala (3 a 12 pessoas, 1 a 3 intrusos): a turma vê a cor, os intrusos recebem só uma dica, todos recriam e votam (intrusos também votam; voto aberto ou anônimo, escolhido no lobby). Com 3 pessoas pode ter até 2 intrusos; sempre sobra pelo menos 1 normal.

- Feito: regras puras e testes em `packages/games/src/impostor`; motor e sala em `apps/api/src/rooms/impostor` (estado por pessoa: a seed nunca sai, a cor só vai para a tripulação, a dica só para o intruso); telas em `apps/web/src/screens/room/ImpostorPlay.tsx` e `Lobby.tsx`; o modo aparece na lista da Cor e leva a "Criar sala".
- **Paleta pronta** (07/10/2026): **313 cores com 5 dicas boas cada** (1565 dicas) em `palette-1..6.ts`, validadas por testes (sem termo técnico, nome combina com a cor, sem contradição) e conferidas visualmente (`docs/reference/paleta-intruso.html`). Limite da sala: 3 a 12 pessoas.
- **Falta:** (1) **testar com 3 contas de verdade** (criar sala, lobby, decorar, recriar, votar, revelar, pódio): nunca foi jogado ao vivo; (2) o Intruso não salva no histórico nem tem estatísticas (decisão da spec, pode virar etapa futura).

**Atenção:** a migration `0004` (trocar @usuário) está gerada e NÃO aplicada; rode `pnpm db:migrate` antes de testar.

**Atravessa!** (`specs/028-atravessa.md`, 14/10/2026): jogo novo estilo Crossy Road em 3D (Three.js), solo e só Infinito, três biomas contínuos. **Substituiu o Sinal Vermelho**, que foi apagado do código (pacote, API, app e salas). Núcleo em `packages/games/src/atravessa`, rota `/atravessa`, API `game: atravessa`. **Polimento (spec 029, 14/10/2026):** tráfego por veículo, trechos balanceados, trem muito rápido, ambulância, sinal, crocodilo, tartarugas, varridas de aviso, faixa do recorde e marcos, 13 modelos de veículo, mortes por causa, som sem nota que sobe. **Falta:** jogar ao vivo no celular e no computador, calibrar escuridão, veículos, toras e varridas, ouvir o som, ver as transições de bioma andando. **Banco:** os dados do Sinal já foram apagados do banco de produção (14/10/2026: 30 partidas e 4 recordes, via `apps/api/scripts/reset-sinal.mjs`).
**Atravessa! online (15/10/2026, specs 030 e 031):** largada sempre na horta (4 linhas de recuo) e **sala online** (`/sala?jogo=atravessa`, botão "Jogar com amigos" no menu do jogo): Infinito (rodadas do líder, sem escuridão, quem morre assiste com setas, soma dos metros) e Checkpoint (mapa 100/250/500/1000 m, timer, renasce no checkpoint). Sem colisão entre jogadores; o servidor espelha cada herói pelos passos com tick. Testes: núcleo (`room.test.ts`), motor (`atravessa-room.engine.test.ts`) e servidor real (`atravessa-room.integration.test.ts`). **Falta:** jogar ao vivo com 2+ aparelhos (a tela da partida só foi vista renderizando, não jogada), calibrar relógio/12 s parado/checkpoints, histórico de sala, e ver o espectar e a corrida no celular.

**Word's** (specs 032 a 035, 19/10/2026): grupo de jogos de palavras. **Feito:** base de palavras ('apps/api/data/words', 1567 respostas revisadas, 8690 aceitas, scripts em 'apps/api/scripts/words'), núcleo do Classic em 'packages/games/src/words' (cores, nota, partida), API 'apps/api/src/words' ('/words/wclassic/daily|runs|runs/:id/moves|finish', resposta só no servidor, Daily 1 por conta por dia, tabela 'word_runs' na migration '0007' **gerada e NÃO aplicada**: rode 'pnpm db:migrate' antes de testar), páginas '/words', '/words/classic' e '/words/classic/jogar' e cartão no Início. Tudo exige conta (como os outros jogos). **Falta:** jogar ao vivo, imagem de compartilhar (hoje só texto), sons, tela do Daily com abas (resumo/ranking/amigos), confirmar 'WORDS_DAILY_EPOCH' ('apps/api/src/words/word-lists.ts') antes do deploy, e os jogos Bee e Connect (conteúdo em lotes).

**Bee Word's** (spec 035, 19/10/2026): regras em 'packages/games/src/words/bee', gerador 'apps/api/scripts/words/gerar-bee.mjs' (rodar de novo recria os favos; os que já estão em 'favos.json' não mudam de lugar), 180 favos em 'apps/api/data/words/bee/favos.json' e a lista de cortes em 'fora-bee.txt', API 'apps/api/src/words/bee.*' ('/words/wbee/daily|runs|runs/:id/moves|finish|hints'), telas '/words/bee' e '/words/bee/jogar'. **Os favos foram revisados só por mim, em 5 rodadas de corte de nomes e estrangeirismos; o Lucas ainda precisa passar o olho em 'bee/revisao.txt' e cortar o que achar estranho em 'fora-bee.txt'.** O Daily 1 é 19/10/2026, as listas do Classic e do Bee recomeçam (embaralhadas no Classic, na mesma ordem no Bee) quando acabam. **Falta:** tela do arquivo, compartilhar, sons de patente, dicas por inicial mais bonitas, jogar ao vivo. **Connect Word's** ainda não começou (conteúdo em lotes).

**Connect Word's** (spec 034): regras em 'packages/games/src/words/connect' (nota, palpite, 'falta uma', solucionador de divisão única), API 'apps/api/src/words/connect.*' ('/words/wconnect/daily|runs|runs/:id/moves'), 130 puzzles originais escritos em 'apps/api/data/words/connect/fonte/lote-*.txt' (o script 'scripts/words/montar-connect.mjs' gera 'puzzles.json'; versão legível em 'revisao.md', **aguardando aprovação do Lucas**). Puzzle já jogado não volta (arquivo e Daily recusam com 409) e testes que recusam divisão ambígua, palavra repetida em 14 dias e título que revela palavra. Telas prontas: '/words/connect' e '/words/connect/jogar' (grade 4x4, 5 vidas, 'falta uma', grupos coloridos, compartilhar em texto), integradas ao ranking, histórico e stats. **Falta:** jogar ao vivo, tela do arquivo (a API já tem), imagem de compartilhar e sons próprios.

**Jogar a qualquer hora (19/10/2026):** todo jogo do Word's tem Daily e também jogo livre. Classic: 1, 2 e 4 palavras. Bee e Connect: 'Jogar quando quiser' (API 'kind: free'), que sorteia um favo/puzzle que a conta ainda não jogou, fora dos 30 próximos dias do Daily (para não queimar o futuro), sem ranking; um puzzle jogado não volta. Cobre o histórico como modo 'Livre'.

**Word's reformulado (19/10/2026):** o Classic tem Daily, ranking e partidas salvas no servidor (abas Daily, 1, 2 e 4 palavras; palavras do Daily separadas das dos modos livres; Daily repete embaralhado quando acaba; partida livre aberta continua e a próxima já é sorteada). **Bee (200 fases) e Connect (130 fases) são jogos offline, sem Daily nem ranking**: catálogo do mais fácil ao mais difícil, status por fase (nova, em andamento, concluída) e progresso salvo no aparelho (localStorage). Os dados vêm de 'apps/api/data/words' e são exportados para o app com 'node apps/api/scripts/words/exportar-fases.mjs' (rode de novo ao mexer nos favos/puzzles). Testes de ponta a ponta com Playwright em 'apps/web/e2e' (API simulada): 'pnpm --filter @nocap/web exec playwright test'.

**Mix Nocap removido (20/10/2026):** a rota /nocap, as salas party (API e web), o pacote de regras e os textos saíram do código. Sobras no banco: `node apps/api/scripts/apagar-mix-nocap.mjs` mostra o que há; `--apply` apaga.

**Aperta! etapa 5 pronta (21/10/2026, branch `claude/aperta-etapa-5-2dde26`):** página de Melhorias (`UpgradesPage`, `upgrades-logic.ts`, `upgrades.css`) com preço, ganho da próxima compra, trancadas com dica e compra pelo `controller.buy` (trava de toque duplo de 250 ms). Conferida em 320/390/1280 px sem rolagem lateral.
**Aperta! etapa 6 pronta (21/10/2026, branch `claude/aperta-etapa-6-1f9010`):** `ChoiceModal` completo (guarda de 300 ms, trocar carta, 2 escolhas da Nebulosa de Órion), `GrimoiresPage` (álbum + Atlas, sem botão Colapsar: é da etapa 9), `albumView` em `game-logic.ts`, `controller.reroll`. Mexe pouco em `GameScreen`/`GamePage` (só passa o filho da página de Grimórios), para não bater com a etapa 5.
**Aperta! etapa 9 pronta (21/10/2026, branch `claude/aperta-etapa-9-04381f`):** colapso e Atlas Eterno (`CollapseModal`, `AtlasSection`, `collapse.css`, visões em `game-logic.ts`, `controller.collapse`). O motor (`collapse`, `atlasSlots`, `fragmentsFor`) já vinha da etapa 1; esta etapa só ajustou `collapse` para deixar o tutorial como `'done'` e acrescentou testes de `validateSave` com cadeia de colapsos. Playwright: `e2e/aperta-collapse.spec.ts` (320, 390 e 1280 px); sem `@playwright/test` instalado, a mesma jornada foi conferida com a biblioteca `playwright` global. Falta: Árvore e conquistas (etapa 10).

**Aperta! etapa 12 pronta (21/10/2026, branch `claude/aperta-etapa-12-cd2404`):** conteúdo dos colapsos 1 a 5. Motor: `content/index.ts` (tabela por colapso, `newContentAt`, `mechanicOpen`, `eventsOpen`, missões), `setRegion`, `setFavorite`, eventos e missão em `RunState` (`event`, `nextEventAt`, `mission`; sorteio pelo tempo de jogo, não pelo `rngState`, para não mexer nas cartas) e `favorite` no `SaveState`; `validateSave` aceita save sem esses campos (valores padrão). O simulador roda sem eventos (calibra a economia base). Web: `regions/` (dados + `RegionBackdrop`), `RegionMenu`, `StatusStrips` (faixa, missão, evento), `content-logic.ts`, `content.css`. **Falta (etapa 10 e 13):** conquistas do conteúdo dos colapsos 1 a 5 ("Primeira estrela colapsada", "Pegar um proibido", "Atlas com 4 páginas", "Saí do Sistema Solar"), calibrar eventos e missões jogando.

**Aperta! etapa 11, parte visual e sons pronta (21/10/2026, branch `claude/aperta-etapa-11-d75c04`):** sons ligados a todos os eventos que existem (clack, whoosh ao surgir objeto, ding na captura, flip nos grimórios e na história, thunk em compra/escolha/save, boing sem saldo e ao apagar save, win ao fechar o tutorial), vibração cala no mudo (`isMuted` em `sfx.ts`), troca de tela por fade (`.ap-screen-in`), modo aparelho fraco (`perf.ts` `LOW_END`, classe `is-lite`: sem desfoque de 70px, sem sombras projetadas) e `motion-css.test.ts` (guarda de animação em todo CSS do Aperta!). Falta quando as etapas 9 e 10 existirem: arte e som de colapso, Atlas, Árvore e conquistas (`apertaSfx.win` já existe).

**Aperta! etapa 8 pronta (21/10/2026, branch `claude/aperta-etapa-8-88d554`):** tutorial guiado (`Tutorial.tsx`, `tutorial-logic.ts`, `tutorial.css`, `packages/games/src/aperta/tutorial.ts`); o passo vai em `SaveState.tutorial`. Teste de ponta a ponta: `E2E_PORT=5208 playwright test e2e/aperta-tutorial.spec.ts --project=desktop` (a porta é configurável). Para a etapa 7: sem objetos enquanto `tutorialActive(state)`.

**Aperta! etapa 7 pronta (21/10/2026, branch `claude/aperta-etapa-7-e2dc63`, sem push):** objetos no espaço (`FieldObjects`, `SignalChip`, `controller.capture`, `objectPreview` no motor). Pendência para a etapa 8: bloquear o spawn enquanto o tutorial está ativo (`tickObjects` hoje ignora `tutorial`). Veja `ARCHITECTURE.md`.

**Aperta! etapa 4 fechada (21/10/2026, branch `claude/aperta-etapa-4-c0fba5`):** tela de jogo conferida em 320/390/1280 px, pausa por `visibilitychange` e repetição de tecla (6/s) testadas.

**Aperta!** (`specs/038-clicker.md`, 21/10/2026): clicker no espaço, solo, saves na conta. **Etapa 1 pronta** (branch `claude/aperta-etapa-1-53da69`): motor e simulador em `packages/games/src/aperta` (só lógica; `pnpm --filter @nocap/games sim` imprime a tabela de horas; números finais na seção 6.7 da spec). **Etapa 2 (saves na conta) fechada no código** (branch `claude/aperta-etapa-2-300247`, a mesclar na `develop`): `validateSave`/`mergeSaves`, módulo `apps/api/src/aperta/`, `api-save-store` (autosave 30 s, cópia local, subida ao voltar a internet), `SyncNotice` (aviso de conflito entre aparelhos) e a partida em curso salva pela conta. **Pendente, decisão do Lucas:** aplicar `apps/api/drizzle/0009_aperta.sql` no banco (só cria a tabela `aperta_saves`, nada destrutivo; nada foi aplicado) e conferir as rotas contra o banco real. A API foi testada só com repositório em memória. Detalhes em `ARCHITECTURE.md` 12b e na seção 16 da spec. **Próximo:** fechar a etapa 4 (conferir no navegador), depois as etapas 5 a 10.

**Eco** (`specs/012-eco.md`): repetir sequências de botões (estilo Genius). **Solo pronto** (Clássico, Escalada, Velocidade, Reverso e Daily, com ranking, recordes, histórico e perfil; 310 testes passando). **Salas Corrida e Siga o Líder prontas (faltam jogar ao vivo e calibrar o 0,7 do líder e as faixas de nota)**. São duas salas separadas (`eco` e `ecoleader`), escolhidas ao criar a sala; o spec previa escolher o formato no lobby.

**Nomes na tela:** Cor = **Mesmíssima** (o 10 mostra "mesmíssima" no lugar de "cravou"), Tempo = **Já Deu?**, Eco = **Ecooo**. Ids, rotas e código não mudaram (`color`, `time`, `eco`).

**Presença na sala e convites** (`specs/017-presenca-sala.md`, 10/10/2026): sair da sala agora vale no servidor (`POST /me/room/leave`, mesmo com a conexão caída), `GET /me/room` diz em que sala a conta está, o início tem o aviso "Você está na sala ... Voltar / Sair", criar sala é um toque só, estar em outra sala abre um diálogo (voltar ou sair), convites viram fila de um aviso por vez e o botão Convidar volta a funcionar. Teste com servidor Colyseus real em `apps/api/src/rooms/presence.integration.test.ts` (roda em threads: `vitest.config.ts`). Armadilha: nunca pôr `leave` no logo da sala; o logo só vai ao Início.

**Eco Hero** (`specs/019-eco-batida.md`, 10/10/2026): modo de ritmo dentro do Ecooo, estilo Guitar Hero, com **3 músicas** (Primeiro Passo, Maré Alta, Frenesi), pista em perspectiva, energia, multiplicador, pausa com 3-2-1 e teclas configuráveis (padrão 1 a 5). Núcleo puro em `packages/games/src/eco/rhythm.ts` (a música sai da seed; `BatidaSim` é usado pelo jogo e pelo servidor, então a conta é uma só); som em `apps/web/src/lib/batida-audio.ts` (tudo sintetizado, relógio do áudio); tela em `apps/web/src/games/eco/BatidaPlay.tsx`. Servidor: `scoreBatidaMatch` refaz a partida pelos instantes dos toques; cada música é um modo (`batida-passo`, `batida-mare`, `batida-frenesi`) e um quadro do ranking. A nota é guardada em décimos de ponto (teto 3276 pontos, campo de 16 bits). Depois da segunda rodada de pedidos: **acordes de 2 e 3 notas**, **notas longas de segurar**, **moldes translúcidos** no lugar da linha e dos botões, e andamento **sem teto** (o fácil só demora mais). **Falta:** jogar ao vivo e calibrar (janelas 50/120 ms, andamentos, energia, chances de acorde e nota longa); a tela dos moldes e das barras de segurar **nunca foi vista rodando** (o navegador de teste estava escondido), então ela precisa de uma olhada humana; Daily, sala, e salvar offline (hoje offline joga só como treino). Armadilha: o navegador de teste não anima com a janela minimizada (2 quadros por segundo), então teste em tempo real só com a janela à vista.

**Lobby novo da sala** (`specs/013-lobby-sala.md`): uma tela para o líder e outra para os membros, com abas Membros, Regras e Convidar; só o líder altera as regras (o membro só lê). Falta jogar ao vivo com contas reais.

**Banco:** os dados de jogos foram zerados em 07/10/2026 (partidas, pontos e recordes); a conta do Lucas foi mantida. Schema e migrations intactos.

**Pedidos pendentes de 07/10 (só escritos, nada implementado):** chat nas salas (spec 014), aba Convidar nova no lobby (spec 013), rever os modos Sequência e Sem estourar do Já Deu? (spec 002, com perguntas ao Lucas) e histórico de sala mostrando quem jogou e como ficou (spec 003). Lista em `docs/ROADMAP.md`, Etapa 5c.

**Próximos passos e jogos futuros:** tudo em `docs/JOGOS-FUTUROS.md`. Ordem do Lucas: terminar o Ecooo (salas Corrida e Siga o Líder, calibrar), depois **Tribunal do Absurdo**, depois Intervalo; **Ponte e Regras Vivas em standby**. O arquivo descreve cada jogo. Ideias mais antigas (Sincro, Blefe de Nota, Sabotador, Telefone Sem Fio, Caça-Cor, Dicionário de Cores; Tom, Eco de Ritmo, Sombra) seguem no brief e sem spec.

**Atualização de 08/10/2026** (validação geral e pedidos novos; detalhes nas specs 011 a 015):

- Intruso (011), Ecooo (012: Corrida e Siga o Líder), lobby líder/membro (013), chat (014) e **aba Ranking própria** (015) estão implementados. A paleta do Intruso tem 313 cores com 5 dicas cada.
- **Siga o Líder reformulado:** sem tela de resultado entre rodadas; aparece "O LÍDER É @fulano" e o próximo cria; a soma de acertos só aparece no pódio; regras do líder em lista de tarefas com progresso; na Escalada e no Siga o Líder os botões ficam em posição fixa (grade 3x3 com lugares vazios tracejados).
- **Ranking:** página `/ranking` (jogo, modo incluindo Daily, período, todos/amigos, minha posição fixa, "faltam X para passar @fulano"). Saiu a aba Ranking de dentro dos jogos; o Daily mantém o ranking só dele na tela do Daily.
- **Perfil:** os recordes agora são um jogo por vez, com um bloco por modo (toque para ver média e partidas).
- **Bugs achados na validação (corrigidos):** a tela de resultado do Já Deu? cobria o botão "Próxima" quando a nota era zero (classe `g-zero` aplicada na tela inteira); o botão "Siga o Líder" e os modos do Ecooo estouravam a tela no celular; selo "NA SALA" cortado; linhas do resultado do Ecooo cortadas; título do voto estourando; um teste do Eco só passava no dia em que foi escrito (data fixa).
- **Ainda não validado ao vivo:** nenhuma sala foi jogada com contas reais (as telas foram conferidas injetando estados falsos no app em 375, 820 e 1280 px). Falta jogar Intruso, Ecooo, chat e convites por @ com 3 contas; e jogar o Ranking com dados reais.
- Cuidado com CSS: `ranking.css` (legado, carregado por `RankingList`) usa as classes `.rk-*`; a página nova usa `.rks-*`. Não reutilize `.rk-`.

## Armadilhas conhecidas (poupam tempo)

- Nesta máquina (Windows) o `pnpm` não estava no PATH do bash e o Turbo não o achava: rode `npx tsc --noEmit` e `npx vitest run` dentro de cada pacote (`packages/games`, `apps/api`, `apps/web`). **Depois de mudar `packages/games`, rode `npx tsup src/index.ts --format esm,cjs --dts --clean` lá**, senão api e web não veem o código novo.
- Arquivos do repo têm CRLF: edições por script devem normalizar `
`. Heredocs longos no bash do Windows falharam; use a ferramenta de escrita de arquivos.
- O Vite pode guardar uma versão vazia de um arquivo que foi regravado: se a tela ficar em branco com "does not provide an export", mexa no arquivo (ou reinicie o `vite`).
- A API real tentava conectar no Supabase (às vezes dá ETIMEDOUT). Para testar telas sem banco, havia um servidor falso na porta 3333; mate a API real antes.
- `requestAnimationFrame` para quando a aba está oculta: as telas de resultado têm timeout de segurança por causa disso.

## Ritual de setup no computador novo

```bash
git clone https://github.com/olucasfl/nocap-app.git && cd nocap-app
nvm use                      # Node 22 (mínimo 20.19)
corepack enable && pnpm install
cp .env.example .env         # depois preencha a senha do Supabase (ver abaixo)
pnpm build && pnpm test      # deve passar sem banco
pnpm dev                     # web em :5173, api em :3333 (GET /health)
```

O `.env` **não vai para o git**. Leve a senha do Supabase por um gerenciador de senhas, nunca por chat.

## Antes de tudo (pendências de segurança)

- [ ] **Trocar a senha do banco no Supabase** e o `BETTER_AUTH_SECRET` (apareceram em capturas de tela) e colocar os novos só no `.env` e nas variáveis do Render.
- [ ] Confirmar que o repositório no GitHub está privado.

## Onde está cada contexto

| Preciso de...                                          | Arquivo                               |
| ------------------------------------------------------ | ------------------------------------- |
| Visão, decisões tomadas e em aberto, regras, roadmap   | `docs/PROJECT-BRIEF.md`               |
| Passo a passo até o projeto ficar pronto               | `docs/ROADMAP.md`                     |
| Design (Pop Brutal), como abrir as telas de referência | `docs/DESIGN.md`                      |
| Telas e protótipo de referência (HTML)                 | `docs/reference/*.html`               |
| Prompt original da Etapa 1                             | `docs/prompts/etapa-1.md`             |
| Arquitetura técnica                                    | `ARCHITECTURE.md`                     |
| Regras para agentes                                    | `CLAUDE.md`, `.claude/rules/RULES.md` |
| Specs de cada feature                                  | `specs/` (índice em `specs/INDEX.md`) |

## Como ver o design no outro PC

Rode `pnpm dev` e abra http://localhost:5173 (o app já tem Hub e o jogo da Cor), ou abra `docs/reference/prototipo-cor.html` com duplo clique (jogo autônomo, fonte da verdade de fluxo, animação e sons). As `design-*.html` precisam de um `support.js` que não está na pasta e não renderizam sozinhas; servem só como referência de layout.
Detalhes em `docs/DESIGN.md`.

## Como retomar com o Claude Code

Abra a pasta do repo no Claude Code e diga: _"Leia HANDOFF.md, CLAUDE.md e docs/ROADMAP.md e continue do
próximo passo pendente."_ Os comandos `/new-game`, `/spec`, `/ship` e `/status` estão em `.claude/commands/`.

## Decisões em aberto que mais travam

Ver `docs/PROJECT-BRIEF.md` seção 6. As três que importam primeiro: presencial vs remoto (#1), auth (#2) e
curva da nota do Tempo (#4). Não decida sozinho: pergunte ao Lucas.

## Nota técnica

Esta máquina tinha Node 20.19; o projeto recomenda Node 22 (`.nvmrc`). Funciona nos dois.
