# NoCap: briefing completo do projeto

> Cole este documento no agente de código como contexto do projeto inteiro. Ele junta tudo o que foi planejado: visão, decisões tomadas, decisões em aberto, regras, arquitetura, roadmap e pendências.
> Também deve ser salvo no repositório como `docs/PROJECT-BRIEF.md` e mantido atualizado. `ARCHITECTURE.md`, `CLAUDE.md` e `specs/` derivam dele.

---

## 1. Visão

**NoCap** é um hub de jogos para **jogar com amigos**. Roda no navegador, no PC e no celular, e principalmente como **PWA instalável**.

- Não é só jogo de precisão e não é só jogo curto. No futuro entram jogos de impostor, blefe, desenho etc.
- **Cada jogo é independente.** Você entra na Cor, cria uma sala da Cor, joga e encerra. Para jogar Tempo, abre o Tempo. Salas, regras e rankings não se misturam entre jogos.
- Cada jogo tem **solo** (quando faz sentido), **multiplayer com sala personalizável** e, quando fizer sentido, **Daily** e **ranking**.
- Prioridades: rápido, leve, animações próprias, sons próprios e design próprio.
- Inspiração inicial: dialedgg.com, apenas como referência de conceito. Não copiar visual nem jogos que o usuário não aprovou.

**Lançamento inicial: só dois jogos, Cor e Tempo.**

---

## 2. Decisões tomadas ✅

### Produto

- Nome: **NoCap** (wordmark no app: "no cap!").
- Navegação: 4 abas, **Jogos · Histórico · Amigos · Perfil**.
- Jogos independentes, com salas presas a um jogo. Sem "placar da noite" entre jogos.
- Login e conta ficam para depois da Etapa 1. Até lá, o jogador é um **convidado** com UUID salvo no aparelho (`guestId`), que depois vira conta.

### Design

- Direção escolhida: **Pop Brutal**.
  - Tokens:
    - `--paper #F4F4EF`, `--ink #111111`, `--orange #FF6A2B` (accent), `--blue #2F5BFF` (accent 2), `--yellow #FFD23F` (selos e destaques), `--white #FFFFFF`.
    - Bordas de **2.5px** em `--ink`, raio de 12–20px.
    - **Sombras duras sem blur** (`5px 5px 0 var(--ink)`).
  - Fontes: **Archivo** (900/700/500, com uso de itálico 900 no logo) para display/UI e **Space Mono** para números e rótulos.
  - Ícones em SVG inline de traço. **Nunca emoji.**
- Física das animações (fazem parte do design, não são enfeite):
  - **Botão:** afunda na própria sombra ao tocar, com quique curto na volta.
  - **Cor:** entra virando como carta (rotateY).
  - **Nota:** conta de 0 até o valor com tiques e depois cai um **carimbo** amarelo com overshoot e tremor da tela.
  - **Swatches do resultado:** entram pelos lados, levemente rotacionados.
  - **Listas:** entram em sequência com stagger de 40–50ms.
  - **Desempenho:** só `transform`/`opacity`, respeitando `prefers-reduced-motion`.
- Sons gerados por código (**Web Audio API**, zero arquivos de áudio): `clack` (botão), `flip` (cor aparece), `vanish` (cor some), `slide` (tique do slider), `tick(n)` (contagem subindo de tom), `thunk` (carimbo), `win` (nota ≥ 9.5), `boing` (nota < 5).
  - Botão de mudo com a escolha salva no aparelho.
  - Áudio desbloqueado no primeiro toque.
  - `navigator.audioSession.type = 'ambient'` quando existir.
  - `navigator.vibrate` só no Android (o iOS não suporta).
- Referências oficiais (em `docs/reference/`):
  - `prototipo-cor.html`: protótipo jogável aprovado. **Fonte da verdade** de fluxo, animação, sons e cálculo.
  - `design-hub.html`, `design-cor-resultado.html`, `design-tempo-resultado.html`: telas do Pop Brutal. Formato de canvas: `{{accent}}` = `#FF6A2B`, `{{accent2}}` = `#2F5BFF`.

### Jogo 1: Cor

