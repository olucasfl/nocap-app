# 020 · Sinal Vermelho (jogo solo de correr sem ser visto)

Status: **lógica e design aprovados pelo Lucas (12/10/2026), com os dois modos (Clássico por fases e Infinito), poderes e chefes; **núcleo da lógica pronto em `packages/games/src/sinal/` e tela jogável em `apps/web/src/games/sinal/` (Canvas, analógico no celular, WASD no computador, câmera, os 3 mapas, poderes, som, menu com modo e cor, fim da partida, recorde só neste aparelho); faltam o servidor (sessão, conferência da corrida, ranking), calibrar jogando e a escolha de cor única por sala (online).** Nada implementado. Online (todos no mesmo mapa, com física de empurrão) fica para depois e não faz parte desta spec.

## A ideia

Um jogo de correr, visto de cima, infinito. Lá no fundo da tela fica o **Vigia**, que ora olha para você, ora vira de costas. Enquanto ele está de costas, você corre. Se ele olhar e você estiver se mexendo, **acabou**. A pontuação são os **metros** que você andou para a frente. Pense no "batatinha frita 1, 2, 3", mas infinito, com esconderijos e uma escuridão que vem de trás.

## Decisões do Lucas

- **Visão de cima**, câmera subindo; 2D (mais simples e mais bonito de fazer bem).
- **Vigia fixo** no topo da tela, acompanhando a câmera (sempre no horizonte). Um só.
- **Dois modos na primeira versão (decidido em 12/10/2026):** **Clássico** (rodadas de mapas com fases e chefe, sem fim) e **Infinito** (um mapa só, sem fim, cada vez mais difícil). Os dois são uma corrida só: **perdeu, acabou**. Os dois têm ranking. O **online** vem depois.
- **Escuridão** que vem de trás: no começo quase não aparece, vai ficando perigosa no final da corrida ou se a pessoa **ficar muito tempo parada**. Precisa ser **animada e profissional**.
- **Controles pelo aparelho, de forma intuitiva:** celular com analógico na tela (bola e bolinha), **fixo embaixo, no centro** (decisão de 12/10/2026: serve para canhoto e destro; antes era no canto direito); computador com W A S D (e setas). Sem opção de "dica mais fácil".
- **Mapas:** 3, com cenários, bonecos e Vigias diferentes, mas **as mesmas regras e a mesma dinâmica**. O mapa é **sorteado quando a partida é puxada** (pela seed). **Só o modo muda o ranking, o mapa não:** um ranking por modo, igual para todos os mapas.
- **Nota:** metros. Ranking por modo. Daily fica para depois (decidir mais adiante).

## Regras da partida (modo Infinito; o Clássico usa as mesmas regras com fases)

### O Vigia
Quatro estados, em ciclo. Todos os tempos saem da seed, então a partida é a mesma para o mesmo dado de entrada.

| Estado | Pode se mexer? | Duração inicial | Como muda com a distância |
|---|---|---|---|
| **De costas** | sim | 4,0 a 6,5 s | encurta até 1,6 a 2,8 s |
| **Aviso** | sim (ainda vale) | 0,9 s | encurta até 0,45 s (piso: nunca menos) |
| **Olhando** | **não: se mexer, perdeu** | 1,2 a 1,8 s | cresce até 2,6 s |
| **Voltando** | sim (a partir da virada) | 0,35 s | fixa |

- **Folga de 120 ms** logo ao começar a olhar: quem já estava no embalo não perde por um fio de cabelo. Sem isso o aviso não teria como ser justo.
- **"Se mexer"** = velocidade acima de uma **zona morta** pequena (para o dedo tremendo no analógico não contar). Estar dentro de um esconderijo não conta (veja abaixo).
- Todos esses números são **palpite a calibrar jogando**.

### O aviso (visual e sonoro, sem ser óbvio)
Antes de olhar, o Vigia dá sinais discretos e que um jogador atento aprende a ler: o olho dele dilata devagar, um zumbido grave sobe de tom, e uma vinheta leve pulsa nas bordas da tela. O som é reforço: **quem joga no mudo ainda vê o aviso**.

