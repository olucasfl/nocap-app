# 028 · Atravessa! (substitui o Sinal Vermelho)

Status: **em andamento. Etapa 1 (núcleo em `packages/games/src/atravessa`) implementada e testada (14/10/2026); faltam as etapas 2 a 6.** Decisão do Lucas: recordes antigos do Sinal são **arquivados, não apagados**. Pesquisa de base em [docs/pesquisa-crossy-road.md](../docs/pesquisa-crossy-road.md).

## Decisões do Lucas

- Jogo novo no estilo Crossy Road, **substitui o Sinal Vermelho** (spec 020, 026 e 027 ficam como história; cantiga, Vigia, esconderijo, analógico e itens saem).
- Nome: **Atravessa!**
- **Um personagem só. Sem itens, sem poderes.**
- **Só modo Infinito** e **só solo** por agora (sala, Daily e percurso fixo ficam para depois).
- **Three.js autorizado** (dependência nova, aprovada em 14/10/2026). Câmera 3D **ortográfica fixa**, na diagonal como no Crossy Road (**as faixas descem da esquerda para a direita e o avanço vai para cima e para a direita**, ajustado em 14/10/2026), seguindo só para a frente.
- Controles: celular = toque pula para a frente, deslizar pula para o lado ou para trás; teclado = **W A S D** (setas também).
- Mundo contínuo com **três biomas em sequência**, com transição entre eles: **grama (horta) → deserto → escuro (neon)**. Cada bioma muda faixas, obstáculos, paleta e música.
- **Pressão por trás: a escuridão.** Veja a seção própria; precisa ser **realista e contida**, não exagerada nem mal feita.

## Movimento do herói (limpo, com animação própria)

Pedido do Lucas: o movimento tem que ser **bem limpo**, com animação própria de pulo: a cada casa o herói **dá um pulinho** para ir andando.

- Cada passo é um pulo de 0,2 s (12 ticks): arco suave (`hop` de 0 a 0,45 casa e de volta), **sem teleporte e sem deslizar**; o herói vira para a direção do passo antes de sair do chão.
- Animação em três tempos, desenhada a partir do que o núcleo informa (`view().step.progress`, `view().landed.age`): **agachar rápido (antecipação) → esticar no ar → achatar leve no pouso** que volta ao normal em ~0,12 s. Easing de saída suave; nada que fique deformado.
- A fila de 2 passos deixa encadear pulos sem travar: o próximo pulo sai assim que o anterior pousa, sem pausa nem perder toque.
- Passo recusado (árvore, borda do mapa) faz só um **tremidinho curto** no lugar, sem gastar tempo.
- Sobre tora, o pulo parte da tora e pousa na próxima; na pedra que afunda, o herói balança antes de cair (`view().sinking`).
- Câmera segue só para a frente, com suavização leve (sem balançar a cada pulo).

> **Atualização (spec 029):** a ordem dos biomas agora é sorteada pela seed e há uma transição a cada 150 linhas (veja a spec 029); a tabela abaixo mostra só o desenho de cada bioma.

## Regras do jogo

- Mundo em **grade**: faixas horizontais de 9 casas de largura (a câmera mostra 9 a 11), o herói pula uma casa por passo (0,2 s, com arco).
- **Nota = linhas avançadas** (a maior faixa atingida). Voltar não perde nota. O servidor refaz a partida pela seed e pelos passos e recalcula.
- Entrada gravada: lista de passos `(instante em ticks, direção)`. Movimento inválido (casa bloqueada, fora do mapa) não gasta o passo. Fila de até 2 passos, para não perder toque.
- Morre por: carro, trem, cair na água (fora de tora/vitória-régia), ser carregado para fora do mapa por uma tora, ser alcançado pela escuridão.
- Reinício imediato depois da morte.

### Faixas

| Faixa | Regra |
| --- | --- |
| Descanso | Segura; árvores, pedras ou cactos bloqueiam casas, sempre com caminho |
| Estrada | Veículos em uma mão por faixa, velocidade e espaçamento próprios |
| Trilho | Raros e muito rápidos; **luz e sino avisam 1,2 s antes** |
| Rio | Toras que andam e carregam o herói; vitórias-régias paradas (algumas afundam depois de 2 s com aviso visual) |

### Geração (determinística)

- Seed → sequência de **trechos**: tipo da faixa, tamanho (1 a 4 seguidas), densidade e velocidade conforme a distância e o bioma.
- **Sempre existe caminho**: nenhum trecho tem faixas perigosas demais em sequência (máximo de 3 rios ou 4 estradas seguidas; depois vem descanso) e as casas bloqueadas nunca fecham a faixa.
- Dificuldade sobe devagar com a distância; o primeiro bioma é bem fácil nos 15 primeiros passos.
- Nada de aleatório fora da seed, para o servidor refazer.

### Biomas

