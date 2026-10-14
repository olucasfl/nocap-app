# 025 · Block Towers: câmera final e modos online

Status: **etapa 1 (câmera final no modo solo) implementada; os modos online estão só registrados aqui, ainda sem código.** Decisões do Lucas (14/10/2026). Complementa a [spec 022](022-block-towers.md).

## Etapa 1: câmera do final (feita)

- Quando a partida acaba, a câmera **se afasta e desce**, mostrando a torre inteira de baixo até o topo, com uma bandeirinha no ponto mais alto ("N PEÇAS"). Só depois aparece a tela de resultado.
- **Só mexe se faz sentido**: se a torre ainda é baixa e já cabe na tela, nada se afasta nem desce (`finaleMoves` em `towers/draw.ts`).
- Vale para o modo 3 vidas (único que existe) e vai valer para os novos. Duração: 3,2 s (`FINALE_SECONDS`).

## Online: regras decididas

Todos os modos novos são **só online**. O modo solo continua como está (só ganha a câmera final).

- **Sala de 2 a 4 pessoas**, mesma seed e mesmas peças para todos. **Todas as torres na mesma tela**: a sua grande, as outras em faixas estreitas ao lado, todas com a altura marcada em relação à linha de chegada.
- **Magias**: vêm **aleatórias** e a pessoa **escolhe em quem** usar. As ruins atrapalham o alvo; as boas valem para si.
- **Quem cai no meio da partida pode voltar** a jogar; se não der, **fica espectando** sem problema. **Altura igual é empate.**
- **Ranking: online nunca entra. Só o histórico** (regra do projeto: sala não entra no ranking).

### Corrida

- **Linha de chegada fixa** lá em cima. Vence quem chegar primeiro (segundo, terceiro...). Sem vidas.
- **Limite de 8 minutos**: passou disso, a partida **para e vence quem estiver mais alto**.
- Final online: anima **QUEM GANHOU**; depois a câmera se afasta e desce mostrando as **torres de todos**; só depois aparece a classificação.

### Petrificar

- **Linha-limite fixa**. Se a torre encostar nela começa um relógio de 3 s; se ainda estiver encostando no fim, a torre **vira pedra** e conta as peças empilhadas.
- Mesmo final da Corrida (quem ganhou, câmera descendo por todas as torres, depois a classificação).
- Pontos a confirmar na hora de implementar: o que significa "voltar" depois de cair (proposta: a torre recomeça do zero e a pessoa segue na partida) e se o Petrificar também tem os 8 minutos.

## Como sincronizar (decisão técnica proposta)

- Cada aparelho **simula só a própria torre** (a física é determinística e pesada; não se roda a das outras).
- O aparelho manda a posição e o ângulo dos corpos umas **10 vezes por segundo** (~500 bytes; corpos parados não precisam ir). Os outros desenham essas torres suavizadas. Custo de rede estimado: ~5 KB/s para cima e ~15 KB/s para baixo por pessoa.
- O servidor da sala só **repassa** os dados e entrega as magias ao alvo; não calcula física. Consequência: ele não confere cada torre peça por peça (aceitável em sala de amigos, sem ranking).
- O histórico guarda quem jogou, a posição e a altura de cada um.

## Fora desta etapa

Todo o online (salas, sincronização, magias contra rivais, Corrida, Petrificar, histórico de sala). Também o Petrificar solo, caso se queira offline depois.
