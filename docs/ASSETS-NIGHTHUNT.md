# Assets do Night Hunt

## Origem: Slash The Hordes (decisão do Lucas, 15/11/2026)

Os gráficos (personagem, inimigos, chefes, itens, armas, efeitos, fundos e interface), as animações, os sons, a música e os números de regra (vida, dano, XP, hordas, chefes) vêm do repositório
`github.com/MartinKral/Slash-The-Hordes` (Cocos Creator, "open sourced with the courtesy of Y8.com").

- **Licença:** o repositório **não tem arquivo de licença**; o README diz apenas que foi aberto com a cortesia da Y8.com. Os áudios parecem vir de pacotes de terceiros (nomes de arquivo de bibliotecas de efeitos).
- **Situação:** uso por decisão explícita do Lucas, para desenvolvimento. **Antes de publicar o jogo para o público, confirmar o direito de uso com a Y8.com e o autor (Martin Kral), ou trocar a arte e os sons por material com licença conhecida.** Sem essa confirmação, o Night Hunt não deve sair da conta do Lucas.
- **Extração:** `tools/art/nighthunt/extract.py <repo Slash> apps/web/public/nighthunt` (gera o atlas, as animações de quadros e copia os áudios usados). O resultado fica em `apps/web/public/nighthunt/`.
- **Números:** `packages/games/src/nighthunt/settings.ts` (de `assets/Data/GameSettings.json`) e os tamanhos de colisão em `data.ts` (dos prefabs).

## Arte e sons feitos para o Night Hunt

Gerados por código em `apps/web/src/games/nighthunt/extra-art.ts`, a partir do material do Slash: variações de matiz dos sprites do guerreiro e da decoração do chão, orbes em azul, ícones novos desenhados por mapa de pixels com contorno escuro, moldura dourada das evoluções. Não há arquivo novo no repositório além do atlas e do áudio extraídos.

## Diferenças deliberadas em relação ao Slash

- O Coletor de ouro (melhoria permanente) multiplica o ouro no fim da partida; no Slash o valor era calculado e nunca usado.
- Passo fixo de 1/60 s e semente por partida (o Slash usa tempo variável e `Math.random`), para a partida poder ser refeita no servidor.
- Descrições dos itens em pt-BR (no Slash estavam vazias).
- Conquistas, coleção, tela de resultado e transições são do Night Hunt.
- Heróis, mapas, armas e passivos novos, evoluções, reroll/pular/banir e a conta (`user_prefs`) são do Night Hunt.
- Os chefes soltam baú com mais frequência, para a evolução ser possível.
