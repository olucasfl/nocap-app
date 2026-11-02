# Spec 055: Ping Fox! (pingue-pongue 1x1 das raposas)

Pedido do Lucas em 01/11/2026. Status: **em andamento. Fases 1, 2 e 3 (motor, treino offline e sala online 1x1 no Fox Cap!) prontas; a batida foi refeita em 02/11/2026 (seção 3); falta jogar de verdade com amigos e no celular real para afinar a faixa de acerto.**

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

## 3. Mecânica da batida (refeita em 02/11/2026: a raquete bate na bola de verdade)

O Lucas pediu: **nada de "bater no símbolo da bola"**. A raquete tem que bater direto na bola, com física: jogar a raquete para a frente manda a bola rápido, deixar fraco manda fraco, bater de cima para baixo dá efeito e desce (pode ir na rede), de baixo para cima levanta (lob, pode sair), e dá para dar efeito. O saque tinha que ficar intuitivo, a bola não podia "subir do nada" e nada podia ser rápido a ponto de ser impossível.

Mesa de 4,2 m (eixo z) por 2,3 m (eixo x), tampo a 1,0 m, rede de 0,24 m, bola de raio 0,075 m, gravidade 8 m/s². Você fica atrás da ponta perto da câmera (jogador 0); o adversário, na ponta de lá.

### 3.1 Controle

- **A raquete segue a mão** (mouse ou dedo): o ponteiro é projetado num plano vertical logo atrás da sua ponta da mesa, e a raquete vai até lá como uma mola com velocidade limitada (nunca teletransporta). **No celular o dedo é relativo**: a raquete anda o tanto que o dedo anda, a partir de onde ela estava (sem pular para onde o dedo encosta).
- **Não há anel nem alvo.** A bola tem só a sombra no tampo. Quem bate é a raquete, de verdade: o disco da raquete encontra a bola e a física decide.
- **"Jogar a raquete":** quanto mais rápido a mão se mexe, mais a raquete **avança para a frente** (alcance, até 0,7 m) e leva a bola junto. A velocidade da raquete (para a frente, para cima ou para baixo, para o lado) entra inteira na batida.
- **Saque:** clique (ou toque, ou Espaço) lança a bola, que sobe uns 0,6 m e desce **na frente da raquete**; você bate nela passando a mão rápido para a frente. O melhor momento é no alto, quando a bola quase para. O saque cai direto na mesa do adversário.
- Sem botão de smash: o smash é uma passada rápida de cima para baixo.

### 3.2 Física da bola

- Gravidade, **arrasto do ar** forte (a bolinha é leve: a bola rápida perde velocidade e a que sobe demais cai), **efeito Magnus** (topspin mergulha, backspin flutua, efeito lateral curva).
- **Quique na mesa** com restituição 0,88 e atrito que troca efeito por velocidade (esfera sólida).
- **Rede:** a bola que bate perde velocidade e cai do lado de onde veio.
- Passo fixo de 1/240 s (4 subpassos por tick de 60 Hz), determinístico.

### 3.3 A batida (nada corrige o resultado)

- **Contato por varredura:** o plano da raquete (que avança com a mão) e a bola se movem, e há batida quando um passa pelo outro dentro do disco (raio 0,32 m), sem atravessar nunca.
- **Face inclinada pelo movimento:** subir abre a face (a bola sobe: lob), descer fecha (a bola desce), o movimento lateral vira a face para o lado, e o ponto de contato desvia um pouco (a borracha é levemente curva).
- **Borracha:** restituição 0,62 e atrito 0,9; o atrito com a mão passando pela bola vira **efeito**: subir dá topspin, descer dá backspin. A raquete é leve: só 70% da velocidade da mão passa para a bola, o que alarga a margem de acerto.
- **Limite:** a bola nunca sai a mais de 13 m/s (cerca de 80 no número que se mostra).
- **Sem ajuda de mira, sem "levantada" automática:** descer demais vai na rede; subir demais ou bater forte demais sai da mesa. A região que acerta é uma faixa em diagonal (subir mais pede bater menos forte), com cerca de 2 m/s de folga.
- **Medido (`pingpong.test.ts`):** parada, a raquete devolve fraco; mais rápido para a frente, mais rápida a bola; de baixo para cima levanta e dá topspin; de cima para baixo desce e dá backspin; o movimento para o lado vira a bola para o lado; a bola nunca passa do limite; a raquete só avança com a mão rápida. Uma "pessoa" programada que dá uma passada suave para cima e para a frente devolve cerca de metade das bolas do bot Fácil; a mão sem passada (devagar) quase não devolve.

### 3.4 Regras

