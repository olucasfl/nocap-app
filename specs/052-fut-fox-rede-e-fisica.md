# Spec 052: Fut Fox liso online, arena, física e visual (só o Fut Fox)

Pedido do Lucas em 27/10/2026. Status: **em andamento.** Escopo: somente o Fut Fox (`packages/games/src/bola`, sala `bola` da API, `apps/web/src/games/bola` e `apps/web/src/lib/bola-*`). Nada vai para a `main` até o Lucas finalizar tudo.

## 1. O que o Lucas pediu
- A bola travava e teletransportava online, mesmo com 1 ms de ping. Referência: https://github.com/JatinMunjal2k/rl-like (jogo de carro e bola no navegador, liso).
- Bola e raposa com física melhor: proporcional (bola não pode ser rápida demais para a raposa), contato raposa-bola mais bom, dar para **equilibrar a bola em cima** da raposa, arena com cantos arredondados e rampas, mapa mais bonito, gráficos e animações melhores.
- Marca no chão sob a bola quando ela voa e velocidade da bola no gol (como no rl-like).
- No fim, testar em todos os aparelhos.

## 2. Fase 1: rede (feito nesta spec)
Estudo do rl-like (27/10): o anfitrião aplica a entrada de cada jogador **no passo para o qual foi dada**; o cliente simula alguns passos **à frente** e ajusta a velocidade do relógio para manter ~3 passos de folga; cada estado do anfitrião (com o número do passo) é comparado com o que o cliente previu e, se discordam, o cliente volta ao estado e refaz com as entradas ainda não confirmadas; o erro vira um deslocamento visual que some em ~0,1 s.

Como ficou no Fut Fox:
- **Quadro** (`BolaMatch.drainFrame`): `k` (passo), `t` = hora do passo (antes era a hora do envio, até um passo errada) e, por raposa, `[.., ack, tempo do mortal, direção do mortal x, z]` mais o bit 8 (`flipHit`) nas flags. `packBolaFrame` acompanha.
- **Entrada por passo** (`BolaMatch.input`): `[primeiro passo, n, (mx x100, mz x100, pulo) x n]`. O líder guarda por passo, aplica no passo certo (repete a última se atrasar; pulo atrasado não se perde) e devolve em `ack` o último passo recebido. O formato antigo de 4 números continua valendo.
- **Previsão** (`apps/web/src/lib/bola-rollback.ts`, ligada em `BolaNetSync` com `rollback: true`): mundo próprio (`BolWorld.stepPredict`: sem fases, gol, toque nem estatística; raposas dos outros seguem a própria velocidade), histórico por passo, reconciliação a cada estado, relógio que se ajusta (folga base 2 passos, sobe quando entradas chegam tarde e com tela lenta), erro visual que some em 8/s.
- **Bola desenhada** `delay` passos atrás da previsão quando o ping é alto (até metade): perto do líder o toque responde na hora; longe, a bola não pula a cada toque de outra raposa que a previsão não viu.
- **Bola** `BOL_BALL_MAX` 26 -> 20 m/s (proporcional à raposa: 2,5x a corrida), marca no chão sob a bola e velocidade no gol.

Medido no simulador de rede (`bola-rollback.sim.test.ts`, líder real, rede com atraso/variação/perda nos dois sentidos): sem salto grande em mesma rede, Wi-Fi e internet boa; internet ruim (140 ms) ainda tem alguns. Com servidor de verdade e dois navegadores: 96% dos estados batem com a previsão. O ambiente de teste só desenha ~8 quadros/s, então a suavidade final se valida jogando.

## 3. Fase 2: arena (feito)
- `field.ts`: os cantos viram **arcos** (6 trechos por canto; raio 6 m com 2 times, 5,5 m com 3, 9 m com 4) e há uma **rampa** de raio `BOL_RAMP_R` = 2,2 m ligando o chão às paredes (um quarto de cilindro côncavo). `floorAt(x, z)` dá a altura do chão (0 no meio, sobe junto da parede, 0 na boca dos gols). Os gols continuam nas arestas retas.
- Bola (`BolWorld.rampBall`): o centro fica dentro do círculo de raio `rampR - raio da bola` em torno do eixo da rampa; passando disso é empurrada de volta e a velocidade reflete na normal da rampa (quique 0,5 só em batida forte). Sobe e curva pela parede. O plano de cada trecho de parede só vale perto do trecho (os planos dos arcos cortariam a boca do gol).
- Raposa (`moveBody`): o chão acompanha a rampa; quem estava no chão e desce acompanha (gruda até 0,3 m) em vez de "voar".
- Cena: rampa com cor e friso luminoso (cor do time nos lados do gol), muro mais alto (2,8 m), arquibancada nos arcos, sombra mole e marca no chão acompanham a rampa.

