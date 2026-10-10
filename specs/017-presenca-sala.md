# 017: Presença na sala, entrar/sair e convites

Status: implementada (10/10/2026). Revisão de engenharia do sistema de jogar online a pedido do Lucas.

## Problemas que existiam

1. **Sair não saía de verdade.** `leaveRoom()` limpava a tela e avisava só pela conexão da sala. Se a
   conexão já tinha caído, o servidor entendia como queda e segurava a vaga por 60 s (a conta ficava
   "dentro": os amigos viam a pessoa, e entrar em outra sala dava "você já está em outra sala").
2. **Reconexão que ressuscitava.** Sair no meio de uma reconexão não cancelava o laço, que depois
   puxava a pessoa de volta.
3. **Reserva velha expulsava quem estava jogando.** Entrar de novo por conexão nova (link, código)
   deixava a reserva da conexão antiga viva; quando ela vencia, o servidor tirava a pessoa da sala.
4. **Expulsar quem estava sem conexão não funcionava:** a reserva continuava e a pessoa voltava.
5. **Registro de "em que sala está" podia ficar preso** (sala acabada) e travar a conta até reiniciar.
6. **Sem aviso de sala atual.** Quem saía da tela da sala (logo, voltar) continuava dentro, sem
   nenhum botão para voltar ou sair. O logo da sala saía da sala sem perguntar.
7. **Criar sala exigia dois toques** (aba Amigos → tela "Sala" → "Criar sala de ...").
8. **Convites:** o botão "Convite enviado" nunca voltava; aceitar com erro dispensava o convite sem
   mostrar o motivo e sem tentar de novo; aviso só chegava com a aba em primeiro plano; vários
   convites trocavam o aviso da tela (e o som tocava de novo).
9. Sair da conta não saía da sala.

## Regras novas

- **Uma sala por conta.** A mensagem diz qual (`Você já está na sala ABCD`). Registro de sala que já
  não existe (ou onde a conta não é mais membro) é descartado na hora.
- **Servidor é a fonte da verdade:** `GET /me/room` (sala atual: código, jogo, fase, pessoas, se a
  conta está conectada) e `POST /me/room/leave` (tira a conta da sala agora, mesmo com a conexão caída,
  cancelando a reserva). O app chama o `leave` junto com o `leave` da conexão.
- **Espera por reconexão:** 60 s em partida; **25 s** no lobby e no pódio (voltar é só entrar pelo
  código). Entrar por conexão nova ou sair/expulsão cancela a espera antiga.
- **Aviso "Você está na sala ABCD"** em cima do Início, na aba "Jogar com amigos" de cada jogo, na
  página NoCap! e na entrada de sala: jogo, momento (lobby, em partida, pódio), pessoas, mensagens do
  chat não lidas, **Voltar para a sala** e **Sair** (com confirmação). Mostra "Sua sala continua aberta"
  quando só o servidor sabe dela (outra aba, página recarregada sem o token).
- **O logo da tela da sala só vai ao Início** (não sai da sala). Sair é o botão Sair.
- **Criar sala em um toque** (Mesmíssima, Já Deu?, Ecooo, NoCap!, Intruso) e entrar por código sem
  tela intermediária. Já estando em outra sala, abre o diálogo: **Voltar para a sala / Sair dela e
  continuar / Cancelar**.
- **Convites:** um convite por (quem chamou, sala): reenviar renova o prazo e mantém o `id` (sem aviso
  nem som novos). Quem convida vê "Convite enviado" por 8 s e depois "Convidar de novo". Não dá para
  convidar quem já está na sala. Quem recebe vê **um aviso por vez** (fila do mais antigo ao mais novo;
  várias pessoas chamando para a mesma sala viram um aviso), com "+ N convites esperando"; ao aceitar ou
  recusar entra o próximo, com o som. Aceitar com erro mantém o aviso com o motivo e "Tentar de novo";
  sala fechada/cheia/começada vira "Fechar". Convites aparecem em qualquer tela (menos dentro da sala),
  inclusive para quem está em outra sala (aceitar abre o diálogo de sair), e a consulta continua em
  segundo plano.
- Sair da conta (Perfil) sai da sala antes.

## Testes

- `apps/api/src/rooms/presence.integration.test.ts`: servidor Colyseus real + cliente real (10 casos):
  sair libera na hora; conexão caída + Sair do servidor; líder sozinho encerra; uma sala por vez
  (mensagem com o código); registro velho não trava; entrar de novo cancela a espera antiga; token de
  reconexão; expulsar quem está sem conexão; expulsar quem está conectado.
- `invites.test.ts` (api e web): mesmo id no reenvio, renovação de prazo, fila, dedupe por sala,
  aviso estável, erros sem conserto. `my-room.test.ts` (web): junção entre conexão ao vivo e servidor.
- Conferido no navegador com salas reais e bots: criar em um toque, aviso no Início (375 e desktop),
  voltar, recarregar a página no meio, sair e entrar noutra, diálogo de conflito (código digitado e
  convite), fila de convites, "Convidar de novo".

## Fora do escopo (ideias)

- Convite por push (SSE/WebSocket) em vez de consulta a cada 5 s.
- Avisar quem convidou que a pessoa recusou.
- Reconectar sala ao abrir o app (hoje o aviso do Início leva de volta com um toque).
