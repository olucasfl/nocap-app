# Roadmap: passo a passo até o projeto ficar pronto

Marque `[x]` ao concluir. Cada passo termina com commit (Conventional Commits) e push. Toda feature nova
começa com uma spec em `specs/`. Decisões em aberto: `docs/PROJECT-BRIEF.md` seção 6.

## Etapa 0: base do projeto ✅

- [x] Monorepo pnpm + Turborepo, TS strict, ESLint, Prettier
- [x] `apps/web` (React 19, Vite, TanStack Router/Query, Zustand, PWA), `apps/api` (NestJS, Drizzle), `packages/games`
- [x] `.env.example`, `.gitignore`, docs, `.claude/` (rules, commands, skills), specs
- [x] `pnpm build` e `pnpm test` passando

## Etapa 1: jogo da Cor solo + PWA

- [ ] 0. Trocar a senha do Supabase e preencher `.env`
- [x] 1. **`feat(games): color game logic`**: `hsbToRgb`, `rgbToLab`, `deltaE2000`, `score`, `generateRound`, presets `classic` (3s) e `flash` (0.4s). Testes: 3 pares de Sharma, determinismo da seed, nota 0 a 10. Spec: `specs/001-color-game.md`
- [x] 2. **`feat(api): matches and daily`**: `GET /health` (feito), `GET /games/color/daily`, `POST /matches` (recalcula nota pela seed), `GET /players/:guestId/matches` (keyset); `db:generate` + `db:migrate` no Supabase
- [x] 3. **`feat(web): color game`**: Hub, início, memorizar, recriar (sliders HSB), resultado (contagem, carimbo, tremor), final, `sfx.ts`, `guestId`
- [x] 4. **`feat(web): pwa`** (feito; falta só o teste offline num Chrome real e trocar a logo provisória): ícones 192/512/maskable (`@vite-pwa/assets-generator`), precache, metas iOS, prompt de atualização, fila offline (IndexedDB)
- [x] 5. **`feat(web): history`** (feito: lista paginada + detalhe alvo × você; falta ver contra o banco real): aba Histórico ligada à API
- [ ] 6. Critério de pronto: partida completa salva no Supabase com nota recalculada; app instala e o solo abre offline

## Etapa 1b: ajustes pedidos após o primeiro teste (PENDENTE, nada implementado)

Feedback do Lucas ao jogar a Cor. Cada item tem spec; a ordem sugerida é a da lista (a nota primeiro, porque é pequena e muda o ranking).

