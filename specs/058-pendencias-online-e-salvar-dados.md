# 058: Pendências: online do Counter Fox mais firme e salvar dados universal

Status: rascunho (04/11/2026). **Só levantamento: nada disto foi feito ainda.** Pedido do Lucas para fazermos depois.

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

Recomendação: **fazer a medição e as correções do servidor primeiro** (valem como reserva e mostram quanto da trava é rede e quanto é nosso código) e **depois prototipar o líder-simula**, reaproveitando `lib/bola-p2p.ts` / `bola-link.ts`. Se o protótipo ficar claramente melhor, vira o padrão com o servidor de reserva. Decisão do Lucas: aprovar essa ordem ou ir direto para o WebRTC.

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

## 3. Outras pendências lembradas

- Atualizar a spec 057, `ARCHITECTURE.md` e `docs/ROADMAP.md` com as últimas mudanças do Counter Fox (radar estilo CS, ícones do kill feed, times só em cor, aliados desligados, menus).
- Conferir na tela o que só foi testado em código: raposas azuis, Bomba B no jogo, ícones do kill feed, aliado com nome e silhueta (desligado hoje), mapa grande no online e menu das salas.
- Teste do Aperta! que falha no pacote de jogos (`src/aperta/sim.test.ts`, trava de duração da spec 040): investigar se é antigo.
- Perguntas antigas em aberto: o efeito da granada de luz deve sumir ao renascer? Licenças dos pacotes 3D (`docs/CREDITS-3D.md`).
- Online: arma no chão e controles de celular (fora da spec 057).
