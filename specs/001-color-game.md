# 001: Jogo da Cor

## Objetivo

A cor aparece por alguns segundos e some; o jogador a recria com sliders HSB e vê o resultado com nota.

## Regras

- 5 rodadas, máximo 50 pontos. Alvo: H 0–359, S 35–95, B 40–95, sorteado da seed.
- Nota: `clamp(10 − 0.5·ΔE2000, 0, 10)`, 1 casa. ΔE2000 em Lab, nunca RGB. (Curva provisória: brief #3.)
- Presets rankeáveis: `classic` `{rounds:5, showMs:3000}`, `flash` `{rounds:5, showMs:400}`.
- Modos futuros (Etapa 5): Contagem regressiva, Interferência, Paleta, Às cegas.
- Sala (Etapa 3): rodadas, tempo de exibição, tempo para responder, controle (HSB/RGB/roda), resultado parcial.
- Daily: seed `color:YYYY-MM-DD` (America/Sao_Paulo), preset `classic`.

## Telas e fluxo

Hub → início (Clássico/Flash/Daily) → memorizar (carta vira, barra de tempo) → recriar (sliders H/S/B, "Cravar") →
resultado da rodada (alvo × você, nota conta subindo, carimbo, tremor, diferenças H/S/B) → final (total /50, rodadas, "Revanche").
Referência: `docs/reference/prototipo-cor.html`, `design-cor-resultado.html`.

## Sons

`flip`, `vanish`, `slide`, `tick(n)`, `thunk`, `win`, `boing`, `clack`. Ver skill `sfx`.

## Modelo de dados e API

`POST /matches` recalcula as notas pela seed. Resposta salva como `h*10000+s*100+b`. `GET /games/color/daily`.

## Critérios de aceite

- [ ] ΔE2000 bate com 3 pares de referência de Sharma.
- [ ] Mesma seed gera as mesmas rodadas; nota sempre em [0, 10].
- [ ] Partida completa salva no Supabase com nota recalculada no servidor.
- [ ] Solo funciona offline e sincroniza ao voltar a rede.
- [ ] Teclado: setas nos sliders, Enter cravar. `prefers-reduced-motion` respeitado.

## Pendente: nota mais generosa e mais fina (pedido do Lucas)

> **Status: implementada (curva v2, `COLOR_SCORE_VERSION = 2`); parâmetros 12 e 1,6 ainda a validar jogando.** Feedback após o primeiro teste: "o jogo da Cor precisa ser mais exato / está muito difícil. Se eu colocar uma cor pouco parecida, preciso de uma pontuaçãozinha (um 2, não 0). E quando chego bem próximo, deveria dar uns 9, não 7 ou 8." (O texto original diz "chegar no 0"; interpretado como a nota ser dura demais nos dois extremos.)

**Diagnóstico.** A curva atual, `10 − 0.5·ΔE`, é uma reta que zera em ΔE = 20. Isso pune duas vezes: quem está "longe, mas não tanto" (ΔE 20 ou mais) leva 0, e quem acerta "bem perto no olho" (ΔE 4 a 6, algo comum com sliders HSB) leva 7 a 8. Falta uma cauda longa embaixo e um topo mais largo em cima.

**Metas de comportamento (a validar jogando):**

| Situação                       | Nota-alvo  |
| ------------------------------ | ---------- |
| Praticamente idêntica (ΔE ≤ 2) | 9,5 a 10   |
| Bem próxima (ΔE 3 a 4)         | ~9         |
| Boa (ΔE 5 a 8)                 | 7 a 8      |
| Mediana (ΔE ~10)               | ~5,5       |
| Pouco parecida (ΔE ~20)        | ~3         |
| Longe (ΔE ~30 a 40)            | 1 a 2      |
| Totalmente diferente (ΔE ≥ 60) | perto de 0 |

**Candidata para calibrar:** `nota = 10 / (1 + (ΔE / 12)^1.6)`, em [0, 10], 1 casa. Comparação com a atual:

| ΔE        | 1   | 2   | 3   | 5   | 8   | 10  | 15  | 20  | 30  | 40  | 60  |
| --------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Atual     | 9,5 | 9,0 | 8,5 | 7,5 | 6,0 | 5,0 | 2,5 | 0   | 0   | 0   | 0   |
| Candidata | 9,8 | 9,5 | 9,0 | 8,0 | 6,6 | 5,7 | 4,1 | 3,1 | 1,9 | 1,3 | 0,7 |

Os parâmetros (12 e 1,6) são ponto de partida: ajustar com partidas reais do Lucas e de amigos (registrar ΔE e nota das rodadas e afinar até as metas acima).

**Consequências a tratar quando for implementar:**

- A função mora em `packages/games/src/color` (`scoreFromDeltaE`) e é usada pelo web e pela API: trocar ali muda os dois. Atualizar os testes (hoje fixam `10 − 0.5·ΔE`).
- Os veredictos da tela de resultado (`cravou ≥ 9.5`, `quase! ≥ 8`, `meh ≥ 5`, `errou`) foram pensados para a curva antiga: limiares revisados e mantidos: ΔE 2 → 9,5 (cravou), ΔE 5 → 8 (quase), ΔE ~11 → 5 (meh) seguem coerentes com a curva v2.
- **Versionar a curva (feito: `scoreVersion` guardado).** Guardar `scoreVersion` em `matches.settings` para nunca comparar nota de curvas diferentes no ranking. Como as respostas ficam salvas (e o alvo é regenerado pela seed), partidas antigas podem ser re-pontuadas.
- Hoje o banco só tem dados de teste, então é o melhor momento para trocar a curva (antes de qualquer ranking real).
- Fecha a decisão #3 do brief.

**Critérios de aceite (atendidos):**

- [x] Uma cor "pouco parecida" (ΔE ~20) rende cerca de 3, e uma "longe" (ΔE 30 a 40) ainda rende 1 a 2, em vez de 0.
- [x] Uma cor "bem próxima" (ΔE 3 a 4) rende cerca de 9.
- [x] Cor idêntica continua valendo 10, e a nota nunca sai de [0, 10] nem tem mais de 1 casa.
- [x] Os testes cobrem os pontos da tabela e a monotonia (ΔE maior nunca dá nota maior).
- [x] Os veredictos da tela de resultado batem com a nova distribuição.

## Pendente: jogo rápido

Ver [006-jogo-rapido.md](006-jogo-rapido.md): preset `quick` de 1 rodada.

## Pendente: modo noturno

Ver [005-modo-noturno.md](005-modo-noturno.md).

## Fora de escopo

Multiplayer, ranking, modos extras.

## Decisões em aberto

Brief #5 (3s vs 5s; vale 3s). Brief #3 (curva da nota): proposta de recalibração acima, falta validar jogando.
