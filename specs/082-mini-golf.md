# Spec 082: Mini Golf (3D, offline com 40 fases e online com amigos)

Pedido em 14/11/2026 (planos `PLANO_MINIGOLF_NOCAP.md` e telas no canvas "Mini Golf NoCap"). Base: Open Golf
(github.com/mgerdes/Open-Golf, MIT), com as 20 fases originais, o formato de fase e a física portados para TypeScript.
Status: **feito** (14/11/2026): física portada, 20 fases do Open Golf + 20 fases novas (maiores e mais difíceis: saltos de rampa, portões, ilhas, labirinto, cascata; provadas por robô), todas as 40 ordenadas por dificuldade (`tools/art/minigolf/assemble.mjs`), garagem da bola, melhor marca na conta e sala online. Falta validar em aparelhos reais.

## 1. Decisões do Lucas

1. Visual próprio do Mini Golf (nova exceção no RULES.md, décima): gramado, madeira e bandeira; fontes Barlow
   Condensed e DM Sans; só `transform`/`opacity` animam. A cena 3D é realista (Three.js, luz e sombra em tempo real).
2. Limite de **16 tacadas** por buraco. Tempo por buraco de **3 min** (padrão da sala; a sala também aceita 1 e 5).
   Quem não encaçapa no tempo ou no limite conta **16 + 2 = 18**.
3. Online **simultâneo, com colisão entre as bolas**. Quem encaçapa espeta a bandeira e espera; quando todos
   terminam, transição e o próximo buraco. TAB (PC) ou botão Placar (celular) mostra o placar, com primeiro e último.
4. A sala escolhe a quantidade de buracos (3, 6, 9, 12, 18 ou 20, sorteados sem repetir).
5. Offline: as 40 fases; cai no buraco e escolhe próxima fase, repetir, escolher fase ou menu.
6. Letreiros ao encaçapar pelo par: ACE (1 tacada), Albatross (-3), Eagle (-2), Birdie (-1), Par, Bogey (+1) e
   adiante; animações, pódio e resumo ao fim.
7. Sons feitos no navegador (Web Audio), **sem música**: tacada, quique, aro, queda, fundo do buraco, letreiros, pódio.
8. Personalização da bola (feita em 14/11/2026): cor (12 ou livre), acabamento (liso, listras, pontos, metade, estrela) e rastro (nenhum, faíscas, fogo, neve), com prévia 3D. Salva na conta
   (`user_prefs`, chave `golf`, sem migration), junto com a melhor marca de cada fase.
9. Física **melhor que a do Open Golf no buraco** (seção 3).
10. Só Three.js (já no app). Nenhuma biblioteca nova. Sem migration.

## 2. Arquitetura

- `packages/games/src/minigolf/`: física pura e determinística (passo fixo, 120 Hz), formato de fase, pares,
  nomes do golfe (`golfName(strokes, par)`), regras de sala e pontuação. Testes por trajetória.
- `tools/art/minigolf/` (só ferramenta, fora do `package.json`): conversor `.level` → JSON/GLB das 20 fases do Open Golf; as 21 a 40 saem de `build-levels.mjs`.
- API: `apps/api/src/rooms/golf-room.engine.ts` (servidor autoritativo: roda a mesma física, valida a tacada,
  empurra as bolas), mais `/me/prefs/golf`.
- Web: `apps/web/src/games/minigolf/` (cena, HUD, telas do canvas, sons, garagem da bola).

## 3. Física do buraco

1. Só cai se a velocidade deixar: acima do limite (função da distância ao centro) a bola passa por cima.
2. O aro é geometria: empurra a bola, que contorna, entra ou sai (lip-out).
3. Dentro, a bola rola, bate na parede e no fundo; sem teleporte.
4. O resultado só vale quando a bola assenta no fundo (cerca de 0,8 s); a câmera aproxima e o tempo desacelera.
5. Sons: aro (batidas curtas), queda (tom que desce), fundo (plop oco e um quique), depois o letreiro.

## 4. Fases de entrega

