# Spec 055: Ping Fox! (pingue-pongue 1x1 das raposas)

Pedido do Lucas em 01/11/2026. Status: **em andamento. Fases 1, 2 e 3 (motor, treino offline e sala online 1x1 no Fox Cap!) prontas; falta jogar de verdade com amigos e no celular real para afinar velocidade e ajuda de mira.**

## 1. O que o Lucas pediu

1. Um **pingue-pongue legal** para jogar **com amigos** e **offline**, dentro do **Fox Cap!**.
2. **Só 1 contra 1** no começo, **só 1 cenário**.
3. Prioridade máxima: **jogo perfeito**: **sem travar, bem liso**, mecânica de batida boa, gráficos bons na **mesa, raquete, bola e rede** (o cenário pode ser simples).
4. Usar a tecnologia do Fut Fox para não travar online.

## 2. Decisões

- **Nome:** Ping Fox! (na família do Fut Fox). Jogo `pingpong` no pacote `@nocap/games`.
- **Sem ranking nem histórico** (jogo de sala e treino, como o Fut Fox e o Desmorona!).
- **Visual:** Three.js, Pop Brutal (formas simples, contorno grosso, cores chapadas). Mesa, rede, raquetes e bola recebem o capricho; o cenário é um chão e um fundo liso.
- **Partida:** 11 pontos com diferença de 2; o saque troca a cada 2 pontos (a cada 1 no empate em 10-10).

## 3. Mecânica da batida (o coração do jogo)

Mesa de 4,2 m (eixo z) por 2,3 m (eixo x), tampo a 1,0 m, rede de 0,3 m, bola de raio 0,075 m, gravidade 9 m/s². Você fica atrás da ponta perto da câmera (jogador 0); o adversário, na ponta de lá.

### 3.1 Controle

- **A raquete segue o ponteiro** (mouse ou dedo): o ponteiro é projetado num plano vertical logo atrás da sua ponta da mesa, então a raquete aparece onde você aponta. No celular o plano fica uns 70 px acima do dedo, para o dedo não cobrir a raquete.
- **A batida é automática:** quando a bola cruza o plano da raquete (teste de varredura, nunca atravessa) e o disco da raquete a alcança, ela é rebatida. O que você decide é **onde** a raquete está e **como ela se mexe**.
- **Smash:** segurar o botão (clique direito, Espaço ou o botão na tela) na hora da batida dá potência e achata a bola, mas a ajuda de mira cai pela metade (mais risco).
- **Saque:** um toque (clique, Espaço ou toque) lança a bola para cima; ela cai e é rebatida sozinha na altura da raquete. Mover a raquete para o lado antes da batida muda a direção.

### 3.2 Física da bola

- Gravidade, **arrasto** do ar e **efeito Magnus** (a bola com topspin mergulha, com backspin flutua, com efeito lateral curva).
- **Quique na mesa** com restituição 0,88 e atrito que **troca spin por velocidade** (modelo de esfera sólida: o topspin acelera a bola ao quicar, o backspin freia).
- **Rede:** a bola que bate na rede perde velocidade e cai do lado de onde veio.
- Passo fixo de 1/240 s (4 subpassos por tick de 60 Hz), determinístico.

### 3.3 Resposta da raquete

- **Mira pelo ponto de contato:** a face é levemente "curva": bater com o lado direito da raquete manda para a direita, com o de cima manda para cima. Quanto mais longe do centro, mais a bola desvia.
- **Efeito pelo movimento:** a velocidade da raquete na hora da batida (para cima = topspin, para baixo = backspin, para o lado = efeito lateral) passa pelo atrito da borracha para a bola. É a mesma conta do quique.
- **Potência:** velocidade da raquete + empurrão fixo para a frente (maior no smash) + restituição da borracha 0,62. Borda da raquete (>85% do raio) rebate fraco; o miolo perfeito (<15%) dá um bônus pequeno.
- **Ajuda de mira:** se a batida física ia dar falta (rede ou fora da mesa), o jogo procura a correção mais próxima de inclinação e direção; **só corrige pequenos erros** (até 14° de inclinação e 10° de direção com a ajuda cheia). Erro grande continua sendo falta. Quem bate bem não sente a ajuda.

