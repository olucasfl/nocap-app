# Spec 043: Aperta! reformulação dos itens, geradores e grimórios (rascunho)

Pedido do Lucas em 25/10/2026. O jogo está bem feito, mas tem itens demais e itens complicados (efeitos específicos, em cenários específicos, com porcentagens). A pessoa compra, compra e compra sem saber o que está comprando. Esta spec é a **proposta**; nada foi mexido no código. As decisões abertas estão na seção 8.

## 1. O que o Lucas pediu (resumo)

1. **Itens simples e diretos:** "você paga tanto e ele melhora tal coisa, e pronto". Sem condição, sem porcentagem, sem cenário.
2. **Escada de itens:** um libera o próximo; o próximo tem um preço que parece difícil, mas alcançável ("nada impossível") comprando outras coisas, tocando e evoluindo. Em milhões e bilhões os itens valem mais, e a escala cresce com o jogo.
3. **Duas áreas bem separadas:** **Itens** (compra única) e **Geradores** (poeira e energia, com a área mais bem explicada).
4. **Itens com imagens SVG profissionais**, cada um ajudando de verdade em uma coisa, de forma simples, para a pessoa olhar o próximo item, ver o valor e querer conquistá-lo.
5. **Grimórios mais simples:** só os de toque estão claros. Separar **Energia** de **Sorte**; os de **Objetos** passam a ser gerais (chance, tempo, recompensa de qualquer objeto), nunca de um objeto específico.
6. Ideias do que adicionar e melhorar (seção 7).

## 2. Diagnóstico: por que parece automático e confuso

Hoje há **42 melhorias** (16 de toque, 11 geradores de poeira, 5 de energia, 8 de gerador, 2 outras) e **22 grimórios**. Exemplos do que confunde um iniciante:

| Hoje | Por que confunde |
|---|---|
| Dedo Treinado: "a cada 25 toques, o 25º rende x5" | Regra com contagem escondida |
| Ritmo Firme: "libera o combo: tocar de novo em até 1,3 s mantém a sequência, cada toque soma 0,2 (até 3)" | Uma frase com 4 números |
| Toque de Sorte: "6% de chance de o toque render x10" | Porcentagem e acaso |
| Mãos do Astronauta, Eco, Escala, Rede, Isca, Conversão... | Dependem de outra coisa que a pessoa ainda não tem |
| Grimórios de combo, de satélite, de Estrela Dourada | Dependem de uma mecânica que a pessoa nem viu |

## 3. Princípios do novo desenho

1. **Um item, um efeito, um número.** "+2 poeira por toque", "Toque x2", "Geradores de poeira x2". Só 5 tipos de efeito (seção 4).
2. **Sem porcentagem, sem condição, sem cenário.** Se precisa de "quando" ou "a cada", não é item.
3. **Um item por vez na vitrine.** Como já é nos geradores: aparece o **próximo** em destaque, com preço e o que muda ("Toque: 4 -> 8"). Os seguintes aparecem esmaecidos com o preço (o objetivo), os comprados ficam num resumo.
4. **Preço que dá vontade, nunca impossível.** Cada item é calibrado para ser comprado de **2 a 6 minutos** depois de aparecer (simulador), com o jogador tocando e comprando geradores.
5. **O valor cresce com a fase.** Quatro eras: Poeira (até 10 mil), Mil (até 1 mi), Milhões (até 1 bi), Bilhões (acima). Cada era tem itens com efeito maior e preço maior.
6. **Quadro "Seus poderes"**: um resumo sempre à mão com o total de tudo ("Toque: 12 poeira · Energia por toque: 1,5 · Geradores: 340/s"). É o que responde "o que eu comprei?".

## 4. Itens (compra única)

### Tipos de efeito (só estes 5)

| Tipo | Exemplo de texto | Cálculo |
|---|---|---|
| Toque mais forte (soma) | "+5 poeira por toque" | soma ao toque |
| Toque multiplicado | "Toque x2" | multiplica o toque |
| Energia por toque | "Enche a barra de grimórios 2x mais rápido por toque" | multiplica a energia do toque |
| Geradores de poeira | "Geradores de poeira x2" | multiplica o ganho por segundo (dentro do teto) |
| Geradores de energia | "Geradores de energia x2" | idem, para a energia |

