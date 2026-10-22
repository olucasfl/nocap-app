# 039 · Aperta!: economia v2 (toque conquistado, geradores e raros)

Status: **rascunho (22/10/2026)**, à espera do "sim" do Lucas nas decisões da seção 9. Nada foi implementado. Quando aprovada, **substitui a seção 5.1 da spec 038** (melhorias) e obriga a recalibrar a seção 6.6 (vidas).

## 1. Por que

Hoje o Pulso Solar dá +1 poeira por toque a cada nível (até 40, preço base 25) e os grimórios multiplicam isso: em poucos minutos o toque rende 40 a 50 e a progressão perde o sentido. No Cookie Clicker o toque quase não cresce; cresce a **produção por segundo**, e o toque só dobra em marcos raros e caros. O progresso "demora, mas demora bom".

## 2. Regras ditadas pelo Lucas (22/10/2026)

1. O toque começa em **1** e **tem que ser conquistado**: nada de dezenas de poeira por toque em minutos.
2. Melhorias dão **produção automática por segundo** (geradores) e **melhorias de toque**, em listas separadas.
3. **O farm automático nunca pode ser melhor do que tocar.**
4. A aba Melhorias tem **duas abas: Toque e Geradores**. Cada aba mostra no início a **1ª melhoria** com o valor e **uma futura sem dizer o que é**, só com o valor; o que ela é aparece quando a poeira chega perto do preço. Ao desbloquear uma, surgem as novas e só então aparece o **valor da próxima**.
5. Os **grimórios continuam como estão** (escolha 1 entre 3 pela barra de energia), mas passam a dar efeitos que ajudam: geradores, objetos, sorte, bônus.
6. **Objetos:** comuns (aparecem pouco, mas já ajudam) e **raros** (estilo biscoito dourado). Grimórios podem aumentar a frequência e a recompensa dos comuns e a chance dos raros, **sem deixar o raro aparecer toda hora**.
7. Progresso linear, mas **nada "do nada"**: tudo que surge é anunciado.

## 3. Aba Toque

Toque base = **1**. Sobe por **muitas melhorias de preços próximos** (100, 225, 500, 850, 1.000, 1.500, 2.000, 5.000, 8.000, 10.000...), **de tipos variados**, não só "dobra o toque". Pode haver mais de uma com o mesmo preço. Cada uma é compra única. Lista inicial (preços e números a calibrar no simulador):

| Melhoria | Preço | O que faz |
|---|---|---|
| Lente Polida | 100 | toque ×2 |
| Luvas de Astronauta | 225 | +1 poeira por toque (valor plano) |
| Dedo Treinado | 500 | a cada 25 toques, o 25º rende ×5 |
| Ritmo Firme | 850 | tocando a 3 por segundo ou mais, +25% no toque |
| Toque Magnético | 1.000 | cada toque encurta em 0,5 s a espera do próximo objeto (seção 8) |
| Mãos do Astronauta | 1.000 | a cada 10 geradores comprados (somados), +1 no toque |
| Pulso Carregado | 1.500 | cada toque enche +10% mais a barra de energia |
| Toque de Sorte | 2.000 | 4% de chance de o toque render ×10 |
| Aquecimento | 3.000 | após 5 s tocando sem parar, +50% no toque até soltar por 2 s |
| Lente Dupla | 5.000 | toque ×2 |
| Eco | 8.000 | cada toque rende +1% do auto por segundo (teto de +50% do toque) |
| Cabine Reforçada | 10.000 | toque ×2 |

Depois seguem degraus de ~2 a 3× entre as melhorias, mantendo **variedade de tipo**, até o fim da lista do 1º colapso. O toque total só cresce por esse caminho, então a regra da seção 1 (nada de dezenas por toque em poucos minutos) vira meta testada no simulador: toque efetivo de cerca de 1 no início, 2 aos 5 min, ~4 aos 15 min, 15 a 25 em 1 h.

## 4. Aba Geradores

Preço da n-ésima unidade: `base × 1,15^n`. Cada gerador novo é ~10× mais caro e ~6 a 10× mais forte que o anterior (valores iniciais, a calibrar):

| Gerador | Preço base | Poeira por segundo |
|---|---|---|
| Satélite | 15 | 0,1 |
| Sonda Voyager | 100 | 1 |
| Telescópio | 1.100 | 8 |
| Observatório | 12.000 | 47 |
| Estação Orbital | 130.000 | 260 |
| Colônia Lunar | 1,4 milhão | 1.400 |
| Frota Estelar | 20 milhões | 7.800 |
| Portal | 330 milhões | 44.000 |

O Telescópio Hubble atual (ganho passivo) é absorvido por esta lista.

### 4.1 Melhorias de gerador (criativas, não só "+X%")
Marcos de quantidade (10, 25, 50) dobram o gerador. Fora isso, cada uma muda **como** o gerador funciona:
- **Rede:** cada Sonda comprada dá +1% aos Satélites (sinergia entre vizinhos).
- **Rajada:** a cada 60 s os geradores soltam de uma vez 10 s da própria produção (respeita o ritmo ativo).
- **Hora de pico:** capturar um objeto faz os geradores renderem +50% por 20 s.
- **Escala:** a cada 25 unidades de um gerador, o toque ganha +1.
- **Fila de pedidos:** comprar 10 de uma vez sai 5% mais barato.
- **Conversão:** os geradores também enchem a barra de energia (equivale a 1 toque por minuto de produção).
- **Isca:** o Satélite atrai objetos (encurta a espera do próximo objeto em 1 s por 10 Satélites, com teto).
- **Revezamento:** o gerador menos comprado rende ×2 (incentiva variar a compra).

