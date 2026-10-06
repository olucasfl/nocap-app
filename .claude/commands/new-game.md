---
description: Cria o esqueleto de um jogo novo seguindo o contrato GameDefinition
argument-hint: <id-do-jogo>
---

Crie o jogo `$ARGUMENTS`.

1. Leia `.claude/skills/game-module/SKILL.md`, `packages/games/src/core/types.ts` e `specs/INDEX.md`.
2. Se não existir spec para o jogo, pare e rode o fluxo de `/spec` primeiro. Não invente regras.
3. Crie `packages/games/src/$ARGUMENTS/` (`index.ts`, `settings.ts`, `round.ts`, `score.ts`, testes) implementando `GameDefinition`.
4. Exporte em `packages/games/src/index.ts` e adicione o id em `GameId`.
5. Crie a UI em `apps/web/src/games/$ARGUMENTS/` seguindo `.claude/skills/pop-brutal-ui/SKILL.md`.
6. Rode `pnpm test && pnpm build`. Atualize `docs/ROADMAP.md` e `ARCHITECTURE.md`.
