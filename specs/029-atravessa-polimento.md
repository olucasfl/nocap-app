# 029 · Atravessa!: polimento, mais perigos e marcos

Status: **implementada (14/10/2026); falta jogar e calibrar** (velocidades, ambulância, sinal, varridas e o som, que não consegui ouvir daqui). Pedido do Lucas depois de jogar a [spec 028](028-atravessa.md): "tá muito legal, só precisamos de uma polida maior". Continua valendo: um personagem só, sem itens e sem poderes.

## Ajustes pedidos

- **Som do pulo:** sai a nota que sobe a cada pulo; o "pop" do pulo fica **mais alto e nítido**.
- **Trechos variados e balanceados** (por tipo de faixa, o tamanho do trecho tem pesos):
  - **Trilho:** quase sempre 1 ou 2 seguidos (~45% e ~35%); 3 (~12%), 4 (~5%) e 5 (~3%) vêm, mas raros.
  - **Estrada:** 1 a 6 seguidas, as curtas mais comuns. **Rio:** 1 a 5, as curtas mais comuns. **Descanso:** 1 a 3.
  - A partida pode **começar já com água ou estrada** (só a linha 0 é sempre grama livre).
- **Velocidade por veículo, não por faixa:** na mesma faixa pode vir um rápido e, logo depois, um lento. Vale também para toras, tartarugas e crocodilos. Os veículos **nunca se atravessam**: quando um rápido vem atrás de um lento, o vão mínimo é calculado para ele não alcançá-lo antes de sair da tela.
- **Mais modelos** (o tipo depende da velocidade): lentos (trator, caminhão baú, betoneira, ônibus), médios (carro, táxi, perua, picape, scooter), rápidos (esportivo, moto, drone na noite) e a **ambulância** (muito rápida e rara).
- **Trem:** bem mais rápido (28 a 44 casas/s) e com aviso um pouco mais curto nos trechos difíceis (de 1,2 s para 0,85 s). Continua com luz e sino.
- **Morte:** animação própria e mais caprichada para cada causa (atropelado é arremessado e rola, trem lança longe, água espirra, escuridão engole, mordida, varrida), com partículas de blocos e um tremor curto da câmera (sem tremor com `prefers-reduced-motion`).

## Perigos novos (aprovados)

- **Ambulância:** muito rápida, com sirene e luzes. **Ignora o sinal.** A sirene soa antes de ela entrar na tela, mais alta quanto mais perto, para dar tempo de olhar.
- **Sinal de trânsito:** **removido em 14/10/2026** a pedido do Lucas ("os semáforos não estão funcionando"). O código e os testes saíram; a ambulância continua, agora só com sirene e luzes.
- **Crocodilo:** algumas toras têm um crocodilo. A cabeça (ponta da frente) abre a boca em ciclos de 3 s, com um aviso de 0,5 s antes (a boca estremece e mostra os dentes). Em cima da cabeça com a boca aberta, morre (mordido).
- **Tartarugas:** faixas de grupos de tartarugas que **mergulham** em ciclo de 5 s (aviso: o casco se inclina e sobem bolhas por 0,67 s; depois ficam 1 s sob a água). Em cima de uma tartaruga que mergulhou, o herói afunda. Convivem com as faixas de pedras paradas (e as pedras que afundam). Visual bem feito.
- **Varridas de aviso** (sem camping; refeitas em 14/10/2026 a pedido do Lucas): se o herói ficar **parado numa faixa de descanso por mais de 3 s** (depois da linha 20), um perigo **desce pela coluna dele, de frente**. O aviso é limpo: uma **linha fina vermelha** desce pela coluna, um **"!" vermelho desliza por ela e para onde o herói está (ou estava)**, e um anel no chão desse lugar pulsa; tudo por 1,4 s. Depois o perigo desce pela mesma linha (rolando ou girando conforme o tipo). **Escapa quem pula para o lado** (ir para a frente não adianta: é a mesma coluna). Barril (horta), bola de feno que quica ou redemoinho (deserto) e laser (noite). Só um por vez, com 5 s de pausa.

## Faixa do recorde e marcos

