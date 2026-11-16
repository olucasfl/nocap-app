# 083 Night Hunt

Status: **fase 2 implementada** (15/11/2026). Protótipo de design original: `docs/reference/night-hunt-prototype.html`.

## 1. Objetivo

Jogo de sobrevivência em arena no estilo Vampire Survivors, construído sobre o **Slash The Hordes** (decisão do Lucas): mesma arte, animações, sons, música, regras de dano, vida, XP, hordas e chefes. O jogador só anda; a espada e as demais armas atacam sozinhas; sobe de nível, escolhe uma entre 3 (ou 4) melhorias, abre baús de chefe e tenta durar o máximo. Celular e PC, retrato (tela lógica de 510×680 como no Slash).

## 2. O que existe

- **5 heróis** (Kael, Mara, Brann, Ysolde, Rurik): o guerreiro do Slash com outro matiz de cor, cada um com arma inicial e números próprios. Kael é de graça; os outros se compram com ouro (150, 300, 500, 800).
- **3 mapas**: Campo Verde (o do Slash), Deserto Seco (inimigos 10% mais rápidos, 30% mais ouro; libera com 5 min sobrevividos) e Planície Gelada (inimigos com 25% mais vida, 20% mais XP; libera com 10 min). A decoração do chão muda de matiz por mapa.
- **15 melhorias de partida** (as 6 do Slash + 9 novas), com descrição em pt-BR e o que muda a cada nível:
  - Armas: Lâmina Longa e Lâmina Afiada (a espada, 1 espaço), Adagas Voadoras, Tiro Arcano, Nova Ígnea (todas do Slash), **Machado Giratório** (sobe em arco e cai atravessando), **Orbes Guardiões** (orbitam o herói), **Raio Lunar** (cai sobre inimigos da tela).
  - Passivos: Regeneração (Slash), **Armadura** (-1 de dano recebido por nível), **Botas de Caçador** (+8% de velocidade), **Pedra Atrativa** (puxa itens ao alcance), **Amuleto Vital** (+20% de vida), **Trevo da Lua** (10% por nível de uma 4ª opção), **Diário de Caça** (-8% de recarga).
  - Espaços como no Vampire Survivors: no máximo 6 armas (a espada conta como uma) e 6 passivos.
- **7 evoluções** (arma no máximo + passivo certo + abrir um baú): Adagas Fantasma, Arcano Total, Supernova, Machado Titã, Eclipse, Tempestade e Lâmina Real. O baú de chefe dá a evolução quando ela está disponível; senão, uma melhoria garantida (como no Slash). No Night Hunt os chefes soltam baú com mais frequência (sem isso a evolução nunca apareceria; o resto da tabela do Slash não mudou).
- **Reroll, Pular e Banir** na janela de nível (R, X e B no teclado): 1 de cada por partida, e as melhorias permanentes Reroll, Pular e Banir somam usos. Pular rende 5 de ouro; banir tira o item até o fim da partida.
- **Melhorias permanentes com ouro**: as 6 do Slash + Reroll, Pular e Banir.
- **51 conquistas** (progresso, prêmio em ouro, notificação ao liberar).
- **Conta**: o save (ouro, melhorias, heróis comprados, conquistas, recordes, opções) vai para `user_prefs` em `/me/prefs/nighthunt`, **sem migração de banco**. O aparelho manda o save inteiro com um contador `rev`; o servidor só aceita se o `rev` não for mais velho que o da conta. Sem conta, vale no aparelho (`localStorage`).
- **Telas** (todas em canvas, arte do Slash): menu, heróis, mapas, partida (HUD com armas e passivos), nível (3 ou 4 cartas, reroll/pular/banir), baú e evolução, pausa, opções de som, resultado (contagem de ouro, itens e evoluções da partida, conquistas liberadas), melhorias, itens (coleção com armas, passivos, evoluções e itens do chão) e conquistas. Transições de tela por fade, janelas que abrem com animação, morte com animação e vinheta.

## 3. Regras portadas do Slash (`packages/games/src/nighthunt`)

Passo fixo de 1/60 s e semente por partida (o Slash usa tempo variável). Jogador: vida 50, velocidade 100, XP `10, 20, 30 … 220` (18 níveis), espada a cada 2 s com a curva de rotação do original, dano de contato no início do contato e a cada 0,5 s, ímã de 6 s. Inimigos, chefes, geradores individual, circular e de onda e atiradores: as tabelas completas do Slash (`settings.ts`). Diferenças deliberadas:
- Coletor de ouro vale (no Slash era calculado e nunca usado).
- Chefes soltam baú com mais frequência (evoluções).
- Heróis, mapas, armas e passivos novos, evoluções e reroll/pular/banir (Vampire Survivors).

