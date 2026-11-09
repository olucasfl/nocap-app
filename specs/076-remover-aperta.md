# Spec 076: remover o Aperta!

Status: código removido (09/11/2026), **migration `0011_remove_aperta.sql` pronta e NÃO aplicada**. Pedido do Lucas: apagar o Aperta! por inteiro (tabelas, dados, código e telas).

- **Removido:** `packages/games/src/aperta/`, `apps/api/src/aperta/` (módulo, saves na conta e controle de acesso), `apps/web/src/games/aperta/`, `lib/aperta-*`, a rota `/arcade/aperta`, o cartão do Início, a arte `ApertaArt`, a página de sons de teste (`/dev/sons`), os e2e e o script de QA, as specs 038 a 043 e os documentos só dele. O `RULES.md` e o `CLAUDE.md` deixam de citar a exceção visual do Aperta!.
- **Banco:** `apps/api/drizzle/0011_remove_aperta.sql` faz `DROP TABLE "aperta_saves" CASCADE` (destrutivo: apaga todos os saves de todas as contas). O schema do Drizzle já não tem a tabela. A migration `0009_aperta.sql` fica no histórico (que cria a tabela e a 0011 remove).
- **Para apagar os dados:** `pnpm db:migrate` (só depois do "sim" do Lucas, por causa da regra de migration destrutiva). A variável `APERTA_ALLOWED_EMAILS` do servidor não é mais usada e pode ser apagada.
