# Spec 056: Fox Shot! (tiro das raposas) — RASCUNHO PARA DISCUSSÃO

> Nome do jogo: **Counter Fox** (decisão do Lucas em 03/11/2026; antes "Fox Shot!"). O código e esta spec mantêm o nome interno `foxshot`.

Pedido do Lucas em 03/11/2026. Status: **rascunho: nada foi construído. O Lucas respondeu as dúvidas em 03/11/2026 (seção 10); falta confirmar o modo (mata-mata) e aprovar a fase 0.**

## 1. O que o Lucas pediu

1. Um **jogo de tiro** no NoCap para jogar **com amigos**; as personagens são **as raposas** que já temos, agora **com armas**.
2. **Gráfico mais realista** que o padrão dos últimos jogos do NoCap, mas **leve**: nada do peso do Riposte.
3. **Mais leve e mais dinâmico** que o Riposte (que é "absurdo de completo": mapas, veículos, killstreaks, roupas).
4. **Primeira etapa contra bots**, só para ele testar se gosta; **depois** o online com amigos.
5. **Arte das armas bem feita**, sem "quadrados coloridos": modelos de verdade, com **animações** (recarregar, atirar, sacar, etc.).
6. **Arma primária e secundária**.
7. **Um modo de jogo simples**.
8. **Tiro bem feito e "rastreado"**: a sensação boa de que **o tiro chegou**.
9. Movimentação limpa, como a do Poly Arena. O L-Town foi descartado (travado).

## 2. O que extrair dos jogos de referência

**Riposte: Frontline** (MIT; só li o README, o código em si ainda não):
- Pegar: o conjunto de **ideias leves** (toda a geometria é gerada por código, sem modelos importados e um HTML só); controle por **toque + teclado/mouse + controle**; **ajustes de gráfico por GPU**; bots com **navegação** própria; **ragdoll** simples na morte.
- Não pegar: veículos, killstreaks, roupas, contas, vários mapas grandes. O servidor, contas e ranking do jogo oficial nem estão no repositório, e os autores não aceitam contribuições: serve de estudo, não de base para forkar.
- Próximo passo de estudo: ler `src/06-*` (armas, animações), `src/03-*`/`07-*` (bots) e `src/09-*` (toque) para ver como fazem recuo, recarga e mira.

**Poly Arena** (MIT): o que vale é a **movimentação**: aceleração e freio curtos, controle no ar, sem "peso". É o que o nosso movimento tem que sentir. Servidor de salas com código de 6 letras: igual ao nosso modelo de sala.

**L-Town**: não usar. WebGPU e P2P de muitos jogadores travam.

## 3. Visão do jogo (proposta)

- **Nome de trabalho:** Fox Shot! (família Fut Fox, Ping Fox!, Desmorona!, Atravessa!). Entra como o 5º jogo do Fox Cap!, com o mesmo lobby de sala, chat, menu (Esc), pausa do líder e telas finais já padronizados.
- **Câmera:** primeira pessoa. Você vê **as patas da raposa segurando a arma** (viewmodel); os outros veem a **raposa inteira** com a arma na mão.
- **Raposa bípede** (de pé, segurando a arma com as duas patas) para a arma pegar bem e o rig humanoide servir de base.
- **Armas (MVP):** 1 **primária** e 1 **secundária** por vida, escolhidas antes da partida.
  - Primárias (escolher 2 para começar): fuzil de assalto (médio alcance, rajada), submetralhadora (rápida, curta), escopeta (perto, dano alto).
  - Secundária: pistola (e talvez uma segunda, tipo revólver, depois).
  - Tudo com **mira (ADS)**, **recarga**, **troca de arma**, **recuo** e **dispersão** que cresce ao atirar e ao correr.
- **Modo único (MVP):** **Mata-mata por tempo**: 5 minutos (ou 25 abates), reaparece em 2 s com 2 s de proteção, placar ao vivo e tela final com abates/mortes/precisão/melhor arma. Depois, equipes (2x2 e 4x4) com a mesma base.
- **Tom:** sem sangue. Acerto = flash + marcador + som; abate = raposa "apaga" (poof) e deixa cair o boné. Combina com o NoCap e evita problema de classificação etária nas lojas (confirmar na seção 9).
- **Mapa:** 1 arena compacta (uns 40x40 m), cobertura e um pouco de altura, iluminação "assada" (sem sombras em tempo real caras).

