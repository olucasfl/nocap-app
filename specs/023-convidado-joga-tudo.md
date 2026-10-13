# 023 · Convidado joga tudo (sem conta, nada é salvo)

Status: **etapas 1 (solo, popup e avisos) e 2 (salas com apelido) implementadas; falta jogar ao vivo.** Pedido do Lucas (14/10/2026).

## Regras

- Quem **não tem conta joga todos os modos solo** (Cor, Tempo, Eco e Batida, Sinal Vermelho, Block Classic, Block Towers). O **Daily só com conta**.
- **Nada do convidado é salvo**: nenhuma partida vai ao servidor (nem entra na fila offline), não há histórico, ranking, recorde nem "novo recorde". O servidor continua exigindo conta em `/matches` e nas sessões das partidas.
- O fim de toda partida mostra, no lugar da linha pequena de salvamento, o aviso grande **"Esta partida não foi salva"** (`GuestNotice`), com Criar conta e Entrar. Sem barra de recorde, sem "SEU RECORDE", sem links para o ranking.
- O Hub diz "JOGUE SEM CONTA" e "DAILY SÓ COM CONTA".

## Popup "Você ainda não tem conta"

- Aparece **uma vez por abertura do app** (fechar e abrir, ou recarregar, mostra de novo; nada vai para o armazenamento), só para quem não está logado e **depois** de conferida a sessão.
- Lista o que a conta dá: recordes e histórico, ranking, Daily e sequência, amigos e ranking entre amigos, perfil e @ nas salas.
- Não aparece em `/entrar`, `/criar-conta` e `/sala*` (a pessoa já está entrando, ou vai pedir o apelido).
- **Fila de popups** (`lib/popups.ts`): nunca dois ao mesmo tempo; menor prioridade vai primeiro (versão nova = 0, boas-vindas = 10).
- Botões: Criar conta, Entrar, Agora não. Esc fecha.

## Etapa 2: salas sem conta (implementada)

- Ao entrar numa sala sem conta, a primeira tela é **"Coloque seu apelido"**; o apelido vale **só naquela sala**.
- O servidor cria uma identidade temporária de convidado (a pessoa não escolhe o id), com apelido único na sala, tamanho limitado, sem poder imitar o @ de quem está lá.
- Convidado entra por código ou link; não tem amigos, convites nem presença. Nada da sala vai para histórico ou ranking.
- Limite de salas criadas por convidado (contra spam).

### Como ficou

- O app manda `{ guest: true, nickname }` em vez do token. O servidor (`ColorRoom.onAuth`) confere o apelido (`rooms/guest-nick.ts`: 2 a 16 caracteres, letras, números, espaço, ponto, traço e sublinhado), recusa repetido na sala (sem contar acento, maiúscula nem separadores) e recusa o que imita um @usuário de conta ou reservado (`RoomsRepository.usernameTaken`).
- O id do convidado é criado pelo servidor (`guest:<uuid>`), a cada entrada. Nunca vira linha no banco: as linhas de convidado saem do resultado salvo da sala.
- Convidado não convida amigos (o servidor recusa) e o lobby esconde a busca de amigos. O membro aparece com o apelido e a etiqueta VISITANTE, sem @ e sem pedir amizade.
- Limite de 10 entradas de convidado por minuto por origem (IP).
- O apelido fica só na aba (sessionStorage) para a pessoa não digitar de novo ao recarregar.
- Em toda a sala (lobby, jogos, placares, pódio e chat) o visitante aparece só com o apelido, sem @ (`at()` em `lib/rooms.ts`).