| Bioma | Distância | Visual | Faixas e perigos |
| --- | --- | --- | --- |
| 1. Grama | 0 a ~80 linhas | luz de dia, grama, árvores | estrada, rio com toras, carro, trator |
| Transição | 6 linhas | grama rala virando areia, cor da luz esquentando | mistura |
| 2. Deserto | ~86 a ~170 | areia, cactos, sol forte | estrada, trilho, caminhão, rio seco com pedras e areia movediça (afunda) |
| Transição | 6 linhas | pôr do sol, areia escurecendo | mistura |
| 3. Escuro | ~176 em diante | noite, neon | via neon, esteiras, plataformas de energia, motos e drones |

Depois do bioma 3 o ciclo volta ao 1 mais difícil (para o Infinito continuar).

## A escuridão (realista e contida)

Fica **atrás do herói**, é a única pressão por tempo (no lugar da águia). Regras:

- **Realismo no 3D:** nada de filtro 2D chapado na tela. É **iluminação de verdade** do Three.js: uma luz direcional que vai escurecendo, **neblina de profundidade** (`FogExp2`) e luz do herói, mais um **volume de sombra** que avança como parede de escuro com borda suave, sem partículas gritantes, sem tela preta e sem flashes.
- **Contida:** nunca cobre mais que uns 35% da imagem antes de pegar; o herói e as três ou quatro faixas à frente **sempre ficam legíveis**. Contraste e saturação caem de forma gradual, sem pulsar nem tremer a tela.
- **Aviso sem cronômetro:** cor e escuridão crescem de forma contínua conforme a escuridão se aproxima, com som grave de ambiente subindo devagar. Sem número, sem barra.
- **Como avança:** velocidade constante e baixa, **sempre menor que o ritmo de um jogador que não para** (teto de 85% da velocidade média de avanço). Andar para a frente a mantém longe; parar ou voltar a aproxima. Pega quando alcança o herói.
- **Calibração visual em cada bioma:** luz do dia (neblina clara), deserto (poeira quente), noite (neblina azulada). A noite do bioma 3 é **escura de verdade, mas jogável**: obstáculos e neon aparecem com brilho próprio, sem precisar de luz do herói para enxergar a faixa de baixo.
- Teste automático: a escuridão nunca é mais rápida que o teto e a simulação do servidor concorda com a do cliente.
- Ajuste fino na etapa 4, olhando capturas reais em cada bioma.

## Visual e som

- Blocos (voxel) feitos em código com `BoxGeometry` e materiais simples com sombra suave: herói, carros, trem, tora, árvore, cacto, pedra, plataformas. Visual claro e colorido como nas referências, não pesado.
- Sombras: uma luz direcional com mapa de sombras pequeno; neblina e cores por bioma; transição de cores entre biomas ao longo das 6 linhas.
- Animação do herói: arco de pulo, squash no pouso, giro para a direção, mortes diferentes (carro achata, água espirra, trem arremessa, escuridão engole).
- Som: reaproveita o sintetizador de `lib/sinal-audio.ts` (trilha por bioma, pulo, morte, aviso do trem). Tudo respeita o mudo.
- Pop Brutal só no HUD (nota, pausa), sem emoji. `prefers-reduced-motion`: sem tremor de câmera nem transição de cor animada.
- Mobile primeiro: pixel ratio limitado (máx. 2), sem pós-processamento pesado, malhas reaproveitadas por instância, faixas atrás da câmera são removidas.

## Arquitetura

- `packages/games/src/atravessa`: **toda a lógica** (seed, geração de faixas, simulação por passos e nota, escuridão). Puro, sem Three.js. Testes: geração sempre com caminho, determinismo, colisões, tora carregando, teto da escuridão, nota.
- `apps/web/src/games/atravessa`: tela e renderização Three.js (cena, câmera, luzes, modelos, entrada por toque e teclado).
- `apps/api`: `scoreAtravessaMatch` refaz a partida pela seed e pelos passos (mesmo `Sim` do pacote). Ranking por jogo e modo `atravessa-infinito`; histórico, perfil e fila offline reaproveitados.
- **Migração do Sinal:** o id `sinal` (rotas, ícone na lista) passa a apontar para `atravessa`. Recordes e histórico antigos do Sinal ficam no banco (só leitura) e não entram no ranking novo. Decisão do Lucas pendente: **arquivar ou apagar** (pergunto antes de qualquer migration destrutiva).
- Código do Sinal (`packages/games/src/sinal`, `apps/web/src/games/sinal`, sala do Sinal na API) é removido **só depois** que o Atravessa! estiver jogável e o Lucas aprovar.

## Plano (em ordem)

