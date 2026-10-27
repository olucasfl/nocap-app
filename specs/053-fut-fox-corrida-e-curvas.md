# Spec 053: Fut Fox, corrida com fôlego, atrito da bola e curva do teto

Pedido do Lucas em 27/10/2026. Status: **em andamento (motor, rede e tela feitos; falta ver na tela e jogar com amigos).**

## 1. O que o Lucas pediu

1. O pulo fica como está (sem espera no pulo duplo).
2. **Correr**: Shift no computador, botão "Correr" no celular com o número do fôlego (0 a 100) em cima. Gasta correndo; ao parar ou soltar antes de esgotar o nível fica congelado por alguns segundos e depois recarrega devagar. Correr acelera mais devagar que andar. A barra só aparece quando o fôlego não está cheio. Sem fôlego, tentar correr mostra e toca um "não".
3. A bola desliza demais nas paredes: precisa de atrito.
4. O teto curva até a parede como o chão (antes era reto).

## 2. Como ficou

- **Corrida** (`body.ts`, `constants.ts`): 10,5 m/s correndo (o mortal é 11), aceleração 18 contra 40 andando. Fôlego 100, gasta 100 em 3,5 s, congela 2 s ao parar de correr, recarrega 12 por segundo. Esgotou: volta a andar, espera 2,5 s e só corre de novo com 20 ou mais (sem isso a pessoa corria "picotado" com 1 de fôlego). Só corre com direção, e não na parede, no teto nem no mortal.
- **Rede**: o terceiro número de cada passo da entrada é um conjunto de bits (1 pulo, 2 correr; o formato antigo mandava 0 ou 1, então segue valendo). O quadro leva o fôlego (coluna 18, inteiro) e os bits 64 (correndo) e 128 (esgotada) nos flags. A previsão com rollback e o preditor simples rodam a mesma conta; as outras raposas são previstas correndo pelo bit 64.
- **Tela**: `controls.ts` tem Shift (segurar) e o botão do celular (liga e desliga, desliga sozinho ao esgotar). O "não" sai na hora do aperto, no aparelho (barra treme, som `nope`), sem esperar o servidor. Barra e botão animam só `transform` e `opacity`.
- **Atrito da bola**: Coulomb na parede (`BOL_WALL_MU` 0,3: a batida de lado perde parte da velocidade que corre ao longo dela) e freio de rolagem na rampa (`BOL_RAMP_DRAG` 0,5, `BOL_RAMP_DECEL` 0,8). Com 0,45 os bots faziam quase metade dos gols; 0,3 manteve o ritmo.
- **Curva do teto**: `field.ceilDrop` é a mesma curva do chão espelhada, inclusive sobre a boca do gol (onde há muro acima). A bola usa a rampa do chão espelhada; a raposa pendurada sobe e desce a curva; a cena desenha a curva em vidro com um friso de luz.

## 3. Limites e riscos

- Cinco toques no Shift abrem as "Teclas de Aderência" do Windows; está avisado em Comandos, mas não há tecla alternativa.
- Bots não correm.
- Os valores (10,5, 3,5 s, 2 s, 12 por segundo, 20) são palpite: ajustar jogando, tudo em `constants.ts`.
- A raposa no teto junto da parede ainda não inclina com a curva (fica de cabeça para baixo, reta).
- O servidor sobe antes (Render) e o web depois; quem ainda tem a versão antiga só não corre.
