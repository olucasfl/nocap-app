# 010: Daily por jogo, rankings por jogo, conta obrigatória e perfil

> **Status: implementado e verificado (2026-10-06).** Substitui as partes de 008 (ranking único em `/ranking`) e 002/004 (salas só da Cor).

## Objetivo

Cada jogo é dono do seu ranking, da sua sala e do seu Daily; só quem tem conta joga.

## Regras

- **Daily é um jogo especial:** 1 Cor + 1 Tempo por dia (fuso de São Paulo) por conta, valendo em qualquer aparelho. O servidor recusa o segundo (409). O ranking do Daily soma as notas dos dias (`days` = dias jogados).
- **Cada jogo tem 3 abas** (`/cor`, `/tempo`; `?aba=ranking&quadro=daily` abre direto): Modos de partida (modos solo + cartão do Daily do jogo), Jogar com amigos (criar sala/entrar por código) e Ranking (modo em abas com Daily à parte, período emendado, chave só amigos, pódio + lista). Não existem mais `/ranking` nem `/daily`.
- **Salas por jogo:** dentro de cada jogo há "Sala com amigos" (`/sala?jogo=color|time`) e o ranking do jogo. A sala do Tempo reaproveita o ciclo da sala da Cor; cada pessoa começa e para o próprio relógio e **o servidor mede** o tempo. Sala nunca entra no ranking.
- **Histórico** separado por jogo; cada partida mostra a classificação (colocação na sala, ou CRAVOU/QUASE/MEH/ERROU pela nota).
- **Conta obrigatória para jogar:** convidado navega mas não joga (`PlayGate` na tela, 401 na API). Limites: 30 partidas/min por conta, 300 req/min por IP, 20 visitas/min, pedidos de amizade e convites limitados, uma sala por conta, `trust proxy` no Render.
- **Perfil:** abas Perfil e Recordes (um cartão por jogo, com arte própria, modos e a sequência do Daily daquele jogo). O Perfil mostra os **dias seguidos entrando no NoCap** (`user_visits`, migration 0003). Sair pede confirmação.
- **Tempo:** COMEÇAR leva a uma tela de preparo imersiva (tinta, alvo grande, botão redondo INICIAR); ao iniciar a tela vira laranja de uma vez (VALENDO, sem som/animação) e qualquer toque para. O resultado é visual: o alvo cai, o tempo do jogador sobe numa pista com tiques, a marca do alvo mostra a distância e o veredito toca som próprio (cravou/perto/errou).
- **Modos com Daily junto** (cartões com arte própria), histórico paginado (Anterior/Próxima), perfil de amigo (`GET /friends/:username/profile`, só amigos; só @usuário e recordes), splash só no PWA instalado.
- **Tema:** só Claro e Escuro. **Navegação:** botões Voltar nas telas internas e carregador do NoCap (`Loader`).
- **Tempo clássico:** 3 rodadas alternando alvo curto (< 10 s) e longo (> 10 s). Rápido: 1 rodada, quase sempre curta. Partidas antigas de 5 rodadas continuam legíveis (`presetFor`).

## Fora do escopo

Sala com ranking, Redis, e-mail/Google (ver ROADMAP).
- **Offline:** a conta continua logada sem rede (usuário em cache; só uma resposta "sem sessão" do servidor desloga). Faixa "Você está offline" / "Conexão restabelecida"; Cor guarda partidas e envia ao voltar; Tempo offline joga sem salvar; Daily, salas, ranking, amigos e histórico avisam que precisam de internet (`LoadFailed`). Puxar para recarregar nas telas de menu. Página que não carrega mostra o erro com "tentar de novo".
- **Modos novos:** Cor: Às cegas (5 rodadas sem prévia, notas só no fim) e Sobrevivência; Tempo: Sequência (5 alvos de 2 a 6 s sem pausa) e Sobrevivência. Sobrevivência: 3 vidas, nota mínima fixa 6, até 20 rodadas; Cor encurta o tempo de decorar (3 s → 0,8 s). A nota guardada é o número de rodadas jogadas ×10; o servidor só aceita sobrevivência completa (`evaluateSurvival`). Cada modo tem ranking próprio.
- **Modos de jogo:** a aba Modos lista só os modos; o Daily fica em cima num retângulo de duas colunas com arte própria. Tocar num modo abre a ficha (explicação, regras, Jogar) com "Escolher outro modo".
- **Sons:** todo botão tem som próprio via `data-sfx` (navbar por aba, voltar, abas, escolhas, chaves, tema claro/escuro, confirmar/cancelar, sair, amigos, convite, sala, offline/online, puxar para recarregar, Sobrevivência: moeda/vida perdida/fim). Nada toca durante a contagem do Tempo; o mudo vale para todos. Teste garante que todo `data-sfx` existe.
- **Tempo, fluxo:** Jogar → instruções ("Como jogar") → Começar → tela do alvo com UM botão redondo: INICIAR; ao tocar, o mesmo botão (mesmo lugar) vira PARAR e só o visual muda (laranja, sem animação/som); tocar nele de novo encerra. Na Sobrevivência a rodada, as vidas e a nota mínima ficam à vista; ao fim da rodada passou = estouro de quadrados e clarão verde, perdeu vida = quadrado de vida quebra, aviso treme e clarão laranja.
- **Recordes:** o card da home mostra só o recorde do Clássico ("RECORDE CLÁSSICO x/y"). A ficha de cada modo mostra "Seu recorde aqui é de ...". Ao fim de uma partida que passa do recorde do modo (e já havia um), aparece "Novo recorde!" com animação e fanfarra; o recorde anterior vem das estatísticas em cache ao começar. Salvar a partida atualiza estatísticas, histórico e rankings.
- **Tempo 1–22 s:** Clássico, Rápido, Sem estourar e Sobrevivência sorteiam alvos de 1 a 22 s (curtos até 9,9 s e longos de 10,1 s); só a Sequência continua de 2 a 6 s. Partidas antigas do Tempo mostram alvos diferentes no detalhe do histórico (as faixas mudaram).
- **Salas por modo:** Cor: Clássico, Flash (0,4 s) e Às cegas (sem prévia); Tempo: Clássico, Sem estourar e Sequência. O host escolhe o modo no lobby; o servidor valida o modo e as regras dele.
- **Faixas da nota** (`lib/grade.ts`): CRAVOU só com 10; depois quase perfeito (9+), mandou bem (8+), dá pro gasto (7+), passa na raça (6+), meh (5+), foi uma escolha (3+), que isso? (1+) e zerou. Cada faixa tem cor, animação, som e frases irônicas próprias (CRAVOU: raios, confete e clarão dourado; muito ruim: clarão escuro e rachaduras). O histórico usa as mesmas faixas.
- **Etapa:** nas partidas de várias rodadas do Tempo (menos Sobrevivência) o topo mostra a etapa (2/5).
