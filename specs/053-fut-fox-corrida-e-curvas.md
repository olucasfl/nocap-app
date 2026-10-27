# Spec 053: Fut Fox, corrida com fôlego, atrito da bola e curva do teto

Pedido do Lucas em 27/10/2026. Status: **em andamento (motor, rede e tela feitos; falta ver na tela e jogar com amigos).**

## 1. O que o Lucas pediu

1. O pulo fica como está (sem espera no pulo duplo).
2. **Correr**: Shift no computador, botão "Correr" no celular com o número do fôlego (0 a 100) em cima. Gasta correndo; ao parar ou soltar antes de esgotar o nível fica congelado por alguns segundos e depois recarrega devagar. Correr acelera mais devagar que andar. A barra só aparece quando o fôlego não está cheio. Sem fôlego, tentar correr mostra e toca um "não".
3. A bola desliza demais nas paredes: precisa de atrito.
4. O teto curva até a parede como o chão (antes era reto).

## 2. Como ficou

- **Corrida** (`body.ts`, `constants.ts`): 12,2 m/s correndo (o mortal é 10: o pulo duplo com direção é mais lento que correr), aceleração 18 contra 40 andando. Fôlego 100, gasta 100 em 2,8 s, congela 2 s ao parar de correr, recarrega 16 por segundo. Esgotou: volta a andar, espera 2,5 s e só corre de novo com 20 ou mais (sem isso a pessoa corria "picotado" com 1 de fôlego). Só corre com direção, e não na parede, no teto nem no mortal.
- **Rede**: o terceiro número de cada passo da entrada é um conjunto de bits (1 pulo, 2 correr; o formato antigo mandava 0 ou 1, então segue valendo). O quadro leva o fôlego (coluna 18, inteiro) e os bits 64 (correndo) e 128 (esgotada) nos flags. A previsão com rollback e o preditor simples rodam a mesma conta; as outras raposas são previstas correndo pelo bit 64.
- **Tela**: `controls.ts` tem Shift (segurar) e o botão do celular (segurando corre, soltando para, como o Shift). O "não" sai na hora do aperto, no aparelho (barra treme, som `nope`), sem esperar o servidor. Barra e botão animam só `transform` e `opacity`.
- **Atrito da bola**: Coulomb na parede (`BOL_WALL_MU` 0,3: a batida de lado perde parte da velocidade que corre ao longo dela) e freio de rolagem na rampa (`BOL_RAMP_DRAG` 0,5, `BOL_RAMP_DECEL` 0,8). Com 0,45 os bots faziam quase metade dos gols; 0,3 manteve o ritmo.
- **Curva do teto**: `field.ceilDrop` é a mesma curva do chão espelhada, inclusive sobre a boca do gol (onde há muro acima). A bola usa a rampa do chão espelhada; a raposa pendurada sobe e desce a curva; a cena desenha a curva em vidro com um friso de luz.

## 2b. Tela estilo Rocket League e rastro (27/10/2026)

- **Embaixo à esquerda (computador):** "CÂMERA DA BOLA" ou "CÂMERA LIVRE" em texto solto, com "Pressione F para alternar". No celular segue o botão de antes.
- **Embaixo à direita (computador):** medidor circular do fôlego, sempre visível, com o número no meio e a tecla Shift. É um anel de 28 segmentos (cada um só liga e desliga a opacidade, para respeitar "só transform e opacity"); fica vermelho esgotado e treme ao tentar correr sem fôlego. No celular, o número fica em cima do botão Correr.
- **Rastro:** enquanto corre, a raposa deixa um fio de luz na cor do time (brilhos que somem em 0,5 s); as outras raposas aparecem correndo pelo bit 64 do quadro. Desligado com movimento reduzido.
- Corrida a 11,5 m/s, depois 12,2 (o Lucas pediu "um pouco mais rápido, mas não muito"; o mortal fica em 11 e vale pelo chute).

## 2c. Bots (27/10/2026)

