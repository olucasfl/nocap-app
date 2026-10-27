# Spec 051: o app inteiro no celular deitado

Pedido do Lucas em 27/10/2026: "caso eu queira virar de lado o meu celular no aplicativo inteiro, precisa de telas pra isso, deixa tudo melhor encaixado e menor". Status: **implementada; falta ver em aparelhos reais.**

## Como ficou

- **Condição:** `orientation: landscape` e altura até 520 px (qualquer largura; antes só telas com 768 px ou mais ganhavam o layout de menu lateral, então um celular deitado de 667 px caía no layout vertical, com a barra de baixo por cima do conteúdo).
- `styles/responsive.css`: nessa condição o menu vira a **barra lateral** (a mesma do tablet), o conteúdo usa a largura toda (sem coluna de 440 px), a moldura encolhe com `zoom` (0,8; 0,72 abaixo de 420 px de altura), títulos mais baixos, cartões de jogo e ranking em **duas colunas** (Home em três) e sem a folga da barra de baixo.
- Vale para Home, Ranking, Amigos, Perfil, Entrar, Criar conta, Sala, Words, hubs dos jogos (Fox Cap!, Atravessa!...) e as demais telas que usam `Page`/`tabs-app`. Os jogos em tela cheia têm o próprio layout (spec 050).
- Celular em pé, tablet e computador não mudam.

## Testes

- `e2e/landscape-app.spec.ts`: 10 telas em 667x375, 844x390 e 568x320, sem rolagem para o lado (e capturas para revisar).
- `e2e/layout-sweep.spec.ts` (já tinha o tamanho deitado 844x390) segue passando.

## Áreas seguras (notch / ilha / cantos arredondados)

- `responsive.css` define `--sa-left/right/top/bottom` = `env(safe-area-inset-*) / var(--ui-zoom)`. O `.app` usa zoom no celular deitado e o `env()` é encolhido por ele, então a divisão é obrigatória.
- Barra lateral, `.app`, FAB do chat e HUD dos jogos usam esses valores (`max(14px, env(...))` fora do `.app`).
- Teste: `e2e/safe-area.spec.ts` simula iPhone 17 Pro, iPhone SE e Android com recorte via `Emulation.setSafeAreaInsetsOverride`. Não substitui teste em aparelho real.
