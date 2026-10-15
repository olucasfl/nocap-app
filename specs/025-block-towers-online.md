# 025 · Block Towers: câmera final e modos online

Status: **etapa 1 (câmera final no modo solo) implementada. Online: regras, magias (4), anti-trapaça e custo de CPU medidos e decididos (15/10/2026); falta construir (ver "Etapas de construção" no fim).** Decisões do Lucas (14/10/2026). Complementa a [spec 022](022-block-towers.md).

## Etapa 1: câmera do final (feita)

- Quando a partida acaba, a câmera **se afasta um pouco** (a casa fica com 72% do tamanho) e **desce do topo da torre até a base**, passando por ela inteira, com uma bandeirinha no ponto mais alto ("N PEÇAS"). Só depois aparece a tela de resultado.
- **Só mexe se faz sentido**: se a torre ainda é baixa e já cabe na tela, nada se afasta nem desce (`finaleMoves` em `towers/draw.ts`).
- Vale para o modo 3 vidas (único que existe) e vai valer para os novos. Duração: 4,6 s (`FINALE_SECONDS`).

## Online: regras decididas

Todos os modos novos são **só online**. O modo solo continua como está (só ganha a câmera final).

- **Sala de 2 a 4 pessoas**, mesma seed e mesmas peças para todos. **Todas as torres na mesma tela**: a sua grande, as outras em faixas estreitas ao lado, todas com a altura marcada em relação à linha de chegada.
- **Magias online (decisão de 15/10/2026): só 4.**
  - **Boas** (vale para a peça atual, é só tocar no botão): **Vinha** (a peça gruda em tudo que encostar) e **Pedra** (o Cimento: a peça vira pedra e fica imóvel).
  - **Ruins** (a pessoa toca no botão e aparecem os **nomes da galera** para escolher em quem usar): **Rápida** (as próximas 3 peças do alvo descem o dobro da velocidade) e **Peça grande** (a próxima peça do alvo vem bem maior e mais pesada).
  - Continuam vindo **aleatórias**. As outras magias do solo (Desfazer, Vida extra, Gelo, Névoa, Gira sozinha, Sem giro) ficam só no solo.
- **Quem cai (a conexão cai) pode voltar de onde parou** (decisão de 15/10/2026): enquanto está fora **param de vir peças** para ele e os outros veem **nitidamente** "CAIU DA PARTIDA" sobre a torre dele. Ao voltar, o aparelho reconstrói a torre pelo registro que o servidor guarda (a física é determinística).
- **Não pode haver trapaça** (decisão de 15/10/2026): **o servidor refaz a física de cada torre** a partir das teclas e do instante de cada uma (como já faz no solo), e dele saem a altura, quem caiu e quem ganhou. As torres dos outros que cada um vê vêm da simulação do servidor, nunca de dados enviados pelo aparelho. As magias ruins viram eventos do servidor, aplicados no mesmo instante nas duas pontas, e o servidor confere se a pessoa tinha a magia. Isso **substitui** a ideia anterior de só repassar os dados. O custo é CPU (física de até 4 torres no servidor): **medir antes de construir**.
- **Quem cai no meio da partida pode voltar** a jogar; se não der, **fica espectando** sem problema. **Altura igual é empate.**
- **Ranking: online nunca entra. Só o histórico** (regra do projeto: sala não entra no ranking).

### Corrida

- **Linha de chegada fixa** lá em cima. Vence quem chegar primeiro (segundo, terceiro...). Sem vidas.
- **Limite de 8 minutos**: passou disso, a partida **para e vence quem estiver mais alto**.
- Final online: anima **QUEM GANHOU**; depois a câmera se afasta e desce mostrando as **torres de todos**; só depois aparece a classificação.

### Petrificar

- **Linha-limite fixa**. Se a torre encostar nela começa um relógio de 3 s; se ainda estiver encostando no fim, a torre **vira pedra** e conta as peças empilhadas.
- Mesmo final da Corrida (quem ganhou, câmera descendo por todas as torres, depois a classificação).
- **Decidido (14/10/2026):** "voltar" depois de cair = a torre **recomeça do zero** e a pessoa segue na partida; quando a torre de alguém vira pedra, a rodada acaba **só para essa pessoa** e vence quem tiver mais peças no fim; o Petrificar **também tem o limite de 8 minutos**.

## Como sincronizar (proposta antiga: SUBSTITUÍDA pela decisão "não pode haver trapaça" acima)

- Cada aparelho **simula só a própria torre** (a física é determinística e pesada; não se roda a das outras).
- O aparelho manda a posição e o ângulo dos corpos umas **10 vezes por segundo** (~500 bytes; corpos parados não precisam ir). Os outros desenham essas torres suavizadas. Custo de rede estimado: ~5 KB/s para cima e ~15 KB/s para baixo por pessoa.
- O servidor da sala só **repassa** os dados e entrega as magias ao alvo; não calcula física. Consequência: ele não confere cada torre peça por peça (aceitável em sala de amigos, sem ranking).
- O histórico guarda quem jogou, a posição e a altura de cada um.

