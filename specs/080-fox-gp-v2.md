# Spec 080: Fox GP v2 (dois modos de física, DRS e vácuo, 20 carros, gráficos, comandos)

Pedido em 11/11/2026 ("Fox GP v2: ordens de implementação"). Referência externa: o jogo
[hirosichen/ai-f1-racing-game](https://github.com/hirosichen/ai-f1-racing-game) (MIT, licença em
`THIRD_PARTY_LICENSES.md`), copiado e adaptado com autorização do Lucas. Status: **em andamento** na branch
`feat/fox-gp`.

## 1. Decisões (11/11/2026)

1. **Branch:** continua na `feat/fox-gp`. **Um commit só no fim**, não um por fase (pedido do Italo).
2. **Escala:** a pista continua com ~1,5 km e a máxima em ~32 m/s (320 km/h na tela). Do repositório vem o **modelo** do
   modo Realista; as constantes foram recalculadas para essa escala.
3. **Desgaste de pneu e parada no box:** ficam como estão, nos dois modos.
4. **Nome:** "Volta lançada".
5. **DRS na classificação:** liberado nas zonas para todos.
6. **DRS na corrida:** bloqueado até completar a 1ª volta (como na F1) e nunca para quem está em 1º.
7. **Fontes:** as do tema do Fox GP (Saira Condensed e Inter). Do repositório vem só o layout da HUD.
8. **Cor do pelo com 20 na sala:** a paleta passa de 8 para **10 cores**; do 11º jogador em diante a cor pode repetir. A
   barra de cor na classificação usa a carroceria do carro.
9. **Modo padrão:** Arcade, no jogo contra bots e ao criar uma sala.
10. **Turbo da cauda:** some dos dois modos. No lugar entram DRS e vácuo passivo, nos dois.
11. **Melhor volta e classificação separadas por modo.**
12. **Sala com um modo só**, escolhido pelo líder (regra "Física").
13. **Tecla da volta lançada:** continua **L** (remapeável no menu Comandos).
14. **Volta lançada:** só manual (o início automático ao cruzar a linha sai); uma volta por classificação; os 3 minutos
    continuam, com o tempo restante sempre visível; ao apertar, o carro vai para a largada (no online, quem leva é o
    líder) e fica sem colisão (a classificação já é de fantasmas); abrir o menu não pausa o online.

## 2. Plano por fase

- **0. Preparar:** ler a referência; teste de regressão do Arcade (`arcade-regression.test.ts`, cenário fixo em
  `regression-scenario.ts`, números em `regression.fixture.ts`); deixar verde o teste online com duas janelas.
- **1. Dois modos de física:** `GpPhysicsMode = 'arcade' | 'real'`; o passo de hoje vira o do Arcade sem mudar uma linha
  de cálculo; o Realista é o modelo do repositório (velocidade sempre alinhada com o nariz, curva limitada pela
  aderência lateral `GRIP0 + DF·v²`). Seletor na tela inicial (`nocap-gp-physics`) e regra da sala.
- **2. Sai o turbo, entram DRS e vácuo:** zonas de DRS calculadas pela curvatura da pista; DRS na tecla E; vácuo
  passivo (menos arrasto atrás de outro carro); protocolo da rede sobe de versão.
- **3. Bots diferentes:** perfil por bot gerado pela seed (arquétipos), IA com velocidade-alvo e ultrapassagem.
- **4. 20 carros:** grid, box e classificação para 20; sala até 20; estado enxuto na rede.
- **5. Gráficos:** céu, mapa de ambiente, sombras, texturas por código, placas, árvores, montanhas, pórtico, sobre as
  amostras do `GpTrack` (o traçado e a física não mudam).
- **6. Carro e raposa novos** (geometria do repositório, pintura com verniz, as quatro pinturas e o número).
- **7. Carro do menu gira** com mouse e dedo.
- **8. HUD:** classificação em cima à esquerda, seus dados em cima à direita, indicador de DRS, teclas à mostra.
- **9. Menu Comandos** com teclas remapeáveis (`nocap-gp-controls`).
- **10. Transições, largada e avisos** em fila.
- **11. Volta lançada manual** com o carro levado à largada.
- **12. Som do motor** novo (dente de serra + quadrada, filtro), com troca de marchas.

