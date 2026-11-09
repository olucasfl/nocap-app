# CLAUDE.md

Guia para agentes neste repositório. `README.md` é para humanos; este arquivo é o mapa.

## Leia nesta ordem

1. `HANDOFF.md`: estado atual e como retomar
2. `.claude/rules/RULES.md`: regras permanentes (têm precedência sobre o resto)
3. `docs/PROJECT-BRIEF.md`: visão, decisões, roadmap
4. `ARCHITECTURE.md` e `docs/ROADMAP.md`
5. `docs/DESIGN.md` e `docs/reference/` antes de qualquer UI
6. `specs/INDEX.md`: a spec da feature em andamento

## Comandos

```bash
pnpm dev          # web (:5173) + api (:3333)
pnpm build        # games → api → web (Turborepo)
pnpm test         # Vitest
pnpm typecheck
pnpm lint
pnpm db:generate  # drizzle-kit generate
pnpm db:migrate   # aplica no Supabase (session pooler 5432)
```

## Convenções

- TypeScript strict. **Código em inglês, UI em pt-BR.** Conventional Commits.
- Alias `@/` no web. Um módulo Nest por domínio em `apps/api/src/<dominio>/`.
- Lógica de jogo só em `packages/games`. Servidor sempre recalcula a nota.
- Comentário explica o porquê, não o quê.

## Regras invioláveis (resumo; completas em RULES.md)

1. Nunca commitar `.env`; nunca escrever senha ou token em arquivo versionado, log ou chat.
2. Ranking só com presets; salas personalizadas nunca entram.
3. Tempo: nada de cronômetro, número, barra, som ou animação rítmica durante a contagem.
4. Cor: nota por ΔE2000 (Lab), nunca distância RGB.
5. Animar só `transform`/`opacity`, respeitando `prefers-reduced-motion`.
6. Telas seguem os tokens Pop Brutal. Sem emoji.
7. Itens da seção 6 do brief são decisão do Lucas: pergunte, não decida.

## Comandos de agente

`/new-game`, `/spec`, `/ship`, `/status` em `.claude/commands/`. Skills em `.claude/skills/`:
`game-module`, `pop-brutal-ui`, `sfx`.