- **Como funciona:** a cor aparece por alguns segundos e some. O jogador recria com sliders **HSB** (H 0–360, S 0–100, B 0–100) e aperta "Cravar". Depois vê as duas cores lado a lado com a nota.
- **Nota:** **ΔE2000 no espaço Lab** (nunca distância RGB). `score = 10 / (1 + (ΔE/12)^1.6)` (curva v2, em [0, 10]), com 1 casa decimal. 5 rodadas, máximo de 50 pontos.
- **Sorteio do alvo:** H 0–359, S 35–95, B 40–95.
- **Resultado da rodada:** alvo e você lado a lado, nota, ΔE, diferenças de H/S/B e, no multiplayer, as cores e notas dos amigos.
- **Modos planejados:**

  | Modo                | Regra                                           |
  | ------------------- | ----------------------------------------------- |
  | Clássico            | Cor visível por 3s (como no protótipo aprovado) |
  | Flash               | A cor pisca por 200–500ms                       |
  | Contagem regressiva | O tempo de exibição diminui a cada rodada       |
  | Interferência       | Outra cor aparece entre ver e responder         |
  | Paleta              | Memoriza 2–3 cores de uma vez                   |
  | Às cegas            | Mexe nos sliders sem ver a cor resultante       |

- **Configurações da sala:** rodadas, tempo de exibição, tempo para responder, tipo de controle (HSB / RGB / roda de cor), mostrar ou não o resultado parcial entre rodadas.

### Jogo 2: Tempo

- **Regra central:** o jogador **nunca** vê o tempo correndo.
  1. Aparece o alvo (ex.: 5.60s).
  2. Toca para iniciar e toca para parar, contando de cabeça.
  3. Só no final aparece o tempo dele vs o alvo (ex.: "5.60s vs 5.91s, +0.31s") e a nota.
- **Proibido durante a contagem:**
  - Cronômetro, número ou barra de progresso.
  - Animação em loop ou com ritmo regular.
  - Qualquer som. Tudo isso vira metrônomo e entrega a resposta.
- **Nota:** pelo **erro relativo** ao alvo, porque errar 0.3s em 2s pesa mais do que errar 0.3s em 10s.
- **Medição:** no aparelho com `performance.now()`. Só a duração vai para o servidor, então o lag de rede não interfere.
- **Modos aprovados:**

  | Modo         | Regra                                          |
  | ------------ | ---------------------------------------------- |
  | Clássico     | Toca para iniciar e toca para parar            |
  | Sequência    | Marca 3 intervalos seguidos e vê tudo no final |
  | Sem estourar | Passou do alvo, a rodada vale zero             |

- **Modos descartados:** "Contador que some" (mostrava o tempo), "Segurar", "Distração" e "Alvo relâmpago". Podem voltar no futuro, mas não estão no escopo.
- **Configurações da sala:** rodadas, faixa de alvos (curtos 1–5s, médios 5–15s, longos 15–30s), modo, mostrar resultado a cada rodada ou só no fim.
- **Multiplayer:** todos recebem o mesmo alvo. Na revelação aparece uma linha do tempo com o alvo marcado e o ponto onde cada jogador parou.

### Multiplayer (salas)

1. Criar sala gera um **código de 4 letras** e um link, com compartilhamento nativo (WhatsApp) e convite direto da aba Amigos.
2. **Lobby:**
   - O host configura as regras e todos marcam "pronto".
   - O host pode expulsar alguém e, se ele cair, outra pessoa assume.
3. **Rodada:** o servidor sorteia (seed) e inicia ao mesmo tempo para todos.
4. **Revelação:** as respostas de todos aparecem lado a lado com o alvo.
5. **Fim:** pódio, com "Jogar de novo / Revanche" (mesma sala, mesmo jogo) ou "Sair".
6. **Reconexão:** quem bloqueou a tela do celular volta e continua de onde parou.
7. **Convites:** a notificação já diz o jogo ("Lucas te chamou para uma sala de **Cor**") e abre direto no lobby.

### Rankings

- **Por jogo e por modo**, com recortes diário, semanal e de todos os tempos, global e só entre amigos.
- Cada jogo define o tipo de ranking: `score` (Cor, Tempo), `wins` (jogos futuros tipo impostor, com taxa de vitória por papel) ou `none`.
- **Só os modos padrão (presets) contam.** Salas personalizadas nunca entram no ranking.
- **Daily:** a mesma seed para o mundo todo, `"<game>:YYYY-MM-DD"` no fuso America/Sao_Paulo.

