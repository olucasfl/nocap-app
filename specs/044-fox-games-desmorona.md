# Spec 044: Fox Cap! e Desmorona! (jogo de arena que desmorona)

Pedido do Lucas em 25/10/2026. Status: **aprovada nas decisões da seção 9; falta o "pode começar" para a Fase 1.**

## 1. O que o Lucas pediu

1. Um jogo **estilo Fall Guys**, competitivo com amigos, em 3D com as **raposas de boné**: **Desmorona!**
2. A arena é de **ladrilhos hexagonais** em **7 camadas** empilhadas. A de cima é a maior, e cada uma de baixo é menor.
3. Todos **caem do ar** na primeira camada, ao mesmo tempo. Quando alguém **anda** num ladrilho, ele aguenta um tempo e **quebra**. Quem está em cima cai para a camada de baixo. Quem cai da **última** camada **morre**, fica **assistindo** os outros, e vence o **último vivo**.
4. **Câmera individual** (cada um vê a sua). No celular, **joystick** bem feito, sem atrapalhar a visão. No computador, **W, A, S, D**.
5. **Sem ranking e sem histórico** neste jogo.
6. Mesma área do Atravessa. A aba **Atravessa vira "Fox Cap!"** e lá dentro ficam o **Atravessa** (offline e com amigos) e o **Desmorona!** (com amigos, com treino offline).
7. **Foco no online**; o offline (treino contra bots) é só para treinar e ajustar o jogo.

## 2. Princípio de rede (o que o torna fluido)

Movimento livre significa mandar posições, mas dá para fazer bem sem colisão:

- **Cada jogador manda a própria posição ~15 vezes por segundo** (só `x, y, z`, direção e se está no ar). Os outros desenham o jogador **suavizado, com ~100 ms de atraso proposital** (interpolação). Erros de rede viram só um pequeno "deslize" visual, sem consequência no jogo.
- **Sem colisão entre jogadores nas Fases 1 e 2.** Isso elimina o pior problema (empurrão atrasado). As raposas passam umas pelas outras como fantasmas leves (com um pequeno efeito de transparência quando se sobrepõem).
- **A arena não depende de posição ao vivo.** Quem decide o que quebra e quem cai são **eventos**, não posições:
  - `pisei o ladrilho T` (enviado uma vez por ladrilho novo), com o relógio do jogo;
  - o servidor confere se é plausível (o ladrilho existe, está na camada em que o jogador diz estar, a velocidade é humana) e **repassa** a todos;
  - o ladrilho pisado quebra `LIFE_MS` depois. O tempo de quebra sai do instante registrado pelo servidor, então **todo mundo vê a quebra no mesmo momento**, com a mesma tremida de aviso.
- **Cair:** o próprio cliente percebe que está sem chão e avisa `caí para a camada N`; o servidor confere com o estado dos ladrilhos e confirma. **Margem de 150 ms a favor de quem pulou.** Como o jogo não tem ranking nem histórico, a margem de confiança pode ser generosa (o risco de trapaça é baixo: é jogo entre amigos).
- **Morte:** quem cai da última camada avisa; o servidor registra a **ordem de morte** (o que define 2º, 3º... e o vencedor). Se duas mortes chegarem juntas, desempata o instante da queda e depois o último ladrilho pisado.
- **Relógio:** o servidor manda `startAt` e cada cliente mede o atraso (ping) para ficar sincronizado; a sequência da partida (queda do céu, ondas, contagem) sai dessa hora.

## 3. Regras do jogo

### Arena
- **7 camadas** de hexágonos, de cima para baixo, com raios de **8, 6, 5, 3 e 2** ladrilhos (217, 127, 91, 37 e 19 ladrilhos; valores provisórios). Cada camada fica a **6 unidades** abaixo da anterior, centrada.
- Cada camada tem cor própria (roxa, rosa, laranja, amarela, azul gelo). As camadas de baixo aparecem **por baixo** das de cima (dá para ver a queda vindo).
- Embaixo da última camada há **lava** (a "coisa que mata"): tocar nela elimina.
- Cenário em volta: colinas e céu coloridos como na referência (Fall Guys), na paleta das raposas.

### Começo da partida (~8 s)
1. Contagem 3, 2, 1 com todos **no ar**, acima da primeira camada, em posições espalhadas.
2. **Todos caem juntos** (queda de ~1,2 s). Ao pousar, começa a partida.
3. Os primeiros 2 s são de proteção: nenhum ladrilho quebra.

### Ladrilhos
- Estados: `firme` → `pisado` (a contagem começou) → `rachando` (últimos 0,5 s, treme e muda de cor) → `caiu`.
- Um ladrilho **pisado** quebra depois de `LIFE_MS` (**1500 ms** por padrão; cada camada abaixo diminui um pouco: 1500, 1350, 1200, 1050, 900). Quem estiver sobre ele cai para a camada de baixo.
- **Ondas:** de tempos em tempos (começa em 40 s e acelera) uma onda derruba uma faixa de ladrilhos da camada de cima, sempre avisada com tremida e som. Garante que a partida acabe em **3 a 4 minutos**.
- Um ladrilho que já caiu não volta.

### Cair e morrer
- **Cair de uma camada para a de baixo** não elimina: o jogador **continua caindo livre** (cerca de 1 s) e **pousa em cima da camada de baixo** (se não houver chão no lugar, continua caindo até a camada seguinte).
- Cair da **última camada** (ou tocar a lava) **elimina**. Morreu, vira espectador.
- **Vence o último vivo.** Se todos os restantes morrerem juntos, vence quem sobreviveu mais tempo.

