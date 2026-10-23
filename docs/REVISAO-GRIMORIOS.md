# Revisão dos grimórios

Proposta para deixar os grimórios simples e sem repetição. Esta era a proposta; o Lucas aprovou e ela foi feita em 23/10/2026 (`specs/042-aperta-grimorios-por-raridade.md`). Diferenças: a Nebulosa do Caranguejo e a escolha dupla da Órion saíram (Órion oferece mais cartas); Geradores saiu de vez.

## 1. Como é hoje

55 grimórios em 4 categorias (Toque 15, Objetos 19, Geradores 9, Energia e sorte 12), cada um com uma raridade fixa (17 comuns, 19 raros, 13 épicos, 6 lendários). Repetir um grimório sobe o nível dele (até 10), e cada nível soma +50% do número base. Raridade só decide quando o grimório pode aparecer; ela não muda o efeito.

O problema que você viu é real. Os grimórios se repetem entre si, e também repetem coisas das Melhorias e da Árvore:

| Grupo | Quem faz | Por que é repetido |
|---|---|---|
| Combo cheio dá poeira | Vesta (+0,5), Sirius (+2), Proxima Centauri (+1), Rigel (+1,5) | Quatro cartas que só trocam o número |
| Folga do combo | Urano (+0,2 s), Europa (+0,5 s), Haumea (+0,3 s) | Mesmo efeito, número diferente |
| "A cada N toques" (poeira) | Lua x2/10, Júpiter x3/10, Deimos x4/15, Aldebarã x5/12, Alfa Centauri A x6/25 | Cinco cartas iguais |
| "A cada N toques" (energia) | Mercúrio, Hygiea, Tétis | Três cartas iguais |
| Recompensa de cometa | Vênus +3, Hale-Bopp +10, Sedna +15 | Mesma carta em três raridades, mas com nomes e astros diferentes |
| Recompensa de estrela cadente | Marte, Encélado | Idem |
| Recompensa de satélite | Calisto, Io, Netuno | Idem |
| Recompensa de asteroide | Éris, Ryugu | Idem |
| Recompensa de qualquer objeto + aparecer antes | Halley, Plutão, Antares, Oumuamua | Idem |
| Geradores rendem mais | Terra, Sol, Plêiades, Alfa Centauri A, Sombrero, Pallas, Kepler-22b, Hygiea, Fobos | Disputa com as Melhorias de gerador e com a Árvore (Automação) |
| Gerador parado ou ativo | Ganimedes, Haumea, Pulsar de Vela, TRAPPIST-1 | Idem |
| Poeira inicial ou reembolso | Ceres, Saturno, Titã, Pilares da Criação | Quatro cartas para a mesma ideia |
| Estrela Dourada | Antares, Proxima Centauri, Disco de Ouro | Espalhada em cartas de outro tema |
| Escolha (trocas, cartas, níveis) | Betelgeuse, Cabeça de Cavalo, Órion, Caranguejo, Pilares | Cinco cartas, duas ideias |
| Contar a coleção | Vega (comuns), Via Láctea (raros), Andrômeda (colapsos) | Três cartas |

## 2. Modelo proposto: um grimório, quatro raridades

- Cada **grimório é um astro com uma coisa só** para fazer (ex.: Lua = "a cada N toques"). Hoje são 55 cartas; no modelo novo seriam **uns 14 a 16 grimórios** (ver seção 4).
- Cada vez que o grimório aparece, ele vem com uma **raridade sorteada**: Comum, Raro, Épico ou Lendário. A carta mostra o que vai subir, antes e depois (como já mostramos "x2 -> x3").
- A **raridade decide o tamanho do bônus por nível**. Exemplo para a Lua ("a cada 10 toques, o toque rende mais"): Comum +0,5x, Raro +1x, Épico +1,5x, Lendário +2x por nível.
- **Limite de evolução** (D): cada grimório tem nível máximo. Sugestão: Comum até 5, Raro até 6, Épico até 8, Lendário até 10. Quando o grimório está no máximo, ele sai do sorteio.
- Se você já tem a Lua Comum e vem a Lua Rara (D): o grimório passa a valer como Raro e ganha +1 nível. Assim sair raridade melhor é sempre bom e não existe "carta pior que a que eu já tenho".
- A raridade também continua decidindo **quando** a carta aparece (Raro, Épico e Lendário liberam com mais escolhas feitas na vida).

