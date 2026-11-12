# Spec 081: Fox GP v3 (kart arcade, F1 realista, hub, sala, avisos e som)

Pedido em 12/11/2026 ("Fox GP v3: ordens de implementação", com `racing-kart.zip` e
`Karting_Club_Lider__Outdoor_Race_Track_Ready.usdz`). Base: a branch `feat/fox-gp-v3` (commit `c457f0b`, primeira
rodada do Lucas com o Gemini), sobre a `main` com a v2 (spec 080). Status: **em andamento**.

## 1. Decisões

Do Lucas (seções 3 e 4 das ordens):

1. O turbo do Arcade enche sozinho enquanto anda, e mais rápido no drift.
2. O drift não dá impulso ao soltar: enche a barra mais rápido e dá um pouco mais de velocidade enquanto dura. Só pode
   ser ativado quando estiver liberado.
3. Barra do turbo em 3 terços (azul, laranja, rosa); usar gasta a barra toda e o nível é o terço atingido.
4. Limite de 12 carros, offline e online, sem travar.
5. Carros ~2× mais largos (cabem 3 lado a lado na pista de 14 m; 4 não).
6. O Arcade antigo deixa de existir: o Arcade novo é o kart (a regressão do Arcade antigo é aposentada).
7. Carrossel da tela inicial entre o F1 (Realista) e o kart (Arcade), só para ver; o modo se escolhe em "Antes de
   correr" (e no lobby, pela regra Física).
8. Teclas do Arcade: drift = Espaço, turbo = E (remapeáveis; no toque, dois botões).
9. O Arcade não tem vácuo, desgaste de pneu nem box: só o Realista.
10. Carro do Arcade = o kart do `racing-kart.zip`; pista do Arcade = a do `.usdz`, com o nome "Bala Track" (o nome não
    aparece em placa, logo, ícone nem som). O Realista continua com o F1 na Marina.
11. Cabeça de raposa no lugar do capacete do kart; se não ficar boa, capacete (com a opção na garagem nos dois casos).
12. Personalização continua (kart e F1 com garagens separadas; a raposa é a mesma nos dois).
13. Kart e pista sem licença conhecida: uso autorizado pelo Lucas, registrado em `THIRD_PARTY_LICENSES.md`.
14. Mecânicas da Bala Track: placas de turbo, zebras que tiram velocidade e vibram, pilha de pneus que rebate para
    trás, muro de metal normal, grama que freia, semáforo de 5 luzes.
15. Velocidade na tela: Realista com máxima de ~40 m/s mostrada ×8,5 (~340 km/h).

Do Italo nesta sessão (12/11/2026):

16. **Um commit por fase** (como as ordens pedem; na v2 tinha sido um só no fim).
17. **Ferramentas de arte:** sem Blender na máquina. A pista é lida com `usd-core` (pip, só ferramenta, fora do
    `package.json`); o kart (OBJ) é adaptado por scripts próprios em `tools/art/` (simplificar, separar peças, pivôs,
    exportar GLB). A cabeça de raposa e os braços são feitos em código, sem esqueleto rigado no arquivo.
18. **Som:** só síntese em Web Audio (nenhum arquivo baixado, nenhuma licença a conferir).

## 2. Ordem

As ordens mandam fazer a **Fase 13** (revisão do que a branch do Gemini fez) primeiro; depois as Fases 0 a 12 e a
verificação final.

## 3. Fase 13: revisão da branch `feat/fox-gp-v3` (feita em 12/11/2026)

- **13.1 Carro da tela inicial:** a caixa do carro voltou à da `main` (`top: 10vh`, `height: 70vh`,
  `width: min(60vw, 860px)`), fora da grade; o e2e confere a caixa em 1440×810 (±2 px).
- **13.2 Carrossel:** saiu da coluna de botões; fica embaixo do carro, centrado sob ele, com o modo e o veículo
  ("Realista · F1") e a melhor volta offline do modo. Setas, ← → e arrastar de lado trocam o carro; como o kart ainda
  não existe, há um carro só e as setas somem (`GP_HOME_VEHICLES` em `vehicles.ts`). Trocar o carro não muda o modo.
