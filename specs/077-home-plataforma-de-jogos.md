# Spec 077: Home como plataforma de jogos

Status: primeira tela implementada (09/11/2026). Pedido do Lucas: o NoCap com cara de plataforma de jogos, organizado, com pouca informação por tela e cada jogo com a sua identidade; começar pela Home.

## O que mudou na Home
- **Destaque do dia:** um cartão com os 4 Dailys (quatro bolinhas que levam a cada Daily, com visto quando feito), a frase do que falta e um botão "Jogar Daily" para o próximo. As cores do cartão são as do jogo cujo Daily falta. Saudação e dias seguidos num canto.
- **Prateleiras de pôsteres:** Palavras (Classic, Connect, Bee), Reflexo e blocos (Mesmíssima, Já Deu?, Ecooo, Block's) e Fox Cap! (Counter Fox, Fut Fox, Ping Fox!, Atravessa!, Desmorona!). Cada jogo tem a sua capa, com uma cena do próprio jogo animada, as cores do tema e um selo (Daily hoje/feito ou Online). No celular as prateleiras rolam de lado; no computador viram grade.
- Tirados da Home: recordes escritos, listas de explicação, bloco de dailys em fichas, textos de apoio. Os números ficam dentro de cada hub.
- Os testes de ponta a ponta ganharam os ids `card-<jogo>` e `home-hero`; `daily-<jogo>` continuam.

## Próximos passos propostos
Ranking, Amigos e Perfil no mesmo desenho; transições de capa para o hub do jogo; sons por jogo; ver o plano em conversa com o Lucas (identidade própria por jogo).
