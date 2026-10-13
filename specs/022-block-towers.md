# 022 · Block Towers (empilhar com física) dentro do Block's

Status: **aprovada pelo Lucas (13/10/2026); primeira etapa: só o modo "3 vidas", solo e offline.** Os outros dois modos (Corrida e Petrificar) e o online ficam para depois.

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

- **Offline**: sem sala e sem servidor. A partida roda inteira no aparelho e o **recorde fica só neste aparelho**. Ranking e histórico entram junto com o online, quando houver o motor de física conferido pelo servidor.
- **Magias em solo**: não há rival, então as magias boas ficam na mão para usar quando quiser, e as ruins **caem sobre você sozinhas** (é a "magia escura" vinda do jogo).
- **Nota**: o **maior número de peças que chegaram a estar empilhadas** (peças soltas e paradas na torre, sem ter caído).

## Regras do modo 3 vidas

### Mundo
- Uma **plataforma** estreita no chão (7 casas de largura). Tudo que sair dela cai para o vazio.
- A peça nova nasce lá em cima, centralizada, e **desce sozinha**. A câmera acompanha o topo da torre.
- A física usa 1 unidade por casa, gravidade, atrito e massa pela área das peças.

### Peças
- Os 7 tetraminós (I, O, T, S, Z, J, L), sorteados em **sacolas de 7** (todas aparecem antes de repetir) a partir da seed.
- A pessoa move para os lados, **gira em passos de 90°** e **acelera a descida**.
- A peça que desce **é física**: empurra a torre se encostar nela. Ela só fica livre (cai sozinha pela gravidade e se apoia) depois de ficar **encostada por cerca de 0,4 s**. Nesse momento nasce a próxima.
- Giro que bateria em algo tenta uma folga para o lado; se não couber, não gira.

### Vidas e nota
- **3 vidas.** Cada peça que cai da torre (ou da plataforma) custa **1 vida**. Se várias caem de uma vez (a torre toda), perdem-se várias vidas.
- Sem vidas, a partida acaba (depois de um instante para a queda terminar de ser vista).
- **Peça "assentada"**: ficou parada na torre por cerca de 0,7 s depois de solta. Conta ponto: a nota é o **máximo de peças assentadas** (peças caídas saem da conta).
- A velocidade de descida sobe um pouco a cada peça, até um teto.

### Magias (a cada 5 peças chega uma)
Sorteadas pela seed, metade boas e metade ruins.

**Boas** (ficam guardadas, até 2; toque no botão da magia para usar):
- **Vinha**: a peça atual se gruda, ao assentar, em tudo que ela encostar (vira um bloco só, rígido).
- **Cimento**: a peça atual vira pedra ao assentar (fica imóvel para sempre).
- **Desfazer**: some com a última peça colocada, sem perder vida.
- **Vida extra**: devolve uma vida (só aparece se já perdeu alguma).

**Ruins** (caem sobre você sozinhas, com aviso na tela):
- **Gelo**: as próximas 2 peças escorregam muito.
- **Grande**: a próxima peça vem bem maior e mais pesada.
- **Rápida**: as próximas 3 peças descem o dobro da velocidade.
- **Névoa**: por 3 peças a névoa cobre o alto da tela e esconde o guia da próxima peça.
- **Gira sozinha**: as próximas 2 peças giram sozinhas de tempos em tempos.
- **Sem giro**: as próximas 3 peças não podem girar.

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
Mover (tique), girar (clique), descer rápido, **encaixe** (tom por impacto), batida forte, **assentou** (sininho que sobe com a altura da torre), **peça caiu** (assobio descendente), **perdeu vida** (coração quebrando), **caiu tudo** (estrondo), vinha (cintilar), cimento (pedra), desfazer, vida extra, magia boa/ruim (selos sonoros diferentes), fim de jogo, e música ambiente leve opcional (some no mudo).

## Arquitetura
- **Motor de física próprio** em `packages/games/src/towers/physics.ts` (caixas orientadas, colisão por eixo separador, impulsos sequenciais com atrito, corpos compostos), usando só soma, subtração, multiplicação, divisão e raiz quadrada (sem sin/cos), com passo fixo: **determinístico**, o que permite o servidor refazer partidas no futuro.
- Regras do jogo em `packages/games/src/towers/game.ts` (`TowersGame`): fila de peças pela seed, vidas, magias, eventos para som e animação.
- Web: `games/blocks/towers/` (tela de jogo em Canvas, desenho, controles) e `lib/towers-audio.ts`.
- Sem servidor, sem migration e sem ranking nesta etapa.

## Fora desta etapa
Online (salas), Corrida, Petrificar, ranking e histórico do Block Towers, magias contra rivais, mais mapas.

## Testes
Física: caixa em repouso, pilha alinhada estável, pilha desalinhada que desaba, empurrão, atrito, determinismo (mesma seed, mesmas entradas, mesmo estado). Jogo: peças em sacola de 7, giro com folga, vida perdida ao cair, partida acaba com 3 vidas, assentar conta ponto, magias (vinha cola, cimento fixa, desfazer, vida extra, gelo, grande, rápida, névoa, gira sozinha, sem giro).
