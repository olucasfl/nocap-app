# Spec 062: Counter Fox, modo PvP (times, sem bomba, dinheiro infinito)

Status: em andamento (08/11/2026). Pedido do Lucas: 1x1, 2x2, 2x1 etc., dois times com a mesma lógica do modo Bomba (bots, escolha de lado, espectar), no mapa de blocos que ele enviou, com a mesma física da Duna.

## Regras
- É uma variante do Bomba (`pvp: true` no `FsBombConfig` e `kind: 'bomb'` na sala): times TR/CT, rounds, espectar, tela final por time. Sem bomba, sem pátios, sem dinheiro.
- Cada time nasce numa ponta da arena (eixo comprido). Fase de compra de 5 s no 1º round (`FS_PVP_BUY_SEC`) e de 3 s (`freezeSec`) nos seguintes; é a contagem que libera o tiro. Dinheiro infinito: qualquer arma, colete, capacete e granada, a qualquer hora do round (enquanto vivo), mas só na base (a área de nascimento).
- Round acaba quando um time inteiro cai (quem morre assiste). Acabou o tempo: vence quem tem mais vivos; empate, quem tem mais vida somada. Cada round vale 1 ponto; vence o primeiro a N (1 a 30). Sem troca de lados.
- Tela de fim de round diz quem marcou; depois da compra de 3 s o tiro libera.
- Bots (aliados e inimigos) caçam o outro time indo de ponto em ponto pelo lado do inimigo (`FsBombTactics.pvpStep`).
- Configuração antes de começar (offline e na sala): formato (1x1, 2x2, 2x1, 3x3, 5x5 no offline; bots por time e espectadores na aba Sala), pontos para vencer (1, 3, 5, 10, 15, 20, 30), tempo do round (30 s a 5 min).

## Mapa: Arena de Blocos
- Modelo FBX de terceiros enviado pelo Lucas (sem informação de autoria ou licença: confirmar antes de publicar). `tools/art/fbx2obj.mjs` (FBXLoader do three) converte para OBJ; `tools/art/pvp_build.py` gera `pvp.data.ts` (colisão e grade) e `models/foxshot/pvp/pvp.glb` (texturas embutidas). Escala: 1 bloco = 0,6 m (a 1 m o mapa ficava enorme para o corpo do jogo; portas de 2 blocos, 1,2 m, pedem agachar).
- Colisão exata: os blocos são malhas fechadas, então o sólido sai da paridade dos cruzamentos de raios verticais por coluna (voxels de 12 cm, 5 por bloco). Conferido contra a malha com 432 raios de tiro: 1 divergência acima de 35 cm.
- Janelas e vãos do modelo são buracos de verdade: dá para olhar, atirar e se esconder.

## Ajustes depois do primeiro teste (08/11/2026)
- Escala final: 1 bloco = 0,8 m (o bloco do modelo tem 200 unidades; arena de 34 x 56 m). Colisão maciça (voxels de 10 cm, todo sólido perto de onde se anda), sem casca oca: acabou o buraco por dentro de muros e torres. Degraus do modelo (`Stair`, `StairWhite`) viram sólido do ponto mais baixo ao mais alto de cada coluna. As torres do meio dos muros são maciças na colisão (por dentro eram ocas e sem escada de mão).
- Cada base ganhou a segunda saída: o muro divisor foi encurtado no lado que estava fechado (mesmo tamanho da saída original), no desenho e na colisão (`CARVES` em `pvp_build.py`).
- Bases centralizadas: dois fileiras de 6 nascimentos em x = 0, e a área da base vai de parede a parede até o muro divisor.
- Planta texturizada (`pvp-plan.png`, gerada por `tools/art/render_plan.mjs`) no radar, no mapa grande e no cartão do menu.
- Compra a qualquer hora do round, só na base.

## Feito
Motor (`bomb.ts`, `bombbots.ts`, `netsim.ts`, `maps.ts`, `gridmap.ts`), sala (`foxshot-room.engine.ts`: `pvp`, faixas 1–30 pontos e 30–300 s), lobby (aba Modo), menu offline, HUD (sem bomba, `US$ ∞`), abertura e tela final, testes (`pvp.test.ts`, sala) e e2e offline.

## Falta
Jogar e ajustar com gente de verdade; e2e online com dois navegadores no PvP; confirmar autoria/licença do mapa; carregar os dados do mapa sob demanda (hoje entram no pacote).
