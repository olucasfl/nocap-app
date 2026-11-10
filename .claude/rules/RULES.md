# RULES.md: regras permanentes do NoCap

Precedência: `RULES.md` > `CLAUDE.md` > `ARCHITECTURE.md` > spec > prompt da conversa.
Padrão: negar por padrão, abrir exceções nomeadas, dizer o que fazer em vez disso.

## Nunca

- Commitar `.env` ou qualquer segredo; colar senha, chave ou connection string real em arquivo, commit, log ou chat.
- `git push --force`, `git reset --hard`, reescrever histórico publicado, `--no-verify`.
- Confiar na nota enviada pelo cliente: o servidor regenera as rodadas pela seed e recalcula.
- Pôr lógica de jogo fora de `packages/games`.
- Colocar sala personalizada no ranking.
- Mostrar cronômetro, número, barra, som ou animação rítmica durante a contagem do jogo do Tempo.
- Usar distância RGB para nota de cor (use ΔE2000 em Lab).
- Usar emoji, gradiente genérico, Inter/Roboto, ou cores fora dos tokens Pop Brutal. Exceções abaixo (o Aperta!, que tinha a primeira, foi removido do app em 09/11/2026 por decisão do Lucas; emoji continua proibido em todo lugar). Segunda exceção (decisão do Lucas em 03/11/2026, spec 056): a **cena 3D do Counter Fox** (mapa, raposas, armas, efeitos) usa visual mais realista, com materiais PBR, luz e sombra, modelos feitos no Blender por script (`tools/art/`, só ferramenta de trabalho, fora do `package.json`) e sons gravados que combinem com o jogo; menus, HUD, lobby e telas finais do Counter Fox seguem Pop Brutal. **Terceira exceção (decisão do Lucas em 04/11/2026, spec 057):** o menu principal, "jogar", opções, sala (lobby) e tela de resultado do Counter Fox têm identidade própria (fontes Saira Stencil One e Rajdhani, tokens `--cfx-*` em `counterfox-hub.css`, fundo e tudo animado só com transform/opacity, respeitando `prefers-reduced-motion`); o HUD dentro da partida continua como está. Emoji continua proibido. **Quarta exceção (pedido do Lucas em 07/11/2026, spec 058 seção 10):** a tela própria de cada jogo do Fox Cap! (`GameLanding`: Atravessa!, Fut Fox, Ping Fox!, Desmorona!) usa o mesmo estilo (fontes Saira Stencil One e Rajdhani, cores por jogo via `--gl-a`/`--gl-b`, só transform/opacity, respeitando `prefers-reduced-motion`). **Quinta exceção (pedido do Lucas em 09/11/2026, spec 065):** a tela própria de cada jogo do Word's (Classic, Connect e Bee, `WordsLanding`) usa o mesmo estilo da `GameLanding`, com cenário e símbolo de cada jogo; as telas de partida do Word's seguem como estão. **Sexta exceção (pedido do Lucas em 09/11/2026, spec 066):** o hub do Block's (Block Classic e Block Towers, `BlocksStart` sobre `WordsLanding`) usa o mesmo estilo; as partidas e telas finais dos blocos seguem Pop Brutal. **Sétima exceção (pedido do Lucas em 09/11/2026, spec 067):** o hub da Mesmíssima, do Já Deu? e do Ecooo (`GameHubLanding`) usa o mesmo estilo; as partidas, o Daily e as telas finais seguem Pop Brutal. **Oitava exceção (pedido do Italo em 10/11/2026, spec 079):** todas as telas do **Fox GP** (tela própria, garagem, HUD, pódio, transições, box) usam o tema do artifact de conceito (fontes Saira Condensed e Inter, fundo #0b0e17, painéis #141a2b, laranja #ff7d26, azul #2f5bff e a faixa quadriculada), com os tokens em `apps/web/src/games/foxgp/theme.css` (`--gp-*`); só transform/opacity animam, respeitando `prefers-reduced-motion`. **Nona exceção (mesmo pedido):** a **cena 3D do Fox GP** pode usar visual mais realista (materiais PBR, sombras, pós-processamento do próprio three: bloom, tone mapping, antialiasing, motion blur leve, partículas), sempre com seletor de qualidade baixa/média/alta; carros e raposas continuam em voxel.
- Animar propriedades que não sejam `transform`/`opacity`.
- Mudar uma decisão da seção 2 do `docs/PROJECT-BRIEF.md` sem pedir.

## Perguntar antes

- Qualquer item da seção 6 do brief (decisões em aberto).
- Migration destrutiva (remover coluna/tabela, mudar tipo) ou rodar migration em banco que não seja claramente descartável.
- Adicionar dependência fora da stack do brief.
- Commitar direto na `main` algo não trivial.

## Sempre

- Uma spec em `specs/NNN-nome.md` antes de feature nova; atualizar `specs/INDEX.md`.
- Testes no mesmo commit para lógica com ramificação (nota, rng, validação).
- Atualizar `ARCHITECTURE.md`, `docs/ROADMAP.md` e o status do brief junto com a mudança.
- Código em inglês, UI em pt-BR, Conventional Commits.

## Como pedir exceção

Diga qual regra bloqueia e por quê, descreva a ação exata, escreva o comando pronto e pare até haver um "sim" explícito.
