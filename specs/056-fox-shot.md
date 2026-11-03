# Spec 056: Fox Shot! (tiro das raposas) — RASCUNHO PARA DISCUSSÃO

Pedido do Lucas em 03/11/2026. Status: **rascunho: nada foi construído. Falta o Lucas responder as dúvidas da seção 9 (várias mexem em regras permanentes).**

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
