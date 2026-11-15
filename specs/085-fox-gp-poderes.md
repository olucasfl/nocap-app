# 085: Fox GP, Arcade com poderes

Status: etapas 0 a 3 feitas no treino offline (15/11/2026); faltam cometa/bomba afinados jogando, sons, online e docs.

## 1. Decisão do Lucas (15/11/2026)

- O Arcade passa a ter **dois modos**: **Corrida** (o que já existe, sem itens) e **Poderes** (com caixas e itens).
- Inspiração: o repositório Unity3D-Mario-Kart-Racing-Game (sem licença; itens e personagens são da Nintendo).
  **Não copiamos código nem arte dele.** Pegamos as ideias de jogo e refazemos tudo do zero, com a raposa e o visual
  do Fox GP (exceção 8 do RULES.md). O Lucas pediu cópia literal; ficou registrado que a arte não tem licença
  e é de terceiros, então os modelos são próprios. Se ele quiser outro caminho, é decisão dele e deve ser dita de novo.
- Entram: caixas na pista, item conforme a posição, 6 tipos de item, itens girando em volta do kart, bots usando itens.
- Ficam de fora: moedas, arrancada perfeita, turbo de truque, perigos na pista.

## 2. Itens (12 modelos, 8 poderes)

| Id | Nome | Efeito |
| --- | --- | --- |
| box | Caixa misteriosa | dá um item ao passar; volta depois de ~3 s |
| peel / peel3 | Casca (e tripla) | fica na pista; quem pisa roda e perde velocidade |
| ball / ball3 | Bola (e tripla) | vai reta, quica nas paredes, derruba quem acerta |
| seeker / seeker3 | Cometa (e triplo) | persegue o carro da frente pela linha da pista |
| bomb | Bomba | explode em área depois de uns segundos |
| nitro / nitro3 | Turbo (e triplo) | impulso curto (reaproveita o turbo do drift) |
| star | Superfox | invencível e mais rápido por ~8 s |
| bolt | Cometa azul | persegue quem lidera e o derruba |

Triplo = três cópias girando em volta do kart como escudo; cada toque no botão lança uma.

## 3. Item conforme a posição

Tabela de pesos por posição (1º a último), nossa, na lógica pura: o líder recebe itens fracos (casca, bola, turbo),
o meio recebe cometa e bomba, quem está atrás recebe triplos, Superfox e Cometa azul. O Cometa azul nunca sai para
quem lidera. Com 2 a 20 carros a posição vira faixa (frente, meio, trás).

## 4. Onde fica o código

- `packages/games/src/foxgp/items.ts`: catálogo, pesos por posição, efeito de cada item, recarga da caixa (puro, testado).
- `apps/web/src/games/foxgp/item-models.ts`: modelos 3D (feito na etapa 0).
- `apps/web/src/games/foxgp/GpItemsPreview.tsx`: vitrine em `/fox-cap/foxgp-itens` (feito na etapa 0).
- Cena: caixas na Bala Track, item no chão, orbitando, lançado; HUD com o slot do item; escolha do modo na tela do Arcade.
- Salas online: o servidor decide itens e acertos (nada vindo do cliente). Ranking: só presets; **salas do modo Poderes
  não entram em ranking** (pergunta aberta abaixo).

## 5. Etapas

0. **Vitrine dos itens no Fox GP** (feito): 12 modelos 3D e página de prévia.
1. Lógica pura (feito): `packages/games/src/foxgp/items.ts` com 17 testes.
2. Caixas na pista, slot do item no HUD, escolha dos dois modos (feito): chips "Corrida" e "Poderes" na tela antes de correr (só no Arcade, treino offline).
3. Casca, bola, turbo, Superfox, orbitar e lançar (feito, `gp-items-layer.ts`). Tecla **F** ou **Shift** usa o item (E continua sendo o turbo do drift); no celular, toque no cartão do item.
4. Cometa, Cometa azul e bomba (feito, falta calibrar jogando).
5. Bots usando itens (feito, simples: usam depois de uma espera sorteada). Falta: sons próprios, online (servidor decide), botão de toque melhor, testes de tela no celular e docs.

## 6. Perguntas abertas

- O modo Poderes entra em algum ranking? (proposta: não, como as salas personalizadas.)
- Nomes finais dos itens (os atuais são provisórios).
- Sons: gravar/sintetizar próprios (proposta: Web Audio, como o resto do Fox GP).