### O mundo
- Corredor largo o bastante para correr e desviar (cerca de 9 m), com cenário que se repete e varia por trechos gerados pela seed (obstáculos só decorativos nesta versão; o que importa para a lógica são os esconderijos).
- Distância em metros. O boneco anda no máximo uns **4,2 m/s**; o analógico controla a velocidade (proporcional ao quanto você inclina).
- **Pontuação = ponto mais longe que a pessoa chegou para a frente** (o maior avanço). Andar de lado ou voltar não soma, para ninguém "pontuar" balançando.

### Esconderijos
- Arbustos, caixotes ou sombras (conforme o mapa). Dentro de um, a pessoa **pode se mexer à vontade, mesmo com o Vigia olhando**.
- Para não virar jogo fácil: cada um **comporta uma pessoa**, é **pequeno**, e eles ficam **espaçados** (no começo 22 a 45 m entre um e outro; o espaço aumenta com a distância). Nunca formam uma fila de um até o outro: **sempre há um trecho aberto a cruzar** e a posição lateral muda de um para o próximo.
- O esconderijo **não protege da escuridão**.

### A escuridão
- Vem de trás e acompanha a pessoa, mais devagar do que ela corre. No começo é **quase imperceptível** (começa uns 60 m atrás e anda a uns 0,12 m/s).
- Fica mais rápida de duas formas: **com a distância** (mais perto do final da corrida, mais veloz) e **com o tempo parado** (se a pessoa não avançou uns 1,5 m nos últimos 6 s, a escuridão acelera em até 4 vezes, devagar e sem tranco), **sempre respeitando o limite de 92% da velocidade do boneco** (veja "Limite da escuridão").
- Só aparece na tela quando está perto (uns 14 m atrás), com nevoeiro, brasas e uma borda escura animada. Se alcança a pessoa, **perdeu**.
- É o que impede de ficar escondido para sempre e dá o ritmo da corrida.

### Fim da partida
Pausa disponível, que congela o relógio. Ao ser visto (ou alcançado pela escuridão) mostra "Te viu!" (ou o equivalente da escuridão), os metros, o recorde e o lugar no ranking (o mesmo `MatchSummary` dos outros jogos).

## Câmera e tamanho do mapa (decisão de 12/10/2026)
O Lucas achou a câmera **perto demais** e quer **mais campo de visão**, com **10 a 12 pessoas cabendo na tela** no online. **Um mapa só, maior, para todo mundo** (assim os metros do Solo e dos amigos significam a mesma coisa): o Solo já é o mapa grande, e só a **câmera** e a **largura do corredor** mudam com o número de jogadores.

| | Solo | Com amigos (até 12) |
|---|---|---|
| Zoom da câmera | 0,68 (mostra bem mais mundo que antes) | 0,42 |
| Largura do corredor | cerca de 10 m | cerca de 20 m |
| Esconderijos | poucos, espaçados | vários por trecho (mais gente para esconder) |
| Vigia na tela | 82% | 62% (mais ao longe) |

- O boneco, o esconderijo e o cenário encolhem com o zoom; a interface (metros, pausa, analógico, Vigia, escuridão, vinheta) não.
- A câmera mantém o boneco em cerca de 52% da altura (longe do Vigia), fora da zona do analógico.
- A câmera do online ajusta o zoom ao número de pessoas na sala (12 é o mínimo de zoom), e cada jogador ganha um anel colorido sob o boneco para saber quem é quem.
- Valores são palpite a calibrar jogando. O protótipo mostra as duas câmeras (`design-sinal-vermelho.html`, botões SOLO e 12 AMIGOS).

## Seu boneco: cor e nome (12/10/2026)
- **Decisão do Lucas: a cor e o nome só existem no online.** No solo (Clássico e Infinito) vale o **boneco padrão** do mapa (Tomate, Entregador, Raposa), sem escolher cor. O resto desta seção descreve o online.
- **Antes de começar a sala** há uma tela "Seu boneco" onde a pessoa **escolhe a cor** entre 12: laranja, azul, amarelo, verde, rosa, roxo, ciano, vermelho, branco, grafite, marrom e lima. O boneco do mapa (tomate, entregador ou raposa) usa essa cor no corpo. A escolha fica guardada.
- **Na sala, cada cor é única:** a cor que outra pessoa já pegou aparece apagada e não dá para escolher.
- **O nome** (o `@usuario`) aparece **em cima de cada boneco**, numa etiqueta da cor dele, com tamanho fixo na tela (para ler mesmo com a câmera longe). O seu leva uma setinha amarela.