## 3. O que foi feito

Tudo num commit só, no fim. "Copiado" = trazido do repositório de referência; "adaptado" = mudado para caber no Fox GP.

### Fase 0

- Referência lida por inteiro (`main.js`, `index.html`).
- Regressão do Arcade gravada antes de mexer no motor: classificação (66,592 s), corrida de um carro (68,306 / 67,024 /
  67,538 s), batida na barreira e batida de traseira abaixo da velocidade do vácuo.
- **Teste online com duas janelas verde.** A troca de jogo funcionava (era o servidor de teste antigo na porta 3340). O
  teste achou um erro de verdade: no aparelho de quem não é líder, todo estado da corrida era descartado como "velho",
  porque a hora do líder recomeça do zero na largada e o aparelho comparava com a hora da classificação. Resultado: o
  carro dos outros parado e o relógio em 0:00. Correção em `GpClient.receive` (a troca de fase zera o relógio) com teste
  em `net.test.ts`.

### Fase 1: dois modos de física

- `GpPhysicsMode` (`'arcade' | 'real'`); `new GpWorld(seed, infos, pista, modo)`. O passo de hoje virou `stepArcade` sem
  mudar o cálculo (o teste de regressão passa igual); `stepReal` é o modelo da referência (adaptado): velocidade é um
  número sempre alinhado com o nariz; `latMax = GRIP0 + DF·v²`; esterço cai com a velocidade; pedir curva demais faz o
  carro abrir e perder velocidade (`GP_REAL_SCRUB`); entradas suavizadas; motor `min(ACC_MAX, POWER/v)`, arrasto,
  rolagem, freio `B0 + B1·v²`. Constantes `GP_REAL_*` recalculadas para a escala do jogo (entre-eixos 2,4 m, máxima ~32
  m/s, ~30 m/s² de aderência lateral a 32 m/s).
- Mantidos nos dois: marchas (no Realista só para desenho e som), superfícies, desgaste, limite do box, corte, ré.
- Colisão no Realista (decisão da spec): o empurrão simples da referência (`collidePlayer`: caixa do carro, empurrão de
  lado, troca de velocidade na traseira), sem giro solto; na barreira, empurra, alinha 25 % com a pista e corta a
  velocidade com espera de 0,3 s. No Arcade, o corpo rígido de antes. Online, quem decide é o líder nos dois.
- No Realista `skid` é sempre 0: sem fumaça nem marca de derrapagem.
- Escolha offline na tela inicial (`nocap-gp-physics`); na sala, regra "Física" (só o líder muda; o servidor só aceita
  `arcade` ou `real`; o lobby e a HUD mostram o modo). O aparelho de cada um prevê o próprio carro com o modo da sala.
- **Medidas:** máxima em reta no Realista ~32 m/s (320 km/h). Melhor volta mediana dos bots na Marina: Arcade 60,5 s,
  Realista 60,9 s. O mesmo piloto fixo do teste de regressão: Arcade 68,3 / 67,0 / 67,5 s; Realista 68,7 / 67,5 /
  72,9 s.

### Fase 2: sai o turbo, entram DRS e vácuo

- Turbo removido do motor, da rede (`GpInputRow` leva DRS no lugar), dos bots, da HUD (barra e botão), da tecla Espaço,
  do som, das dicas, do pódio ("Turbos da cauda" virou "Física") e da sala (`passes`, `gstat`). Protocolo da rede na
  versão 2 (`GP_NET_VERSION`): pacote de outra versão é ignorado.
- DRS (`track.drsZones`, `drsAt`): retas com raio acima de 150 m por 150 m ou mais; zona começa 20 m depois da curva e
  acaba 40 m antes. Na Marina: a reta norte (~210 m) e a seguinte (~100 m). Regras em `drsRules`: só na zona; na
  classificação liberado para todos; na corrida depois da 1ª volta e nunca para o 1º; fecha ao frear ou sair da zona.
  Efeito: arrasto 15 % menor (`GP_DRS_DRAG`). Tecla E; no celular o botão DRS ficou no lugar do antigo.
