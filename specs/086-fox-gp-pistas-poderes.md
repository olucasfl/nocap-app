# 086: Fox GP, pistas novas para o Arcade com poderes

Status: spec (16/11/2026). Pedido do Lucas: levar quatro pistas de kart (Castle Circuit, Map KLSD, Boom Karts Splash Bay e Rainbow Road DX, enviadas por ele em `.zip`) para o Arcade **com poderes**. A **Bala Track** (a atual) fica só no Arcade **sem poderes**. Começar pela Castle Circuit.

## 1. Análise das quatro pistas

Medidas lendo os `.fbx` com o `FBXLoader` do three (script de trabalho fora do repositório).

| Pista | Triângulos | Traçado | Cruzamentos | Dificuldade |
| --- | --- | --- | --- | --- |
| **Castle Circuit** | 36,8 mil (521 peças) | circuito fechado limpo, ~500 x 660 unidades | 1 (a ponte sobre a estrada) | **menor** |
| Map KLSD (dinossauros) | 86 mil | circuito fechado de largura variável | 2 (uma laçada com cruzamento) | média |
| Boom Karts Splash Bay | 39,6 mil | praia aberta enorme com escorregadores, boias e saltos | vários andares | alta |
| Rainbow Road DX | 5,5 mil | trechos soltos no espaço, com vãos que pedem salto | pedaços desconexos | **maior** |

A Castle Circuit já vem com as peças nomeadas: `CastleRoad` (estrada), `CastleBridge`, `trackTunnelCastle_driveable`, `trackSand`, `castle_base_02_driveable`, `castle_base_offroad`, `trackCurbs`, `StartLine`/`startFrame` e 3 `BoostPad`. As texturas são PNG prontas (~6 MB).

**Licença (antes de publicar):** são modelos extraídos de jogos de kart, sem arquivo de licença. A Rainbow Road traz texturas com a logo e o nome de um jogo da Nintendo (`MKlogo`, `MK7road`, ...): não vai a produção como está. Registrar em `docs/ASSETS-FOXGP.md` (a criar) e confirmar a origem com o Lucas, como foi feito com os arquivos do Slash.

## 2. Mecânicas novas (a base de todas as pistas)

O motor do Fox GP é plano: o carro anda em (x, z), a pista é uma linha central com largura fixa. Isto muda:

1. **Altura e andares.** Cada amostra da pista ganha `y` (altura da estrada) e `layer` (andar: 0 chão, 1 ponte...). A física continua em (x, z); o carro ganha `y` e `vy` só quando está no ar. A projeção na pista usa o andar do carro como dica, para a ponte não confundir o carro de baixo com o de cima. O desenho coloca o kart em `y` e inclina pela rampa.
2. **Pulo guiado.** Uma placa de salto (`jumps`: onde fica e onde aterrissa, em `s`, `d`, andar) lança o carro por um arco fixo até o ponto de pouso, **sempre acertando**: o jogador não decide onde cai. Dura o tempo do arco, a velocidade se mantém, o volante só vira o desenho e ele pode usar item no ar (mas não leva acerto de item no ar).
3. **Turbo que leva a outro andar.** Placa de turbo com rampa: dá o turbo e usa o mesmo pulo guiado para subir a outro andar.
4. **Gravidade por pista e por zona.** `gravity` na pista e `gravityZones` (trechos com outro valor): muda a altura e a duração do arco dos pulos (gravidade baixa, arco alto e longo). Não muda o chão.
5. **Queda e fora do mapa.** Cada pista tem uma área válida (`bounds`) e um plano de queda (`killY`): o carro que sai dela ou cai volta ao último ponto bom (`lastValid`, que o motor já guarda) no sentido da corrida, com uma pequena espera e velocidade zero. Vale também para quem fica parado fora da pista muito tempo. Perde só o tempo.
6. **Rede.** O líder simula tudo; `y`, `vy` e o estado de pulo entram no estado do carro (`GpRemoteState`); os pulos são determinísticos (mesma entrada, mesmo arco).

## 3. Formato da pista de modelo

`GpTrackDef` ganha um campo opcional `model`: arquivo do cenário, escala, origem e giro, mais `heights` (perfil `y` por distância), `layers`, `jumps`, `gravity`, `bounds`, `killY`. O que já existe (`points`, `pads`, `sectors`) continua. O cenário vem de um arquivo compacto gerado por `tools/art/track/extract_model_track.mjs` (junta as peças por material, usa texturas reduzidas, grava a linha central e o perfil de altura), em vez de carregar o `.fbx` de 10 MB no navegador.