- Depois de cada batida a bola tem que quicar **primeiro na mesa do adversário**; quicar na sua é falta. O saque cai direto na mesa do adversário.
- Quem devolve só pode bater **depois de 1 quique** na sua metade e antes do 2º. Antes do quique a raquete deixa a bola passar (sem voleio); se a bola for longe demais sem quicar, o ponto é de quem rebateu.
- Bola que bate na rede e passa vale; bola que cai de volta no lado de quem bateu é falta.
- Saque sem batida (a bola cai) é falta: a primeira repete, a segunda dá o ponto ao outro.
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

3 dificuldades (Fácil, Médio, Difícil). O bot prevê onde a bola cruza o plano dele (mesma física), se move com velocidade limitada e atraso de reação e **escolhe a batida** (a velocidade da mão: para cima ou para baixo, para o lado e para a frente) entre as que fazem a bola cair na mesa do outro lado, perto do canto livre; a força da mão varia conforme o nível e o Fácil não bate forte.

## 6. Câmera, gráficos e leitura da jogada

- Câmera atrás da sua ponta, um pouco elevada, fixa; um leve deslocamento lateral acompanha a bola e o campo de visão abre nas bolas muito rápidas.
- **Só a sombra da bola** no tampo e no chão para ler altura e lugar (nenhum anel nem alvo: a batida é da raquete na bola). A sua raquete é meio transparente para a bola continuar à vista quando passa por ela.
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

- **Motor** em `packages/games/src/pingpong` (`constants`, `ball`, `paddle`, `assist`, `predict`, `match`, `bot`, 16 testes): física da bola com arrasto, Magnus, quique com troca de efeito por velocidade, rede e chão; batida física (contato por varredura com a raquete que avança com a mão, face inclinada pelo movimento, restituição e atrito da borracha), sem ajuda de mira; regras, saque (falta repete, 2ª falta dá o ponto), placar, bots Fácil/Médio/Difícil que usam a mesma física para escolher o ponto de contato.
- **Medido em partidas bot contra bot** (6 partidas por nível): o Difícil vence o Fácil em 5 de 6, as partidas terminam e há trocas de várias batidas; a velocidade da bola fica na faixa de 20 a 80 no número do jogo.
- **Web** em `apps/web/src/games/pingpong`: `PingScene` (Three.js: mesa arredondada com linhas, rede com malha, raquete de dois lados com borracha e cabo que avança e se inclina com a mão, bola com faixa de giro e brilho, raposa do outro lado com braço, sombra da bola, rastro, faíscas), `PingPlay` (passo fixo de 60 Hz com interpolação entre ticks para telas de 120/144 Hz; mouse projetado no plano da raquete e dedo relativo; clique ou toque saca; câmera lenta no ponto decisivo), `PingFinal` (tela de fim), `PingPicker` (nível), som em `lib/ping-audio.ts`.
- **Fox Cap!**: cartão "Ping Fox! Treino" (offline) com "Como jogar?".
- **E2E** `e2e/ping.spec.ts`: abre e saca; uma "pessoa" que dá a passada certa (de baixo para cima e para a frente) devolve a bola do bot; celular em pé, deitado e deitado pequeno (HUD cabe, o dedo leva a raquete); tela de fim nos 4 tamanhos.

## 10. Como ficou a sala (fase 3, 01/11/2026)

- **API:** `PingRoomEngine` (`apps/api/src/rooms/ping-room.engine.ts`) e `PingRoom` (`color.room.ts`, mensagens `phit`, `ptoss`, `ppad`, `psync`; `pev`, `prej`, `ppads` de volta), registrada no Fox Cap! (`pickgame`) e em `main.ts`. 7 testes do motor e 1 de integração com Colyseus.
- **Web:** o Fox Cap! "Com amigos" tem "Ping Fox!" entre os jogos; `PingRoomPlay` (partida) e `PingRoomFinal` (pódio com os números e a votação de revanche) em `apps/web/src/games/pingpong`. A partida em sala usa a mesma `PingPlay` do treino.
- **Pódio:** a sala espera 2,5 s depois do último ponto, e manda duração, maior troca, bola mais rápida, smashes e batidas de cada um.


## Ajustes de 01/11/2026 (batida mais fácil, mesa maior)

