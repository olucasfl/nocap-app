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

## 3. Limites aceitos nesta fase

- Troca de time e entrada de espectador no meio da partida só no modo servidor (no ponto a ponto, o menu avisa).
- O líder precisa deixar a aba da partida em primeiro plano (aba em segundo plano é desacelerada pelo navegador).
- Rede com NAT estrito cai no modo servidor (sem TURN para não gastar dinheiro).

## 4. Testes

- `match.test.ts` (núcleo), testes do motor da sala e de integração (modo servidor continua igual), teste do protocolo de sinalização e e2e com dois navegadores reais em WebRTC local.