- [x] **Nota da Cor mais generosa e mais fina (curva v2 implementada; falta validar 12 e 1,6 jogando):** hoje "longe, mas não tanto" dá 0 e "bem perto" dá 7 a 8. Meta: ~3 em ΔE 20, ~9 em ΔE 3 a 4. Candidata e tabela em `specs/001-color-game.md` (fecha brief #3)
- [x] **Jogo rápido (1 rodada)** na Cor (feito; o Tempo ganha o `quick` na Etapa 4) e no Tempo: preset `quick`, ranking próprio. `specs/006-jogo-rapido.md`
- [x] **Modo noturno** no app inteiro (Automático/Claro/Escuro), implementado direto por decisão do Lucas (sem telas de referência escuras). `specs/005-modo-noturno.md` (fecha brief #12)

Podem rodar antes ou depois do passo 4 (PWA); o modo noturno toca o manifesto/`theme-color`, então convém fazer junto ou logo depois dele.

## Etapa 2: contas e ranking

- [x] Auth: Better Auth escolhido; cadastro (usuário, nome, e-mail, senha 2x), login por usuário ou e-mail, convidado → conta (spec 007). Falta: Google e e-mail (verificação/recuperação)
- [x] Recordes por modo e Daily com sequência (Perfil e card do Daily no Hub), conta soma os aparelhos vinculados
- [x] Ranking global por jogo/modo e período, em Postgres (spec 008); Redis só se o volume pedir

- [x] Daily por jogo (1 Cor + 1 Tempo/dia), rankings por jogo, conta obrigatória para jogar, perfil com Recordes e dias seguidos, salas da Cor e do Tempo (spec 010)

## Etapa 3: amigos e salas

- [x] Amigos (@username, pedidos com aceite, lista, ranking entre amigos; spec 009). Faltam: online agora, convites para sala (vêm com as salas)
- [x] Salas Colyseus para a Cor: código de 4 letras, lobby, regras, revelação lado a lado, pódio, revanche, reconexão (spec 004). Convites para amigos pelo lobby e pela aba Amigos feitos (aviso por consulta a cada 5 s; sem push)
- [ ] Ranking entre amigos, confronto direto. Spec: `specs/004-rooms-multiplayer.md`

## Etapa 4: jogo do Tempo

- [x] Tempo solo: Clássico, Rápido, Sem estourar e Daily (spec 002). Faltam: Sequência e salas do Tempo
- [x] Curva da nota (#4) e anti-trapaça (#6): propostas implementadas, **falta o Lucas validar**

## Etapa 5: modos extras e conquistas

- [ ] Cor: Contagem regressiva, Interferência, Paleta, Às cegas; conquistas; novos jogos

## Etapa 5b: Ecooo e jogos novos

- [x] **Ecooo solo** (Clássico, Escalada, Velocidade, Reverso, Daily): spec `specs/012-eco.md`
- [x] **Ecooo em sala, Corrida** (motor `eco-room.engine.ts`, testes; falta jogar ao vivo)
- [x] **Ecooo em sala, Siga o Líder** (`eco-leader-room.engine.ts`, `leader.ts`, testes; falta jogar ao vivo e calibrar)
- [x] **Atravessa! (14/10/2026, `specs/028-atravessa.md`):** estilo Crossy Road em 3D (Three.js), biomas contínuos (grama, deserto, noite), solo e só Infinito; substituiu o Sinal Vermelho, que foi removido. Falta jogar e calibrar (escuridão, veículos, toras) e ouvir o som
- [x] **Atravessa! online e largada (15/10/2026, `specs/030` e `031`):** largada sempre na horta com 4 linhas de recuo; sala de até 8 pessoas (Infinito com rodadas e espectar; Checkpoint com mapas de 100 a 1000 m e timer), cores e nomes sobre as raposas, sem colisão (pronto para ter). Falta jogar ao vivo com amigos e calibrar; histórico de sala fica para depois.
- [x] **Aperta! etapa 5 (21/10/2026, `specs/038-clicker.md`):** página de Melhorias com preço `base x 1,65^n`, ganho da próxima compra, selo, liberação por escolhas/Ressonância/colapso e trava de toque duplo; testes em `upgrades.test.tsx`.
- [x] **Aperta! etapa 6 (21/10/2026, `specs/038-clicker.md`):** grimórios e álbum: escolha com bloqueio de 1,6 s, 2 passos, guarda de 300 ms ao abrir, trocar carta (Betelgeuse/Voyager) e proibido em vermelho; página de Grimórios com álbum (escondidos como "???", nível por repetição) e Atlas Eterno (espaços). Conferida em 320, 390 e 1280 px sem rolagem lateral; testes de pesos por `n` e de clique acidental.
- [x] **Aperta! etapa 7 (21/10/2026, `specs/038-clicker.md`):** objetos no espaço: cometa, estrela cadente e satélite (e asteroide/sonda quando abertos) com etiqueta da recompensa antes de tocar, barra de vida, captura com aviso, anel e texto, chip "Sinal forte" no HUD, teclado (cada objeto é botão com `aria-label`). `objectPreview` no motor, testes no motor e no web. Conferida em 320, 390 e 1280 px sem rolagem lateral.
- [x] **Aperta! etapa 11, parte visual e sons (21/10/2026, `specs/038-clicker.md`):** sons em todos os eventos existentes, vibração respeita o mudo, fade entre telas, modo aparelho fraco e teste que barra animação fora de `transform`/`opacity` em todo CSS do Aperta!. Falta o polimento das telas de colapso, Atlas, Árvore e conquistas (etapas 9 e 10).
- [x] **Aperta! etapa 11b, telas e eventos novos (21/10/2026, `specs/038-clicker.md`):** sons e arte para colapso (clarão, `collapse`, modal em 2 passos), estrela pronta, Atlas, Árvore, Conquistas, regiões (fade e `warp`), faixa Novo no espaço, Chuva de meteoros, Tempestade solar, Missões da estação, Favorito e os objetos Asteroide e Sonda; `cues.ts` testado e `motion-css.test.ts` estendido ao `polish.css`. Conferida em 320, 390 e 1280 px; falta a revisão visual do Lucas.
- [x] **Aperta! etapa 8 (21/10/2026, `specs/038-clicker.md`):** tutorial guiado de 5 passos (primeiro toque entrega a Lua, Entendi, Melhorias, compra do Pulso Solar, Grimórios): véu, spotlight em `opacity`, seta, cartão com "Pular tutorial", bloqueio de tudo fora do alvo (toque, teclado e motor) e retomada do passo salvo. Playwright em 320, 390 e 1280 px (`e2e/aperta-tutorial.spec.ts`).
- [x] **Aperta! tutorial dinâmico (22/10/2026, `specs/038-clicker.md`, pedido do Lucas; substitui o de véu da etapa 8):** a partida começa só com o botão e a poeira; Melhorias surge com a poeira da 1ª melhoria, Grimórios com a 1ª escolha (que o jogador faz), Conquistas com a 1ª conquista visível e a Árvore por último; cartões pequenos, anel em `opacity`, nada escurece, "Pular tutorial" libera tudo; passo e botões liberados no save (`ui`), saves antigos entram com tudo liberado; a última tela da história mostra livros de grimório. Playwright em 320, 390 e 1280 px (`e2e/aperta-tutorial.spec.ts`). Pendente: o Lucas vai repensar a dinâmica da Árvore (TODO na spec).
- [x] **Aperta! etapa 9 (21/10/2026, `specs/038-clicker.md`):** colapso e Atlas Eterno: botão "Estrela pronta", modal de 2 passos (escolher a página, com troca no Atlas cheio; depois o que fica, o que sai e os Fragmentos), vida nova do zero, página a 60%, espaços que sobem nos colapsos 5/10/25/50, bônus de conjunto por família na página de Grimórios e faixa "Estrela colapsada". Servidor aceita o save (teste com cadeia de 10 colapsos). Playwright em 320, 390 e 1280 px.
- [x] **Aperta! etapa 10 (21/10/2026, `specs/038-clicker.md`):** Árvore de Habilidades (6 ramos x 3 níveis com Fragmentos, refazer em 2 passos devolvendo o gasto menos 20%) e página de Conquistas (31, com barra e N/M, uma escondida), avisos de conquista, contadores novos no save compatíveis com saves antigos. Testes no motor e no web; Playwright em 320, 390 e 1280 px.
- [x] **Aperta! etapa 12 (21/10/2026, `specs/038-clicker.md`):** conteúdo dos colapsos 1 a 5: tabela em dados (`packages/games/src/aperta/content`), regiões em dados (`apps/web/src/games/aperta/regions`: céu, 2 camadas de SVG, troca ao colapsar, menu de regiões no HUD), faixa "Novo no espaço", Favorito (peso x2 no sorteio), Chuva de meteoros e Tempestade solar (15 s, a cada ~8 min), Missões da estação (Fragmentos extras) e Observatório Gaia (efeito na carta). `validateSave` rejeita conteúdo de colapso futuro e segue aceitando saves antigos. Playwright em 320, 390, 768 e 1280 px (`e2e/aperta-regions.spec.ts`). Conquistas dos colapsos 1 a 5 ficam para depois da etapa 10.
- [x] **Aperta! economia reformulada (22/10/2026, `specs/038-clicker.md`):** começo do zero (toque = 1, 1ª melhoria = 25, 1º grimório com ~50 de poeira), objetos raros e fracos (só depois da 1ª melhoria), melhorias com liberação progressiva e preço crescente, grimórios em números e sem repetir melhoria, vidas 1 a 5 recalibradas (±15%, tabela 6.7). Testes no motor, no servidor (`validateSave`) e nos textos do web.
- [x] **Aperta! etapa 4 (21/10/2026, `specs/038-clicker.md`):** tela de jogo e toque fechada: conferida no navegador em 320, 390 e 1280 px, relógio pausa com a aba escondida (`run-controller.test.ts`) e tecla segurada limitada a 6 toques/s (medido: 12 toques em 2 s).
- [x] **Aperta! etapa 3 (21/10/2026, `specs/038-clicker.md`):** rota, cartão no Arcade, título, modal de 2 saves (apagar em 2 passos, recuperável por 7 dias) e história de 4 telas, com `SaveStore` local de dev até a etapa 2; sem tela de jogo ainda.
- [ ] **Jogar o Ecooo ao vivo e calibrar** (Velocidade, faixas de nota, coeficiente do líder)
- [x] **Ecooo ajustes (08/10/2026):** botão aceso mais nítido; Siga o Líder rebalanceado (3 toques sem regra, depois 4 com 1 regra, 5 com 2, e variedade crescente; máximo de 12 toques); nota final por porcentagem (média das rodadas); rodadas em múltiplos do número de jogadores
- [ ] **Próximo jogo novo: Tribunal do Absurdo** (logo depois de terminar o Ecooo). Depois, Intervalo (na fila). Ponte e Regras Vivas ficam em **standby**. Descrição de cada um em `docs/JOGOS-FUTUROS.md`

## Etapa 5c: pedidos do Lucas em 07/10/2026 (PENDENTES, só escritos)

Ainda sem prioridade definida contra as salas do Ecooo. Cada item tem a sua spec:

- [x] **Chat nas salas com amigos** (feito, falta testar ao vivo) (todos os jogos de sala; no Já Deu? nunca durante a contagem; no Intruso só na votação): `specs/014-chat-sala.md`
- [x] **Aba Convidar nova no lobby (feito, falta testar ao vivo):** sai o botão Convidar do topo; a aba ganha o botão explícito de enviar o link escolhendo o app, atalhos diretos e a lista de amigos organizada: `specs/013-lobby-sala.md` (seção "Pendente")
- [x] **Modos do Já Deu? em sala (Sequência sincronizada feita; Sem estourar e modos novos ficam como estão):** a Sequência não faz sentido online (virou só uma rodada normal com alvo curto); melhorar o **Sem estourar** online e offline. **Há perguntas para o Lucas responder antes de implementar:** `specs/002-time-game.md` (seção "Pendente")
- [x] **Histórico de sala de todos os jogos, só com quem jogou e a colocação** (feito; falta testar ao vivo)

- [x] **Editar nome e trocar @usuário** no Perfil (15 dias de intervalo e de reserva; migration 0004 gerada, falta rodar `pnpm db:migrate`)
- [ ] **Aba separada de Rankings** (tirar o ranking de dentro de cada jogo e criar uma aba própria, mais intuitiva): `specs/015-aba-rankings.md`

## Etapa 5d: Maratona (o jogo mais complexo)

- [x] **NoCap! fases 1 a 8 implementadas e testadas ao vivo** (falta validar a Arena X1 com 2 pessoas reais e calibrar): `specs/016-maratona.md`

## Etapa 7: Word's (jogos de palavras), 19/10/2026

- [x] **Word's** (grupo) e a **base de palavras em português** (coleção MIT `fserb/pt-br` + revisão humana): `specs/032-words-grupo-e-base.md`
- [~] **Classic Word's** (estilo Termo: 1, 2 e 4 palavras e o Daily; API, tela de jogo e páginas prontas, faltam imagem de compartilhar, sons, tela do Daily com abas e jogar ao vivo): `specs/033-classic-words.md`
- [x] **Connect Word's** (offline, 130 fases por dificuldade, progresso salvo no aparelho; sem Daily nem ranking): `specs/034-connect-words.md`
- [x] **Bee Word's** (offline, 200 fases por dificuldade, progresso salvo no aparelho; sem Daily nem ranking): `specs/035-bee-words.md`
- Ordem sugerida de construção: base de palavras → Classic → Bee → Connect (o Connect depende de **conteúdo escrito à mão**, a parte mais lenta; dá para produzir os puzzles em paralelo).

## Etapa 8: Aperta! (clicker no espaço), 21/10/2026

- [x] **Etapa 1: motor e simulador** (`packages/games/src/aperta`, só lógica pura; vidas 1 a 5 calibradas pelo simulador): `specs/038-clicker.md`
- [x] **Etapa 2: saves na conta** (21/10/2026): `validateSave`/`mergeSaves`, migration `0009_aperta.sql` (escrita, **ainda não aplicada no banco**), módulo `apps/api/src/aperta/` (GET/PUT/DELETE/restaurar, 401 de convidado, 409 de conflito, recuperação por 7 dias), `api-save-store` com autosave de 30 s, cópia local, subida ao voltar a internet e aviso de conflito entre aparelhos; partida em curso salva pela conta. Falta só aplicar a migration (decisão do Lucas) e conferir contra o banco real
- [ ] Etapas 4 a 13 (tela de jogo, melhorias, grimórios, tutorial, colapso/Atlas, árvore, arte e sons, conteúdo dos colapsos 1 a 5, QA): ver seção 15 da spec
- [x] **Etapa 14 da spec 040: colapso infinito e requisitos** (22/10/2026): sem teto de colapsos, requisito de poeira + escolhas + marco da vida que gira entre 6 tipos, sem camada 2, números grandes até 1e300, `validateSave` com piso e teto por colapso (testado com saves reais antigos), simulador com 3 perfis e as travas de duração (1 a 3 h até o 15º, +3% depois). Barra de cada requisito no botão "Estrela pronta", no modal e no Atlas. Calibragem e tabela na seção 10 da spec 040
- [x] **Etapa 15 da spec 040: Cofre dos Proibidos** (22/10/2026): 10 proibidos com níveis 1 a 5 e selo, oferta de 3 a cada colapso (Selo Estelar quando o Cofre está completo), Atlas removido, save v3 com migração do Atlas para Cintilas, página e modal novos. Sem Playwright ainda (`specs/040-aperta-colapso-infinito.md`, seção 12).
- [x] **Etapa 17 da spec 040: Árvore, motor e dados** (22/10/2026): 120 nós em 5 ramos com pais, tiers e custo 1/2/3/5/8, compra, refazer 100% fora da vida, save v4, balanço T 540 / F 667 / R25 16 e simulador verde (`specs/040-aperta-colapso-infinito.md`, seção 13).
- [x] **Etapa 20 da spec 040: Sorte e Exploração no jogo** (23/10/2026): 48 nós ligados, 4 objetos lendários, Radar, 4 eventos, Mapa estelar e a tela deles. A trava de "árvore completa <= 25%" ficou dentro do ruído do simulador (`specs/040-aperta-colapso-infinito.md`, seção 14).
- [x] **Etapas 18, 19 e 21 da spec 040** (23/10/2026): árvore em grafo SVG com painel e filtros, Autoclick, automações e barra de habilidades, e QA final (e2e e responsivo). Pendente: 2 testes do simulador (vida 11 e árvore completa), ver seção 17 da spec.
- [x] **Etapa 16 da spec 040: Cintilas, fontes e conquistas ampliadas** (22/10/2026): moeda `sparks` (saldo derivado das fontes; Fragmentos migrados 1:1 e removidos), 159 conquistas em 16 famílias com recompensa em Cintilas (32 esperam conteúdo das etapas seguintes), fontes do álbum, capturas raras, marcos que repetem e Estrela dos Proibidos, aviso de ganho, página de Conquistas com filtros e busca, e o teste de balanço (T 540, F 589, R25 16). Conta na seção 11 da spec 040
- [ ] Etapas 15 e 17 a 21 da spec 040 (Cofre dos Proibidos, Cintilas e conquistas, árvore grande, habilidades, sorte e exploração, QA da v2)

## Etapa 6: produção

- [ ] Cloudflare Pages (web), Fly.io (api + Colyseus), Upstash (Redis), domínio, monitoramento