- Vácuo passivo: arrasto até 25 % menor colado no carro da frente (`GP_SLIP_DRAG`), multiplica com o DRS; vale para
  todos, inclusive bots. HUD com linhas de vento e o selo "Vácuo".
- Cena: a asa de trás abre suave; faixa verde, "DRS" no chão e placas de começo e fim; zonas no minimapa.

### Fase 3: bots diferentes

- `gpBotProfile(seed, vaga)`: Agressivo, Consistente, Defensivo, Rápido e errático, Novato (um de cada a cada 5 vagas,
  ordem pela seed), com talento, reação na largada, linha, freada, agressividade, consistência por curva, erro de freada,
  máxima ±2 % e distância de seguimento. IA adaptada da referência: velocidade-alvo pela curva (cada modo calcula a sua),
  linha de corrida, ultrapassagem por faixa livre, redução atrás do carro da frente, DRS. Mantidos: box e ré.
- Teste com 19 bots e 3 voltas nos dois modos: a ordem muda, os tempos diferem mais de 1,5 s, as faixas variam.

### Fase 4: 20 carros

- `GP_MAX_PLAYERS` 20; grid a cada 6 m (20 cabem em ~126 m); treino com até 19 bots; sala até 20.
- Cores do pelo: 10 (as 8 mais Branco e Prata); com mais de 10 na sala a cor pode repetir (a barra da classificação
  usa a carroceria).
- Rede enxuta: cada carro vai em 12 números (posição, direção, velocidade, volante, progresso, marcha, box/DRS, pneu,
  escorregão, vácuo); o estado físico completo vai só para o dono do carro (`gpSnapshotFor`). Medido no computador:
  passo com 20 carros ~0,2 ms; estado por aparelho ~1,3 KB a 30 por segundo (~37 KB/s). **Risco:** o líder manda isso
  para até 19 pessoas (~700 KB/s de envio). Falta medir num celular como líder (ver Pendente).
- Sombra só dos carros a até 70 m do foco; geometria do carro compartilhada entre todos.
- No navegador (teste e2e): 20 carros no Realista com piloto automático, sem vai-e-volta nem salto.

### Fase 5: gráficos

- Copiado e adaptado da referência: tone mapping neutro, `Sky` e mapa de ambiente gerado do céu (média e alta),
  névoa, sol que segue o foco, texturas por código (asfalto cinza com granulado e faixa de borracha, grama com faixas de
  corte, torcida, placas, alambrado), placas com marcas fictícias (FOX ENERGY, NOCAP, TOCA TYRES, FOX GP, RABO LISO,
  FAÍSCA), postes instanciados, montanhas por código, árvores instanciadas (sem nascer perto da pista nem na água),
  `polygonOffset` nas faixas pintadas, marcas do grid para 20, pórtico com 5 colunas de 2 luzes.
- Tudo em cima das amostras do `GpTrack`: traçado, barreira e minimapa iguais. Mantidos: marina com barcos, área verde,
  torres de luz, placas de freada, boxes, arquibancadas com nome. Baixa: sem céu, sem sombra, sem montanhas.

### Fase 6: carro, personalização e raposa

- Carro da referência (loft em superelipse, asas, halo, suspensão; uma malha por material; rodas com pneu, aro e faixa;
  dianteiras esterçam; todas giram), reduzido para o tamanho do jogo. Pintura com verniz. `body` = cor e desenho
  (os quatro desenhos como textura vista de cima, com o número no bico e na tampa do motor); `accent` = asas, entradas
  de ar e topo das laterais; `fur` = a raposa, arredondada (cabeça, focinho afinado, orelhas com o lado de dentro claro,
  bochechas, olhos, nariz) com capacete aberto na cor do carro; cauda de enfeite. O que já estava salvo continua valendo.
- Mesma peça na pista, na garagem, no lobby e no pódio. Mudou o RULES.md (exceção 9) com o OK do Italo.

### Fase 7: carro do menu gira

- Arrastar com mouse ou dedo; inércia ao soltar; volta a girar sozinho depois de ~3 s; cursor de mão; arrastar não
  aciona os botões (teste e2e).

