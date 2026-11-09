# Spec 064: Counter Fox, granada de fumaça, 1 granada de cada e a C4 junto das armas

Status: em andamento (09/11/2026). Pedido do Lucas: a granada de fumaça (modelo `sci-fi-smoke-grenade`), com as regras do CS (tamanho, duração, física), que limita a visão sem bloquear tiro nem corpo; só 1 granada de cada tipo em todos os modos; e o ícone da C4 junto das armas do terrorista (tecla Z, igual a pegar uma arma na mão).

## Regras da fumaça (CS)
- Preço 300 na loja. Voa e quica como as outras (`fsGrenadeLaunch`/`fsGrenadeStep`) e estoura quando para de quicar depois de ter quicado (ou em 2,6 s).
- Nuvem de 3,6 m de raio (144 u do CS), cresce em ~1 s e dura 18 s, encolhendo nos últimos 3 s (`FS_SMOKE`, `fsSmokeRadius`).
- Tapa a **visão**, não o tiro nem o corpo: `fsSmoked` (linha de visão com mais de 1 m dentro da esfera) entra na percepção dos bots (`fsDmStep`, `ctx.smokes`); quem joga vê pelo desenho. Bots perdem de vista quem está atrás da fumaça, mas andam por ela normalmente.
- Servidor: `smokes` na `FsNetSim`; o quadro leva `sm` (id, posição, vida e idade) para quem entra no meio; o estouro sai no evento `boom` com `kind: 'smoke'`.
- Bots: compram fumaça (300) com o que sobra do colete; TRs jogam a fumaça no posto principal dos CTs na entrada; CTs jogam na rota de entrada da bomba em apuros.

## Desenho
- Modelo: `tools/art/smoke_grenade_build.py` (FBX do Lucas via `fbx2obj.mjs` -> `ref/smoke.glb`, 15 cm, cor base 512 px).
- Nuvem: o `.blend` enviado é um volume do Cycles (Blender), que não roda no navegador. Foi feita uma própria: 44 bolhas cinza quase opacas (`addSmoke` em `FoxShotScene.ts`); de dentro, a névoa do mapa fecha a poucos metros.

## Limite e C4
- `FS_GRENADES[*].max = 1` (explosiva, de luz e fumaça), em todos os modos.
- HUD: o espaço da C4 aparece entre as armas do terrorista que a leva, com a tecla de pegar na mão (`bombSlot`, Z); ícones novos `smoke.png` e `c4.png` (`bake-weapon-icons.mjs`).

## Falta
Tecla própria da fumaça nas opções (`grenadeSmoke`, vazia por padrão: usa a tecla geral de granadas); bots offline no mata-mata não usam fumaça; confirmar autoria/licença do modelo (docs/CREDITS-3D.md).
