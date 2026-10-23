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

## Estado final (23/10/2026)

**Etapa A (interface): pronta.** A1 selo de conquistas novas (`ui.achSeen`), A2 botão Filtrar, A3 chip de meta com barra ("0 de 50 mi"), modal "Sua meta" e cartão de tutorial do colapso (depois de 2 grimórios), A4 carta com "NVL a -> b" e o que sobe, A5 abas Comprar e Comprados (em Comprar, Toque e Geradores), A6 "Melhorar" (tem níveis, 0/8) e "Comprar" (uma vez), sem o texto "Você tem N, dobra com X", A7 taxa real de poeira e energia por segundo (`+8,8/s` ao lado da poeira e `+0,5/s` com raio ao lado da barra; a aba Geradores explica quando o limite do toque segura), A8 Estrela Dourada nova (leque de raios, estrela facetada, brilhos que piscam só em opacity), A9 um ícone SVG para cada uma das 42 melhorias.

**Etapa B (economia v3): pronta e calibrada no simulador.**
- **B1:** geradores com limite de níveis e um por vez (poeira e energia separados). Poeira: Satélite 0/8, Sonda 0/8, Telescópio 0/8, Observatório 0/10, Estação 0/10, Colônia 0/10, Frota 0/12, Portal 0/12, Aglomerado 0/12, Quasar 0/12, Teia Cósmica 0/12. Energia: Antena 0/6, Receptor 0/6, Matriz 0/8, Rede Profunda 0/8, Conjunto Interestelar 0/8. Completar abre o próximo (mais caro e mais forte, ~7x) e o completo vai para Comprados. Sem os marcos "dobra com 10, 25, 50". Os efeitos das melhorias de gerador passam a falar em níveis (Rede +2% por nível da Sonda, Escala +1 no toque a cada 4 níveis, Isca 1 s a cada 2 níveis do Satélite com teto 4 s, Fila de pedidos completa o gerador de uma vez 5% mais barato).
- **B2 itens ajudam mais:** teto do ganho automático de 35% para 60% do toque (parado segue 25% do ativo, então tocar rende sempre mais), `perSec` dos geradores x2, Luvas +2, Pulso Carregado +0,5, Toque de Sorte 6%.
- **B3 ritmo (simulador, perfil normal 2,5 toques/s):** 1 mi de poeira aos 14 min; no perfil casual (1 toque/s) aos 34 min. Há 11 geradores de poeira, até o Teia Cósmica (2 tri de preço), e a meta passa de 1e11 no 15º colapso: dá para chegar a trilhões e a conta não tem teto.
- **B4 grimórios mais fáceis:** passos da barra de energia pela metade (19, 40, 75, 130, 210, 320; depois x1,16 em vez de x1,22), escolhas mínimas 12/10/8 (antes 20/15/12), pesos de raridade 100/40/22/9 (antes 100/24/9/3) e raro, épico e lendário abrem com 2, 5 e 9 escolhas (antes 3, 8, 14).
- **B5 metas:** `GOAL_TABLE` (50 mi, 140 mi, 320 mi, 690 mi, 1,4 bi ... 165 bi no 15º) e depois x1,08 por colapso. Vida 1 ~1,2 h no perfil normal, vidas 2 a 15 entre ~1 e ~1,8 h (calibragem com 8 a 12 sementes). Travas novas do `sim.test.ts`: de 0,7 h a 2,5 h até o 15º colapso (antes 1 h a 3 h) e +3% por colapso depois.
- **Save:** versão 5; a vida em andamento volta com a poeira ganha e os níveis das melhorias zerados (a economia mudou); álbum, Cofre, árvore e conquistas ficam como estavam.

**Verificação:** `sim.test.ts` 17 de 17 verdes (inclui a árvore completa >= 75%), typecheck e testes de games (904), web (570) e api (336) verdes, lint só com os 4 erros de fora do Aperta!, e2e de colapso, tutorial, árvore, completar gerador e meta (36 testes) passando em 320, 390 e 1280 px, varredura responsiva sem problema novo (só o pior caso do save "late" em 320 x 640, com todos os avisos juntos).

**Fica para o Lucas:** sentir se 14 min até o 1º milhão e ~1,2 h até o 1º colapso estão certos para ele jogando de verdade; os números de cada gerador (`catalog.ts`) e as metas (`GOAL_TABLE`) são o lugar de mexer.