### 4.2 Geradores de energia
Além dos de poeira, a aba Geradores tem uma fileira de **geradores de energia**: em vez de poeira por segundo, enchem a **barra que dá grimórios**. Custam poeira, mesma fórmula de preço (`base × 1,15^n`) e entram na mesma revelação com "???" (seção 6). A produção é medida em **toques equivalentes por segundo** (1 = o que um toque enche hoje), para acompanhar o passo da barra.

| Gerador de energia | Preço base | Energia por segundo (toques equivalentes) |
|---|---|---|
| Antena | 400 | 0,02 |
| Receptor de Sinal | 3.000 | 0,1 |
| Matriz de Escuta | 30.000 | 0,5 |
| Rede Profunda | 400.000 | 2,5 |

- Valem as mesmas regras anti-farm da seção 5: 100% tocando, 25% parado, e um **teto de 35%** da energia que os toques enchem a 2,5 toques/s. Sem isso, a pessoa ganharia grimório sem tocar, que é exatamente o que o Lucas não quer.
- Efeitos de grimório e melhorias de gerador (4.1) podem tocar nesta fileira: +% de energia, Conversão, Rajada de energia.
- Esta fileira é a forma "comprada" de acelerar grimórios; o passo da barra (`ENERGY_STEPS`) é recalibrado na etapa A para que energia por geradores nunca dispense o toque.

## 5. Regra anti-farm (ritmo ativo)

- Os geradores rendem **100% enquanto a pessoa toca** (toque nos últimos 4 s) e **25% parada**.
- O auto total tem ainda um **teto de 35%** do que o toque rende a 2,5 toques/s.
- A tela mostra "Auto: X/s (parado: Y/s)".
- Invariante testada no simulador: para qualquer estado, tocar rende estritamente mais que ficar parado.

## 6. Revelação e indicações

- Cada aba mostra a 1ª melhoria e **um "???" com só o preço**; o nome e o efeito aparecem quando a poeira chega a **60% do preço**.
- Ao comprar ou liberar uma, a próxima sai do escuro e a seguinte vira "???".
- Bolinha de aviso no botão Melhorias quando algo cabe no bolso; faixa "Novo" e seta do tutorial **uma vez por categoria** (geradores, toque, marcos).
- O tutorial atual (passos 1 a 7) é ajustado: a "1ª melhoria" passa a ser o Satélite de 15.

## 7. Grimórios (mesmas regras de escolha, novos efeitos)

Grimório não dá "+X por toque" direto; dá multiplicadores, janelas e sorte. Efeitos novos (por família; o mapa exato à família existente fica para a spec de conteúdo):

- **Geradores:** +% de uma faixa (ou de todos); desconto pequeno no preço (piso de 40% já existente).
- **Ritmo:** janela do ritmo ativo maior (4 s para até 8 s); piso parado de 25% para até 40% (nunca acima do ativo).
- **Combo:** o combo cheio dá bônus extra no toque por tempo limitado.
- **Objetos comuns:** aparecem mais, duram mais, rendem mais.
- **Raros:** reduzem o intervalo entre raros (seção 8, com piso) e aumentam a duração do efeito.
- **Sorte:** chance de grimório de raridade maior, rerroll grátis, uma carta extra na escolha.
- **Proibidos:** bônus altos com um custo (como hoje).

## 8. Objetos

- **Comuns** (Cometa, Estrela cadente, Satélite, Sonda, Asteroide): só depois da 1ª melhoria. **Um a cada 60 s, com margem até 90 s:** passados 60 s do último, o próximo nasce num instante aleatório até os 90 s. Rendem o equivalente a ~30 s de produção (toque mais auto no ritmo ativo). Upgrades e grimórios **encurtam as duas pontas** da janela (60 e 90) na mesma proporção, com piso de **30 s a 45 s**; também aumentam a recompensa. Campo com no máximo 1 objeto no começo.
- **Raros** (nome a definir; ex.: Estrela Dourada): intervalo base de **8 min** (±25%), duram **10 s**, efeitos sorteados: Frenesi (toque ×7 por 30 s), Chuva de poeira (~15 min de produção de uma vez) e Ressonância (geradores a 100% mesmo parado por 60 s).
- **Freio contra abuso:** o intervalo entre raros **nunca cai abaixo de 5 min**, mesmo empilhando grimórios; o efeito do raro nunca excede ~15 min de produção. Sorteio pelo tempo de jogo, não pelo `rngState` das cartas.

## 9. Decisões em aberto (do Lucas)

1. **Ritmo ativo (100% tocando, 25% parado) mais o teto de 35%,** ou só o teto?
2. **Zerar os saves do Aperta! (só o do Lucas existe) ou migrar?** Recomendo zerar: a economia muda por inteiro.
3. **Revelar a melhoria a 60% do preço** está bom, ou prefere outro ponto?
4. **Nomes** dos geradores e do raro.

## 10. Etapas (depois da aprovação)

- **A. Motor e simulador:** `UPGRADES` vira toque + geradores, ritmo ativo, marcos, `validateSave`, testes (inclui a invariante da seção 5) e recalibração das vidas 1 a 5.
- **B. Web:** abas Toque e Geradores, "???", indicações e ajuste do tutorial.
- **C. Grimórios:** efeitos novos e textos das cartas.
- **D. Objetos:** comuns raros e os raros de ouro, com o freio.
- **E. Calibragem jogando com o Lucas.**

Riscos: mexe na tabela 6.6 da spec 038 (colapso 1 em ~8 h); tudo passa pelo simulador antes de ir para a tela.
