# 085: Fox GP, Arcade com poderes

Status: etapas 0 a 5 feitas, offline e online (16/11/2026); falta calibrar jogando.

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
- Salas online: o líder (que já simula todos os carros) decide itens e acertos; ninguém manda acerto, só o pedido de usar. Ranking: só presets; **salas do modo Poderes
  não entram em ranking** (pergunta aberta abaixo).

## 5. Etapas

0. **Vitrine dos itens no Fox GP** (feito): 12 modelos 3D e página de prévia.
1. Lógica pura (feito): `packages/games/src/foxgp/items.ts` com 17 testes.
2. Caixas na pista, slot do item no HUD, escolha dos dois modos (feito): chips "Corrida" e "Poderes" na tela antes de correr (só no Arcade, treino offline).
3. Casca, bola, turbo, Superfox, orbitar e lançar (feito, `gp-items-layer.ts`). Tecla **F** ou **Shift** usa o item (E continua sendo o turbo do drift); no celular, toque no cartão do item.
4. Cometa, Cometa azul e bomba (feito, falta calibrar jogando).
5. Bots usando itens, sons e online (feito, 16/11/2026):
   - Bots usam o item depois de uma espera sorteada de 0,8 a 4 s.
   - Sons próprios em Web Audio (`foxgp-audio.ts`: pegar, usar por tipo, acerto, barrado, explosão com volume pela distância).
   - Online: o líder da sala liga o modo em **Configurar > MODO** (Corrida ou Poderes, só no Arcade). O líder simula os itens
     (`GpHost` recebe o `GpItemSystem`) e manda o estado dentro do snapshot (campo `it`); quem corre vê um espelho
     (`GpItemView`) e pede o uso pelo 9º valor da entrada (só vai quando vale 1, então o pacote não muda para quem não usa itens).
     Protocolo compatível com o anterior (mesma `GP_NET_VERSION`). Servidor da API só guarda a regra (`powers`) e a repassa.
   - Bots com estratégia (`gpBotUseItem`): tiro com alguém na frente, casca com alguém atrás, turbo e Superfox na reta, nunca guardam mais de 9 s.
   - Celular: botão redondo "Item" ao lado das setas (testado em 740x360); o cartão do HUD é só do PC.
   - Corrigido de passagem: a tela "Antes de correr" no celular deitado empilhava as seções umas sobre as outras (Voltas, Adversários e Modo no mesmo lugar).
   - Falta: calibrar jogando.

## 6. Perguntas abertas

- O modo Poderes entra em algum ranking? (proposta: não, como as salas personalizadas.)
- Nomes finais dos itens (os atuais são provisórios).
- Sons: gravar/sintetizar próprios (proposta: Web Audio, como o resto do Fox GP).

## 7. Revisão de 16/11/2026 (pedido do Lucas)

- **Bola:** anda colada ao traçado da pista (avanço + afastamento lateral) e quica nas bordas; antes seguia reta no mundo e saía da pista nas curvas. Raio de acerto dos tiros 3 m. No modelo, ela gira em torno do próprio centro (girar o grupo a enterrava no chão).
- **Casca e bomba no chão:** quem acerta dá duas voltas completas (volta de frente), perde velocidade (fica com 25%, e segue freando enquanto dura o tropeço de 1,4 s).
- **HUD:** cartão com o símbolo (SVG por poder), o nome, a tecla (F no PC, botão Item no celular) e quantos faltam; ao pegar uma caixa, aviso "Novo poder" com nome, descrição e tecla.
- **Visual:** halos e sombras nos modelos, coluna de luz nas caixas, rastro de brilho nos tiros, anel de aviso da bomba, explosões, faíscas ao pegar, acertar, bloquear e usar, brilho do Superfox.
