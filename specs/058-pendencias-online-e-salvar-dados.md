# 058: Pendências: online do Counter Fox mais firme e salvar dados universal

Status: rascunho (04/11/2026). **Só levantamento: nada disto foi feito ainda.** Pedido do Lucas para fazermos depois. Ordem do online decidida: 1) medir e corrigir o servidor, 2) protótipo WebRTC (líder simula) e comparar.

## 1. Online do Counter Fox: travadas e tiros pouco confiáveis

O que o Lucas sentiu jogando online:
- o jogo **trava bastante** (movimento "pulando", imagem parando);
- **tiros inconsistentes**: atira com a sniper em cima da raposa e o tiro não pega, coisa que no offline pegaria; atira num lugar e parece que o tiro vai para outro;
- algumas movimentações travadas.

### Hipóteses a medir antes de mexer (não são certezas)
1. **Taxa do quadro do servidor**: hoje o servidor manda o quadro (`fss`) a cada ~48 ms (~20 por segundo) e a sala roda a 60 Hz. Com bots e 10 jogadores o pacote cresce e a interpolação de 100 ms pode ficar curta.
2. **Interpolação e relógio**: o cliente mostra os outros 100 ms no passado e o tiro usa `viewTick`. Se `viewTick` estiver errado por um pouco, o servidor confere o tiro contra um corpo que já saiu de lá. A compensação de atraso volta no máximo 15 ticks (250 ms): com ping alto ou travada do cliente o tiro cai fora da janela e "não pega".
3. **Diferença offline x online**: o offline atira contra o corpo desenhado agora; o online contra o corpo como estava `viewTick` atrás. Precisamos conferir se o corpo da hitbox no servidor (`bodiesAt`) é o mesmo que a raposa desenhada (altura, agachar, offset do passo).
4. **Previsão e correção do próprio corpo**: o erro de previsão desliza a câmera, mas um erro grande (>3 m) "encaixa" de uma vez. Se a sala atrasa passos, a pessoa sente puxões.
5. **Servidor sobrecarregado**: `afterTick` monta o quadro de todo mundo a cada envio; vale medir o tempo de cada tick (a sala pode estar pulando passos, já que o servidor descarta atraso maior que 30 passos).
6. **Rede**: tudo vai por WebSocket (TCP): uma perda de pacote trava tudo (cabeça de fila). Vale ver se compensa mandar menos coisa (quadros só com o que mudou) ou usar um canal sem ordem garantida.
7. **Cliente**: com 165 FPS e GPU fraca a thread principal pode atrasar o envio de entradas (`sendRoomQuiet('fsin')` só a cada 2 passos).

### Opção: usar WebRTC como o Ping Fox! e o Fut Fox (ideia do Lucas, 04/11/2026)

Por que lá não trava: o canal de dados do WebRTC é **sem ordem e sem retransmissão** (uma perda não segura os pacotes seguintes, ao contrário do WebSocket/TCP do Counter Fox) e, no P2P, os dados vão **direto de um jogador ao outro**, sem passar pelo servidor. No Fut Fox e no Ping Fox quem simula é o dispositivo de um dos jogadores (com a sala do servidor de reserva).

Como seria no Counter Fox (**líder simula**, igual ao Fut Fox):
- o navegador do líder roda a `FsNetSim` (a mesma simulação pura de hoje) e os outros jogadores mandam as entradas e recebem os quadros pelo canal WebRTC direto; a sala do servidor continua para lobby, chat e **reserva** (se o WebRTC não conectar, cai no servidor como hoje).
- Ganha: nada de salto ao servidor (menos atraso), sem bloqueio por perda de pacote, e tira carga do servidor.
- Custa: **vantagem do líder** (ping zero para ele) e o líder saindo derruba a partida (no Fut Fox a partida acaba); **trapaça possível** (o líder controla a simulação), o que combina com o que já temos (sala com amigos, nunca entra em ranking, regra 2 do RULES.md); o líder precisa de upload para 9 jogadores (estimativa: ~100 KB/s com 30 quadros por segundo, a confirmar); algumas redes não conectam P2P sem um servidor de retransmissão (TURN), que é custo novo.
- **Não resolve sozinho** o que depende do nosso código: tiro pouco confiável vem também de `viewTick`, interpolação e janela de atraso, que continuam valendo (a compensação de atraso precisa existir no líder).

