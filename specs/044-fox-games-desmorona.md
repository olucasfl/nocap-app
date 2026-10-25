# Spec 044: Fox Games e o novo jogo de arena que desmorona (rascunho)

Pedido do Lucas em 25/10/2026. Status: **rascunho, aguarda as decisões da seção 9 antes de codar.**

## 1. O que o Lucas pediu

1. Um jogo novo, **estilo Fall Guys**, competitivo com amigos: uma arena de ladrilhos em **5 camadas empilhadas**. A de cima é a maior; cada camada de baixo é menor.
2. Quando alguém **pisa** num ladrilho, ele aguenta um tempo e **some**. Todos andam e o chão vai caindo.
3. Quem cai vai para a camada de baixo. Quem cai da **última camada** é eliminado ("tem algo lá embaixo que mata").
4. **Vence o último que ficar.**
5. Mesmo estilo do Atravessa (raposas de boné, 3D, salas), **na mesma área**: a aba **Atravessa** vira **Fox Games** (nome provisório) e lá dentro ficam o **Atravessa** (offline e com amigos) e o **jogo novo**.

## 2. Princípio de rede (o que torna o jogo fluido)

O servidor de salas atual atualiza posições dos outros e isso trava. Este jogo é desenhado para **não depender de posição ao vivo**:

- **O chão desmorona pelo relógio, não por mensagem.** Todos recebem a mesma `seed` e a hora de início. O padrão de queda sai dessa seed; nada de "o chão caiu" viaja pela rede. (Sorteios por seed, como o Atravessa já faz.)
- **Movimento em ladrilhos (pulos)**, como no Atravessa: o jogador manda só o pulo ("fui para o ladrilho x,z da camada c"), no máximo ~4 por segundo. Os outros veem um pulo animado, com ~100 ms de suavização.
- **O pisão cria um aviso grande:** o ladrilho pisado treme e some depois de `LIFE_MS` (1,2 a 2 s). Esse aviso é maior que qualquer atraso normal, então ninguém é pego de surpresa por lag.
- **Cair é decidido pelo relógio sincronizado do servidor**, com margem de **~150 ms a favor de quem pulou**. O servidor confere cada pulo (vizinhança, ritmo) e recusa trapaça.
- **Sem colisão na Fase 1** (dois jogadores podem dividir um ladrilho). Colisão e empurrão ficam para a Fase 2 (seção 6).

## 3. Regras do jogo

### Arena
- **5 camadas** (de cima para baixo): 11x11, 9x9, 7x7, 5x5, 3x3 ladrilhos, empilhadas e centradas. Cada camada fica 2 de altura abaixo da anterior (valores provisórios).
- Os ladrilhos têm cor por camada; a camada de baixo tem um brilho de perigo.
- Embaixo da última camada há **lava** (ou outro perigo): tocar nela elimina.

### Ladrilhos
- Estados: `firme` (nunca pisado), `pisado` (começou a contagem), `rachando` (último 0,5 s, tremida visível), `caiu`.
- Um ladrilho **pisado** some depois de `LIFE_MS` (por padrão 1500 ms). Quem estiver nele cai para a camada de baixo.
- **Quedas automáticas:** a cada `WAVE_MS` (de 15 em 15 s, valores provisórios) uma onda derruba uma faixa de ladrilhos da camada de cima, avisada com tremida. Isso garante que a partida acabe.

### Cair e eliminar
- Cair de uma camada para a de baixo é só uma **troca de camada**: o jogador reaparece no ladrilho livre mais próximo da camada de baixo, sem perder o jogo.
- Cair da **última camada** elimina. O eliminado assiste (como no Atravessa, com setas).
- **Vence o último vivo.** Se vários caírem no mesmo instante, desempata a camada em que estavam e depois o último ladrilho pisado.

### Pulo e movimento
- 4 direções (como o Atravessa), com **recarga de 220 ms**.
- Não dá para pular para ladrilho que já caiu; o servidor recusa e o cliente faz o "quique".

## 4. Servidor (salas)