### Página de Grimórios (o livro): descobrir as versões

- A página mostra **um grimório por astro** (ex.: Lua), e não uma carta por raridade.
- Cada grimório tem **4 espaços**: Comum, Raro, Épico e Lendário. Um espaço fica como "???" até você pegar aquela versão pela primeira vez; ao pegar, ele se revela com o nome da raridade e o bônus por nível.
- Cada grimório mostra "2 de 4 versões" e o nível mais alto que você já chegou. O Atlas e os conjuntos por família passam a contar versões descobertas (14 grimórios x 4 = 56 espaços, quase o mesmo número de cartas de hoje).
- A descoberta é **permanente** (vale entre vidas), como o álbum atual. O nível e a raridade em uso continuam zerando a cada vida.
- O Cofre dos Proibidos continua separado e não entra nessa conta.

## 3. Quem mexe em quê (para não competir)

| Fonte | Responsável por | Não mexe em |
|---|---|---|
| **Melhorias** (loja de poeira) | Poder base e contínuo: poeira por toque, geradores de poeira e de energia, compra de fila | Combo, objetos, escolhas |
| **Grimórios** (por vida) | O estilo da vida: ritmo de toque (combo e "a cada N"), objetos (recompensa e frequência), energia e escolhas | Geradores, poeira por toque fixa, custo das melhorias |
| **Árvore** (permanente) | Meta e conforto entre vidas: poeira inicial, custo, nº de cartas e trocas, chance de raridade, habilidades ativas, regiões | Números de toque e de gerador |

Regra de ouro: um número (ex.: "geradores rendem x") só pode ter **uma casa**. Hoje os geradores têm três (Melhorias, Grimórios, Árvore). No modelo novo ficam em Melhorias, e a Árvore só dá acesso a coisas novas (habilidades), sem repetir o "+x%".

## 4. Lista proposta (14 grimórios)

| Grimório | Categoria | O que sobe | Substitui hoje |
|---|---|---|---|
| Lua | Toque | "A cada N toques, o toque rende x" | Lua, Júpiter, Deimos, Aldebarã, Alfa Centauri A |
| Sirius | Toque | Poeira por toque com o combo cheio | Vesta, Sirius, Proxima, Rigel |
| Urano | Toque | Folga do combo | Urano, Europa, Haumea |
| Vega | Toque | Poeira por grimório que você tem | Vega, Via Láctea, Andrômeda |
| Vênus | Objetos | Recompensa de cometa e de asteroide | Vênus, Hale-Bopp, Sedna, Éris, Ryugu |
| Marte | Objetos | Recompensa de estrela cadente (energia) | Marte, Encélado |
| Io | Objetos | Força do "sinal forte" do satélite | Io, Netuno, Calisto |
| Halley | Objetos | Objetos aparecem mais cedo e duram mais | Halley, Plutão, Oumuamua, Voyager 1 |
| Antares | Objetos | Estrela Dourada vem mais cedo e fica mais tempo | Antares, Disco de Ouro, parte de Proxima |
| Mercúrio | Energia e sorte | "A cada N toques, energia" | Mercúrio, Hygiea, Tétis |
| Fobos | Energia e sorte | Energia ao capturar um objeto | Fobos, Caronte, Tritão |
| Titã | Energia e sorte | Poeira inicial e reembolso nas compras | Titã, Ceres, Saturno, Pilares |
| Betelgeuse | Energia e sorte | Trocas de carta por escolha | Betelgeuse, Cabeça de Cavalo |
| Órion | Energia e sorte | Cartas oferecidas por escolha e níveis por repetição | Órion, Caranguejo |

**Geradores (D):** neste desenho nenhum grimório mexe em geradores (os 9 viram Melhorias de gerador, que já existem, e itens da Árvore). Se você preferir manter uma categoria Geradores, a sugestão é um único grimório, o Terra, "geradores rendem mais enquanto você está parado".

## 5. O que dá para mudar no código (esboço, sem fazer ainda)

