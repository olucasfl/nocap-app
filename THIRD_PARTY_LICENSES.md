# Licenças de terceiros

## ai-f1-racing-game

https://github.com/hirosichen/ai-f1-racing-game

Partes do Fox GP (física do modo Realista, IA dos bots, geometria do carro, texturas feitas por código, cenário e som
do motor) foram copiadas e adaptadas deste projeto (spec 080).

```
MIT License

Copyright (c) 2026 Vibe Game Lab

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

```

## Kart do Fox GP (`racing-kart.zip`, GoCart)

Modelo 3D de kart com piloto (OBJ/FBX, exportado do 3ds Max em 28/06/2020). **Origem desconhecida, uso autorizado pelo
Lucas** (spec 081, decisão 13). Adaptado por `tools/art/kart/build_kart.py` (piloto simplificado, cabeça trocada pela
raposa feita em código, peças separadas e pivôs) para `apps/web/public/models/foxgp/kart.glb` e `kart-lod.glb`.

## Bala Track (`Karting_Club_Lider__Outdoor_Race_Track_Ready.usdz`)

Pista de kart "Karting Club Lider" (USDZ, pelos nomes vinda do Sketchfab). **Origem e licença desconhecidas, uso
autorizado pelo Lucas** (spec 081, decisão 13). Só o traçado (linha central, largura, pilhas de pneus) foi extraído por
`tools/art/track/extract_track.py` para `packages/games/src/foxgp/track-bala.ts`; a cena do jogo é gerada em código a
partir dele (nenhuma malha ou textura do arquivo vai para o jogo).

## Sons do Fox GP

Todos sintetizados em Web Audio (`apps/web/src/lib/foxgp-audio.ts`): nenhum arquivo de áudio de terceiros.