Aproveita o sistema de salas do Atravessa (host, pronto, convite, revanche por votação, limite 2 a 8) e ganha um motor próprio (`apps/api/src/rooms/desmorona-room.engine.ts`, nome provisório), seguindo o formato dos outros (`atravessa-room.engine.ts`).

- **Relógio:** na largada o servidor manda `startAt` (hora do servidor) e o cliente mede o atraso (ping) para sincronizar; o jogo roda de forma determinística a partir daí.
- **Mensagens do cliente:** `hop { id, from, to, clientTime }` (≤ 4/s por jogador).
- **Mensagens do servidor:** `hops` dos outros (agrupadas a cada ~100 ms), `fall` (quem caiu de camada), `out` (eliminado), `result`. Nada de posição contínua.
- **Validação:** o servidor refaz o estado do mapa (que ladrilhos caíram e quando, pela seed + pulos recebidos) e só aceita pulo legal. Desconectou? O jogador fica parado e cai com o chão.
- **Fase 2 (colisão):** ticks de ~150 ms resolvem os pulos juntos; dois no mesmo ladrilho se batem ou o pulo empurra o outro um ladrilho; empurrar para o vazio derruba.

## 5. Fox Games (a área)

- A aba/cartão **Atravessa!** do Hub (`apps/web/src/screens/Hub.tsx`, `GameCard to="/atravessa"`) vira **Fox Games**, com arte das raposas.
- Nova tela `/fox-games` (ou `/raposas`) com dois cartões: **Atravessa!** (continua em `/atravessa`, com offline e "Jogar com amigos") e **o novo jogo** (nome na seção 9).
- Nada some: as rotas atuais do Atravessa seguem funcionando (links antigos, salas e convites).
- O Hub passa a ter **uma entrada** "Fox Games" no lugar do cartão do Atravessa; as estatísticas do Atravessa continuam no perfil e nos rankings.

## 6. Fases

1. **Fase 1: jogo sem colisão.** Motor puro em `packages/games/src/desmorona` (arena, queda por seed, regras, testes), cena 3D em `apps/web/src/games/desmorona` (mesmas raposas e câmera do Atravessa), treino solo contra bots, e a tela Fox Games. Sem salas ainda.
2. **Fase 2: salas online** (sem colisão): motor de sala, relógio sincronizado, histórico e ranking de vitórias.
3. **Fase 3: colisão e empurrão** por ticks, modos de rodada (rápida, melhor de 3) e itens.

## 7. Ranking e histórico

- Ranking por **vitórias em sala** (e vitórias/jogos), no mesmo formato dos rankings existentes. Salas personalizadas não entram no ranking (regra do projeto).
- O histórico guarda a posição final e quem ficou em 1º, 2º e 3º.

## 8. Testes

- **Motor puro:** queda por seed igual para todos; ladrilho pisado some em `LIFE_MS`; queda de camada e eliminação; empate; jogada ilegal recusada; determinismo (mesma seed, mesmos pulos, mesmo resultado).
- **Sala:** duas contas, largada sincronizada, pulos replicados, queda e vitória (como `atravessa-room.integration.test.ts`).
- **Latência:** teste que atrasa mensagens em 300 ms e confere que a queda e o resultado não mudam.
- **Web:** Playwright em celular e PC (mesmos tamanhos do Atravessa).

## 9. Decisões do Lucas (preciso das respostas antes de codar)

1. **Nome do jogo novo** (provisório: *Desmorona!*; outras ideias: *Racha Chão*, *Cai Cai*, *Fox Fall*) e da área (*Fox Games*, ok?).
2. **Colisão na Fase 1:** sem colisão (recomendo, mais fluido) e o empurrão entra na Fase 3, ou já na primeira versão?
3. **Jogadores por sala:** 2 a 8 (como o Atravessa) ou até 12 (arena maior)?
4. **Quem cai de uma camada:** reaparece na camada de baixo e continua (como pedido) ou perde alguns segundos antes de voltar a pular?
5. **Duração alvo da partida:** 1 a 2 min (rápida) ou 3 a 4 min?
6. **Offline:** treino solo contra bots na Fase 1 (recomendo) ou só online?