## Online: como funciona com outras pessoas (visão, fica para depois)
- **Um mundo só**, o mesmo para todos (mesma seed: trilha, esconderijos e relógio do Vigia). O servidor manda em tudo; o jogo manda só a direção do analógico.
- **Cada pessoa tem a sua câmera**, que segue o próprio boneco. Os outros aparecem quando estão no enquadramento, e setas na borda da tela apontam (com cor e nome) quem está fora de vista à frente ou atrás.
- **O Vigia é um só e é igual para todos:** vira e olha no mesmo instante para a sala inteira; cada tela o mostra fixo no topo.
- **A escuridão também é uma só**, uma parede que avança pelo mundo. Por isso cada tela a vê de um jeito: **quem ficou para trás a vê grande, quase pegando; quem está na frente a vê longe e anda tranquilo**. Ela acelera com o tempo, e quem fica parado simplesmente é alcançado. (Online não existe a aceleração por "ficar parado" do solo: a parede global já faz esse papel.)
- **Todos jogam ao mesmo tempo**, saindo juntos de uma linha de largada. Quem é visto mexendo ou alcançado pela escuridão **sai da corrida**, ganha os metros que fez e passa a assistir os outros. Vence quem aguentar mais; a classificação é pelos metros.
- **Física entre os bonecos:** não se atravessam. Ao encostar, o outro é jogado na direção do encontro.
- **Salas não entram no ranking** (regra do projeto); só o histórico de sala.
- **Decididas pelo Lucas (12/10/2026), as quatro com "sim":** (1) ser empurrado enquanto o Vigia olha **conta como se mexer** (com uma folga curta logo depois do empurrão); (2) quem sai da corrida **só assiste** os outros; (3) a velocidade da escuridão online segue **só o tempo**; (4) o empurrão **pode tirar alguém de dentro de um esconderijo**.

## Esconderijo, versão clara (12/10/2026)
O Lucas quis que a zona de proteção fique **óbvia**:
- **Zona marcada:** cada esconderijo tem um **anel tracejado no chão** com o tamanho exato da zona. Dentro do anel, a pessoa está protegida; fora, não.
- **Entrar no arbusto:** ao entrar na zona o boneco **vira uma silhueta** (sombra escura com o contorno na cor da pessoa), por baixo da folhagem semitransparente. Quem está de fora vê só a silhueta. O anel vira verde e anima.
- **Indicador na tela:** uma etiqueta verde **ESCONDIDO** (com um olho riscado) abaixo dos metros, e um som de folhagem ao entrar.
- **O esconderijo quebra:** só aguenta um tempo (cerca de 4,5 s acumulados dentro; o tempo volta devagar quando a pessoa sai). Um **anel de durabilidade** esvazia ao redor (verde, depois laranja); no final ele treme, perde a cor, caem folhas e **some**, deixando a pessoa exposta. Esconderijos de aparência rachada (frágeis, nas fases mais difíceis) aguentam só uns 2,5 s. No Clássico, o que quebrou não volta naquela tentativa; no Infinito novos aparecem à frente. Tempos são palpite a calibrar.

## Falso aviso
De vez em quando o Vigia dá o sinal de que vai olhar **e não olha**. Acontece raramente no Infinito (a partir de uns 150 m, cerca de 1 em 8 avisos) e com frequência crescente no Clássico (de 1 em 8 a 1 em 4). Quem se escondeu à toa perde tempo e fica mais perto da escuridão.

## Clássico (decidido pelo Lucas em 12/10/2026)
Uma corrida sem fim, em **rodadas de mapas**:
1. **Sorteia um mapa** para começar.
2. A pessoa joga **4 fases**, cada uma mais difícil e mais longa que a anterior, e na **5ª fase enfrenta o chefe** do mapa.
3. Passou do chefe: vai para **outro mapa sorteado** (que ainda não jogou nesta corrida) e repete: 4 fases e o chefe.
4. **Sem repetir mapa** até fechar os três. Fechou todos: **volta ao primeiro e assim vai**, e a dificuldade continua subindo.
5. **Perdeu, acabou** a corrida. O **recorde é a distância total percorrida**, somando as distâncias de todas as fases.