### 3.4 Regras

- Depois de cada batida a bola tem que quicar **primeiro na mesa do adversário**; quicar na sua é falta. O saque cai direto na mesa do adversário.
- Quem devolve só pode bater **depois de 1 quique** na sua metade e antes do 2º. Antes do quique a raquete deixa a bola passar (sem voleio); se a bola for longe demais sem quicar, o ponto é de quem rebateu.
- Bola que bate na rede e passa vale; bola que cai de volta no lado de quem bateu é falta.
- Rally de mais de 30 s sem resolver: ponto anulado e saque repetido (rede de segurança).

## 4. Rede (fase 3, pronta em 01/11/2026)

- **A partida é uma função dos eventos e do tick.** `PpNetSim` (`packages/games/src/pingpong/netsim.ts`) roda a mesma `PpMatch` no aparelho de cada jogador, nos que assistem e na sala (árbitra). Entre dois eventos a bola é uma trajetória determinística que todos calculam igual: não há tremida nem teletransporte. Só dois eventos viajam: **lançamento do saque** `{t, p, x}` e **batida** `{t, p, bola depois da batida, km/h, smash, qualidade, efeito}` (`t` = tick da partida, contado do relógio da sala a 60 por segundo).
- **Cada jogador decide a própria batida na hora**, sem esperar a rede (o aparelho detecta o contato com a raquete na sua simulação, manda o evento e já segue). A sala confere (`validate`: era a vez, a bola estava perto, velocidade e efeito possíveis, não é velha demais) e repassa ao outro (`pev`); se recusar manda `prej` e quem enviou desfaz.
- **Evento atrasado volta no tempo:** a simulação guarda uma foto por tick (1,6 s) e, quando chega um evento do passado, restaura a foto, aplica o evento e refaz o caminho até agora. A bola de quem recebe "alcança" a de quem bateu. Ponto, banner e placar só aparecem 200 ms depois (uma batida atrasada ainda pode desfazê-lo).
- **Saque parado:** a sala lança sozinha depois de 6 s. **Quem entra no meio ou volta** manda `psync` e recebe todo o histórico; só começa a andar depois dele (a sala guarda todos os eventos). Quem cai da rede tem 25 s para voltar; quem sai perde.
- A raquete do outro vem em `ppads` (30 por segundo) e é só visual. Quem joga do lado de lá vê a mesa girada (a cena espelha x e z), como se estivesse perto da câmera.
- Os 2 primeiros da sala jogam; os outros (até 8) assistem. Sem ranking.
- **Medido:** com 80 ms e 200 ms de atraso (variação de 3 a 4 ticks) três aparelhos simulados terminam com o mesmo placar (`netsim.test.ts`); a sala com Colyseus de verdade e duas janelas de navegador jogam rallies de 14+ batidas com as duas telas iguais, e uma janela recarregada no meio refaz a partida e segue (`e2e/ping-online.spec.ts`, precisa do servidor só de salas: `apps/api/scripts/rooms-only.ts`).
- **Fica para depois:** caminho direto por WebRTC (como no Fut Fox) para cortar a ida e volta ao servidor. Com este desenho o atraso só adia o que o outro vê (metade do ping), nunca a sua raquete, então a prioridade caiu.

## 5. Offline: bots

3 dificuldades (Fácil, Médio, Difícil). O bot prevê onde a bola cruza o plano dele (mesma física), se move com velocidade limitada e atraso de reação, escolhe o lado para onde devolver e erra de propósito conforme o nível. Smash em bola alta.

## 6. Câmera, gráficos e leitura da jogada