- **13.3 Batida entre carros:** a hitbox OBB ficou; a resposta foi refeita. Impulso de corpo rígido com massas iguais
  na normal do contato (`GP_BUMP_E = 0,2`, atrito `GP_BUMP_MU = 0,15`, parte que vira velocidade `GP_BUMP_SOFT = 0,65`)
  **uma vez por contato** (`contacts` guarda os pares encostados); nos passos seguintes só a separação pela posição,
  sem perder velocidade; impulso novo só com aproximação acima de `GP_BUMP_REARM = 10 m/s`. Giro limitado
  (`GP_BUMP_SPIN_MAX = 0,6 rad/s`) que some em ~0,5 s no Realista (`GP_BUMP_SPIN_DAMP`). No Realista a parte de lado
  do impulso vira um empurrão que some sozinho (`kx`/`kz`, `GP_BUMP_KNOCK_DAMP`), sem escorregão. A mesma função
  serve os dois modos (o `collideReal` saiu). Pacote do carro com 32 números.
  - Testes novos nos dois modos (substituem os que a branch afrouxou): traseira com 8 m/s de diferença (quem bate perde
    1,5 a 3,6 m/s, o da frente ganha mais de 1,5 m/s, ninguém atravessa, 1 s depois quem bateu acelera); a perda não
    se acumula (3 ou 12 passos de contato dão a mesma velocidade); raspada de lado a 30 m/s fica acima de 85 %; de
    frente a 20 m/s cada os dois perdem uma vez e não param em 3 passos; a quantidade de movimento se conserva; o giro
    de uma batida de lado é limitado e some.
  - Sobre a meta "quem bate perde ≤ 25 % do impacto": com massas iguais e sem atravessar, quem bate perde pelo menos
    metade da diferença (4 m/s em 8). A meta foi lida pelo número absoluto das ordens ("2 a 3 m/s"): quem bate perde
    ~3 m/s, e o resto do contato sai como separação de posição.
- **13.4 Obstáculo amarelo:** confirmado: eram as arquibancadas. Elas eram postas a partir da barreira do próprio
  trecho, sem olhar o que há atrás; onde a Marina dobra sobre si mesma, caíam no asfalto do outro trecho (há um teste
  que reproduz isso com o posicionamento antigo). Agora `scenery.ts` (motor, função pura) decide onde arquibancadas
  (`gpStandSlots`: 3 degraus com telhado, menos degraus ou sem telhado, ou pula o trecho), garagens do box
  (`gpGarageSlots`, agora atrás da barreira), torres de luz (`gpTowerSlots`) e placas de freada (`gpBoardSlots`) cabem,
  conferindo a distância até a linha central de **todas** as amostras, a barreira de cada trecho e a faixa do box. A
  cena só desenha o que essas funções devolvem. Teste com um verificador independente nas duas pistas.
  - As faixas de setor que atravessavam a pista viraram dois postes brancos finos fora da zebra; as setas amarelas no
    asfalto antes do box saíram (a sinalização do box é a da Fase 10); no minimapa, o setor virou um ponto pequeno.
- **13.5 "Kart" e "Bala Track":** escondidos até existirem (`GP_KART_READY = false`); o cartão do Arcade diz o que vale
  hoje ("Arcade · F1", Circuito da Marina, "Física solta: o carro escorrega de lado").
- **13.6 Números:** textos de 20 carros, 19 bots, 3 minutos e 30 s corrigidos (tela inicial, sala, lobby, regras,
  comentários, testes); `GP_ROOM_MAX_RACE_SEC` de 420 para 600 s (3 voltas mais o DNF de 2 min ficam abaixo); teste do
  servidor com 12 vagas e a 13ª recusada. A paleta de pelo da sala (`GP_ROOM_COLORS`) sai na Fase 8.
- **13.7:** spec criada; testes rigorosos de novo (acima).
- **13.8:** quem assiste sempre vê o nome do piloto seguido (fora do cockpit); o próprio carro nunca tem etiqueta.
  O ramo do Fox GP no `FoxCapPage` (que a branch tirou do `<Page>`) tinha perdido os diálogos de apelido e de sala
  aberta: voltaram (sem eles, criar sala sem apelido travava).
- **1.5 Saída da partida:** causa no online: `leaveRoom()` fecha a sala na hora e espera o servidor (até 1,5 s) antes
  de navegar, e nesse meio a tela da sala aparecia. Agora navega primeiro e sai da sala depois. Ao voltar de uma
  partida (offline ou online) a tela do Fox GP abre sem a animação de entrada (sinal `nocap-gp-back` no
  `sessionStorage`). e2e: offline e online, observando o DOM a cada quadro, nenhum quadro da lista do Fox Cap! nem da
  sala.

