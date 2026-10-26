# Spec 046: Bola Maluca! (futebol de raposas, 2 a 4 times)

Pedido do Lucas em 26/10/2026. Status: **rascunho; aguarda o "pode começar" da Fase 1.** Mira Maluca! (jogo de sniper) fica para a spec 047, depois deste.

## 1. O que o Lucas pediu

1. Futebol 3D com as raposas de boné, dentro do **Fox Cap!**, com **bola de física boa**.
2. **Formatos:** 1x1, 1x1x1, 1x1x1x1 (até 4 gols), e com **mapa personalizável**: 2x2, 2x2x2, 2x2x2x2, 3x3, 3x3x3, 3x3x3x3. Número quebrado é aceito.
3. Antes da partida, o jogo **sugere o formato pela quantidade de pessoas** na sala, mas o **líder pode trocar**.
4. Ao escolher um formato, aparece a **escolha de times**: vermelho, azul, amarelo e verde. **Verde só existe com 4 times**; com 3, só vermelho, azul e amarelo. Cada pessoa entra num time ou em **Espectador**.
5. A sala aceita **até 15 pessoas**; jogam no máximo **12** (3x3x3x3), o resto assiste.
6. **Sem ranking, nem online nem offline.** Sem histórico; o placar não é gravado.
7. **Câmera individual**, mais próxima da raposa. Erros sempre **visuais e intuitivos**.
8. Treino offline com bots: o Lucas escolhe **a quantidade de bots e o modo**.

## 2. Decisões do Lucas (26/10/2026)

- **Gol:** vale para o time de **quem tocou por último** na bola, mesmo que seja gol contra (a regra completa está em 4.2). Toque tem que ser real: sem toque invisível.
- Mapa fechado por **paredes**; a bola nunca sai. Após o gol: **3 s** de contagem, bola no centro, todos voltam às posições padrão.
- **Bola parada por 30 s** reaparece no centro.
- 5 pessoas num 2x2 **não** viram 3x2: só em 3x3. O **líder pode adicionar bots** em cada time para completar. Bot joga de verdade, sem exagero.
- **Chute estilo Rocket League:** pulo e pulo duplo; com direção (frente, trás, lados) o segundo pulo vira um **mortal** nessa direção que chuta a bola.
- **Empate no fim do tempo:** bola ao centro, 3 s, posições padrão, **gol de ouro** (quem fizer ganha).
- **Relógio crescente** (conta para cima). Aos 30 min a partida pode ser encerrada, com **aviso prévio** do tempo restante.
- Quem **sai de um time no meio da partida** vira espectador e pode **voltar a um time**; se houver **bot**, a pessoa assume o lugar dele **automaticamente** no time escolhido. Dá para entrar num time desfalcado.

## 3. Física: própria, não biblioteca (resposta à pergunta)

**Recomendo física própria**, em `packages/games/src/bola`, porque:

- O mundo é simples: **uma esfera, uma raposa redonda (cilindro/cápsula), um chão plano e paredes**. Não precisa de motor de física.
- Roda **igual no servidor e nos testes** (determinístico, vitest), e fica dentro da regra "lógica de jogo só em `packages/games`".
- Biblioteca (Rapier) é **dependência fora da stack** (RULES.md: perguntar antes), pesa no bundle do celular e tem determinismo ruim entre plataformas.
- Controle total do que importa: **colisão contínua** (sem a bola atravessar a raposa ou a parede em velocidade alta) e o **toque rastreável**.

Se algum dia a física ficar complexa demais (rampas, vários objetos), reavaliamos.

## 4. Regras do jogo

### 4.1 Formatos e capacidade

| Formato | Times | Jogadores | Gols |
|---|---|---|---|
| 1x1 a 3x3 | 2 | 2 a 6 | 2 |
| 1x1x1 a 3x3x3 | 3 | 3 a 9 | 3 |
| 1x1x1x1 a 3x3x3x3 | 4 | 4 a 12 | 4 |

- Sala: **15 pessoas** no máximo (12 jogando + 3 de espectador).
- A **sugestão automática** olha a quantidade de pessoas e propõe o formato que melhor encaixa (ex.: 4 pessoas: 2x2; 6: 3x3 ou 2x2x2). O líder troca livremente.
- **Para começar:** pelo menos **dois times** com ao menos 1 jogador (humano ou bot). Se não, o botão mostra o porquê.

### 4.2 Pontuação