## 4. Como fazer o gráfico "mais realista" sem pesar

Alvo: **60 fps no iPhone 12 em diante** e em notebook comum; abaixo disso, caímos de qualidade sozinhos (já temos `lowFx` e ajuste por razão de pixels no Ping Fox!).

- **Estilizado com material PBR leve** (MeshStandardMaterial com 1 mapa de cor + 1 de normal/rugosidade juntos, atlas de 1024 px), **IBL** de uma cubemap pequena em vez de muitas luzes, **sombra assada** no mapa e 1 sombra simples só da raposa/arma.
- Orçamento: < 150 draw calls, < 150 mil triângulos na cena, raposa 3 a 5 mil, arma na mão 6 a 10 mil, malha comprimida (meshopt) e texturas KTX2.
- Sem pós-processamento caro. Só um leve realce (bloom curto nos flashes) opcional e desligável.
- O mapa usa **instanciamento** e **geometria mesclada**.
- **Regra permanente a abrir exceção:** `RULES.md` exige Pop Brutal e proíbe "gradiente genérico". Esta cena 3D precisa de uma **exceção nomeada** igual à do Aperta! (menus, HUD e lobby continuam Pop Brutal). Só vale com um "sim" do Lucas (seção 9).

## 5. Arte das armas (a parte que o Lucas mais quer)

O que **não** vamos fazer: armas montadas de caixas por código.

Caminhos reais (dúvida 5 na seção 9):
- **A. Pacotes CC0 como base** (Kenney Blaster Kit, Quaternius 50+ LowPoly Guns): ambos são CC0, ou seja, uso livre sem atribuição. O Quaternius vem em FBX/OBJ/Blend (precisa converter para glTF); o Kenney lista glTF na página mas é preciso conferir no download. Dá bom ponto de partida em horas, não em semanas, mas o estilo é "low poly", não realista, e precisa de **retexturização** nossa (identidade fox) para ficar com cara de jogo.
- **B. Modelagem própria ou encomenda** (Blender): resultado mais bonito e único, mas é o item mais caro. **Aqui não há Blender nem conversor instalados**, então o modelo teria que vir pronto do Lucas ou de um artista.
- **C. Híbrido (recomendado):** começar com a A para o protótipo e trocar por B as armas que mais importarem.

**Animações** (reload, tiro, sacar, guardar, correr, inspecionar, vazio): o modelo precisa de **partes móveis separadas** (ferrolho/ferrolho, carregador, gatilho, cão, mão esquerda). Animamos por **keyframes de transform + molas** (recuo, balanço ao andar, respiro) no código: leve e sem rig complexo. Para a raposa em terceira pessoa, o glTF precisa de **esqueleto** com: parada, correr, andar de lado, atirar, recarregar, morrer.

**Extras que dão "peso" ao tiro:** clarão no cano (sprite), cápsula ejetada (instanciada), fumaça curta, rastro luminoso (tracer), faísca e marca no impacto, som de impacto por superfície, tremor de câmera, FOV que abre e fecha na mira.

## 6. Tiro bem feito e "rastreado"

- **Hitscan** (raio instantâneo) para todas as armas do MVP; o **rastro (tracer)** é só visual e viaja rápido, para dar a sensação de "chegou".
- **Acerto no mesmo instante na tela de quem atirou** (marcador de acerto + som + número de dano), **antes** de o servidor responder; o servidor confirma ou corrige depois. É o que dá a sensação de que "pegou".
- **Dispersão e recuo determinísticos:** cada tiro tem uma semente `(jogador, número do tiro)`, então cliente e servidor calculam **a mesma direção** e não discordam.
- **Caixas de acerto** em cápsulas (corpo, cabeça com bônus, pernas menos).
- **Online:** servidor **autoritativo**; o cliente prevê o próprio movimento; os outros jogadores aparecem **interpolados (~100 ms atrás)**; o servidor **volta no tempo (até 200 ms)** para validar o tiro contra onde o alvo estava na tela de quem atirou (compensação de atraso). Referência: Gabriel Gambetta, "Fast-Paced Multiplayer".
- **Indicadores:** marcador de acerto, de acerto na cabeça, de abate, e setas de **de onde veio o dano**.

