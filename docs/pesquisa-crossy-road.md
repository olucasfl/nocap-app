# Pesquisa: Crossy Road e como adaptar o Sinal Vermelho

Pesquisa de 14/10/2026. Aviso de honestidade: não achei postmortem oficial nem threads úteis do Reddit pelas buscas; o que segue vem de guias de fãs, reviews (Justuseapp, Common Sense Media), entrevistas de lançamento (PocketGamer.biz, Cult of Mac), a wiki dos fãs e o tutorial do freeCodeCamp. Números marcados com (?) são palpite de comunidade, **não confirmados**; calibrar jogando.

## Como o Crossy Road funciona

**Núcleo.** Mundo infinito de **faixas (linhas) horizontais**, uma atrás da outra. O boneco anda em **grade**: um toque = um pulo para a frente; deslizar = para o lado ou para trás. O **score é só o número de linhas avançadas**. Sem vida, sem poder: morreu, recomeça em 2 s.

**Tipos de faixa.**

| Faixa | Regra |
| --- | --- |
| Grama | Segura. Árvores/pedras bloqueiam a casa (o pulo simplesmente não acontece) |
| Estrada | Carros em mão única por faixa, velocidades e espaçamentos diferentes por faixa |
| Trilho | Poucos, **rapidíssimos**; luz vermelha piscando **avisa** antes do trem |
| Rio | Não pisa na água: toras (andam, carregam o boneco) e vitórias-régias (paradas, algumas afundam) |

**Geração.** Procedural por "piscina de faixas com peso": sorteia o tipo da próxima faixa e quanto dura o trecho (ex.: 1 a 4 estradas seguidas), nunca deixa faixa perigosa demais seguida e sempre garante uma travessia possível. O mundo só existe ao redor do jogador; atrás some.

**A pressão para andar (o "Vigia" deles).**
- A tela **rola devagar para a frente**; se o boneco fica para trás da borda de baixo, morre.
- Parado demais: **a águia** pega (palpite de comunidade: 3 a poucos segundos (?); a MobyGames diz que não há tempo fixo).
- Voltar demais também chama a águia.
- Resultado: ritmo constante, sem "ficar esperando a estrada ficar perfeita".

**Câmera.** Ortográfica fixa em diagonal (visão "3D isométrica"), segue o boneco só para a frente e suaviza. Sem perspectiva, então todos os blocos têm o mesmo tamanho.

**Sensação ("game feel").** Pulo curto (~0,2 s) com arco, squash no pouso, som de "pop" por pulo, morte curta e engraçada com cada tipo de morte tendo sua animação. A fila de comandos (apertar duas vezes seguidas antes do pulo acabar) faz o jogo responder rápido. O tutorial do freeCodeCamp usa passo de 0,2 s, arco de sen(π·p) e fila validada.

**Retenção e dinheiro.** Colecionar personagens (cosméticos, 50+), moedas pelo caminho, presente a cada 6 h, sorteio de personagem com moedas ou anúncio, **sem pay-to-win**. Alguns personagens mudam o cenário (o mago, o lobo que traz a noite). Modo diário competitivo (Pecking Order) é elogiado.

## O que os jogadores reclamam (para não repetir)

1. **Anúncios demais** (a cada ~3 mortes) e "sem anúncio disponível" depois de assistir.
2. **Morte que parece injusta**: obstáculo gerado de um jeito que não deu escolha; e a águia que pega sem aviso claro.
3. **Lag/travada**, num jogo que exige reflexo.
4. **Personagens repetidos** no sorteio.
5. **Perde moeda/placar offline**, bug de placar.
6. Falta de modos e de variedade depois de um tempo.

Lição para o NoCap: o servidor já refaz a corrida pela seed, então a geração **precisa ser determinística e sempre ter passagem**; sem anúncios; avisar antes de matar (como o trem); o placar offline do NoCap já tem fila de reenvio (commit 7b48250).

## Seu pedido: biomas contínuos

No Crossy Road clássico cada mundo é separado. O seu desenho, grama → transição → deserto → transição → escuro, é parecido com os temas do Disney Crossy Road e funciona bem em endless: o **bioma muda por distância** (ex.: a cada 60 a 100 linhas), com 4 a 6 linhas de **transição** que misturam os dois cenários (borda de grama virando areia, a luz escurecendo). Cada bioma tem seu **kit de faixas e obstáculos**.

Mapeamento do que já existe (`SinalMapId`: `horta`, `deserto`, `neon`):

| Bioma | Mapa de hoje | Faixas | Perigos |
| --- | --- | --- | --- |
| 1. Grama | `horta` | estrada, rio com toras, grama com árvores | carros, trator, tora |
| 2. Deserto | `deserto` | estrada de areia, trilho, rio seco com pedras que rolam (ou areia movediça) | caminhão, trem com aviso, rolo de feno |
| 3. Escuro | `neon` | via neon, esteira, rio de energia com plataformas | motos, drones, raios com aviso |

## O que reaproveitar do Sinal

