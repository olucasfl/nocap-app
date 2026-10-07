# 011 · O Intruso (variante da Cor, só em sala)

Status: em andamento · Etapa 3 (jogos com amigos)

## O que é

Uma variante da Cor que só existe em sala. Aparece na lista de modos da Cor como qualquer outra,
mas ao tocar nela o app avisa que precisa de uma sala e pergunta se quer criar.

Todo mundo tenta recriar a mesma cor. A maioria vê a cor por alguns segundos. Alguns "intrusos"
não veem a cor: recebem só uma **dica** escrita sobre ela. Depois de recriar, todos veem as
amostras e **votam** em quem acham que é intruso. Intrusos também votam.

## Regras

- **Jogadores:** de 3 a 12 (limite ampliado de 8 para 12 a pedido do Lucas, em 07/10/2026). O mínimo é 3, para ter pelo menos 1 intruso e 1 pessoa normal votando.
- **Intrusos:** o host escolhe 1, 2 ou 3. O número efetivo se adapta à sala: sempre sobra pelo
  menos uma pessoa normal. `máx = min(3, n - 1)` (3 pessoas: até 2 intrusos contra 1, que fica
  engraçado; 4 a 12 pessoas: até 3). Se o host pedir mais do que a sala suporta, vale o máximo.
- **Papéis:** sorteados a cada rodada (seed da rodada + posição), então quem é intruso muda.
  Cada intruso só sabe o próprio papel (intrusos não se conhecem). Todos sabem quantos são.
- **Cor e dica:** vêm de uma paleta de cores nomeadas, cada uma com várias dicas (mais de 1000
  no total, com humor). A dica sempre descreve a cor real da rodada.
- **O que cada um vê:** tripulação vê a cor durante o tempo de decorar e depois ela some;
  intruso vê a dica durante a rodada toda (decorar, recriar e votar).
- **Fases:** `show` (decorar) → `pick` (recriar) → `vote` (votar) → `reveal` → próxima rodada…
  → `final`.
- **Voto:** cada pessoa aponta uma suspeita (não vale em si mesma) ou se abstém. Pode trocar
  até acabar o tempo. Por padrão o voto de cada um aparece na revelação. O host pode ligar
  **voto anônimo** no lobby: aí só a contagem aparece.
- **Pego:** um intruso é pego se recebeu estritamente mais votos que o `K+1`-ésimo mais votado
  (`K` = número de intrusos) e pelo menos 1. Empate na fronteira não pega ninguém.

## Pontuação (por rodada, em décimos no pódio)

- Todo mundo: a nota da recriação (0 a 10, ΔE2000 como na Cor).
- Quem votou em um intruso de verdade: +3.
- Intruso que não foi pego: +6.
- Intruso: +1 por voto que um inocente recebeu.
- Vence quem somar mais depois das rodadas (padrão 3, o host escolhe 1 a 5).

## Segredo no servidor

O servidor manda um estado diferente para cada pessoa (`snapshot(viewerId)`): a seed não é
enviada; a cor só vai para a tripulação na fase `show` (e para todos na revelação); a dica só
vai para os intrusos; os papéis só aparecem na revelação.

## Fora do escopo desta versão

- Não salva no histórico nem entra em ranking (sala nunca é ranqueada). Só o pódio da sala.
- Estatísticas próprias (vitórias como intruso) ficam para depois.

## Dicas

Paleta pronta (116 cores, 1044 dicas, `palette-1..4.ts`) em `apps/api/src/rooms/impostor/` (conteúdo só do servidor, para o app não carregar as
mais de mil frases). Cada cor tem nome, HSB e dicas; as dicas precisam ser úteis (objeto,
comparação, temperatura) e podem ter piada.