- Câmera atrás da sua ponta, um pouco elevada, fixa; um leve deslocamento lateral acompanha a bola e o campo de visão abre no smash.
- **Marcador de quique:** anel no tampo onde a bola vai quicar (como a marca no chão do Fut Fox) e **anel de alcance** no plano da raquete mostrando por onde a bola vai passar.
- Bola com rastro de luz e linha de spin visível girando; amassa no quique.
- **Banner de ponto** só com texto ("PONTO DE <NOME>") e velocidade da melhor batida em km/h.
- Câmera lenta curta no ponto de set e no ponto da partida.
- Só `transform` e `opacity` animam no HUD; sem emoji.

## 7. Fases

1. **Motor** (`packages/games/src/pingpong`): física, batida, regras, placar, bot, testes (inclui partidas bot contra bot para conferir que rallies terminam e que ninguém trava).
2. **Treino offline** (`apps/web/src/games/pingpong`): cena 3D, controles de mouse e toque, HUD, menu (Esc), tela de fim, entrada no Fox Cap! com "Como jogar?".
3. **Sala online 1x1** (`PingRoomEngine`, lobby, P2P com reserva, revanche).
4. Depois: 2x2, Rei da Mesa, mais cenários.

## 8. Testes

Motor: quique e conservação, sinal do efeito (topspin mergulha, backspin flutua), rede, regras de falta e ponto, saque, troca de saque, fim de partida, determinismo (mesma entrada, mesmo resultado), bot contra bot sem travar. Web: e2e do treino nos tamanhos de tela.

## 9. Como ficou (fases 1 e 2, 01/11/2026)

- **Motor** em `packages/games/src/pingpong` (`constants`, `ball`, `paddle`, `assist`, `predict`, `match`, `bot`, 16 testes): física da bola com arrasto, Magnus, quique com troca de efeito por velocidade, rede e chão; batida com face curva, atrito da borracha, levantada e ajuste de abertura para a bola que desce; ajuda de mira só para erro pequeno (±20° de inclinação, ±10° de direção); regras, saque (falta repete, 2ª falta dá o ponto), placar, bots Fácil/Médio/Difícil que usam a mesma física para escolher o ponto de contato.
- **Medido em partidas bot contra bot** (6 partidas por nível): troca média de 5 a 6 batidas (máx. 14), bola a ~45 km/h de média no número do jogo e até ~95 no smash; o Difícil vence o Fácil em 5 de 6.
- **Web** em `apps/web/src/games/pingpong`: `PingScene` (Three.js: mesa arredondada com linhas, rede com malha, raquete de dois lados com borracha e cabo, bola com faixa de giro e brilho, raposa do outro lado com braço, sombra da bola no tampo, anel de quique, anel de alcance, rastro, faíscas), `PingPlay` (passo fixo de 60 Hz com interpolação entre ticks para telas de 120/144 Hz; mouse ou dedo projetado no plano da raquete; clique ou toque saca; botão direito, Espaço ou botão na tela dão smash; câmera lenta no ponto decisivo), `PingFinal` (tela de fim), `PingPicker` (nível), som em `lib/ping-audio.ts`.
- **Fox Cap!**: cartão "Ping Fox! Treino" (offline) com "Como jogar?".
- **E2E** `e2e/ping.spec.ts`: abre e saca; quem segue o anel devolve a bola; celular em pé, deitado e deitado pequeno (HUD cabe, o dedo leva a raquete); tela de fim nos 4 tamanhos.

## 10. Como ficou a sala (fase 3, 01/11/2026)

- **API:** `PingRoomEngine` (`apps/api/src/rooms/ping-room.engine.ts`) e `PingRoom` (`color.room.ts`, mensagens `phit`, `ptoss`, `ppad`, `psync`; `pev`, `prej`, `ppads` de volta), registrada no Fox Cap! (`pickgame`) e em `main.ts`. 7 testes do motor e 1 de integração com Colyseus.
- **Web:** o Fox Cap! "Com amigos" tem "Ping Fox!" entre os jogos; `PingRoomPlay` (partida) e `PingRoomFinal` (pódio com os números e a votação de revanche) em `apps/web/src/games/pingpong`. A partida em sala usa a mesma `PingPlay` do treino.
- **Pódio:** a sala espera 2,5 s depois do último ponto, e manda duração, maior troca, bola mais rápida, smashes e batidas de cada um.