## Fora desta etapa

Todo o online (salas, sincronização, magias contra rivais, Corrida, Petrificar, histórico de sala). Também o Petrificar solo, caso se queira offline depois.

## Medição do custo da física no servidor (15/10/2026)

Medi o `TowersGame` (o mesmo motor que o servidor usa para refazer partidas) em passo fixo de 1/60 s: 8 partidas simuladas de ~11 minutos, 336 mil passos, com um jogador de teste aleatório (as torres ficaram baixas; vidas desligadas para a partida não acabar). Nesta máquina de desenvolvimento:

| Peças na torre | Custo médio por passo |
| --- | --- |
| 0 a 10 | 0,22 ms |
| 11 a 20 | 0,42 ms |
| 21 a 35 | 0,88 ms |

Percentis de todos os passos: p50 0,20 ms · p90 0,54 ms · p99 1,7 ms · p99,9 5,7 ms · p99,99 28 ms. Só 696 de 336 mil passos (0,2%) passaram de 4 ms, com raros picos de 30 a 110 ms (provavelmente coleta de lixo e desmoronamentos grandes).

**O que isso quer dizer**
- O custo cresce **mais ou menos linearmente com o tamanho da torre**. Torres de 20 peças custam ~0,4 ms por passo; extrapolando, uma de 50 peças custaria ~1,5 a 2 ms (**não medi acima de 35**: o jogador de teste não empilha).
- 4 torres de 20 peças a 60 passos por segundo ≈ 100 ms de CPU por segundo, ou **~10% de um núcleo desta máquina**. Com torres de 50 peças, ~40 a 50%.
- **A máquina de produção é bem mais lenta** que a de desenvolvimento (e o plano gratuito divide a CPU com a API inteira), então esse número não pode ser tomado como folga. Um pico de 100 ms **trava todas as salas por esse tempo** se rodar na mesma fila do servidor.

**Conclusão: simular as 4 torres em tempo real, no mesmo processo, é arriscado. O desenho abaixo tira esse risco.**

## Desenho para o servidor aguentar (decisão proposta, 15/10/2026)

1. **A verificação não precisa ser em tempo real.** O resultado de cada torre depende só da seed e das teclas com o instante delas (passo fixo, sem relógio). Por isso o servidor pode **refazer cada torre atrasado** (alguns segundos) e em **fatias curtas** (por exemplo, no máximo ~4 ms de física por volta do servidor, devolvendo o controle entre elas), sem mudar nenhum resultado: "quem chegou primeiro à linha" é decidido pelo **passo da simulação**, não pela hora em que o servidor percebeu.
2. **O que cada um vê das torres dos outros** vem do aparelho de cada um (mais rápido e barato) e é **corrigido pelo servidor** quando a verificação atrasada discorda: o aparelho que mostrar algo que o servidor não reproduz é **desclassificado da partida** ("TRAPAÇA") e a torre dele passa a ser desenhada pela simulação do servidor. Resultados, magias e vencedor **só valem pelo que o servidor refez**. Assim ninguém ganha trapaceando; no máximo mostra, por poucos segundos, uma torre falsa antes de ser pego.
3. **Se mesmo assim a CPU apertar**, o servidor roda a física numa **thread à parte** (`worker_threads`), longe da fila da API e das outras salas, e a sala fica limitada a 4 pessoas (já é).
4. **Voltar de onde parou:** o servidor guarda o registro de teclas de cada torre; ao reconectar o aparelho recebe o registro e reconstrói a torre sozinho (física determinística). Enquanto a pessoa está fora, a simulação dela **não avança** (não vêm peças) e a torre aparece com "CAIU DA PARTIDA".
5. **Magias ruins** (Rápida e Peça grande) viram **eventos do servidor** com um passo futuro marcado (por exemplo, 0,5 s à frente), entregues ao alvo e registrados no log dele, para a simulação do servidor e a do aparelho aplicarem no mesmo passo. O servidor confere que quem usou tinha a magia (as magias saem da seed e do número de peças soltas, então ele sabe).

## Etapas de construção

1. **Núcleo e servidor sem magias:** sala de 2 a 4, mesma seed, Corrida com chegada fixa e limite de 8 min, verificação atrasada e em fatias, resultado e histórico de sala. Testes com trapaça simulada (registro adulterado deve ser pego).
2. **Tela:** a sua torre grande e as outras em faixas com a altura, aviso "CAIU DA PARTIDA", voltar de onde parou, final com a câmera descendo por todas as torres.
3. **Magias:** Vinha e Pedra (boas, na peça atual) e Rápida e Peça grande (ruins, com a escolha do alvo pelos nomes da sala), com o evento marcado no servidor.
4. **Petrificar:** linha-limite e relógio de 3 s.
5. **Calibrar jogando com amigos** e medir a CPU na produção (ver a seção de medição acima).
