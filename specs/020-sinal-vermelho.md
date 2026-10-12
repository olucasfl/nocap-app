# 020 · Sinal Vermelho (jogo solo de correr sem ser visto)

Status: **lógica aprovada pelo Lucas (12/10/2026); design dos 3 mapas, do boneco e do Vigia ainda não começou.** Nada implementado. Online (todos no mesmo mapa, com física de empurrão) fica para depois e não faz parte desta spec.

## A ideia

Um jogo de correr, visto de cima, infinito. Lá no fundo da tela fica o **Vigia**, que ora olha para você, ora vira de costas. Enquanto ele está de costas, você corre. Se ele olhar e você estiver se mexendo, **acabou**. A pontuação são os **metros** que você andou para a frente. Pense no "batatinha frita 1, 2, 3", mas infinito, com esconderijos e uma escuridão que vem de trás.

## Decisões do Lucas

- **Visão de cima**, câmera subindo; 2D (mais simples e mais bonito de fazer bem).
- **Vigia fixo** no topo da tela, acompanhando a câmera (sempre no horizonte). Um só.
- **Modo Clássico: perdeu, acabou** (nada de vidas). Outros modos entram depois e têm ranking próprio.
- **Escuridão** que vem de trás: no começo quase não aparece, vai ficando perigosa no final da corrida ou se a pessoa **ficar muito tempo parada**. Precisa ser **animada e profissional**.
- **Controles pelo aparelho, de forma intuitiva:** celular com analógico na tela (bola e bolinha) que **aparece onde o dedo tocar**; computador com W A S D (e setas). Sem opção de "dica mais fácil".
- **Mapas:** 3, com cenários, bonecos e Vigias diferentes, mas **as mesmas regras e a mesma dinâmica**. O mapa é **sorteado quando a partida é puxada** (pela seed). **Só o modo muda o ranking, o mapa não:** um ranking por modo, igual para todos os mapas.
- **Nota:** metros. Ranking por modo. Daily fica para depois (decidir mais adiante).

## Regras da partida (modo Clássico)

### O Vigia
Quatro estados, em ciclo. Todos os tempos saem da seed, então a partida é a mesma para o mesmo dado de entrada.

| Estado | Pode se mexer? | Duração inicial | Como muda com a distância |
|---|---|---|---|
| **De costas** | sim | 4,0 a 6,5 s | encurta até 1,6 a 2,8 s |
| **Aviso** | sim (ainda vale) | 0,9 s | encurta até 0,45 s (piso: nunca menos) |
| **Olhando** | **não: se mexer, perdeu** | 1,2 a 1,8 s | cresce até 2,6 s |
| **Voltando** | sim (a partir da virada) | 0,35 s | fixa |

- **Folga de 120 ms** logo ao começar a olhar: quem já estava no embalo não perde por um fio de cabelo. Sem isso o aviso não teria como ser justo.
- **"Se mexer"** = velocidade acima de uma **zona morta** pequena (para o dedo tremendo no analógico não contar). Estar dentro de um esconderijo não conta (veja abaixo).
- Todos esses números são **palpite a calibrar jogando**.

### O aviso (visual e sonoro, sem ser óbvio)
Antes de olhar, o Vigia dá sinais discretos e que um jogador atento aprende a ler: o olho dele dilata devagar, um zumbido grave sobe de tom, e uma vinheta leve pulsa nas bordas da tela. O som é reforço: **quem joga no mudo ainda vê o aviso**.

### O mundo
- Corredor largo o bastante para correr e desviar (cerca de 9 m), com cenário que se repete e varia por trechos gerados pela seed (obstáculos só decorativos nesta versão; o que importa para a lógica são os esconderijos).
- Distância em metros. O boneco anda no máximo uns **4,2 m/s**; o analógico controla a velocidade (proporcional ao quanto você inclina).
- **Pontuação = ponto mais longe que a pessoa chegou para a frente** (o maior avanço). Andar de lado ou voltar não soma, para ninguém "pontuar" balançando.

### Esconderijos
- Arbustos, caixotes ou sombras (conforme o mapa). Dentro de um, a pessoa **pode se mexer à vontade, mesmo com o Vigia olhando**.
- Para não virar jogo fácil: cada um **comporta uma pessoa**, é **pequeno**, e eles ficam **espaçados** (no começo 22 a 45 m entre um e outro; o espaço aumenta com a distância). Nunca formam uma fila de um até o outro: **sempre há um trecho aberto a cruzar** e a posição lateral muda de um para o próximo.
- O esconderijo **não protege da escuridão**.

