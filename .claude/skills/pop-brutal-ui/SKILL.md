---
name: pop-brutal-ui
description: Tokens, componentes e animações do design Pop Brutal do NoCap. Use ao criar ou alterar qualquer tela, componente ou animação do web.
---

# Pop Brutal UI

Leia `docs/DESIGN.md` e abra a referência em `docs/reference/` (principalmente `prototipo-cor.html`) antes de codar.

- Cores só pelos tokens de `apps/web/src/styles/tokens.css` (`--paper --ink --orange --blue --yellow --white`).
- Borda `var(--border)` (2.5px), raio 12 a 20px, sombra dura `var(--shadow)`, sem blur.
- Fontes: Archivo (display/UI) e Space Mono (números e rótulos). Ícones SVG inline. **Sem emoji.**
- Botão: no `:active` translada para dentro da sombra (`transform: translate(5px,5px)` e sombra zero), volta com quique curto.
- Listas: entrada em sequência com stagger de 40 a 50 ms.
- Anime **só `transform` e `opacity`**. Envolva animações em `@media (prefers-reduced-motion: no-preference)`.
- Layout: celular tela cheia; PC coluna de ~440 px centralizada. Use `env(safe-area-inset-*)`.
- Funciona com toque, mouse e teclado (setas nos sliders, Enter confirma).