**Lint:** sem erro novo. Os 28 erros que sobram em `pnpm lint` já estavam na `main` e são de outros jogos (Counter Fox,
Ping Fox!, Atravessa!, scripts): variáveis sem uso e regras `react-hooks` sem o plugin. Ficaram de fora desta branch.

## 4. Fase 0: medidas de antes (12/11/2026, depois da Fase 13)

| Medida | Valor |
|---|---|
| Melhor volta dos bots, Marina, 12 carros (mediana, mín a máx) | Arcade 60,2 s (59,7 a 62,0); Realista 60,4 s (59,9 a 61,0) |
| Custo do passo do motor com 12 carros (Node, este computador) | 0,03 ms |
| Desenho com 12 carros juntos no Realista, 20 s (Chrome sem janela, qualidade média) | ~60 quadros/s (1195 quadros), 1 quadro lento, sem vai-e-volta |
| Desenho liso, 1 carro no piloto automático, 60 s | 3581 quadros, 3 lentos, salto máximo 1,2 m |

Ferramenta: `measure_laps.cjs` (só trabalho) roda classificação e corrida inteira com bots de perfil.

## 5. Fase 1: tela inicial, Antes de correr e painéis (12/11/2026)

- **Causa da faixa quadriculada em cima dos botões:** as faixas inclinadas do fundo passam 140 px da tela; com
  `overflow: hidden`, o foco de um botão rolava a tela inteira (a faixa subia, os botões saíam pela esquerda). Agora
  `overflow: clip`.
- Marca e título num bloco (`.gph-head`); três arranjos sem rolagem: desktop (como antes), **celular deitado**
  (≤ 520 px de altura: duas colunas, título numa linha e botões em grade de 2 à esquerda, carro à direita, carrossel
  embaixo do carro) e **tela em pé** (título em cima, carro no meio com o carrossel, menu embaixo). Painéis online e
  pistas compactos na tela baixa; o campo do código não estoura na tela estreita.
- "Antes de correr" em duas colunas na tela baixa (modos à esquerda; adversários, garagem e botões à direita).
- **Teste de tamanhos** (`e2e/foxgp-sizes.spec.ts`): 1920×1080, 1536×864, 1366×768, 1280×720, 1024×768, 844×390,
  667×375, 390×844 e o zoom de 125 % (1024×576 e 1229×691). Em cada um, tela inicial, Antes de correr, online e
  pistas: nada rolado nem rolando, todo botão inteiro dentro da janela, nenhum encostando na faixa quadriculada, texto
  sem estourar o botão. A **garagem** entra nesse teste na Fase 8, quando é refeita (hoje ela rola por dentro em
  telas pequenas; `E2E_GARAGE=1` já roda a conferência dela).

## 6. Fase 2: limite de 12 e fim das travadas (12/11/2026)

- **Limite de 12** em todo lugar (motor, sala, lobby, treino, textos e testes; a 13ª vaga é recusada pelo servidor):
  feito na Fase 13.
- **Painel de desempenho** (`perf.ts`, só no desenvolvimento, `?perf=1`): tempo médio e máximo por quadro da simulação,
  dos bots, do desenho, do HUD e da rede, e os quadros acima de 33 ms; o teste lê `window.__gpPerf`.
- **Medida** (Intel UHD integrada, Chrome, 1280×720, qualidade média, 12 carros juntos desde a largada, 60 s):

  | | Antes | Depois |
  |---|---|---|
  | Quadros acima de 33 ms | 166 (com outra aba 3D aberta) / 1 pico de 46 ms (sozinho) | **0** |
  | Maior intervalo entre quadros | 299 ms | **17 ms** |
  | Desenho (média / máximo) | 7,8 / 145 ms (com a outra aba) e 3,3 / 46 ms | **3,1 / 9,7 ms** |
  | Simulação + bots (média) | 0,30 ms | 0,11 ms |

- **Causa das travadas:** o que aparecia pela primeira vez na câmera subia para a placa de vídeo naquele quadro:
  geometria dos trechos da pista ainda não vistos, texturas e, principalmente, o shader das faíscas e da fumaça, que
  compilava na **primeira batida da largada** (justo quando estão todos juntos). Agora a cena faz um aquecimento
  (`warmUp`) antes da corrida: desliga o recorte por câmera, mostra uma faísca e uma fumaça escondidas, sobe todas as
  texturas, compila e desenha uma vez.
