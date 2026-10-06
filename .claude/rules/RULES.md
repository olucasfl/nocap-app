# RULES.md: regras permanentes do NoCap

Precedência: `RULES.md` > `CLAUDE.md` > `ARCHITECTURE.md` > spec > prompt da conversa.
Padrão: negar por padrão, abrir exceções nomeadas, dizer o que fazer em vez disso.

## Nunca

- Commitar `.env` ou qualquer segredo; colar senha, chave ou connection string real em arquivo, commit, log ou chat.
- `git push --force`, `git reset --hard`, reescrever histórico publicado, `--no-verify`.
- Confiar na nota enviada pelo cliente: o servidor regenera as rodadas pela seed e recalcula.
- Pôr lógica de jogo fora de `packages/games`.
- Colocar sala personalizada no ranking.
- Mostrar cronômetro, número, barra, som ou animação rítmica durante a contagem do jogo do Tempo.
- Usar distância RGB para nota de cor (use ΔE2000 em Lab).
- Usar emoji, gradiente genérico, Inter/Roboto, ou cores fora dos tokens Pop Brutal.
- Animar propriedades que não sejam `transform`/`opacity`.
- Mudar uma decisão da seção 2 do `docs/PROJECT-BRIEF.md` sem pedir.

## Perguntar antes

- Qualquer item da seção 6 do brief (decisões em aberto).
- Migration destrutiva (remover coluna/tabela, mudar tipo) ou rodar migration em banco que não seja claramente descartável.
- Adicionar dependência fora da stack do brief.
- Commitar direto na `main` algo não trivial.

## Sempre

- Uma spec em `specs/NNN-nome.md` antes de feature nova; atualizar `specs/INDEX.md`.
- Testes no mesmo commit para lógica com ramificação (nota, rng, validação).
- Atualizar `ARCHITECTURE.md`, `docs/ROADMAP.md` e o status do brief junto com a mudança.
- Código em inglês, UI em pt-BR, Conventional Commits.

## Como pedir exceção

Diga qual regra bloqueia e por quê, descreva a ação exata, escreva o comando pronto e pare até haver um "sim" explícito.
