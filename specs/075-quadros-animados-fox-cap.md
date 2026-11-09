# Spec 075: quadros animados nos menus do Fox Cap! e do Counter Fox

Status: implementada (09/11/2026). Pedido do Lucas: os menus dos jogos do Fox Cap! e do Counter Fox não tinham os quadros animados organizados como os outros hubs.

- **Atravessa!, Fut Fox, Ping Fox! e Desmorona!** (`GameLanding`): o `Showcase` agora usa o mesmo quadro dos outros hubs (título, quadro centrado e frase) com uma amostra animada: a raposa atravessando estrada e rio, o passe e o gol, a bolinha entre as raquetes, o chão rachando e caindo.
- **Counter Fox:** o mapa do menu ganhou um radar que varre e pontos que andam.
- Nos menus dos jogos do Fox Cap! os botões e painéis ficam sólidos e o cenário só aparece do lado do quadro, como nos outros hubs. Só `transform`/`opacity`, com `prefers-reduced-motion`.
