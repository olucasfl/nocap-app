# Spec 042: Aperta! grimórios por raridade

Pedido do Lucas em 23/10/2026: os grimórios estão complicados e se repetem entre si (e com Melhorias e Árvore). Proposta, lista atual e sobreposições estão em `docs/REVISAO-GRIMORIOS.md`. Esta spec fixa as decisões e as etapas. Status: implementada em 23/10/2026 (etapas 1 a 4 e 7; ver "Estado final" no fim).

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

## Estado final (23/10/2026)

- **Motor (`packages/games/src/aperta`):** `catalog.ts` tem os 14 grimórios (Lua, Sirius, Urano e Vega em Toque; Vênus, Marte, Io, Halley e Antares em Objetos; Mercúrio, Fobos, Titã, Betelgeuse e Nebulosa de Órion em Energia e sorte; a categoria Geradores acabou) com `RARITY_STEP` 1/2/3/4 e `RARITY_LEVEL_CAP` 5/6/8/10. `economy.ts` ganhou `pickInto` (pega o grimório numa raridade: o 1º nível vale o passo cheio e os outros `GRIMOIRE_LEVEL_STEP` = 1 dele), `offerableAt` (nunca raridade menor, só abaixo do teto), `albumKey`/`albumHas`/`albumVersions`. `RunState` ganhou `buildGain` (o ganho acumulado que escala os efeitos) e `buildRarity`; `PendingChoice.rarities` diz com que raridade cada carta veio. `drawGrimoires` sorteia o grimório primeiro e a raridade depois (pesos 100/40/22/9 e liberação por escolhas, como antes); `ensureRarity` (pity, Garantia, Destino) sobe a raridade da carta mais fraca. O álbum guarda versões ("moon:rare").
- **Save v6:** `legacy-grimoires.ts` converte os 55 grimórios antigos nos 14 novos (fica o de maior raridade e nível, limitado ao teto), o álbum vira versões, a escolha aberta é descartada e a diferença de Cintilas do álbum volta em `sparks.legacy` (ninguém perde saldo). `validateSave` confere teto, ganho máximo e álbum.
- **Conteúdo por colapso:** 10 grimórios no colapso 0, Urano e Halley no 1, Antares no 2 e Órion no 3.
- **Mudanças que a regra pediu:** Nebulosa do Caranguejo (repetir sobe 2 níveis) e a escolha dupla da Órion saíram; Órion agora oferece mais cartas (+1 no Comum, até +2); Betelgeuse dá até 4 trocas. Gerador saiu dos grimórios (nenhum efeito `generatorPct`, `energyGenPct`, `idleFloor` ou `activeWindow`).
- **Web:** carta de escolha em faixas (raridade no topo, categoria em texto, texto e ganho "antes -> depois"), selo "RARO -> LENDÁRIO" nas cartas que evoluem, `EvolutionFx` (clarão, livro novo, anéis, selo; só `transform`/`opacity`), livro de Grimórios com 4 espaços por astro ("???" até descobrir). Testes: `grimoires.test.tsx` e e2e `aperta-evolution`, `aperta-grimoire-book`, `aperta-choice-fit`.
- **Calibragem (sim, perfil normal, 6 sementes):** com os 14 grimórios (sem os de gerador) a 1ª vida saiu em 1,7 h e as vidas 6 a 15 em 3 a 4 h. O passo de repetição subiu de 0,5 para 1 (1ª vida ~1,1 h) e as metas do 6º ao 15º colapso caíram (`GOAL_TABLE`: 2e9, 3,74e9, 4,9e9, 5,8e9, 8,9e9, 1,16e10, 1,56e10, 2,25e10, 2,73e10, 3,7e10); as vidas 6 a 15 ficaram em ~1,5 a 2,4 h. **`sim.test.ts` fica com 1 teste vermelho:** "a árvore completa não encurta a vida mais de ~25%" deu 0,70, 0,75 e 0,64 (precisa de 0,75); a medida oscila ±20% com qualquer mudança (spec 040, 14.2) e escalar os nós de poder da árvore não ajudou (desfeito). Para o Lucas decidir depois de jogar.
- **Acesso:** o Aperta! está liberado só para a conta do Lucas (seção abaixo).

## Acesso restrito (jogo em teste)

Pedido do Lucas em 23/10/2026: o jogo vai para a `main`, mas só ele vê. O servidor decide: `apps/api/src/aperta/aperta-access.ts` (`canPlayAperta`, `ApertaAccessGuard` nas rotas de save, `GET /me/aperta/access`), com a lista em `APERTA_ALLOWED_EMAILS` (sem a variável, só `lucasfariasleandro@gmail.com`). No web, `lib/aperta-access.ts` pergunta ao servidor; o cartão do Hub só aparece para a conta liberada e `/arcade/aperta` manda as outras contas e o visitante para o início. O e-mail nunca vai no código do navegador. Para abrir o jogo para todos, remover o guard, o endpoint e o teste do cartão numa mudança à parte.

## Celular deitado (adendo, 24/10/2026)

Decisão do Lucas: no celular o Aperta! só existe de lado, da tela inicial em diante.