Recomendação: **fazer a medição e as correções do servidor primeiro** (valem como reserva e mostram quanto da trava é rede e quanto é nosso código) e **depois prototipar o líder-simula**, reaproveitando `lib/bola-p2p.ts` / `bola-link.ts`. Se o protótipo ficar claramente melhor, vira o padrão com o servidor de reserva. **Decisão do Lucas (04/11/2026): seguir essa ordem.** Fase 1: medir e corrigir o servidor. Fase 2: protótipo do líder-simula com WebRTC e comparar com a fase 1 (mesmo teste: ping, perda, tiros da sniper em cima de uma raposa parada e em movimento). Só vira padrão se ficar melhor; o servidor continua como reserva.

### Plano de trabalho proposto
1. **Medir primeiro**: painel de depuração (dev) com ping, jitter, idade do quadro, passos por segundo da sala, tamanho do pacote, erro de previsão e quantos tiros foram "fora da janela de atraso". Gravar uma partida de teste com 2 pessoas e 8 bots.
2. **Tiro**: registrar no servidor, por tiro, o `viewTick` pedido, o usado, e se acertou por corpo/zona; devolver ao atirador um "motivo" (acerto, errou, fora da janela). Testar com o ping simulado (50, 100, 200 ms).
3. **Aumentar a taxa do quadro** (de ~20 para 30 ou 60 por segundo) e reduzir o pacote (números menores, delta por quadro). Reavaliar o atraso da interpolação (talvez 2 quadros, não 100 ms fixos).
4. **Reconciliação mais suave** (limites do encaixe, repetir só as entradas que o servidor não viu).
5. **Teste automático de rede ruim**: servidor real + cliente simulado com perda e atraso (já existe o teste com 2 navegadores; faltam os casos com ruído).
6. **Critério de pronto**: com ping de até 100 ms e 2% de perda, 9 de cada 10 tiros bem mirados com a sniper acertam como no offline; sem puxões de mais de 0,3 m na previsão.

## 2. Salvar dados universal (conta, não aparelho)

### Problema
Hoje muita coisa fica no `localStorage` do navegador. Ao **sair da conta e voltar**, ou **trocar de aparelho**, tudo volta ao padrão. O Lucas quer que fique **em todos os lugares**, ligado à conta.

### Levantamento do que está no aparelho (a confirmar item por item)
- **Counter Fox**: opções (`nocap-fs-settings`: sensibilidade, campo de visão, mira e cor, teclas, qualidade, tamanho do mapa pequeno, FPS) e escolhas da partida (`nocap-fs-match`: minutos e bots).
- **Geral**: tema, som/mudo, dicas já vistas (`GameTips`), apelido de convidado, recordes locais (`records`), chaves do Batida.
- **Aperta!**: o jogo já tem `api-save-store` e `save-store` (verificar o que já vai ao servidor e o que fica só no aparelho).
- Uma lista completa sai de `grep localStorage` no `apps/web/src`.

### Decisão a tomar (item 6 do brief: é do Lucas)
Onde guardar:
- **A. Banco do NoCap (Supabase/Postgres), tabela de preferências por conta** (recomendada): uma linha por conta e por "escopo" (`counterfox`, `geral`, `aperta`...), com um JSON versionado. Já temos conta, ORM (Drizzle) e API (Nest). Vale em qualquer aparelho e sobrevive a sair da conta.
- **B. Serviço externo de configuração**: nada que o banco não faça, só mais uma peça para manter.
- **C. Só `localStorage` + exportar/importar código**: não resolve o pedido.

Convidado (sem conta) continua só no aparelho; ao criar a conta, o que já estava no aparelho sobe para ela.

