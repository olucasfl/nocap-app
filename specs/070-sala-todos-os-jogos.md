# Spec 070: sala com amigos que troca entre todos os jogos do NoCap

Status: implementada (09/11/2026). Pedido do Lucas: estar jogando Mesmíssima com amigos e, na mesma sala, trocar para Fut Fox (ou qualquer jogo com sala), com a sala tomando o tema do novo jogo, convidados mantidos e os jogos separados por categoria.

- **Servidor** (`FoxRoom`): a sala flex, que só trocava entre os jogos do Fox Cap!, agora também troca para Mesmíssima, Intruso, Já Deu? e Ecooo (cada um com as mensagens e as regras que já tinha; o Ecooo continua trocando entre Corrida e Siga o Líder). Pessoas, líder e chat vão junto; trocar só vale no lobby e só o líder troca; limites de vagas e a conta obrigatória do Counter Fox continuam. Teste de integração com o servidor de verdade.
- **Toda sala nasce flex**: criar sala em qualquer jogo (hubs, Jogar com amigos, `/sala?jogo=`) cria a sala flex já com aquele jogo escolhido (`asFlexRoom`).
- **Aba "Outros jogos"** em todas as salas, com os jogos por categoria: Reflexo e precisão (Mesmíssima, Já Deu?, Ecooo), Jogos de festa (Intruso) e Fox Cap! (Counter Fox, Fut Fox, Ping Fox!, Atravessa!, Desmorona!). Ao trocar, a moldura temática da sala muda para a do jogo novo.
- Block's, Words e Aperta! não têm sala.
