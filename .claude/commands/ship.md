---
description: Lint, testes, build, commit e push do que está pronto
argument-hint: <mensagem do commit, opcional>
---

1. Rode `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`. Se algo falhar, corrija a causa (nada de `--no-verify`).
2. Confirme que `.env` não está em stage (`git status`). Procure senha ou token em `git diff --cached`.
3. Atualize `docs/ROADMAP.md` (marque o passo) e `ARCHITECTURE.md` se o comportamento mudou.
4. Commit em Conventional Commits (`$ARGUMENTS` se fornecido). Faça push.
5. Se estiver em `main` e a mudança não for trivial, confirme com o usuário antes.