- **Boost:** o bot corre quando está longe do ponto aonde vai (6,5 m para quem vai na bola, 11 m para o apoio, só com tiro vindo para o goleiro), só com fôlego de sobra (28 para quem vai na bola, 60 para o apoio) e para ao chegar perto ou no fim dele. A previsão de quem chega primeiro conta a corrida. Medido em 4 partidas de 2 min no 3x3: correm ~16% do tempo e só ~5% do tempo ficam esgotados.
- **Parede:** `BolInput.climb` libera o bot a colar (uma pessoa cola sempre que corre contra o muro; o bot só quando decidiu). Quem vai na bola planeja subir (`planWall`) quando a bola vai passar alta (3,6 a 7,2 m) a menos de 3,2 m de uma parede e dá tempo de chegar; corre contra a parede, sobe até a altura da bola, anda ao longo dela até ficar de frente e pula, tentando o mortal. Se o plano vence, solta e cai. Um plano a cada 4 s no máximo.
- Os gols dos bots caíram (a bola freia na parede e eles gastam fôlego), mas seguem acima do bot antigo (~1,6 por partida de 2 min).

## 2d. Desmorona!: comandos só na primeira vez (27/10/2026)

Os comandos antes apareciam o jogo todo (uma caixa de teclas fixa) e voltavam a cada partida (a dica só valia como vista ao tocar em "Entendi"). Agora a dica aparece só na primeira partida da pessoa, durante a contagem de 3 s, e vale como vista assim que aparece (`GameTips markOnShow`); a caixa fixa foi removida. Para rever: Config. (Esc) e Controles.

## 2e. Desmorona!: câmera igual à solta do Fut Fox (27/10/2026)

A câmera do Desmorona! agora orbita a raposa como a câmera solta do Fut Fox: 8,6 m de distância, acompanha com a mesma suavidade, giro e altura (0,12 a 1,25 rad, começa em 0,5) escolhidos pela pessoa (mouse, dedo na metade direita, Q e E) e campo de visão de 60 graus (78 em tela em pé). Um quadro nunca gira a câmera além do limite (mesmo cuidado do Fut Fox). As camadas acima da raposa continuam ficando transparentes.

## 2f. Desmorona!: bots, câmera e Esc ao espectar (27/10/2026)

- **Bots:** viviam ~35 s antes da primeira morte porque corriam a toda velocidade e cada ladrilho pisado some em 0,85 s (gastavam o chão 3 vezes mais rápido que o preciso). O planejador (1 s à frente, ~65 planos por decisão) agora escolhe também a velocidade (devagar ou correndo), cobra 1,1 por ladrilho pisado, 9 por camada perdida, desvalora o chão onde os outros estão e cobra 5,5 por pulo (sem isso eles descobrem que pular sem parar evita pisar e ficam 83% do tempo no ar). Errar de propósito diminuiu (skill 0,93 a 0,99). Medido em 4 bots: primeira morte aos ~90 a 107 s (antes 35 s), partida de ~100 a 120 s, 0,3 a 0,4 pulos por segundo, 20 a 26% do tempo no ar.
- **Câmera:** a conta de copiar do Fut Fox "olhar para 1 + 0,85 x altura" só serve perto de y = 0; nas camadas de baixo (altura negativa) a câmera olhava vários metros acima da raposa e ela ia para a borda da tela. Agora olha sempre 1 m acima do foco.
- **Esc ao espectar:** ao morrer o jogo solta o mouse (para os botões de espectar) e o atalho do Esc exigia o mouse preso; agora `spectating` também vale.

## 2g. Fut Fox: câmera na bola (27/10/2026)

- **Na parede** a câmera na bola era ignorada (ficava só de frente para a parede, sem a bola). Agora ela continua de frente para a parede (o "para frente" segue subindo, então os controles não invertem) mas gira até ~60 graus para o lado da bola e a mira tende para ela (até 30%), com memória do lado quando a bola fica atrás de quem sobe (não pula de um lado a outro).
- **No chão**: o giro agora tem velocidade e aceleração limitadas (começa e para sem tranco) e a força do giro cresce sem degrau com a distância da bola (antes havia um degrau em 1,4 m); a bola que a câmera segue é levemente suavizada (correção da rede e quique não balançam), e a altura e a mira (inclusive o "a bola nunca sai do quadro") são suavizadas.

## 2h. Desmorona!: ondas de queda com aviso (27/10/2026)

Pedido do Lucas: depois de um tempo, com gente ainda jogando, começam ondas de queda com aviso prévio (nada brusco, para ninguém morrer por sorte ou azar), mostrando os ladrilhos que vão quebrar para dar tempo de fugir, de um jeito legal e interativo.

