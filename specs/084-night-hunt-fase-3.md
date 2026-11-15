# 084: Night Hunt, fase 3 (itens novos no estilo Vampire Survivors, bestiário e nova evolução)

Status: rascunho, aguardando a lista de itens e a nova mecânica de evolução do Lucas. Continuação da [083](083-night-hunt.md).

## 1. Pedido (15/11/2026)

1. **Itens novos** parecidos com os do Vampire Survivors (VS), no estilo dele, com animações prontas e bem feitas **seguindo o padrão que o jogo já tem** (arte do Slash + sprites gerados em `extra-art.ts`).
2. **Pesquisar cada item no VS antes de fazer** (o que faz, como evolui, o que combina com o quê, números) e só então implementar.
3. **Bestiário** como o do VS: lista numerada dos inimigos à esquerda, painel à direita com o bicho **animado**, descrição, estatísticas e onde aparece.
4. **Nova mecânica de evolução**: o Lucas vai mandar. Esta spec já deixa o encaixe pronto.
5. Perguntar antes de decidir qualquer coisa duvidosa (seção 8).

## 2. O que já existe e esta fase reaproveita

- 15 + 4 melhorias (`UpgradeId`, `UPGRADES` em `rules.ts`), 7 armas (6 slots) e 12 passivos (6 slots), evolução "arma no máximo + passivo + baú" (`EVOLUTIONS`, `EVO_INFO`), baú com pegar ou recusar.
- 36 inimigos do Slash (`ENEMIES` em `settings.ts`: vida, dano, velocidade, XP, ouro, tipo de movimento), 17 tipos de gráfico com animação (`ENEMY_ANIM` em `view.ts`), 3 mapas.
- Tela de Itens (coleção) em canvas, com `save.seen`; save na conta por `user_prefs` (sem migration, `rev` maior vence).
- Hordas por tempo (`hordes.ts`), chefes com vida por `bossHp`, objetos quebráveis por mapa.

## 3. Itens novos

### 3.1 Método (obrigatório, um item por vez)

Para cada item pedido, antes de codar, escrever na seção 3.3 uma ficha com:

| Campo | Conteúdo |
| --- | --- |
| Origem no VS | nome original, tipo (arma, passivo, arcano, união), como se obtém |
| Comportamento | o que faz, alcance, padrão de ataque, o que o Poder/Alcance/Ligeireza/Sabedoria mudam nele |
| Níveis | 1 a 6 (armas) ou 1 a 5 (passivos), com o que muda em cada |
| Evolução | com qual passivo, exige baú, resultado |
| Arte | quadros do atlas do Slash a reaproveitar ou sprite novo a gerar (paleta, tamanho, frames) |
| Animação | quadros por segundo, laço, efeito de acerto, som (do Slash ou novo) |
| Equilíbrio | dano base, recarga, perfuração, comparação com as armas de hoje |

Sem ficha completa e aprovada, o item não entra.

### 3.2 Padrão de arte e animação (já combinado)

- Tudo desenhado em canvas, pixel art em escala inteira, contorno escuro, no mesmo atlas (`extra-art.ts` gera os quadros novos e eles entram no atlas estendido, nomes `X/...`).
- Animações curtas em laço (4 a 8 quadros), sempre por nome de quadro; efeitos de acerto reaproveitam `Effects/*` do Slash quando servirem.
- Ícone de 16x11 (ou 16x16) na paleta `PAL` de `extra-art.ts`, com a mesma moldura octogonal dos ícones atuais; evoluídos ganham a moldura dourada `E/*`.
- Sons: os do Slash primeiro; som novo só se o Lucas pedir (hoje as armas novas reaproveitam sons).
- Respeitar `prefers-reduced-motion` em animação decorativa fora da partida (partida segue sempre animada).

### 3.3 Fichas dos itens

(vazio até o Lucas mandar a lista)

## 4. Bestiário

### 4.1 Tela (canvas, mesmo estilo de Itens e Conquistas)

- Entrada no início do jogo, ao lado de Itens e Conquistas.
- **Esquerda:** lista rolável numerada (`001 Morcego`, `002 Esqueleto`...), nomes dos já encontrados em branco, os já derrotados mas ainda sem leitura em amarelo, os nunca vistos como `----------------`. Cabeçalho "BESTIÁRIO: 58/180" (encontrados / total).
- **Direita:** cartão do bicho selecionado:
  - "Derrotou: N" (contador da conta).
  - Palco com o chão do mapa onde ele aparece e **o bicho animado em laço** (andando; chefes alternam andar e atacar), escala inteira.
  - Descrição curta em pt-BR com humor leve (uma ou duas frases por inimigo).
  - Estatísticas com ícone: Vida (PV), Poder (dano de contato), Velocidade, XP, Ouro; para os que atiram, a habilidade ("Arremessa machados", "Lança orbes"); Resistências quando houver.
  - "Encontra-se em:" mapas e faixa de tempo em que aparece (vem de `hordes.ts`).
