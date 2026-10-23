# Spec 041: Aperta! polimento da interface e economia v3

Pedido do Lucas em 23/10/2026 (mensagem única, em maiúsculas). Etapa A mexe só na interface; a B muda a economia e exige simulador. Cada item vira um commit pequeno. Decisões minhas estão marcadas "Decidi".

## Etapa A: interface (sem mexer em números)

- **A1 Conquistas novas:** ao ganhar uma conquista, o botão de Conquistas na dock mostra um selo com quantas ainda não foram vistas; abrir a página zera. Decidi: guardar `ui.achSeen` (quantas conquistas já foram vistas) no save, com padrão 0 em save antigo.
- **A2 Filtros:** a página de Conquistas mostra só a busca e um botão "Filtrar"; ao tocar abre um painel com os grupos organizados (Mostrar, Família) e um botão "Limpar".
- **A3 Tutorial e meta do colapso:** o tutorial inicial explica o colapso, e há um lugar fixo que diz a meta do próximo colapso (poeira, escolhas e o marco da vida) com barras. Decidi: cartão extra no fim do tutorial e um chip "Meta" na tela de jogo que abre o painel dos requisitos.
- **A4 Carta de grimório:** sem texto longo de nível; um selo chamativo no topo "NVL 1 -> NVL 2" e, embaixo, só o que sobe ("+1 poeira por toque").
- **A5 Melhorias em duas abas:** "Comprar" (o que está à venda ou a caminho) e "Comprados" (tudo que já foi comprado, organizado).
- **A6 Textos:** botão "Melhorar" para o que tem níveis e "Comprar" para o que é compra única. Sai o texto "Você tem N, dobra com X".
- **A7 Poeira e energia por segundo reais:** um painel (na tela de jogo) com o ganho real por segundo, já com o teto, e o ícone "+0,5" da energia automática.
- **A8 Estrela Dourada premium:** arte nova, diferente dos outros objetos.
- **A9 Imagens por item:** cada melhoria ganha um ícone próprio em SVG (luvas, lente, antena...), sem planetas aleatórios.

## Etapa B: economia v3

- **B1 Melhorias de gerador com limite:** cada melhoria de gerador de poeira ou de energia tem um limite de compras (0/8, 0/6, 0/10...) e a prateleira mostra UMA por vez por tipo (poeira e energia); ao completar (8/8) a próxima aparece, mais cara e melhor. Completas vão para "Comprados".
- **B2 Itens ajudam mais:** cada item sobe de efeito.
- **B3 Ritmo:** milionário (1 mi de poeira) em 30 min a 1 h de jogo; bilionário e trilionário alcançáveis, com escala sem teto.
- **B4 Grimórios mais fáceis:** metade da dificuldade da barra de energia e mais chance de épico e lendário "do nada".
- **B5 Metas do colapso:** o 1º colapso em ~1 h de jogo; depois um pouco mais a cada vez, sem salto; as metas sempre empurram a pessoa a farmar mais.
- Tudo calibrado no simulador (`sim.test.ts` e a tabela da spec 040 seção 17 serão atualizadas); as travas de vida 1 h a 3 h precisam ser revistas junto, porque o pedido muda o ritmo (a 1ª vida passa a ~1 h).