1. `catalog.ts`: trocar os 55 `grim(...)` por ~14 definições, cada uma com uma tabela `porRaridade: { comum, raro, epico, lendario }` com o bônus por nível e o nível máximo.
2. `economy.ts`: `GRIMOIRE_MAX_LEVEL` deixa de ser um número único e vira o teto por raridade; `levelFactor` passa a usar o bônus da raridade.
3. `engine.ts`: a oferta sorteia grimório e raridade; guardar no `build` o nível e a maior raridade vista; regra da seção 2 para "vem de novo em outra raridade".
4. `save.ts`: migração (save v6) para converter os grimórios antigos: cada um vira o grimório novo equivalente, com a raridade antiga e o nível que tinha (limitado ao teto).
5. Página de Grimórios: passa de uma lista de cartas para o livro com 4 espaços por grimório (campo novo no save: versões descobertas por grimório, migrado do álbum atual). Tela de escolha, Cofre e Atlas: o Atlas e os conjuntos por família continuam, mas passam a contar os 14 grimórios.
6. Conquistas e Árvore que citam grimórios específicos (Vega, Via Láctea, "Cartas de capa" etc.) precisam ser revistas.
7. Simulador e metas de colapso: refazer a calibração, porque o ganho por grimório muda bastante. Esta é a parte mais pesada.

## 6. Decisões que preciso do Lucas

1. Quantos grimórios (14 da lista acima, mais, ou menos)?
2. Nível máximo por raridade (5, 6, 8, 10 como sugestão)?
3. Grimório que vem em raridade maior: sobe a raridade e ganha +1 nível (sugestão), ou soma como um grimório separado?
4. Geradores saem dos grimórios de vez, ou fica um só?
5. Descobrir uma versão (ex.: Lua Lendária) dá alguma recompensa além de completar o livro, ou só o conjunto/Atlas já basta?
6. Isto muda o que o `PROJECT-BRIEF.md` seção 2 diz sobre grimórios? Se sim, atualizamos junto.

## 7. Lista completa de hoje (55 grimórios)

### Toque

| Grimório | Raridade | O que faz hoje |
|---|---|---|
| Lua | Comum | A cada 10 toques, o 10º toque rende o dobro de poeira. |
| Vesta | Comum | Combo (toques em sequência rápida) no máximo: cada toque rende +0,5 de poeira a mais. |
| Urano | Comum | Combo (toques em sequência rápida, liberado pelo Ritmo Firme): +0,2 s de folga entre os toques para não perder a sequência. |
| Haumea | Comum | Combo (toques em sequência rápida): +0,3 s de folga entre os toques. Os geradores seguem cheios por +2 s depois de cada toque. |
| Deimos | Comum | A cada 15 toques, o 15º toque rende x4 de poeira. |
| Europa | Raro | Combo (toques em sequência rápida, liberado pelo Ritmo Firme): +0,5 s de folga entre os toques para não perder a sequência. |
| Júpiter | Raro | A cada 10 toques, o 10º toque rende o triplo de poeira. |
| Proxima Centauri | Raro | Combo (toques em sequência rápida) no máximo: +1 de poeira por toque. A Estrela Dourada fica +5 s no campo. |
| Rigel | Raro | Combo (toques em sequência rápida) no máximo: cada toque rende +1,5 de poeira a mais. |
| Sirius | Épico | Combo (toques em sequência rápida) no máximo: cada toque rende +2 de poeira a mais. |
| Vega | Épico | Cada grimório comum que você tem soma +0,5 de poeira por toque. |
| Alfa Centauri A | Épico | A cada 25 toques, o 25º toque rende x6, e os geradores de poeira rendem x1,15. |
| Aldebarã | Épico | A cada 12 toques, o 12º toque rende x5 de poeira. |
| Via Láctea | Lendário | Cada grimório raro que você tem soma +1 de poeira por toque, e os geradores de poeira rendem x1,3. |
| Andrômeda | Lendário | Cada colapso que você já fez soma +1 de poeira por toque. |

### Objetos