## 7. Arquitetura no repositório

- `packages/games/src/foxshot/`: lógica pura e determinística: movimento (aceleração, pulo, controle no ar, agachar, correr), colisão do mapa (caixas e cápsulas), armas e munição, tiro/dispersão/dano, fases da partida, placar, bots. **Sem lógica de jogo fora daqui**, igual ao resto.
- `apps/web/src/games/foxshot/`: `FoxShotScene` (cena, mapa, raposas), `viewmodel` (arma na mão e animações), `FoxShotPlay` (laço, entrada, HUD), `controls` (mouse+teclado e toque), `FoxShotFinal`.
- `apps/api/src/rooms/foxshot-room.engine.ts` (fase online): motor da sala, jogo `foxshot` dentro do `FoxRoom`.
- Controles: **PC** (WASD, mouse com ponteiro preso, botão esquerdo atira, direito mira, R recarrega, 1/2 troca); **celular** (joystick à esquerda, arrastar para olhar, botões de atirar/mirar/recarregar/pular, **mira assistida leve**, tudo dentro das áreas seguras do iPhone).
- Mapa: lista de caixas AABB gerada por código a partir de uma descrição, usada tanto na colisão quanto na cena (uma fonte só).

## 8. Fases

0. **Protótipo de sensação (1 sala vazia, 1 arma):** movimento + mira + tiro + recuo + clarão + rastro + acerto num alvo parado e em bots bobos. Objetivo único: o Lucas decidir se **gosta da sensação** antes de gastar na arte.
1. **Treino contra bots:** mapa final do MVP, 2 primárias + 1 secundária, mata-mata por tempo, HUD, tela final, bots em 3 níveis, pausa, menu Esc padronizado.
2. **Arte e animações:** armas e raposa finais, sons, efeitos, graficos por nível de qualidade.
3. **Sala online com amigos:** servidor autoritativo, previsão do movimento, interpolação, compensação de atraso, lobby/chat/pausa do Fox Cap!, painel de rede.
4. **Depois:** equipes, mais armas, mais mapas, skins de raposa.

Cada fase termina com testes (unitários da lógica, e2e de tela e, para online, duas janelas) e **o Lucas jogando**, como nos outros jogos.

## 9. Dúvidas para o Lucas (precisam de resposta)

Obrigatórias (mexem em regra permanente ou decidem o caminho):
1. **Exceção de visual:** abrir uma exceção nomeada em `RULES.md` para a **cena 3D do Fox Shot!** ser mais realista (materiais PBR, luz e sombra), mantendo **menus, HUD, lobby e telas finais** em Pop Brutal? (Igual à exceção do Aperta!.)
2. **Violência e tom:** sem sangue (flash + "poof") e raposas "apagando" em vez de morrer, para não ter problema de classificação etária? Ou quer algo mais pesado?
3. **Arte das armas:** caminho C (pacotes CC0 retexturizados no começo, trocar as principais depois)? Você tem um artista/modelos, ou eu parto dos pacotes? (Não há Blender aqui.)
4. **Arte da raposa:** raposa **bípede** com esqueleto (precisa de um modelo novo; a atual do Atravessa! é procedural e de quatro patas?) Como obtemos: modelamos, encomendamos ou adaptamos um modelo livre?

Importantes:
5. **Primeira ou terceira pessoa** (ou as duas)? Proposta: primeira, com patas no viewmodel.
6. **Celular desde o MVP** (toque + mira assistida) ou primeiro só PC e depois celular? Seus amigos jogam onde?
7. **Quantos jogadores** na sala: 4, 6 ou 8? (muda o tamanho do mapa e o custo de servidor)
8. **Modo:** mata-mata por tempo (todos contra todos) primeiro, ou já equipes?
9. **"Rastreado":** você quis dizer o **rastro luminoso** da bala (tracer), ou que o tiro **acompanhe o alvo** (compensação de atraso), ou os dois? A proposta cobre os dois.
10. **Sons de arma:** ok usar **amostras CC0** (Freesound/Kenney)? O áudio atual do NoCap é todo sintetizado, e som de arma sintetizado costuma soar fraco.
11. **Servidor:** ok o servidor autoritativo (mais justo para atirar) em vez do líder simular no aparelho como no Fut Fox? Custa um pouco mais de CPU na hospedagem.
12. **Alvo de aparelho:** qual seu iPhone e o mais fraco que seus amigos usam?