## 4. Fase 3: física da bola e da raposa (feito, falta ajuste fino jogando)
- **Equilíbrio em cima**: a calota da cabeça é achatada (`BOL_HEAD_FLAT` 0,3: a normal fica quase vertical) e há atrito de Coulomb (`BOL_FOX_MU` 0,9): a bola repousa na cabeça e acompanha a raposa que anda devagar.
- **Contato seco em batida leve** (abaixo de `BOL_FOX_REST_SPEED` 1,5 m/s não há quique nem chute extra): a bola repousa sem tremer.
- **Chute proporcional** (`BOL_HIT_BOOST` 0,4, subida pesa `BOL_HIT_LIFT` 0,35): a velocidade de encontro vezes 0,4 é somada à bola, como o impulso extra do rl-like; a bola nunca passa de 2,2x a velocidade da raposa num chute normal. Quique do chão 0,6.
- Previsão das outras raposas: o quadro leva a entrada (`ix`, `iz`) de cada corpo (pessoa ou bot) e o aparelho as simula acelerando e virando.

## 5. Fases seguintes (ordem)
4. Visual: mapa, iluminação, raposas, efeitos e animações (começou: sombra, rastro, poeira, friso).
5. Teste em todos os aparelhos (computador, celular em pé e deitado, online, treino, 2 a 4 times).

## 6. Cartaz do gol (27/10/2026, pedido do Lucas)
- Só letras, sem fundo: "GOL DE <NOME>" na cor do time que ganhou o ponto, entrando letra por letra, e a velocidade pequena embaixo ("60 KM/H"). Sem lista de eventos.
- **De quem é o gol:** de quem tocou por último sem ser do time que levou o gol, mesmo que o time dono do gol só tenha empurrado a bola para dentro (3 times: o amarelo toca, o azul põe no gol azul: é gol do amarelo; o azul ganha 1 gol contra nas estatísticas e o amarelo 1 gol). O evento `goal` traz `scorerId` = esse autor e `own` só é verdadeiro quando ninguém de outro time tocou.
- Ninguém de outro time tocou: "GOL CONTRA" (com 2 times o ponto vai para o outro time); com 3 ou 4 times ninguém pontua, o aviso diz "GOL CONTRA" e, pequeno, que ninguém pontua porque ninguém do outro time tocou.

## 7. Andar na parede e no teto (27/10/2026, pedido do Lucas)
- Correndo contra um muro (pela rampa, a pelo menos `BOL_STICK_ENTRY_SPEED` 3,5 m/s e apertando para ele) a raposa **gruda** e sobe (`BOL_WALL_SPEED` 6,5 m/s); empurrar para a parede sobe, para o lado anda ao longo dela. No alto vira **teto** (`BOL_CEILING` 9 m, agora também o teto da bola): anda de cabeça para baixo. O grude dura `BOL_STICK_MAX` 3,2 s (gasta na parede e no teto, recarrega no chão a 1,2/s) e ela cai. Pular solta (da parede empurra para longe). Bots não colam.
- Estado novo por corpo: `surf` (0 chão/ar, 1 parede, 2 teto), `stick`, normal da parede `wnx`/`wnz`; vai no quadro (bits 16 e 32 das flags e três números por raposa) e a previsão com rollback usa.
- **Câmera:** o mundo nunca vira (a câmera fica sempre com o céu em cima). Na parede ela se alinha sozinha de frente para a parede e não gira nem vai para a bola, então "para frente" na tela continua sendo "para a parede" e os controles nunca invertem; fica baixa na parede e no teto e nunca passa do teto de vidro.
- **Animação:** na parede o corpo deita de lado (pés na parede, cabeça para onde sobe ou anda); no teto fica de cabeça para baixo; ao soltar ou cair gira uma volta inteira até ficar em pé. Barrinha do grude embaixo da tela.