- **Quem tocou por último** na bola leva o crédito, **desde que não seja do time que levou o gol**. Gol contra (último toque do time que levou o gol): o ponto vai para o time que tocou na bola por último entre os outros (decisão do Lucas, 26/10/2026: "quem tocou por último sem ser o time que levou o gol"); o autor do gol contra ganha um gol contra nas estatísticas.
- **Sem ninguém de fora que tenha tocado** (decisão do Lucas em 26/10/2026): com 2 times, o gol vira **gol contra do dono do gol** e o ponto vai para o outro time; com 3 ou 4 times não há como decidir, então **ninguém pontua** e a bola volta ao centro com a contagem. A tela mostra "GOL CONTRA DO TIME X" ou "SEM GOL".
- Vence quem tiver **mais gols** quando o relógio de 30 min acabar ou quando o **líder encerrar**. Empate: gol de ouro (seção 2).
- Os gols de cada time aparecem no HUD, com o nome de quem marcou (**feed de gols**, texto, sem emoji).

### 4.3 Fluxo da partida

1. **Contagem de 3 s** ("posições") com todos nas posições padrão e a bola no centro.
2. Jogo. Relógio **crescendo** (mm:ss) no HUD.
3. **Gol:** pausa de 3 s, recomeço no centro. A raposa e a bola voltam às posições padrão.
4. **Bola parada 30 s** (velocidade quase zero): reaparece no centro com a mesma contagem.
5. **Aos 25 min:** aviso "A partida acaba em 5 minutos". Aos **29 min**, "Falta 1 minuto". Aos 30, encerra (ou gol de ouro se empatada).
6. **Fim:** tela de resultado (placar por time, quem marcou), "Jogar de novo" (voto, como nos outros jogos).

### 4.4 Chute (Rocket League simplificado)

- Mover: W A S D / joystick. **Pulo:** barra de espaço / botão.
- **Segundo pulo (pulo duplo):** se houver direção pressionada, a raposa faz um **mortal** nessa direção (frente, trás, esquerda, direita) e **chuta a bola que estiver no alcance** durante o mortal. Sem direção, é um pulo duplo reto.
- Só o **mortal** (e o contato do corpo, mais fraco) empurra a bola com força; empurrar rolando é um toque leve. A força do chute vem da velocidade e do contato (ver 5).
- No celular: joystick + botão Pulo (toque duplo = pulo duplo). Não há boost.

### 4.5 Espectador e troca de time

- Em qualquer momento (lobby ou partida) a pessoa pode ir de **time → Espectador** e de **Espectador → time**.
- Quem vai para um time **com bot** assume o lugar dele **na hora** (o bot some). Time cheio fica **cinza com "Time cheio"** e o toque mostra o motivo.
- Time **desfalcado** (menos gente que os outros): o líder pode enchê-lo de bots; qualquer pessoa pode entrar nele.
- O espectador vê a partida com **câmera livre** (segue a bola, ou escolhe uma raposa).

## 5. Física e hitbox (sem toque invisível)

- **Bola:** esfera de raio `BALL_R`, gravidade, quique com perda de energia, atrito de rolar, velocidade máxima. **Colisão contínua** (varredura): o servidor avança em passos pequenos e resolve o primeiro contato do passo, para nunca atravessar parede nem raposa.
- **Raposa:** cápsula (raio `FOX_R`, altura `FOX_H`) que **só encosta na bola quando há sobreposição geométrica real** no servidor. Não há "alcance" generoso nem toque por proximidade.
- **Último toque** (`lastTouch`): atualizado **somente** quando o servidor detecta o contato ou o chute e **a raposa estava realmente na região da bola naquele passo**. Cada toque guarda `{jogador, tempo}`. Um toque só vale se a bola **mudou de velocidade** (impulso acima de um limite mínimo), para não contar encostadinha parada.
- **Chute (mortal):** durante a janela do mortal (~350 ms), o contato real aplica um impulso na direção do mortal; fora da janela, só o contato do corpo.
- **Autoridade:** o **servidor** simula a bola e as colisões a **30 Hz** e manda o estado a 20 Hz. O cliente **interpola** a bola (com ~100 ms de atraso proposital) e **prevê** o movimento da própria raposa. O cliente **nunca** diz "toquei": só manda a entrada (andar, pulo, pulo duplo + direção).
- **Reconciliação:** se a posição da raposa prevista diverge do servidor além de uma margem, corrige com suavização (sem teletransporte).
- **Testes** (vitest, no mesmo commit): a bola nunca atravessa parede/raposa em velocidade máxima; gol sempre dá crédito ao último toque; gol contra conta para quem tocou; bola parada 30 s reaparece; empate vai para gol de ouro; troca de time assume bot; toque a 1 mm de distância não conta.

## 6. Campo e gols

- **Campo:** uma "arena" fechada por paredes (a bola nunca sai). Formato por times:
  - 2 times: retângulo, gols nas pontas.
  - 3 times: **hexágono** (ou triângulo largo), um gol em três lados alternados.
  - 4 times: **quadrado**, um gol em cada lado.
