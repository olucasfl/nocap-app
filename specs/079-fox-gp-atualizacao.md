# Spec 079: Fox GP, atualização (física, online, pista da Marina e tema)

Pedido em 10/11/2026 (documento "Atualização do Jogo de Corrida", artifact de tema e imagem da pista). Status: **em
andamento** na branch `feat/fox-gp`; uma pendência listada na seção 4.

## 1. Decisões (10/11/2026)

1. **Exceções 8 e 9 no RULES.md:** todas as telas do Fox GP usam o tema do artifact (Saira Condensed + Inter, fundo
   #0b0e17, laranja #ff7d26, azul #2f5bff, faixa quadriculada; tokens em `apps/web/src/games/foxgp/theme.css`), e a cena
   3D pode ter PBR, sombras e pós-processamento, sempre com seletor de qualidade.
2. **Classificação individual:** 3 minutos, 1 volta valendo. Cada um sai do box, aquece e começa a volta quando quer
   (botão / tecla L, ou cruzando a linha depois de 250 m de aquecimento).
3. Entrega de uma vez só (commit no fim).

## 2. O que foi feito, por item

- **1.1 Travadas e vai-e-volta:** a tela desenha entre o estado anterior e o atual da simulação (passo fixo + interpolação
  de desenho); nada de reconciliação no offline. Medido no navegador com piloto automático: 60 s, 3.601 quadros, nenhum
  acima de 33 ms, zero vai-e-volta, salto máximo por quadro de 0,54 m (`e2e/foxgp.spec.ts`, "desenho liso").
- **1.2 Online:** a mesma infraestrutura do Fut Fox (sinalização `rtc` pela sala, STUN, canais `game` sem garantia e `ctl`
  com garantia). O aparelho do líder simula todos os carros (`GpHost`); os outros mandam a entrada, preveem o próprio carro
  e reconciliam com correção suave (`GpClient`); os outros carros são interpolados ~100 ms atrás. Sem conexão direta em
  6 s, a sala só repassa (`grin`, `grsnap`, `grev`). O líder relata à sala os tempos de todos e as posições (`gall`).
  Se o líder sai, a partida acaba. Rede simulada com 150 ms e 5 % de perda: sem teleporte (`net.test.ts`).
- **1.3 Colisão:** corpo rígido (massa, inércia, impulso no ponto de contato, restituição, atrito); batida de lado gira o
  carro; barreira com impulso e atrito; no online a batida é decidida pelo líder.
- **1.4 Física:** 8 marchas automáticas com curva de torque, arrasto, rolagem, círculo de aderência (acelerar, frear e
  virar dividem o pneu), freio progressivo. Corrigido um erro antigo: o carro nunca escorregava na curva.
- **2.1 Volta lançada individual** com animação de início e setores (S1, S2, S3) na HUD.
- **2.2 Câmeras:** distante, atrás do carro e cockpit (volante com marcha, bordas, sem ver o próprio carro); troca suave
  (600 ms) e preferência salva. Tecla C ou botão.
- **2.3 Pista nova:** Circuito da Marina (`GP_TRACK_MARINA`, ~1,5 km), traçado da imagem; barreira que se ajusta quando
  dois trechos passam perto; zebras, brita, arquibancadas amarelas com nome, marina com barcos, área verde, torres de luz,
  placas de freada, boxes. Minimapa com setores, linha de chegada, entrada do box e carros.
- **3.x Tema, garagem, HUD, gráficos, pódio:** tela inicial e garagem (prévia 3D ao vivo com órbita; pelo, carroceria,
  detalhe, desenho, número; salva no aparelho e vai para a sala por `gpaint`), HUD do artifact, qualidade baixa/média/alta
  (sombras, bloom, motion blur leve, SMAA, fumaça, faíscas, marcas de pneu), pódio 3D com confete.
- **4.x Transições, box e menu:** faixas do tema entre as etapas, box com equipe e barra de progresso, menu com câmera e
  qualidade além de pausar, encerrar e sair (o mesmo `GameMenu` dos outros jogos).

## 3. Testes

- Motor: `packages/games/src/foxgp/foxgp.test.ts` (48) e `net.test.ts` (5).
- Sala: `apps/api/src/rooms/foxgp-room.engine.test.ts` e `foxgp-room.integration.test.ts` (Colyseus real, inclusive o
  repasse da reserva).
- Web: `e2e/foxgp.spec.ts` (tela inicial, garagem, classificação, câmeras, qualidade, fluidez, box, pódio, celular).

## 4. Pendente

- **Teste online com duas janelas (`e2e/foxgp-online.spec.ts`)**: na última execução a líder clicou em "Fox GP" na aba
  Jogos e a sala não trocou de jogo (o teste esperou até o tempo esgotar). Falta descobrir se foi o servidor de teste
  (`rooms-only.ts`) antigo ainda ocupando a porta 3340 ou um erro na troca de jogo; depois, rodar o teste até o fim
  (classificação pelo líder, corrida com os dois no piloto automático, pódio).
- Jogar com 2+ aparelhos de verdade (WebRTC fora da mesma máquina) e no celular real.
- Calibrar os números marcados [AJUSTAR] (`packages/games/src/foxgp/constants.ts`).
