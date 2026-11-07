# 059: Counter Fox, modo Bomba (rounds, times, economia)

Pedido do Lucas (07/11/2026): um modo novo do Counter Fox no estilo do modo padrão do CS e do Valorant, no mapa Duna: rounds com tempo, um time contra o outro, nascem na base, o time TR planta a bomba, o CT para, compra só na base, dinheiro finito, vitória e derrota rendem dinheiro diferente, tudo configurável. Status: **em andamento** (07/11/2026): decisões do Lucas na seção 9; fase 1 (motor puro) feita e testada.

## 1. Como funciona no CS e no Valorant (pesquisa)

Fontes: guias de economia do CS2 ([csdb.gg](https://csdb.gg/economy-guide), [keengamer](https://www.keengamer.com/articles/guides/a-guide-to-how-the-cs2-economy-works-in-counter-strike-2)) e do Valorant ([mobalytics](https://mobalytics.gg/blog/valorant/ultimate-economy-guide/), [oneesports](https://www.oneesports.gg/valorant/valorant-economy-guide)). Números mudam entre versões; estes são o ponto de partida e viram configuração.

**Estrutura da partida (CS competitivo):** 2 times de 5, lado TR (ataca, planta) e CT (defende). 24 rounds: 12 de um lado, troca de lado no intervalo (metade), vence quem chega a 13. Todo mundo volta a ter US$ 800 e arma inicial na metade. Valorant: primeiro a 13, troca de lado depois de 12 rounds.

**Round:** tempo parado para comprar (CS 15 s, Valorant ~30 s), depois o round (CS 1:55; Valorant 1:40) com a bomba no TR. Quem morre fica de espectador até o fim do round (não renasce).
- **TR vence** se: mata todo mundo do CT, ou a bomba explode (plantada).
- **CT vence** se: mata todo mundo do TR com a bomba não plantada, desarma a bomba, ou o tempo acaba sem plantio.
- Bomba: plantar leva ~3,2 s parado (CS), explode em 40 s (CS) / 45 s (Valorant), desarmar leva 10 s (5 s com kit). Quem carrega a bomba a larga se morrer; qualquer TR pode pegar.

**Economia do CS (referência):**
| Item | Valor |
|---|---|
| Dinheiro inicial | US$ 800 (pistola inicial de graça) |
| Teto de dinheiro | US$ 16.000 |
| Vitória do round | US$ 3.250 por jogador (3.500 se a bomba explodiu/foi desarmada, conforme a fonte) |
| Derrota, 1ª seguida | US$ 1.400, +500 por derrota seguida até US$ 3.400 (zera quando o time vence) |
| Plantar e perder | +US$ 800 para cada TR (mais US$ 300 para quem plantou) |
| Abate | US$ 300 fuzil e pistola, 600 SMG, 900 escopeta, 100 sniper, 1.500 faca |
| Assistência | nada |
| Desarmar | +US$ 300 para quem desarmou |

Valorant (outro modelo, só referência): vitória 3.000, derrota 1.900 / 2.400 / 2.900, plantar +300, abate 200; quem sobrevive a um round perdido leva só 1.000 se o TR não plantou.

## 2. O que o Lucas pediu (resumo fiel)
- Modo padrão de partida com **rounds com tempo**; **time contra time**; **nascem na base**.
- **TR planta a bomba** (modelo de C4 feito por script, parecido com a C4 do CS); **CT para o TR**.
- **Dá para trocar de time**; **online**; **contra bots**.
- **Tem tempo** (do round e da compra); **só compra na base**.
- **Dinheiro finito**: começa pouco, só pistola no começo, colete se quiser, granadas etc.; **quem perde ganha menos dinheiro**.
- **Personalizável**: tempo por round e quantidade de rounds para ganhar.
- **Mapa Duna** (já tem as bases TR e CT e as bombas A e B em `FS_DUST_MARKS`).

## 3. Regras propostas para o nosso modo (tudo configurável na sala e no offline)
- **Times:** 5 contra 5 (até 5 por lado); lado TR (laranja) e CT (azul); vagas vazias viram bots (nível ajustável). Jogador troca de time no lobby e, entre rounds, só se o líder permitir.
- **Rounds:** vence quem chegar primeiro a N rounds (padrão 8, opções 4, 6, 8, 10, 13; "primeiro a N"); troca de lado depois de metade (N−1 rounds) com dinheiro zerado como no CS; limite de rounds por tempo opcional.
- **Tempos:** compra 15 s (10 a 30), round 1:55 (1:00 a 3:00), bomba 40 s, plantar 3,2 s, desarmar 10 s / 5 s com kit.
- **Nascer:** cada time nasce na sua base (spawns já existem no Duna); durante a compra todos ficam parados na base e **só ali** se compra (B abre a loja só dentro da zona da base e só no tempo de compra).
- **Dinheiro:** começa em US$ 800; pistola inicial grátis; teto US$ 16.000; prêmios conforme a tabela (editável: padrão igual ao CS). Quem perde recebe a bonificação por derrota seguida; quem planta ganha extra; abate rende por arma.
- **Bomba:** o TR sorteado carrega; plantar só em A ou B (marcas existentes), 3,2 s parado segurando a tecla; explode no fim do tempo; o CT desarma segurando a tecla ao lado. Sons e HUD (barra de plantio/desarme, contagem, ícone da bomba no mapa e no placar).
- **Morte:** espectador do próprio time até o fim do round (reaproveita o espectar já existente); sem renascer.
- **Armas ao fim do round:** quem sobrevive mantém o que comprou; quem morre perde (como no CS). Largar e pegar arma de companheiro continua valendo.
- **Fim da partida:** tela final com placar de rounds, MVP, abates, mortes, dano; opção de revanche.
- **Pontos de ranking:** nenhum (sala/partida personalizada nunca entra em ranking, regra 2 do RULES).

## 4. Preços da loja (a definir)
A loja atual (`shop.ts`, dinheiro infinito) ganha preço por item (valores próximos aos do CS: Glock 200, USP-S 200, MP9 1.250, AK 2.700, M4 3.100, escopeta 1.800, sniper 4.750, colete 650, colete com capacete 1.000, granada de luz 200, explosiva 300). Detalhes e balanceamento na fase 2.

## 5. Plano de trabalho (fases)
1. **Motor puro em `packages/games/src/foxshot/bomb/`** (testes): máquina de estados do round (compra, round, plantada, fim), dinheiro e bonificações, placar, troca de lado, vitória; sem rede.
2. **Bomba e zonas**: modelo 3D da C4 por script (`tools/art/`), plantar/desarmar, HUD, sons, marcas A/B no minimapa e mapa grande, base com zona de compra.
3. **Offline contra bots** com times e IA de bots por lado (TR vai à bomba A ou B e planta; CT defende e desarma).
4. **Online**: estender `FsNetSim` e a sala (`foxshot-room.engine.ts`): fases do round, dinheiro por jogador, troca de time no lobby, jogador que entra no meio espera o próximo round.
5. **Menus**: aba "Modo" do lobby e offline com as opções (rounds, tempos, dinheiro), troca de time, tela final.
6. **Testes e revisão**: unitários, integração do servidor, e2e offline e online, conferência no celular (controles de toque para plantar/desarmar, comprar na base).

## 6. Riscos
- É o maior modo do Counter Fox até hoje; faz-se por fases, cada uma entregue e testada.
- Online: a simulação atual é mata-mata contínuo; o round muda o ciclo de vida (morrer = espectar). Cuidado com reconexão no meio do round.
- Equilíbrio de dinheiro e de IA dos bots precisa de ajuste jogando.

## 7. Fora do escopo agora
Habilidades dos agentes do Valorant, modos extras (resgate, desarmamento), mais mapas, ranking e modo espectador de campeonato.

## 8. Aceite
Uma partida 5x5 (humanos e bots) no Duna, offline e online: compra só na base com dinheiro finito, TR planta e CT desarma, vencedor do round recebe mais, perdedor menos, troca de lado na metade, fim ao chegar ao número de rounds configurado.

## 9. Perguntas em aberto
Respondidas pelo Lucas em 07/11/2026:
- **Times offline:** o jogador escolhe o lado (TR ou CT) e joga 5x5 com bots nos dois times.
- **Padrão:** primeiro a 8 rounds, round de 1:55 (tudo configurável; de 2 a 13 rounds).
- **Economia:** igual à do CS (tabela da seção 1), editável.
- **Ordem:** offline primeiro, online depois.

## 10. Andamento
- Fase 1 feita: `packages/games/src/foxshot/bomb.ts` (`FsBombMatch`: fases compra, round, bomba plantada, fim; plantar e desarmar com tempo; abates e vitórias pagam como no CS; bônus de derrota crescente; troca de lado na metade com dinheiro zerado; teto de dinheiro; fim ao chegar a N rounds) com 10 testes em `bomb.test.ts`.
- Fases 2 e 3 feitas (offline): modo Bomba no menu offline (Modo, Seu lado, Rounds, Tempo); times por lado nas bases do Duna; compra só na base e na fase de compra, com dinheiro e preços da loja; bomba C4 (modelo simples no `FoxShotScene.setBomb`, pisca mais rápido perto do fim); plantar e desarmar segurando E (botão BOMBA no celular); bots por lado (TR leva a bomba ao pátio e planta, CT defende e desarma, compram conforme o dinheiro); HUD (`FsBombHud`); fim de round, troca de lado na metade, tela final com vitória/derrota. E2E `counterfox-bomba.spec.ts` (3 testes).
- Limites atuais: quem morre vê só a câmera caída até o próximo round (ainda não espectar o aliado); sem kit de desarme à venda; online ainda não.
- Próximas (antigo texto): fase 2 (modelo 3D da C4, plantar e desarmar na tela, HUD, zona de compra na base), fase 3 (partida offline com bots por lado), depois online e menus.
