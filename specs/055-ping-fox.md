# Spec 055: Ping Fox! (pingue-pongue 1x1 das raposas)

Pedido do Lucas em 01/11/2026. Status: **em andamento (fase 1: motor e treino offline; fase 2: sala online).**

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
- Rally de mais de 14 s sem resolver: ponto anulado e saque repetido (rede de segurança).

## 4. Rede (fase 2; plano)

- Mesma ideia do Fut Fox: **o líder simula** por P2P (WebRTC) e o servidor é a reserva; o cliente é um só (`PpLink`).
- **A bola só muda quando alguém bate.** Entre batidas ela é uma trajetória que os dois aparelhos calculam sozinhos (mesmo código determinístico), então não há tremida nem teletransporte. Só o **evento de batida** viaja: `{tick, posição, velocidade, spin}`. Quique, rede e ponto saem da mesma conta nos dois lados; o líder é o árbitro e manda o placar.
- **Sua batida é instantânea para você:** o aparelho de quem bate decide a própria batida (predição), manda o evento e o outro vê um instante depois (metade do ping). Ping alto só atrasa o que o adversário vê, nunca a sua raquete.
- Raquete do adversário é interpolada (como as raposas do Fut Fox); a sua é local.

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
