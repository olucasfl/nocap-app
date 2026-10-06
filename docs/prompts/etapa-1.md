> Prompt original da Etapa 1, guardado como contexto. A senha do banco foi removida. O passo a passo vivo está em `docs/ROADMAP.md`.

# Prompt para o agente de código — NoCap, Etapa 1 (jogo da Cor)

Copie tudo abaixo da linha e cole no agente.

---

Você vai criar do zero a base do **NoCap**, um hub de jogos para jogar com amigos (PWA). Esta é a **Etapa 1**: monorepo funcionando com **front + back** e o **primeiro jogo, Cor**, jogável em navegador, celular e PC, instalável como PWA, com o design e os sons definidos. Login, amigos, multiplayer e ranking ficam para depois, mas a arquitetura já precisa estar pronta para eles.

Prazo: ~30–40 min. Priorize o que funciona e faça **commit + push a cada passo concluído**. Não pare para pedir confirmação de decisões que já estão aqui.

## 0. Local, repositório e referências

- Pasta do projeto: `a raiz do repositório` (crie se não existir; se já existir uma pasta `docs/reference` lá dentro, **mantenha**).
- Remote: `https://github.com/olucasfl/nocap-app` → branch `main`.
- **Referências visuais (leia antes de codar a UI):** `a raiz do repositório/docs/reference/`
  - `prototipo-cor.html`: protótipo jogável aprovado. **É a fonte da verdade** para fluxo, animações, sons (receitas Web Audio), cálculo ΔE2000 e visual. Porte essa lógica, não reinvente.
  - `design-hub.html`, `design-cor-resultado.html`, `design-tempo-resultado.html`: telas do estilo **Pop Brutal** aprovado (formato de canvas; `{{accent}}` = `#FF6A2B`, `{{accent2}}` = `#2F5BFF`). Use como referência de layout para o Hub e a barra de navegação.

## 1. Banco (Supabase Postgres)

Coloque **somente** em `apps/api/.env` (gitignored) e crie um `.env.example` sem senha:

```
DATABASE_URL=postgresql://postgres.krtvcwrmsetaetvizykf:<SENHA>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
DATABASE_URL_MIGRATIONS=postgresql://postgres.krtvcwrmsetaetvizykf:<SENHA>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

- Runtime usa o **transaction pooler (6543)** com `postgres.js` e `prepare: false` (obrigatório nesse pooler).
- `drizzle-kit` (migrations) usa o **session pooler (5432)**.
- **Nunca** commitar `.env`. Antes do primeiro commit, confirme que `.gitignore` cobre `.env*` (exceto `.env.example`).

## 2. Stack (não troque)

- Monorepo: **pnpm workspaces + Turborepo**, Node 22, TypeScript strict em tudo.
- `apps/web`: **React 19 + Vite + TanStack Router + Zustand**, **vite-plugin-pwa** (Workbox), CSS puro com variáveis (sem Tailwind, sem lib de componentes). Animação: CSS + Web Animations API; `motion` só se precisar de mola.
- `apps/api`: **NestJS** + **Drizzle ORM** + `postgres` (postgres.js) + **zod** para validar.
- `packages/games`: lógica pura dos jogos, compartilhada por front e back (sem dependência de DOM nem de Node).
- `packages/config`: tsconfig/eslint/prettier base.
- Multiplayer futuro: **Colyseus** (não instalar agora, só prever na arquitetura).

## 3. Estrutura

```
nocap-app/
  apps/web/        # PWA
  apps/api/        # NestJS
  packages/games/  # color/ (e futuramente time/), core/ (rng seed, tipos)
  packages/config/
  docs/reference/  # referências (já existem)
  specs/
  .claude/commands/  .claude/skills/
  ARCHITECTURE.md  CLAUDE.md  README.md
