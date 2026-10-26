# Spec 045: telas fora do jogo, responsivas e mais claras

Status: **em andamento** (aprovada pelo Lucas em 26/10/2026 com todas as recomendações).

Feito: etapa 1 (moldura `Page` com menu lateral em todas as telas fora do jogo, escala em telas grandes, varredura de layout em `e2e/layout-sweep.spec.ts`); etapa 3 (entrada da sala e lobby sem abas, convite com um toque, regras e convites recolhidos, duas colunas no desktop); etapa 4 (pódio com vencedor em destaque e votação compacta); etapa 5 (entrar e criar conta em cartão); etapa 6 parcial (menu enxuto no celular deitado, alvos de toque de 44 px).
Falta: etapa 2 (modelo único de menu de jogo, "continuar" no Hub, detalhe do modo no desktop), ranking com seletor de jogo, amigos em duas colunas no desktop, e revisão de foco/contraste.

## 1. O que foi analisado

Varredura com o navegador (Chromium) de 19 telas fora do jogo em 4 tamanhos (celular em pé 390×844, tablet 820×1180, desktop 1440×900, celular deitado 844×390): Hub, menus de Mesmíssima, Já Deu?, Ecooo, Atravessa!, Block's, Word's (hub, Classic, Connect, Bee), Aperta!, Amigos, Ranking, Perfil, Entrar, Criar conta, entrada da Sala, Fox Cap! e menu do Desmorona!. Mais o lobby da sala (líder e membro, abas Membros, Regras e Convidar) de Mesmíssima e Ecooo em 3 tamanhos. Não foram jogadas de novo todas as partidas; os pontos por jogo (seção 4) vêm do que apareceu nas telas e do que foi construído e testado nesta sessão.

Achado bom: **nenhuma tela tem rolagem horizontal** em nenhum dos 4 tamanhos.

## 2. Diagnóstico

1. **O app é um celular esticado.** Em tablet e desktop o conteúdo ocupa uma coluna de 560 a 720 px no meio de 1440 px. Só o Hub e as abas (Ranking, Amigos, Perfil) têm o menu lateral. Menus de jogo, sala, login e pós-jogo ficam sem navegação e sem aproveitar a largura.
2. **Texto minúsculo no desktop e no tablet.** 228 declarações de fonte de 9 a 11 px (rótulos em mono). No celular passa, em tela grande vira ilegível.
3. **Sala (lobby) com informação demais e sem hierarquia.** O cabeçalho repete a mesma ideia em 5 lugares (código, "2/12 na sala", "10 vagas", "faltam 1 marcar pronto", faixa de líder). A aba Convidar mistura 4 coisas (compartilhar, copiar link, copiar código, procurar pessoa, chamar amigos) e tem texto técnico ("Este aparelho não abre a lista de apps..."). A aba Regras tem 4 a 6 grupos de opções com nomes longos. Três botões grandes empilhados (Começar, Sair da sala, Encerrar sala) com o mesmo peso. O botão Começar desabilitado não diz por quê.
4. **O botão de chat cobre botões** (Sair da sala, Começar) no celular.
5. **Telas de formulário (Entrar, Criar conta) com os botões presos no fundo**, longe dos campos em telas altas.
6. **Menus de jogo sem prioridade.** Mesmíssima mostra o Daily e seis modos com o mesmo peso; Ranking é uma grade de 6 cartões gigantes iguais; Block's, Classic e Words têm três padrões diferentes de cabeçalho e abas.
7. **Padrões diferentes para a mesma coisa:** voltar (às vezes "Jogos", "Voltar", "Voltar ao jogo", "Fox Cap!"), abas (preto/branco, laranja/branco, amarelo), cartões de modo (três estilos).
8. **Celular deitado:** o menu lateral estreito ocupa a tela baixa e o conteúdo mostra só o topo; falta layout próprio para altura menor que 500 px.

## 3. Plano em etapas

**Etapa 1: fundação responsiva (1 dia)**
- Quatro faixas: celular (< 640), tablet (640 a 1023), desktop (1024 a 1439), largo (≥ 1440), mais um modo "baixo" (altura < 500 px, celular deitado). Uma única fonte de verdade para largura de coluna, espaçamento e tamanho de texto (escala `clamp()`), e piso de **13 px** no texto de corpo (11 px só em rótulo).
- Um componente de página único (`PageShell`) com cabeçalho, voltar padrão (sempre "‹ nome da tela anterior"), rail lateral em tablet/desktop em **todas** as telas fora do jogo e barra inferior só no celular.
- Teste automático de varredura (o que foi feito agora) como e2e permanente: 4 tamanhos × todas as telas, falha se houver rolagem horizontal, texto cortado ou botão fora da tela.

**Etapa 2: Hub e menus dos jogos (1 a 2 dias)**
- Hub: no desktop vira grade de 3 a 4 colunas com o Daily em destaque em cima; "continuar de onde parou" como primeiro cartão.
- Um só modelo de menu de jogo (`GameMenu`): banner curto, **uma ação principal grande** (Jogar / Daily), modos secundários numa lista de linhas (não em cartões iguais), "Jogar com amigos" sempre no mesmo lugar, "Como jogar" num painel recolhido. Aplicar em Mesmíssima, Já Deu?, Ecooo, Block's, Atravessa!, Fox Cap!, Desmorona!, Word's.
- Desktop: menu à esquerda, painel de detalhe do modo à direita (regras, recorde, ranking do jogo), em vez de uma coluna estreita.