- **Fase** = uma distância a cumprir até a linha de chegada (a fase conta como cumprida quando o boneco cruza a linha). A distância e a dificuldade crescem com o **número da fase na corrida** (1, 2, 3...), não com o mapa: a fase 6 (primeira do 2º mapa) é mais difícil que a 5. Palpite de partida: comprimento de 100 m + 20 m por fase, e o chefe com 1,6 vez isso.
- **Progresso no topo da tela:** uma trilha com o boneco andando até uma bandeirinha, "FASE 3" e "faltam 84 m"; no chefe a trilha muda de cor e mostra a coroa. Os metros da fase e o total da corrida ficam no canto.
- **Entre fases:** um cartão rápido com a distância total até agora; ao trocar de mapa, o nome do mapa novo.
- **A cada fase:** o Vigia fica um pouco mais ligeiro e a escuridão recomeça atrás da pessoa, mas um pouco mais veloz (veja a regra do limite abaixo).
- **Novidades que entram com a dificuldade** (palpite): falso aviso a partir da fase 3; esconderijo frágil a partir da 4; o poder do Vigia do mapa a partir da fase 2; e mais de um poder por vez nos chefes.
- **Mapas e Vigias:** cada mapa tem o seu Vigia e o seu chefe (Rei Espantalho, Semáforo Mestre e Totem Ancestral).
- **Servidor:** o servidor refaz a corrida inteira pelos movimentos (a seed define o sorteio dos mapas, as fases, os esconderijos e os poderes). Não há tabela de progresso: só a distância total do ranking, **sem migration**.

## Infinito (decidido pelo Lucas em 12/10/2026)
- **Sorteia um mapa** e fica nele para sempre.
- Os **poderes são aleatórios**: começa com o do Vigia do mapa e, quanto mais longe a pessoa vai, entram poderes mais variados (a reserva dos chefes, em versão mais fraca), sempre pelas regras de equidade.
- Cada vez mais difícil: o Vigia mais ligeiro, falsos avisos mais comuns, esconderijos mais raros e frágeis, e a **neblina preta** (a escuridão) se aproximando mais depressa.
- Recorde: **metros do ponto mais longe** que a pessoa chegou.

## Limite da escuridão (regra importante)
**A escuridão nunca anda mais rápido que o boneco.** A velocidade máxima dela é uma fração fixa da do boneco (**92%**, cerca de 3,9 m/s contra 4,2 m/s), em qualquer modo, mesmo com todos os aceleradores (distância, fase, tempo parado). Assim, quem corre sem parar nunca é alcançado; quem é alcançado é quem para demais (Vigia olhando, esconderijos, poderes). Um teste automático garante isso para qualquer corrida.

## Poderes dos Vigias
**Regra de ouro (decidida pelo Lucas):** quando a pessoa **está escondida, o Vigia não solta poder nela**; quando está **no meio do nada**, solta. Se ela entrar num esconderijo durante o aviso do poder, o poder passa sem efeito.

**Vigias comuns, "poderzinho besta"** (nas fases normais do Clássico e, em versão variada, no Infinito; um a cada uns 15 a 25 s):
- **Espantalho, bando de corvos:** corvos cruzam a tela e escondem uma parte da visão por uns 2 s (cobertura leve).
- **Semáforo, óleo na pista:** 3 poças escorregadias aparecem perto; pisar faz deslizar por cerca de 1 s (e deslizar conta como se mexer quando ele olha).
- **Totem Coruja, poeira nos olhos (escolha do Lucas):** uma brisa de areia **embaça só as bordas da tela** por uns 2 s, avisada 1 s antes com grãos de areia soprando. Não empurra o boneco: é o mais leve dos três.

**Chefes** (a 5ª fase de cada rodada de mapa): um Vigia maior, com coroa ou detalhes próprios, que **solta vários poderes**: pode encadear dois. Reserva de poderes:
1. **Controles invertidos** (2,5 s): o analógico muda de cor e a tela inclina um pouco no aviso.
2. **Cortina** (tinta, penas, fumaça ou areia, 2,5 a 3 s): cobre a tela, mas sempre deixa uma janela clara ao redor do boneco.
3. **Rajada** (empurrão de 2 s, no máximo 4 m): setas no chão mostram a direção.
4. **Lama** (3 s, 40% da velocidade) numa área marcada no chão.
5. **Apagão** (3 s): a tela escurece e fica um círculo de luz ao redor do boneco.
6. **Chuva marcada:** círculos vermelhos no chão explodem depois de 1,2 s e empurram quem estiver dentro.
O chefe também faz falsos avisos mais seguidos.