- O **tamanho** cresce com a quantidade de jogadores (1x1 menor, 3x3x3x3 maior). Campo ampliado em 26/10/2026 (2 times: de 31x20 m a 59x38 m; arquibancada, vidro, holofotes e redes).
- **Mapa personalizável** (só em sala personalizada, **fora de ranking**, o que aqui já é verdade para todos): tamanho do campo, tamanho da bola, tamanho do gol, tempo máximo e gols para ganhar, com limites seguros para não quebrar a física.
- Posições padrão: cada raposa tem um ponto inicial no seu lado.

## 7. Bots

- Bot **joga de verdade, sem exagero**: vai até a bola, chuta na direção do gol adversário mais próximo, defende voltando ao próprio gol, usa o mortal de vez em quando.
- **Dificuldade fixa e moderada** (reação de ~250 ms, erra ~20% dos chutes), sem leitura perfeita da bola.
- O líder **adiciona/remove bots por time** no lobby (e escolhe a quantidade no treino).

## 8. Interface e erros visuais

- **Escolha de times:** quatro caixas grandes com a cor do time, nome do formato ("2x2x2") e os jogadores dentro, mais uma caixa **Espectador**. Toque no time para entrar. O verde só aparece em formato de 4 times.
- **Erros mostrados na tela**, nunca texto solto:
  - Time cheio: caixa cinza com "Time cheio".
  - Começar bloqueado: o botão mostra o motivo ("Falta jogador no time Azul", "Menos de 2 times").
  - Formato não cabe na sala: o formato fica desligado com "Precisa de 4 pessoas".
  - Sala cheia (15): aviso ao convidar.
  - Reconexão: faixa discreta "Reconectando" sem travar a tela.
- **HUD:** placar por time (cor + número), relógio crescente, feed de gols, aviso de tempo. **Sem nada rítmico** nem contagem sonora (regra 3 vale para o jogo do Tempo, mas manter o HUD simples).
- **Animações:** só `transform`/`opacity` no CSS, respeitando `prefers-reduced-motion`. A cena 3D (Three) pode animar livremente.
- **Câmera:** terceira pessoa **próxima** de cada raposa, com mira suave na bola (assistida, não travada). Mouse/dedo giram a câmera como no Desmorona!.
- Sem emoji. Texto em pt-BR.

## 9. Viabilidade do limite de 15 pessoas

- **Servidor:** 12 raposas + 1 bola a 20 Hz são ~13 entidades por snapshot, cerca de 40 bytes cada: **~10 KB/s por pessoa** e ~150 KB/s no total. Cabe com folga numa instância pequena.
- **Colyseus:** o motor de sala atual já aceita até 12 (`MAX_PLAYERS`); passamos para **15** só neste jogo.
- **Celular:** 12 raposas + campo + 4 gols + bola em Three.js é leve se o campo usar poucas malhas e as raposas reaproveitarem a malha (instanciamento). A meta é **60 fps em celular médio** com 12 raposas.
- **Risco real:** a latência da bola. Mitigação: simulação no servidor, interpolação da bola e previsão da própria raposa. Em ping acima de 150 ms o chute "atrasa"; avisar com um indicador de conexão discreto.
- **Conclusão: viável.** Os 15 só pedem testar o desempenho com 12 raposas num celular real.

## 10. Plano em fases

1. **Fase 1: motor (`packages/games/src/bola`)**: constantes, campo (2, 3 e 4 times), física da bola (varredura), raposa (cápsula, pulo, mortal), toque rastreado, gols, relógio, gol de ouro, bola parada, bots básicos e testes.
2. **Fase 2: sala online (`apps/api`)**: `BolaRoomEngine` sobre `ColorRoomEngine`, times/espectador, troca no meio, bots por time, tick de 30 Hz, snapshots, voto de revanche, 15 pessoas.
3. **Fase 3: web**: cena (campo, gols, bola, raposas), controles (teclado + celular), HUD, feed de gols, câmera.
4. **Fase 4: lobby**: formato sugerido e troca, caixas de times, espectador, bots, erros visuais.
5. **Fase 5: treino offline** com a escolha de bots e modo, e tela do Fox Cap!.
6. **Fase 6: testes e2e, desempenho no celular, docs** (`ARCHITECTURE.md`, `docs/ROADMAP.md`, `HANDOFF.md`).

## 11. Fora de escopo

Ranking (online ou offline), histórico, estatísticas gravadas, boost, power-ups, espectadores com chat próprio, campeonato.

## 12. Ajustes de 26/10/2026

- Gol só vale com a **bola inteira** para lá da linha; trave e travessão devolvem a bola.
- Comemoração de **5 s** depois do gol (confete, fogos, câmera girando), depois a contagem de 3 s.
- **Tab** mostra as estatísticas (gols, assistências, gols contra, toques, mortais e posse); **Configurações** (celular e computador) tem continuar, estatísticas, câmera, trocar de time ou espectar e sair. O cursor só fica preso à câmera durante a partida.
- Campos de 3 e 4 times bem maiores.