- Mesa 25% maior (`PP_L` 5,25, `PP_W` 2,9); plano da raquete mais perto da mesa (`PP_PAD_Z = L/2 + 0,1`).
- **Ajuda de leitura** (`ppGuideHit`, `assist.ts`): se a física mandaria a bola na rede, para fora ou curta demais (que morre antes de a raquete alcançar), troca só a altura da saída (e, se preciso, um pouco da força) pela jogada boa mais parecida com a da mão. Direção para os lados e efeito continuam do jogador; bola boa não é alterada. Mão parada sai reta para a frente.
- Raquete espera 0,3 m à frente quando a bola vem (`PP_REACH_WAIT`) e é puxada de leve para a bola perto do plano (ímã).
- Saque fácil: a bola descendo na frente da raquete é rebatida mesmo com a mão parada; o ímã alinha a raquete na horizontal.
- Bots prevêem o cruzamento com 0,45 m de alcance (`BOT_REACH`).
- Celular: sem zoom por pinça em todo o app (viewport, `touch-action`, `gesturestart`); a tela de jogo bloqueia seleção/lupa do iOS.
- Tela final: `.fz-body` não encolhe cabeçalho e placar em telas baixas.

### Rodada 2 (01/11/2026)

- Bola que passou do plano da raquete ainda pode ser pega (até `PP_CATCH` = 3 m atrás) se a raquete estiver em cima dela; só no rally e só para quem joga com mão (bots não).
- Raquete fora da mesa: `PP_PAD_Z = L/2 + 0,2` e alcance máximo 0,2 m (não entra mais na mesa); `PP_PAD_Y_MAX` 3,0.
- Câmera mais longe e com campo de visão maior.
- O limite de 30 s do rally passa a contar desde a última batida.
- Bots: erro de posição maior (para as partidas terminarem) e preferem bolas menos altas.

### Rodada 3 (01/11/2026): acertar sempre, golpes com sentido, saque com barra, cenário

- **Sempre acerta a bola**: quem joga com a mão (entrada sem `manual`) tem a raquete levada ao ponto previsto de cruzamento da bola (`ppPredictCross`, recalculado a cada 4 ticks). Bola curta que morre antes do plano é alcançada avançando a raquete (`PP_REACH_DEEP`). Bola muito rápida (> 10 m/s) dá menos ajuda (até 20%): o ponto é de quem bateu melhor, não de quem "errou a bola". Bots e testes usam `swing` ou `manual`.
- **Golpes com sentido** (`paddle.ts`): a saída é limitada pela bola que veio (`0,5·vin + 3,6 + 10,5·força da mão`), então bola mansa com mão mansa não vira foguete; mão parada contra bola forte é bloqueio e sobe em lob; mão para baixo e forte sobre bola alta é smash (+4,5 m/s de teto); o lado da mão leva a bola para o cantinho (`PP_AIM`) e dá efeito. A ajuda de leitura (`ppGuideHit`) agora também fecha o ângulo se o cantinho sair da mesa.
- **Saque com barra**: segurar (clique, toque ou Espaço) faz a barra subir e descer; soltar lança a bola com `ppTossSpeed(v)` (3 a 6,6 m/s; no alto a bola chega a ~4 m). O valor `v` viaja no evento `toss` da rede (`v` opcional, padrão 0,5).
- **Visual**: rastro de fogo na bola rápida (mais claro no smash), cenário de ginásio (arquibancada, faixa "no cap!", luzes, tapete de quadra).
- Bots com erro de posição maior para as partidas terminarem; testes ajustados.

### Rodada 4 (01/11/2026): a raquete é da mão

- Removida a auto-posição: a raquete vai só aonde a mão da pessoa manda. A força e a direção da batida seguem o movimento (velocidade, ângulo, lado) e a ajuda de leitura só corrige a altura se o golpe sairia na rede ou fora. Para não ser injusto sem a ajuda de posição, o disco da raquete ficou maior (`PP_PAD_R` 0,5) e a bola que passou do plano ainda pode ser pega (`PP_CATCH`).
- Não bate na bola a ponto de quicar na mesa (o servidor refaria o quique antes da batida chegar).

### Rodada 5 (01/11/2026): controle no estilo Ping Pong Fury

- **Mesa maior na tela**: a câmera chega mais perto e olha de cima, a mesa ocupa ~45% da largura (como no jogo de referência).
- **A raquete passeia até a rede**: o controle tem dois eixos, x (lados) e z (alcance, de 0 = fundo até `PP_REACH_NET` = quase na rede). Mouse: a raquete vai até o ponto da mesa onde o mouse aponta. Dedo: arrastar para os lados move, arrastar para a frente avança, parar recolhe devagar. Teclado: setas. A altura da raquete acompanha a bola (`ppPadStepZ`).
- **A força é o impulso**: `pad.vz` é a velocidade do avanço da raquete (até `PP_HAND_VZ_MAX`); a direção vem do movimento lateral da mão (`PP_AIM`). Mão mansa contra bola forte = bloqueio em lob; bola alta + avanço forte = smash.
- **A raquete vira para o lado** em que a mão vai (roll).
- **Saque novo**: a bola fica parada na frente da raquete (sem gravidade, a `PP_SERVE_FRONT` do plano) e o saque é a raquetada para a frente. Sem lançamento, sem barra, sem evento de rede de saque; a sala faz um saque mansinho se ninguém bater em `PP_SERVE_AUTO` s. No saque a raquete só se afasta 0,3 m do meio (onde a bola espera).
- Rede: o fluxo `ppad` agora leva `[x, y, alcance]` (era o 3º valor `smash` sem uso).