| Grimório | Raridade | O que faz hoje |
|---|---|---|
| Vênus | Comum | Cada cometa capturado dá +3 toques de poeira (3 vezes o que o seu toque rende). |
| Marte | Comum | Cada estrela cadente capturada dá +2 toques de energia (2 vezes a energia do seu toque). |
| Fobos | Comum | Capturar um objeto dá a energia de 1 toque, e os geradores de energia rendem x1,1. |
| Io | Comum | Satélite capturado: o toque rende x2,5 por 8 s, em vez de x2. |
| Halley | Comum | Cada objeto capturado dá +1 toque de recompensa e os objetos aparecem 4 s mais cedo. |
| Ryugu | Comum | Cada asteroide capturado dá +3 toques de poeira (3 vezes o que o seu toque rende). |
| Netuno | Raro | Satélite capturado: o toque rende x3 por 8 s, em vez de x2. |
| Plutão | Raro | Cada objeto capturado dá +2 toques de recompensa e os objetos aparecem 6 s mais cedo. |
| Tritão | Raro | Capturar um objeto dá a energia de 3 toques. |
| Calisto | Raro | Cada satélite capturado dá +4 toques de poeira (4 vezes o que o seu toque rende). |
| Encélado | Raro | Cada estrela cadente capturada dá +4 toques de energia (4 vezes a energia do seu toque). |
| Éris | Raro | Cada asteroide capturado dá +6 toques de poeira (6 vezes o que o seu toque rende). |
| Hale-Bopp | Raro | Cada cometa capturado dá +10 toques de poeira (10 vezes o que o seu toque rende). |
| Voyager 1 | Raro | Os objetos do espaço aparecem 8 s mais cedo. |
| Polaris | Épico | O toque logo depois de capturar um objeto rende x5. |
| Antares | Épico | Cada objeto capturado dá +4 toques de recompensa, e a Estrela Dourada vem 45 s mais cedo. |
| Sedna | Épico | Cada cometa capturado dá +15 toques de poeira (15 vezes o que o seu toque rende). |
| Oumuamua | Épico | Cada objeto capturado dá +6 toques de recompensa e os objetos aparecem 5 s mais cedo. |
| Disco de Ouro | Lendário | A Estrela Dourada vem 90 s mais cedo e fica +8 s no campo. |

### Geradores

| Grimório | Raridade | O que faz hoje |
|---|---|---|
| Palas | Comum | Os geradores de energia rendem x1,15. |
| Hygiea | Comum | A cada 8 toques, o 8º toque dá +3 de energia, e os geradores de poeira rendem x1,06. |
| Terra | Comum | Os geradores de poeira rendem x1,08. |
| Sol | Raro | Os geradores de poeira rendem x1,2. |
| Kepler-22b | Raro | Os geradores de energia rendem x1,25 e os de poeira x1,05. |
| TRAPPIST-1 | Raro | Parado, os geradores rendem 0,4 do ritmo de quando você toca (em vez de 0,25). |
| Pulsar de Vela | Épico | Os geradores seguem rendendo cheios por +5 s depois de cada toque. |
| Plêiades | Épico | Os geradores de poeira rendem x1,25. |
| Galáxia do Sombrero | Lendário | Os geradores de poeira e de energia rendem x1,5. |

### Energia e sorte

| Grimório | Raridade | O que faz hoje |
|---|---|---|
| Mercúrio | Comum | A cada 5 toques, o 5º toque dá +2 de energia (enche a barra de grimórios). |
| Ceres | Comum | Cada melhoria que você compra devolve a poeira de 2 toques. |
| Caronte | Comum | Capturar um objeto dá a energia de 2 toques. |
| Titã | Raro | Cada vida começa com 200 de poeira. |
| Saturno | Raro | Cada melhoria que você compra devolve a poeira de 5 toques. |
| Ganimedes | Raro | Combo (toques em sequência rápida) no máximo: +0,5 de energia por toque. Parado, os geradores rendem 0,35 do ritmo de quando você toca. |
| Tétis | Raro | A cada 6 toques, o 6º toque dá +3 de energia. |
| Betelgeuse | Épico | Quando a barra enche, você pode trocar 1 das 3 cartas oferecidas (1 vez por escolha). |
| Nebulosa do Caranguejo | Épico | Pegar um grimório que você já tem faz ele subir 2 níveis em vez de 1. |
| Cabeça de Cavalo | Épico | Você ganha 1 troca grátis a mais por escolha de grimório. |
| Nebulosa de Órion | Lendário | Quando a barra de energia enche, você escolhe 2 grimórios em vez de 1. |
| Pilares da Criação | Lendário | Cada vida começa com 1500 de poeira, e você ganha 1 troca grátis a mais por escolha. |