## 4. Arte

Tudo do Slash (`tools/art/nighthunt/extract.py` gera o atlas) mais arte nova no mesmo estilo, gerada ao carregar (`extra-art.ts`): variações de matiz do guerreiro por herói (a pele é preservada) e da decoração do chão por mapa, ícones novos com contorno escuro (raio, armadura, ímã, trevo, diário, reroll, pular, banir), orbes azuis, moldura dourada com estrela nas evoluções. Capa do Hub: recorte do atlas (herói, orc, morcegos, sol e horda do menu). Licença do material do Slash **não confirmada**: ver `docs/ASSETS-NIGHTHUNT.md`.

## 5. Robô e simulador

`packages/games/src/nighthunt/bot.ts` joga uma partida sozinho (foge, recolhe itens, foca no que já tem, evolui no baú, usa reroll e banir). `pnpm --filter @nocap/games sim` roda `nighthunt.sim.ts` e imprime tempo mediano, nível, abates, evoluções e melhorias mais usadas por herói e mapa (NH_RUNS, NH_SECONDS, NH_HEROES, NH_MAPS). Usado para calibrar os heróis; resultados na seção 7.

## 6. Testes

- `nighthunt.test.ts`: 28 testes de motor (determinismo, espada, hordas, níveis, armas novas, passivos, evoluções, reroll/pular/banir, heróis, mapas, conquistas, compra).
- `apps/api/src/prefs/prefs.test.ts`: validação do save do Night Hunt e regra do `rev`.
- `apps/web/e2e/nighthunt.spec.ts`: telas pelo canvas (fluxo menu a partida, pausa, nível, baú de evolução, morte e resultado, compra de herói, telas de lista) em celular em pé, paisagem e computador.

## 7. Calibração com o robô

Robô, mapa Campo Verde, 5 partidas por herói, limite de 12 min (15/11/2026, depois dos ajustes de Kael, Mara e Brann):

| herói | tempo mediano | nível médio | abates | morreu antes dos 12 min |
|---|---|---|---|---|
| Kael | 3:50 | 3,8 | 139 | 5/5 |
| Mara | 4:43 | 5,0 | 270 | 5/5 |
| Brann | 10:11 | 10,0 | 953 | 5/5 |
| Ysolde | 11:59 | 16,0 | 1758 | 2/5 |
| Rurik | 10:14 | 14,0 | 1488 | 3/5 |

Leitura: **o equilíbrio ainda não está bom.** Quem começa com Orbes, Raio ou Machado aguenta o triplo de quem começa só com a espada (Kael) ou com Adagas (Mara). O robô é um jogador só, então isto é um indício, não uma sentença, mas o próximo ajuste é fortalecer Kael e Mara (ou enfraquecer o início de Brann, Ysolde e Rurik) e rodar de novo com mais partidas.

## 8. Pendências

1. **Licença da arte e do som do Slash** (ver `docs/ASSETS-NIGHTHUNT.md`): confirmar com a Y8.com e o autor, ou trocar, antes de publicar.
2. Ranking e Daily com validação no servidor (a simulação já é determinística; falta gravar as entradas e a rota).
3. Equilíbrio fino jogando (o robô é um jogador só) e desempenho em celular fraco com 300+ inimigos.
4. Sons próprios para as armas novas (hoje reaproveitam os do Slash).


## Objetos quebráveis do cenário (15/11/2026)

- Células de 420 px com 62% de chance de ter um objeto (hash da seed, sem usar o rng dos inimigos), nunca a menos de 130 px da partida; as células longe do jogador são descartadas e voltam a nascer, as quebradas não.
- 3 de vida. Espada, projéteis (sem gastar perfuração) e orbes guardiões quebram; o raio lunar não.
- Drops (rng próprio): 30% moedas, 32% coração (cura), 12% ímã, 26% cristais de XP. Os inimigos não soltam mais poção nem ímã (só XP, moedas e baú); essas duas coisas vêm só dos objetos.
- O ímã (dos objetos e dos inimigos) agora puxa todos os itens do mapa.
- Aparência por mapa, só visual: campo (lampião de ferro num poste), deserto (urna de argila com faixa dourada), gelo (cristal de gelo sobre uma rocha), pequenos como as tochas do Vampire Survivors e com aura suave, com cacos nas cores do mapa. Arte em `apps/web/src/games/nighthunt/extra-art.ts`.