Ideias para considerar (sem compromisso):
- Boné da raposa que **cai** no tiro na cabeça (feedback divertido e visível).
- **Emotes** rápidos (acenar, rir) e **bandeira/adesivo** na arma.
- **Repetição curta (kill cam)** de 3 s do abate.
- **Rodada relâmpago** de 2 min para partidas rápidas entre amigos.
- **Aquecimento** com bots enquanto a sala enche.
- **Escolha de arma com pré-visualização** girando (a arte das armas vira vitrine).
- **Marca de abates na arma** (contador).
- Modo futuro: **Rei do morro** ou **Pega-bandeira**, por serem simples de explicar.

## 10. Decisões do Lucas (03/11/2026)

1. **Exceção de visual aprovada:** a cena 3D do Fox Shot! pode ser mais realista (PBR, luz e sombra). Menus, HUD, lobby e telas finais continuam Pop Brutal. (Falta registrar a exceção nomeada em `RULES.md` quando a fase 0 for aprovada.)
2. **Sem sangue** aprovado (flash, "poof", boné cai).
3. **Arte das armas: o Claude faz tudo** (o Lucas não tem artista nem modelos). Sem Blender aqui: os modelos são gerados por código com geometria de verdade (perfis extrudados com chanfro, torneados, peças móveis separadas) e texturas desenhadas por código (metal, desgaste, empunhadura, mapa de relevo), conferidos por **fotos da cena** e refinados em uma **vitrine de armas** (página de teste que gira a arma). Pacotes CC0 só entram se um baixar bem e servir de ponto de partida.
4. **Raposa em pé**, com animações **simples**: parada (respira, cauda balança), correr/andar/de lado, atirar (coice do corpo), recarregar, tomar acerto e cair ("poof"). Tudo por código (articulações e senoides/molas), sem arquivo de animação.
5. **Primeira pessoa.**
6. **Computador e celular** (iPhone e Android, todos os tamanhos): **no celular só joga deitado**; em pé aparece o aviso "gire o aparelho". Respeita áreas seguras (câmera frontal, laterais, barra do Android).
7. **12 pessoas por sala: até 10 jogando e 2 espectadores** (nossa sala hoje vai até 15).
8. **Bala igual ao CS (revisado em 03/11/2026): instantânea (hitscan)**, sem queda, vai exatamente aonde a mira aponta; o rastro luminoso é só visual. O servidor valida o acerto no instante do disparo com compensação de atraso ("pegou para mim, pegou para todos"). **Recuo diferente em cada arma** (padrão de recuo fixo por arma, como a rajada do CS).
9. **Sons gravados liberados**, desde que combinem com a estética do jogo.
10. **Servidor autoritativo aprovado.**
11. **Qualidade automática:** aparelho fraco fica mais feio (menos sombra, menos efeitos, menos resolução) e o forte fica mais bonito e mais renderizado. Mede o fps e sobe ou desce de nível sozinho.
12. **Modo (revisado):** o primeiro modo é o **mata-mata** (todos contra todos, por tempo).

## 11. Regras de dano e recuo estilo CS (pedido do Lucas, 03/11/2026)

Valores iniciais para ajustar jogando (nada é definitivo):

