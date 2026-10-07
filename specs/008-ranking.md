# 008: Ranking

> **Status: implementado e verificado (2026-10-06), em Postgres.** Redis fica para quando o volume pedir.
> Atualização: o ranking passou a ser por jogo (`/cor/ranking`, `/tempo/ranking`, `/daily`); ver [010](010-daily-rankings-profile.md).

## Objetivo

Comparar notas entre quem tem conta, por modo e período.

## Regras

- **Só contas entram.** Convidado não tem nome, então não aparece. Aparece o **@usuário**, nunca o nome real.
- **Só presets** (`ranked`). Salas personalizadas nunca entram (brief #3 das regras).
- **Nota do ranking = a melhor partida de cada conta** no recorte. Empate: quem chegou lá primeiro.
- **Quadros:** Clássico, Flash, Rápido e Daily (clássico, só partidas de Daily). Cada um é um ranking próprio; o Rápido (máx. 10) nunca se mistura com os de 5 rodadas.
- **Períodos:** Hoje, Semana (começa na segunda) e Sempre, no fuso de São Paulo (UTC-3 fixo).
- Top 50 (máx. 100) e, se estiver logado e fora do top, **a sua posição** à parte.

## Telas

`/ranking` (atalho "Ver ranking" no Hub): dois seletores (quadro e período) e a lista. Não é uma aba nova (a barra tem 4).

## API

`GET /rankings/color?board=classic|flash|quick|daily&period=day|week|all&limit=` (público). Com token válido, devolve também `me` e `isMe`.

## Critérios de aceite

- [x] A nota de cada conta é a melhor partida dela; convidado não aparece.
- [x] Daily, Rápido, Flash e Clássico são quadros separados.
- [x] Sua posição aparece mesmo fora do top.
- [x] Nome real e id de usuário nunca saem da API.
- [x] Períodos seguem o dia de São Paulo (testes de `periodStart`).

## Limitação honesta (Cor)

Na Cor a seed de uma partida solo é escolhida pelo app e os alvos saem dela, então quem mexer no código do app consegue gerar a resposta perfeita. O servidor recalcula a nota, mas não impede isso. É aceitável entre amigos; para um ranking aberto seria preciso emitir a seed no servidor e esconder o alvo (mesmo problema do brief #6, anti-trapaça do Tempo). O Daily já tem a seed validada pelo servidor.

## Fora de escopo

Ranking entre amigos (Etapa 3, precisa de amizades), Tempo (Etapa 4), Redis.