**Equidade dos poderes** (o Lucas pediu: nada apelão nem injusto). Regras que o gerador cumpre e que um teste automático confere:
- **Só com o Vigia de costas**, nunca durante o aviso de olhar nem olhando. Ele pode soltar o poder e **depois** virar: quem não se escondeu nem se virou perde, mas dá para se virar.
- **Aviso próprio do poder** de uns 0,9 s, diferente (som e imagem) do aviso de olhar.
- **Efeito curto** (até 3 s) e que **termina pelo menos 1,2 s antes do próximo olhar**: dá sempre tempo de parar.
- **Nunca elimina direto:** nada de dano nem de empurrão para dentro da escuridão; o pior caso é atrapalhar.
- **Um poder por vez**, com intervalo mínimo entre eles.
- **O aviso de olhar nunca é coberto:** o Vigia e a vinheta de aviso continuam visíveis mesmo com cortina.
- **Teste de justiça:** na simulação, um jogador que reage ao aviso (para a tempo ou se esconde) **nunca perde por causa de um poder**.

## Revisão de jogabilidade (12/10/2026): menos linear, mais difícil desde o começo
O Lucas achou o jogo linear e fácil. O que mudou:
- **Três poderes por Vigia, desde a primeira fase** (antes era um só e só a partir da fase 2). Eles aparecem cerca de um a cada 10 segundos:
  - **Espantalho:** corvos (bando grande, **cobre a tela e inverte os controles** por 2,2 s), lama (devagar por 3 s) e chuva de abóboras (círculos vermelhos que empurram).
  - **Semáforo:** óleo na pista (poças grandes que fazem deslizar), buzina (**trava no lugar** por 1,2 s) e faróis (clarão branco que cega por 2,2 s).
  - **Totem Coruja:** poeira nos olhos (areia embaça a tela), vento (empurrão de lado de 2,4 s) e eco (**os comandos demoram 0,4 s** para responder por 2,6 s).
- **Aviso na tela do que vai acontecer:** quando o Vigia prepara um poder aparece um quadro com o nome e o efeito ("ATENÇÃO: OS CORVOS DO ESPANTALHO. Cobrem a tela e INVERTEM seus controles por 2 s."). Continua valendo a regra de equidade e a de que escondido ninguém é atingido.
- **Ciclos do Vigia variados** (nada de mesmo ritmo e mesmo intervalo): normal, **rápido** (aviso de 0,3 s), **longo** (olha por 3 s), **olhadinha** (0,5 s, para pegar quem corre cedo demais) e **duplo** (olha, vira, e olha de novo logo depois). O tempo de costas varia de 0,6x a 1,5x, com pausas longas de vez em quando; o zumbido do aviso muda de jeito conforme o tipo.
- **Obstáculos no caminho** (pedras, barris, cactos, abóboras...): o boneco não passa por cima, tem que contornar. Surgem em grupos de um a três, sempre com um vão, e mais seguidos conforme a dificuldade. Não é só "pare e ande": é escolher o caminho enquanto o Vigia não olha.
- **Névoa visível desde o começo:** uma neblina sobe do pé da tela, fraquinha, e engrossa com o tempo e conforme a escuridão chega perto. A escuridão larga mais perto (36 m no Clássico, 42 m no Infinito) e acelera mais depressa, **sempre abaixo de 92% da velocidade do boneco**.
- **A câmera ficou mais para trás do boneco** (ele fica a 52% da altura), longe do Vigia.
- **Conferido com jogadores simulados** (reflexos de 0,17 s, 0,27 s e 0,42 s): no Infinito, quem reage rápido chega a uns 460 m e é pego pela escuridão; quem reage em 0,27 s chega a uns 370 m (metade pego pelo Vigia, metade pela escuridão); quem reage em 0,42 s é pego pelo Vigia em cerca de um minuto (uns 175 m). No Clássico, o jogador de reflexo médio costuma cair nas fases 3 a 4. Robô não mede diversão: o que vale é a jogada do Lucas.