## 4. Escolha da pista por modo

- Arcade **sem poderes**: Bala Track.
- Arcade **com poderes**: Castle Circuit e, quando prontas, as demais. A escolha da pista aparece no passo 2 do menu "Antes de correr" e fica salva por modo.
- Sala online: a pista segue a regra acima e vai junto com `powers` na sala.

## 5. Fases

- **F0** (esta spec): análise, mecânicas e formato. Falta o OK do Lucas sobre a licença.
- **F1, Castle Circuit:** extração (linha central, largura, alturas, ponte, 3 placas de turbo, largada), `y`/`layer` no motor, desenho do cenário, queda e volta ao último ponto bom, escolha no menu, testes (motor e tela). Sem pulos ainda: a pista não precisa deles.
- **F2, pulo guiado e turbo de andar** (necessários para a Splash Bay e a Rainbow Road).
- **F3, Map KLSD:** laçada com cruzamento e gravidade.
- **F4, Splash Bay** e **F5, Rainbow Road** (esta, só depois de resolvida a licença).

## 6. Perguntas abertas

- Confirmar a origem e a licença dos quatro modelos.
- A Castle Circuit mostra o castelo e o cenário inteiros (36 mil triângulos) ou uma versão mais leve no celular?
- Os bots sabem usar pulo e turbo de andar? (proposta: seguem a linha central, que já passa pelas placas.)

## 7. Andamento (16/11/2026)

- **F1, Castle Circuit: feita** (motor, cena, escolha e lobby). A licença foi dada como resolvida pelo Lucas.
  - Linha central de 790 m extraída das duas bordas da estrada, com altura (morro e ponte) e inclinação lateral em cada ponto; 3 placas de turbo; largada no portão do modelo.
  - O cruzamento da ponte não gera falso corte de caminho (`GpTrack.overlap`).
  - O kart sobe e desce, inclina de frente e de lado junto com a estrada (`surfaceY`, `bankAt`), e a subida/descida mexe na velocidade (`GP_SLOPE_ACC`); caixas, itens e câmera acompanham a altura.
  - Cenário compacto em `apps/web/public/foxgp/castle/` (pacote `core` para todos; `detail` só no computador).
- **Fotos das pistas** (`public/foxgp/preview/*.webp`) aparecem na escolha do treino e no lobby da sala, para o líder e para quem entra (`TrackPreview`).
- Falta: F2 (pulo guiado e turbo de andar), F3 a F5 (as outras pistas) e o segundo passo da escolha da pista com poderes quando houver mais de uma.

## 8. Box e pneu (16/11/2026)

O box da Marina e o de Interlagos foram para a metade da volta (Marina a ~51%, Interlagos a ~44%), do lado de fora da curva e logo antes de uma reta rápida, nunca em cima dela. Os avisos de box seguem a distância até a entrada, então valem em qualquer lugar da pista. Interlagos ganhou `wearK: 0.5` (metade do desgaste de pneu), porque gastava 41% por volta; agora gasta cerca de 20%, perto da Marina.

## 9. Chão, paredes, câmera e desempenho da Castle Circuit (16/11/2026)

- **Chão de verdade:** `ground.bin` guarda a altura do chão em células de 1 m (estrada, ponte, túnel, grama e areia, com até dois andares). O kart é posto na altura média das quatro rodas e inclina para frente e de lado pelo chão que pisa (`GroundMap`).
- **Paredes do modelo:** de cada ponto da linha central, um raio para cada lado achou a primeira parede (`wallsL`/`wallsR`); o kart bate nela, com 1,1 m de folga, em vez de numa barreira invisível mais longe.
- **Câmera adaptativa:** um raio do kart até a câmera; se há parede, teto de túnel ou ponte no caminho, a câmera chega mais perto (entra na hora, sai devagar). O raio também vale para o verso das faces.
- **Desempenho:** o cenário é cortado em quadrados de 40 m (a câmera descarta o que não vê) e a altura de efeitos e itens vem do mapa de chão (antes era uma busca na pista inteira a cada partícula, que enchia a memória de lixo). Medido em teste: 167 chamadas e 57 mil triângulos, menos que a Bala Track (129 mil).