- **Vida 100.** **Colete** (corpo) e **capacete** (cabeça) opcionais, como o "kevlar + capacete" do CS.
- **Cálculo (igual ao CS):** dano base × multiplicador da região (cabeça ×4, tronco ×1, barriga ×1,25, pernas ×0,75) × queda por distância (`alcance^(distância/50 m)`). Com colete na região, o dano na vida é `dano × fator de armadura da arma × 0,5` e o colete perde o resto.
- **Headshot do fuzil (tipo AK-47):** **mata com ou sem capacete** (dano base 36 × 4 = 144; com capacete e fator 1,55 dá ~111 ≥ 100).
- **Pistola:** o dano **depende da distância**, e o **colete/capacete decide**: de perto e sem capacete o tiro na cabeça mata; com capacete ou de longe **não mata** (fator de armadura baixo, 0,5). Cada pistola futura terá o seu número (umas matam com colete, outras não).
- **Sniper (tipo AWP):** **mata com qualquer acerto**, com colete ou sem, em qualquer parte do corpo. **Não mata se o tiro atravessou parede (varado):** o dano cai pela espessura do material.
- **Penetração:** paredes e caixas finas deixam o tiro passar com dano reduzido; paredes grossas bloqueiam. Cada arma tem seu poder de penetração (a sniper mais, a pistola menos).
- **Recuo por arma:** cada arma tem seu **padrão de recuo** (uma sequência fixa de deslocamentos da mira por tiro, com um pouco de aleatoriedade), **precisão do primeiro tiro**, **dispersão ao andar e ao pular**, e **tempo de recuperação**. O fuzil sobe e vai para um lado; a pistola dá coices curtos; a sniper dá um coice grande e **só tem precisão parado e mirando**.
- **Marcadores:** acerto no corpo, na cabeça e abate (cada um com som diferente).

## 12. Fase 0 detalhada (o que será construído agora)

Objetivo: o Lucas **olhar e sentir** o visual, os sons e o início do tiro, **antes** do modo contra bots.

1. **Arte (Blender por script, em `tools/art/`)**: **3 armas** (1 fuzil, 1 pistola, 1 sniper) com peças móveis e **fotos** de cada uma para o Lucas aprovar o estilo; **1 raposa em pé** com esqueleto.
2. **Animações iniciais:** raposa (parada, correr, atirar, recarregar, cair); armas na mão (sacar, atirar, recarregar, parada).
3. **Mapa de teste:** uma arena pequena com o "começo do estilo" dos mapas finais: chão, paredes, caixas, uma rampa, cobertura, luz e sombra assada.
4. **Jogabilidade mínima:** movimento (WASD e mouse; celular deitado), 3 armas trocáveis com **recuo próprio**, mira (ADS), recarga, tiro instantâneo com rastro, marcador de acerto, **alvos e uns bots parados** para testar **headshot, colete e distância**.
5. **Sons gravados** (tiros, recarga, passos, acerto) que combinem com o jogo.
6. **Qualidade automática** pelo fps.
7. Página de teste em `/fox-cap/fox-shot-teste` (sem sala, sem pontuação).

Não faz parte da fase 0: bots que jogam, mata-mata completo, online, tela final, ranking.

## 13. Orçamento de desempenho (03/11/2026)

Pergunta do Lucas: "não está complexo ou pesado para rodar online com amigos, sem travar e no celular?". Resposta: **não está pesado se seguirmos este orçamento; os arquivos de hoje ainda estão acima dele e serão reduzidos.**

| Item | Hoje | Meta | Como chega lá |
|---|---|---|---|
| Raposa (3ª pessoa) | ~7 mil triângulos | 3 a 4,5 mil (e ~1,5 mil de longe) | menos segmentos nas esferas, LOD por distância |
| Fuzil / sniper na mão | ~11 mil | 6 a 8 mil | reduzir o que não aparece na mira |
| Pistola | ~17 mil | 5 a 6 mil | decimar mais (o Lucas liberou) |
| Arma na mão dos outros (3ª pessoa) | igual à da mão | ~1,5 mil | versão baixa |
| Cena inteira (10 raposas + mapa) | n/d | < 150 mil triângulos, < 150 chamadas de desenho | mapa mesclado/instanciado |
| Luz e sombra | n/d | luz assada no mapa; **uma** sombra dinâmica (raposa e arma) | sem pós-processamento |
| Resolução no celular | n/d | razão de pixels 1,0 a 1,5 (sobe/desce sozinha pelo fps) | `applyRatio` como no Ping Fox! |
| Texturas | n/d | atlas 1024, KTX2 | 1 material por grupo |

O que mais pesa no celular não é o número de triângulos, e sim **sombra, resolução e material realista (PBR)**. Por isso: qualidade automática por fps (baixo = sem sombra, resolução menor, raposas simples), medidor de fps e de peso visível na fase 0, e teste no celular do Lucas **antes** de gastar mais em arte.