### Rodada 6 (01/11/2026)

- A bola do saque acompanha a raquete de quem saca (sacar de qualquer lugar); sem o limite de 0,3 m.
- A raquete também vai para trás do plano de espera (`PP_REACH_BACK` = 0,95 m); só o avanço recolhe sozinho no dedo.
- Câmera mais baixa, mais aberta (FOV 50) e mais perto: a mesa fica bem maior na tela; no celular deitado a câmera chega ainda mais perto.

### Rodada 7 (01/11/2026): mesa maior, câmera que se ajusta, mais golpes

- Mesa 20% maior no mundo (`PP_L` 6,3, `PP_W` 3,5, rede 0,32) e a raquete desenhada menor (raio 0,34): a raquete deixou de dominar a tela. O disco de contato continua generoso.
- **Câmera que cabe** (`fitCamera`): afasta a câmera, na mesma inclinação, só até a mesa inteira e a raquete caberem no aparelho. Resolve o celular deitado cortado (bug) em qualquer formato.
- **9 golpes** (`PpStroke`), definidos pelo jeito de jogar a raquete (avanço, lado, onde bate, altura da bola) e com efeito de verdade na bola: normal, **corte** (avanço lento, backspin), **topspin** (avanço médio), **drive** (avanço muito rápido, reto), **curva** (varrer para o lado, efeito de lado), **curta** (perto da rede, cai logo depois), **bloqueio** (mão mansa contra bola forte), **lob** (bloqueio recuado, arco alto) e **smash** (bola alta + avanço forte). O nome aparece junto da velocidade, viaja no evento `hit` (`stroke`) e a ajuda de leitura respeita a curtinha (`drop`).

### Rodada 8 (01/11/2026)

- **A raquete fica embaixo do dedo**: o toque (e o mouse) é projetado na altura atual da raquete e é para onde ela vai (x e alcance z); sem controle relativo, sem recolher sozinha. O teste e2e confere que o centro da raquete na tela cai perto do dedo.
- **Mesma visão em pé e deitado**: `fitCamera` usa a mesma inclinação e o mesmo FOV nos dois; só afasta o necessário para caber (deitado cabe mais para os lados). Ao girar o aparelho o tamanho é medido de novo (`orientationchange`/`resize`).

### Rodada 9 (01/11/2026): a bola pode sair

- A ajuda de leitura só vale para o que sai torto sem querer: batida de **força** (mão com poder ≥ 0,62, `PP_ASSIST_MAX_POWER`) não é corrigida e pode sair da mesa ou ir na rede; a **média** só ganha ajuda na altura; a **mansa** também no ângulo (`PP_ASSIST_LATERAL_POWER`). O saque (bola parada) continua sempre ajudado. Efeito de verdade (curva, topspin) continua valendo: a bola pode sair e voltar por causa dele, sem a ajuda.
- Visão mais ampla (margens maiores no `fitCamera`, FOV 56) e a raquete vai mais para trás (`PP_REACH_BACK` 1,7 m).

### Rodada 10 (01/11/2026): a raquete inclina com o lado

- A inclinação (roll) da raquete vem da posição na mesa: no meio fica reta, à esquerda inclina para a esquerda, à direita para a direita (até ~55°), como no Ping Pong Fury; o movimento da mão só soma um pouco. O cabo ficou mais curto e, sobre a mesa, a raquete sobe 0,22 m só na tela: o cabo não entra mais no tampo.

### Rodada 11 (01/11/2026): bola mal pegada e smash cronometrado