### A escuridão
- Vem de trás e acompanha a pessoa, mais devagar do que ela corre. No começo é **quase imperceptível** (começa uns 60 m atrás e anda a uns 0,12 m/s).
- Fica mais rápida de duas formas: **com a distância** (mais perto do final da corrida, mais veloz) e **com o tempo parado** (se a pessoa não avançou uns 1,5 m nos últimos 6 s, a escuridão acelera em até 4 vezes, devagar e sem tranco).
- Só aparece na tela quando está perto (uns 14 m atrás), com nevoeiro, brasas e uma borda escura animada. Se alcança a pessoa, **perdeu**.
- É o que impede de ficar escondido para sempre e dá o ritmo da corrida.

### Fim da partida
Pausa disponível, que congela o relógio. Ao ser visto (ou alcançado pela escuridão) mostra "Te viu!" (ou o equivalente da escuridão), os metros, o recorde e o lugar no ranking (o mesmo `MatchSummary` dos outros jogos).

## Controles
- **Celular:** o analógico (círculo e bolinha) aparece **onde o dedo tocar**, na metade de baixo da tela. Solta o dedo, ele some.
- **Computador:** W A S D e setas, com a dica das teclas na tela na primeira vez.
- Aparece o que combina com o aparelho; se o aparelho tiver os dois, valem os dois.

## Técnico
- **Núcleo puro** em `packages/games/src/sinal/` (nome provisório): o mundo, o ciclo do Vigia, os esconderijos, a escuridão e a simulação com **passo fixo (60 por segundo)**, determinística. Sem relógio nem desenho dentro do núcleo. Testes de ciclo do Vigia, folga, zona morta, esconderijos (espaçamento e que nunca formam fila), escuridão (aceleração por distância e por tempo parado) e de que a mesma seed gera sempre a mesma corrida.
- **O servidor refaz a partida.** O jogo manda só os **movimentos** (instante e direção do analógico, em valores inteiros de -100 a 100, e só quando mudam). O servidor roda a mesma simulação, confere que a velocidade nunca passa do limite e calcula metros e a morte. O cliente nunca diz "andei X metros".
- **Seed e mapa:** a sessão (`/games/sinal/session`) devolve a seed e o servidor a assina, como no Eco Hero. O mapa (cenário, boneco e Vigia) sai da seed e não afeta a lógica.
- **Nota guardada** em décimos de metro, no campo de 16 bits (teto 3276,7 m); mostrada em metros inteiros. Modo guardado no servidor: `sinal-classico`. Ranking por modo; um único quadro para os 3 mapas.
- **Tela:** Canvas 2D (desenho profissional, partículas e a escuridão animada), com os elementos desenhados em código (nenhuma dependência nova). As regras de animação do projeto valem para o resto da interface; respeita movimento reduzido nos efeitos extras.
- **Som:** Web Audio (receitas na skill `sfx`): zumbido do aviso que sobe de tom, passos, o "te viu" e a escuridão.
- **Offline:** joga, mas sem sessão do servidor a partida não é salva (como o Eco Hero).
- **Depois do jogo no navegador:** testar em tempo real **com a janela à vista** (o navegador de teste não anima escondido).

## Fora desta versão
- **Online:** todos no mesmo mapa ao mesmo tempo, com física (os bonecos não se atravessam e, ao encostar, o outro é empurrado na direção do encontro). Exigirá servidor autoritativo em sala (Colyseus). A simulação determinística de agora já nasce pensando nisso.
- **Outros modos** (cada um com ranking próprio) e **Daily**.

## Design (próxima etapa, depois de o Lucas aprovar a lógica já aprovada acima)
Três mapas com **cenário, boneco e Vigia** diferentes, mesma dinâmica; aparência profissional e coerente com o Pop Brutal do app. O que falta definir: temas dos mapas, desenho do boneco e do Vigia, paleta de cada um, e o desenho dos esconderijos de cada mapa.

## Plano (em ordem)
1. Núcleo puro e testes (`packages/games`).
2. Tela de jogo no Canvas, controles do celular e do computador (sem servidor), com um mapa provisório.
3. Aviso (visual e sonoro) e a escuridão animada.
4. Os 3 mapas, o boneco e o Vigia (design final).
5. Servidor: sessão, `scoreSinalMatch`, ranking, histórico e recordes.
6. Calibrar jogando.
7. Depois: online e outros modos.
