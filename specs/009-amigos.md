# 009: Amigos

> **Status: implementado e verificado contra o Supabase (2026-10-06).** Salas multiplayer (spec 004) vêm depois e usam esta lista para convidar.

## Objetivo

Achar pessoas pelo @usuário, virar amigo (com aceite) e comparar notas só entre amigos.

## Regras

- Só contas (precisa estar logado). Convidado vê um convite para criar conta.
- **Buscar** por @usuário (prefixo, mínimo 2 caracteres, máx. 10 resultados, sem você). A busca mostra só o @usuário e o estado: nenhum, amigos, pedido enviado, pedido recebido. **Nome real e e-mail nunca saem.**
- **Pedido de amizade:** só vira amizade quando a outra pessoa aceita. Se a outra pessoa já tinha te pedido, pedir de volta aceita na hora.
- **Recusar** apaga o pedido sem avisar quem pediu. **Cancelar** (pedido enviado) e **remover amigo** também apagam.
- Não pode pedir para si mesmo, nem duplicar pedido ou amizade.
- **Ranking entre amigos:** o ranking ganha o recorte Todos / Amigos (você + seus amigos aceitos).
- Fora de escopo agora: bloquear usuário, "online agora", convite para sala (spec 004), notificações.

## Telas

Aba **Amigos**: busca, pedidos recebidos (Aceitar/Recusar), pedidos enviados (Cancelar) e lista de amigos (Remover). No `/ranking`, seletor Todos/Amigos quando logado.

## API (tudo autenticado)

- `GET /users/search?q=`
- `GET /friends` → `{ friends, incoming, outgoing }` (só @usuários)
- `POST /friends/requests { username }`
- `POST /friends/requests/:username/accept` e `.../decline`
- `DELETE /friends/:username` (remove amigo ou cancela pedido enviado)
- `GET /rankings/color?...&scope=friends`

## Modelo de dados

Migration **aditiva**: tabela `friendships(id, requester_id, addressee_id, status pending|accepted, created_at, responded_at)`, única por `(requester, addressee)`, em cascata com `auth_user`.

## Critérios de aceite

- [x] Buscar por prefixo acha a pessoa certa e não mostra nome real nem e-mail.
- [x] Pedido → aceite → aparece na lista dos dois; recusar/cancelar/remover apagam.
- [x] Pedido cruzado (os dois pedem) vira amizade.
- [x] Pedir para si, duplicar ou pedir a quem já é amigo dá erro claro.
- [x] O ranking Amigos mostra só você e seus amigos.

## Como ficou

- Migration `0002` aplicada (tabela `friendships`). `apps/api/src/friends/` (serviço, repositório, controller) e `rankings` ganhou `scope=friends`.
- A busca escapa `%` e `_` (o `_` é comum em @usuário). Resultado só com `@usuario` e estado da relação.
- Sem limite de buscas por minuto ainda (só o limite do Better Auth nas rotas de login).

## Decisões em aberto

- Bloqueio e denúncia (antes de abrir para o público).
- Limite de pedidos pendentes por pessoa (anti-spam).