## Ajustes de tela (12/10/2026)
- **Aviso de poder com uns 2 s** (antes de 0,8 a 1,2 s): dá tempo de ler o quadro e decidir. O tempo de costas se estica para caber.
- **Corredor mais largo:** 15 m (antes 10 m), mais espaço para andar de lado e contornar obstáculos.
- **Progresso do Clássico** num cartãozinho embaixo da distância total (FASE n, faltam X m, boneco até a bandeira), não mais na tela inteira. O **Vigia** fica colado no topo em tela larga.
- **Construções da horta** (casinha, celeiro, silo, estufa, galpão) sorteadas por lado, com cor, tamanho e distância da pista diferentes: nada de pares iguais nem fila certinha.

## Sem chefe: a cada fase vem mais coisa (12/10/2026)
- **Não há mais chefe.** Todas as fases são iguais em estrutura; o que muda é que a cada fase vêm **mais poderes, mais obstáculos e uma escuridão mais ligeira** (larga mais perto e acelera mais, sempre abaixo de 92% do boneco). O comprimento da fase cresce até 320 m.
- **O mapa troca a cada 5 fases** (sorteado, sem repetir até fechar os três).
- **Poderes liberados por fase** (além dos três do mapa): fase 3 rajada e cortina; fase 5 lama e invertido; fase 7 apagão e chuva. A partir da fase 6 podem vir **dois poderes seguidos**.
- **Emboscada:** de vez em quando (20% a 45% dos ciclos com poder, mais nas fases altas) o Vigia vira **logo depois do poder**: o efeito acaba só 0,15 s antes do aviso. O aviso ainda toca (no mínimo 0,3 s), então dá para parar, mas a folga é curta.
- **Obstáculos (nove tipos, liberados por fase):**
  - sólidos, que se contorna: pequeno e médio (fase 1), grande (2), deslizante, que vai de um lado a outro (3), vaivém, que vem e vai (5);
  - mola (4): joga o boneco para trás por 0,3 s;
  - de chão, que agem em quem passa: lamaçal (2, anda a 45%), esteira (4, empurra de lado a 2 m/s), ímã (6, puxa para o centro a 1,6 m/s).
  Cada mapa tem a sua arte para cada tipo (carrinho de mão e cogumelo na horta; carro, drone e trampolim na rua; pilar, escorpião e flor no deserto). Os grupos sempre deixam um vão por onde passar.
- **Regra de equidade:** ser empurrado (esteira, ímã, mola ou obstáculo que se mexe) **com o dedo parado não faz o Vigia te ver**. Só conta como "mexer" o que a pessoa faz.
- **Escuridão:** volta a engolir o mapa de longe (a borda sobe pela tela a partir de uns 40 m); perto, a posição na tela é a distância real.

## Controles
- **Celular:** o analógico (círculo e bolinha) fica **fixo embaixo, no centro da tela**, sempre visível, com uma área de toque generosa em volta. A bolinha acompanha o dedo e volta ao centro ao soltar.
- **A câmera nunca deixa o analógico tapar o boneco.** A tela reserva uma **zona do analógico** (embaixo, no centro, com folga em volta) e a câmera mantém o boneco sempre **fora dela**: o boneco fica um pouco acima do meio da tela (cerca de 52% da altura, para ficar longe do Vigia) e a câmera também acompanha de lado quando ele vai para a direita. É uma regra do código da câmera (função pura, com teste: para qualquer posição do boneco no corredor, em retrato e em paisagem, ele nunca fica dentro da zona do analógico). Vale também para o Vigia, os esconderijos e o aviso, que ficam fora dessa zona ou são desenhados sem depender dela.
- **Computador:** W A S D e setas, com a dica das teclas na tela na primeira vez.
- Aparece o que combina com o aparelho; se o aparelho tiver os dois, valem os dois.

