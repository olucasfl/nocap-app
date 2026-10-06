# 005: Modo noturno

> **Status: pendente.** Pedido do Lucas após o primeiro teste do jogo da Cor ("o app precisa ter modo noturno"). Fecha a decisão #12 do brief. Nada implementado ainda.

## Objetivo

O app inteiro (Hub, jogos, abas, PWA) funciona em tema claro e escuro, sem perder a identidade Pop Brutal.

## Regras

- Três opções: **Automático** (segue o sistema, padrão), **Claro** e **Escuro**. A escolha fica salva no aparelho.
- O tema vale para todas as telas e jogos, atuais e futuros. Nenhuma tela usa cor solta: tudo passa pelos tokens de `apps/web/src/styles/tokens.css`.
- O tema é aplicado **antes da primeira pintura** (script inline no `index.html` que lê a escolha e põe `data-theme` no `<html>`), para não piscar branco ao abrir no escuro.
- As cores de destaque (laranja, azul, amarelo) e as **cores dos jogos** (alvo e resposta da Cor) **não mudam** entre temas. O que muda é papel, tinta, superfícies e sombras.
- Onde fica o controle: um chip no topo do Hub, ao lado do botão de som, até a aba Perfil existir; depois também no Perfil.
- `<meta name="theme-color">` e o `theme_color`/`background_color` do manifesto acompanham o tema (a tela de abertura da PWA não pode abrir clara num app escuro).
- Respeitar `prefers-reduced-motion` na troca de tema (sem transição longa).

## Decisões de design a tomar antes de codar

O Pop Brutal depende de **borda grossa em tinta** e **sombra dura sem blur**. No escuro isso quebra se for só inverter:

1. **Borda e sombra:** tinta clara (`#F4F4EF`) sobre fundo escuro, ou borda clara com sombra preta? Testar legibilidade da sombra dura num fundo `#14140F`.
2. **Superfícies:** `--white` (cartas, chips, linhas) vira um cinza-grafite; definir 2 níveis (fundo e superfície).
3. **Texto sobre accent:** o laranja e o amarelo seguem com texto preto; o azul segue com texto branco.
4. **Cor atrás da amostra:** a área ao redor da cor-alvo não pode distorcer a percepção (preferir neutro médio-escuro, sem tom).
5. **Telas de referência escuras:** desenhar Hub, início da Cor, recriar, resultado e final no escuro e guardar em `docs/reference/` antes de implementar.

## Telas e fluxo

Chip de tema (ícone sol/lua, cicla Automático → Claro → Escuro) no topo do Hub. Sem tela nova.

## Critérios de aceite

- [ ] Com o sistema em escuro e a escolha em Automático, o app abre escuro, sem flash claro.
- [ ] A escolha manual persiste após fechar e reabrir o app e vale em todas as rotas.
- [ ] Todas as telas existentes (Hub, abas, início, memorizar, recriar, resultado, final) são legíveis nos dois temas: contraste de texto ≥ 4.5:1, borda e sombra visíveis.
- [ ] As cores mostradas nos jogos (alvo e resposta) são idênticas nos dois temas.
- [ ] `theme-color` e o manifesto da PWA seguem o tema.
- [ ] Nenhum valor de cor literal novo fora de `tokens.css`.

## Fora de escopo

Temas além de claro/escuro, troca automática por horário, personalização de accent.

## Decisões em aberto

- Pontos 1 a 5 acima (design).
- O manifesto só tem uma cor de fundo estática: aceitar o `background_color` do tema padrão na tela de abertura da PWA, ou gerar dois manifestos?
