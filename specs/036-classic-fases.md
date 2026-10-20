# 036 · Classic Word's em fases (1, 2 e 4 palavras)

Status: implementada (20/10/2026). Decisões do Lucas: mesma dinâmica do Bee e do Connect (catálogo de fases, jogo offline, progresso no aparelho) e palavras repartidas sem repetir entre os modos.

## O que muda
- Os modos livres (1, 2 e 4 palavras) deixam de sortear palavra: viram **catálogos de fases**, como o Bee e o Connect. O **Daily continua igual** (servidor, ranking, sequência).
- Cada fase tem palavras fixas. A mesma regra do jogo: 5 letras, cores verde/amarelo/cinza (`scoreGuess`), 6, 7 e 9 tentativas.
- Fim da fase: tentativas usadas (sem nota). Dá para desistir (com confirmação) e rever as fases.

## Quantas fases (conta feita com os dados reais)
- Respostas: 1.567 palavras. As 600 primeiras da ordem fixa (`ordem5.txt`) são **só do Daily** e nunca saem do servidor.
- Sobram 967 palavras. Como o jogo é offline, as respostas das fases vão dentro do app: por isso nenhuma palavra do Daily entra nas fases.
- Repartição sem repetir (da mais comum à mais rara, cada modo cobre Fácil a Mestre): **1 palavra: 400 fases · 2 palavras: 150 fases (300 palavras) · 4 palavras: 66 fases (264 palavras)**. Total 616 fases; 3 palavras ficam sem uso.
- Quatro faixas por modo (quartis): Fácil, Médio, Difícil, Mestre.

## Dados e código
- `apps/api/scripts/words/exportar-fases.mjs` gera `classic-levels.json` (`{ c, d, q }`, fases `{ id, t, w[] }`) e `classic-accepted.json` (dicionário de palpites, para conferir sem internet).
- Web: `levels/levels.ts` (tipos e carga), `levels/progress.ts` (`nocap-words-classic-{c|d|q}-v1`), `classic/local-engine.ts` (monta a partida a partir de `playClassic`), `ClassicCatalog` e `ClassicLevelPlay`, reaproveitando `ClassicPlay` e `ClassicEnd`.
- Rotas: `/words/classic/fases/$modo` (catálogo) e `/words/classic/fase/$modo/$n` (jogo).
- Sem ranking e sem nota (como Bee e Connect). A API dos modos livres (`solo`) fica sem uso pela interface.

## Testes
- Dados: sem palavra do Daily, sem repetição entre modos, 5 letras, quantidades acima, faixas crescentes.
- Motor local: cores corretas, palavra inexistente recusada, fim por acerto, por tentativas e por desistência.
