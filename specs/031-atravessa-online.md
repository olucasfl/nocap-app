# 031 · Atravessa! online (sala com amigos, sem colisão, pronta para ter colisão)

Status: **implementada (15/10/2026); falta jogar ao vivo com amigos e calibrar.** Pedido do Lucas: o online funciona como o offline, só que todo mundo joga na mesma sala, no mesmo mapa, com cor e nome sobre cada raposa e até 8 pessoas.

## Decisões do Lucas

- **Mesmo mapa, mesma largada, todo mundo se vê, sem colisão entre jogadores** (as raposas se atravessam). Colisão fica para depois, mas o desenho já deixa o caminho curto.
- **Dois modos**, escolhidos pelo líder no lobby:
  - **Infinito sem checkpoint**: o líder escolhe quantas rodadas (começa em 3). Todo mundo joga a mesma seed; **quem morre vira espectador** ("você morreu", nome de quem assiste no topo e duas setas para trocar). A rodada acaba quando todos morreram. **A nota é a soma dos metros andados em cada rodada.** Ranking em tempo real das distâncias durante a rodada. **Sem escuridão** neste modo.
  - **Com checkpoint**: o líder escolhe o mapa (**pequeno 50 m, médio 100 m, grande 250 m, gigante 500 m**; mudou em 15/10/2026). Quem morre **volta ao início ou ao último checkpoint**. Ranking ao vivo em cima e **timer em cima** (tempo jogado). Vence quem chega ao fim primeiro.
- Checkpoints (15/10/2026): **pequeno 25; médio 25 e 50; grande 25, 50, 100, 150 e 200; gigante 25, 50, 100, 150, 200, 250, 300, 350 e 400**. O fim do mapa não é checkpoint. Cada pessoa vê **quantos metros faltam para o próximo checkpoint** (ou para a chegada).
- **O modo padrão da sala é o Checkpoint (médio, 100 m).** O ranking ao vivo e os metros mostram a **linha de agora**, não a maior: quem morre e volta ao checkpoint desce no ranking.
- O endereço do navegador dentro da sala é sempre o link dela (`/sala/ABCD`), igual ao "copiar link".
- O botão ATUALIZAR tenta o jeito normal e, se a página não recarregar em 4 s (ou na segunda tentativa), desregistra o service worker, limpa o cache e recarrega, para não ficar "atualizando" para sempre.
- Até **8 pessoas** por sala. **Cada um escolhe a cor da sua raposa** (nenhuma cor é de duas pessoas) e o **nome aparece em cima da raposa**.
- 1 metro = 1 linha. A nota de sala não entra no ranking global (regra 2 do projeto: só presets entram).

## Padrões que adotei (o Lucas não especificou; fáceis de mudar)

- **Checkpoint sem escuridão** (o tempo já é a pressão e morrer já custa a volta).
- **Infinito sem escuridão não pode virar sala de espera**: quem fica **12 s sem pular** é engolido (a mesma animação da escuridão). Sem barra nem contagem na tela.
- **Espectar só quem está vivo.** Se todos morrem, a rodada acaba na hora (o líder pode encerrar antes com "Encerrar rodada"; no checkpoint, "Encerrar corrida").
- **Chegar primeiro não encerra a corrida do Checkpoint** (corrigido em 15/10/2026: antes havia um prazo de 60 s e a partida acabou com amigos ainda jogando). Ela só fecha quando todo mundo chega ou some (8 s sem relato), o líder toca em "Encerrar corrida" ou passam 30 minutos.
- Rodadas do Infinito de 1 a 10. No checkpoint a corrida é uma só (as rodadas ficam em 1).
- Placar do checkpoint: quem chegou, por tempo; quem não chegou, por distância (e depois por menos mortes).
- Partida em andamento: quem cai da conexão volta em até 60 s (como nas outras salas) e continua de onde o servidor o viu; entrar com a rodada rolando não é permitido (a sala já recusa).
- **A sala não salva histórico por enquanto** (o histórico de sala mostra notas em décimos; o Atravessa precisa de uma linha própria). Fica como etapa seguinte.

## Arquitetura (a escolha que mantém o caminho para colisão curto)

**Cada aparelho simula o seu herói** (o mesmo `AtravessaSim` do offline) e o **servidor espelha** cada herói com a mesma simulação, a partir das **entradas com o tick** (não de posições). Por isso:

- O mapa é o mesmo porque a seed vem do servidor, e o tempo do mundo é o mesmo porque a largada tem hora marcada no relógio do servidor (o app já mede o desvio). Todos veem os carros nos mesmos lugares.
- O seu pulo nunca espera resposta do servidor, então não existe pulo desfeito nem travada por atraso. Esta é a razão principal da escolha.
- O servidor só avança o espelho até o tick informado pelo aparelho (limitado ao relógio do servidor mais uma folga), então **não dá para andar mais rápido que o tempo real**. O ranking, a morte e a nota final saem do espelho, nunca de uma posição enviada.
- As posições vão aos outros aparelhos em mensagens leves (`pos`, 10 por segundo) com o que o espelho tem. Quem assiste usa o mesmo fluxo.

**Preparado para colisão:** o `AtravessaSim` continua com um herói só e o **mundo (`AtravessaWorld`) já é separado do herói**, compartilhado por todos os espelhos da rodada. A entrada que viaja é "pulo na direção D no tick T", que é exatamente o que um servidor autoritativo consumiria. Quando houver colisão, basta o servidor decidir a ocupação das casas antes de aceitar o passo (uma função `canEnter` que hoje sempre diz sim) e o aparelho tratar a recusa como o tremidinho que já existe.

### Núcleo (`packages/games/src/atravessa`)

- `AtravessaSim` ganha regras opcionais: `darkness` (liga/desliga), `idleKillTicks`, `finishRow` e `checkpoints` (renascer no último checkpoint). Padrão = regras do offline (os testes antigos seguem valendo).
- `AtravessaMirror` (`room.ts`): o espelho do servidor (e dos testes). Recebe `(tick, entradas)`, valida e avança.
- Constantes: `ATR_ROOM_LENGTHS`, `atravessaCheckpoints(length)`, `ATR_ROOM_COLORS` (8 cores), `ATR_ROOM_MAX_PLAYERS = 8`.

### Servidor (`apps/api/src/rooms`)

- `AtravessaRoomEngine` (`atravessa-room.engine.ts`) estende `ColorRoomEngine` (lobby, líder, pronto, expulsar, chat, revanche vêm de graça). Fases: `lobby → show (3-2-1) → play → reveal (placar da rodada) → … → final`.
- `AtravessaRoom` (sala Colyseus, jogo `atravessa`): mensagens `run` (tick + entradas), `color`, `watch`, `endround`; transmissão `pos` a 10 Hz só durante o `play`.

### App (`apps/web`)

- `AtravessaRoomPlay`: a cena do offline com as outras raposas coloridas e nomes, ranking em cima, timer no checkpoint, espectar com setas.
- Lobby: modo, rodadas ou tamanho do mapa, seletor de cor (8 bolinhas), tudo pelas listas de regras que já existem (`rules.ts`).

## Plano

1. Núcleo: regras na `AtravessaSim`, constantes, `AtravessaMirror`, testes.
2. Servidor: motor, sala, `main.ts`, testes do motor.
3. App: tipos e rotas, lobby (modo, rodadas, mapa, cor), pódio.
4. Tela da partida: raposas dos outros, nomes, ranking, timer, espectar.
5. Calibrar jogando com amigos (relógio, 10 Hz, 12 s parado, checkpoints).

## Fora do escopo agora

Colisão, empurrar, histórico de sala, Daily, ranking global de sala.
