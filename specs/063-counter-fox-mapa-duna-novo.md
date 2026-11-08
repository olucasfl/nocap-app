# Spec 063: Counter Fox, a nova Duna (modelo USDZ da Dust 2)

Status: em andamento (08/11/2026). Pedido do Lucas: trocar o mapa do mata-mata e do Bomba por esse modelo (mais bem feito que a Duna), na mesma escala da Duna; se der certo, deixar os dois mapas para ele testar e ficar com o que preferir (o outro é apagado depois).

## Decisão
- O Lucas testou os dois e ficou com o modelo novo (08/11/2026): ele é agora a **Duna** (`duna`, usada no Mata-mata e no Bomba). A Duna antiga (BSP) foi apagada: `duna.data.ts` antigo, `duna/duna.glb` antigo, `duna_bsp.py`, `duna_build.py` e `duna_align.py` antigos, e a escolha de mapa no menu e na sala. O PvP continua na Arena de Blocos.
- As bombas, as bases e os nascimentos da Duna antiga ficam em `tools/art/duna_layout.json` (entrada de `tools/art/duna_build.py`).
- Os dados de colisão (1,2 MB) carregam sob demanda (`fsPreloadMap('duna')`), com tela de carregamento (`FsMapGate`: barra real do download do modelo, etapas e dicas). Testes e servidor carregam antes (`test/preload-maps.ts`, módulo do motor da sala).

## Como o modelo virou mapa (`tools/art/dust2_build.py`)
- O USDZ tem 106 malhas de superfície aberta (não são blocos fechados) e 90 texturas JPEG. Escala e encaixe foram achados casando a área andável com a da Duna (correlação de máscaras): 0,072 m por unidade do modelo e giro de 270 graus, IoU 0,69. O mapa usa as mesmas coordenadas da Duna e herda dela as duas bombas, as duas bases e os 16+16 nascimentos (mesmo desenho; cada ponto é encaixado no chão andável mais perto).
- Colisão pela "pele": cada triângulo vira voxels de 0,152 m na horizontal e 0,05 m na vertical (o chão não flutua), perto de onde se anda (3 m em volta), juntados em ~75 mil caixas (`bcellY` novo em `FsGridMapData`). Conferido contra a malha: paredes a 0 cm; topo do chão em média 2 cm abaixo do desenho.
- Navegação: grade de 0,304 m como a da Duna. Pontos de ficar em pé exigem folga de 0,6 m dos lados (colunas finas) e 1,5 m de altura; caixas e muretos de até ~0,9 m se vencem pulando (`maxStep` 3 em `FsGridMapData`, padrão 2). Só valem os andares parecidos com os da Duna (passarelas e telhados sobrepostos ficam de fora) e o pedaço ligado ao nascimento TR; as duas bombas e as duas bases ficam ligadas.
- `fsBoxesInRect` / `fsBoxesAlongRay`: com mais de 30 mil caixas o índice usa baldes de 1,5 m (a a pele fina devolvia centenas de caixas por consulta e o teste de bots levava 10 min; agora 7 s).
- Desenho: `duna.glb` (todas as malhas, texturas JPEG reduzidas a 384 px, ~5,6 MB) e planta `duna-plan.png` (`render_plan.mjs`).

## Testes
`duna.test.ts`: marcas e nascimentos, caminho de cada base a cada bomba, andar com a física do jogo dos dois lados até as duas bombas, andar e pular sem rumo sem entrar em parede, nascimentos de pé no chão, bots jogam rounds. e2e offline em `counterfox-duna.spec.ts`.

## Falta
Jogar e ajustar com o Lucas; confirmar autoria e licença do modelo (docs/CREDITS-3D.md); bots não sobem escadas de mão (não há nesse mapa).
