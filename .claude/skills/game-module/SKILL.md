---
name: game-module
description: Como implementar um jogo do NoCap (GameDefinition) em packages/games com testes. Use ao criar ou alterar a lógica de Cor, Tempo ou jogos novos.
---

# Módulo de jogo

Contrato: `packages/games/src/core/types.ts`. Lógica **pura e determinística**: sem DOM, sem Node, sem `Math.random()`.

## Passos

1. `settings.ts`: schema zod das configurações e `presets` (modos padrão; só eles contam para ranking).
2. `round.ts`: `generateRound(seed, settings, index)` usando `createRng(`${seed}:${index}`)` de `core/rng.ts`.
3. `score.ts`: `score(round, answer, settings)` retorna 0 a 10 com 1 casa decimal.
4. `index.ts`: exporta o `GameDefinition` e registra em `src/index.ts`.
5. Testes (Vitest, ao lado do código): mesma seed gera mesmas rodadas; nota sempre em [0, 10]; casos de borda.

## Regras do jogo (do brief)

- **Cor:** nota `clamp(10 − 0.5·ΔE2000, 0, 10)` em Lab (nunca RGB). Alvo: H 0–359, S 35–95, B 40–95. Presets `classic` `{rounds:5, showMs:3000}` e `flash` `{rounds:5, showMs:400}`. Resposta salva como `h*10000+s*100+b`.
- **Tempo:** nota por erro relativo ao alvo (curva exata em aberto, brief #4). Medição no cliente com `performance.now()`; resposta em ms.

O servidor sempre regenera as rodadas pela seed e recalcula a nota. Não guarde o alvo no banco.