1. Spec, exceção e licenças (este commit).
2. Conversor e física, com testes e trajetórias; **fase 1 jogável offline** (PC e celular) para o Lucas sentir.
3. As 40 fases offline, letreiros, sons, garagem da bola.
4. Sala online (servidor autoritativo, colisão entre bolas, placar, transição, pódio). **Feita em 14/11/2026**: `GolfRoomEngine` simula todas as bolas, a sala do Fox Cap! escolhe o jogo, quadros `gb` a ~31/s e eventos `ge`, teste com servidor de verdade e duas janelas.

## 5. Em aberto

Tela "Offline" com fases trancadas ou todas abertas (proposta: todas abertas); acabamentos e rastros da bola;
licenças das texturas e modelos do repositório (conferir antes de copiar arte; o código e o formato são MIT).

## Campanha (decisão do Lucas em 14/11/2026)

A campanha tem as **20 fases do Open Golf, exatamente como no original** (geometria, muros de madeira, obstáculos e movimento), na ordem original (1 a 20), mais a **fase 21, o Grande Circuito**, nossa, feita só com peças do Open Golf, e as **fases 22 a 25** (A Janela, Gangorra, Longa Distância e Pulo em Pulo), nossas, com peças novas (as fases 21 a 40 que tínhamos feito foram removidas).

**Grande Circuito (fase 21):** circuito que desce em andares (começa 3 m acima do deque da fase 5), com corredores de 5 m e muros no tamanho do original (0,5 m de espessura, 0,375 m de altura). Em ordem: reta com os dois pêndulos da fase 6 (os vãos dos lados são fechados com blocos, então a bola tem de passar pelo pêndulo), o loop da fase 9 (entrada na diagonal, a partir de uma área de manobra de 6 m), reta com as lombadas da fase 4 e um giratório da fase 1 com os lados fechados, curva arredondada, reta com o rio da fase 7 (corrente 5x empurrando a bola para o muro), descida suave de 3 m e as quatro paredes deslizantes da fase 18, duas curvas em S, colina de 1,5 m com um giratório no alto e, por fim, a fase 5 inteira (rampa suave, espiral que desce 6 m e câmara redonda do buraco). Montada em `tools/art/minigolf/build-levels.mjs` (`grandCircuit`).

As dificuldades agrupam as fases em 7, 7 e 7 (fácil 1 a 7, média 8 a 14, difícil 15 a 21); a sala online sorteia 1 fácil : 2 médias : 3 difíceis (12 buracos = 2, 4 e 6; as fáceis são sempre a minoria; 25 = todas). As ferramentas de `tools/art/minigolf/` ficam como histórico de trabalho.

**Peças novas (fases 22 a 25), em `build-levels.mjs` (`kit`):**
- **Janela na parede:** muro de 1,2 m com abertura de 0,5 m x 0,35 m no chão (a bola tem 0,24 m); pode ser fixa ou deslizar de lado.
- **Moinho:** base com túnel de 0,75 x 0,65 m e oito pás que giram na vertical na frente da porta. É a peça móvel nova `rotor` da engine (`physics.ts`: giro completo ao redor de um eixo qualquer; o Open Golf só tem giro no eixo vertical, pêndulo, rampa e linear).
- **Redemoinho:** disco de água em que cada fatia empurra a bola em volta (corrente tangencial) e um pouco para o centro; usa a água do Open Golf.
- **Tubo:** a bola rola por dentro de um cilindro de 12 lados (faces viradas para dentro), reto ou descendo.
- **Gangorra e ponte:** tábua que levanta e desce (peça `ramp` do Open Golf), com muretas juntas; a ponte fica aberta 2,4 s e fechada 2,4 s.

## Correção da sala online (27/11/2026)

Relato do Lucas: na sala online a bola voltava depois da primeira tacada e não dava para tacar de novo. Duas causas:

1. **Servidor.** Quando a bola parava, o estado dela voltava a "pronta" (`aim`) sem nenhum evento, então o estado da sala não era republicado e o aparelho ficava preso em "rolando": uma tacada por buraco. `GolfRoomEngine.tick` agora compara o estado de todas as bolas a cada passo e republica quando muda (teste: "republica o estado quando a bola para").
2. **Aparelho.** A previsão da própria tacada durava 380 ms e depois trocava para a posição do servidor, que chega atrasada (rede mais os 90 ms de interpolação), e a bola dava um pulo para trás. Agora a previsão vale até a bola parar; só cede ao servidor se ele disser, depois de 1,2 s, que a bola não rola (tacada recusada, buraco, volta ao ponto). A mira usa o estado do quadro mais recente (`st`), não só o do estado da sala, e não mira durante a previsão.

