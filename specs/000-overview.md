# 000: Visão geral

## Objetivo

Hub de jogos para jogar com amigos, em navegador (PC e celular) e como PWA instalável. Rápido, leve, com animações e sons próprios.

## Regras

- Cada jogo é independente: salas, regras e rankings não se misturam. Código de sala de um jogo nunca abre outro.
- Navegação: **Jogos · Histórico · Amigos · Perfil**.
- Jogador é convidado (`guestId` UUID no aparelho) até a Etapa 2, quando vira conta.
- Cada jogo tem solo (se fizer sentido), sala personalizável, Daily e ranking quando fizer sentido. Só presets rankeiam.

## Critérios de aceite

- [ ] Hub lista Cor (jogável) e Tempo (em breve).
- [ ] App instala como PWA e o modo solo abre offline.
- [ ] Layout: tela cheia no celular, coluna ~440 px no PC, sem scroll horizontal.

## Fora de escopo (por ora)

Login, amigos, salas, ranking, notificações push.

## Decisões em aberto

Ver `docs/PROJECT-BRIEF.md` seção 6.
