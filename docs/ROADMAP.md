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
- [ ] **Jogar o Ecooo ao vivo e calibrar** (Velocidade, faixas de nota, coeficiente do líder)
- [ ] **Próximo jogo novo: Tribunal do Absurdo** (logo depois de terminar o Ecooo). Depois, Intervalo (na fila). Ponte e Regras Vivas ficam em **standby**. Descrição de cada um em `docs/JOGOS-FUTUROS.md`

## Etapa 5c: pedidos do Lucas em 07/10/2026 (PENDENTES, só escritos)

Ainda sem prioridade definida contra as salas do Ecooo. Cada item tem a sua spec:

- [x] **Chat nas salas com amigos** (feito, falta testar ao vivo) (todos os jogos de sala; no Já Deu? nunca durante a contagem; no Intruso só na votação): `specs/014-chat-sala.md`
- [x] **Aba Convidar nova no lobby (feito, falta testar ao vivo):** sai o botão Convidar do topo; a aba ganha o botão explícito de enviar o link escolhendo o app, atalhos diretos e a lista de amigos organizada: `specs/013-lobby-sala.md` (seção "Pendente")
- [ ] **Rever os modos do Já Deu? em sala:** a Sequência não faz sentido online (virou só uma rodada normal com alvo curto); melhorar o **Sem estourar** online e offline. **Há perguntas para o Lucas responder antes de implementar:** `specs/002-time-game.md` (seção "Pendente")
- [~] **Histórico de sala com quem jogou e como ficou** (feita a lista de jogadores e notas; faltam rodadas de todos, resumo na lista e filtro por amigo) (todos os jogadores, colocação e nota de cada um): `specs/003-history.md` (seção "Pendente")

- [x] **Editar nome** no Perfil (feito só o Nome; @usuário fixo, troca do @ em aberto): `specs/007-contas.md` (seção "Pendente")

## Etapa 6: produção

- [ ] Cloudflare Pages (web), Fly.io (api + Colyseus), Upstash (Redis), domínio, monitoramento