1. **Núcleo em `packages/games`:** geração, simulação, nota e escuridão com testes. **Feito (14/10/2026):** `constants.ts`, `world.ts` (biomas, faixas, corredor livre), `sim.ts` (passos, colisões, tora, pedra que afunda, escuridão, `evaluateAtravessa` para o servidor) e 20 testes, incluindo um jogador-robô que passa de 170 linhas nas sementes testadas. Valores a calibrar jogando: velocidade da escuridão (0,7 a 2,04 linhas/s), veículos e toras.
2. **Servidor:** ranking, nota recalculada pelos passos, histórico, perfil; migration só se necessária (nova combinação jogo/modo não exige). **Feito (14/10/2026):** o Atravessa! entra como **jogo novo `atravessa`** (modo `infinito`), então o `sinal` e seus recordes antigos continuam intactos no banco, **arquivados** como o Lucas pediu, até a etapa 5 tirar o Sinal da lista. `POST /games/atravessa/session` (seed + sessão assinada), corpo `steps: [instante, direção][]`, `scoreAtravessaMatch` (refaz pela seed, só vale partida terminada dentro do tempo da sessão, nota = linhas x 10), ranking com o quadro `infinito`, histórico e estatísticas pelo mesmo caminho dos outros jogos. 14 testes novos; sem migration. Pendente: a tela do app ainda não conhece o jogo `atravessa` (etapas 3 e 5).
3. **Tela Three.js:** cena, câmera fixa, modelos, controles, HUD, só bioma 1 jogável. **Feito (14/10/2026):** `three@0.170.0` entrou só em `apps/web` (chunk carregado sob demanda na rota `/atravessa`, ~126 KB gz). `apps/web/src/games/atravessa`: `scene.ts` (câmera ortográfica diagonal fixa, sol com sombra, névoa por bioma, faixas montadas só ao redor da câmera), `models.ts` (herói, árvore/cacto/poste, veículos, toras, pedras, trem, sinal; **a escuridão é um patch de shader nos materiais**: tudo atrás da frente escurece por posição no mundo com borda suave de 4 casas, mais uma queda leve de luz e névoa conforme `danger`), `hop.ts` (pose do pulo: agachar, esticar, amassar no pouso, tudo com volume preservado e curva contínua; poses de morte), `input.ts` (W A S D e setas; toque = frente, deslizar = direção, vale assim que passa de 22 px), `AtravessaPlay.tsx` (relógio fixo de 60 Hz, grava `[instante, direção]`, pausa com 3-2-1), `AtravessaGame.tsx` (menu, fim, recorde), `useSaveAtravessa.ts`. Rota `/atravessa` ainda fora da lista de jogos (etapa 5). Visto rodando no navegador (cena, pulo e a borda da escuridão); **falta ver no celular de verdade, a morte e a tela final em tempo real** (o painel de teste pára de animar quando fica oculto). Sem som ainda (etapa 4).
4. **Biomas 2 e 3, transições, escuridão realista, som.** Capturas por bioma para calibrar. **Feito (14/10/2026):** os três biomas já aparecem na cena (deserto com cactos, trilhos e sinal piscando; noite com neon, plataformas e drones) e a paleta, a luz e a névoa se misturam ao longo das 6 linhas de transição. A noite ficou escura mas legível: luz ambiente baixa, água e chão azul-marinho, objetos com brilho próprio e uma luz pequena e quente que acompanha o herói só na noite. Som em `apps/web/src/lib/atravessa-audio.ts` (Web Audio, mudo respeitado): **cada pulo para a frente toca a próxima nota de uma pentatônica do bioma** (a "trilha" é o ritmo de quem joga), pousos que soam diferente em grama, asfalto, madeira e pedra, tremidinho ao bater numa árvore, sino do trem durante o aviso, mortes com corpo (atropelado, trem, água, escuridão), cama de ambiente por bioma e um ronco baixo com batimento só quando a escuridão está perto. Visto no navegador: deserto e noite; a transição horta → deserto e deserto → noite só pelas cores combinadas, **sem captura própria**. Falta calibrar tudo jogando e ouvir o som (não pude ouvir daqui).
5. **Troca no app:** lista de jogos, rotas, ranking, histórico e recordes, **e o Sinal Vermelho apagado**. **Feito (14/10/2026):** o Sinal foi removido por completo (pacote `packages/games/src/sinal`, API, salas online, tela, som, rota e css) e o Atravessa! ocupa o lugar dele no Hub (cartão com arte própria), `/ranking`, `/historico`, perfil e recordes (unidade: linhas). Decisão do Lucas (14/10/2026, depois de decidir arquivar): **"zera tudo do sinal"**: as partidas e os recordes do Sinal no banco serão apagados com `apps/api/scripts/reset-sinal.sql` (**rodado em 14/10/2026 pelo Lucas com `node apps/api/scripts/reset-sinal.mjs --apply`: 30 partidas e 4 recordes do Sinal apagados, sobraram 0**). Sem migration (as tabelas guardam o jogo como texto).
6. Jogar e calibrar com o Lucas.

## Fora do escopo agora

Salas online, Daily, percurso fixo, itens, personagens extras, moedas, anúncios.

## Perguntas abertas

- Os recordes antigos do Sinal: arquivar ou apagar?
- Nota exibida: só linhas ou "linhas" com nome do bioma alcançado? (padrão: só linhas)
