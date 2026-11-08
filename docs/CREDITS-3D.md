# Créditos dos modelos 3D de terceiros

O Lucas enviou estes pacotes em 04/11/2026 dizendo que são **gratuitos e liberados para uso**. Os nomes dos autores e a licença exata de cada um **ainda não foram conferidos** (os arquivos não trazem esses dados): antes de publicar na `main`, abrir cada página de origem e confirmar a licença e se exige crédito.

| Pacote enviado | O que usamos no Duna | Arquivos em `apps/web/public/models/foxshot/map/` |
|---|---|---|
| Apocalyptic Street (.usdz) | prédios do horizonte (6 peças) | `bld_a`, `bld_b`, `bld_c`, `bld_d`, `bld_e`, `bld_tower` |
| Road pack, not including the road (.usdz) | poste de luz, barreira, grade | `lamp`, `barrier`, `railing` |
| Castle Dungeon Wall, Asset (.usdz) | fachadas com arcos nas paredes das salas | `arch_a`, `arch_b` |
| Wall low poly (.usdz) | painel de muro de concreto (ainda sem uso no mapa) | `wall_panel` |
| low-poly-fps-map (.zip, FBX) | ainda não usado (é uma arena de paintball feita de tijolos soltos) | nenhum |

Conversão: `tools/art/map_props.py` (Blender via `bpy`, só ferramenta de trabalho). Cada peça sai em metros, com a origem no centro da base, só a textura de cor reduzida para 512 px (JPEG) e sem normal/metal, para ficar leve (todas juntas: cerca de 2 MB).
Os originais não entram no repositório.

## Arena de Blocos (modo PvP)

Mapa de mata-mata em blocos (FBX `CSDeathMatchMapMinecraft` com as texturas do pacote) enviado pelo Lucas em 08/11/2026. Autoria e licença não constam no pacote: confirmar antes de publicar. Usado em `apps/web/public/models/foxshot/pvp/pvp.glb` (gerado por `tools/art/pvp_build.py`).

## Dust 2 (modo Mata-mata e Bomba, ao lado da Duna)

Modelo `De_dust2.usdz` (106 malhas, texturas JPEG) enviado pelo Lucas em 08/11/2026. Autoria e licença não constam no arquivo: confirmar antes de publicar. Usado em `apps/web/public/models/foxshot/dust2/dust2.glb` (gerado por `tools/art/dust2_build.py`, que precisa de `usd-core` só como ferramenta de trabalho).
