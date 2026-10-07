# 006: Jogo rápido (1 rodada)

> **Status: Cor e Tempo implementados (preset `quick`, sem Daily, sem atalho no Hub).** Pedido do Lucas após o primeiro teste: "tem que ter uma opção de jogar somente 1 rodada, tipo o jogo rápido; o jogo do Tempo teria isso também". Nada implementado ainda.

## Objetivo

Cada jogo oferece uma partida de **uma rodada só**, para jogar em 30 segundos sem se comprometer com 5 rodadas.

## Regras

- Vale para **Cor** e **Tempo** (e para jogos futuros que tenham rodadas).
- É um **preset** novo, chamado `quick`, com `rounds: 1`. As demais configurações são as do Clássico de cada jogo (Cor: `showMs: 3000`; Tempo: uma faixa de alvo média).
- Por ser preset, **conta para ranking**, mas em ranking **próprio** (jogo + modo `quick`), nunca misturado com o de 5 rodadas. Nota máxima: 10.
- O resultado mostra a rodada inteira (mesma tela de resultado da rodada) e termina ali, sem a tela de total. Botões: **Outra rodada** e **Voltar aos jogos**.
- Daily: continua sendo o preset de 5 rodadas. O jogo rápido não tem Daily (a decidir, ver abaixo).
- Salas multiplayer: já cobertas pela configuração `rounds` da sala; o jogo rápido é só o atalho do solo.
- Histórico: partida `quick` aparece com o rótulo do modo e nota /10.

## Telas e fluxo

- **Cor, tela inicial:** o seletor de modo hoje tem Clássico, Flash e Daily. Ganha **Rápido**. Com 4 opções o seletor vira 2×2 (ou rolagem horizontal); decidir no design.
- **Hub:** o card de cada jogo pode ganhar um atalho "Rápido" (a decidir).
- **Tempo:** modo Rápido na tela inicial do jogo do Tempo (quando existir, Etapa 4).

## Modelo de dados e API

- `colorPresets.quick = { rounds: 1, showMs: 3000 }` em `packages/games` (e o equivalente no Tempo).
- O servidor já valida `answers.length === settings.rounds` e o modo pelo nome do preset, então `POST /matches` funciona com `mode: 'quick'` sem mudar o contrato.
- `user_game_stats` já é por `(jogador, jogo, modo)`: o modo `quick` ganha linha própria sem migration.
- Atenção: a tela de resultado final e o texto "pontos max" assumem 5 rodadas; passar a derivar tudo de `settings.rounds`.

## Critérios de aceite

- [x] Na tela inicial da Cor existe a opção Rápido; ao jogar, há exatamente 1 rodada (memorizar, recriar, resultado) e o jogo termina.
- [x] A partida é salva com `mode = quick` e nota recalculada no servidor, valendo no máximo 10.
- [x] O recorde e o ranking do Rápido não se misturam com os do Clássico.
- [x] "Outra rodada" inicia nova partida rápida com seed nova.
- [x] O mesmo vale para o Tempo (spec 002).

## Fora de escopo

Escolher um número arbitrário de rodadas no solo (isso é configuração de sala, spec 004).

## Decisões em aberto

> Adotados os padrões sugeridos até o Lucas dizer o contrário: 3 s, sem Daily próprio, sem atalho no Hub.

- O Rápido da Cor usa 3 s (Clássico) ou 0,4 s (Flash)? Sugestão: 3 s.
- O Rápido tem Daily próprio ("rodada do dia")?
- Atalho no Hub ou só dentro do jogo?