### Plano de trabalho proposto
1. Inventário final das chaves e escolher o que é **da conta** (opções, mira, teclas, escolhas, dicas vistas, progresso) e o que é **do aparelho** (qualidade gráfica automática, tamanho da tela, volume do aparelho?).
2. **Migration** (aditiva, sem apagar nada) com a tabela `user_prefs (user_id, scope, data jsonb, version, updated_at)`, e endpoints `GET /me/prefs/:scope` e `PUT /me/prefs/:scope` (com versão para evitar um aparelho apagar o outro).
3. **Cliente**: uma camada única de preferências (lê do aparelho na hora, sincroniza com a conta em segundo plano, resolve conflito pelo `updated_at`; offline guarda e envia depois). Os módulos atuais (`fs-settings`, tema, sfx...) passam a usá-la sem mudar a tela.
4. **Primeiro login e troca de aparelho**: se a conta já tem dados, eles valem; se não tem, sobe o que está no aparelho.
5. **Testes**: unidade (mesclar, conflito, versão), API com banco descartável, e e2e (mudar mira num navegador, entrar em outro e ver igual).
6. **Privacidade**: nada de segredo; só preferências e progresso. Respeitar RULES.md (nenhuma senha/token nesses dados).

Pergunta para o Lucas antes de começar: aprovar a opção **A**, e dizer o que deve ser **do aparelho** e não da conta.

## 3. Chat dos jogos do Fox Cap! (estilo CS) e convidar no meio da partida

Pedido do Lucas (04/11/2026), com 3 imagens de referência: onde ele quer o chat (no canto de baixo à esquerda, **em cima da vida e do colete**), o chat do CS **só recebendo** mensagens (fundo transparente, sem o jogador digitar) e o chat do CS **aberto para digitar** (fundo preto).

### Problemas de hoje
- Em **todos os jogos do Fox Cap!**, ao apertar **T** para abrir o chat, o menu do **Esc abre por cima** do chat (estranho: os dois brigam pela tecla/foco).
- Quando alguém manda mensagem, ela **não aparece para todo mundo durante a partida**; precisa abrir o chat.
- O chat fica "em cima" da tela em vez de no canto de baixo à esquerda.
- Na aba **Convidar** aberta no meio da partida, o **Esc não fecha** só ela.

### Como deve ficar
1. **Chat sempre no canto de baixo à esquerda**, acima da vida e do colete (HUD do Counter Fox) e num canto livre nos outros jogos.
2. **Modo "recebendo" (padrão)**: toda mensagem nova, de qualquer pessoa, aparece ali com **fundo translúcido** (sem moldura), fica alguns segundos (cerca de 6 a 8 s) e **some devagar**. Só mostra as últimas linhas (as mais velhas somem primeiro).
3. **O que entra nessa lista** (não só conversa): mensagens, **entrou na sala**, **saiu da sala**, **foi removido**, aviso de sala encerrada, líder trocou, e outras mensagens do sistema, com cor própria (sistema em cinza ou amarelo, conversa na cor do time/raposa, espectador em cinza).
4. **Enter** (e também **T**, que já existe) **abre o chat completo**: fundo escuro, histórico rolável, campo para digitar, botão de enviar. **Enter** envia e volta ao modo "recebendo"; **Esc** fecha só o chat.
5. **Esc nunca abre o menu do jogo enquanto o chat está aberto** (ou o campo de digitar tem o foco): primeiro o Esc fecha o chat; um segundo Esc é que abre o menu. O mouse não deve soltar nem prender de forma estranha ao abrir e fechar.
6. **Convidar no meio da partida**: o **Esc fecha só a janela de Convidar** e volta para o menu do Esc que estava aberto antes do clique em Convidar (não fecha tudo nem solta o jogo).
7. Em **todos os jogos** do Fox Cap! (Counter Fox, Fut Fox, Ping Fox!, Desmorona!, Atravessa!), com o mesmo componente (`GameChat`), sem mudar o servidor (já tem histórico e mensagens de sistema).
8. Respeitar `prefers-reduced-motion` (some sem animação) e só animar `transform`/`opacity` (regra 5 do RULES.md). Sem emoji (regra 6). Tamanho de letra legível (números e textos maiores, como pedido nas outras telas).

### Plano de trabalho proposto
1. Mapear o `GameChat` e quem trata T, Enter e Esc em cada jogo (Counter Fox, Fut Fox, Ping Fox!, Desmorona!, Atravessa!) para achar quem abre o menu por cima.
2. Criar um **gerenciador de foco do chat** (um só lugar decide o que o Esc faz: chat aberto > janela de convidar > menu > abrir menu).
3. Fazer o modo "recebendo" (lista curta com tempo de vida por mensagem) e o modo "aberto" (histórico + campo), com os eventos de sistema (entrou, saiu, removido).
4. Reposicionar para o canto de baixo à esquerda em cada jogo, sem cobrir a vida/colete, o mapa pequeno nem os botões de toque no celular.
5. Testes: unidade (tempo de vida, ordem, Esc em camadas) e e2e (T abre só o chat; Esc fecha só o chat; mensagem da outra janela aparece e some; Convidar fecha com Esc e volta ao menu anterior).

