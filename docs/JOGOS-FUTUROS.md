# Próximos passos e jogos futuros

Atualizado em 07/10/2026. Este arquivo guarda o que vem depois: primeiro o que falta do **Ecooo**, depois os jogos que o Lucas quer fazer (com a ordem que ele definiu), e por fim o que foi descartado e por quê. Nada aqui está implementado; cada jogo novo começa com uma spec em `specs/`.

## Ordem decidida pelo Lucas

1. **Terminar o Ecooo** (salas e calibragem, seção 1).
2. **Tribunal do Absurdo**: o próximo jogo novo, logo depois do Ecooo.
3. **Intervalo**: na fila, sem data. Entra depois do Tribunal.
4. **Ponte** e **Regras Vivas**: em **standby** (guardados, sem previsão).

## 1. Próximos passos do Ecooo

O Ecooo solo está pronto (spec `012-eco.md`). Em ordem:

1. **Salas do Ecooo, Corrida** (Etapa 4 da spec). Todos recebem a mesma sequência no mesmo instante; quem erra ou fica 8 s parado vira plateia; vence quem sobrar. Precisa de: `EcoRoomEngine` no servidor (a seed nunca sai, o servidor manda a sequência rodada a rodada e confere cada toque), `eco` entrando em `RoomGame` e nas regras do lobby (`screens/room/lobby/rules.ts`), telas de jogo e de plateia, e a aba "Jogar com amigos" deixando de mostrar "em breve".
2. **Salas do Ecooo, Siga o Líder** (Etapa 5). Um jogador por rodada cria a sequência dentro de regras que o jogo impõe ("clique 10 vezes", "use pelo menos 3 cores"...); os outros repetem; o líder da rodada muda. Precisa de: catálogo de regras do líder em `packages/games` (gerar, validar e pontuar, com teste de que toda combinação é possível), tela de criação com lista de regras acendendo, e pontuação (seguidor: 10 × passos certos ÷ N; líder: 0,7 × (10 − média dos seguidores)). Na tela, quem cria a sequência se chama **criador**, para não confundir com o líder da sala.
3. **Jogar ao vivo com amigos** (3 contas reais) e **calibrar** o que hoje é palpite:
   - a Velocidade (700 → 170 ms na rodada 20, máximo de 30 passos) e o tempo parado de 8 s;
   - as faixas de nota por passos (`apps/web/src/games/eco/grade.ts`) e as do histórico;
   - o coeficiente 0,7 do líder no Siga o Líder.
