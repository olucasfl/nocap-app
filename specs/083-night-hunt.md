# 083 Night Hunt

Status: **fase 1 implementada** (15/11/2026). Protótipo de design original: `docs/reference/night-hunt-prototype.html`.

## 1. Objetivo

Jogo de sobrevivência em arena no estilo Vampire Survivors, construído sobre o **Slash The Hordes** (decisão do Lucas): mesma arte, animações, sons, música, regras de dano, vida, XP, hordas e chefes. O jogador só anda; a espada e as demais armas atacam sozinhas; sobe de nível, escolhe uma entre 3 melhorias, abre baús de chefe e tenta durar o máximo. Celular e PC, retrato (tela lógica de 510×680 como no Slash).

## 2. Escopo desta fase (pedido do Lucas)

- **1 herói** (o guerreiro do Slash), **1 mapa** (campo infinito do Slash), **6 melhorias de partida** com descrição, **melhorias permanentes** com ouro, **32 conquistas**.
- Transições de tela (fade), janelas que abrem com animação, morte com animação, vinheta vermelha e título "VOCÊ CAIU", resultado com contagem de ouro, itens da partida e conquistas liberadas.
- Fora desta fase: mais heróis e mapas, evoluções de arma, reroll/pular/banir, ranking e Daily com validação no servidor, save na conta (migração só com "sim" explícito), online.

## 3. Regras (portadas do Slash, `packages/games/src/nighthunt`)

- Passo fixo de 1/60 s e semente por partida (`NhWorld`); no Slash o tempo é variável.
- Jogador: vida 50, velocidade 100, XP por nível `10, 20, 30 … 220` (18 níveis), espada a cada 2 s (dano 2, gira de 170° a ~370° em 1,3 s, colisor de 6 tamanhos), regeneração 5 s ÷ nível, ímã 6 s.
- Dano de contato: no começo do contato e a cada 0,5 s; sem invulnerabilidade extra.
- Melhorias: Lâmina Longa (5), Lâmina Afiada (10), Adagas Voadoras (6 salvas), Tiro Arcano (6), Nova Ígnea (6), Regeneração (6). Janela de nível com 3 opções sorteadas; baú de chefe dá 1 melhoria garantida.
- Inimigos, chefes e hordas: tabelas completas do Slash (`settings.ts`): geradores individual, circular e de onda por linha do tempo, chefes a cada ~100 s, chefe final aos ~1100 s, atiradores (machado e orbe), perseguição periódica.
- Itens do chão: XP, ouro, poção (+10), ímã (atrai tudo no raio de 260), baú.
- Melhorias permanentes: tabela do Slash (vida, dano geral, perfuração, velocidade, coletor de XP, coletor de ouro). **Diferença:** o coletor de ouro agora vale (multiplica o ouro no fim da partida).
- Descrições em pt-BR de todos os itens (pedido do Lucas); no Slash eram vazias.

## 4. Telas (todas em canvas, arte do Slash)

Menu (Jogar, Melhorias, Itens, Conquistas, Opções de som, Voltar ao Hub) → Partida (HUD: barra de XP, tempo, ouro, melhorias em uso, pausa) → Subir de nível (3 cartas com descrição e o que muda) / Baú (animação de abertura) / Pausa (Continuar, Opções, Desistir) → Fim de jogo (resultado). Mais: Melhorias (compra com ouro), Itens (coleção com "?" até descobrir), Conquistas (lista com barra de progresso e prêmio em ouro), Opções (música, efeitos, flashes).

Entrada: WASD/setas ou joystick flutuante em qualquer ponto livre da tela; Esc pausa; 1, 2, 3 escolhem a melhoria. Pausa automática ao perder o foco.

## 5. Arquitetura

```
packages/games/src/nighthunt/   settings (dados do Slash) · data (colisores, espada) · geometry · world (NhWorld) · rules (itens, conquistas, save) · testes
apps/web/src/games/nighthunt/   assets (atlas, fonte bitmap) · audio · save · view (mundo) · app (telas, entrada, transições) · NightHuntPage
apps/web/public/nighthunt/      atlas.png/json, fontes, áudio (gerados por tools/art/nighthunt/extract.py)
```

Rota `/nighthunt`; cartão no Hub (Ação). Save do aparelho em `localStorage` (`nighthunt:save:v1`).

## 6. Pendências e riscos

1. **Licença da arte e do som do Slash não confirmada** (ver `docs/ASSETS-NIGHTHUNT.md`): confirmar com a Y8.com e o autor, ou trocar, antes de publicar.
2. Save na conta e ranking/Daily (servidor refaz a partida pela semente e entradas; a simulação já é determinística): fases 4 e 8 do plano, com "sim" para a migração.
3. Equilíbrio medido só jogando; simulador de robôs fica para a próxima fase.
4. Medir desempenho em celular fraco com 300+ inimigos.