- **A subida**: se uma bola forte (`PP_POPUP_VIN` = 7,5 m/s) pega na *borda* da raquete (qualidade `edge`), o golpe vira `subida`: a bola sobe em arco (e a ajuda a faz cair na mesa do outro lado). Pegar inteira não faz nada de especial.
- **Câmera lenta** (`PP_SLOW` = 0,4): enquanto a bola está no ar depois da subida, a física anda a 40% do tempo (mesma trajetória, mais devagar), para todos os aparelhos e igual na sala (`popup`, `popupTicks`, `trailTier` entram na foto/volta no tempo).
- **Barra de tempo** (só para quem recebe): vermelho / verde / verde perfeito passando rápido (`ppSmashCursor`, por ticks, `PP_SMASH_PERIOD` = 50). Aperta com o mouse, o outro dedo, toque ou Espaço (`smashTap`); o nível vem de onde a barra estava (1 vermelho, 2 verde, 3 perfeito). Quem não aperta rebate normal.
- **O smash**: na raquetada seguinte a bola sai de cima para baixo com `PP_SMASH_V` = 12 / 17 / 24 m/s e sempre cai na mesa (quem acertou a barra merece o ponto), com **rastro roxo** (mais claro quanto melhor) e estouro roxo. O nível viaja no evento de batida (`tier`); o aperto em si é local, então a rede não muda.
- Bots também apertam a barra, mais certos no difícil (`smashErr`).

### Rodada 12 (01/11/2026)

- Mesa 15% maior: `PP_L` 7,25, `PP_W` 4, rede 0,36, `PP_PAD_X` 3,1. A câmera se ajusta sozinha (`fitCamera`), então na tela a mesa continua cabendo inteira; o que cresce é o espaço em relação à raquete e à bola.

### Rodada 13 (01/11/2026): a rede não decide a batida

- Pesquisa (Table Tennis Touch, Octo Pong, projetos de física no GitHub): a força vem da rapidez do golpe, o efeito da direção do movimento e a posição do contato desvia a bola; nenhum jogo analisado deixa a rede decidir a jogada de quem bate forte.
- `ppFixNet` (`assist.ts`): batida de força continua podendo sair (longa ou aberta), mas se a bola bateria na rede ou cairia antes dela, só a altura da saída sobe o necessário (folga de 7 cm). Numa grade de 810 batidas de teste: ~76% na mesa, 21% fora (força), 1% rede, 1% na própria mesa.

### Rodada 14 (01/11/2026): visual de campeonato (inspirado no Ping Pong Fury)

- **Cenário**: ginásio escuro (piso azul-marinho, tapete de quadra com linhas brancas e a marca "NO CAP!" no piso), placas de LED azul e vermelha em volta, torcida em silhueta escura, refletores com brilho leve. Sem as cores vivas de antes.
- **Mesa e bola**: tampo azul com degradê suave, linhas brancas, borda e pernas em azul-escuro com detalhes vermelhos; bola branca fosca com marca discreta (sem aura nem contorno).
- **Efeitos mais discretos**: faíscas pequenas e brancas, sem anéis coloridos, tremor menor, vinheta escura (não mais roxa) na câmera lenta, rastro só como borrão de movimento claro em bola rápida; o smash cronometrado mantém o rastro e as faíscas roxas.
- **Câmera**: inclinação mais baixa e FOV 42, como nas referências (a distância continua se ajustando para a mesa caber).

### Rodada 15 (01/11/2026)

- **Saque de qualquer lugar**: a ajuda de leitura agora também joga para o centro da mesa (`inward`): quem saca ou rebate de um canto precisa mandar a bola para dentro, senão ela nunca caía na mesa (era a falta e a rede do saque). Teste novo: sacar de 5 posições e 3 rapidezes nunca dá falta e a bola cai do outro lado.
- **Câmera deitada mais atrás** (`× 1,28` em telas largas): mais espaço para mexer a raquete para os lados.

### Rodada 16 (01/11/2026): a raquete cola no dedo

- A raquete (jogo de verdade) seguia com rigidez 36 e teto de 13 m/s: quando o dedo ia rápido ela ficava para trás. Agora `PP_FOLLOW_STIFF` = 55 (quase o máximo estável para o passo de 1/60 s) e `PP_FOLLOW_SPEED` = 45 m/s: um pulo de 3 m chega em menos de 0,2 s (teste). A velocidade que entra na batida continua limitada a uma mão de verdade (±10 m/s para os lados, `PP_HAND_VZ_MAX` para a frente).

### Rodada 17 (01/11/2026): visual e câmera no estilo do 3D Table Tennis, ritmo do Online Pingpang

