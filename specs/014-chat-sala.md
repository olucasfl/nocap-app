# 014 · Chat nas salas com amigos

Status: **implementado (aba Chat no lobby + gaveta na partida; falta testar ao vivo)**. Pedido do Lucas em 07/10/2026. Decisões adotadas: sem reações rápidas, sem denunciar nem filtro de palavrões, sem mensagens de sistema, sem som próprio (só contador); Intruso abre o chat no lobby, votação, revelação e pódio; Já Deu? fecha na contagem.

## O que é

Conversa por texto dentro das salas com amigos, em todos os jogos de sala (Mesmíssima, Já Deu?, Intruso e, quando existirem, as salas do Ecooo e o Tribunal do Absurdo). Serve para combinar, provocar e rir enquanto joga.

## Regras propostas (a confirmar com o Lucas)

- **Onde existe:** no lobby (uma aba **Chat** ao lado de Membros, Regras e Convidar) e durante a partida (botão flutuante que abre uma gaveta, sem tirar a pessoa da tela do jogo). No pódio também.
- **Não se salva.** A conversa vive só na memória da sala e some quando a sala fecha (decisão antiga do brief: chat e eventos de sala não são persistidos). Quem entra depois vê as últimas 50 mensagens.
- **Só quem está na sala** lê e escreve. Mensagem de sistema (entrou, saiu, virou líder) aparece na conversa.
- **Limites:** até 200 caracteres por mensagem, texto simples (sem HTML nem link clicável), no máximo 1 mensagem por segundo e 5 a cada 10 segundos por pessoa. O servidor valida, corta e recusa; o cliente não é confiável.
- **Moderação mínima:** o líder da sala pode silenciar um membro, e quem for expulso perde o acesso. Denunciar e filtro de palavrões ficam como pergunta aberta.
- **Aviso de mensagem nova:** contador no botão do chat, com som baixo próprio. O som **respeita os jogos**: nunca toca durante a contagem do Já Deu? (regra do projeto: nada de som nem animação ali), e o mudo do app vale também para o chat.

## Regras que dependem do jogo

- **Já Deu?:** durante a contagem o chat fica fechado e sem notificação (nem número, nem som, nem vibração); as mensagens chegam e aparecem quando a rodada termina.
- **Intruso:** o jogo é de dedução. Proposta: o chat só abre na **fase de votar** (e na revelação), para a conversa não entregar a cor nem a dica. Fora dela, fica fechado.
- **Mesmíssima e Ecooo:** aberto o tempo todo, mas o botão não cobre os controles de jogo (cores, botões do Ecooo).
- **Tribunal do Absurdo (futuro):** o chat precisa se combinar com as defesas anônimas (não pode revelar quem escreveu antes do voto).

## Telas

- **Aba Chat no lobby:** lista de mensagens (nome do autor, texto, hora) e campo de texto com botão Enviar; Enter envia. Mensagens suas alinhadas de um lado.
- **Gaveta durante a partida:** abre por cima da tela, ocupa metade da altura, fecha ao tocar fora ou em Esc. Botão com o contador de não lidas.
- **Reações rápidas** (um toque, sem digitar), por exemplo "boa!", "calma", "kkk": pergunta aberta, ajudam no celular e em jogos rápidos.
- Tokens Pop Brutal, sem emoji (as reações são texto), animações só em `transform` e `opacity`, `prefers-reduced-motion` respeitado.

## Servidor

- Mensagem nova na sala (Colyseus): `chat { text }` do cliente, `chat` com `{ id, username, text, at }` para todos. O servidor guarda as últimas 50 numa lista em memória do motor da sala.
- Validação com limite de tamanho, limpeza de caracteres de controle e limite de ritmo por conta. Erro de limite volta como aviso ("calma, uma de cada vez").
- Sem tabela nova no banco e sem migration.
- Testes do motor: limites, ritmo, só membro escreve, silenciado não escreve, as últimas 50, e que o Intruso só aceita na fase de votar.

## Critérios de aceite

- [ ] Duas pessoas numa sala trocam mensagens em tempo real, no lobby e durante o jogo.
- [ ] Mensagens passam de 200 caracteres ou de 1 por segundo: o servidor recusa.
- [ ] Quem entra depois vê as últimas 50 mensagens.
- [ ] No Já Deu? nada do chat aparece nem toca durante a contagem.
- [ ] No Intruso o chat só abre na votação e na revelação.
- [ ] O líder silencia um membro e o silenciado não consegue enviar.
- [ ] A conversa não é gravada em lugar nenhum e some com a sala.

## Perguntas abertas

- O chat do Intruso: só na votação (proposta) ou aberto o tempo todo?
- Reações rápidas, sim ou não? Quais frases?
- Denunciar e filtro de palavrões entram agora ou depois?
- O chat funciona com a tela bloqueada e na reconexão (volta o histórico das últimas 50)?

## Fora de escopo

Chat fora de sala (mensagem direta entre amigos), imagens, áudio e voz, e histórico salvo.