## Fim de buraco na sala online (27/11/2026)

Pedido do Lucas: quando a bola entra, mostrar a cena de acerto e depois deixar assistir; sem ninguém jogando, mostrar a tabela e animar a troca de fase; no último buraco só ir ao ranking ao acabar.

- Minha bola encaçapa (ou acabam as tacadas): cena "Acertou!" (ou "Acabou!") com a nota do buraco por 3 s (`mg-cele`), com o som do resultado. Só dispara na virada de estado durante o jogo.
- Depois vira **espectador**: a câmera acompanha quem ainda joga, com barra "Assistindo X" e botões para trocar (44 px). Sem ninguém jogando, espera o buraco fechar.
- Pausa do buraco (`GOLF_CLEARED_MS`, 6,5 s): nota de cada um e o placar em tabela na própria tela. Fora do último buraco, um painel lima cobre a tela no fim (`mg-wipe in`) e descobre quando o próximo buraco começa (`mg-wipe out`), só `transform`, desligado com `prefers-reduced-motion`.
- Último buraco: a pausa mostra a tabela e o ranking só vem quando o buraco fecha e a pausa acaba.

## Bola teletransportando (27/11/2026)

Duas causas no aparelho, ambas de reconciliação com o servidor:

1. As posições eram interpoladas pela hora em que o pacote chegou; a rede entrega em rajadas e a bola parava e pulava. Agora o eixo é a hora do servidor que vem em cada quadro (`t`), com um relógio estimado pelo menor atraso visto (`off`), e a extrapolação aguenta até 250 ms de falta de quadros.
2. Depois da correção da primeira tacada, a previsão da minha bola vale até parar, e uma batida em outra bola (ou qualquer divergência) só aparecia no fim, como um pulo. Agora, a cada quadro novo do servidor, compara-se a posição dele com o ponto mais próximo do caminho previsto (assim o atraso da rede não conta) e só o desvio real é corrigido, aos poucos (30% por quadro; desvio acima de 2 m corrige de uma vez); a troca final para o servidor dura 320 ms.

Volta ao ponto da tacada (água ou fora do campo) continua sendo um salto de verdade, decidido pelo servidor.

## Colisão e rede refeitas no aparelho (27/11/2026)

Relato do Lucas: a bola bate na outra sem parecer que bate, entra dentro dela e só depois empurra; teletransporte; nomes parados na tela.

Causa: o aparelho previa só a minha bola (sem as outras) e desenhava as outras do servidor, interpoladas ~100 ms no passado. Minha bola atravessava uma bola parada, o servidor empurrava depois e a correção chegava como pulo.

Agora (`packages/games/src/minigolf/predict.ts`, `GolfPredictWorld`, 5 testes): o aparelho roda a MESMA física do servidor (`golfStep` e `golfBallCollide`, 120 Hz) para TODAS as bolas, sem atraso de interpolação.
- Minha tacada sai na hora e bate nas outras bolas no ponto certo; a bola atingida reage no mesmo instante e fica poupada da correção por 0,4 s (o quadro do servidor ainda não sabe da batida).
- Cada quadro do servidor (idade estimada = jitter medido + 40 ms) puxa a bola 30% do erro, e a velocidade também; erro acima de 1,5 m salta (volta ao ponto da tacada, água). Durante a minha previsão compara-se com o ponto mais perto do caminho previsto, para o atraso da rede não contar como erro; o servidor só vale como "parada" depois de 1,2 s da tacada. Bolas no buraco ou sem tacadas ficam paradas onde o servidor diz.
- Nomes: o elemento que guarda os nomes sobrevivia à troca de buraco e deixava nomes velhos parados; agora é limpo ao trocar de fase e ao sair.

O fim da partida online (`GolfRoomFinal`) já tinha pódio, lista, resumo e revanche; agora também mostra o placar completo (buraco a buraco, com o par) no mesmo componente do placar da partida (`GolfSheet`).