- **Visual** (referência: Kerim-hash/3d-ping-pong, só como inspiração de cores e enquadramento): salão escuro com fundo em degradê, piso cinza-escuro, tapete vermelho, mesa azul `#1d4e9e` com linhas brancas, pernas cinza, raquetes de madeira (a sua vermelha, a do adversário preta), bola branca com faixa laranja, sombras de verdade (`shadowMap`), tom de cinema (ACES). Saiu o cenário de ginásio (arquibancada, placas de LED). A raposa continua, menor e mais ao fundo.
- **Câmera**: mesma inclinação e FOV 50 da referência, olhando para o fundo da mesa; `fitCamera` continua afastando só o que o aparelho precisar (celular em pé e deitado, computador).
- **Efeito na bola**: anel em torno do eixo do giro, vermelho = topspin, azul = corte, amarelo = efeito de lado; rastro em linha fina (o smash cronometrado mantém o rastro roxo).
- **Placar e avisos** em vidro escuro (como a referência), com o **nome de quem joga** (conta, apelido da sala ou "Você") e "Ponto de {nome}". Dica de saque no mesmo estilo.
- **Ritmo**: `PP_WORLD_SPEED` = 0,8: o mundo anda a 80% do tempo real (mesma trajetória, mais devagar), como os níveis fáceis do Online Pingpang.
- **Guia de posição** (opção do menu Esc, ligada por padrão, guardada no aparelho): para a bola que vem na sua direção, pontos finos no chão marcam por onde ela passa depois do quique (o primeiro é o do quique; os seguintes mostram o caminho se você esperar) e mudam enquanto a bola anda. Não diz onde bater; só dá a referência.

### Rodada 18 (01/11/2026): sem engasgo ao bater, ritmo um pouco mais rápido

- **Engasgo da raquete para a frente**: dois motivos. (1) A ajuda de leitura buscava jogadas demais em cada batida (média 5,8 ms e pior caso de 80 ms no computador, bem pior no celular): agora olha primeiro as alturas mais parecidas com a da mão e para na primeira boa, com menos direções e tamanhos (média 1,5 ms, pior caso 22 ms; teste de regressão). (2) O ponteiro era projetado na altura da raquete, que acompanha a bola: perto da bola o alvo "andava" sozinho (efeito de volta no tempo); agora é projetado numa altura fixa (`PP_REST_Y`).
- **Ritmo**: `PP_WORLD_SPEED` de 0,8 para 0,9.

### Rodada 19 (01/11/2026): cursor preso e ritmo cheio

- **Mouse preso no jogo** (Pointer Lock): ao clicar na mesa o cursor fica preso e a raquete anda pelo movimento do mouse (não existe mais "o mouse saiu da tela"). Esc solta o cursor e abre o menu; abrir o menu também solta. Toque e testes automáticos continuam absolutos. Teste e2e confere a trava e o movimento.
- **Ritmo**: `PP_WORLD_SPEED` = 1 (tempo real), a pedido (0,8 e 0,9 ficaram lentos).

### Rodada 20 (01/11/2026): o bot alcança as bolas curtas

- **Causa de "a bola passa por dentro da raquete do bot e cai"**: bola mansa (corte) que quica duas vezes na mesa do bot, bem perto da linha de fundo, antes de chegar ao plano da raquete dele. A previsão dele ignorava o segundo quique e ele esperava no lugar errado. Agora `ppPredictCross` sabe quantos quiques já houve na mesa (`bouncesSoFar`); quando a bola morreria antes do plano normal, o bot avança a raquete por cima da mesa (`BOT_REACH_DEEP`, 1,3 m) e bate na bola ali.
- Resultado nas partidas bot contra bot (3 jogos de 100 s): difícil 30 x 0 contra o fácil, médio 31 x 4 contra o fácil, difícil e médio parelhos. O nível difícil agora reage mais cedo, corre mais, erra menos a posição e mira sempre no canto livre. Teste novo: o difícil faz mais de 3x os pontos do fácil.

### Rodada 21 (01/11/2026): mais emoção, batida forte que vai forte, efeito que faz sentido

- **Mais rápido**: `PP_WORLD_SPEED` 1,2; teto da bola `PP_V_MAX` 14 → 22 m/s e a saída da batida agora é `0,6·entrada + 4 + 13·força da mão`: mão rápida manda a bola de verdade (drive de ~100 a 120 km/h na escala do jogo). Bots: 0,4 a 0,7 batidas por segundo.
- **Efeito com sentido**: topspin pesado quanto mais forte o drive (40 a 62 rad/s), corte mais forte na empurrada lenta, curva só varrendo para o lado. **O efeito que a bola traz agora conta** (antes o bot devolvia sempre reto): topspin que chega vira menos topspin (ou corte) na saída e faz a bola pular; corte afunda; efeito de lado desvia um pouco. Os bots calculam a devolução já com isso.
- **Curtinha (drop shot)**: toque levíssimo com a raquete no meio da mesa ou perto da rede passa a rede e cai logo depois.
- **Rastro simples**: uma linha fina e clara que só aparece com a bola rápida (o smash cronometrado mantém o roxo), sem brilho.

