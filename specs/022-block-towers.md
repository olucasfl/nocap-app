# 022 · Block Towers (empilhar com física) dentro do Block's

Status: **implementada (modo "3 vidas", solo e offline); falta jogar para calibrar a física, a velocidade e as magias.** Aprovada pelo Lucas (13/10/2026). Os outros dois modos (Corrida e Petrificar) e o online ficam para depois.

## A ideia

Mais um modo da aba **Block's**, ao lado do Block Classic. As peças (tetraminós) caem **uma por vez** sobre uma plataforma pequena, e a pessoa as **encaixa numa torre**. **Tudo tem física**: a torre balança, desmorona e as peças caem. Inspirado no Tricky Towers, mas com o visual e o som do NoCap.

## Os três modos do Block Towers (visão geral)

| Modo | Regra | Quando |
|---|---|---|
| **3 vidas** (esta spec) | Empilhe o máximo que der. Peça que cai da torre custa 1 vida; 3 vidas perdidas, acabou. Aparecem magias boas e ruins. A nota é o máximo de peças empilhadas. | **Agora, offline e solo** |
| **Petrificar** | Há uma linha-limite de altura. Se a torre encostar nela, começa um relógio de 3 segundos; se ainda estiver encostando no fim, a torre vira pedra e conta as peças empilhadas. | Futuro (offline e online) |
| **Corrida** | Há uma linha de chegada lá em cima. Quem chegar primeiro vence (segundo, terceiro...). Sem vidas. Magias para ajudar a si e atrapalhar os rivais. Todos têm o mesmo mapa, a mesma estrutura e as mesmas peças. | Futuro, **só online** |

No online (futuro) os três modos entram com sala de 2 a 4 pessoas, a mesma seed para todos e magias que atrapalham os outros.

## Decisões do Lucas

- Nome: **Block Towers**, como um modo do Block's (junto do Block Classic).
- Agora: **só o modo das 3 vidas**, **só offline**.
- **Física em tudo**: as peças têm massa, atrito e se empurram.
- **Guia lá em cima** mostrando a **próxima peça** (e a seguinte).
- Habilidades **boas e ruins**. A **vinha** (hera) gruda a peça no que ela encostar, mesmo numa posição que cairia, mas a física ainda pode derrubar tudo.
- Visual próprio, inspirado no Tricky Towers com a cara do NoCap, **animações e sons próprios**: deu certo, deu errado, perdeu vida, caiu tudo, física, encaixe e fim de jogo.

## Interpretações desta etapa (confirmar jogando)