## 4. Sala de amigos do Counter Fox: botão "Outros jogos"

Pedido do Lucas (04/11/2026).

**Hoje:** numa sala de amigos do Fox Cap!, o líder escolhe qualquer jogo (Counter Fox, Fut Fox, Ping Fox!, Atravessa!, Desmorona!) no "Jogo da sala". Mas quando o jogo escolhido é o **Counter Fox**, a sala passa a mostrar o lobby próprio do Counter Fox (abas Sala, Jogadores, Modo, Convidar, Chat) e **não há mais como trocar de jogo**.

**Como deve ficar:**
1. No lobby do Counter Fox, uma opção **"Outros jogos"** (visível para todos, clicável só pelo líder, como o resto das regras).
2. Ao clicar, abre a lista dos outros jogos do Fox Cap! (Fut Fox, Ping Fox!, Atravessa!, Desmorona!), com o nome, a descrição curta e a quantidade de pessoas que cabe (a mesma informação do `GamePicker` de hoje).
3. Ao escolher um jogo (por exemplo, Fut Fox), a sala **muda o menu para o do Fut Fox** (troca de motor, mantém as pessoas, o líder e o chat, como o `pickgame` já faz), e a tela passa a ser a do lobby daquele jogo.
4. Nos lobbies dos outros jogos o **Counter Fox continua na lista** do "Jogo da sala", para voltar quando quiser (já é assim).
5. Só dá para trocar no lobby (não no meio da partida). Se a sala tem mais gente do que o jogo escolhido aceita, mostrar o aviso que o servidor já devolve. **Voltar ao Counter Fox** com alguém **sem conta** na sala continua recusado (o Counter Fox só tem conta): mostrar o motivo.
6. Texto em português, sem emoji, visual do lobby do Counter Fox (fontes e cores `--cfx-*`).

**Plano de trabalho proposto:**
1. No `CounterFoxLobby`, nova aba ou botão "Outros jogos" (lista dos `FOX_GAMES` menos `foxshot`), que manda `pickgame`.
2. Conferir no servidor (`FoxRoom.pickGame`) que a troca a partir do Counter Fox funciona (capacidade, convidados, lobby) e que a tela de Fox Cap! volta ao lobby certo (`Room.tsx` decide pelo `snapshot.game`).
3. Teste e2e com duas janelas: criar sala do Counter Fox, trocar para o Fut Fox, ver o menu mudar nas duas janelas e voltar ao Counter Fox.

## 5. Mapa do menu do Counter Fox: ícones sobrepostos

Pedido do Lucas (04/11/2026), com captura do menu principal.

**Problema:** no desenho do mapa Duna do menu principal, as marcações (Bomba A, Bomba B, Base Contra-Terrorista, Base Terrorista) ficam **uma em cima da outra**: o nome da Base Contra-Terrorista passa por cima do círculo da Bomba A e do B, e o texto da Base Terrorista cobre o chão. O tamanho dos textos e dos círculos é fixo (em pixels) e não acompanha o tamanho do mapa na tela.

**Como deve ficar:**
1. As marcações **se adaptam ao tamanho do mapa** (letras, círculos e traços crescem e diminuem junto), em qualquer tela (computador, tablet, celular deitado).
2. **Nunca uma em cima da outra**: posição calculada com folga, empurrando o texto para o lado livre ou usando a sigla curta (A, B, CT, T) quando não couber; o nome completo só quando houver espaço.
3. Legenda fora do mapa (ou embaixo) com o nome completo de cada marcação e a cor, para o nome nunca precisar cobrir o desenho.
4. O mesmo cuidado no **mapa pequeno** e no **mapa grande (M)** do jogo, que usam as mesmas marcações (`FS_DUST_MARKS`).
5. Teste: captura do menu em 3 tamanhos de tela (grande, médio e celular deitado) e conferir que não há texto sobreposto.

## 6. Partida abre já com o menu do Esc aberto

Pedido do Lucas (04/11/2026).