```

## 4. `packages/games` — contrato de jogo (núcleo da arquitetura)

```ts
export interface GameDefinition<Settings, Round, Answer> {
  id: 'color' | 'time';
  meta: {
    minPlayers: number;
    maxPlayers: number;
    solo: boolean;
    daily: boolean;
    ranking: 'score' | 'wins' | 'none';
  };
  settingsSchema: z.ZodType<Settings>;
  presets: Record<string, Settings>; // modos padrão (rankeáveis)
  generateRound(seed: string, settings: Settings, index: number): Round; // determinístico
  score(round: Round, answer: Answer, settings: Settings): number; // 0–10, 1 casa decimal
}
```

- `core/rng.ts`: PRNG determinístico com seed string (ex.: mulberry32 + hash cyrb53).
- `color/`:
  - `hsbToRgb`, `rgbToLab`, `deltaE2000`: portar do protótipo.
  - `score = clamp(10 − 0.5·ΔE, 0, 10)`, arredondado em 1 casa.
  - `generateRound` sorteia H 0–359, S 35–95, B 40–95 a partir da seed.
  - Presets: `classic` = `{ rounds: 5, showMs: 3000 }` e `flash` = `{ rounds: 5, showMs: 400 }`.
- **Testes com Vitest**:
  - ΔE2000 contra os pares de referência de Sharma (pelo menos 3).
  - A mesma seed gera as mesmas rodadas.
  - A nota fica sempre entre 0 e 10.

## 5. Back (`apps/api`)

- `GET /health`
- `GET /games/color/daily` → `{ seed: 'color:YYYY-MM-DD', preset: 'classic' }` (data em America/Sao_Paulo).
- `POST /matches`: body `{ game, mode, kind: 'solo'|'daily', seed, guestId, answers: {h,s,b}[] }`.
  - Valide com zod.
  - O servidor **regenera as rodadas pela seed e recalcula as notas**. Nunca confie na nota que vem do cliente.
  - Salve e retorne `{ matchId, rounds: [{score}], total }`.
- `GET /players/:guestId/matches?cursor=`: histórico paginado por keyset.
- Schema Drizzle (enxuto, já pensado para crescer):
  - `players(id uuid pk, created_at, nickname text null)`. Por enquanto é só um convidado com UUID gerado no aparelho; vira usuário quando entrar login.
  - `matches(id uuid pk, game text, mode text, kind text, seed text, settings jsonb null, ranked bool, played_at timestamptz)`
  - `match_players(match_id, player_id, answers int[], total_score smallint, placement smallint null, pk(match_id, player_id))` + índice `(player_id, played_at desc)` (desnormalize `played_at` aqui).
  - `user_game_stats(player_id, game, mode, matches int, score_sum int, best smallint, pk(...))`, atualizada no fim de cada partida.
  - Formato das respostas: cada resposta HSB vira **um int** (`h*10000 + s*100 + b`). **Não salve o alvo**, porque ele é regenerado pela seed.
- CORS liberado para o dev do web. Gere e rode a migration.

## 6. Front (`apps/web`)

- **Design Pop Brutal**:
  - Tokens: `--paper #F4F4EF`, `--ink #111111`, `--orange #FF6A2B`, `--blue #2F5BFF`, `--yellow #FFD23F`, `--white #FFFFFF`.
  - Bordas de 2.5px em `--ink` e sombras duras (ex.: `5px 5px 0 var(--ink)`).
  - Fontes Archivo (900/700/500) e Space Mono, com fallback.
  - Ícones em SVG inline com traço, nunca emoji.
- **Telas**:
  1. **Hub** (aba Jogos): card da Cor jogável e card do Tempo como "em breve". Bottom nav com Jogos, Histórico, Amigos e Perfil; só Jogos e Histórico funcionam, os outros mostram "em breve".
  2. **Cor → início**: escolha do modo (Clássico/Flash) e Daily.
  3. **Memorizar**: a carta vira e a barra de tempo diminui.
  4. **Recriar**: sliders H/S/B com faixas dinâmicas e o botão "Cravar".
  5. **Resultado da rodada**: alvo e você lado a lado, a nota conta subindo, o carimbo, o tremor da tela e as diferenças de H/S/B.
  6. **Final**: total /50, as 5 rodadas e o botão "Revanche".
  7. **Histórico**: lista das partidas vindas da API.
- **Sons**: módulo `src/lib/sfx.ts` portado do protótipo (`clack`, `flip`, `tick`, `slide`, `thunk`, `win`, `boing`, `vanish`).
  - Sem arquivos de áudio.
  - O AudioContext é desbloqueado no primeiro toque.
  - Se existir, use `navigator.audioSession.type = 'ambient'`.
  - Botão de mudo com a escolha salva no localStorage.
  - `navigator.vibrate` só onde existir.