- Suspeitas conferidas e que não pesavam: HUD (já a ~9 Hz; 0,01 ms), simulação (66 pares de colisão, 0,08 ms),
  pós-processamento (só na qualidade alta), sombras (só dos carros a menos de 70 m do foco), partículas (fumaça em
  piscina de 80, faíscas numa malha instanciada de 120).
- **Pendente (precisa de aparelho):** 30 quadros/s no celular na qualidade baixa e o líder com 11 conexões num celular.
- e2e novo: "12 carros juntos desde a largada: 60 s sem quadro acima de 33 ms".

## 7. Fase 3: carros maiores (12/11/2026)

- Caixa do carro **6,5 × 3,6 m** (`GP_CAR_LEN`, `GP_CAR_WID`), a mesma para os dois modos e para o kart que vem na Fase 6.
  Na pista de 14 m cabem 3 lado a lado com 0,6 m entre eles e 4 não (teste `size.test.ts`, que também confere o grid
  de 12 inteiro no asfalto e sem encostar).
- Derivados do tamanho: círculos da barreira do Arcade antigo (`GP_CAR_R`, `GP_CAR_HALF`), encosto na barreira
  (`GP_CAR_WALL_IN`), inércia, grid (`GP_GRID_FIRST −14`, `GP_GRID_GAP 8`, `GP_GRID_SIDE 3,3`), faixa e vaga do box
  (`GP_PIT_HALF 3,5`, `GP_PIT_BOX_LEN 9`), vácuo (`GP_SLIP_MIN`, `GP_SLIP_LEN 30`, `GP_SLIP_W 3,2`), bots (borda,
  faixa de ultrapassagem, distância de seguir e faixa livre pelo tamanho do carro).
- O **entre-eixos do Realista** continua 2,4 m: é número de pilotagem (raio da curva), não medida do desenho; a Fase 4
  refaz a pilotagem.
- Cena: o modelo das prévias (~3,6 m) aparece na pista na escala `CAR_VIS` (6,5 / 3,56); rodas, câmeras (atrás do carro,
  cockpit, distante), marcas de pneu, marcas do grid e equipe do box acompanham.
- **Regressão do Arcade antigo aposentada** (decisão 6): `arcade-regression.test.ts`, `regression-scenario.ts` e
  `regression.fixture.ts` saíram; o Arcade vira o kart na Fase 5.
- Desempenho depois da mudança (12 carros juntos, 60 s): desenho 3,1 ms de média (11 ms no pior), nenhum quadro do jogo
  acima de 33 ms. Para isso: faíscas sem lista nova por quadro, vetor da câmera reaproveitado, sombra só dos carros a
  até 45 m. O teste aceita até 2 quadros de tela perdidos pelo sistema em 3600 (sem trabalho do jogo por trás).
- HUD: com o selo "Vácuo" a marcha saía do painel; agora os selos ficam embaixo do rótulo.

## 8. Fase 4: Realista com física de F1 (12/11/2026)

Números escolhidos por uma busca em grade nos alvos das ordens e conferidos pelos testes do motor (`realista.test.ts`):

| O quê | Antes | Agora |
|---|---|---|
| Aderência lateral `GRIP0 + DF·v²` | 18 + 0,012·v² | **9 + 0,0023·v²** |
| Máxima sem escorregar: grampo 15 m / fechada 25 m / média 60 m / rápida 120 m | 17 / 22 / 32 / cheia | **11,9 / 15,5 / 25 / ~40 m/s** |
| Freio `B0 + B2·v²` | 22 + 0,008·v² | **6 + 0,0015·v²** |
| Freada 40→12 m/s (freio cheio) | — | **~3,8 s e ~80 m** (alvo ≤ 4,2 s e ~85 m) |
| Freada 25→12 m/s | — | **≤ 35 m** |
| Motor | `min(9, 120/v)`, câmbio só desenhado | **câmbio de verdade**: `210 × torque(giro) / máxima da marcha`, até 10 m/s²; 8 marchas até 40,5 m/s; corte de 0,12 s na troca |
| 0→15 / 15→30 / 30→39 m/s | — | **1,9 / 3,6 / 7,6 s** |
| Máxima | 32 m/s (320 na tela, ×10) | **40,5 m/s no limitador da 8ª (≈ 344 na tela, ×8,5)** |
| Arrasto / rolagem | 0,0034 / 0,25 | 0,002 / 0,3 |
| Perda ao pedir curva demais | até 7 m/s² | 7 m/s² × excesso, até 2× (passar mais do ponto custa mais) |
| Limitador do box | 17 m/s | 20 m/s (170 km/h na tela) |
| Melhor volta dos bots, Marina, 12 carros (mediana) | 60,4 s | **78,3 s** (classificação, pista livre: 73,5 s) |

