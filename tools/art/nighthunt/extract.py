#!/usr/bin/env python3
"""Extrai do projeto Slash The Hordes (Cocos Creator) o atlas de sprites, as animações de quadros e os áudios
usados pelo Night Hunt. Uso: python3 extract.py <pasta do repositório Slash> <saída: apps/web/public/nighthunt>
Origem e licença registradas em docs/ASSETS-NIGHTHUNT.md."""
import json, os, shutil, sys, glob
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
media = os.path.join(src, 'assets', 'Media')
img_root = os.path.join(media, 'Images', 'Game')
SKIP = ('UI/Y8Logo', 'UI/Y8LogoSplash')

# uuid do sprite-frame -> nome (caminho relativo sem extensão)
uuid2name = {}
names = []
for p in sorted(glob.glob(os.path.join(img_root, '**', '*.png'), recursive=True)):
    rel = os.path.relpath(p, img_root)[:-4].replace(os.sep, '/')
    if rel in SKIP:
        continue
    meta = json.load(open(p + '.meta'))
    for sid, sm in meta.get('subMetas', {}).items():
        if sm.get('importer') == 'sprite-frame':
            uuid2name[meta['uuid'] + '@' + sid] = rel
    names.append((rel, p))

# atlas por prateleiras
ims = [(n, Image.open(p).convert('RGBA')) for n, p in names]
ims.sort(key=lambda t: (-t[1].height, -t[1].width))
W = 1024
x = y = rowh = 0
frames = {}
pos = []
for n, im in ims:
    w, h = im.size
    if x + w + 1 > W:
        x = 0; y += rowh + 1; rowh = 0
    pos.append((n, im, x, y))
    frames[n] = {'x': x, 'y': y, 'w': w, 'h': h}
    x += w + 1; rowh = max(rowh, h)
H = 1
while H < y + rowh + 1:
    H *= 2
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for n, im, px, py in pos:
    atlas.paste(im, (px, py))
os.makedirs(out, exist_ok=True)
atlas.save(os.path.join(out, 'atlas.png'), optimize=True)

# animações de quadros
anims = {}
for p in sorted(glob.glob(os.path.join(media, 'Animation', 'Game', '**', '*.anim'), recursive=True)):
    d = json.load(open(p))
    if not isinstance(d, list):
        continue
    clip = d[0]
    seq = None
    for o in d:
        if o.get('__type__') == 'cc.ObjectCurve' and o.get('_values') and any(isinstance(v, dict) and '__uuid__' in v for v in o['_values']):
            seq = [{'t': t, 'f': uuid2name.get(v['__uuid__']) if isinstance(v, dict) else None} for t, v in zip(o['_times'], o['_values'])]
            break
    if not seq:
        continue
    key = os.path.relpath(p, os.path.join(media, 'Animation', 'Game'))[:-5].replace(os.sep, '/')
    anims[key] = {'duration': clip['_duration'], 'loop': clip.get('wrapMode', 1) in (2, 22), 'frames': seq}
# fundos: decoração sobre o chão verde (75, 109, 59), 5 blocos de 512x512
bgs = []
for p in sorted(glob.glob(os.path.join(media, 'Prefabs', 'Game', 'Background', '*.prefab'))):
    d = json.load(open(p))
    items = []
    for o in d:
        if o.get('__type__') == 'cc.Node' and o.get('_name', '').startswith(('grass', 'dirt', 'stone')):
            sp = None
            for c in o.get('_components', []):
                comp = d[c['__id__']]
                if comp.get('__type__') == 'cc.Sprite':
                    sp = uuid2name.get(comp['_spriteFrame']['__uuid__'])
            if sp:
                items.append({'f': sp, 'x': round(o['_lpos']['x'], 2), 'y': round(o['_lpos']['y'], 2), 's': o['_lscale']['x']})
    bgs.append(items)
json.dump({'size': [W, H], 'frames': frames, 'anims': anims, 'bgs': bgs}, open(os.path.join(out, 'atlas.json'), 'w'), separators=(',', ':'))

# áudio
adir = os.path.join(out, 'audio')
os.makedirs(adir, exist_ok=True)
amap = {
    'Music/Goblins_Dance_(Battle).mp3': 'music.mp3',
    'Sound/PM_BBI_Bullet_Impact_Hit_Body_Flesh_25 v3.mp3': 'enemy-hit.mp3',
    'Sound/GP_Turbo_Discard_2.mp3': 'player-hit.mp3',
    'Sound/GP_Begin_Turn_1.mp3': 'player-death.mp3',
    'Sound/Sword Combo v3.mp3': 'sword.mp3',
    'Sound/12_human_jump_3 v2.mp3': 'xp.mp3',
    'Sound/coin.1.mp3': 'gold.mp3',
    'Sound/GP_Heal_1.mp3': 'heal.mp3',
    'Sound/Magnet v3.mp3': 'magnet.mp3',
    'Sound/01_chest_open_1.mp3': 'chest.mp3',
    'Sound/Special_Powerup_10.mp3': 'level-up.mp3',
    'Sound/Headbutt v2.mp3': 'horizontal.mp3',
    'Sound/Magic_Spells_CastShort_Push14 v3.mp3': 'diagonal.mp3',
    'Sound/15_human_dash_2.mp3': 'halo.mp3',
    'Sound/222400 - Dynamic Vacuum Suction 01 - Loop v3.mp3': 'suction.mp3',
}
for k, v in amap.items():
    shutil.copy(os.path.join(media, 'Audio', 'Game', k), os.path.join(adir, v))
shutil.copy(os.path.join(media, 'Audio', 'Menu', 'Special_Powerup_09.mp3'), os.path.join(adir, 'menu-open.mp3'))
shutil.copy(os.path.join(media, 'Audio', 'Shared', 'UI_Click_1.mp3'), os.path.join(adir, 'click.mp3'))
# fontes bitmap (BMFont): Square (latim completo) e Bonk Fatty (títulos, sem acentos)
fdir = os.path.join(out, 'fonts')
os.makedirs(fdir, exist_ok=True)
for fnt, png, name in (('Square/Square.fnt', 'Square/Square_0.png', 'square'), ('Bitmap/bonkfat.fnt', 'Bitmap/bonkfat_0.png', 'bonk')):
    shutil.copy(os.path.join(media, 'Fonts', fnt), os.path.join(fdir, name + '.fnt'))
    shutil.copy(os.path.join(media, 'Fonts', png), os.path.join(fdir, name + '.png'))
print('frames', len(frames), 'atlas', W, H, 'anims', len(anims))
