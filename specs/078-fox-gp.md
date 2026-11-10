# Spec 078: Fox GP (corrida de F1 das raposas)

Pedido em 10/11/2026, com o documento de regras "Fox GP — Regras do jogo". Status: **em andamento** (branch `feat/fox-gp`).

## 1. O que é

Corrida arcade de Fórmula 1 em voxel, câmera isométrica de cima (a mesma do Atravessa!), pilotada pela raposa de boné.
Faz parte do Fox Cap! (Fut Fox, Counter Fox, Desmorona!, Ping Fox!). Corrida curta de **3 voltas** (~2 min), até
**8 raposas** por sala, no celular e no PC. Vence quem cruzar a linha primeiro.

## 2. Decisões (10/11/2026)

1. Branch própria `feat/fox-gp`, saída da `main`.
2. Entra **tudo**: motor, treino offline contra bots (classificação, corrida, box, turbo, pódio) e sala online de 2 a 8
   (sala própria e dentro da sala trocável do Fox Cap!).
3. **Uma pista** no lançamento ("Circuito da Toca"). A escolha de pista fica para depois.
4. **Vale a regra de 30 s**: quando o primeiro termina, quem não cruzar a linha em 30 s recebe DNF.
5. **Quem entra com a corrida andando espera**: assiste e joga a próxima.
6. **Sem ranking, sem histórico e sem estatísticas** (como o Desmorona! e o Fut Fox).

## 3. Regras (resumo do documento; valores em `packages/games/src/foxgp/constants.ts`)

- **Sala e cores:** cada pessoa escolhe a cor do pelo no lobby (a "Garagem"), paleta do Atravessa! (`ATR_ROOM_COLORS`).
  A pintura do carro acompanha o pelo; pelo azulado leva boné laranja (`buildHero`). Cor é só visual: todos os carros
  são iguais.
- **Fluxo:** lobby → classificação → grid → semáforo (5 luzes no pórtico; apagaram, valeu) → 3 voltas → chegada → pódio
  (Revanche e Voltar à sala).
- **Classificação:** todos ao mesmo tempo, cada um como "fantasma" (sem colisão), uma volta lançada cronometrada. Grid do
  menor para o maior tempo; empate, larga na frente quem marcou primeiro; sem tempo (saiu, 60 s esgotados) larga no fim.
  Tempo máximo da sessão: **60 s**.
- **Controles:** acelerar (↑/W), frear e ré (↓/S), virar (←→/A D), turbo (Espaço). No celular: direção à esquerda;
  acelerar, frear e turbo à direita (o turbo fica colado ao acelerador, para apertar sem soltar).
- **Turbo da cauda (no lugar do DRS):** a barra enche no vácuo (atrás e alinhado a outro carro, mais rápido quanto mais
  perto). Cheia, solta o turbo: **+15 %** de velocidade máxima por **2,5 s**. Não acumula; esvazia toda. O 1º colocado
  nunca enche. A cauda da raposa balança mais forte enquanto enche.
- **Colisões e limites:** carros se empurram (ninguém roda nem quebra). Grama: máxima cai a **60 %**; brita: **40 %**.
  Zebra não atrasa. Barreira de pneus para o carro, que pode voltar. Cortar caminho (pular um trecho) devolve o carro ao
  último ponto válido.
- **Chegada:** termina quando todos cruzam a linha depois da 3ª volta, ou 30 s depois do primeiro (DNF para os outros,
  na ordem da distância percorrida). Quem terminou assiste (segue um carro; troca com ‹ ›). Desconectou: some e é DNF.
- **Pneus e box:** gastam com distância, curva forte, freada brusca e tempo fora da pista; com pneu gasto o carro
  escorrega e freia pior (nunca para). Calibrado para chegar perto do fim no fim da 3ª volta. Box: faixa com velocidade
  limitada e uma vaga; parar na vaga segura o carro **3 s** e devolve pneu novo.
- **HUD:** posição (P4/8), volta (2/3), tempo, classificação ao vivo com a cor de cada raposa e a diferença para o líder,
  minimapa, velocidade e marcha, barra do turbo, desgaste dos pneus, marcador "Você".
- **Pódio:** 3 primeiros no pódio (o campeão com troféu), tabela com posição, piloto e tempo (vencedor com o total, os
  outros com a diferença), destaques (volta mais rápida e ultrapassagens com o turbo).

## 4. Técnica

- **Motor puro** em `packages/games/src/foxgp`: pista (linha central fechada por pontos de controle, superfícies,
  zebras, brita, barreira, box), física arcade do carro (passo fixo de 1/60 s), vácuo e turbo, pneus, colisão entre
  carros, corte de caminho, voltas e tempos, classificação e grid, chegada e DNF, bots. Determinístico pela seed.
- **Rede** (como o Desmorona!): cada aparelho simula só o próprio carro e manda `gpos` (~15/s). A sala repassa as
  posições (`pos`, 10/s) e decide o que precisa ser igual para todos: hora da classificação e da largada, tempos de
  classificação (`gq`), voltas e chegada (`glap`, `gfin`), grid, regra dos 30 s, DNF e o fim. A colisão online é feita
  por cada aparelho para o próprio carro contra a posição suavizada dos outros (os dois lados se empurram). Validação
  leve (tempo mínimo de volta, progresso plausível): jogo entre amigos, sem ranking.
- **Web** em `apps/web/src/games/foxgp`: cena three com câmera ortográfica isométrica, carro em voxel com a raposa no
  cockpit, HUD em Pop Brutal, controles de teclado e de toque, treino contra 1 a 7 bots, tela de pódio, sala.
- **API:** `FoxGpRoomEngine` (`apps/api/src/rooms/foxgp-room.engine.ts`) e `FoxGpRoom` (`foxgp`), também na sala do
  Fox Cap! (`pickgame`).

## 5. Testes

- Motor: pista fechada e contínua; superfícies; carro acelera, freia e respeita a máxima por superfície; turbo só com a
  barra cheia e não acumula; líder não enche; pneus gastam e baixam a aderência; corte de caminho volta ao ponto válido;
  barreira segura o carro; box troca o pneu em 3 s; volta conta só na ordem; grid ordenado com empate e sem tempo;
  regra dos 30 s; mesma seed, mesma corrida; bots terminam a corrida.
- Sala: fases (classificação → grid → corrida → final), grid pelos tempos, DNF dos 30 s, desconexão, quem entra no meio
  espera, cores; integração com o Colyseus real.

## 6. Falta (depois desta etapa)

- Calibrar em playtest todos os números marcados **[AJUSTAR]** no documento (estão em `constants.ts`).
- Mais pistas e escolha pelo líder.
- Jogar ao vivo com 2+ aparelhos e no celular real.
