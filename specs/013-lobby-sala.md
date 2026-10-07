# 013 · Lobby da sala (líder e membro)

Status: implementado em 07/10/2026 (verificado no navegador com dados de teste; ainda não jogado ao vivo com contas reais).

## Por quê

O lobby era uma tela só, igual para todo mundo: lista de jogadores, regras com botões desligados para quem não é o líder, tudo numa rolagem comprida. Pedido do Lucas: **uma tela para o líder e outra para os membros**, mais organizada, separada por abas (Membros, Regras...) e **deixando claro que só o líder mexe nas regras**.

## Quem é quem

- **Líder da sala** é quem tem `hostId` (o mesmo "host" do servidor). A UI sempre diz "líder".
- Se o líder cai e outra pessoa assume, a tela troca sozinha para a visão certa.
- No Siga o Líder do Eco (spec 012) existe também o "líder da rodada"; na tela, esse papel deve ter outro nome (por exemplo "criador") para não confundir com o líder da sala.

## As duas telas

Mesma moldura (`LobbyShell`): cartão do código com o botão Convidar e o resumo das regras ("Cor · Clássico · 3 rodadas"), faixa de papel, abas e rodapé. O que muda:

|                | Líder (`HostLobby`)                                                                      | Membro (`MemberLobby`)                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Faixa de papel | laranja, coroa: "Você é o líder da sala. Só você muda as regras e começa a partida."     | branca, cadeado: "Líder da sala: @fulano. Só o líder muda as regras e começa a partida."               |
| Aba que abre   | Regras                                                                                   | Membros                                                                                                |
| Aba Membros    | botão Expulsar em cada jogador (pede confirmação: Confirmar / Não)                       | sem ações sobre os outros                                                                              |
| Aba Regras     | tudo editável; aviso "Só você altera as regras. Quem está na sala vê a mudança na hora." | **só leitura** (nenhum botão), aviso tracejado com cadeado "Só o líder (@fulano) pode mudar as regras" |
| Rodapé         | lista do que falta (pessoas suficientes, todo mundo pronto), Começar, Sair               | Estou pronto / Não estou pronto, frase do que acontece depois, Sair                                    |

## Abas

- **Membros n/máx:** o líder em destaque no topo (cartão amarelo, coroa, "VOCÊ" quando for você); abaixo os jogadores com avatar, nome e estado (PRONTO, ESPERANDO, SEM CONEXÃO), contador "x DE y PRONTOS" com barra de progresso, e um aviso tracejado quando faltam pessoas para começar.
- **Regras:** primeiro uma frase sobre o modo escolhido; depois cada regra. A lista de regras vem de um lugar só (`lobby/rules.ts`), então o líder e os membros nunca veem coisas diferentes.
- **Convidar:** link da sala com botão Copiar, o código, e os amigos que ainda não estão na sala (Convidar / Convite enviado). Todos podem convidar.
- Teclado: setas esquerda e direita trocam de aba (com volta ao início) e o foco acompanha.

## O que não mudou

Comportamento do servidor, mensagens da sala (`configure`, `kick`, `ready`, `start`, `invite`), regras de início (mínimo de pessoas por jogo, todos prontos) e o fluxo de revanche. É só a tela.

## Arquivos

`apps/web/src/screens/room/Lobby.tsx` (escolhe a visão) e `apps/web/src/screens/room/lobby/`: `HostLobby`, `MemberLobby`, `LobbyShell`, `MembersPanel`, `RulesPanel` (`RulesEditor` e `RulesReadOnly`), `InvitePanel`, `rules.ts`, `lobby.css`. Ícones novos em `components/icons.tsx` (`Crown`, `Lock`, `Check`).

## Critérios de aceite

- [x] O líder e o membro veem telas diferentes, com faixa de papel própria.
- [x] Na visão do membro não existe nenhum controle que altere as regras (verificado: zero botões na aba Regras).
- [x] Só o líder vê Expulsar, e o botão pede confirmação.
- [x] O líder aparece em posição de destaque, separado dos jogadores.
- [x] Funciona de 3 a 12 pessoas, sem rolagem horizontal, nos temas claro e escuro, no celular e no computador.
- [x] Abas navegáveis por teclado.
- [ ] Jogado ao vivo com 3 contas (entrar, mudar regra, marcar pronto, expulsar, o líder cair e outra pessoa assumir).

## Pendente: aba Convidar nova (pedido do Lucas em 07/10/2026)

> **Status: pendente, só escrito.** Pedido: "tirar o botão Convidar de cima e deixar apenas o Convidar que fica junto com Membros e Regras; adicionar convidar mandando o link direto escolhendo o app, com algo mais explícito na aba Convidar; essa aba mais intuitiva, organizada e boa de usar."

**O que muda**

- **Sai o botão "Convidar" do cartão do código** (no topo). O cartão fica só com o código, o resumo das regras e, se couber, o botão de copiar o código. Convidar passa a ser **só pela aba Convidar**.
- **A aba Convidar é a central de chamar gente**, organizada em blocos, do mais usado para o menos:
  1. **Enviar o link escolhendo o app:** um botão grande e explícito ("Enviar o link por...") que abre a folha de compartilhar do aparelho (WhatsApp, Telegram, Instagram, mensagens...), já com o texto pronto e o link. Hoje isso só existia escondido no botão do topo, que também copiava o link quando o aparelho não tinha a folha. Onde a folha não existe (computador), o botão cai para copiar o link e avisa isso.
  2. **Atalhos diretos** (um toque cada): WhatsApp, Telegram e e-mail com a mensagem pronta; Copiar link; Copiar código. Cada botão diz o que faz, sem ícone solto.
  3. **Chamar amigos do NoCap:** a lista de amigos que ainda não estão na sala, com busca por @usuário quando a lista for grande, e o estado de cada um (Convidar, Convite enviado, Já está na sala).
  4. **Quem pode entrar:** o código da sala em tamanho grande, a vaga (ex.: 3/12) e a frase de que a pessoa precisa de conta para entrar.
- **Texto da mensagem pronta:** "Entra na minha sala de [jogo]: [código] [link]", com o nome certo do jogo (Mesmíssima, Já Deu?, Intruso, Ecooo).
- **Organização:** blocos com título, botões grandes para o dedo, ordem fixa, e o estado de cada ação visível (Copiado, Enviado, Carregando). Aba abre por padrão para o líder logo depois que cria a sala.

**Perguntas abertas**

- QR code para outra pessoa escanear com o celular? Exigiria uma biblioteca nova (decisão de dependência, ver `RULES.md`) ou um gerador próprio.
- Quem pode convidar: todos os membros (como hoje) ou só o líder?
- Convidar quem não é amigo pelo @usuário (sem precisar adicionar antes)?

**Critérios de aceite (pendentes)**

- [ ] O botão "Convidar" do topo não existe mais; só a aba Convidar.
- [ ] A aba tem um botão explícito que abre a folha de compartilhar do aparelho com o texto e o link prontos.
- [ ] Há atalhos diretos (WhatsApp, Telegram, copiar link, copiar código) e cada um mostra o resultado da ação.
- [ ] Onde não há folha de compartilhar, o botão copia o link e diz isso na tela.
- [ ] A lista de amigos mostra o estado de cada um e tem busca quando passa de uns 8 amigos.
- [ ] O texto da mensagem usa o nome certo do jogo.

## Fora de escopo

Passar a liderança para outra pessoa pelo botão, e as telas de jogo (Play, Final), que seguem como estavam. O **chat da sala** tem spec própria: [014-chat-sala.md](014-chat-sala.md), e a aba Chat entra ao lado de Membros, Regras e Convidar.