- O giro (`rpm`) e a marcha que a HUD e o som usam agora são os que movem o carro (`GP_REAL_GEAR_TOP`, campo
  `shiftT` no carro e no pacote, que passou a ter 33 números).
- **Freio diferente do sugerido:** as ordens sugeriam `BRAKE0` 14 a 15 e `BRAKE_V2` ~0,006, mas com isso a freada de 40 a
  12 m/s levaria ~1,5 s e ~38 m, longe do alvo das próprias ordens (~85 m). Valem os alvos.
- Velocidade na tela ×8,5 nos dois modos (`GP_KMH_PER_MS`); a máxima de cada modo em `gpVmaxOf`.
- Bots: velocidade de curva pela aderência nova, freio que eles contam ter = 92 % do real, máxima do modo.
- Testes que presumiam a escala antiga (máxima de 320, km/h ×10, vácuo, voltas iguais nos dois modos) foram atualizados;
  "voltas parecidas nos dois modos" saiu (os modos agora são carros diferentes).
- **Falta jogando:** confirmar que dá para terminar uma volta sem sair da pista depois de 3 voltas de prática.

## 9. Fases 5 a 12 (12/11/2026; um commit só no fim, a pedido do Italo)

### Fase 5: o Arcade é o kart
- `stepKart` no lugar do Arcade antigo (`GP_ARC_*`): velocidade para o nariz (não escorrega), direção rápida
  (2,2 → 1,1 rad/s), quase sem perda curvando, sem marchas. Máxima 26 m/s (~220 km/h na tela; 28 deixava a volta de bot
  abaixo de 50 s na Bala Track).
- Drift liberado acima de 40 % da máxima, com volante, no asfalto ou na zebra; entra ao apertar (com 0,3 s de folga se
  o volante ainda não passou do mínimo), pulinho, lado travado; volante para dentro fecha (×1,4) e para fora abre
  (×0,65); +6 % de máxima; enche a barra ×3,5 (até ×1,4 com o volante todo para dentro). Muro, grama e batida cancelam.
- Barra de 0 a 3 (azul, laranja, rosa), cheia em 45 s andando; turbo gasta a barra toda, nível = terço atingido
  (0,9 s +35 %, 1,8 s +45 %, 3 s +55 %), rampa de 0,4 s no fim; sem barra: evento `noturbo`.
- Sem vácuo, desgaste, box nem DRS no Arcade. Zebra 88 %, grama 55 %, brita 40 %; muro de metal guarda 65 %; pilha de
  pneus rebate para trás (metade). Bots com `driftLove` e `turboAt` por arquétipo.
- Rede v3: entrada com drift e turbo (8 números), estado enxuto com nível do turbo, barra e drift (14), pacote completo
  com 45 números. HUD do kart (drift, barra em 3 terços, linhas de velocidade), botões de toque Drift e Turbo, tecla de
  drift no Espaço (a tecla do DRS é o turbo no Arcade), opção de desligar a tremida no menu Comandos.
- Testes: `kart.test.ts` (drift, raio, enchimento, 3 níveis, sem barra, sem pneu/vácuo/box/DRS, zebra, muro, pneus,
  volta de bot com drift e turbo, pacote).

### Fase 6: o kart 3D
- `tools/art/kart/build_kart.py` (sem Blender): separa peças por objeto e o piloto por região (corpo, braço e antebraço
  de cada lado, mãos, capacete), corta a cabeça no pescoço (y 0,80), separa aro e coluna do volante (eixo pela
  dispersão do anel), recentraliza rodas, um material por peça, simplifica por agrupamento em grade. Resultado:
  `kart.glb` com ~9,9 mil triângulos visíveis (piloto ~4,2 mil com braços e mãos), 238 KB; `kart-lod.glb` 5,3 mil;
  `kart-rig.json` com ombros, cotovelos, punhos e o eixo do aro.