| Já temos | Uso no novo jogo |
| --- | --- |
| `art/palette.ts`, `art/props.ts`, `art/world.ts` (3 cenários, obstáculos desenhados) | Vira o visual dos biomas; precisa ser redesenhado em **visão diagonal** (hoje é de cima) |
| `art/chars.ts` (boneco articulado, Vigia, silhuetas) | O boneco vira o herói de blocos; o **Vigia vira o perigo que persegue** (a "águia"/escuridão) |
| `art/fx.ts` (partículas, escuridão, névoa, morte, estrelas de atordoado) | Escuridão que sobe de trás = a pressão de andar; partículas e morte |
| `art/hud.ts`, `ItemButton.tsx` | HUD, botão de item |
| `lib/sinal-audio.ts` (sintetizador, trilha, mixagem) | Trilha por bioma, sons de pulo e morte |
| Perigos de `course.ts`: arremessadores, perseguidores, mola, gelo, esteira, ímã, lamaçal | Viram variações de faixa (esteira = tora que carrega; gelo = faixa que escorrega etc.) |
| Itens (Sombra, Impulso, poderes online) | Opcional; pode virar "Escudo" e "Salto duplo" |
| Servidor refazendo a partida pela seed, sala, ranking, retomar, fila de envio | Mesma ideia, entrada nova: lista de **passos** (instante + direção) |
| Escuridão com teto de velocidade | Pressão por trás, sempre mais lenta que o herói |

**O que muda de verdade (lógica nova, `packages/games`):** movimento por **grade e passos** (não mais analógico/contínuo), geração por **faixas**, colisão por faixa e casa, tora que carrega, tempo de espera (águia) em vez da cantiga. `sim.ts` (1069 linhas) e `course.ts` são reescritos; `cantiga`, `vigia`, esconderijo e analógico saem. O servidor continua recalculando, só que em passos.

## Câmera 3D fixa

Duas opções:

- **A. Three.js de verdade** (ortográfica diagonal, blocos com sombra). É o visual do Crossy Road, mas é **dependência nova fora da stack do brief**: pela RULES.md, preciso da sua autorização. Custo: ~170 KB gz e modelos em blocos (voxel) novos.
- **B. Canvas 2D com projeção isométrica falsa** (o que o app já usa): blocos desenhados como caixas com 3 faces, ordenados por profundidade. Sem dependência nova, reaproveita `gfx.ts`, mas o "volume" fica mais trabalhoso e menos bonito que A.

Recomendação: **A**, porque o pedido é o visual das suas imagens (blocos com luz e sombra) e é muito mais fácil e rápido em 3D de verdade. Pop Brutal fica no HUD por cima.

## Controles

- **Celular:** toque = pulo para a frente; deslizar para o lado ou para baixo = pulo na direção. Dá para segurar para repetir, e a fila de 1 a 2 comandos evita perder toque. Sem analógico.
- **Teclado:** `W` frente, `S` trás, `A` esquerda, `D` direita (setas também).

## Regras do NoCap que valem

- Servidor recalcula a nota; seed determinística (ok: passos + seed).
- Ranking só com presets; sala personalizada fora.
- Animações das telas de interface só `transform`/`opacity` (o Canvas/3D livre); respeitar `prefers-reduced-motion`.
- Sem cronômetro na contagem do jogo do Tempo (não se aplica aqui, mas **evitar timer visível da águia**: usar aviso visual).
- Mexer no Sinal Vermelho exige **spec nova** (028) e atualizar `specs/INDEX.md`, `ARCHITECTURE.md` e `docs/ROADMAP.md`.

## Perguntas para o Lucas

1. Three.js (A) ou Canvas isométrico (B)?
2. O Sinal Vermelho atual **some** ou fica como modo ("Sinal Clássico")? Ranking, histórico e recordes dele ficam?
3. Modos: **Infinito** (só distância) e um modo com fim? Ou só Infinito + Daily?
4. Online: corrida em sala (mesma seed, quem vai mais longe, como já é)? E eliminação?
5. Personagens: um herói só ou coleção cosmética (com moedas)? É decisão sua (itens da seção 6).
6. O nome (abaixo).

## Nomes sugeridos

No estilo curto, brincalhão e em pt-BR dos outros jogos (Mesmíssima, Já Deu?, Ecooo):

| Nome | Por quê |
| --- | --- |
| **Atravessa!** | Direto, imperativo, é o verbo do jogo |
| **Pula Pula** | Fácil de dizer; mas parece infantil |
| **Bora Lá** | Combina com o "andar sem parar" |
| **Sai Fora!** | Combina com perigo vindo de trás |
| **Cruzô** | Gíria, curto, memorável |
| **Do Outro Lado** | A pergunta da galinha, em português |
| **Vai Que Vai** | Ritmo, "vai que dá" |
| **Passa Rápido** | Descreve a regra do avanço |
| **Quadradinho** | Referência ao visual de blocos |
| **Mexeu, Perdeu** | Herda o nome do Sinal Vermelho, mas não combina mais |

Minhas três: **Atravessa!**, **Cruzô**, **Vai Que Vai**.

## Fontes

- Tutorial Three.js (freeCodeCamp): https://www.freecodecamp.org/news/how-to-code-a-crossy-road-game-clone-with-threejs/
- Clone Expo + Three.js: https://github.com/EvanBacon/Expo-Crossy-Road
- Reviews: https://justuseapp.com/en/app/924373886/crossy-road/reviews e https://www.commonsensemedia.org/app-reviews/crossy-road-endless-arcade-hopper
- Making of / dinheiro: https://www.pocketgamer.biz/making-of-crossy-road/ e https://www.cultofmac.com/news/crossy-road-developers-made-10-million-90-days
- Wiki dos fãs: https://crossyroad.fandom.com/
- Guia: https://www.bluestacks.com/blog/game-guides/crossy-road/cyr-beginners-guide-en.html