Sai da vitrine de itens, e some do jogo ou muda de lugar (ver decisão 1): combo e Ritmo Firme, Cadência, Dedo Treinado ("a cada N"), Toque de Sorte (chance), Aquecimento, Eco, Mãos do Astronauta, Toque Magnético, Sonda Kepler, Voyager, Chandra, Gaia e as 8 melhorias de gerador (Rede, Isca, Rajada, Escala, Hora de pico, Fila, Conversão, Revezamento).

### Escada proposta (primeiro rascunho dos números; o simulador acerta)

Cada item vem com um ícone SVG próprio em 3 acabamentos (bronze, prata, ouro, conforme a era).

| # | Era | Item | Efeito | Preço |
|---|---|---|---|---|
| 1 | Poeira | Lente Polida | Toque x2 | 100 |
| 2 | Poeira | Luvas de Astronauta | +2 poeira por toque | 350 |
| 3 | Poeira | Pulso Carregado | Energia por toque x2 | 800 |
| 4 | Poeira | Lente Dupla | Toque x2 | 2 mil |
| 5 | Poeira | Motor dos Satélites | Geradores de poeira x2 | 5 mil |
| 6 | Mil | Cabine Reforçada | Toque x2 | 15 mil |
| 7 | Mil | Antena Dupla | Geradores de energia x2 | 30 mil |
| 8 | Mil | Mãos de Titânio | +25 poeira por toque | 80 mil |
| 9 | Mil | Usina Orbital | Geradores de poeira x2 | 250 mil |
| 10 | Milhões | Observatório Webb | Toque x2 | 1,5 mi |
| 11 | Milhões | Pulso Quântico | Energia por toque x2 | 6 mi |
| 12 | Milhões | Reator Estelar | Geradores de poeira x3 | 20 mi |
| 13 | Milhões | Lente Estelar | Toque x3 | 90 mi |
| 14 | Milhões | Rede de Escuta | Geradores de energia x3 | 250 mi |
| 15 | Bilhões | Telescópio Chandra | Toque x3 | 1,5 bi |
| 16 | Bilhões | Cinturão de Energia | Geradores de poeira x3 | 12 bi |
| 17 | Bilhões | Mãos Estelares | +2 mil poeira por toque | 60 bi |
| 18 | Bilhões | Coração do Quasar | Toque x5 | 400 bi |
| 19 | Bilhões | Matriz Galáctica | Geradores x5 (poeira e energia) | 3 tri |

Itens de eras seguintes (trilhões e além) entram com os colapsos, como hoje (`unlockedAtCollapse`). Os itens são **da vida** (zeram no colapso, como as melhorias de hoje); o que dura para sempre continua sendo Cintilas, Cofre e Árvore.

### Tela de Itens

- Uma aba **Itens** e uma aba **Geradores** (hoje há Toque, Geradores e Comprados).
- **Próximo item** em cartão grande: ícone grande, nome, "Toque x2", antes -> depois, preço, botão **Comprar**, e uma barra "faltam 1,2 mil" até poder comprar.
- Abaixo, os **2 próximos** esmaecidos (nome, efeito, preço): é o que dá vontade de chegar lá.
- **Comprados** viram uma faixa de ícones (toque para ver o efeito) e o quadro "Seus poderes".
- Item novo liberado: o botão da dock ganha o selo (como já existe) e o cartão entra com uma animação curta.

## 5. Geradores (área própria, melhor explicada)

Mantêm os 11 de poeira e os 5 de energia e o desenho de "um por vez, com 0/8 níveis". O que muda é a explicação:

- Um cabeçalho fixo: **"Geradores trabalham sozinhos, mesmo sem tocar"**, e o total: "Produção: 340 poeira por segundo".
- Cada cartão: **"+0,2 poeira por segundo por nível"**, "Você tem 5 de 8", "Total deste gerador: 1/s", próximo nível: "+0,2/s por 90 de poeira".
- Quanto falta para pagar o próximo: "em ~40 s" (calculado com a produção atual).
- Abas **Poeira** e **Energia**, cada uma com uma frase do que ela faz ("enche a barra de grimórios sozinha").
- As 8 melhorias de gerador somem; o que elas faziam de útil vira os itens "Geradores x2/x3/x5".

## 6. Grimórios (simples e por categoria)

Quatro categorias, todas com o efeito em **um número visível**, sem porcentagem e sem depender de mecânica que a pessoa não viu:

| Categoria | O que faz (exemplos) |
|---|---|
| **Toque** | +1 poeira por toque; a cada 10 toques o 10º rende x2; cada grimório no livro soma poeira por toque; cada colapso soma poeira por toque |
| **Energia** | +0,5 energia por toque; a barra do próximo grimório fica 1 toque menor; capturar um objeto dá energia; geradores de energia rendem +1/s |
| **Sorte** | +1 troca de carta por escolha; +1 carta na escolha; cartas raras e melhores aparecem mais; devolve a poeira de 2 toques a cada compra |
| **Objetos (gerais)** | objetos aparecem **mais cedo**; ficam **mais tempo** na tela; rendem **mais** (todos); aparecem **mais de um** de uma vez |

Mudanças em relação a hoje: **Sorte e Energia viram categorias separadas**; todos os grimórios de objetos deixam de falar de cometa, satélite ou Estrela Dourada em particular; saem os grimórios de combo (Sirius, Urano, Júpiter, Polaris) e de "sinal do satélite" (Io), porque dependem de mecânicas que o iniciante não conhece. Meta: **20 grimórios** (5 por categoria), 15 já na primeira vida. A raridade segue igual (nível por raridade, evolução "RARO -> LENDÁRIO").

## 7. Ideias para adicionar e melhorar

Em ordem de valor para "a pessoa entende e quer continuar":

1. **Objetivo fixado:** o próximo item aparece sempre no HUD como uma linha ("Lente Dupla: faltam 1,2 mil"), tocar abre a loja já nele. Dá um alvo claro a cada minuto.
2. **"Seus poderes"** (seção 3.6): o quadro de totais, que responde ao "não sei o que estou comprando".
3. **Antes -> depois na compra:** ao comprar, um aviso grande "Toque 4 -> 8" que sobe e some.
4. **Bem-vindo de volta (progresso fora do jogo):** os geradores continuam ganhando com o jogo fechado até um limite (ex.: 2 h); ao voltar, uma tela mostra "+3,4 mi de poeira enquanto você esteve fora". Combina com "geradores sempre no máximo".
5. **A estação cresce:** cada item comprado aparece na estação do fundo (um painel solar, uma antena, um anel). A pessoa **vê** a evolução, sem texto.
6. **Missão curta da sessão:** "junte 50 mil em 5 minutos" com uma recompensa pequena. Ensina o ritmo sem punir.
7. **Compra em um toque:** botão "comprar o próximo" na tela de jogo quando dá para pagar.
8. **Coleção de itens:** página com todos os itens do jogo (os que faltam em silhueta) e a era de cada um.
9. **Sons por era:** o "comprou" ganha timbre mais rico a cada era (bronze, prata, ouro).
10. **Modo "poucos minutos":** o jogo fica agradável em sessões curtas de celular (já sem Ritmo e combo, o toque é mais simples).

## 8. Decisões do Lucas (preciso das respostas antes de codar)

1. **Combo, crítico, "a cada N toques" e itens de objeto:** somem de vez (recomendo, é o que mais confunde), ou voltam depois como **habilidades** da Árvore (para quem já aprendeu o jogo)?
2. **Itens zeram a cada colapso** (como as melhorias de hoje; recomendo) ou passam a ser permanentes?
3. **Geradores x2/x3/x5 como itens** (recomendo): a vitrine de Itens mexe nos geradores, mas só multiplicando; quem cria e melhora o gerador continua sendo a aba Geradores.
4. **Saves antigos:** só o save do Lucas existe. Proposta: converter as compras antigas para o item novo mais parecido e **devolver em poeira** o que não tem equivalente, para ninguém perder progresso. Pode?
5. **Quantidade:** 19 itens na primeira vida e uns 30 no total é um bom número, ou quer menos?
6. **Grimórios:** 20 no total (5 por categoria) está bom?

## 9. Etapas (depois da aprovação)

1. **Motor:** catálogo novo de itens (5 tipos de efeito), geradores sem as melhorias de gerador, grimórios em 4 categorias, save v7 com migração, testes por efeito.
2. **Simulador:** recalibrar preços (cada item de 2 a 6 minutos depois de aparecer) e as metas de colapso; `sim.test.ts` verde.
3. **Interface:** aba Itens (próximo item em cartão grande, esmaecidos, "Seus poderes"), aba Geradores explicada, ícones SVG por item, objetivo fixado no HUD.
4. **Grimórios:** textos e categorias novas, página do livro com 4 categorias.
5. **Tutorial e docs:** o tutorial passa a ensinar o novo desenho (compra um item, vê o antes -> depois), e `HANDOFF.md`, `ARCHITECTURE.md` e `ROADMAP.md` são atualizados.