- `kart-model.ts`: carrega só no Arcade; mesma interface do F1; mãos presas ao aro (giram com ele), braços por IK de
  dois ossos, rodas que giram e esterçam, pedais, cabeça que inclina, orelhas, motor vibrando. Cabeça de raposa em
  código (`fox-head.ts`); capacete do arquivo como plano B (opção na garagem).
- Na pista o kart tem a largura da caixa de colisão (3,6 m).

### Fase 6B: Bala Track
- `tools/art/track/extract_track.py` (usd-core): rasteriza o asfalto visto de cima; o complexo tem vários traçados e o
  circuito de corrida é o das marcas de borracha (`rgroove_t1..t11`), seguido por pontos-guia, recentrados no asfalto e
  suavizados. Escala pela largura (12,5 m): 0,203 m por unidade, 1,27 km de linha central (pela regra de ~1,2 km a pista
  ficaria com 10 m). Pilhas de pneus do arquivo viram trechos de barreira de pneus.
- `track-bala.ts` (gerado), box opcional de verdade (`pit: null`), barreira por tipo (`wallKind`), 4 placas de turbo
  (início das 4 retas sem zebra), pista pelo modo (`gpTrackDefFor`). Volta de bot: 50,4 s (alvo 50 a 65).
- Cena: guard-rail azul onde é muro e pilhas de pneus onde o arquivo tem pneus (o mesmo tipo que o motor usa), placas
  de setas azuis com pulso que varre (sem varredura na baixa e com movimento reduzido), céu mais claro, minimapa com as
  placas. O que se vê é o que se bate: a cena é gerada do mesmo `GpTrack`.

### Fase 7: F1
- `paint.ts` no motor: 24 cores (vivas, escuras, metálicas), 12 desenhos, 4 acabamentos, 3 estilos de número, aro (12
  cores, 4 estilos), faixa do pneu, capacete, luva, asa; validação por lista fechada (campos novos opcionais: pinturas
  antigas valem).
- Número em adesivos (bico, tampa do motor, laterais) postos na superfície por raio e virados para quem lê de fora: não
  há mais número espelhado.
- Raposa sem cauda (cabeça nova com capacete aberto). Volante do cockpit de F1: corpo com bisel, empunhaduras, botões,
  10 luzes de troca que acendem com o giro, luvas com polegar, punho e pata.

### Fase 8: garagem e sala
- Garagem v2 (`{ v: 2, fur, paint, kart }`, migra a antiga): abas Kart e F1, sub-abas que cabem sem rolagem; abre no
  veículo do modo. Sala: sai a escolha de cor; cada um manda o carro (`gpaint`: pelo, F1 e kart) e o servidor valida
  pelas listas; o veículo segue a física da sala; lista "Carros" com selo e "Ver carro" (uma prévia por vez).

### Fases 9 a 12
- Lembrete forte da volta lançada aos 30 s e "Última chance" no último minuto (tecla do mapa de Comandos); DNF de 2 min
  em m:ss para quem corre, quem terminou e quem assiste (esquenta nos últimos 30 s); quem assiste vê a posição do piloto
  assistido e troca com ← →.
- Pneu (só Realista): evento `tyre` por faixa (55, 75, 90 %; o crítico repete a cada volta), avisos na fila, barra por
  faixa com o ícone piscando, "Box à frente" com distância e barra a até 350 m, "Entre no box!" a 60 m com o limite de
  170 km/h, "Box perdido", placa BOX a 150 m e linha de guia que acende, entrada do box piscando no minimapa.
- Som: F1 V6 em camadas com assobio, estalo na troca e estouros; kart duas-tempos; vento, chiado no drift, nota por
  terço, whoosh por nível, pulinho, pancada de plástico. Pausa offline (menu, aba, foco) cala na hora; online não.
- Bots na sala: regras "Bots" (total de 4 a 12) e "Dificuldade"; o servidor cria as vagas com nome e carro; o líder
  simula; a classificação e o fim não esperam bots.

### Pendente
- Jogar com aparelhos reais e calibrar os [AJUSTAR] (`GP_ARC_*`, `GP_REAL_*`, pneu); medir celular como líder com 12.
- Não feitos por custo: página de QA dos números (`?qa=numbers`) e o modo `?debug=track` (a pista do kart é gerada do
  próprio `GpTrack`, então desenho e física coincidem por construção); estilo do aro e faixa do pneu no kart.
