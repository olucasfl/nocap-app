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

## Fora de escopo

Multiplayer, ranking, modos extras.

## Decisões em aberto

Brief #3 (curva da nota), #5 (3s vs 5s; vale 3s).
