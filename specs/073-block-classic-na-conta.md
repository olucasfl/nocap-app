# Spec 073: partida do Block Classic guardada na conta

Status: implementada (09/11/2026). Pedido do Lucas: a partida em andamento do Block Classic só ficava no aparelho; ao sair e tentar continuar no PC não dava. Agora vale em qualquer aparelho.

- **Onde fica:** na mesma linha de `user_prefs` das preferências (chave `blocksRun`), sem tabela nem migration nova. Exige a migration `0010_user_prefs` aplicada (`pnpm db:migrate`).
- **API** (`/me/prefs/blocks-run`): `GET` devolve a partida guardada (ou `null`), `PUT` grava (valida o formato: seed, sessão, jogadas, dicas...), `DELETE` apaga. Gravar as preferências (`PUT /me/prefs`) não apaga a partida e guardar a partida não mexe nas preferências.
- **App:** a cada jogada a partida vai para o aparelho na hora e para a conta a cada poucos segundos (e ao sair da aba); ao começar de novo ou terminar, some dos dois. No hub do Block's, vale a mais recente entre o aparelho e a conta (e que ainda pode ser enviada ao ranking: a sessão do servidor vale 6 dias).
- **Testes:** formato e mescla no servidor, `newestRun` no app, e2e que continua uma partida que só existe na conta.
