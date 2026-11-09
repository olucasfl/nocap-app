# Spec 074: quadros animados nos menus dos hubs

Status: implementada (09/11/2026). Pedido do Lucas: as imagens dos hubs estavam no canto, descentralizadas, estáticas e sem relação com o jogo.

`Showcase` (`WordsShowcase.tsx`): no menu de cada hub, na área livre à direita, o título do jogo, um quadro com uma amostra animada do próprio jogo em loop e a frase, tudo centrado.
- **Classic:** as linhas viram cores e a palavra certa pula. **Connect:** palavras soltas se arrumam nos 4 grupos de cor. **Bee:** o favo acende as letras de uma palavra e soma os pontos.
- **Block's:** a peça cai, fecha a linha e ela some. **Mesmíssima:** a cor some e a sua chega perto, com os controles andando. **Já Deu?:** o ponteiro tenta acertar o alvo (sem números). **Ecooo:** os botões acendem em ordem.
- Só `transform` e `opacity`, com `prefers-reduced-motion` (fica a imagem final parada).
