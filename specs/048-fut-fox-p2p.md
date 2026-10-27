# Spec 048: Fut Fox online ponto a ponto (o aparelho do líder simula a partida)

Pedido do Lucas em 26/10/2026. Status: **implementada (26/10/2026); falta validar em aparelhos reais.** Escolha do Lucas: "P2P com o líder como servidor", sem pagar nada.

## 1. Por que

O online do Fut Fox trava mesmo com internet boa e cabeada. A causa mais provável é a hospedagem: o servidor roda no plano grátis do Render (CPU pequena e compartilhada, região nos EUA ou na Europa, ida e volta de 120 a 200 ms para João Pessoa). O offline é perfeito porque a simulação roda no próprio aparelho. Os amigos jogam todos em João Pessoa, então o líder pode ser o servidor: ida e volta de cidade para cidade (cerca de 10 a 40 ms), custo zero.

## 2. Como funciona

- O **lobby continua no Colyseus** (times, formato, bots, chat, convites, tela final). Nada muda ali.
- **Quem simula:** o aparelho do líder roda a partida (`BolaMatch`, em `packages/games/src/bola/match.ts`, a mesma classe que o servidor usa) e manda o fluxo `bs` aos outros por **WebRTC** (canal de dados sem ordem nem retransmissão, como UDP; o estado novo sempre vale mais que o perdido). A entrada de cada pessoa (`bin`) volta ao líder pelo mesmo caminho.
- **O líder também joga** pelo mesmo caminho dos outros, com um canal local (sem rede): o cliente é um só.
- **Sinalização:** mensagens `rtc` pelo Colyseus (o servidor só repassa). STUN do Google (grátis). Sem TURN.
- **Reserva automática:** ao apertar Começar, o servidor abre uma janela de conexão (até 6 s). Se todos os aparelhos conectarem ao líder, a partida roda **ponto a ponto**; se alguém não conseguir (rede com NAT estrito), a partida roda **no servidor**, como hoje. Ninguém fica de fora.
- **Eventos no canal sem garantia:** cada evento tem número (`n`) e vai repetido nos quadros seguintes por 0,5 s; o aparelho descarta os já vistos.
- **Fim:** o líder manda o resultado (`bres`) ao servidor, que mostra a tela final. Se o líder sair no meio, a partida termina e a sala volta ao lobby.
- **Sem ranking** (já era regra). Por isso confiar no líder não abre trapaça que valha.

- **Thread própria:** a partida do líder roda num Worker (`bola-host.worker.ts`), então a simulação não espera a tela desenhar. O atraso de desenho dos outros aparelhos se adapta ao intervalo medido entre quadros (mínimo de 45 ms ponto a ponto e 25 ms no líder; 100 ms pelo servidor). Até 4 aparelhos recebem o estado a 60/s; com mais gente, 30/s.

## 3. Limites aceitos nesta fase

- Troca de time e entrada de espectador no meio da partida só no modo servidor (no ponto a ponto, o menu avisa).
- O líder precisa deixar a aba da partida em primeiro plano (aba em segundo plano é desacelerada pelo navegador).
- Rede com NAT estrito cai no modo servidor (sem TURN para não gastar dinheiro).

## 4. Testes

- `match.test.ts` (núcleo), testes do motor da sala e de integração (modo servidor continua igual), teste do protocolo de sinalização e e2e com dois navegadores reais em WebRTC local.

## Bola local contínua e medição (26/10/2026)

O desenho online saiu de `BolaPlay.tsx` para `apps/web/src/lib/bola-netsync.ts` (`BolaNetSync`), o mesmo código no jogo e na simulação `bola-netsync.sim.test.ts` (líder real com `BolaMatch`, rede virtual com atraso/variação/perda, 5 sementes x 120 s por perfil).

Medido (saltos = bola que anda mais do que a velocidade desenhada explica, por minuto):

| rede | modelo antigo (>0,4 m / >1 m) | bola local (>0,4 m / >1 m) | erro médio vs líder |
|---|---|---|---|
| LAN | 1,9 / 0 | 3,7 / 0 | 0,83 -> 0,33 m |
| Wi-Fi bom | 1,8 / 0,2 | 3,3 / 0 | 1,13 -> 0,39 m |
| internet boa | 6,7 / 0,7 | 9,5 / 0 | 1,65 -> 0,42 m |
| internet ruim | 19,4 / 5,7 (até 22 m) | 13 / 0,2 (até 2,5 m) | 2,28 -> 0,53 m |

Modelo novo: a bola anda sempre numa física própria (todas as raposas como desenhadas) e é puxada, com velocidade limitada, para onde o líder diz que ela está agora (estado + tempo desde a chegada + metade do RTT, andado pela mesma física). Depois de um toque próprio a correção quase para por 0,35 s. O teste falha se a bola local passar de 1 salto grande por minuto em qualquer perfil.

## Troca de time no meio da partida ponto a ponto (26/10/2026)

O pedido (`bteam`) vai ao servidor, que valida o básico e o repassa ao líder (`bswitch`). O aparelho do líder aplica na partida dele (`BolaMatch.switchTeam`, no worker), manda a lista nova a todos (canal `ctl`) e responde ao servidor (`bswitched`); o servidor só então atualiza os times da sala. Erro (time cheio, bot que já saiu) volta como aviso a quem pediu. Enquanto a partida ainda conecta, o pedido é recusado.

Também: o quadro do fluxo passa a levar o vencedor (`wn`), senão o aparelho online mostrava sempre "Empate" no fim (placar com Azul na frente e "Empate" na tela). E o resultado do líder aceita placar negativo (regra de 3 ou 4 times): antes o servidor o recusava e a partida não fechava.

## Voltou para o servidor (27/10/2026)

Decisão do Lucas: o líder ficava liso e os outros travavam. O servidor volta a simular a partida e todos recebem o mesmo estado; o ponto a ponto fica **desligado** (`FUT_FOX_P2P=1` religa; o código e os testes continuam). O atraso mínimo de desenho no servidor caiu de 100 para 70 ms (sobe sozinho quando a rede oscila) e a hora de desenho passou a ser estimada pelo caminho "limpo" da rede (menor atraso medido) em vez da última chegada, para rajadas do TCP não puxarem o relógio.
