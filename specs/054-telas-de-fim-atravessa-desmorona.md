# Spec 054: telas de fim de partida do Atravessa! e do Desmorona!

Pedido do Lucas em 28/10/2026. Status: **em andamento.**

## 1. O pedido

Telas de fim de partida personalizadas, como a do Fut Fox (`BolaFinal`), para o **Atravessa!** e o **Desmorona!**, offline e online, cada uma com o seu tema e as informações que importam naquele jogo, funcionando em todos os aparelhos (computador, celular em pé e deitado).

## 2. Peças compartilhadas (`apps/web/src/components/final/`)

- `FinalShell`: tela cheia (fundo escurecido, cartão Pop Brutal com rolagem própria), cabeçalho com tema (`data-theme`), título que entra letra por letra e subtítulo. Os botões de ação ficam fixos no rodapé do cartão e o conteúdo (cabeçalho, pódio, ranking) rola por cima, em qualquer aparelho. Respeita áreas seguras e `prefers-reduced-motion`.
- `RematchPanel`: a votação de "jogar de novo" da sala (quem quer, quem pensa, quem saiu, medidor, votar, sair, encerrar com confirmação). É a mesma do Fut Fox, sem depender dela.
- `useCountUp`: número que sobe (já parado com movimento reduzido).
- Só `transform` e `opacity` animam. Sem emoji.

## 3. Desmorona! (`DesmoronaFinal`)

Tema: pôr do sol laranja e céu roxo, com ladrilhos ao fundo do cabeçalho.

- Título: "Você venceu!", "Você caiu em Nº lugar" ou "<nome> venceu".
- **Pódio** dos 3 primeiros com degraus de alturas diferentes (o 1º no meio) e a cor da raposa de cada um.
- **Classificação completa**: posição, raposa (cor), nome (você, bot), quanto tempo durou (barra proporcional ao tempo da partida).
- **Destaques**: duração da partida e quem caiu primeiro.
- Offline: "Jogar de novo" e "Voltar". Online: votação de revanche, sair e encerrar (líder).

## 4. Atravessa! (`AtravessaFinal`)

Tema: estrada, rio e faixas de trem (azul-noite com faixas amarelas), cartão claro.

- **Offline (Infinito)**: motivo do fim ("Atropelado", "Caiu na água"…), linhas (número grande que sobe), selo de recorde, recorde anterior, tempo de corrida, aviso de salvar (convidado), jogar de novo, ranking, menu.
- **Online, Infinito**: soma de metros de cada um na sala, pódio, rodadas, melhor rodada; votação.
- **Online, Checkpoint**: tempos de chegada (m:ss,cc) ou a distância de quem não chegou, mortes de cada um, diferença para o 1º; pódio; votação.

## 5. Onde aparece

- Treino do Desmorona!: dentro de `DesmoronaPlay` no lugar do `dsm-over`.
- Sala do Desmorona! e do Atravessa!: a fase `final` da sala deixa de mostrar o pódio genérico e passa a ocupar a tela toda (`Room.tsx`), como o Fut Fox.
- Atravessa! offline: no lugar do `AtravessaFinal` interno de `AtravessaGame`.

## 6. Testes

`apps/web/e2e/telas-de-fim.spec.ts`: o Desmorona! e o Atravessa! offline terminam uma partida e mostram a tela nova; as peças puras (tempo, posições, diferença) têm teste unitário.