### Histórico

- Aba própria com:
  - Lista das partidas (jogo, modo, tipo solo/sala/daily, data, nota, colocação).
  - Filtros por jogo, tipo e amigo.
  - Detalhe rodada a rodada (Cor: alvo vs você; Tempo: linha do tempo).
  - **Confronto direto** ("Você 12 × 8 Pedro na Cor"), que aparece também no perfil do amigo.

### Perfil

- Recordes por jogo e modo, médias, sequência de dias no Daily, histórico, conquistas e avatar.

### Stack

| Camada                    | Escolha                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo                  | pnpm workspaces + Turborepo, Node 22, TS strict                                                                                                   |
| Front                     | React 19 + Vite + TanStack Router (+ TanStack Query) + Zustand, CSS puro com variáveis                                                            |
| Animação                  | CSS + Web Animations API; `motion` (só `animate`) quando precisar de mola                                                                         |
| PWA                       | vite-plugin-pwa (Workbox), `@vite-pwa/assets-generator` para ícones                                                                               |
| Som                       | Web Audio API (módulo `sfx` compartilhado entre jogos)                                                                                            |
| API                       | NestJS + zod                                                                                                                                      |
| Tempo real                | **Colyseus** (um tipo de sala por jogo: `color`, `time`...); usar o estado filtrado por jogador (`StateView`) para jogos com informação escondida |
| Banco                     | **PostgreSQL no Supabase** + Drizzle ORM + postgres.js                                                                                            |
| Cache, ranking e presença | Redis (sorted sets para leaderboard; presença "online agora")                                                                                     |
| Deploy (planejado)        | Front no Cloudflare Pages; API + Colyseus no Fly.io (WebSocket persistente); Redis no Upstash                                                     |

**Supabase:**

- Runtime usa o **transaction pooler (porta 6543)** com `prepare: false`.
- Migrations (drizzle-kit) usam o **session pooler (porta 5432)**.
- Credenciais **só** em `.env` (gitignored), com um `.env.example` sem segredo.

---

## 3. Arquitetura

### Contrato de jogo (`packages/games`)

A lógica dos jogos é pura e compartilhada entre front e back:

```ts
interface GameDefinition<Settings, State> {
  id: string;
  meta: {
    minPlayers: number;
    maxPlayers: number;
    solo: boolean;
    daily: boolean;
    ranking: 'score' | 'wins' | 'none';
  };
  settingsSchema: ZodSchema<Settings>;
  presets: Record<string, Settings>; // modos padrão (rankeáveis)
  phases: Phase[]; // ex.: 'show' → 'answer' → 'reveal'
  onAction(state: State, playerId: string, action: Action): void;
  viewFor(state: State, playerId: string): PlayerView; // o que CADA jogador pode ver
}
```

- **Cor e Tempo** usam o helper `createRoundGame()`, que preenche o contrato só com `generateRound(seed, settings, i)` (determinístico) e `score(round, answer, settings)`.
- **`viewFor`** existe para jogos futuros com informação escondida (o impostor não pode receber a palavra secreta, nem pelo DevTools).
- **Anti-trapaça:** o servidor **sempre regenera as rodadas pela seed e recalcula a nota** antes de salvar. A nota enviada pelo cliente é ignorada.
- **Jogo novo** = plugin em `packages/games` + componentes de UI. Lobby, ranking, daily, histórico e perfil funcionam sem mudança.

### Modelo de dados (enxuto, sem sobrecarregar o banco)

- **Não guardar o alvo**, só a **seed** e as **respostas**.
  - Resposta da Cor: um int por rodada (`h*10000 + s*100 + b`).
  - Resposta do Tempo: int em ms.

```sql
players(id uuid pk, created_at, nickname text null)            -- convidado agora, conta depois
matches(id uuid pk, game text, mode text, kind text,           -- kind: solo | room | daily
        seed text, settings jsonb null, ranked bool, played_at timestamptz)
match_players(match_id, player_id, answers int[], total_score smallint,
              placement smallint null, played_at timestamptz,  -- played_at desnormalizado
              pk(match_id, player_id))                          -- índice (player_id, played_at desc)
user_game_stats(player_id, game, mode, matches int, score_sum int, best smallint, daily_streak int)
head_to_head(player_a, player_b, game, wins_a int, wins_b int, last_played_at)
```

