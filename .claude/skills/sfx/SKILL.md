---
name: sfx
description: Receitas de som (Web Audio) do NoCap e quando usar cada uma. Use ao criar ou alterar sons, o módulo sfx ou o botão de mudo.
---

# SFX

Módulo único `apps/web/src/lib/sfx.ts`, compartilhado entre jogos. **Zero arquivos de áudio**: tudo gerado com Web Audio. As receitas exatas estão em `docs/reference/prototipo-cor.html`; porte de lá.

| Som       | Quando                           |
| --------- | -------------------------------- |
| `clack`   | toque em botão                   |
| `flip`    | a cor aparece                    |
| `vanish`  | a cor some                       |
| `slide`   | tique do slider                  |
| `tick(n)` | contagem da nota, subindo de tom |
| `thunk`   | carimbo da nota                  |
| `win`     | nota ≥ 9.5                       |
| `boing`   | nota < 5                         |

- Desbloquear o `AudioContext` no primeiro toque do usuário.
- `navigator.audioSession.type = 'ambient'` quando existir.
- Botão de mudo, escolha salva no `localStorage`.
- `navigator.vibrate` só onde existir (Android; iOS não suporta).
- **Jogo do Tempo: nenhum som durante a contagem.** Só depois da revelação.