- **Quando:** a 1ª onda marca ladrilhos aos 32 s; as seguintes vêm a cada 24 s (encurta 8% por onda, mínimo 12 s), contando do fim da anterior (nunca duas ao mesmo tempo). Passados 130 s toda onda leva a camada inteira (a partida nunca passa de ~4 min).
- **Aviso:** os ladrilhos marcados ficam laranja e vão ficando vermelhos, piscando cada vez mais rápido, por 3,4 s na 1ª onda (encurta 0,25 s por onda até 2,2 s). Na tela: "ONDA DE QUEDA", o que fazer ("Uma fatia vai cair: saia das áreas vermelhas") e uma barra que esvazia até cair; sirene ao marcar, toques aos 3, 2 e 1 s e meio segundo antes (o último mais agudo), estrondo e tremida ao cair.
- **Formatos** (sorteados pela semente, sem repetir o anterior; a 1ª é sempre uma fatia): **fatia** (arco de 90° que cresce 25° por onda, o centro nunca entra), **metade** (um lado do chão), **anel** (faixa de 2 anéis: fugir para dentro ou para fora), **chuva** (blocos de 7 ladrilhos que caem em momentos diferentes), **borda** (os anéis de fora; sobra o miolo).
- **Justiça:** uma onda comum marca no máximo 62% dos ladrilhos da camada (sempre sobra chão e nunca a camada toda). Os ladrilhos caem em ondulação (0,8 s) depois do aviso, nunca durante ele. Quem cai vai para a camada de baixo; só morre se for a última (lava).
- **Em todas as camadas com gente:** a onda atinge cada camada com raposa viva (antes só a mais alta, e bots e pessoas que já desceram ficavam de fora). O texto do aviso é o da camada em que você está.
- **Bots:** fogem das áreas marcadas (penalidade crescente por estar em ladrilho marcado e pelo caminho até o chão firme mais perto; ladrilho marcado não conta como saída). Medido: menos de 30% estão em cima de ladrilho marcado quando ele começa a cair.
- **Rede:** a onda só usa a semente e a geometria, então todo aparelho marca os mesmos ladrilhos na mesma hora (a única dependência é em que camadas há raposas, que vem dos relatos de posição).
- Código: `world.ts` (`updateWaves`, `shapeWave`, eventos `wave` e `wavefall`, `DsmWaveInfo`), `constants.ts` (`DSM_WAVE_*`), `bots.ts`, `scene.ts` (cor pulsante), `DesmoronaPlay.tsx` (aviso e sons) e `desmorona.css`.

## 2i. Desmorona!: bots mais rápidos e caçadores (27/10/2026)

- **Mais rápidos:** as velocidades do plano passaram de 0,45 e 1 para 0,85 e 1 e o custo por ladrilho pisado caiu de 1,1 para 0,5: média de ~4,75 m/s (77% dos 6,2 da raposa; antes ~3,5). As primeiras mortes de bot vêm aos ~65 s (eram 90 a 107 s com o planejador lento e 35 s no original).
- **Caçadores:** cada bot decide, a cada 2,5 a 6 s, se caça (35% a 65% de chance, conforme o perfil); fora da caçada só aproveita a chance (30% do interesse). Caçando, o bot corre para onde o alvo vai estar (passar na frente), prefere a pessoa (peso 2,2 no empurrão, escolha do alvo e aproximação) e valoriza muito o empurrão que joga o outro onde não há chão (3 pontos, 15 se cai). Medido: ~30 empurrões em uma "pessoa" em ~80 s e ela morre antes dos bots em 2 de 3 partidas.
- Teste `bots caçadores` em `desmorona.test.ts`.

## 2j. Fut Fox: velocidades e bot preso na parede (27/10/2026)

- **Velocidades:** corrida 12,2 m/s (era 11,5) e mortal (pulo duplo com direção) 10 m/s (era 11): o mortal agora é mais lento que correr.
- **Bug do bot preso:** o plano de subir na parede só vencia quando o bot estava colado; se não conseguia colar (sem grude ou sem velocidade) ele ficava empurrando o muro para sempre. Agora o plano vence também no chão. Além disso, há uma proteção geral: querendo andar e sem sair do lugar por ~1,2 s (muro, canto, rede), o bot se afasta para o meio do campo, de lado, por 0,9 s. Teste em `preso.test.ts` (reproduz o caso e mede janelas de 3 s paradas).

## 2k. Fut Fox: tela de fim de partida (27/10/2026)

