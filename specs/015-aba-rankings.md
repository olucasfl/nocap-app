# 015 · Aba separada de Rankings

Status: **pendente (só escrito, nada implementado)**. Pedido do Lucas em 07/10/2026: "tirar os rankings de dentro de cada jogo e colocar uma aba separada para rankings, para visualizar de uma forma melhor e mais intuitiva".

## Situação de hoje

Cada jogo (Mesmíssima, Já Deu?, Ecooo) tem a aba **Ranking** dentro da própria tela (ao lado de "Modos de partida" e "Jogar com amigos"), com quadros por modo, período e recorte (Todos / Amigos). A navegação inferior tem Jogos, Histórico, Amigos e Perfil. Ver o ranking de outro jogo obriga a sair e entrar de novo.

## O que muda

- **Sai** a aba Ranking de dentro de cada jogo (as telas dos jogos ficam só com Modos de partida e Jogar com amigos).
- **Entra** uma aba própria **Rankings** na navegação inferior (fica ao lado de Jogos), servindo todos os jogos num lugar só.
- Atalho: no fim de uma partida e no cartão de cada jogo, um botão "Ver ranking" que abre a aba Rankings já no jogo e no modo certos (`/rankings?jogo=eco&modo=classic`).

## Como fica a tela (a desenhar antes de codar)

1. **Escolher o jogo** (Mesmíssima, Já Deu?, Ecooo) em destaque no topo, com a arte do jogo.
2. **Escolher o modo** (Clássico, Flash, Rápido... e Daily) em chips; só os modos do jogo escolhido.
3. **Filtros curtos:** Todos / Amigos e Hoje / Semana / Sempre.
4. **Pódio dos 3 primeiros** em destaque, e abaixo a lista do 4º em diante.
5. **Minha posição sempre visível:** cartão fixo no rodapé da lista com minha colocação e nota, mesmo que eu esteja longe do topo.
6. **Comparação com amigos:** no recorte Amigos, mostrar a diferença para quem está logo acima e logo abaixo ("faltam 12 pontos para passar @ana").
7. Estados claros: carregando, sem internet, vazio ("ninguém jogou este modo ainda") e sem conta (convite para criar conta).

## Regras que não mudam

- Só presets entram no ranking; **sala personalizada nunca** (RULES.md).
- A nota continua sendo a recalculada no servidor. Os dados e os endpoints `/rankings/:game` já existem e servem a nova tela.
- Tokens Pop Brutal, sem emoji, animar só `transform`/`opacity`, `prefers-reduced-motion` respeitado, claro e escuro.

## Servidor

Sem mudança obrigatória: reaproveita `GET /rankings/:game?board=&scope=&period=`. Opcional: devolver também os vizinhos da minha posição (um acima e um abaixo) para o item 6.

## Perguntas abertas

- Mantém algum mini-ranking (top 3) dentro de cada jogo como prévia, ou sai tudo?
- A aba nova ocupa um lugar na navegação inferior (ficam 5 abas) ou substitui outra?
- Ranking geral somando todos os jogos (um "placar do NoCap")? Exigiria decidir como somar jogos com notas diferentes.
- Conquistas e títulos (ex.: "1º da semana") entram aqui ou numa spec própria?

## Critérios de aceite (pendentes)

- [ ] Existe a aba Rankings na navegação, com seletor de jogo, modo, recorte e período.
- [ ] As telas de cada jogo não têm mais a aba Ranking.
- [ ] Pódio com os 3 primeiros, lista abaixo e minha posição sempre visível.
- [ ] "Ver ranking" no fim da partida e no cartão do jogo abre a aba já no jogo e modo certos.
- [ ] Salas personalizadas continuam fora do ranking.
- [ ] Funciona offline com aviso, no claro e no escuro, e no celular e no computador.