- **Solo com ranking (14/10/2026, pedido do Lucas)**: sem sala. A partida roda no aparelho, que grava o registro de teclas; o servidor **refaz a física** pela seed (passo fixo, sem relógio) e a nota sai daí. Entra no **ranking** (quadro `towers` do Block's), no **histórico** e no **perfil**; só vale partida terminada. O recorde também fica no aparelho. Sala e online continuam para depois.
- **Magias em solo**: não há rival, então as magias boas ficam na mão para usar quando quiser, e as ruins **caem sobre você sozinhas** (é a "magia escura" vinda do jogo).
- **Nota**: o **maior número de peças que chegaram a estar empilhadas** (peças soltas e paradas na torre, sem ter caído).

## Regras do modo 3 vidas

### Mundo
- Uma **plataforma** estreita no chão (8 casas de largura, alinhadas à grade). Tudo que sair dela cai para o vazio.
- A peça nova nasce lá em cima, centralizada, e **desce sozinha**. A câmera acompanha o topo da torre.
- A física usa 1 unidade por casa, gravidade, atrito e massa pela área das peças.

### Peças
- Os 7 tetraminós (I, O, T, S, Z, J, L), sorteados em **sacolas de 7** (todas aparecem antes de repetir) a partir da seed.
- **Antes de começar** (e toda vez que volta da pausa) há uma contagem **3, 2, 1**. Há um botão de **pausa**; o menu tem **Continuar** (vem a contagem de novo), **Reiniciar partida** (recomeça do zero com peças novas e a contagem) e **Sair da partida**. Sair da aba também pausa.
- A peça nasce **bem alto** (13 casas acima da torre) e desce **devagar** (2 casas por segundo no começo, subindo um pouco a cada peça até 5). Segurar "descer" acelera.
- A pessoa move **de bloco em bloco, na hora** (cada toque anda uma casa inteira no mesmo instante, a troca de direção não espera o toque anterior terminar, e toques rápidos seguidos andam uma casa cada; segurar repete devagar; no desenho a peça só desliza até a casa nova), **gira em passos de 90°** e acelera a descida. A peça fica sempre alinhada à grade.
- **Pousou, folga curtíssima e trava:** quando a peça **pousa em cima de algo** (a torre ou a plataforma) há uma **folga de 0,18 s** em que ainda dá para **andar uma casa, uma vez só** (encaixar em lugar apertado, quase encostando, e jogar a peça no canto). Passada a folga, ou depois dessa uma vez, ela **trava**: não anda nem gira mais, só espera soltar. Na folga não dá para girar. **Encostar só de lado não trava**: descendo ao lado da torre dá para deslizar para um vão livre (por exemplo, encaixar uma peça entre duas outras); a peça nunca entra numa casa ocupada.
- **Vãos apertados:** a peça que a pessoa guia tem uma folga de 0,06 casa (as peças da torre ficam um pouco tortas, então um vão "de uma casa" pode ter 0,95). E, para **entrar de lado num vão de uma casa de altura** (como um túnel entre duas peças), se a peça estiver até 0,4 casa acima ou abaixo da altura do vão, o jogo a **encaixa na altura certa** em vez de barrar, já que ela cai sem parar e não dá para acertar a altura no olho.
- **A peça que voa nunca empurra a torre.** Enquanto a pessoa a controla, ela é guiada à parte e **para ao encostar**, sem mover nenhuma peça já colocada. Só depois de solta ela vira física, e aí o **peso dela** pode desequilibrar o lado que estava sem base (algo cai ou tomba).
- Ela fica livre (cai sozinha pela gravidade e se apoia) depois de ficar **encostada por cerca de 0,4 s**. Nesse momento nasce a próxima.
- Giro que bateria em algo tenta uma folga de uma casa para o lado; se não couber, não gira.

### Vidas e nota
- **3 vidas.** Cada peça que cai da torre (ou da plataforma) custa **1 vida**. Se várias caem de uma vez (a torre toda), perdem-se várias vidas.
- Sem vidas, a partida acaba (depois de um instante para a queda terminar de ser vista).
- **Peça "assentada"**: ficou parada na torre por cerca de 0,7 s depois de solta. Conta ponto: a nota é o **máximo de peças assentadas** (peças caídas saem da conta).
- A velocidade de descida sobe um pouco a cada peça, até um teto.

### Magias (a cada 5 peças chega uma)
Sorteadas pela seed, metade boas e metade ruins, tiradas de **sacolas embaralhadas** (nenhuma repete até as outras do mesmo tipo terem saído) e **a primeira da partida é sempre boa**.

**Boas** (você guarda **uma por vez**; só vem outra depois de usar a que está na mão; toque no botão da magia para usar):
- **Vinha**: a peça atual se gruda, ao assentar, em tudo que ela encostar (vira um bloco só, rígido).
- **Cimento**: a peça atual vira pedra ao assentar (fica imóvel para sempre).
- **Desfazer**: some com a última peça colocada, sem perder vida.
- **Vida extra**: devolve uma vida (só aparece se já perdeu alguma).

**O aviso de cada magia** (nova, usada, colou, virou pedra) fica **preso no alto da tela, fora de onde as peças caem**, e dura **9 s** (4,5 s quando a magia é usada), com uma barra que mostra quanto falta para sumir. Nunca cobre o meio do jogo.

**Encosto lateral (pedra e vinha prendem no ar).** Se a peça que desce **bate de lado** na face lateral de outra peça (ou da plataforma), porque você a empurrou contra ela, o jogo entende que ela pode ficar ali:
- Com **cimento** (na mão ou já ativado), a peça **vira pedra na hora**, presa na lateral, **mesmo sem nada embaixo**. A pedra fica estendendo a torre e ajudando.
- Com **vinha**, a peça **cola** na vizinha na hora.
- A magia é gasta e a próxima peça nasce.
- **Sem magia**, bater de lado não faz nada: a peça só segue caindo.
- Vale **só na lateral**: pousar por cima, ou bater no limite do campo, não prende.

**Ruins** (caem sobre você sozinhas, com aviso na tela):
- **Gelo**: as próximas 2 peças escorregam muito.
- **Grande**: a próxima peça vem bem maior e mais pesada.
- **Rápida**: as próximas 3 peças descem o dobro da velocidade.
- **Névoa**: por 3 peças a névoa cobre o alto da tela e esconde o guia da próxima peça.
- **Gira sozinha**: as próximas 2 peças giram sozinhas de tempos em tempos.
- **Sem giro**: as próximas 3 peças não podem girar.

## Tela (celular)
O topo da torre fica a **64% da altura da tela**, bem acima dos botões, e o tamanho da casa é o maior que cabe na largura e no caminho todo da peça. A câmera acompanha o topo da torre **devagar, com teto de velocidade**. Os botões ficam **nas pontas** (esquerda: andar; direita: girar, descer e magia) e o meio fica livre, onde a torre cresce.

## Controles
- **Celular**: barra embaixo com **esquerda**, **direita** (segurar repete), **girar**, **descer** (segurar acelera) e o botão da **magia**.
- **Computador**: setas ou A/D movem, **cima**, W ou espaço giram, **baixo** ou S desce, **E** ou Enter usam a magia, Esc pausa/sai.

## Visual (arte própria, Pop Brutal inspirada no Tricky Towers)
- **Cenário em camadas** (Canvas): céu que vai do entardecer laranja à noite com estrelas e lua conforme a torre cresce; sol e lua de contorno de tinta; montanhas, nuvens e ilhas flutuantes em formas chapadas com contorno e sombra dura; paralaxe suave com a câmera.
- **Plataforma** é uma ilha flutuante com contorno de tinta e sombra dura.
- **Peças** com o bloco biselado do Block's (as mesmas cores), brilho e contorno de tinta; peça de gelo com reflexo azul, de pedra cinza, de vinha com folhas.
- **Guia no alto**: caixas da próxima peça e da seguinte, e um **feixe vertical** sob a peça ativa mostrando onde ela cairia.
- **Mago do NoCap** sobre uma nuvem acima da torre, com os **corações de vida** ao lado; ele reage (torce, se assusta, desmaia).
- **Animações**:
  - **Deu certo**: a peça assenta com brilho, estrelinhas e "+1".
  - **Deu errado**: a peça que cai gira, deixa rastro e um flash vermelho aparece na borda.
  - **Perdeu vida**: o coração racha e despenca, a tela treme e o mago se assusta.
  - **Caiu tudo**: faixa "CAIU TUDO!", poeira, tremor forte.
  - **Física**: poeira nas batidas fortes e tremor leve proporcional ao impacto.
  - **Encaixe**: estalo e faíscas quando a peça fica apoiada.
  - **Magias**: efeitos próprios de cada uma (folhas da vinha, estalo de pedra, redemoinho do desfazer, coração da vida, gelo, névoa, etc.).
  - **Fim de jogo**: o mago desmaia, a torre escurece e aparece o cartão "SEM VIDAS".
- Só `transform`/`opacity` em animações de interface (RULES.md); o desenho do cenário e da física no Canvas respeita `prefers-reduced-motion` (sem tremor e sem partículas excessivas).

## Sons (Web Audio, sem arquivos)
Mover (tique), girar (clique), descer rápido, **encaixe** (tom por impacto), batida forte, **assentou** (sininho que sobe com a altura da torre), **peça caiu** (assobio descendente), **perdeu vida** (coração quebrando), **caiu tudo** (estrondo), vinha (cintilar), cimento (pedra), desfazer, vida extra, magia boa/ruim (selos sonoros diferentes), fim de jogo. (A música ambiente fica para depois.)

## Arquitetura
- **Motor de física próprio** em `packages/games/src/towers/physics.ts` (caixas orientadas, colisão por eixo separador, impulsos sequenciais com atrito, corpos compostos), usando só soma, subtração, multiplicação, divisão e raiz quadrada (sem sin/cos), com passo fixo: **determinístico**, o que permite o servidor refazer partidas no futuro.
- Regras do jogo em `packages/games/src/towers/game.ts` (`TowersGame`): fila de peças pela seed, vidas, magias, eventos para som e animação.
- Web: `games/blocks/towers/` (tela de jogo em Canvas, desenho, controles) e `lib/towers-audio.ts`.
- Sem servidor, sem migration e sem ranking nesta etapa.

## Fora desta etapa
Online (salas), Corrida, Petrificar, ranking e histórico do Block Towers, magias contra rivais, mais mapas.

## Testes
Física: caixa em repouso, pilha alinhada estável, pilha desalinhada que desaba, empurrão, atrito, determinismo (mesma seed, mesmas entradas, mesmo estado). Jogo: peças em sacola de 7, giro com folga, vida perdida ao cair, partida acaba com 3 vidas, assentar conta ponto, magias (vinha cola, cimento fixa, desfazer, vida extra, gelo, grande, rápida, névoa, gira sozinha, sem giro).