## Técnico
- **Núcleo puro** em `packages/games/src/sinal/` (nome provisório): o mundo, o ciclo do Vigia, os esconderijos, a escuridão e a simulação com **passo fixo (60 por segundo)**, determinística. Sem relógio nem desenho dentro do núcleo. Testes de ciclo do Vigia, folga, zona morta, esconderijos (espaçamento e que nunca formam fila), escuridão (aceleração por distância e por tempo parado) e de que a mesma seed gera sempre a mesma corrida.
- **O servidor refaz a partida.** O jogo manda só os **movimentos** (instante e direção do analógico, em valores inteiros de -100 a 100, e só quando mudam). O servidor roda a mesma simulação, confere que a velocidade nunca passa do limite e calcula metros e a morte. O cliente nunca diz "andei X metros".
- **Seed e mapa:** a sessão (`/games/sinal/session`) devolve a seed e o servidor a assina, como no Eco Hero. O mapa (cenário, boneco e Vigia) sai da seed e não afeta a lógica.
- **Nota guardada** em décimos de metro, no campo de 16 bits (teto 3276,7 m); mostrada em metros inteiros. Modos guardados no servidor: `sinal-infinito` (ranking pelos metros do ponto mais longe) e `sinal-classico` (ranking pela **distância total percorrida**, somando todas as fases). Ranking por modo; um único quadro para os 3 mapas.
- **Tela:** Canvas 2D (desenho profissional, partículas e a escuridão animada), com os elementos desenhados em código (nenhuma dependência nova). As regras de animação do projeto valem para o resto da interface; respeita movimento reduzido nos efeitos extras.
- **Som:** Web Audio (receitas na skill `sfx`): zumbido do aviso que sobe de tom, passos, o "te viu" e a escuridão.
- **Offline:** joga, mas sem sessão do servidor a partida não é salva (como o Eco Hero).
- **Depois do jogo no navegador:** testar em tempo real **com a janela à vista** (o navegador de teste não anima escondido).

## Fora desta versão
- **Online:** todos no mesmo mapa ao mesmo tempo, com física (os bonecos não se atravessam e, ao encostar, o outro é empurrado na direção do encontro). Exigirá servidor autoritativo em sala (Colyseus). A simulação determinística de agora já nasce pensando nisso.
- **Guardado para depois:** botão de **pedrinha** que desvia o Vigia, **fantasma** da melhor corrida, itens (capa, relógio), terrenos (gelo, areia movediça, esteira), noite e tempestade de areia, e **Daily**. Nada de estrelas, marco no meio da fase nem tabela de progresso: o Clássico é uma corrida só.

## Design (proposta de 12/10/2026, a aprovar)
Protótipo navegável em `docs/reference/design-sinal-vermelho.html` (abrir por um servidor local, por exemplo `python -m http.server` na pasta; as fontes vêm do Google). Mesma dinâmica nos três mapas; muda só a aparência. Estilo Pop Brutal: contorno de tinta, sombra dura, cores chapadas, sem emoji.

| Mapa | Cenário | Boneco | Vigia | Esconderijo | Escuridão |
|---|---|---|---|---|---|
| **Horta Maluca** | dia, trilha de terra entre fileiras de plantação | Tomate | Espantalho | Arbusto | brasas amarelas |
| **Rua Neon** | noite, asfalto, faixa de pedestre, postes laranja | Entregador | Semáforo | Caçamba | brasas ciano |
| **Ruínas do Deserto** | areia, lajes quebradas, pedras roxas | Raposa | Totem Coruja | Cacto | brasas rosa |

- **Vigia** (visto de frente, preso ao topo, gira como um cartão): de costas, aviso, olhando. O aviso acontece **com ele ainda de costas**: a luz traseira do semáforo pisca cada vez mais rápido, a costura do espantalho brilha e o chapéu inclina, a runa do totem acende. Olhando: a pupila acompanha o boneco.
- **Boneco** em três estados: parado, andando (passinhos alternados) e escondido (translúcido, com anel tracejado no esconderijo).
- **Escuridão:** borda ondulada animada, brasas subindo na cor do mapa e olhos piscando lá dentro.
- **Tela:** metros no canto superior esquerdo, pausa no direito, linha tracejada amarela de "seu recorde" no chão, vinheta vermelha pulsando no aviso e carimbo amarelo "TE VIU!" no fim, como o resto do app. Analógico fixo embaixo, no centro; o protótipo mostra a zona reservada.

## Plano (em ordem)
1. Núcleo puro e testes (`packages/games`).
2. Tela de jogo no Canvas, controles do celular e do computador (sem servidor), com um mapa provisório.
3. Aviso (visual e sonoro) e a escuridão animada.
4. Os 3 mapas, o boneco e o Vigia (design final).
5. Servidor: sessão, `scoreSinalMatch`, ranking, histórico e recordes.
6. Calibrar jogando.
7. Depois: online e outros modos.
