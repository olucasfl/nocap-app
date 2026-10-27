# Spec 053: Fut Fox, corrida com fôlego, atrito da bola e curva do teto

Pedido do Lucas em 27/10/2026. Status: **em andamento (motor, rede e tela feitos; falta ver na tela e jogar com amigos).**

## 1. O que o Lucas pediu

1. O pulo fica como está (sem espera no pulo duplo).
2. **Correr**: Shift no computador, botão "Correr" no celular com o número do fôlego (0 a 100) em cima. Gasta correndo; ao parar ou soltar antes de esgotar o nível fica congelado por alguns segundos e depois recarrega devagar. Correr acelera mais devagar que andar. A barra só aparece quando o fôlego não está cheio. Sem fôlego, tentar correr mostra e toca um "não".
3. A bola desliza demais nas paredes: precisa de atrito.
4. O teto curva até a parede como o chão (antes era reto).

## 2. Como ficou

- **Corrida** (`body.ts`, `constants.ts`): 11,5 m/s correndo (o mortal é 11), aceleração 18 contra 40 andando. Fôlego 100, gasta 100 em 2,8 s, congela 2 s ao parar de correr, recarrega 16 por segundo. Esgotou: volta a andar, espera 2,5 s e só corre de novo com 20 ou mais (sem isso a pessoa corria "picotado" com 1 de fôlego). Só corre com direção, e não na parede, no teto nem no mortal.
- **Rede**: o terceiro número de cada passo da entrada é um conjunto de bits (1 pulo, 2 correr; o formato antigo mandava 0 ou 1, então segue valendo). O quadro leva o fôlego (coluna 18, inteiro) e os bits 64 (correndo) e 128 (esgotada) nos flags. A previsão com rollback e o preditor simples rodam a mesma conta; as outras raposas são previstas correndo pelo bit 64.
- **Tela**: `controls.ts` tem Shift (segurar) e o botão do celular (liga e desliga, desliga sozinho ao esgotar). O "não" sai na hora do aperto, no aparelho (barra treme, som `nope`), sem esperar o servidor. Barra e botão animam só `transform` e `opacity`.
- **Atrito da bola**: Coulomb na parede (`BOL_WALL_MU` 0,3: a batida de lado perde parte da velocidade que corre ao longo dela) e freio de rolagem na rampa (`BOL_RAMP_DRAG` 0,5, `BOL_RAMP_DECEL` 0,8). Com 0,45 os bots faziam quase metade dos gols; 0,3 manteve o ritmo.
- **Curva do teto**: `field.ceilDrop` é a mesma curva do chão espelhada, inclusive sobre a boca do gol (onde há muro acima). A bola usa a rampa do chão espelhada; a raposa pendurada sobe e desce a curva; a cena desenha a curva em vidro com um friso de luz.

## 2b. Tela estilo Rocket League e rastro (27/10/2026)

- **Embaixo à esquerda (computador):** "CÂMERA DA BOLA" ou "CÂMERA LIVRE" em texto solto, com "Pressione F para alternar". No celular segue o botão de antes.
- **Embaixo à direita (computador):** medidor circular do fôlego, sempre visível, com o número no meio e a tecla Shift. É um anel de 28 segmentos (cada um só liga e desliga a opacidade, para respeitar "só transform e opacity"); fica vermelho esgotado e treme ao tentar correr sem fôlego. No celular, o número fica em cima do botão Correr.
- **Rastro:** enquanto corre, a raposa deixa um fio de luz na cor do time (brilhos que somem em 0,5 s); as outras raposas aparecem correndo pelo bit 64 do quadro. Desligado com movimento reduzido.
- Corrida a 11,5 m/s (o Lucas pediu "um pouco mais rápido, mas não muito"; o mortal fica em 11 e vale pelo chute).

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

## 3. Limites e riscos

- Cinco toques no Shift abrem as "Teclas de Aderência" do Windows; está avisado em Comandos, mas não há tecla alternativa.
- Os bots só sobem na parede atrás de bola alta junto dela; ainda não usam o teto.
- Os valores (10,5, 2,8 s, 2 s, 12 por segundo, 20) são palpite: ajustar jogando, tudo em `constants.ts`.
- A raposa no teto junto da parede ainda não inclina com a curva (fica de cabeça para baixo, reta).
- O servidor sobe antes (Render) e o web depois; quem ainda tem a versão antiga só não corre.
