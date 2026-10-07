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

## Etapa 3: amigos e salas

- [x] Amigos (@username, pedidos com aceite, lista, ranking entre amigos; spec 009). Faltam: online agora, convites para sala (vêm com as salas)
- [x] Salas Colyseus para a Cor: código de 4 letras, lobby, regras, revelação lado a lado, pódio, revanche, reconexão (spec 004). Falta: convite pela aba Amigos
- [ ] Ranking entre amigos, confronto direto. Spec: `specs/004-rooms-multiplayer.md`

## Etapa 4: jogo do Tempo

- [ ] Clássico, Sequência, Sem estourar em solo, sala e daily. Spec: `specs/002-time-game.md`
- [ ] Decidir a curva da nota (brief #4) e anti-trapaça (#6) antes de codar

## Etapa 5: modos extras e conquistas

- [ ] Cor: Contagem regressiva, Interferência, Paleta, Às cegas; conquistas; novos jogos

## Etapa 6: produção

- [ ] Cloudflare Pages (web), Fly.io (api + Colyseus), Upstash (Redis), domínio, monitoramento
