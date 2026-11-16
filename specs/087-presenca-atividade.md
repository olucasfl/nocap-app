# Spec 087: presença com atividade ("online · jogando X")

Pedido do Lucas (16/11/2026): no início e na aba de amigos, mostrar quando alguém está online e o que está fazendo, em tempo real.

## Como funciona

- O app (`PresenceBeat`) avisa o servidor (`POST /me/ping`) a cada 20 s, ao voltar para a aba e 0,8 s depois de trocar de tela, junto com a atividade: `{ state: 'game' | 'room' | 'menu', game }`. A atividade vem só da rota (`lib/activity.ts`, testada): nada de dado pessoal sai do aparelho.
- O servidor guarda a atividade **em memória** junto com o "online" (`PresenceService`, sem migration) e devolve `activity` em `GET /friends` e no perfil do amigo. Sem batimento por 100 s a pessoa vira offline e a atividade some. A rota valida o corpo (`state` fixo, `game` com `[a-z0-9-]{1,24}`); o limite do `ping` subiu de 12 para 30 por minuto.
- Telas: lista de amigos ("ONLINE · JOGANDO FOX GP"), painel de amigos online do início ("online · jogando Fox GP") e perfil do amigo. As listas atualizam a cada 15 s.

## Limites

- A atividade é por tela: dentro da área de um jogo (menu ou partida) aparece "jogando X"; só o jogo, não o modo ou a fase.
- Instância única da API (como as salas): com mais de uma, a atividade ficaria por instância.
