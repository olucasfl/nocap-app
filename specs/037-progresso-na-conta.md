# 037 · Progresso das fases na conta

Status: implementada (20/10/2026). Pedido do Lucas: o progresso das fases (Bee, Connect e Classic) tem de ser o mesmo em qualquer aparelho, salvo no banco e nunca apagado, incluindo o que já foi jogado.

## Regras
- O aparelho continua guardando tudo (joga offline). Com a conta ligada, cada fase também é gravada na conta e o que está na conta volta para o aparelho.
- **Nunca perde:** juntar duas versões da mesma fase fica sempre com a mais adiantada (`mergeProgress`, em `packages/games`): Bee une as palavras achadas e mantém "fechada"; Connect e Classic ficam com a lista de palpites mais longa e guardam "desistiu", "terminou" e a dica de qualquer lado.
- O servidor também junta (nunca diminui uma fase) e valida o formato (`sanitizeProgress`: jogo, fase de 1 a 5000, até 3000 palavras ou 60 palpites, palavras de até 40 letras, lote de até 500).
- **O que o aparelho já tinha sobe sozinho** na primeira sincronização logada, e o das outras pessoas sobe quando elas abrem o app novo logadas.
- **Mesmo aparelho, outra conta:** o progresso local fica ligado a quem entrou primeiro (`nocap-words-owner`). Quando outra conta entra, o local é guardado de lado (`nocap-words-backup-<conta>`) e volta se aquela conta entrar de novo; a conta nova começa só com o que tem na própria conta.
- Sem login ou sem internet nada muda: o progresso fica no aparelho e sobe depois (ao entrar, ao voltar para o app, quando a internet volta e ~1,2 s depois de cada jogada).

## Dados e código
- Tabela `words_progress (user_id, game, level, data jsonb, updated_at)`, chave `(user_id, game, level)`, `ON DELETE CASCADE` só ao apagar a conta. Migration `0008_words_progress.sql` (só `CREATE TABLE`).
- `game`: `bee | connect | classic-c | classic-d | classic-q`.
- API: `GET /me/words-progress` (tudo da conta) e `PUT /me/words-progress` (`{ entries: [{ game, level, data }] }`), módulo `words-progress`.
- Web: `levels/progress-sync.ts` (sincronização) e `components/ProgressSync.tsx` (monta no app, ao lado do `PresenceBeat`).

## Testes
- Juntar progresso e validar formato (`packages/games`), serviço da API com repositório em memória e a sincronização do app (sobe, desce, junta, falha de rede, troca de conta).
