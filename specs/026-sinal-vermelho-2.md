# 026 · Sinal Vermelho 2 (reforma completa)

Status: **em andamento.** Pedido do Lucas (14/10/2026): o Sinal estava "feio, com poderes ruins, Vigia aleatório demais e sons chatos". Esta spec **substitui as regras de poderes, do Vigia, da escuridão e do mapa da [spec 020](020-sinal-vermelho.md)**; o que não é citado aqui continua valendo (esconderijo, obstáculos que empurram e atordoam, Clássico e Infinito, servidor refazendo a corrida, sala).

## Decisões do Lucas

- **Sai:** luz amarela (não existe no teclado), bônus e "risco e recompensa", poderes sorteados do Vigia (corvos, óleo, apagão, inversão etc.), falso aviso e olhar duplo.
- **Fica:** esconderijo (gostou), obstáculos que empurram e deixam o boneco **atordoado com estrelas na cabeça (se o Vigia olhar, perde)**, escuridão que só pode ser vista e sentida mais.
- **Entra:** mapa **flexível** (o corredor estreita e alarga), objetos que se mexem e atrapalham, **mecânica do Vigia bem melhor (a cantiga)**, **sons e visual novos, muito mais bonitos e polidos**.
- **Poderes do jogador (3 itens):** a ideia foi aprovada, mas **precisa ser pensada para o online antes de implementar**. Fica registrada (abaixo) e fora desta primeira entrega.
- **Online:** "depois vemos". A sala continua funcionando com as regras novas, sem redesenho.

## O Vigia: a cantiga

O Vigia **canta** "SI-NAL-VER-ME-LHO" de costas, e quando termina ele vira. É o "batatinha frita 1, 2, 3": aprende-se o ritmo, e o último "LHO" **esticado** é o aviso.

- **Verso** = 5 sílabas (SI, NAL, VER, ME, LHO), de costas, cada uma com um tempo `b` (o "compasso"). Pode-se andar.
- Um ciclo tem **1 a 3 versos**. Nos versos do meio o LHO é curto e ele continua de costas. No **último verso o LHO é esticado** (`hold`): é o **aviso**, que continua permitindo andar. Quando a nota acaba, ele vira e **olha**: mexeu, perdeu (com a folga de 120 ms de sempre). Depois **volta** (pode andar).
- Quantos versos vêm é o acaso justo do brinquedo (a avó que conta em silêncio): no começo 2 a 3, mais adiante 1 a 2.
- **Compasso:** de 0,62 s (fácil) a 0,34 s (difícil), com ±8% de variação por ciclo. **Aviso (`hold`)** = 2 compassos, entre 0,55 s e 1,3 s: nunca menos que isso, para dar tempo de parar.
- **Três jeitos de cantar (nada mais):** **firme** (compasso constante), **acelera** (cada sílaba 18% mais curta, o último LHO continua esticado) e **arrasta** (as duas últimas sílabas alongam). Os jeitos mais difíceis entram com a dificuldade.
- **Olhar:** de 1,3 s a 2,4 s conforme a dificuldade, com pequena variação. Pausa de 0,35 s ao voltar.
- Tudo sai da seed e do tempo (determinístico), como sempre. Sem falso aviso.
- **Para quem joga sem som:** o Vigia balança no ritmo, cada sílaba acende numa faixa embaixo dele, e o LHO esticado enche a faixa e muda de cor.

## O mapa flexível

- O corredor tem **largura variável**: parte de 15 m (meia largura 7,5 m), **estreita** em desfiladeiros de 7 a 11 m de largura (14 a 28 m de comprimento) e **alarga** em clareiras de até 18 m. A transição é suave (7 m). Os primeiros 30 m são sempre normais.
- Nos trechos estreitos há **poucos obstáculos e sempre com passagem** (vão mínimo de 1,7 m); os que se mexem de lado não entram neles. Esconderijos respeitam a largura do ponto.
- Os desfiladeiros ficam **mais frequentes e mais estreitos** com a dificuldade.
- Obstáculos que se mexem e atrapalham continuam (deslizante, vaivém, órbita, serra), junto com mola, lamaçal, esteira, gelo e ímã. **Saem** cola, inversor e turbina (comandos trocados, confusos).

## A escuridão

- Larga mais perto (Infinito 30 m; Clássico 28 m, 1,2 m menos a cada fase, mínimo 18 m) e anda **mais depressa** (base 0,5 m/s no Infinito, subindo com o tempo; 0,7 m/s no Clássico, mais 0,28 por fase). **Continua com teto de 92% da velocidade do boneco** (teste automático).
- Fica **bem visível**: névoa na borda a partir de uns 28 m, que escurece, pulsa e solta brasas conforme chega perto, com ronco grave e batimento no som.

## Visual e som: padrão de acabamento

O Lucas achou o resultado "muito amador". Metas, valendo para os três mapas:

- **Visual:** cenário em **camadas com parallax**, luz e sombra suaves (nada de cor chapada sem volume), **objetos com contorno de tinta, brilho e sombra no chão**, o Vigia como **boneco articulado** (cabeça, olhos, braços, balanço no ritmo) e obstáculos desenhados com **detalhe e variação** (cada tipo tem o seu desenho em cada mapa). Partículas (poeira, folhas, faíscas, brasas), tremor e vinheta bem dosados, animação de pisada do boneco, atordoamento e vitória/derrota caprichados. Pop Brutal nas telas por cima (HUD).
- **Som:** a **cantiga é a trilha**: melodia própria por mapa (caixinha de música, marimba e sino, uma escala por mapa), sintetizada com envelope e reverberação gerada; o LHO esticado sobe de tom e vibra. Cama sonora ambiente por mapa, passos que variam, pancadas e atordoamento com corpo, ronco/batimento da escuridão e avisos curtos. **Mixagem com compressor/limitador e sem zumbido repetitivo**; tudo respeita o botão de mudo.
- Nada de emoji; animações só em `transform`/`opacity` nas telas de interface (o Canvas pode desenhar livremente).

## Itens do jogador (registrado, ainda não implementado)

Três itens que a pessoa **pega no caminho e usa quando quiser** (carrega 1 por vez): **Sombra** (fica escondido em qualquer lugar por 2 s), **Congelar** (o Vigia fica +1,5 s de costas) e **Impulso** (corre mais rápido por 2 s). A aprovar o desenho para o online: no online o item de um jogador afeta só ele, ou o Vigia (congelar) afeta todos? Decidir junto com a sala.

## Plano (em ordem)

1. **Núcleo:** nova cantiga, sem poderes, largura variável, escuridão mais perta e rápida, testes (e a sala/servidor continuam compilando e passando).
2. **Tela e som novos:** renderização refeita do zero (cenário, Vigia, boneco, obstáculos, escuridão, efeitos) e sons novos. É a parte maior.
3. **Itens**, depois de decidir o online.
4. Calibrar jogando.