Rede: tiro é leve (10 jogadores a 20 a 30 estados por segundo, algumas dezenas de bytes por jogador). O risco é **variação do atraso**, que se resolve com: servidor autoritativo a 30 Hz, previsão do próprio movimento, interpolação dos outros (~100 ms), compensação de atraso no tiro e relógio medido (mesmas lições do Ping Fox!). Primeiro a fase offline contra bots, que isola o desempenho gráfico da rede.

## 14. Fase 0 implementada (03/11/2026)

- Página de teste: `/fox-cap/fox-shot-teste` (botão "Fox Shot! (teste de visual e tiro)" no Fox Cap!, aba Offline). Sem sala, sem bots que jogam, sem pontuação.
- Lógica pura em `packages/games/src/foxshot` (21 testes): dano estilo CS (`fsDamage`), recuo e dispersão por arma (`fsFire`, semente por jogador e número do tiro), raio com penetração (`fsTrace`), movimento com colisão (`fsStepMover`), arma na mão com munição, recarga, troca e ferrolho (`FsLoadout`), mapa e alvos (`FS_ARENA`, `FS_TARGETS`).
- Cena (`FoxShotScene`): arena com texturas por código, céu, luz com uma sombra, reflexo para os metais, 7 raposas-alvo com esqueleto e animação, arma na mão em passe próprio, clarão, rastro e poeira. Qualidade automática (baixa, média, alta) pelo fps e painel de desempenho.
- Entrada: computador (WASD, mouse preso, botão esquerdo atira, direito mira, R, 1 a 3, roda) e celular deitado (joystick flutuante, arrastar para olhar, botões; em pé pede para girar).
- Sons sintetizados em Web Audio (provisórios; gravações entram depois, spec seção 9, pergunta 10).
- Modelos: `apps/web/public/models/foxshot/{fox,rifle,pistol,sniper}.glb` (feitos no Blender por `tools/art`). Os modelos de referência do Lucas (AK, Glock, L96A1) são carregados de `models/foxshot/ref/` **se existirem**; essa pasta não é versionada (licença a confirmar).
- Testes de tela (`e2e/foxshot.spec.ts`): carrega e mostra o HUD, regras de dano contra alvos de verdade (fuzil mata de cabeça com e sem capacete, pistola não mata de cabeça com capacete, sniper mata no corpo com colete e capacete), HUD de toque no celular deitado e aviso de girar em pé.
- Falta: sentir o tiro e o recuo jogando, medir fps em celular de verdade, gravações de som, mapa final, bots que jogam (fase 1).

## 15. Espaços de arma, faca, agachar, loja (implementado na fase 0)

- Três espaços: 1 primária, 2 secundária, 3 faca (nunca sai). Começa com fuzil e pistola; a sniper vem da loja.
- Ctrl agacha (câmera desce, anda mais devagar, mira mais fechada); Shift anda devagar e sem passos; F inspeciona; G larga; E pega; B abre a loja. Tudo remapeável no menu (Comandos).
- Faca: botão de atirar corta (35), o de mirar estoca (70, recarga 1 s), alcance 1,7 m, sem atravessar parede.
- Loja (B): colunas Equipamento, Pistolas, Intermediárias, Fuzis, Granadas; dinheiro infinito; itens futuros ficam apagados ("em breve", `soon` em `FS_SHOP`). Comprar a arma que já tem só enche o carregador; comprar outra no mesmo espaço larga a antiga no chão.
- Armas no chão: no máximo 6 (a mais antiga some) e cada uma some em 25 s.
- Braços e faca: modelo do Lucas (`tools/art/arms_knife.py` converte para `public/models/foxshot/ref/arms_knife.glb`, fora do git até confirmar a licença); sem o arquivo entra uma faca simples. A pose de segurar é o primeiro quadro da animação `inspect`.
- Pendente: mãos segurando fuzil, pistola e sniper, e as animações de recarga (referências: AUG para sniper, G3 para fuzil, Desert Eagle para pistola; os arquivos são personagens completos e precisam ser retargetados).

## 16. Recarga em fases, inspeção das armas e agachar (implementado)