- **Agregados:** `user_game_stats` e `head_to_head` são atualizados no fim de cada partida. Perfil e confronto direto leem uma linha só.
- **Retenção:**
  - Detalhe das rodadas (`answers`) só nas **últimas 200 partidas por jogo** de cada usuário; nas mais antigas vira `null`.
  - Resumo e agregados ficam para sempre.
  - Lobby, chat, movimento de slider e eventos de sala **não são salvos**; vivem só na memória do Colyseus.
- **Estimativa de espaço:** cerca de 150 B por jogador por partida. 100 pessoas × 30 partidas/dia ≈ 160 MB/ano. Particionar `matches` por mês só se crescer muito.

### Offline e PWA

- O solo roda inteiro no cliente. O resultado vai para uma fila local (IndexedDB) e é enviado quando a conexão voltar.
- **Manifest:** `display: standalone`, `theme_color` e `background_color` `#F4F4EF`, ícones 192/512 + maskable, metas do iOS e safe areas (`viewport-fit=cover`).
- Precache do app shell, com prompt de atualização.
- **Responsivo:** no celular ocupa a tela inteira; no PC, uma coluna centralizada de ~440px. Funciona com toque, mouse e teclado.
- **Meta de peso:** JS inicial < ~150 KB gzip, com cada jogo em lazy-load.

---

## 4. Regras invioláveis

1. **Segurança:** nunca commitar `.env` ou credenciais. O repositório deve ser privado.
2. **Lógica de jogo:** fica só em `packages/games`, e o servidor recalcula toda nota.
3. **Ranking:** só presets entram. Salas personalizadas nunca.
4. **Jogo do Tempo:** nenhum cronômetro, número, barra, som ou animação rítmica durante a contagem.
5. **Cor:** a nota usa ΔE2000, nunca RGB.
6. **Animação:** só `transform`/`opacity`, respeitando `prefers-reduced-motion`.
7. **Telas:** toda tela segue os tokens do Pop Brutal. Sem emoji, sem gradiente genérico, sem Inter/Roboto.
8. **Linguagem:** código em inglês, UI em pt-BR, Conventional Commits.
9. **Jogos independentes:** um código de sala de um jogo nunca abre outro jogo.

---

## 5. Roadmap

| Etapa | Escopo                                                                                                                                                                                                                                                                                              | Status                                                    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **1** | Monorepo; `packages/games` (Cor + testes); API (health, daily, `POST /matches` com recálculo, histórico); Supabase + migrations; Web com Hub, fluxo completo da Cor, sons, animações, PWA instalável e offline; Histórico; docs (ARCHITECTURE, CLAUDE, specs, `.claude/commands`, `.claude/skills`) | **Em andamento** (prompt da Etapa 1 já enviado ao agente) |
| **2** | Contas (login/registro), migração convidado → conta, Perfil, recordes, Daily com sequência, ranking global por jogo/modo (Redis)                                                                                                                                                                    | A fazer                                                   |
| **3** | Amigos (busca por @username, solicitações, online agora, convites), salas multiplayer via Colyseus com regras configuráveis, revelação lado a lado, revanche, reconexão, ranking entre amigos, confronto direto                                                                                     | A fazer                                                   |
| **4** | Jogo do Tempo (Clássico, Sequência, Sem estourar) em solo, sala e daily                                                                                                                                                                                                                             | A fazer                                                   |
| **5** | Modos extras da Cor (Contagem regressiva, Interferência, Paleta, Às cegas), conquistas, novos jogos                                                                                                                                                                                                 | A fazer                                                   |
| **6** | Deploy de produção (Cloudflare Pages + Fly.io + Upstash), domínio, monitoramento                                                                                                                                                                                                                    | A fazer                                                   |

### Ideias de jogos futuros (não aprovadas, só backlog)

> Os jogos que o Lucas quer fazer e os próximos passos do Ecooo estão em `docs/JOGOS-FUTUROS.md`.

- **Social:** Impostor (palavra secreta), Rabisco (desenhar e adivinhar), Quem é mais provável, Duas verdades e uma mentira, Respostas falsas, Sintonia (escala com dica, cooperativo), Leilão às cegas.
- **Percepção:** Ímpar (achar o quadrado diferente), Mistura (cor resultante), Onde estava? (memória espacial), Quantos? (estimativa), Trajetória, Proporção, Rabisco de memória, Metrônomo fantasma, Degradê.