- Mobile e PC: lista e cartão lado a lado quando a tela é larga; em pé, lista em cima e cartão embaixo (mesma regra de caixa expansível dos outros menus, `MENU_MAX_W`).
- Selecionar com toque, mouse, setas e Enter; rolagem por arrastar e roda.

### 4.2 Dados

- Uma entrada por inimigo de `ENEMIES` (36 hoje) mais os chefes; a ordem é a da primeira aparição na partida. Cada entrada: `id`, nome, descrição, quadro/animação (`graphicsType`), mapas, ordem.
- Estatísticas lidas direto de `ENEMIES` (vida, dano, velocidade, XP, ouro) para nunca divergir do jogo, com a vida mostrada já com o fator do mapa selecionado.
- Local: `packages/games/src/nighthunt/bestiary.ts` (dados puros, testados); desenho no web.

### 4.3 Save

- Por inimigo: `seen` (aparece na lista) e `kills` (contador). Alimentado ao fim da partida a partir do que o `NhWorld` contou (novo `killsById` no resultado) e ao ver o inimigo pela primeira vez (`seen` no meio da partida, para o bestiário abrir mesmo se a pessoa morrer cedo).
- Vai no save da conta. Atenção: `stats` no schema da API é limitado a 6.000 caracteres; com 40 entradas, usar um campo próprio `bestiary` (número de abates por id, ids curtos) e subir o schema junto, sem migration (é JSON em `user_prefs`).
- Conquistas novas: "Zoólogo" (ver todos), "Caçador de chefes" (derrotar todos os chefes), por mapa.

## 5. Nova mecânica de evolução

Aguardando a descrição do Lucas. Pontos de encaixe já mapeados:

- `EVOLUTIONS` (`data.ts`) hoje é uma tabela estática "arma no máximo + passivo + baú". A nova regra pode substituir ou conviver com ela (ex.: uniões entre duas armas, arcanos, evolução por outra condição).
- `availableEvolutions()` e `openModal('chest')` em `world.ts` decidem o que o baú entrega; a janela de evolução e o aviso no baú ficam no `app.ts`.
- Coleção (tela Itens) mostra a receita de cada evolução (`EVO_INFO`); a nova regra precisa gerar o texto da receita.
- Robô (`bot.ts`) e simulador (`nighthunt.sim.ts`) precisam aprender a persegui-la.

## 6. Etapas

1. **Bestiário** (não depende da lista de itens): dados, contagem no mundo, save e schema, tela, conquistas, testes e e2e.
2. **Fichas dos itens** (com a pesquisa de cada um) e aprovação do Lucas.
3. **Itens novos**: motor + arte + animação + som + ícones, um por vez, com teste unitário e print.
4. **Nova evolução**: motor, janela, coleção, robô.
5. **Equilíbrio** com o robô e jogando; documentação (`docs/ASSETS-NIGHTHUNT.md`, ARCHITECTURE, ROADMAP, HANDOFF) e INDEX.

## 7. Critérios de pronto

- Cada item novo tem ficha aprovada, ícone, animação em laço, descrição pt-BR, níveis e (se couber) evolução; aparece na coleção.
- Bestiário abre pelo início, mostra o bicho animado, descrição e números iguais aos de `ENEMIES`, conta abates e sincroniza com a conta.
- Testes: dados do bestiário (todo inimigo de `ENEMIES` tem entrada), contagem, schema da API, e2e da tela em celular e computador.
- Nada de lógica de jogo fora de `packages/games`; UI em pt-BR; sem emoji.

## 8. Perguntas abertas (precisam do Lucas)

1. **A lista de itens e a regra nova de evolução** (a que você vai mandar).
2. **Pesquisa no VS:** esta sessão não alcança a wiki do VS (a rede bloqueia `vampire-survivors.fandom.com`). Posso trabalhar só com o que conheço, ou você libera esse endereço nas configurações de rede da sessão (ou cola as páginas dos itens)? Os números do VS entram como referência, não como cópia: os itens seguem a identidade própria do Night Hunt.
3. **Cópia de arte:** os itens novos usam arte nova desenhada por nós no estilo do Slash (e não os sprites do VS). Confirma?
4. **Bestiário:** só os inimigos do Slash (36 + chefes) ou também criar bichos novos para os itens/mapas novos?
5. **Slots:** continuam 6 armas e 6 passivos, ou a nova evolução muda isso?
6. **Onde o bestiário abre:** botão novo no início (ao lado de Itens), ou dentro da tela de Itens como aba?
