# 024 · Retomar partida (Block Classic)

Status: **implementada no Block Classic; falta jogar ao vivo.** Pedido do Lucas (13/10/2026).

## Regras

- Só o **Block Classic** guarda a partida em andamento. Os jogos curtos (Cor, Tempo, Eco, Sinal, Mix Nocap) não retomam: a pessoa veria a cor ou a sequência, sairia e voltaria sabendo. O Block Towers depende de física no ar e não retoma.
- A partida é guardada **no aparelho** (localStorage), uma por conta. Convidado não guarda nada (spec 023).
- O que se guarda: seed, sessão assinada, id da partida, jogadas, joinhas, PERFECTs, dicas usadas e a hora. O tabuleiro volta refazendo as jogadas pela seed (a mesma lógica que o servidor usa), então a retomada não abre brecha: o fim da partida segue pelo mesmo envio, e o servidor refaz tudo.
- Grava a cada jogada e a cada dica usada. Some quando a partida acaba, quando a pessoa escolhe "Começar do zero" ou reinicia, e ao passar de 6 dias (a sessão assinada vale 7).
- Sair pelo X **mantém** a partida. Reiniciar descarta.
- Ao abrir o Block Classic com partida guardada, a ficha do modo mostra "Partida em andamento" (pontos, rodada, dicas que sobraram) com **Continuar partida** e **Começar do zero**.
- Limite: não vale entre aparelhos (precisaria guardar no servidor).
