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

A campanha tem as **20 fases do Open Golf, exatamente como no original** (geometria, muros de madeira, obstáculos e movimento), na ordem original (1 a 20), mais a **fase 21, o Grande Circuito**, nossa, feita só com peças do Open Golf (as fases 21 a 40 que tínhamos feito foram removidas).

**Grande Circuito (fase 21):** circuito de cerca de 150 m com corredores de 5 m e muros no tamanho do original (0,5 m de espessura, 0,375 m de altura). Em ordem: reta com os pêndulos da fase 6, o loop da fase 9 (entrada na diagonal, a partir de uma área de manobra de 6 m), reta com dois giratórios da fase 1, curva arredondada, reta com as quatro paredes deslizantes da fase 18, duas curvas em S, uma colina (sobe 1,5 m e desce) e, por fim, a fase 5 inteira: rampa suave, espiral que desce 6 m e câmara redonda do buraco. Dificuldade: difícil. Montada em `tools/art/minigolf/build-levels.mjs` (`grandCircuit`).

As dificuldades agrupam as fases em 7, 7 e 7 (fácil 1 a 7, média 8 a 14, difícil 15 a 21); a sala online sorteia proporcional entre elas (21 buracos = todas). As ferramentas de `tools/art/minigolf/` ficam como histórico de trabalho.