- Recarga: mão da frente vai ao carregador, ele sai e cai (some em 0,9 s), a mão busca outro atrás e embaixo, traz, encaixa, puxa o ferrolho (fuzil/sniper) ou solta a trava (pistola) e volta ao apoio. Baseada na análise do movimento das mãos nas referências (AUG, G3, Desert Eagle: aproximar, soltar, pegar outro, encaixar, carregar, voltar). Não usa os arquivos das referências, só o tempo e a sequência.
- Inspeção (F) nas armas: olha de um lado, do outro e volta (3,0 a 3,8 s); cancela ao atirar, recarregar ou trocar.
- Agachar: a raposa tem o clipe `crouch` (fox.glb) e `FsBody.crouch` desce a cabeça e o corpo no tiro (`FS_CROUCH_K` = 0,95/1,3). Quando o online existir, o estado agachado precisa viajar na rede e alimentar os dois (clipe e `FsBody.crouch`).

## 17. Movimento estilo CS, bots de treino, assistências (implementado na fase 0)

- Movimento (`movement.ts`): atrito de chão (desliza ao soltar, `stopSpeed`), aceleração por velocidade na direção desejada (contra-strafe freia rápido), aceleração aérea com teto baixo (`airCap`) que permite strafe e bunny hop (segurar pulo = pulo automático no pouso, sem perder velocidade), pulo de ~0,95 m e Ctrl no ar sobe os pés (~+0,35 m): sobe em degraus de até ~1,25 m. Valores proporcionais aos do CS (sv_accelerate 5,5, sv_friction 4, sv_airaccelerate 12). Área de teste no leste da arena (degraus 0,35 / 0,7 / 1,0 / 1,25 / 1,6) e velocímetro na telemetria.
- Bots de treino (`bots.ts`): faixa no noroeste com 5 raias (andando, shift, agachado, pulando, girando); morrem caindo, escorregam, afundam e nascem de novo.
- Assistências (`assist.ts`): só ganha quem deu dano logo antes de quem matou e há no máximo 10 s; quem bateu antes de outra pessoa não conta. Placar com coluna Assist. (sem coluna de colete) e kill feed com "matador + assistente", destacado em vermelho quando é meu. No arena de teste só existe um jogador dando dano, então o número fica em 0 até o online.

## 18. Armas novas e nomes (implementado na fase 0)

Nomes (decisão do Lucas, 04/11/2026: diferentes do padrão, mas dentro da ideia da arma): Ruivo (fuzil, antes "Fuzil"), Cinzento (fuzil leve M4), Mosquito (submetralhadora MP5), Trovão (escopeta), Coruja (sniper), Faísca (pistola), Sussurro (pistola silenciada USP-S), Garra (faca).
- Submetralhadora: 24 de dano, 850 rpm, 30 balas, recuo curto.
- Escopeta: 8 cartuchos, 9 projéteis de 17 por tiro em um cone de 4,2 graus, bombeia entre tiros (0,85 s), dano cai rápido com a distância (x0,35 a cada 50 m); som grave e largo, ouve-se a 48 m.
- Fuzil leve (M4): 31 de dano, 700 rpm, 25 balas, recuo regular e puxando para a direita.
- Pistola silenciada (USP-S): 28 de dano (a Faísca dá 34), 12 balas, dispersão ~5x menor, som de "pft", ouve-se só a 12 m.
- Modelos (`tools/art/*_from_ref.py`): MP5, escopeta, M4 e USP-S enviados pelo Lucas, em `public/models/foxshot/ref/`. Licenças a confirmar.

## 19. Granadas (implementado na fase 0)

- Duas granadas (modelos do Lucas em `ref/frag.glb` e `ref/flash.glb`): explosiva (explode 1,9 s depois de jogada; 60 de dano no centro, caindo em linha reta até 0 em 7 m; parede protege) e de luz (1,5 s; cega por até 4,6 s quem olha e enxerga, quem não vê só ouve o estouro; zumbido nos ouvidos e som abafado que passam aos poucos).
- Arremesso: clique rápido = força média; segurar e soltar = mais forte. Tirar o pino (mão esquerda) ao segurar; o braço vai para trás conforme a força.
- Inventário: máximo de 2 de cada; compra na loja (coluna Granadas). Tecla 4 (configurável) pega a primeira, de novo a outra, de novo volta à arma; teclas próprias para cada granada nos Comandos (sem tecla por padrão; Backspace tira a tecla); a roda do mouse passa por armas e granadas.
- Comandos agrupados por categoria: Movimento, Armas, Granadas, Geral.
