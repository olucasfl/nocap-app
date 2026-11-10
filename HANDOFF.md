# HANDOFF: retomando o NoCap em outro computador

Leia este arquivo primeiro. Ele diz onde o projeto parou e como voltar a trabalhar em 10 minutos.

## Estado atual (atualizado em 07/10/2026)

Tudo está em `main` e publicado (API no Render, web na Vercel, banco no Supabase). O Lucas escreve em português, muitas vezes em caixa alta; responda em português e trabalhe direto na `main` (commit só quando ele pedir; mensagem em inglês, Conventional Commits, com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`).

**Aperta! removido (09/11/2026, spec 076):** todo o código, as telas, os testes e as specs dele saíram; a tabela `aperta_saves` só some do banco quando se aplicar a migration `0011_remove_aperta.sql` (`pnpm db:migrate`), que é destrutiva e espera o "sim" do Lucas.

**Pronto e no ar** (detalhes em `specs/010-daily-rankings-profile.md`, que é atualizada a cada mudança):

- **Cor:** Clássico e Flash (3 rodadas), Rápido (1), Às cegas (5), Sobrevivência (3 vidas, nota mínima de 6 a 9, até 30 rodadas) e Daily (5 rodadas, tela própria com abas).
- **Tempo:** Clássico e Sem estourar (3), Rápido (1), Sequência (5 alvos), Sobrevivência (mesma regra da Cor) e Daily. Alvos de 1 a 18 s com centésimos e espaçados entre si. Nada de cronômetro, número ou som rítmico durante a contagem.
- **Contas obrigatórias para jogar**, histórico com filtros e paginação, perfil com recordes, amigos e perfil de amigo, rankings por jogo, salas (host, pronto, convites, revanche por votação) para Cor e Tempo.
- **App:** PWA com splash animada, offline (continua logado, avisos, pull to refresh), layouts de tablet e desktop, sons por toque real, vidas em corações, animações de nota, aviso de **atualização obrigatória** (tela cheia até tocar em Atualizar).

**Em andamento: o Intruso** (`specs/011-impostor.md`). Variante da Cor só para sala (3 a 12 pessoas, 1 a 3 intrusos): a turma vê a cor, os intrusos recebem só uma dica, todos recriam e votam (intrusos também votam; voto aberto ou anônimo, escolhido no lobby). Com 3 pessoas pode ter até 2 intrusos; sempre sobra pelo menos 1 normal.

- Feito: regras puras e testes em `packages/games/src/impostor`; motor e sala em `apps/api/src/rooms/impostor` (estado por pessoa: a seed nunca sai, a cor só vai para a tripulação, a dica só para o intruso); telas em `apps/web/src/screens/room/ImpostorPlay.tsx` e `Lobby.tsx`; o modo aparece na lista da Cor e leva a "Criar sala".
- **Paleta pronta** (07/10/2026): **313 cores com 5 dicas boas cada** (1565 dicas) em `palette-1..6.ts`, validadas por testes (sem termo técnico, nome combina com a cor, sem contradição) e conferidas visualmente (`docs/reference/paleta-intruso.html`). Limite da sala: 3 a 12 pessoas.
- **Falta:** (1) **testar com 3 contas de verdade** (criar sala, lobby, decorar, recriar, votar, revelar, pódio): nunca foi jogado ao vivo; (2) o Intruso não salva no histórico nem tem estatísticas (decisão da spec, pode virar etapa futura).

**Atenção:** a migration `0004` (trocar @usuário) está gerada e NÃO aplicada; rode `pnpm db:migrate` antes de testar.

**Atravessa!** (`specs/028-atravessa.md`, 14/10/2026): jogo novo estilo Crossy Road em 3D (Three.js), solo e só Infinito, três biomas contínuos. **Substituiu o Sinal Vermelho**, que foi apagado do código (pacote, API, app e salas). Núcleo em `packages/games/src/atravessa`, rota `/atravessa`, API `game: atravessa`. **Polimento (spec 029, 14/10/2026):** tráfego por veículo, trechos balanceados, trem muito rápido, ambulância, sinal, crocodilo, tartarugas, varridas de aviso, faixa do recorde e marcos, 13 modelos de veículo, mortes por causa, som sem nota que sobe. **Falta:** jogar ao vivo no celular e no computador, calibrar escuridão, veículos, toras e varridas, ouvir o som, ver as transições de bioma andando. **Banco:** os dados do Sinal já foram apagados do banco de produção (14/10/2026: 30 partidas e 4 recordes, via `apps/api/scripts/reset-sinal.mjs`).
**Atravessa! online (15/10/2026, specs 030 e 031):** largada sempre na horta (4 linhas de recuo) e **sala online** (`/sala?jogo=atravessa`, botão "Jogar com amigos" no menu do jogo): Infinito (rodadas do líder, sem escuridão, quem morre assiste com setas, soma dos metros) e Checkpoint (mapa 100/250/500/1000 m, timer, renasce no checkpoint). Sem colisão entre jogadores; o servidor espelha cada herói pelos passos com tick. Testes: núcleo (`room.test.ts`), motor (`atravessa-room.engine.test.ts`) e servidor real (`atravessa-room.integration.test.ts`). **Aviso de chegada (27/10/2026):** no Checkpoint online, quando alguém cruza a linha, o servidor manda `fin` ({slot, name, place, ms}) uma vez por pessoa (`drainFinishes` no motor) e todo mundo vê "<NOME> FINALIZOU EM Nº LUGAR" por 5 s ("VOCÊ" para quem chegou); só texto, em dourado, prata e bronze no 1º, 2º e 3º. Visto no navegador em 420x800 com dois jogadores; o evento foi injetado por `window.__emitLive` (só em dev), a chegada real não foi jogada. **Falta:** jogar ao vivo com 2+ aparelhos (a tela da partida só foi vista renderizando, não jogada), calibrar relógio/12 s parado/checkpoints, histórico de sala, e ver o espectar e a corrida no celular.

**Word's** (specs 032 a 035, 19/10/2026): grupo de jogos de palavras. **Feito:** base de palavras ('apps/api/data/words', 1567 respostas revisadas, 8690 aceitas, scripts em 'apps/api/scripts/words'), núcleo do Classic em 'packages/games/src/words' (cores, nota, partida), API 'apps/api/src/words' ('/words/wclassic/daily|runs|runs/:id/moves|finish', resposta só no servidor, Daily 1 por conta por dia, tabela 'word_runs' na migration '0007' **gerada e NÃO aplicada**: rode 'pnpm db:migrate' antes de testar), páginas '/words', '/words/classic' e '/words/classic/jogar' e cartão no Início. Tudo exige conta (como os outros jogos). **Falta:** jogar ao vivo, imagem de compartilhar (hoje só texto), sons, tela do Daily com abas (resumo/ranking/amigos), confirmar 'WORDS_DAILY_EPOCH' ('apps/api/src/words/word-lists.ts') antes do deploy, e os jogos Bee e Connect (conteúdo em lotes).

**Bee Word's** (spec 035, 19/10/2026): regras em 'packages/games/src/words/bee', gerador 'apps/api/scripts/words/gerar-bee.mjs' (rodar de novo recria os favos; os que já estão em 'favos.json' não mudam de lugar), 180 favos em 'apps/api/data/words/bee/favos.json' e a lista de cortes em 'fora-bee.txt', API 'apps/api/src/words/bee.*' ('/words/wbee/daily|runs|runs/:id/moves|finish|hints'), telas '/words/bee' e '/words/bee/jogar'. **Os favos foram revisados só por mim, em 5 rodadas de corte de nomes e estrangeirismos; o Lucas ainda precisa passar o olho em 'bee/revisao.txt' e cortar o que achar estranho em 'fora-bee.txt'.** O Daily 1 é 19/10/2026, as listas do Classic e do Bee recomeçam (embaralhadas no Classic, na mesma ordem no Bee) quando acabam. **Falta:** tela do arquivo, compartilhar, sons de patente, dicas por inicial mais bonitas, jogar ao vivo. **Connect Word's** ainda não começou (conteúdo em lotes).

**Connect Word's** (spec 034): regras em 'packages/games/src/words/connect' (nota, palpite, 'falta uma', solucionador de divisão única), API 'apps/api/src/words/connect._' ('/words/wconnect/daily|runs|runs/:id/moves'), 130 puzzles originais escritos em 'apps/api/data/words/connect/fonte/lote-_.txt' (o script 'scripts/words/montar-connect.mjs' gera 'puzzles.json'; versão legível em 'revisao.md', **aguardando aprovação do Lucas**). Puzzle já jogado não volta (arquivo e Daily recusam com 409) e testes que recusam divisão ambígua, palavra repetida em 14 dias e título que revela palavra. Telas prontas: '/words/connect' e '/words/connect/jogar' (grade 4x4, 5 vidas, 'falta uma', grupos coloridos, compartilhar em texto), integradas ao ranking, histórico e stats. **Falta:** jogar ao vivo, tela do arquivo (a API já tem), imagem de compartilhar e sons próprios.

**Jogar a qualquer hora (19/10/2026):** todo jogo do Word's tem Daily e também jogo livre. Classic: 1, 2 e 4 palavras. Bee e Connect: 'Jogar quando quiser' (API 'kind: free'), que sorteia um favo/puzzle que a conta ainda não jogou, fora dos 30 próximos dias do Daily (para não queimar o futuro), sem ranking; um puzzle jogado não volta. Cobre o histórico como modo 'Livre'.

**Word's reformulado (19/10/2026):** o Classic tem Daily, ranking e partidas salvas no servidor (abas Daily, 1, 2 e 4 palavras; palavras do Daily separadas das dos modos livres; Daily repete embaralhado quando acaba; partida livre aberta continua e a próxima já é sorteada). **Bee (200 fases) e Connect (130 fases) são jogos offline, sem Daily nem ranking**: catálogo do mais fácil ao mais difícil, status por fase (nova, em andamento, concluída) e progresso salvo no aparelho (localStorage). Os dados vêm de 'apps/api/data/words' e são exportados para o app com 'node apps/api/scripts/words/exportar-fases.mjs' (rode de novo ao mexer nos favos/puzzles). Testes de ponta a ponta com Playwright em 'apps/web/e2e' (API simulada): 'pnpm --filter @nocap/web exec playwright test'.

**Mix Nocap removido (20/10/2026):** a rota /nocap, as salas party (API e web), o pacote de regras e os textos saíram do código. Sobras no banco: `node apps/api/scripts/apagar-mix-nocap.mjs` mostra o que há; `--apply` apaga.

**Eco** (`specs/012-eco.md`): repetir sequências de botões (estilo Genius). **Solo pronto** (Clássico, Escalada, Velocidade, Reverso e Daily, com ranking, recordes, histórico e perfil; 310 testes passando). **Salas Corrida e Siga o Líder prontas (faltam jogar ao vivo e calibrar o 0,7 do líder e as faixas de nota)**. São duas salas separadas (`eco` e `ecoleader`), escolhidas ao criar a sala; o spec previa escolher o formato no lobby.

**Nomes na tela:** Cor = **Mesmíssima** (o 10 mostra "mesmíssima" no lugar de "cravou"), Tempo = **Já Deu?**, Eco = **Ecooo**. Ids, rotas e código não mudaram (`color`, `time`, `eco`).

**Presença na sala e convites** (`specs/017-presenca-sala.md`, 10/10/2026): sair da sala agora vale no servidor (`POST /me/room/leave`, mesmo com a conexão caída), `GET /me/room` diz em que sala a conta está, o início tem o aviso "Você está na sala ... Voltar / Sair", criar sala é um toque só, estar em outra sala abre um diálogo (voltar ou sair), convites viram fila de um aviso por vez e o botão Convidar volta a funcionar. Teste com servidor Colyseus real em `apps/api/src/rooms/presence.integration.test.ts` (roda em threads: `vitest.config.ts`). Armadilha: nunca pôr `leave` no logo da sala; o logo só vai ao Início.

**Eco Hero** (`specs/019-eco-batida.md`, 10/10/2026): modo de ritmo dentro do Ecooo, estilo Guitar Hero, com **3 músicas** (Primeiro Passo, Maré Alta, Frenesi), pista em perspectiva, energia, multiplicador, pausa com 3-2-1 e teclas configuráveis (padrão 1 a 5). Núcleo puro em `packages/games/src/eco/rhythm.ts` (a música sai da seed; `BatidaSim` é usado pelo jogo e pelo servidor, então a conta é uma só); som em `apps/web/src/lib/batida-audio.ts` (tudo sintetizado, relógio do áudio); tela em `apps/web/src/games/eco/BatidaPlay.tsx`. Servidor: `scoreBatidaMatch` refaz a partida pelos instantes dos toques; cada música é um modo (`batida-passo`, `batida-mare`, `batida-frenesi`) e um quadro do ranking. A nota é guardada em décimos de ponto (teto 3276 pontos, campo de 16 bits). Depois da segunda rodada de pedidos: **acordes de 2 e 3 notas**, **notas longas de segurar**, **moldes translúcidos** no lugar da linha e dos botões, e andamento **sem teto** (o fácil só demora mais). **Falta:** jogar ao vivo e calibrar (janelas 50/120 ms, andamentos, energia, chances de acorde e nota longa); a tela dos moldes e das barras de segurar **nunca foi vista rodando** (o navegador de teste estava escondido), então ela precisa de uma olhada humana; Daily, sala, e salvar offline (hoje offline joga só como treino). Armadilha: o navegador de teste não anima com a janela minimizada (2 quadros por segundo), então teste em tempo real só com a janela à vista.

**Lobby novo da sala** (`specs/013-lobby-sala.md`): uma tela para o líder e outra para os membros, com abas Membros, Regras e Convidar; só o líder altera as regras (o membro só lê). Falta jogar ao vivo com contas reais.

**Banco:** os dados de jogos foram zerados em 07/10/2026 (partidas, pontos e recordes); a conta do Lucas foi mantida. Schema e migrations intactos.

**Pedidos pendentes de 07/10 (só escritos, nada implementado):** chat nas salas (spec 014), aba Convidar nova no lobby (spec 013), rever os modos Sequência e Sem estourar do Já Deu? (spec 002, com perguntas ao Lucas) e histórico de sala mostrando quem jogou e como ficou (spec 003). Lista em `docs/ROADMAP.md`, Etapa 5c.

**Próximos passos e jogos futuros:** tudo em `docs/JOGOS-FUTUROS.md`. Ordem do Lucas: terminar o Ecooo (salas Corrida e Siga o Líder, calibrar), depois **Tribunal do Absurdo**, depois Intervalo; **Ponte e Regras Vivas em standby**. O arquivo descreve cada jogo. Ideias mais antigas (Sincro, Blefe de Nota, Sabotador, Telefone Sem Fio, Caça-Cor, Dicionário de Cores; Tom, Eco de Ritmo, Sombra) seguem no brief e sem spec.

**Atualização de 08/10/2026** (validação geral e pedidos novos; detalhes nas specs 011 a 015):

- Intruso (011), Ecooo (012: Corrida e Siga o Líder), lobby líder/membro (013), chat (014) e **aba Ranking própria** (015) estão implementados. A paleta do Intruso tem 313 cores com 5 dicas cada.
- **Siga o Líder reformulado:** sem tela de resultado entre rodadas; aparece "O LÍDER É @fulano" e o próximo cria; a soma de acertos só aparece no pódio; regras do líder em lista de tarefas com progresso; na Escalada e no Siga o Líder os botões ficam em posição fixa (grade 3x3 com lugares vazios tracejados).
- **Ranking:** página `/ranking` (jogo, modo incluindo Daily, período, todos/amigos, minha posição fixa, "faltam X para passar @fulano"). Saiu a aba Ranking de dentro dos jogos; o Daily mantém o ranking só dele na tela do Daily.
- **Perfil:** os recordes agora são um jogo por vez, com um bloco por modo (toque para ver média e partidas).
- **Bugs achados na validação (corrigidos):** a tela de resultado do Já Deu? cobria o botão "Próxima" quando a nota era zero (classe `g-zero` aplicada na tela inteira); o botão "Siga o Líder" e os modos do Ecooo estouravam a tela no celular; selo "NA SALA" cortado; linhas do resultado do Ecooo cortadas; título do voto estourando; um teste do Eco só passava no dia em que foi escrito (data fixa).
- **Ainda não validado ao vivo:** nenhuma sala foi jogada com contas reais (as telas foram conferidas injetando estados falsos no app em 375, 820 e 1280 px). Falta jogar Intruso, Ecooo, chat e convites por @ com 3 contas; e jogar o Ranking com dados reais.
- Cuidado com CSS: `ranking.css` (legado, carregado por `RankingList`) usa as classes `.rk-*`; a página nova usa `.rks-*`. Não reutilize `.rk-`.

## Armadilhas conhecidas (poupam tempo)

- Nesta máquina (Windows) o `pnpm` não estava no PATH do bash e o Turbo não o achava: rode `npx tsc --noEmit` e `npx vitest run` dentro de cada pacote (`packages/games`, `apps/api`, `apps/web`). **Depois de mudar `packages/games`, rode `npx tsup src/index.ts --format esm,cjs --dts --clean` lá**, senão api e web não veem o código novo.
- Arquivos do repo têm CRLF: edições por script devem normalizar `
`. Heredocs longos no bash do Windows falharam; use a ferramenta de escrita de arquivos.
- O Vite pode guardar uma versão vazia de um arquivo que foi regravado: se a tela ficar em branco com "does not provide an export", mexa no arquivo (ou reinicie o `vite`).
- A API real tentava conectar no Supabase (às vezes dá ETIMEDOUT). Para testar telas sem banco, havia um servidor falso na porta 3333; mate a API real antes.
- `requestAnimationFrame` para quando a aba está oculta: as telas de resultado têm timeout de segurança por causa disso.

## Ritual de setup no computador novo

```bash
git clone https://github.com/olucasfl/nocap-app.git && cd nocap-app
nvm use                      # Node 22 (mínimo 20.19)
corepack enable && pnpm install
cp .env.example .env         # depois preencha a senha do Supabase (ver abaixo)
pnpm build && pnpm test      # deve passar sem banco
pnpm dev                     # web em :5173, api em :3333 (GET /health)
```

O `.env` **não vai para o git**. Leve a senha do Supabase por um gerenciador de senhas, nunca por chat.

## Antes de tudo (pendências de segurança)

- [ ] **Trocar a senha do banco no Supabase** e o `BETTER_AUTH_SECRET` (apareceram em capturas de tela) e colocar os novos só no `.env` e nas variáveis do Render.
- [ ] Confirmar que o repositório no GitHub está privado.

## Onde está cada contexto

| Preciso de...                                          | Arquivo                               |
| ------------------------------------------------------ | ------------------------------------- |
| Visão, decisões tomadas e em aberto, regras, roadmap   | `docs/PROJECT-BRIEF.md`               |
| Passo a passo até o projeto ficar pronto               | `docs/ROADMAP.md`                     |
| Design (Pop Brutal), como abrir as telas de referência | `docs/DESIGN.md`                      |
| Telas e protótipo de referência (HTML)                 | `docs/reference/*.html`               |
| Prompt original da Etapa 1                             | `docs/prompts/etapa-1.md`             |
| Arquitetura técnica                                    | `ARCHITECTURE.md`                     |
| Regras para agentes                                    | `CLAUDE.md`, `.claude/rules/RULES.md` |
| Specs de cada feature                                  | `specs/` (índice em `specs/INDEX.md`) |

## Como ver o design no outro PC

Rode `pnpm dev` e abra http://localhost:5173 (o app já tem Hub e o jogo da Cor), ou abra `docs/reference/prototipo-cor.html` com duplo clique (jogo autônomo, fonte da verdade de fluxo, animação e sons). As `design-*.html` precisam de um `support.js` que não está na pasta e não renderizam sozinhas; servem só como referência de layout.
Detalhes em `docs/DESIGN.md`.

## Como retomar com o Claude Code

Abra a pasta do repo no Claude Code e diga: _"Leia HANDOFF.md, CLAUDE.md e docs/ROADMAP.md e continue do
próximo passo pendente."_ Os comandos `/new-game`, `/spec`, `/ship` e `/status` estão em `.claude/commands/`.

## Decisões em aberto que mais travam

Ver `docs/PROJECT-BRIEF.md` seção 6. As três que importam primeiro: presencial vs remoto (#1), auth (#2) e
curva da nota do Tempo (#4). Não decida sozinho: pergunte ao Lucas.

## Nota técnica

Esta máquina tinha Node 20.19; o projeto recomenda Node 22 (`.nvmrc`). Funciona nos dois.

## Estado da automação

- **Etapa 18 (tela da árvore em grafo):** concluída em 23/10/2026, commits `94aa08a` e `5872bc8`. Sem testar: 320, 768, 1024, 1280 e 1920 px, aparelho real e pinça (não feita). **Próxima: etapa 19** (habilidades ativas e automações), depois a 21.
- **Spec 041 (polimento e economia v3):** concluída em 23/10/2026 (commits na `develop`). Interface (selo de conquistas, filtro, meta do colapso em barra, carta NVL, abas Comprar e Comprados, ícones, taxas reais, Dourada) e economia (geradores 0/8 um por vez, grimório mais fácil, itens mais fortes, metas calibradas, save v5). `sim.test.ts` 17/17, e2e 36/36. **Para o Lucas:** jogar 1 a 2 dias para sentir o ritmo (1 mi em ~14 min no simulador, 1º colapso em ~1,2 h).

## Desmorona! (spec 044), Fase 1

Motor em `packages/games/src/desmorona` (mundo determinístico, bots, 11 testes); web em `apps/web/src/games/desmorona` (cena three, controles WASD/joystick, treino contra bots) e área Fox Cap! em `/fox-cap` (Atravessa! + Desmorona!). Fase 2 (salas online, 2 a 8): `apps/api/src/rooms/desmorona-room.engine.ts` + `DesmoronaRoom` em `color.room.ts`; cada aparelho simula a própria raposa, a sala decide quem pisou primeiro em cada ladrilho (`dstep`), quem caiu (`ddead`) e o fim; posições em `dpos`/`pos` (10 Hz); relógio do jogo = relógio da sala. Web: `DesmoronaRoomPlay` reaproveita `DesmoronaPlay` com `online`. Sem ranking/histórico. Fase 3 (colisão e empurrão) feita: ver spec 044 §7. Falta só: modos extras e itens, se o Lucas quiser.

## Fut Fox (spec 046)

Fase 1 (motor) pronta em `packages/games/src/bola` (36 testes). Próximo: Fase 2, sala online (`BolaRoomEngine` sobre `ColorRoomEngine`, 15 pessoas, times/espectador, tick de 30 Hz). Física própria, sem biblioteca. Sem ranking.

MVP offline do Fut Fox (26/10/2026): `pnpm dev` e abra `http://localhost:5173/fox-cap` (Fox Cap! > Fut Fox > Treino; `/fox-cap/bola`, `/fox-cap/desmorona` e `/atravessa` sem `?treino=1` redirecionam para `/fox-cap`). Web em `apps/web/src/games/bola` (`BolaScene` three, `BolaPlay` roda o `BolWorld` no aparelho, `BolaPage` menu). Você é o time vermelho, o resto são bots; F prende ou solta a câmera (na bola/livre); espectador troca com Q e E. Falta: sala online (Fase 2), lobby de times, som, mortal mais visível.

Fut Fox Fase 2 (sala online) pronta em 26/10/2026: `apps/api/src/rooms/bola-room.engine.ts` + `BolaRoom` em `color.room.ts` (registrada como `bola` no `main.ts`), 18 testes do motor da sala e 1 de integração com Colyseus. Próximo: web online (cena lendo `bs`, previsão da própria raposa, lobby de times, espectador).

Fut Fox web online pronta em 26/10/2026: criar sala em Fox Cap! > Fut Fox > Com amigos (`/sala?jogo=bola`). Testado com 2 navegadores contra a sala real. Em dev o web lê `@nocap/games` do código-fonte (alias no `vite.config.ts`). Falta: som, previsão do pulo/mortal, teste em celular real.

Fut Fox fluidez online (26/10/2026): mortal com impulso 6,4 (`Math.max` com a velocidade atual) e efeito `jumpFx`; online, os outros e a bola são interpolados ~70 ms atrás entre estados do servidor (`t`), a própria raposa usa `BolPredictor` (`packages/games/src/bola/body.ts`) com correção suave, pulo enviado com a direção do quadro e entrada a cada 25 ms. Falta: teste com 3+ jogadores online e em celular real.

**Fut Fox online ponto a ponto (26/10/2026, spec 048):** o online travava mesmo com internet boa porque o servidor (Render grátis, EUA/Europa, CPU pequena) simulava a 60 Hz. Agora, ao apertar Começar, os aparelhos tentam conectar por **WebRTC** ao do líder (`apps/web/src/lib/bola-p2p.ts`: `BolaHostSession` e `BolaPeerSession`; canais `game` sem garantia e `ctl` com garantia; sinalização `rtc` pelo Colyseus; STUN do Google, sem TURN). Se todos conectarem, **o líder simula** (`BolaMatch`, `packages/games/src/bola/match.ts`, a mesma classe do servidor) e manda os quadros a 30 Hz; se alguém falhar em 7 s, **o servidor simula** como antes (reserva). O cliente é um só: `BolaLink` (`lib/bola-link.ts`) é a fonte do fluxo (servidor, líder remoto ou canal local do líder). A sala (`BolaRoomEngine`) tem `net: 'server'|'pending'|'p2p'`, `p2pReport`, `p2pResult` (`bres`) e `p2pEnabled` (ligado em `BolaRoom`; os testes do motor ficam no modo servidor). Testado com dois navegadores reais: P2P (0 mensagens do servidor durante a partida) e reserva (convidado sem WebRTC). Limites: trocar de time no meio só no modo servidor; se o líder sair no meio, a partida termina; aba do líder precisa ficar aberta (o relógio da partida roda num Worker). **Falta:** testar em PCs/celulares reais em João Pessoa (NAT de operadora pode cair na reserva), e um painel de rede na partida (ping, estados por segundo).

**Fox Cap! com modos offline e sala de jogos trocáveis (26/10/2026, spec 049):** `/fox-cap` tem as abas **Offline** (Atravessa! Infinito, Desmorona! Treino, Fut Fox Treino, cada um abre direto por `?treino=1`) e **Com amigos** (cria a sala `foxcap` sem jogo). No servidor, `FoxRoom` (`color.room.ts`) + `FoxLobbyEngine` (`fox-lobby.engine.ts`): o líder manda `pickgame` e a sala troca o motor por `adoptFrom`; mensagens de cada jogo valem só no motor atual (despachante por jogo). No cliente, `GamePicker` aparece na aba Regras de toda sala com `snapshot.flex`; `FoxLobby` é o lobby sem jogo. **Falta:** jogar com amigos de verdade e ver se alguma regra de lobby precisa de ajuste fino por jogo.

**Fox Cap! hub e ponto a ponto, ajustes (26/10/2026):** o hub roda o fluxo ali mesmo (cartão com **Jogar** e **Como jogar?**; o Fut Fox e o Desmorona! abrem a escolha como popup e a partida no próprio `/fox-cap`; o Atravessa! vai a `/atravessa?treino=1`, que já começa, e sair volta ao hub); a aba Com amigos tem **Criar sala** e **Entrar com código** na própria tela (`useRoomEntry`). `BolaPicker` e `DesmoronaPicker` são usados nas páginas dos jogos e no hub. A partida do líder agora roda num **Worker** (`apps/web/src/lib/bola-host.worker.ts`, emite quadro só quando a partida andou, repete eventos 600 ms); o atraso de desenho dos outros é **adaptativo** (`BolaLink.minDelay`: 25 ms no líder, 45 ms ponto a ponto, 100 ms pelo servidor; sobe com o intervalo medido entre quadros e desce devagar); o ping do ponto a ponto é o menor dos últimos 6. Ao escolher o Fut Fox numa sala do Fox Cap!, as pessoas já entram nos times (`BolaRoomEngine.adoptFrom`). Pedido do Lucas que motivou isso: o painel de rede mostrou ping de 162 ms e atraso preso em 100 ms numa rede local.

**Atualizar antes de entrar na sala (26/10/2026):** o build grava o commit em `/version.json` (plugin `nocap-version` em `vite.config.ts`) e o app tem o mesmo commit em `BUILD_ID` (`lib/build-id.ts`). `useRoomEntry.run` chama `appOutdated()` (`lib/app-version.ts`) antes de criar ou entrar em qualquer sala; se a versão do ar é outra, abre o aviso global `UpdateBeforeEnter` ("Atualize antes de entrar", botão Atualizar), que guarda a tentativa em `sessionStorage`, desregistra o service worker, limpa o cache e recarrega; ao voltar, a entrada continua (link `/sala/ABCD` entra sozinho; criar sala retoma em `FoxCapPage` e na entrada `/sala`, que pedem `useRoomEntry({ resume: true })`). Sem rede ou sem `version.json` (desenvolvimento) não bloqueia. Motivo: amigo abria o link com versão velha em cache e "não entrava".

**Fut Fox liso, arena e física (27/10/2026, spec 052; tudo só na `develop`, o Lucas só manda para a `main` quando finalizar):** a bola teletransportava online mesmo com 1 ms. Causas: o carimbo do quadro era a hora do envio (agora é a hora do passo) e a bola local batia em raposas desenhadas atrasadas. Agora há **previsão com rollback no estilo do rl-like** (`apps/web/src/lib/bola-rollback.ts`; entrada carimbada por passo aplicada pelo líder no passo certo; cliente à frente com relógio ajustado; erro visual que some em ~0,1 s; simulação de rede em `bola-rollback.sim.test.ts`). **Arena** com cantos em arcos e rampa de 2,2 m entre chão e paredes (`field.ts`, `BolWorld.rampBall`, `floorAt`). **Física**: bola 20 m/s no máximo, quique 0,6, chute proporcional à velocidade da raposa, equilíbrio da bola na cabeça (atrito + calota achatada). Marca no chão sob a bola e velocidade no gol ("Bola a N km/h"). Faltam: ajuste fino jogando com amigos (ping de verdade), mais visual (estádio, luzes), teste em aparelhos reais. Acompanhamento: https://claude.ai/artifact/Q4JkqT3jKuLGw5CiYJ5ZdJ

**Fut Fox: corrida, atrito e curva do teto (27/10/2026, spec 053; só na `develop`):** Shift (ou botão no celular) corre a 11,5 m/s com fôlego de 0 a 100 (gasta em 2,8 s, congela 2 s, recarrega devagar, esgotou só volta com 20); a barra só aparece quando não está cheia e tentar correr sem fôlego treme e toca um som. A bola agora tem atrito na parede e freio na rampa, e o teto curva até a parede como o chão. **Falta:** ver a curva e a barra na tela, jogar com amigos e ajustar os números (`constants.ts`); os bots já correm e sobem na parede atrás de bola alta (ver spec 053 §2c); Desmorona! mostra os comandos só na primeira partida (§2d), tem câmera como a solta do Fut Fox (§2e), bots que poupam chão (§2f) e **ondas de queda com aviso** (§2h: 5 formatos, aviso de 3,4 s a 2,2 s, barra e sons). Câmera na bola do Fut Fox agora é a solta com giro guiado pela bola (§2g).

**Telas de fim do Atravessa! e do Desmorona! (28/10/2026, spec 054):** peças compartilhadas em `apps/web/src/components/final` (`FinalShell`, `RematchPanel`, `TrainingActions`, `useCountUp`, `math.ts` com teste). Desmorona!: `DesmoronaFinal` (pódio, classificação com quanto cada um durou, duração e quem caiu primeiro; botões fixos no rodapé, o resto rola) no treino dentro do `DesmoronaPlay` e na sala em `DesmoronaRoomFinal`. Atravessa!: `AtravessaSoloFinal` (offline Infinito: linhas, recorde, tempo, ritmo) em `AtravessaGame` e `AtravessaRoomFinal` + `AtravessaRoomFinalPage` (sala, Infinito e Checkpoint). `Room.tsx` renderiza as duas em tela cheia na fase `final`. E2E `telas-de-fim.spec.ts` joga até o fim e confere 4 tamanhos de tela. **Falta:** ver a tela da sala com 2 navegadores (só tipada e montada a partir do snapshot) e em aparelho real.

**Ping Fox! (01/11/2026, spec 055):** pingue-pongue 1x1 em 3D no Fox Cap! (aba Offline, "Ping Fox! Treino"). Motor puro em `packages/games/src/pingpong` (física determinística a 240 Hz, batida com efeito, ajuda de mira, regras, bots); web em `apps/web/src/games/pingpong` (`PingScene`, `PingPlay`, `PingFinal`, `PingPicker`). **Sala online 1x1 pronta (fase 3):** `PingRoomEngine`/`PingRoom` na API e `PingRoomPlay`/`PingRoomFinal` no web; só os eventos de batida e saque viajam (`PpNetSim`, volta no tempo quando chega atrasado). Para testar com 2 janelas: `apps/api/scripts/rooms-only.ts` + `e2e/ping-online.spec.ts` (instruções no topo do arquivo). **Falta:** jogar de verdade com amigos e no celular real para afinar velocidade e ajuda de mira; caminho direto por WebRTC fica para depois.

**Menu e pausa nos 4 jogos da sala (03/11/2026, spec 055 rodada 52):** menu Esc padronizado (`GameMenu`: Pausar e Encerrar a partida só para o líder, Sair e Encerrar a sala por último, vermelho) e pausa do líder com contagem de 3 s (`PauseOverlay`, `pause`/`resume`, relógio do jogo = hora da sala menos o total pausado). Também: chat da sala igual ao da partida (`RoomChatDock`), teclado do Word Classic que revela a cor letra a letra junto da virada, telas finais novas do Block Classic e do Block Tower (`BlocksFinals.tsx`) e a ficha dos modos em duas colunas no celular deitado (`mode-sheet.css`). **Falta testar com gente de verdade:** a pausa no Fut Fox com P2P (líder simula no worker) e em celulares.

**Ping Fox!, batida refeita (02/11/2026, spec 055 seção 3):** a raquete bate na bola de verdade. Sem anel de alvo, sem ajuda de mira, sem botão de smash. A mão (mouse ou dedo relativo) leva a raquete como uma mola; quanto mais rápido ela se mexe, mais ela **avança** (alcance até 0,7 m) e mais forte bate. O contato é por varredura (o plano da raquete e a bola se movem), a face inclina pelo movimento (subir abre = lob, descer fecha = desce) e a borracha dá o efeito pelo atrito. Saque: clique lança a bola na frente da raquete e você bate nela. Bots escolhem a batida (velocidade da mão) e a executam pelo `swing` do `PpInput`. Para ajustar a sensação: constantes de `packages/games/src/pingpong/constants.ts` (arrasto, tilt, `PP_PAD_COUPLE`, alcance) e a faixa de acerto nos testes de `pingpong.test.ts`.

**Fox GP (10/11/2026, spec 078, branch `feat/fox-gp`, não está na `main`):** corrida de F1 das raposas no Fox Cap! (aba Offline, "Fox GP Treino"; e na sala trocável). Uma pista (Circuito da Toca), classificação de 1 volta, grid, semáforo, 3 voltas, turbo da cauda pelo vácuo, pneus e box, regra dos 30 s, pódio. Sem ranking. Testes: motor (`foxgp.test.ts`), sala (`foxgp-room.engine.test.ts`, `foxgp-room.integration.test.ts`), web (`format.test.ts`, `e2e/foxgp.spec.ts`, `e2e/foxgp-online.spec.ts` com E2E_ROOMS=1). **Falta:** calibrar os números [AJUSTAR] em `packages/games/src/foxgp/constants.ts` (o box hoje custa ~7 s e o pneu gasto só ~1 a 2 s por volta para os bots), jogar com 2+ aparelhos e no celular real.

**Fox GP, atualização (10/11/2026, spec 079, branch `feat/fox-gp`):** feito tudo do documento de atualização (detalhes na spec). **Pendente:** o teste `e2e/foxgp-online.spec.ts` (duas janelas) parou na troca para o Fox GP na sala: investigar (servidor de teste antigo na porta 3340 ou erro na troca) e rodar até o fim. Também jogar com aparelhos reais e calibrar os [AJUSTAR].

## Conexão das salas (01/11/2026)

- Bug "RECONECTANDO À SALA..." travado: depois de uma queda a referência da conexão morta continuava em `room` e a reconexão achava que já estava conectada (nunca tentava). Agora `onLeave` zera `room` antes de reconectar; só uma reconexão por vez; tentativas logo de cara, pausas crescentes, acordadas ao voltar para o app/internet; sala que não existe mais encerra rápido com aviso.
- Conexão meio morta (troca de rede, aparelho dormiu): ping de conferência ao voltar para a aba/internet e a cada 10 s; sem resposta em 4 s a conexão é fechada e a reconexão assume.
- Bug "sair e voltar sozinho": em `/sala/ABCD` a entrada automática pelo link disparava de novo ao sair. Agora só roda uma vez e nunca depois de a pessoa ter estado na sala. O aviso "Você está na sala" some na hora e só pergunta ao servidor depois da saída confirmada (`setOnRoomGone`).
- Servidor: ping 5 s × 4 falhas (era 3 s × 2), espera de reconexão no lobby/pódio 45 s (era 25).
- Teste: `apps/web/e2e/salas-conexao.spec.ts` (E2E_ROOMS=1): 3 quedas seguidas voltam sozinhas; sair não puxa de volta.

**Encerrar e sair da sala (todos os jogos online):** "Encerrar a sala" (só o líder; no lobby, no menu Esc da partida e no fim) manda `closed` a todos e apaga a sala (`ColorRoom` `close`); "Sair da sala" tira só quem saiu e a sala manda `notice` + mensagem de sistema no chat ("Fulano saiu da sala."), mostrada num aviso rápido em qualquer tela da sala (`RoomToast`). Voltar só por convite ou código; trocar de aba reconecta sozinho. Testes: `fox-room.integration.test.ts` (4 jogos x encerrar e sair).

**Sala encerrada sem carregando eterno (spec 055, rodada 41):** a tela "Entrando na sala" ligava sempre que havia código no endereço e a entrada automática "ainda não tinha sido tentada"; quem criou ou entrou pelo código nunca a tentou, então ao encerrar a sala o carregando não saía mais. Agora só vale para quem chegou pelo link e nunca esteve numa sala (`autoJoined`). O servidor também manda o código de saída 4003 ("encerrada") junto do aviso `closed` e cancela quem esperava reconectar. E2E em `ping-online.spec.ts` ("encerrar a sala"): falha sem a correção.
