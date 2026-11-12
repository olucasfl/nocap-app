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
