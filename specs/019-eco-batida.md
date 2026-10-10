# 019 · Eco Hero (modo de ritmo do Ecooo, estilo Guitar Hero)

Status: **solo implementado** (10/10/2026): três músicas, perspectiva, pausa, teclas, ranking por música e servidor recalculando a nota. **Falta:** jogar ao vivo e calibrar (janelas de acerto, andamentos, energia), Daily e sala. Nome na tela: **Eco Hero** (decisão do Lucas); id interno `batida`, modos `batida-passo`, `batida-mare` e `batida-frenesi`.

## O que foi decidido
- Barra de energia; multiplicadores x1 a x4; Perfeito, Bom e Errou; errar soa errado; formas junto das cores.
- **Calibração de atraso** só de canto (botão na abertura), nunca antes de cada partida.
- **Música:** opção 1 do rascunho (sons e ritmo, nada de música conhecida), mas com ritmo de verdade: as notas se repetem em frases (A, A, B, A) e cada música tem seu groove, escala e progressão de acordes.
- **Mais devagar** (pedido do Lucas depois do primeiro teste): o andamento máximo caiu de 176 para 100, 116 e 138 batidas por minuto, e a subida é bem mais lenta.
- **Visual em perspectiva:** pista que converge ao horizonte, notas que vêm do fundo crescendo (só `transform` e `opacity`), feita em CSS/SVG. Não precisou de 3D de verdade.
- **Três músicas para escolher** na abertura (a última escolha fica guardada).
- **Pausa** (botão, Esc ou P, e sozinha ao sair da aba): congela o relógio do áudio; no menu da pausa ficam as **teclas do computador**, Voltar ao jogo e Sair; para voltar, **contagem 3, 2, 1**.
- **Teclas configuráveis** (padrão 1 a 5): toque numa pista e aperte a tecla; tecla repetida troca com a outra pista; Esc, Tab, Enter, modificadoras e F1 a F12 não valem.

## As três músicas
| Música | Proposta | Andamento | Dificuldade | Groove |
|---|---|---|---|---|
| **Primeiro Passo** | Calma e doce, para aprender | 64 → 100 | começa só com semínimas nas 3 pistas do meio e chega a síncope | bumbo nos tempos 1 e 3 |
| **Maré Alta** | Balanço com síncope | 78 → 116 | colcheias a síncope, sobe até densa | funk (bumbo deslocado, baixo sincopado), escala menor |
| **Frenesi** | Pesada e sem descanso | 92 → 138 | já começa em síncope e chega ao quase tudo | bumbo em todos os tempos, baixo pulsando, escala de blues |

Cada música é um quadro próprio no ranking (`Eco Hero: Primeiro Passo`, etc.), porque as notas não são comparáveis entre elas.

## O que é

Um modo novo dentro do **Ecooo**: 5 pistas de cor na parte de baixo da tela e notas que descem em direção a elas, como num jogo de ritmo. A pessoa toca no botão da pista **na hora certa**. A música vai ficando mais rápida até a pessoa perder.

Diferença para o Ecooo de hoje: lá se **memoriza e repete** uma sequência; aqui se **reage no tempo certo** a uma música que está tocando. Mesma identidade (cores, formas e sons dos botões), outra habilidade.

## Música: o que dá para fazer de verdade

**Dúvida do Lucas (10/10/2026): "acho que não dá certo música".** Faz sentido: música gerada por código não soa como uma música de verdade, e nenhuma versão aqui vai competir com Guitar Hero. Em ordem de ambição:

- **A) Só sons (o mais seguro).** Cada pista tem uma nota e cada acerto toca a nota; por baixo, só um **batimento de bumbo e caixa** marcando o andamento. Não é música, é ritmo com notas. Ao acelerar, o batimento acelera. É a opção que menos arrisca soar estranha.
- **B) Base simples em loop (meio-termo).** Além do batimento, um baixo e uma harmonia curtos em loop (estilo videogame antigo, "chiptune"), e as notas que a pessoa toca seguem os acordes. Soa como trilha de jogo de 8 bits, não como banda. Dá para ouvir num protótipo antes de decidir.
- **C) Fases compostas à mão (depois).** Músicas curtas e originais feitas nota a nota. Soam bem, mas cada uma dá trabalho e vira conteúdo a produzir.

Sugestão: **começar pela A**, deixando a B como um protótipo para escutar. Se não ficar bom, ficamos na A, que já funciona como jogo de ritmo.

### Como era o plano original (referência)