### Fase 8: HUD

- Em cima à esquerda, a classificação (cabeçalho com a volta ou o tempo restante da classificação; posição, cor da
  carroceria, nome, diferença para o da frente, "+1 volta"; a sua linha destacada; 20 linhas no computador; no celular o
  líder e cinco em volta de você). Em cima à direita, botões com a tecla (Esc e C) e os seus dados (P x/20, volta atual,
  última, melhor, setores). Embaixo: minimapa, DRS no meio, velocímetro com o selo do modo e do vácuo.

### Fase 9: menu Comandos

- `gp-settings.ts` (zustand, chave `nocap-gp-controls`, como o Counter Fox): acelerar, frear, esquerda, direita, DRS,
  câmera, volta lançada, cada um com principal e secundária; menu fixo no Esc. "Pressione uma tecla", Esc cancela,
  conflito avisa e oferece trocar, "Restaurar padrão", vale na hora (HUD, dicas e "Aperte [tecla]"). Na tela inicial e no
  menu da partida. No celular, explica os botões.

### Fase 10: transições, largada e avisos

- Fila única de avisos (`notices.ts`, com teste): pelo menos 2 s cada, entrada e saída de 350 ms, um por vez, no centro
  em cima; tipos informação, destaque, DRS, alerta e resultado, com ícone em SVG. Todos os avisos antigos passaram por
  ela.
- Largada: grid, 5 luzes acendendo (HUD e pórtico juntos), espera sorteada (0,6 a 1,8 s; na sala o servidor sorteia e
  manda `holdMs`; no treino, a seed), luzes apagam, "Vai!". Antes disso o carro não anda (o acelerador só sobe o giro).

### Fase 11: volta lançada manual

- A tecla L (ou o botão grande) leva o carro para a linha, parado e alinhado, com contagem de 3 s; o tempo começa quando
  ela acaba. Sem início automático; uma volta só; os 3 minutos sempre visíveis; na classificação os carros são
  fantasmas (dois na largada ao mesmo tempo não batem); no online quem leva o carro é o líder; o menu não pausa o online.

### Fase 12: som do motor

- Voz da referência (dente de serra a 1,5× e quadrada a 0,75× da rotação, passa-baixa, ganho), no mesmo `AudioContext`
  do `sfx` (mudo respeitado). Rotação pela marcha e giro do motor (sobe em cada marcha, cai na troca); parado, o
  acelerador só sobe o giro. Sem som de turbo; bipe do DRS. Os três carros mais perto com som (opcional) ficaram de fora.

### Erros achados no caminho

- Online: estados da corrida descartados no aparelho de quem não é líder (Fase 0).
- Um pedido de um toque só (iniciar a volta, DRS de toque) se perdia num quadro sem passo de simulação (tela acima de
  60 quadros por segundo). Agora fica guardado até um passo usar.

## 4. Testes

- Motor: `foxgp.test.ts` (55), `foxgp-v2.test.ts` (14), `arcade-regression.test.ts` (4), `net.test.ts` (7).
- Sala: `foxgp-room.engine.test.ts` e `foxgp-room.integration.test.ts` (22).
- Web: `notices.test.ts`, `format.test.ts`; `e2e/foxgp.spec.ts` (10: tela inicial, Comandos, volta lançada, DRS,
  câmeras e qualidade, 20 carros no Realista, fluidez, box, largada e pódio, celular) e `e2e/foxgp-online.spec.ts` (duas
  janelas no Realista) verdes em 11/11/2026.

## 5. Pendente

- **Celular como líder com 20 carros:** medir quadros por segundo e envio de rede num celular real (a conta dá ~700
  KB/s de envio). Se não aguentar, registrar o limite (por exemplo: 20 só com líder no computador) e avisar o Lucas.
- Medir quadros por segundo com 20 carros na qualidade baixa num celular real.
- Jogar com aparelhos reais (WebRTC fora da mesma máquina) e calibrar os [AJUSTAR] e os `GP_REAL_*` jogando.
- Som dos três carros mais perto (opcional da Fase 12).