- **Em pé:** em tela de toque até 599 px o contêiner `.ap` gira 90° por CSS e ocupa a tela inteira. Sem JavaScript de medida, então funciona igual no iOS.
- **Travar a orientação:** no Android o clique em Jogar tenta `screen.orientation.lock('landscape')` (com tela cheia se o navegador exigir) e solta ao sair; falha em silêncio.
- **Layout:** media queries de tamanho viraram `@container ap`; `landscape.css` compacta HUD, campo, dock, páginas, cartas de escolha, modal de colapso, árvore, título e saves para alturas de 320 a 520 px.
- **Conferido:** 568x320, 667x375, 844x390, 932x430 e os mesmos em pé (girados). Rolagem das páginas por dentro, janela sem rolagem.

## História premium (adendo, 24/10/2026)

Pedido do Lucas: a abertura só aparece na primeira vez de cada save e fica mais impactante, sem ficar longa.

- **Só uma vez:** corrigida a corrida em que a partida abria antes de a marca `storySeen` subir e a apagava (`ApertaPage` espera `markStorySeen`).
- **4 cenas, ~50 palavras:** "A Perigeu perdeu o Sistema Solar" (janelas apagando), "Todos se apagaram. Menos um." (botão no escuro), "Aperte. Uma estrela acende." (onda de choque, estrela, poeira), "Os grimórios ainda estão lá." (órbitas e livros).
- **Arte:** SVG próprio em `StoryArt.tsx`; movimento só em `transform`/`opacity`; movimento reduzido mostra o estado final.

## Tutorial premium (adendo, 24/10/2026)

Pedido do Lucas: tutorial de jogo grande, com bloqueios que forcem a pessoa a fazer, iluminação, setas e animações, tudo sincronizado, e que ensine o necessário. Reverte a decisão "sem véu e sem travar toque" da seção 4.6 da spec 038.

- **Bloqueio com spotlight:** a tela escurece e só o alvo do passo (mais Sair e Pular tutorial) responde ao toque. Tocar fora balança o anel. Se o alvo não aparece, nada bloqueia (falha aberta), e "Pular tutorial" está sempre acessível.
- **Passos:** 1 toque (cartão de boas-vindas; nos toques 3 a 5 o contador de poeira acende), 2 abrir Melhorias e comprar, 3 fechar a página, 4 barra de energia acesa, 5 escolher o grimório, 6 abrir Grimórios (explica as 4 raridades). Jogo livre: conquistas, objetos, **geradores (novo)**, colapso e árvore. Ao ver todas as dicas aparece "Tutorial concluído".
- **Apresentação:** anel com ondas, mão que toca, seta que escolhe o lado com espaço, chip do passo, cartão posicionado onde não cobre nada. Só `transform`/`opacity` animam; movimento reduzido tira as ondas, a mão e as entradas.

## Celular: margens, abas em tela cheia e aviso de rede (adendo, 24/10/2026)

Pedido do Lucas depois de testar no iPhone: coisas cortadas na borda, o aviso de offline que não saía, abas em tela inteira e UI um pouco menor.

- **Margens de segurança:** nada fica rente à borda (16 px mais `safe-area-inset`, remapeado quando o jogo gira 90°).
- **Abas em tela cheia:** Melhorias, Grimórios, Conquistas e Cofre abrem cobrindo o jogo, com `Voltar` no canto superior esquerdo (a Árvore já era assim).
- **Aviso de rede:** um ícone pequeno enquanto não há conexão; o texto aparece num balão que some sozinho (5 s) e volta ao tocar no ícone; ao voltar a internet, um aviso curto de 3,5 s. Conflito de save continua sendo um diálogo.
- **Tamanhos:** fontes do HUD, botões e dock um pouco menores no celular; o painel do topo é uma coluna estreita.

## Mais grimórios e Titã (adendo, 24/10/2026)

Pedido do Lucas: grimório que dá algo no começo de cada vida é ruim; e queria de 12 a 20 grimórios ou mais (só havia 10 na primeira vida).

- **Titã:** perdeu a poeira inicial. Agora "cada melhoria que você compra devolve um pouco da poeira gasta" (2 toques por nível Comum).
- **22 grimórios no total, 15 na primeira vida.** Novos: Júpiter, Saturno, Europa, Polaris e Proxima (colapso 0); Capela e Ganimedes (colapso 1); Cassiopeia (colapso 2). Categorias: Toque 7, Objetos 7, Energia e sorte 8. Nenhum mexe em gerador nem usa efeito de largada.
- **Regra de teste:** nenhum grimório pode ter `startDust` nem texto de "começa"; a primeira vida precisa de 12 a 20 grimórios.
- **Balanço:** os efeitos usam primitivas que o motor já tinha, com números parecidos com os dos grimórios existentes. O simulador oficial foi rodado depois da mudança e passou inteiro (17 de 17, 14 min), inclusive o guard da árvore que estava vermelho.

## Geradores no máximo, HUD premium e giro estável (adendo, 24/10/2026)

- **Geradores:** rendem o máximo sempre, tocando ou parado (antes parado rendia 25%). O teto do ganho automático (60% do toque) continua. Autoclick e Dobra seguem valendo só para quem está parado.
- **HUD:** moedas, colapsos e meta redesenhados (vidro, moeda dourada, meta limpa com barra fina e botão que vira ouro quando a estrela está pronta).
- **Giro do aparelho:** o modo (livre, deitado, girado) e o tamanho da raiz vêm de uma medida única em JS, repetida depois de cada evento de tamanho; o layout dentro do jogo não depende da orientação física, então virar o celular não muda nada.