Pedido do Lucas: uma tela final mais bonita, intuitiva e organizada, com o placar animado de cada um, estatísticas bem organizadas, "jogar de novo" mostrando quem já topou e quem não, e botões de sair e encerrar.

- **`BolaFinal.tsx`** (+ `bola-final.css`), a mesma tela no treino e na sala:
  - **Título animado:** "Vitória!", "Derrota", "Empate!" ou "Time X venceu" (espectador), com as letras entrando uma a uma, e o cartão na cor do resultado.
  - **Placar dos times:** posição (empate divide), nome, o número subindo de 0 até o placar, barra de posse de bola, "seu time" e "vencedor".
  - **Destaques:** Artilheiro, Garçom (assistências) e Mais toques.
  - **Estatísticas por time:** uma linha por raposa com G, A, GC, T e M (legenda embaixo), você em amarelo, bots marcados e o **MVP** (gols pesam mais, depois assistências, mortais e toques; gol contra tira).
  - **Sala:** painel "Jogar de novo?" com a contagem "x de n", uma barra e a lista de cada pessoa (cor do time, líder, você) com "Quer jogar", "Pensando…" ou "Saiu". Botões: Jogar de novo (vira "Mudei de ideia"), Sair da sala e, para o líder, Encerrar sala (com confirmação). Quando todos votam a sala volta ao lobby, como antes.
  - **Treino:** "Jogar de novo" e "Voltar".
- **Ligações:** na sala o Fut Fox continua na tela da partida também na fase `final` (`Room.tsx`), então as estatísticas vêm do mundo que o aparelho já tem (o servidor pede o último quadro de estatísticas ao acabar) e o placar e o vencedor, do snapshot. O voto usa o mesmo `vote` da tela de pódio das outras salas.
- **Celular:** em pé o painel de jogar de novo e os botões vêm logo depois do placar (as estatísticas rolam por baixo); deitado, tudo em duas colunas. Tudo que anima é só `transform` e `opacity`, e com movimento reduzido nada anima.

## 2l. "Vire a tela" no celular em pé (27/10/2026)

No Fut Fox e no Desmorona!, ao começar cada partida em celular com a tela em pé aparece, no alto e sem pegar toque, "Vire a tela na horizontal para ter uma imersão melhor" (`components/RotateHint.tsx`): não cobre o tutorial nem a largada, some sozinho em 7 s e na hora em que a tela é virada. Não aparece no computador nem com o celular deitado.

## 2m. Fut Fox no celular: botões, dica do joystick e câmera (27/10/2026)

- **Botões novos** (só em tela de toque; o computador não mudou): Pular (amarelo, 94 px), Correr (azul, 72 px, com o número do fôlego numa pílula em cima; escurece correndo e fica vermelho esgotado) e Câmera (pílula "CÂMERA / BOLA" ou "LIVRE") agrupados no arco do polegar direito: Pular no canto, Correr à esquerda dele e Câmera acima. Estilo Pop Brutal: borda grossa, sombra dura, afunda ao apertar. O texto de Correr agora fica centrado (o botão é uma coluna flex com ícone e rótulo). Deitado, tudo encolhe (80 e 68 px).
- **Dica do joystick:** antes da primeira vez que a pessoa mexe nesta partida, um cartão à esquerda mostra um joystick tracejado com o botão passeando e o texto "MEXA AQUI / para mover sua raposa"; some ao primeiro toque. Fica por baixo do tutorial.
- **Câmera com a raposa andando:** o botão trocava só no clique, que o celular perde quando outro dedo está no joystick. Agora troca no instante do toque (pointerdown) e o clique que vem depois não troca de novo (janela de 700 ms). Testado: com o dedo apertado no joystick, a câmera trocou de Bola para Livre.

## 3. Limites e riscos

- Cinco toques no Shift abrem as "Teclas de Aderência" do Windows; está avisado em Comandos, mas não há tecla alternativa.
- Os bots só sobem na parede atrás de bola alta junto dela; ainda não usam o teto.
- Os valores (10,5, 2,8 s, 2 s, 12 por segundo, 20) são palpite: ajustar jogando, tudo em `constants.ts`.
- A raposa no teto junto da parede ainda não inclina com a curva (fica de cabeça para baixo, reta).
- O servidor sobe antes (Render) e o web depois; quem ainda tem a versão antiga só não corre.
