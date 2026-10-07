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
- **Tempo, 3 toques:** COMEÇAR (prepara), "Clique para começar a contar" (dispara o relógio) e PARAR.
- **Tema:** só Claro e Escuro. **Navegação:** botões Voltar nas telas internas e carregador do NoCap (`Loader`).
- **Tempo clássico:** 3 rodadas alternando alvo curto (< 10 s) e longo (> 10 s). Rápido: 1 rodada, quase sempre curta. Partidas antigas de 5 rodadas continuam legíveis (`presetFor`).

## Fora do escopo

Sala com ranking, Redis, e-mail/Google (ver ROADMAP).