### Espectador
- Quem morre vê a partida com uma **câmera livre que segue outro jogador vivo**; botões para trocar de jogador (anterior e próximo). Vê quem ainda está vivo.
- Ao fim, tela de resultado com a ordem final da partida (sem ranking, sem histórico).

## 4. Controles e câmera

- **Câmera individual** em terceira pessoa, atrás e acima da raposa, com seguimento suave. A arena inteira cabe na tela sem a câmera esconder o chão à frente.
- **Computador:** `W A S D` movem (e as setas também), `Espaço` pula. O mouse pode girar a câmera (opcional, desligado por padrão).
- **Celular (deitado):** **joystick virtual** no canto inferior esquerdo (aparece onde o polegar tocar, "joystick flutuante", com zona morta e curva suave) e **um botão de pulo** pequeno e translúcido no canto direito. Nada mais cobre a visão. A **câmera acompanha a raposa sozinha** (sem segundo joystick).
- O boné e a cor das raposas vêm do Atravessa; cada jogador tem uma cor/boné distinto na sala.

## 5. Servidor (salas)

Reaproveita o sistema de salas do Atravessa (host, pronto, convite, revanche por votação, 2 a 8 jogadores) e ganha um motor de partida próprio (`apps/api/src/rooms/desmorona-room.engine.ts`, formato de `atravessa-room.engine.ts`).

- **Mensagens do cliente:** `pos` (~15/s: posição, direção, camada), `step { tile }` (ao pisar um ladrilho novo), `fell { layer }`, `dead`.
- **Mensagens do servidor:** `pos` dos outros (agrupadas a cada ~66 ms), `tileStep`, `tileBreak` (com hora), `wave`, `fell`, `dead`, `result`. O mapa em si **não** viaja: sai da `seed`.
- **Validação (leve, sem ranking):** o ladrilho existe e está na camada informada; o jogador está perto dele (distância plausível); a velocidade não passa do limite com folga. Falhou? Ignora o evento, sem punir.
- **Queda de conexão:** o jogador fica parado onde estava e cai com o chão.
- **Jogo em sala é entre amigos**: não há ranking, nem estatísticas, nem histórico, e o placar final não é gravado.

## 6. Fox Cap! (a área)

- O cartão **Atravessa!** do Hub (`apps/web/src/screens/Hub.tsx`, `GameCard to="/atravessa"`) vira **Fox Cap!**, com arte das raposas de boné.
- Nova tela `/fox-cap` com dois cartões: **Atravessa!** (continua em `/atravessa`, com o offline e o "Jogar com amigos") e **Desmorona!** (novo).
- Nada some: as rotas, salas e convites atuais do Atravessa seguem como estão. O ranking e o histórico do **Atravessa** continuam; o **Desmorona!** não entra em nenhum.

## 7. Fases

1. **Fase 1: jogo e treino offline.**
   - Motor puro em `packages/games/src/desmorona`: hexágonos, camadas, queda de ladrilhos, estados, regras de vitória, determinismo por seed, testes.
   - Cena 3D em `apps/web/src/games/desmorona`: arena hexagonal, raposa com boné, câmera individual, joystick e WASD, queda do céu, espectador.
   - **Treino contra bots** (2 a 8): os bots andam e quebram o chão. Serve para acertar o ritmo e a sensação.
   - Tela **Fox Cap!** e a troca do cartão no Hub.
2. **Fase 2: salas online.** Motor de sala, sincronização do relógio, mensagens `pos`/`step`/`fell`/`dead`, espectador online, revanche por votação, e um teste que atrasa as mensagens em 300 ms para provar que o resultado não muda.
3. **Fase 3: colisão e empurrão** entre raposas, mais modos (rodada rápida, melhor de 3) e itens.

## 8. Testes

- **Motor puro:** a queda dos ladrilhos é igual para todos (mesma seed e mesmos passos); um ladrilho pisado quebra no tempo certo; quedas entre camadas e morte na última; vitória e desempate; jogada ilegal recusada.
- **Sala:** duas contas, largada sincronizada, `step` replicado, quebra no mesmo instante, queda e vitória (como `atravessa-room.integration.test.ts`).
- **Latência:** atraso de 300 ms nas mensagens não muda quem cai nem quem vence.
- **Web:** Playwright em celular deitado e PC (joystick e teclado), sem rolagem e sem texto cortado.

## 9. Decisões do Lucas (25/10/2026)

1. Nome do jogo: **Desmorona!**; nome da área: **Fox Cap!**.
2. **Colisão fica para a Fase 3.**
3. **2 a 8 jogadores por sala.**
4. Queda: o jogador **continua caindo** pelas camadas (a câmera é individual) e pousa na camada de baixo; da última camada **morre e assiste**. Todos começam **caindo do ar** na primeira camada.
5. Duração alvo da partida: **3 a 4 minutos**.
6. **Foco no online**; o treino offline contra bots entra na Fase 1 só para ajustar o jogo.
7. **Sem ranking, sem histórico e sem estatísticas** no Desmorona!.

## 10. Perguntas que ainda ficam (valem os padrões abaixo se você não responder)

- **Botão de pulo no celular?** Padrão: sim, pequeno, no canto direito. O pulo ajuda a atravessar buracos de 1 ladrilho.
- **Raposa com cores:** cada jogador tem uma cor de boné diferente (8 cores). Padrão: sorteadas na largada.
- **Tempo de quebra:** 1500 ms na camada de cima, reduzindo 150 ms por camada. Padrão: manter, e ajustar jogando o treino.