**Etapa 3: criar sala, entrar na sala e o lobby (2 dias), a tela mais importante**
- Entrada da sala: duas escolhas lado a lado ("Criar sala" e "Entrar com código"), campo de código com 4 caixas.
- Lobby em 3 blocos fixos, sem abas no desktop:
  1. **Topo:** código grande + botão Copiar/Compartilhar (a ação de convidar vira um botão só, e o resto some para um painel "Mais formas de convidar").
  2. **Jogadores** (lista com cor, pronto, líder), com o estado "faltam X" aparecendo uma vez só.
  3. **Regras:** resumo em uma linha ("Clássico · 5 rodadas · 30 s") com botão "Mudar regras" que abre uma gaveta; membros só leem.
- Um botão principal (Começar, ou Estou pronto) que sempre diz por que está desabilitado ("Falta 1 pessoa marcar pronto"). "Sair" vira link; "Encerrar sala" fica dentro de um menu "…" com confirmação.
- Desktop: lobby em duas colunas (jogadores à esquerda, regras e convite à direita). O chat vira painel lateral no desktop e botão que **não cobre ações** no celular (barra inferior própria).
- Texto técnico removido ou trocado por frases curtas.

**Etapa 4: pós-jogo e rankings (1 a 2 dias)**
- Pódio da sala: vencedor grande, lista com tempo/pontos de cada um e destaque para "você", voto "jogar de novo" com contagem simples (sem lista repetida de membros), botão principal "Jogar de novo" e secundário "Sair".
- Resultado de partida solo: nota/recorde grande, comparação com o melhor, 2 botões (Jogar de novo, Voltar ao menu).
- Ranking: abas Hoje / Semana / Sempre e Amigos / Geral no topo, lista compacta; escolher o jogo num seletor, não numa tela de 6 cartões gigantes.

**Etapa 5: conta, amigos, perfil (1 dia)**
- Entrar e Criar conta: formulário e botão juntos, centralizado e com largura máxima; erros inline.
- Amigos: lista + pedidos + adicionar numa tela com busca fixa em cima; desktop em duas colunas (lista e perfil do amigo).
- Perfil: números em cartões, ações da conta numa lista.

**Etapa 6: celular deitado, acessibilidade e QA (1 dia)**
- Layout "baixo" para altura < 500 px (cabeçalho compacto, ações em linha).
- Foco visível, alvos de toque ≥ 44 px, contraste, `prefers-reduced-motion`.
- Rodar a varredura nos 5 modos e capturar antes/depois no PR.

Total estimado: **7 a 9 dias de trabalho**, entregue por etapa (cada uma vai para a `main` e pode ser revertida sozinha).

## 4. Pontos negativos por jogo (a melhorar)

- **Mesmíssima:** menu com 7 opções do mesmo peso (Daily + 6 modos), o Intruso (só com amigos) aparece misturado aos solo; regras da sala longas (modo, rodadas, tempo para decorar e recriar).
- **Já Deu?:** o menu e a sala seguem o mesmo molde da Mesmíssima, sem explicar de cara que o objetivo é contar de cabeça sem ver o relógio.
- **Ecooo:** "Siga o Líder" aparece como se fosse um modo, mas é outro formato de jogo; descrição do modo é um parágrafo longo; sem prévia de quantos botões ou quantos passos.
- **Atravessa!:** dois lugares para jogar (menu e Fox Cap!), recorde e ranking só aparecem depois de entrar; na sala, mapa e modo (Checkpoint/Infinito) têm 8 opções entre tamanhos e rodadas.
- **Fox Cap! / Desmorona!:** partidas com bots mais curtas que o planejado (cerca de 1 minuto), sem modos extras nem itens, quem recarrega no meio da partida entra como caído, o treino ainda não tem ajuste de sensibilidade da câmera nem opção de dificuldade, e no celular falta testar com dedo de verdade.
- **Block's:** Classic e Towers com o mesmo peso, sem dizer qual é o "principal"; sem tela de resultado própria no padrão do resto.
- **Word's:** três jogos num hub com cabeçalhos diferentes (preto, verde, azul, amarelo); no Classic o menu lista fases em cartões longos e o Daily compete com eles; (corrigido hoje: `c` e `ç` valiam letras diferentes nas cores).
- **Aperta!:** tema próprio fora do padrão (permitido), mas a quantidade de abas (melhorias, geradores, grimórios, conquistas, árvore) e de números é grande para quem chega; só funciona deitado no celular (gira a tela em pé).
- **Geral:** voltar, abas e cartões com estilos diferentes; textos pequenos em tela grande; estados de erro e vazio ("não deu para carregar") com o mesmo cartão grande em qualquer tela; falta "continuar" no Hub.

## 5. Decisões que preciso do Lucas

1. No desktop: rail lateral em todas as telas (recomendado) ou só no Hub?
2. Lobby: sem abas no desktop (duas colunas) e com abas no celular (recomendado)?
3. Começar pela sala (etapa 3), que é a que mais incomoda, ou pela fundação (etapa 1, recomendada porque as outras dependem dela)?