---

### Pedidos novos (após o primeiro teste da Cor), ainda pendentes de implementação

- **Modo noturno** é requisito (fecha a decisão #12): `specs/005-modo-noturno.md`.
- **Nota da Cor** recalibrada (curva v2, implementada); a #3 fecha quando os parâmetros 12 e 1,6 forem validados jogando: `specs/001-color-game.md`.
- **Jogo rápido** de 1 rodada em Cor e Tempo, com ranking próprio: `specs/006-jogo-rapido.md`.

## 6. Decisões em aberto ❓

| #   | Decisão                                                              | Opções e notas                                                                                                                       |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Jogam mais **presencialmente ou remoto**?                            | Muda a necessidade de chat e voz (WebRTC/LiveKit) e de um "modo TV"                                                                  |
| 2   | **Auth**                                                             | Better Auth (planejado) vs Supabase Auth (já que o banco é Supabase); e-mail + Google                                                |
| 3   | **Calibrar a curva da nota da Cor**                                  | curva v2 `10/(1+(ΔE/12)^1.6)` implementada; validar 12 e 1,6 com jogadores reais                                                     |
| 4   | **Curva da nota do Tempo**                                           | PROPOSTA implementada: `10/(1+(e/0.15)^1.6)` (erro relativo); falta o Lucas validar jogando                                          |
| 5   | **Tempo de exibição do Clássico da Cor**                             | 3s (protótipo aprovado) vs 5s (planejamento inicial). Hoje vale **3s**                                                               |
| 6   | **Anti-trapaça do Tempo**                                            | PROPOSTA implementada: sessão assinada, soma dos tempos <= relógio do servidor, uso único, 200 ms a 3x o alvo; falta o Lucas validar |
| 7   | **Limite de jogadores por sala**                                     | Sugestão: 2–8                                                                                                                        |
| 8   | Quais **modos da Cor** entram no lançamento além de Clássico e Flash | —                                                                                                                                    |
| 9   | Quais modos têm **Daily**                                            | Sugestão: só Clássico                                                                                                                |
| 10  | **Retenção de 200 partidas por jogo**                                | Confirmar o número                                                                                                                   |
| 11  | **Avatar**                                                           | Upload de foto, avatares gerados ou iniciais                                                                                         |
| 12  | ~~Modo escuro~~ do Pop Brutal                                        | **Decidido: sim, é requisito.** Falta o design escuro (spec 005)                                                                     |
| 13  | **Notificações push** para convites                                  | Web Push no PWA; o iOS exige o app instalado                                                                                         |
| 14  | **Domínio e marca**                                                  | Checar disponibilidade de "NoCap" em domínio e lojas                                                                                 |
| 15  | **Hospedagem**                                                       | Confirmar Cloudflare Pages + Fly.io + Upstash ou alternativa                                                                         |

---

## 7. Pendências imediatas ⚠️

- [ ] **Trocar a senha do banco no Supabase.** Ela passou por chat e por agente; depois disso, atualizar só o `.env`.
- [ ] Confirmar que o repositório `github.com/olucasfl/nocap-app` está **privado**.
- [ ] Revisar o resultado da Etapa 1: o que o agente entregou e o que ficou pendente.
- [ ] Colocar este documento em `docs/PROJECT-BRIEF.md` e manter `ARCHITECTURE.md`, `CLAUDE.md` e `specs/` coerentes com ele.
- [ ] Desenhar as telas que faltam no Pop Brutal: lobby da sala, configuração de regras, Cor durante o jogo (desktop), Tempo jogando, Histórico, Amigos, Perfil, Ranking.
- [ ] Responder às decisões em aberto da seção 6, começando por 1, 2 e 4.

---

## 8. Como o agente deve usar este documento

1. Ler este brief e os arquivos em `docs/reference/` antes de qualquer tarefa.
2. Não alterar decisões da seção 2 sem pedir. Itens da seção 6 devem ser perguntados, nunca decididos sozinho, a não ser que a tarefa exija; nesse caso, escolha o padrão sugerido e registre a escolha na seção 2.
3. Ao concluir uma etapa, atualize a coluna Status do roadmap e marque as pendências resolvidas.
4. Toda feature nova começa com uma spec em `specs/NNN-nome.md`.
