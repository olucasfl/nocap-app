# Spec 063: Counter Fox, mapa Dust 2 (modelo USDZ) ao lado da Duna

Status: em andamento (08/11/2026). Pedido do Lucas: trocar o mapa do mata-mata e do Bomba por esse modelo (mais bem feito que a Duna), na mesma escala da Duna; se der certo, deixar os dois mapas para ele testar e ficar com o que preferir (o outro é apagado depois).

## Decisão
- Os dois mapas ficam: Duna (`duna`) e Dust 2 (`dust2`). O PvP continua na Arena de Blocos. A escolha aparece no menu offline (Mata-mata e Bomba) e na aba Modo da sala. Quando o Lucas decidir, apaga-se o perdedor (`duna.data.ts`, `duna/duna.glb`, ramo da Duna em `maps.ts`).

## Como o modelo virou mapa (`tools/art/dust2_build.py`)
- O USDZ tem 106 malhas de superfície aberta (não são blocos fechados) e 90 texturas JPEG. Escala e encaixe foram achados casando a área andável com a da Duna (correlação de máscaras): 0,072 m por unidade do modelo e giro de 270 graus, IoU 0,69. O mapa usa as mesmas coordenadas da Duna e herda dela as duas bombas, as duas bases e os 16+16 nascimentos (mesmo desenho; cada ponto é encaixado no chão andável mais perto).
- Colisão pela "pele": cada triângulo vira voxels de 0,152 m na horizontal e 0,05 m na vertical (o chão não flutua), perto de onde se anda (3 m em volta), juntados em ~75 mil caixas (`bcellY` novo em `FsGridMapData`). Conferido contra a malha: paredes a 0 cm; topo do chão em média 2 cm abaixo do desenho.
- Navegação: grade de 0,304 m como a da Duna. Pontos de ficar em pé exigem folga de 0,6 m dos lados (colunas finas) e 1,5 m de altura; caixas e muretos de até ~0,9 m se vencem pulando (`maxStep` 3 em `FsGridMapData`, padrão 2). Só valem os andares parecidos com os da Duna (passarelas e telhados sobrepostos ficam de fora) e o pedaço ligado ao nascimento TR; as duas bombas e as duas bases ficam ligadas.
- `fsBoxesInRect` / `fsBoxesAlongRay`: com mais de 30 mil caixas o índice usa baldes de 1,5 m (a Dust 2 devolvia centenas de caixas por consulta e o teste de bots levava 10 min; agora 7 s).
- Desenho: `dust2.glb` (todas as malhas, texturas JPEG reduzidas a 384 px, ~5,6 MB) e planta `dust2-plan.png` (`render_plan.mjs`).

## Testes
`dust2.test.ts`: marcas e nascimentos, caminho de cada base a cada bomba, andar com a física do jogo dos dois lados até as duas bombas, andar e pular sem rumo sem entrar em parede, nascimentos de pé no chão, bots jogam rounds. e2e offline em `counterfox-duna.spec.ts`.

## Falta
Jogar e ajustar com o Lucas; confirmar autoria e licença do modelo (docs/CREDITS-3D.md); carregar os dados do mapa sob demanda (1,2 MB entram no pacote); bots não sobem escadas de mão (não há nesse mapa).