4. **Decisões em aberto:** cores finais dos botões 6 a 9 (hoje roxo, ciano, vermelho e grafite); se a Corrida ganha vidas (1 a 3) depois da primeira versão; se o Siga o Líder passa a salvar histórico (hoje não salva, como o Intruso).
5. **Modos novos** (mesmo núcleo, só combinações de regras): Embaralhado (as cores trocam de lugar entre as rodadas), Só som (os botões não acendem), Às cegas (os botões somem na sua vez) e misturas como Reverso + Velocidade.
6. **Limites conhecidos:** o servidor recebe só a lista de toques, não o instante de cada um, então um robô que imite tempos humanos passa (mesmo critério do Já Deu?, brief #6); offline joga sem salvar, como o Já Deu?.

## 2. Jogos que o Lucas quer fazer

Todos pensados para **multiplayer entre amigos**; nenhum impede um modo para jogar sozinho. Cada um entra no hub como jogo novo, com sala própria, seguindo o contrato de jogo e as regras do projeto (o servidor decide, sala nunca vai para o ranking).

### Tribunal do Absurdo (PRÓXIMO, depois do Ecooo)

**Descrição:** o jogo sorteia uma frase absurda ("pinguins deveriam votar") e cada jogador tem 30 segundos para escrever a melhor defesa dela. Depois todos leem as defesas e votam na melhor, sem poder votar em si mesmo. Quem recebe mais votos ganha a rodada. É um jogo de criatividade e humor, feito para rir com os amigos.

- **Solo:** Daily em que o mundo vota a defesa mais criativa do dia.
- **Esforço:** médio. O texto livre precisa de moderação.
- **Perguntas abertas:** como moderar o texto escrito; banco de frases absurdas (quantas, quem revisa); se as defesas aparecem anônimas até o voto; empate; limite de tamanho do texto; se o ranking do Daily existe e como é medido.

### Intervalo (na fila, sem data)

**Descrição:** o jogo faz perguntas de número ("quantos metros tem a Torre Eiffel?"). Em vez de chutar um valor, o jogador dá um **intervalo** em que tem 90% de certeza. Intervalo apertado e certo vale muito; intervalo gigante vale pouco; errar dói. Premia quem sabe o que **não** sabe, o oposto de blefar.

- **Solo:** funciona bem sozinho (Daily com as mesmas perguntas para todos).
- **Esforço:** médio. Precisa de um banco de perguntas com respostas confirmadas; um fato errado é um risco real.
- **Perguntas abertas:** fonte e revisão das respostas; como pontuar (largura do intervalo contra acerto).

### Ponte (STANDBY)

**Descrição:** o jogo dá duas palavras sem relação (por exemplo "Sapato" e "Lua"). Cada jogador monta uma cadeia de até 5 elos ligando as duas ("sapato → passo → astronauta → Lua"). Todos votam no elo mais fraco; cadeia mais forte e mais curta pontua mais.

- **Solo:** Daily com cadeias de outros jogadores para você avaliar.
- **Esforço:** médio. A parte difícil é o texto livre (moderação).
- **Perguntas abertas:** como pontuar sem juiz humano; limite de tempo; lista de pares de palavras.

### Regras Vivas (STANDBY)

**Descrição:** a cada rodada alguém cria uma regra nova que vale para todos ("quem responder com mais de 5 letras perde ponto"). O jogo vai ficando mais absurdo até virar caos. Nunca é igual, porque o grupo constrói o jogo.

- **Esforço:** alto. Regra livre precisa de um jeito de ser verificada (possivelmente por catálogo de regras montáveis em vez de texto livre, para o servidor conseguir conferir).
- **Perguntas abertas:** regra livre ou montada por peças; quem arbitra quando há dúvida.

### O que esses jogos têm em comum (para planejar junto)

Salas com texto livre, votação entre jogadores, banco de conteúdo escrito e moderação. Como o Tribunal do Absurdo é o primeiro, ele deve construir essa base (texto livre na sala, votação, banco de frases, moderação) já pensando em reaproveitar no Intervalo, na Ponte e nas Regras Vivas.

## 3. Jogos solo no estilo Mesmíssima e Já Deu?

O Lucas quer jogos simples, **muito intuitivos**, divertidos e que dê para jogar contra amigos, no mesmo molde da Mesmíssima e do Já Deu? (regra que se entende em segundos, mesma seed para todos, nota por rodada, Daily e ranking). O critério que ele deixou: **um mecanismo só com muitas variações de modo** (escalável), não uma mecânica nova para cada jogo. O Ecooo nasceu assim (Sequência estilo Genius com vários modos).

Já fora da lista, por ele não ter achado escalável: Alvo (matemática), Círculo (desenho), Metade (dividir a área), Quantos? (contar pontos), Onde Fica? (geografia), Ordem (ordenar itens) e Anagrama. Ficam só como referência.

## 4. Outras ideias propostas, sem decisão

Foram sugeridas na conversa e o Lucas não comentou: **Fusível** (segurar para somar pontos sem deixar o fusível secreto estourar), **Confia?** (cooperar ou trair em grupo) e **Coordenadas** (posicionar um item onde o grupo posicionaria). Mais o backlog antigo do `docs/PROJECT-BRIEF.md` (seção 5: Rabisco, Quem é mais provável, Duas verdades e uma mentira, Sintonia, Leilão às cegas, e jogos de percepção) e as ideias sociais citadas no `HANDOFF.md` (Sincro, Blefe de Nota, Sabotador, Telefone Sem Fio, Caça-Cor, Dicionário de Cores).

## 5. Como começar o próximo jogo

1. Terminar as salas do Ecooo (itens 1 a 3 da seção 1), porque elas validam a base de salas com um jogo novo.
2. Detalhar o **Tribunal do Absurdo** (pergunta por pergunta, começando pelas "perguntas abertas" acima) e escrever a spec dele (`/spec`), com critérios de aceite.
3. Só então implementar. Intervalo, Ponte e Regras Vivas voltam à conversa depois, na ordem da seção "Ordem decidida".