- **Animações**: só `transform`/`opacity`, respeitando `prefers-reduced-motion`. Botões "afundam" na sombra no `:active`.
- **Jogo offline**: o solo roda inteiro no cliente usando `packages/games`. Ao terminar, faz o `POST /matches`. Se estiver offline, guarda na fila (IndexedDB/localStorage) e envia quando voltar a conexão.
- **guestId**: UUID gerado e salvo no aparelho.
- **PWA**:
  - Manifest com nome "NoCap", `display: standalone`, `theme_color` e `background_color` `#F4F4EF`, ícones 192/512 e maskable (gere a partir de um SVG simples "NC" em pop brutal com `@vite-pwa/assets-generator`).
  - Precache do app shell, metas do iOS (`apple-touch-icon`, `apple-mobile-web-app-capable`) e `viewport-fit=cover` com safe areas.
  - Prompt de atualização.
- **Responsivo**: no celular ocupa a tela inteira; no PC, a coluna fica centralizada com no máximo ~440px, sem scroll horizontal. Tudo funciona com mouse, toque e teclado (setas nos sliders, Enter para "Cravar").
- Variável `VITE_API_URL`.

## 7. Documentação e automações do projeto

- **`ARCHITECTURE.md`**:
  - Visão do hub: jogos independentes, cada um com suas próprias salas.
  - Monorepo e diagrama mermaid front ↔ api ↔ db (e Colyseus futuro).
  - O contrato `GameDefinition`.
  - A regra de que o servidor recalcula as notas.
  - Seed/daily, modelo de dados e retenção (detalhe das rodadas só nas últimas 200 partidas por jogo; agregados para sempre).
  - Roadmap: Etapa 1 (Cor solo + PWA), 2 (contas + ranking + daily), 3 (amigos + salas Colyseus), 4 (Tempo e novos jogos).
- **`CLAUDE.md`**:
  - Comandos (`pnpm dev`, `pnpm test`, `pnpm db:migrate`...).
  - Convenções: TS strict, código em inglês, UI em pt-BR, Conventional Commits.
  - Regras invioláveis:
    - Nunca commitar `.env`.
    - A lógica de jogo fica só em `packages/games`.
    - Animar só transform/opacity.
    - No jogo do Tempo, **nunca** mostrar cronômetro, nem som ou animação rítmica durante a contagem.
    - Toda tela nova segue os tokens Pop Brutal.
  - Onde ficam as referências.
- **`specs/`**:
  - `000-overview.md`
  - `001-color-game.md` (regras, modos, nota, telas, sons)
  - `002-time-game.md`: modos Clássico, Sequência e Sem estourar. Você vê o alvo, toca para iniciar e toca para parar, **sem nunca ver o tempo correndo**. O resultado mostra o seu tempo vs o alvo. Erro relativo.
  - `003-history.md`
  - `004-rooms-multiplayer.md`: lobby, código de 4 letras, host configura as regras, revelação lado a lado, revanche.
- **`.claude/commands/`**:
  - `new-game.md`: cria o esqueleto de um jogo novo seguindo o contrato.
  - `spec.md`: cria uma spec nova no padrão.
  - `ship.md`: lint + test + build + commit + push.
- **`.claude/skills/`**:
  - `game-module/SKILL.md`: como implementar um `GameDefinition` + testes.
  - `pop-brutal-ui/SKILL.md`: tokens, componentes e padrões de animação.
  - `sfx/SKILL.md`: receitas Web Audio e quando usar cada som.

## 8. Ordem de execução (commit + push ao fim de cada item)

1. Scaffold do monorepo, `.gitignore`, `.env.example`, `git init` + remote → `chore: scaffold monorepo`
2. `packages/games` com color + testes passando → `feat(games): color game logic`
3. API + schema + migration aplicada no Supabase + endpoints → `feat(api): matches and daily`
4. Web: tokens, Hub e fluxo completo da Cor com sons → `feat(web): color game`
5. PWA (manifest, ícones, SW, offline) → `feat(web): pwa`
6. Histórico ligado à API → `feat(web): history`
7. Docs: ARCHITECTURE, CLAUDE, specs, commands, skills, README → `docs: architecture, specs and agent tooling`

## 9. Pronto quando

- `pnpm dev` sobe web + api, e uma partida completa da Cor salva no Supabase com a nota recalculada no servidor.
- `pnpm build` passa e `pnpm test` passa.
- O app instala como PWA e o modo solo abre offline.
- Tudo commitado e enviado no `main`.

No fim, me diga em poucas linhas o que ficou pronto, o que ficou pendente e como rodar.