### Rodada 22 (02/11/2026): saque com clique, bot variado, aviso de mouse

- **Saque como nos outros jogos**: clique (ou toque, ou Espaço) lança a bola para cima e a raquetada na descida é o saque (sempre com a ajuda de leitura, de qualquer lugar da mesa). O saque de bola parada (rodada 5) segurava a bola por 0,9 s sem deixar bater e depois "piscava" (som e movimento de lançamento): era o bug do "primeiro segundo que não deixa sacar". Agora `startToss(x, v)` volta a ser o lançamento (evento `toss` na rede, com a sala lançando sozinha após `PP_SERVE_AUTO` e a bola que ninguém rebate virando falta). Dica no PC e no celular: "Clique/Toque para lançar a bola e bata nela com a raquete".
- **Aviso no PC**: enquanto o mouse não está preso, "Clique na tela para prender o mouse e jogar com mais imersão"; o primeiro clique só prende (não saca).
- **Bot variado** (`pickIntent`): a cada bola o bot sorteia o que fazer (empurrar com corte, topspin, drive, curva com efeito de lado, bloqueio em arco), com pesos por nível (o difícil ataca e varre mais), e escolhe a batida que realiza essa intenção; a força máxima de cada nível subiu (10, 14, 19 m/s) para o bot conseguir bater forte. Devolve com velocidades de ~43 a ~87 km/h e golpes variados.

### Rodada 23: saque que funciona de verdade

- Causa do "clico e não vai": com o cursor preso o navegador recusa `setPointerCapture` e a exceção abortava o clique antes do saque. Agora a captura é opcional.
- Saque assistido: com a bola subindo a raquete fica um pouco atrás dela e, na descida, avança por cima (o plano da raquete precisa atravessar a bola); a mão fora de posição não faz mais errar.
- Avisos (clique na tela e saque) menores, discretos e sem pulsar; no celular deitado ficam em uma linha, sem cobrir a mesa.
- E2E "saque com o mouse de verdade" (clique real, mouse preso) cobre o caso.

### Rodada 24: saque sem piloto automático

- Removido o auxílio que avançava a raquete sozinho na descida da bola: quem bate é a mão. Se a raquete já está em cima da bola quando ela desce, a bola bate nela (pegada fraca); com a mão atrás da bola e parada, não há batida (falta de saque).
- Testes: mão parada não saca sozinha; mão que avança saca.

### Rodada 25: online liso (mesma ideia do Fut Fox, spec 052)

- Causa do teletransporte: a batida do outro chega atrasada (ping), a partida volta no tempo e refaz até agora, e a bola desenhada pulava a distância que andou nesse atraso; além disso a bola passava reto da raquete dele enquanto a batida não chegava e depois voltava. O relógio da sala (mediana) também saltava alguns ms e a partida pulava ticks.
- Correção (`PingScene.absorb`, `scene.online`): o erro visual da bola guarda a diferença entre a tela e o novo estado e some em ~0,12 s (como o erro visual do Fut Fox); a bola que passou da raquete do outro lado espera ali até 0,3 s pela batida dele; o relógio da partida é seguido devagar (máx. 0,4 ms por quadro) em vez de pular.
- Mantido: a bola determinística nos dois aparelhos, só batida e saque viajam (já era a ideia do tick/rede do Fut Fox).
- Não medido com ping real: o ambiente de teste desenha ~1-8 quadros/s; vale conferir jogando com amigos.

### Rodada 26: bola sai da raquete dele (sem aparecer no meio do caminho)

- Pedido: ao bater do outro lado a bola "aparecia na metade do caminho". Causa: a batida chega com atraso `D` e a simulação já a tinha levado `D` adiante.
- Agora a bola desenhada recomeça onde ele bateu (`PpNetSim.ballAt`, foto do tick já refeita) e alcança a simulação em ~0,2 s (`PingScene.lag`, some a 0,7 tick por tick); o erro residual ainda desliza em ~0,12 s. Velocidades não foram mexidas, como pedido.
- E2E online com duas janelas passa; ping real ainda não foi medido.

### Rodada 27: lobby de dois times e bot na sala

- Lobby do Ping Fox! em sala igual ao do Fut Fox: dois times (Laranja e Roxo) de uma vaga, espectadores, "Entrar", "Entrar no lugar" do bot e "Virar espectador"; o líder põe "+ Bot" no lado vazio e escolhe o nível (fácil, médio, difícil) ou tira o bot. Começar só com os dois lados ocupados e quem joga pronto; uma pessoa sozinha joga contra o bot.
- Servidor (`PingRoomEngine`): vagas, bot e mensagens `pteam`/`pbot`. O bot é jogado pela própria sala (a `PpNetSim` da sala usa o lado do bot como `localPlayer`): detecta as batidas dele e as transmite em `pev` como as de uma pessoa; a raquete dele sai em `ppads`. Sem ranking.
- Testes: motor (bot saca e rebate, lobby), e2e online sozinho com bot.