- **Faixa do recorde:** na linha do seu recorde (o do servidor ou, sem conta, o deste aparelho), aparece uma faixa de chegada **só nas duas bordas da pista** (o meio fica livre: dá para ver a água, a estrada e tudo que passa; ajustado em 14/10/2026), com postes, bandeirinhas e a placa "SEU RECORDE". Ao **passar dela**, toca um som curto de recorde batido e aparece um aviso discreto "NOVO RECORDE". Sem recorde ainda, não há faixa.
- **Marcos:** a cada **50 linhas** até a 500 e depois a cada **100** (600, 700...), um arco discreto atravessa a pista com o número e, ao cruzar, toca um som suave e aparece um aviso pequeno na tela (nada extravagante nem enjoativo).

## Desempenho e ritmo (pedido do Lucas em 14/10/2026, depois de jogar)

- **Travava no celular e no PC.** Medição no navegador (script em `apps/web/scripts/atravessa-bench.js`): a cena tinha ~1.160 malhas e 245 chamadas de desenho por quadro (cada caixa era uma malha). Agora **cada modelo e cada faixa viram 1 a 3 malhas** (cor nos vértices, `bakeInto` em `models.ts`; geometria compartilhada por tipo e cor de veículo; peças animadas ficam soltas), **~270 malhas e ~115 chamadas**, e o custo de CPU por quadro caiu de ~6,5 a 7,5 ms para ~3,7 a 4,8 ms. Também: pixel ratio limitado a 1,5, sombra de 24 casas, faixas longe da câmera não atualizam, materiais que piscam são criados uma vez, geometrias por cópia são descartadas, varredura de som a cada 2 quadros e **qualidade automática** (se os quadros passam de ~28 ms por 1 s, corta as sombras e depois a resolução).
- **Ritmo maior:** veículos 1,3 a 8,8 casas/s (antes 0,9 a 6,6), toras e tartarugas 0,9 a 2,6, pulo de 10 ticks (antes 12) e escuridão mais ligeira (0,85 linha/s no começo).
- **Som dos carros passando:** um "vush" curto quando um veículo cruza a coluna do herói nas faixas ao lado (até ~3 linhas). Rápido soa mais curto e agudo, caminhão e ônibus soam graves, moto e scooter zumbem; no máximo um som a cada 140 ms e baixo, para não poluir.

## Ritmo (14/10/2026)

- Veículos: lentos 2 a 3,2 casas/s, médios 3,6 a 5,5, rápidos 6,5 a 9,5, ambulância 11 a 15 e o **carro de corrida (esportivo) 24 a 38**, quase na velocidade do trem (raro, com aviso de motor acelerando antes de entrar na tela). Toras e tartarugas 1,7 a 4. O vão entre veículos cresce com a velocidade (janela de ~0,3 s para atravessar).

## O herói (14/10/2026)

- **Raposa de boné** (o Lucas escolheu entre capivara, sapo, pinguim, robô e raposa melhorada; ficou a raposa): pelo laranja com costas mais fortes, peito, bochechas e barriga brancos, patas com "meias" escuras, focinho fino e nariz preto, **orelhas pontudas que saem por buracos do boné azul** (listra branca, botão, aba curva, emblema com "!" e fivelinha atrás) e **cauda grande com ponta branca** que sobe atrás: é o que mais se vê de costas. Fica virada um pouco para a câmera (três quartos, `HERO_LOOK`) para o rosto e o boné aparecerem, e 20% maior que uma casa para se ler no cenário. O cartão do Hub usa a mesma raposa.

## Regras de cuidado

- Tudo continua determinístico: o servidor refaz a partida pela seed e pelos passos (inclusive o tráfego por veículo, o sinal, as varridas e os mergulhos), e o ranking só muda de forma.
- O trem, as varridas e o crocodilo **sempre avisam** antes; nada mata sem sinal prévio.
- Os veículos de uma faixa nunca se sobrepõem e sempre existe vão para passar; o robô de teste confere que há caminho.

## Fora do escopo

Quarto bioma (gelo), fantasma do recorde, moedas, relâmpago e postes da noite, hora do rush, drones com raio, trem parado como ponte (ideias para depois).
