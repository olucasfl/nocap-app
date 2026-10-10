# 018: Amigos, presença, perfil, ranking e fim de partida

Status: implementada (10/10/2026), a pedido do Lucas. **Migration pendente:** `0005_user_presence`
(tabela nova e só aditiva; o app funciona sem ela, só não lembra a "última vez online" depois de
reiniciar a API). Aplicar com `pnpm db:migrate`.

## Amigos
- Três abas: **Amigos** (cartões em grade, 2 por linha no celular), **Pedidos** (recebidos e enviados)
  e **Adicionar** (busca). Abre em Pedidos se houver pedido esperando, em Adicionar se não houver amigos.
- Cartão: avatar com bolinha verde (online) ou cinza, "Online agora" / "Visto há 5 min" / "Visto ontem
  às 14:30", e "Jogou Já Deu? há 3 h". O botão "Chamar" foi retirado (convite é pelo lobby da sala).

## Presença
- O app aberto e visível bate em `POST /me/ping` a cada 45 s e ao voltar para a aba. Online = batimento
  nos últimos 100 s (memória); a última visita é gravada em `user_presence` a cada 2 min.
- `GET /friends` traz `online`, `lastSeenAt` e `lastPlayed` de cada amigo.
- `GET /friends/:username/profile` traz também `recent` (20 partidas: jogo, modo, tipo, hora, nota,
  colocação; nunca seed nem respostas).

## Perfil de amigo
Presença no topo, quatro fatos (última vez no app, último jogo, partidas e jogo mais jogado, dias
seguidos), atividade recente com horário e os recordes.

## Perfil próprio: editar
O lápis abre "O que editar?" (Nome, @usuário). Cada item abre um popup. Trocar o @ mostra o que
acontece (muda em todo o app, 15 dias para trocar de novo, @ antigo reservado 15 dias, amigos não são
avisados) e exige uma confirmação final com o antes e o depois e uma caixinha "entendi".

## Aviso de versão nova
Só aparece em telas calmas (início, ranking, histórico, amigos, perfil, login) e nunca com a conta
numa sala. Em jogo, sala, lobby ou pódio ele espera (`lib/update-gate.ts`).

## Ranking
A página usa a cor do jogo. Modo = chips (escolhido na cor do jogo; Daily tracejado com selo amarelo),
período = faixa com sublinhado, "só amigos" = chave. **Sua posição** fica logo acima do pódio (não mais
colada embaixo); quem não jogou o modo vê o botão Jogar. Pódio colorido com coroa; lista com avatar e
barra da nota.

## Fim de partida (Cor, Já Deu?, Ecooo, rápidos e Sobrevivência; o Daily não tem recorde)
`MatchSummary`: **esta partida × seu recorde** lado a lado, barra com o risco do recorde, frase do que
faltou ou do quanto passou, aviso de novo recorde e **seu lugar no ranking** (Hoje/Semana/Sempre,
quanto falta para o de cima, melhor do período, três primeiros) com botão para o ranking completo.