**Problema:** toda vez que uma partida começa (offline, treino ou online), o jogo abre com o **menu do Esc aparecendo** (tela de "Continuar jogando", Personalizar, Comandos...). O Lucas quer que a pessoa **entre direto na tela do jogo**, e o menu só abra quando ela apertar Esc.

**Por que é assim hoje:** os navegadores só deixam prender o mouse (pointer lock) e entrar em tela cheia depois de um **clique ou tecla da pessoa**. O jogo começa "pausado" com o menu aberto e o botão "Continuar jogando" é o clique que libera isso.

**Como deve ficar:**
1. A partida abre direto na cena do jogo, sem o menu do Esc. A pessoa já veio de um clique (Jogar, Começar, Entrar na sala), então dá para **pedir o mouse preso nesse mesmo clique** quando o navegador permitir.
2. Se o navegador **não** deixar prender o mouse na hora (cliques de sala online, recarregar a página, link direto), mostrar só um aviso leve no meio da tela ("Clique para jogar") e **não o menu inteiro**; o primeiro clique no jogo prende o mouse e some o aviso.
3. Esc abre o menu como hoje (e fecha com Esc de novo). Tela cheia e trava de teclas (Ctrl+W) continuam funcionando, pedidas no primeiro clique.
4. Vale para: partida offline, Mapa de Treino, partida online (inclusive entrar no meio, espectando) e o reinício depois do fim de partida.
5. Contagem inicial do online (5 s) continua aparecendo e a pessoa já pode olhar em volta.
6. Testes: e2e que abre cada tipo de partida e confere que o menu do Esc **não** está visível no começo e que Esc abre o menu.

## 7. Trocar de arma tem que ser instantâneo

Pedido do Lucas (04/11/2026).

**Problema:** ao apertar a tecla para pegar uma arma (primária, secundária, faca ou granada), a arma **demora para aparecer na mão** e, enquanto isso, não dá para fazer nada: por exemplo, pega a faca e aperta inspecionar logo em seguida e **ainda não dá para inspecionar**.

**Por que é assim hoje:** cada arma tem um tempo de saque (`draw` em `weapons.ts`, de 0,5 a 1,1 s) durante o qual o jogo bloqueia atirar, recarregar e inspecionar (`drawT`), e a cena mostra a animação de sacar.

**Como deve ficar:**
1. **A arma aparece na mão na hora** que a tecla é apertada: sem animação longa de sacar (no máximo um brilho curto de 1 a 3 quadros, ou nenhuma).
2. **Inspecionar, recarregar, mirar e atirar funcionam logo depois** da troca (a faca inspeciona na hora; a pistola atira na hora). Vale para todas as armas, a faca e as granadas (pegar granada e já poder segurar para jogar).
3. Tirar o bloqueio por saque do cliente e da simulação do servidor (`FsLoadout.drawT` e `fsNetSim`), para a pessoa e o servidor concordarem. Repetir a troca rápido (1, 2, 3, Q, roda do mouse) não pode travar nem soltar tiro duplicado.
4. Cuidar do que o saque lento evitava: **trocar e atirar no mesmo instante** não vira vantagem injusta (ex.: sniper, que hoje tem 1,1 s de saque): se for preciso, manter só um intervalo mínimo muito curto entre trocas (cerca de 0,1 s) igual para todas as armas.
5. Atualizar os testes de lógica que contam o saque (`gun`/`FsLoadout`) e o e2e que troca de arma, e conferir online que o servidor aceita a troca e o tiro seguintes.

## 8. Outras pendências lembradas

- Atualizar a spec 057, `ARCHITECTURE.md` e `docs/ROADMAP.md` com as últimas mudanças do Counter Fox (radar estilo CS, ícones do kill feed, times só em cor, aliados desligados, menus).
- Conferir na tela o que só foi testado em código: raposas azuis, Bomba B no jogo, ícones do kill feed, aliado com nome e silhueta (desligado hoje), mapa grande no online e menu das salas.
- Teste do Aperta! que falha no pacote de jogos (`src/aperta/sim.test.ts`, trava de duração da spec 040): investigar se é antigo.
- Perguntas antigas em aberto: o efeito da granada de luz deve sumir ao renascer? Licenças dos pacotes 3D (`docs/CREDITS-3D.md`).
- Online: arma no chão e controles de celular (fora da spec 057).