### Rodada 28: saque por altura, smash que aparece mais, smash do meio que nunca erra, saque no celular

- **Saque pela altura da bola** (`ppServeTier`): lançou, a bola sobe e desce; a altura em que a raquete a pega decide o saque. Acima de 2,3 m (alto) sai fraco; entre 1,8 e 2,3 é bom; abaixo de 1,8 é o ponto certo: mais força e mais efeito. A ajuda ainda põe a bola na mesa. O nível vira o nome do saque ("SAQUE ALTO/BOM/PERFEITO") e há um medidor vertical (vermelho/amarelo/verde) com um marcador que desce com a bola, e o aviso muda para "Bata quando a bola descer até a zona verde".
- **Smash mais frequente:** o bot agora pega na borda uma bola forte de vez em quando (`mishit`: fácil 20%, médio 14%, difícil 6%) e a bola que vale a "subida" passou de 7,5 para 6 m/s. O teste de ordem dos bots passou de 3x para 2x pontos (o bot também erra de propósito).
- **Smash do verde do meio** (nível 3) nunca erra: `ppSmashFix` procura uma saída larga que caia na mesa e vá forte (teste: 100% em 400 casos). Os outros níveis acertam quase sempre (>90% e >85%), mas podem errar.
- **Celular:** só um toque (soltar sem arrastar) lança a bola; arrastar leva a raquete para outro lugar sem lançar.

### Rodada 29: o saque pega com qualquer avanço da mão

- Antes a bola só era batida se o plano da raquete atravessasse o plano dela; uma batida curta (a mão avança mas não chega até a bola) passava sem pegar. Agora, no saque, a mão indo para a frente (>1,2 m/s) pega a bola que está até 0,9 m à frente do plano da raquete, se estiver ao alcance na lateral e na altura (`PP_SERVE_REACH_SLACK`). A direção e a hora continuam sendo suas; mão parada continua sem sacar.

### Rodada 30: o saque não erra a mesa

- Bateu na bola no saque, com qualquer força, direção, altura (vermelho, amarelo ou verde): a bola cai na mesa do outro lado (teste com 3000 batidas aleatórias e com 400 saques de ponta a ponta no motor: nenhuma rede nem falta).
- A raquete do saque é mais generosa (`PP_SERVE_TOL` 1,5x o raio): perto da bola já pega. Só não bate quem tira a mão para longe da bola.

### Rodada 31: toque que lança a bola no celular

- Toque = o dedo sobe a até 26 px de onde desceu, em até 0,9 s (uma tremidinha ou ficar parado conta). Arrastar de verdade (soltar longe de onde desceu) só leva a raquete e não lança. Antes, qualquer movimento acima de 12 px já cancelava o saque. E2E com toque de verdade (CDP) cobre os dois casos.

### Rodada 32: batida forte com efeito só contra bola lenta

- Bola que chega **devagar** (< 4,5 m/s, `PP_SLOW_IN`): dá para bater forte e com efeito (topspin, de lado, da direita para a esquerda): a bola desce na mesa e sai rápida (teste: >95% caem, >60% saem a mais de 11 m/s). Bola que chega **rápida**: a batida forte não é corrigida e sai da mesa na maior parte das vezes (<60% caem), é preciso controle.

### Rodada 33: ver a velocidade da bola que vem e escala de velocidade bem aberta

- **Visual:** a etiqueta embaixo mostra o nível da bola que vem (verde = lenta, amarelo = média, vermelho = rápida; o halo em volta da bola foi tirado a pedido; `ppIncomingTier`, pela velocidade horizontal: < 4,5 lenta, < 10 média, o resto rápida) e uma etiqueta pequena embaixo ("BOLA LENTA: bata forte", "BOLA MÉDIA", "BOLA RÁPIDA"). A lenta é a hora do golpe forte com efeito (cai na mesa); nas outras, bater forte demais pode sair.
- **Velocidades** (`PP_SPEED_LADDER`, pela rapidez da mão): lenta 3,4 a 7, média 10 a 12,5, rápida 17 a 25 m/s (`PP_V_MAX` 22 -> 25). A forte sai bem mais rápida que a média e a média bem mais que a lenta.
- **Rastro:** só aparece de verdade nas rápidas (> 12 m/s), um pouco mais claro e com tom quente acima de 16 m/s.
