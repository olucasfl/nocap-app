# 030 · Atravessa!: largada sempre na horta e recuo de 4 linhas

Status: **implementada (15/10/2026); falta ver rodando no celular e no computador.**

## Pedido do Lucas

1. Qualquer partida, com qualquer mapa sorteado depois, **começa sempre na grama (horta)**.
2. No começo dá para **andar até 4 casas para trás**, com árvores e afins na parte de trás.

## O que mudou

- `biomeSequence`: o primeiro grupo de biomas é sempre `horta` + os outros dois em ordem sorteada pela seed. Os grupos seguintes seguem a regra da spec 029 (o primeiro nunca é igual ao último do grupo anterior). `ATR_FIRST_BIOME` guarda a escolha.
- `AtravessaWorld.lane(row < 0)`: as linhas -1 a -4 (`ATR_BACK_ROWS`) são descanso da horta com árvores sorteadas pela seed (`seed:atras:linha`, densidade 30% e 48% na última linha); **a coluna 0 fica sempre livre**, então o recuo e a volta sempre têm caminho. A linha -4 é mais fechada (borda da mata). Além dela, mata fechada (todas as colunas bloqueadas), só como enfeite.
- `AtravessaSim`: recusa o passo só abaixo de `-ATR_BACK_ROWS`. A nota continua sendo a maior linha atingida, então recuar não conta nem perde nada.
- Escuridão: `ATR_DARK_START_GAP` subiu de 6 para 8 (igual ao `ATR_DARK_MAX_GAP`) para quem recua não ser pego logo; ela continua parada nos primeiros 1,5 s e nunca passa do teto de velocidade.

## Consequências

- Os mapas mudam para a mesma seed (a largada deixa de ser sorteada e as linhas de trás passam a existir). Partidas guardadas na fila offline antes da atualização podem não validar no servidor; o histórico guarda só a nota, então nada se perde.
- A câmera continua só avançando; recuar 4 linhas mantém o herói na tela (cerca de 4 unidades abaixo do centro, com folga na altura mínima de 5,6).

## Testes

`packages/games/src/atravessa/atravessa.test.ts`: largada sempre horta em 200 seeds; linhas de trás com coluna 0 livre, árvores e mata fechada além do limite; recuo máximo de 4 linhas e passos extras recusados; ordem dos biomas sem regressão.