## Rodada de ajustes de progressão (15/11/2026, pedido do Lucas)

- **Níveis sem teto:** `xpToNext(nível)` em `settings.ts`: os 18 primeiros valores são os do Slash; depois cresce por nível, com saltos nos níveis 20 e 40 (desenho do Vampire Survivors). O valor de cada cristal sobe com o tempo (`gemValue`), cristais verdes e vermelhos aparecem (5 e 20 de XP) e há teto de 400 itens no chão (os cristais mais antigos se fundem).
- **Hordas (`hordes.ts`):** fluxo contínuo por população mínima que sobe com o tempo (faixas de inimigos por minuto) mais eventos com pausa depois: enxame de morcegos (a cada 38 s), anel que se fecha (52 s), muralha que atravessa a tela (66 s), manada de corredores (84 s), goblin do tesouro (110 s), chefe grande a cada 150 s e o chefe final sem fim a partir dos 30 min. Chefes com `bossHp` = vida do Slash x (7 + tempo/45 s): o primeiro tem ~120 de vida e eles sobem junto com o tempo. Os inimigos nascem fora da câmera (o cliente informa a área visível por `setView`).
- **Câmera:** zoom 0,6 (mundo bem mais aberto, como o Vampire Survivors), subindo só em telas muito largas ou altas.
- **Armas x passivos:** 6 slots de armas (Espada, Adagas, Tiro Arcano, Nova Ígnea, Machado, Orbes, Raio Lunar; a Espada agora é uma arma com 6 níveis) e 6 de passivos. Passivos globais: Poder (+12% de dano de tudo por nível), Alcance (+10% de tamanho de espada, tiros, orbes e raios), Ligeireza (+10% de velocidade de projétil), Sabedoria (+8% XP), Ganância (+10% ouro), além de Armadura, Botas, Imã, Coração, Trevo, Diário e Regeneração. Evolução da Espada: Espada no máximo + Poder.
- **Economia:** custos da loja e dos heróis 15 vezes os do Slash (heróis: 600, 1500, 2500, 4000).
- **Mapas:** Deserto exige nível 10, 8 min e 3 chefes; Gelo exige nível 25, 15 min e 2 evoluções.

- **Mapas (15/11/2026):** o Campo Verde e o Deserto Seco (com as exigências de desbloqueio) estão no jogo; o Gelo fica guardado em `MAPS`/`MAP_INFO` (com as exigências de desbloqueio) fora de `MAP_IDS`.

## Monstros do Dungeon Crawl (15/11/2026)

15 monstros novos (arte CC0 do Dungeon Crawl Stone Soup, folha em `apps/web/public/nighthunt/dcss.png`, animados por código em `view.ts`), cada um com uma regra própria (`monsters.ts`) e nenhum no Campo Verde. Deserto (12): Vaga-lume (zigue-zague), Gosma Azul (divide em duas), Escorpião (carapaça: metade do dano de projétil), Naja (bote com aviso), Olho Sangrento (orbe mirado), Cão Infernal (matilha, enfurece com meia vida), Esqueleto Ceifador (arremessa foice), Verme Cerebral (drena 3 de XP), Grifo (mergulho), Ent Ancião (raízes: -40% de velocidade por perto), Dragão Rosa (3 orbes em leque), Dragão Dourado (chefe do mapa, anel de 12 orbes, sempre baú). Gelo, guardados (3): Lobo de Gelo (uivo acelera a matilha), Espectro (fica fantasma, sem sofrer nem causar dano), Golem de Cristal (8 estilhaços ao morrer). Licença da folha: ver `docs/ASSETS-NIGHTHUNT.md`.

## Reset geral (16/11/2026)

A pedido do Lucas, o progresso de todos foi zerado (recorde, mapas, heróis, itens, bestiário, conquistas, ouro, estatísticas). Feito por **geração do save** (`NH_EPOCH = 2` em `packages/games/src/nighthunt/rules.ts` e em `apps/api/src/prefs/prefs.controller.ts`), sem comando no banco: o aparelho descarta saves de outra geração; o servidor devolve `null` para o save antigo da conta, recusa (400) quem manda save sem geração (aparelho com versão velha aberta) e o substitui no primeiro save novo. Os dados antigos continuam nas linhas de `user_prefs` até cada conta salvar de novo (ficam invisíveis). Para apagar de verdade: `UPDATE user_prefs SET data = data - 'nh' WHERE data ? 'nh';` (só com autorização). Para zerar de novo, suba o número nos dois lugares.
