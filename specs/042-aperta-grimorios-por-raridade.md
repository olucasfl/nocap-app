# Spec 042: Aperta! grimórios por raridade

Pedido do Lucas em 23/10/2026: os grimórios estão complicados e se repetem entre si (e com Melhorias e Árvore). Proposta, lista atual e sobreposições estão em `docs/REVISAO-GRIMORIOS.md`. Esta spec fixa as decisões e as etapas. Status: aprovada nas regras abaixo; falta implementar.

## Decisões do Lucas (23/10/2026)

1. **14 grimórios**, cada um com uma coisa só para fazer (lista na seção 4 do documento).
2. Cada grimório aparece em 4 raridades (Comum, Raro, Épico, Lendário). A raridade define o **tamanho do bônus por nível**.
3. **Grimório que vem em raridade maior passa a valer como a nova raridade.**
4. **Geradores saem dos grimórios** (ficam nas Melhorias e na Árvore). Um número só tem uma casa: Melhorias = poder base (poeira por toque, geradores); Grimórios = estilo da vida (combo, "a cada N toques", objetos, energia e escolhas); Árvore = meta e conforto entre vidas (poeira inicial, custo, cartas e trocas, chance de raridade, habilidades).
5. Descobrir versões: decisão minha (abaixo). Atualizar o brief e o `ARCHITECTURE.md` junto: decisão minha.

## Regras

- **Nível por raridade:** cada nível vale o bônus da raridade em que foi pego e fica assim para sempre (Lua Comum +0,5x por nível, Rara +1x...). Subir só a Comum e depois pegar a Rara nunca compensa mais do que pegar a Rara cedo.
- **Teto de níveis** acompanha a maior raridade que você tem do grimório: Comum 5, Raro 6, Épico 8, Lendário 10. No teto, o grimório sai do sorteio. (Os tetos são do que sugeri; o Lucas ainda pode trocar por um teto único.)
- **Nunca vem raridade menor** do que a que você já tem desse grimório na vida; vem a mesma (sobe +1 nível) ou uma maior (vira a nova raridade e ganha +1 nível).
- **Sorteio:** primeiro o grimório, depois a raridade, entre as já liberadas na vida. A raridade não muda a chance de um grimório aparecer.
- **Começo com mais Comum:** nas primeiras escolhas a oferta é quase só Comum; Raro, Épico e Lendário liberam com mais escolhas feitas (mecânica de hoje, `RARITY_UNLOCK_PICKS`), e os pesos de sorteio favorecem Comum cedo.
- **Carta de evolução de raridade:** quando uma carta oferecida faria o grimório subir de raridade, ela mostra o selo "RARO -> LENDÁRIO" (ou "COMUM -> ÉPICO") no topo, no lugar do "NVL a -> b", e o antes e depois do número. Ao escolher, toca uma animação de evolução (a carta brilha, o selo antigo vira o novo, o livro troca de cor e sobe o novo nível). Só `transform` e `opacity`; com `prefers-reduced-motion`, troca direta com um clarão curto.
- **Livro de Grimórios (página):** um grimório por astro, com 4 espaços (Comum, Raro, Épico, Lendário) que ficam "???" até a versão ser pega pela primeira vez; mostra "N de 4 versões" e o nível mais alto. A descoberta é permanente; nível e raridade em uso zeram a cada vida. Decidi: a primeira descoberta de cada versão dá 1 Cintila e completar as 4 dá um selo no livro. O Cofre dos Proibidos continua separado.

## Etapas

1. **Motor e catálogo** (`packages/games`): 14 definições com tabela por raridade (bônus por nível e teto), nível guardado por raridade, regra de oferta, testes (cada regra acima).
2. **Save** (versão 6): migração dos grimórios antigos para os novos equivalentes, com a raridade antiga e o nível limitado ao teto; campo de versões descobertas, migrado do álbum atual; teste com saves legados.
3. **Escolha e animação de evolução** (web): carta com selo de raridade e de evolução, animação, e2e em 320, 390, 768 e 1366 px.
4. **Livro de Grimórios** (web): 4 espaços por astro e Atlas contando versões.
5. **Conquistas e Árvore** que citam grimórios específicos (Vega, Via Láctea, "Cartas de capa"...): revisar.
6. **Simulador e metas:** recalibrar `sim.test.ts` e `GOAL_TABLE`; manter o ritmo da 041 (1 mi em ~14 min, 1º colapso em ~1 h).
7. Docs: `ARCHITECTURE.md`, `docs/ROADMAP.md`, brief e `HANDOFF.md`.

## Riscos

- A etapa 6 é a mais pesada: o ganho por grimório muda, então o ritmo pode sair do alvo.
- A migração do save não pode perder grimórios nem nível; por isso o teste de saves legados vem junto.