- **Nada de arquivo de áudio.** O app já sintetiza os sons do Ecooo pela Web Audio (`lib/sfx.ts`, `ecoPad`). Cada uma das 5 pistas vira uma **nota de uma escala pentatônica** (nunca desafina). Acertar toca a nota da pista, e por baixo entra uma **base automática** (bumbo, caixa e baixo) no andamento atual.
- **A seed compõe a música** (progressão de acordes + padrões de melodia), então cada partida é diferente, e o **Daily é a música do dia** para todo mundo. Funciona offline.
- **Músicas conhecidas não entram** (direitos autorais). Fases compostas à mão (originais) ficam para uma etapa futura.
- Camadas: quanto maior o combo, mais instrumentos entram; errar faz a música tropeçar (nota abafada, base some por um instante).

## Regras da partida

- **5 pistas**, uma cor + forma + nota por pista (os botões 1 a 5 do Ecooo). Notas descem; ao chegarem na linha de acerto, a pessoa toca.
- **Acertos:** Perfeito, Bom ou Errou (janelas em milissegundos, a calibrar). Nota que passa sem toque é Errou. Tocar sem nota na pista também conta como erro.
- **Energia:** barra que cai a cada erro e recupera a cada acerto. A partida acaba quando chega a zero (em vez de perder no primeiro erro).
- **Combo e multiplicador:** acertos seguidos sobem o multiplicador (x2, x4, x8); errar zera.
- **Dificuldade sobe sozinha:** o andamento vai de ~80 a ~180 batidas por minuto, a densidade de notas cresce e, mais tarde, entram notas duplas (duas pistas ao mesmo tempo).
- **Nota:** pontos acumulados (acerto × multiplicador). Ranking pela pontuação.

## Modos (versão atual)

1. **Infinito:** até a energia acabar. Vai para o ranking (quadro "Batida").
2. **Daily:** a música do dia, uma tentativa, ranking do dia.
3. **Sala (depois):** todos recebem a mesma música ao mesmo tempo e o placar sobe ao vivo.
4. **Fases compostas (depois).**

## Tela

- Pistas na parte de baixo, **botões grandes para os dois polegares**, a retrato. Forma junto da cor (acessibilidade).
- Topo: pontos, combo/multiplicador e barra de energia.
- Feedback imediato: o botão acende, aparece "Perfeito" ou "Bom", vibração curta (`buzz`) nos acertos.
- **Calibração de atraso** (toque no ritmo umas 8 vezes): fica de canto, num botão "Ajustar atraso" nas opções do modo. Não aparece antes de cada partida. Sem calibrar, vale um atraso padrão. Aviso de som só na primeira vez.

## Técnico

- **Núcleo puro** em `packages/games/src/eco/rhythm.ts` (gerar a "partitura" pela seed, andamento por posição, janelas de acerto, pontuação, `evaluateRun`), com testes. Sem relógio nem áudio dentro do núcleo.
- **Relógio do áudio:** o tempo de tudo vem de `AudioContext.currentTime` (não de `setTimeout`/`Date`), e as notas são agendadas à frente. É o que mantém o som e as notas alinhados.
- **Entrada:** `pointerdown` (sem esperar o clique). O atraso medido na calibração é descontado de cada toque.
- **Animação:** as notas descem só com `transform` e `opacity` (regra do projeto). Com movimento reduzido, as notas continuam descendo (é o jogo) e os efeitos extras somem.
- **Servidor:** recalcula a nota. A música sai da seed, a partida envia só os **instantes dos toques**, e o servidor refaz acertos, erros, combo e energia. Confere se os tempos são plausíveis (intervalo mínimo entre toques, sem toque antes de a nota existir). Limite conhecido, igual ao do Já Deu?: um robô que mande tempos perfeitos ainda passaria.
- **Offline:** joga e guarda na fila de envio (`submitOrQueue`) como a Mesmíssima; a seed do Daily é calculada no aparelho.
- **Dependências novas:** nenhuma (Web Audio já é usado).
- **Sem migration** esperada: reaproveita `matches` e `match_players` com `game: 'eco'`, modo novo (`batida`), e o campo de respostas para os instantes dos toques.

## Plano (em ordem)

1. Regras puras e geração da música pela seed, com testes (`packages/games`).
2. Tela das 5 pistas, notas descendo e som (sem servidor).
3. Calibração de atraso.
4. Energia, combo, multiplicador e camadas da música.
5. Servidor, ranking, histórico, recordes e Daily.
6. Sala.
7. Fases compostas.

## Decisões em aberto

1. **Energia** (sugestão) ou perder no primeiro erro?
2. **Nome** do modo na lista do Ecooo: "Batida" (provisório), "Ritmo" ou outro?
3. Começar só com **Infinito e Daily**, deixando sala e fases compostas para depois? (sugestão: sim)
4. Janelas de acerto e andamento inicial/final: deixar como palpite e **calibrar jogando** (sugestão: sim).
5. **Notas duplas** entram na primeira versão ou só mais tarde? (sugestão: mais tarde)
