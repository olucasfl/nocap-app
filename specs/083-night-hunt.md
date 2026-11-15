# 083 Night Hunt

Status: **rascunho para aprovação** (15/11/2026). Nenhum código de jogo escrito ainda.
Protótipo de design (jogável, só telas e sensação): `docs/reference/night-hunt-prototype.html` (abrir no navegador).

## 1. Objetivo

Jogo de sobrevivência em arena no estilo Vampire Survivors, com nome, arte, cores e personagens próprios. O jogador só anda; as armas atacam sozinhas; sobe de nível, escolhe melhorias, evolui armas, derrota chefes. Retrato primeiro (celular), mas funciona em PC. Partida padrão de 12 minutos. Nota refeita pelo servidor a partir da seed e das entradas.

Fora do escopo do lançamento: co-op online, arcanos, modo hiper, loja com dinheiro real, DLC.

## 2. Pendências de decisão do Lucas (bloqueiam o início)

1. **Exceção de design em RULES.md (décima primeira).** Night Hunt tem identidade própria: fontes Bebas Neue (títulos), Barlow Condensed (texto) e Chakra Petch (números); tokens `--nh-*` (fundo #050a18, painel #14213a, borda #2b8aa0, âmbar #ffb23e, vermelho #c8323a); painéis e botões angulares com cantos cortados; pixel art em escala inteira; só `transform`/`opacity` animam nas telas HTML, e o canvas respeita `prefers-reduced-motion`. Sem emoji. **Precisa de "sim" explícito para entrar em RULES.md.**
2. **Arte final.** O protótipo usa sprites gerados por código (placeholders com contorno). Para o jogo final: pacote de um único artista com licença comercial (recomendado) ou arte sob encomenda. Slash The Hordes **não pode ser usado**: o repositório não tem licença e os assets são da Y8 e de terceiros. Os números dele (vida 50, XP por nível, geradores, chefes) servem como base de equilíbrio, reimplementados do zero.
3. **Nome final e duração** (Night Hunt e 12 min são o padrão adotado).
4. **Migração de banco** para o save da conta (tabela nova): só com "sim" explícito na fase 4.
5. **Dependência nova:** nenhuma. Canvas 2D próprio. PixiJS só se a medição no celular exigir, com autorização.

## 3. Telas (desenhadas no protótipo)

Fluxo: **Menu → Herói → Mapa → Partida → Resultado**. Laterais do menu: Coleção, Melhorias, Conquistas, Opções.

| Tela | Conteúdo | Botões e itens (como no gênero) |
|---|---|---|
| Menu | Título, herói com lanterna, floresta com lua, fogos-fátuos | JOGAR, Coleção, Melhorias, Conquistas, Opções, contador de ouro, créditos, versão |
| Seleção de Personagem | Grade de cartões (herói + arma inicial); bloqueados em silhueta | Confirmar / Desbloquear (preço em ouro), Voltar; caixa de descrição com o bônus |
| Escolha o Mapa | 3 cartões com **preview do mapa**; bloqueado com condição | Começar / Bloqueado; caixa com descrição e inimigos do mapa |
| Partida | Mundo em pixel art, HUD: barra de XP, tempo, abates, ouro, slots de armas e passivos, pausa | Joystick flutuante, WASD/setas, Esc pausa |
| Subir de nível | 3 opções: ícone, nome, **descrição**, "NOVO!" ou nível, o que muda neste nível | Toque, clique ou teclas 1, 2, 3 |
| Pausa | Opções com caixas de marcar | Continuar, Sair |
| Resultado | Sobreviveu, ouro, nível, abates, **todos os itens da partida com nível (MAX se completo)** | Concluir, Jogar de novo, Itens |
| Coleção | Grade de itens (“?” se não descoberto), contador "Coletado: n de N" | Caixa com descrição, "Ignora:" e receita de evolução |
| Melhorias (ouro) | Grade 4×3 com 12 melhorias e níveis | Comprar (custo cresce por nível) |
| Conquistas | Lista com caixa de marcar, recompensa por conquista | Caixa com o que libera |
| Opções | Sons, Música, Efeitos piscantes, Joystick visível, Números de dano | Voltar |

A descrição dos itens (pedido do Lucas) aparece no nível, na coleção e no resultado.

## 4. Conteúdo do lançamento

- **Heróis (4):** Kael Corvino (Corrente de Prata; +10% de dano a cada 10 níveis), Lyra Folhagem (Virote; armas recarregam 10% mais rápido), Brann Escudeiro (Lanternas Giratórias; -1 de dano recebido), Ysolde Lunar (Relâmpago Lunar; regenera 0,2/s). Preço de desbloqueio: 0, 300, 600, 900.
- **Armas (alvo 10, protótipo tem 5):** Corrente de Prata, Virote, Lanternas Giratórias, Relâmpago Lunar, Óleo Ardente. Cada uma com 8 níveis e 1 evolução (arma no nível máximo + passivo certo + abrir baú de chefe): Corrente do Lobo, Chuva de Virotes, Eclipse de Lanternas, Tempestade Lunar, Fogo-Fátuo.
- **Passivos (alvo 10, protótipo tem 6):** Amuleto Vital, Botas de Caçador, Diário de Caça, Pedra Atrativa, Trevo da Lua, Troféu Antigo.
- **Inimigos:** Corvo (voa, 2 de vida), Lobo (rápido, 4), Vulto (6, ataque mais forte); chefes a cada ~2 min; chefe final aos 12 min; "Ceifador" que persegue se o jogador passar do tempo. Geradores como no Slash: individual, anel, onda, chefe, por linha do tempo.
- **Mapas (3):** Floresta Sombria (infinito), Trilha dos Lobos (corredor, hordas pelas duas pontas), Clareira da Lua (arena fechada, desbloqueio: sobreviver 10 min).
- **Melhorias com ouro (12):** Força, Vida, Armadura, Quantidade, Recarga, Área, Velocidade do projétil, Duração, Movimento, Ímã, Sorte, Crescimento.
- **Números de referência (Slash, só equilíbrio inicial):** vida 50, velocidade 100 px/s num campo de 510×680, regeneração após 5 s sem dano, invulnerabilidade 0,5 s após dano, ímã 6 s, XP por nível 10, 20, 30… 220.

## 5. Melhorias pedidas pela comunidade que entram (validadas)

Origem: fóruns do Vampire Survivors (Steam, itch.io, reviews). Critério: resolve uma dor real e cabe no escopo.

| Item | Decisão | Como |
|---|---|---|
| Opções de nível que não ajudam a montar a build | **Entra no lançamento** | Sorteio com peso maior para o que o jogador já tem e para o que completa uma evolução; a **Sorte** abre uma 4ª opção; **Reroll, Pular e Banir** ligados às melhorias com ouro |
| Ver que armas combinam (reduz a frustração da build) | **Entra** | Dica de evolução na pausa ("falta o passivo X") e receita na Coleção; ao selecionar uma arma, destacar os passivos que evoluem ela |
| Opção ao chegar no máximo de armas | **Entra** | Quando tudo está no máximo, o nível oferece "bolsa de moedas" ou "comida" |
| Balanceamento das armas | **Entra como processo** | Simulador de robôs (milhares de partidas) imprime sobrevivência e dano por arma e personagem; meta: nenhuma arma sozinha vence ou perde sempre |
| Desempenho e estabilidade no celular | **Entra desde a fase 1** | Pool de objetos, grade espacial, teste de carga com 500 inimigos, limite de 450 vivos, fusão de gemas, modo economia; medir em iPhone e Android |
| Acessibilidade (mira difícil de ver, flashes) | **Entra** | Efeitos piscantes, números de dano e joystick visível desligáveis; modo daltônico; contorno forte nos projéteis; `prefers-reduced-motion` |
| Save e continuar | **Entra com custo** | Salvar a run e retomar, mas a run retomada não conta para conquistas nem ranking; a run é única por conta |
| Eventos no mapa além dos baús | **Entra (versão pequena)** | Elite a cada X minutos e portal temporário; resgate de NPC fica para depois |
| Desafio com seed fixa e ranking | **Entra** | Daily com seed do dia (já é padrão do NoCap), ranking só em presets, nota refeita pelo servidor |
| Qualidade de vida no mapa (bússola, marcos) | **Entra o simples** | Setas de borda para baú/elite fora da tela; os marcos do mapa (lanternas, pedras) já estão desenhados |
| Modificadores de run opcionais | **Depois do lançamento** | Cartas que mudam regras (sem cura, inimigos dobrados); ficam fora do ranking oficial |
| Invocador como classe | **Depois do lançamento** | Necromante com aliados; precisa de IA de aliado e de equilíbrio próprio |
| Aliados controlados pela CPU | **Depois**, junto do invocador | Mesma base |
| Dash/sprint limitado | **Não entra agora** | Os próprios criadores dizem que quebra o fluxo; testar só como passivo opcional |
| Co-op online, Switch, tradução | **Fora do escopo** | A simulação determinística deixa a porta aberta |
| Dificuldade desigual depois de desbloquear tudo | **Entra como processo** | Mapas e modificadores novos em vez de números maiores; curva ajustada com o simulador |
| Modo Adventure mal posicionado | **Não se aplica** | Não existe modo equivalente |

Observação sobre variedade: o Night Hunt sorteia sempre das armas desbloqueadas e a Coleção mostra o que falta, para a variedade crescer com o progresso.

## 6. Arquitetura

Regras do projeto: lógica só em `packages/games`; UI em `apps/web`; nota refeita pelo servidor; código em inglês, UI em pt-BR; Conventional Commits.

```
packages/games/src/nighthunt/
  constants.ts   enemies.ts   spawner.ts   weapons/   passives.ts   evolutions.ts
  levelup.ts     meta.ts      characters.ts stages.ts  score.ts      replay.ts
  world.ts (passo fixo 1/60 s, seed, entrada quantizada)   *.test.ts
apps/web/src/games/nighthunt/
  NightHuntPage.tsx  NhPlay.tsx  renderer.ts  sprites.ts  input.ts  audio.ts
  screens/ (Menu, Heroes, Maps, Pause, Results, Collection, PowerUp, Achievements, Options)
  nighthunt.css  (tokens --nh-*)
apps/api/src/matches/   valida: refaz a partida pela seed e entradas e recalcula a nota
```

- **Determinismo:** passo fixo de 1/60 s, mesma seed e mesmas entradas dão a mesma partida; sem `Math.sin/cos` em lógica decisiva (tabela fixa se divergir entre navegadores). Entrada gravada: direção em 16 passos por tick, mais escolhas de nível, baú, reroll, banir e pular.
- **Desempenho:** pool de objetos, grade espacial de 64 px, atlas único, `drawImage` sem suavização em escala inteira, culling por câmera. Orçamento: lógica ≤ 4 ms e desenho ≤ 8 ms por quadro no celular médio.
- **Canvas nítido:** resolução real do aparelho (devicePixelRatio) para texto; mundo desenhado em escala inteira de pixel art com `imageSmoothingEnabled = false`. O protótipo já faz isso.
- **Dados em tabelas:** personagem ou mapa novo = uma linha de dados + teste.

## 7. Fases (cada uma termina jogável e com testes)

0. Aprovação desta spec e da exceção de RULES.md; escolha do caminho de arte.
1. **Núcleo:** motor de passo fixo, movimento, 1 arma, inimigos, grade de colisão, XP e nível, morte; 60 fps com 400 inimigos no celular; mesma seed = mesma partida.
2. **Armas, passivos, evolução:** 10 armas × 8 níveis, 10 passivos, tela de nível, reroll/pular/banir, baú, evolução; simulador de balanceamento.
3. **Inimigos e chefes:** ~20 inimigos, os 4 geradores, atiradores, chefe final, Ceifador, eventos de elite e portal.
4. **Progressão:** ouro, 12 melhorias, 4+ heróis, conquistas, save no aparelho e na conta (**migração só com "sim"**), save e continuar com custo.
5. **Mapas:** os 3 mapas com regras próprias e desbloqueios.
6. **Acabamento:** arte final, animações, partículas, números de dano, hit-stop, tremida, sons e música; checklist de game feel.
7. **Celular e PWA:** safe-area, pausa ao sair, retrato, modo economia, teste em iPhone e Android real; capturas em 390×844, 360×740 e 844×390.
8. **Ranking, Daily e servidor:** replay, validação, ranking por mapa e herói (só presets), Daily com seed do dia; teste que adultera entrada e nota.
9. **Equilíbrio e conteúdo:** robôs jogam milhares de partidas; ajuste de números; modificadores de run, invocador e novos mapas como atualizações.

## 8. Critérios de aceite

- Todas as telas da seção 3 existem, com os botões listados, em retrato e paisagem, sem texto cortado nem borrado.
- Partida adulterada é recusada pelo servidor; mesma seed e entradas dão a mesma nota em dois navegadores.
- 60 fps com 400 inimigos no celular médio; nada pisca mais de 3 vezes por segundo; efeitos piscantes desligáveis.
- Nenhum item sem descrição; nenhum personagem sem arma inicial nem sprite (teste automático).
- Nenhuma arte sem licença registrada em `docs/ASSETS-NIGHTHUNT.md`.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Desempenho no celular fraco | pool, grade, teste de carga na fase 1, modo economia |
| Divergência de simulação entre navegadores | passo fixo, matemática simples, testes de determinismo |
| Arte sem coerência ou sem licença | um só pacote ou artista, paleta travada, registro de licença |
| Escopo crescer | lançamento fixo (10 armas, 10 passivos, 4 heróis, 3 mapas); o resto vira atualização por tabela |
| Equilíbrio ruim | simulador e teste humano antes de cada mapa novo |
