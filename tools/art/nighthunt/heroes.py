"""
Sprites dos heróis do Night Hunt a partir do guerreiro do Kael (mesmo tamanho 32x32, mesmas animações).
Técnica: troca de paleta por região (armadura, calça, couro), tira a espada da mão, desenha a arma do herói no
mesmo lugar e acrescenta capuz, cabelo ou barba por cima. Uso: python3 heroes.py <atlas.png> <atlas.json> <saida-dir>
"""
import colorsys, json, math, sys
from PIL import Image

FRAMES = ['Idle00', 'Idle01', 'Move00', 'Move01', 'Move02', 'Move03', 'Die00', 'Die01', 'Die02']
# deslocamento vertical da cabeça em cada quadro (o corpo balança 1 px)
HEAD_DY = {'Idle00': 0, 'Idle01': 1, 'Move00': -1, 'Move01': 0, 'Move02': -1, 'Move03': 0}
# onde está a lâmina em cada quadro: (linhas, x0, x1) e as pontas (mão -> ponta)
BLADE = {
    'Idle00': ((19, 22), 8, 20, (21, 19), (8, 21)),
    'Idle01': ((19, 22), 6, 20, (21, 19), (6, 21)),
    'Move00': ((17, 20), 7, 20, (21, 17), (7, 19)),
    'Move01': ((17, 18), 5, 19, (20, 17), (5, 17)),
    'Move02': ((17, 20), 6, 20, (20, 17), (6, 19)),
    'Move03': ((19, 23), 12, 22, (23, 19), (12, 22)),
    'Die00': ((25, 29), 1, 17, (17, 26), (1, 27)),
    'Die01': ((28, 30), 2, 18, (17, 29), (2, 29)),
    'Die02': ((26, 29), 13, 18, (18, 27), (13, 28)),
}
INK = (18, 24, 43, 255)


def hx(c, a=255):
    c = c.lstrip('#')
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), a)


def cls(p):
    r, g, b, al = p
    if al < 20:
        return '.'
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    h *= 360
    if v < 0.22:
        return '#'
    if s < 0.30 and v > 0.85:
        return 'W'
    if s < 0.40 and v > 0.6:
        return 'L'
    if s < 0.45 and v >= 0.35:
        return 'm'
    if 195 < h < 250 and s >= 0.45:
        return 'B' if v > 0.55 else 'b'
    if h >= 325 or h < 12:
        return 'R' if v > 0.5 else 'r'
    if 12 <= h < 50:
        return 'k' if s > 0.45 and v > 0.7 else 'o'
    if 50 <= h < 70:
        return 'Y'
    return '?'


def reh(p, hue, sat=1.0, val=1.0):
    """Troca o matiz mantendo o relevo de luz e sombra."""
    r, g, b, a = p
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    nr, ng, nb = colorsys.hsv_to_rgb((hue % 360) / 360, min(1, s * sat), min(1, v * val))
    return (round(nr * 255), round(ng * 255), round(nb * 255), a)


def tone(p, c):
    """Pinta com a cor `c` mantendo a luminosidade relativa do pixel original."""
    r, g, b, a = p
    l = (0.3 * r + 0.59 * g + 0.11 * b) / 255
    k = 0.45 + l * 0.9
    return (min(255, round(c[0] * k)), min(255, round(c[1] * k)), min(255, round(c[2] * k)), a)


class Canvas:
    def __init__(self, im):
        self.im = im
        self.px = im.load()

    def put(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < 32 and 0 <= y < 32:
            self.px[x, y] = c if len(c) == 4 else (*c, 255)

    def behind(self, x, y, w, h, c):
        """Pinta só onde não há corpo (transparente ou contorno): para cabelo e capa que ficam atrás."""
        for j in range(h):
            for i in range(w):
                xx, yy = int(x + i), int(y + j)
                if 0 <= xx < 32 and 0 <= yy < 32 and cls(self.px[xx, yy]) in '.#':
                    self.px[xx, yy] = c if len(c) == 4 else (*c, 255)

    def rect(self, x, y, w, h, c):
        for j in range(h):
            for i in range(w):
                self.put(x + i, y + j, c)

    def line(self, x0, y0, x1, y1, c, t=1):
        x0, y0, x1, y1 = round(x0), round(y0), round(x1), round(y1)
        dx, dy = abs(x1 - x0), abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx - dy
        while True:
            for j in range(t):
                for i in range(t):
                    self.put(x0 + i, y0 + j, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x0 += sx
            if e2 < dx:
                err += dx
                y0 += sy

    def outline(self):
        """Contorno escuro de 1 px em volta de tudo que foi acrescentado (pixel transparente vizinho de opaco)."""
        w, h = self.im.size
        src = self.im.copy().load()
        for y in range(h):
            for x in range(w):
                if src[x, y][3] == 0:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3] > 0 and src[nx, ny][:3] != INK[:3]:
                            self.px[x, y] = INK
                            break


def load_frames(atlas, meta):
    fr = json.load(open(meta))['frames']
    a = Image.open(atlas).convert('RGBA')
    out = {}
    for n in FRAMES:
        f = fr['Player/PlWarrior' + n]
        out[n] = a.crop((f['x'], f['y'], f['x'] + 32, f['y'] + 32))
    return out


# ------------------------------------------------------------------ armas (desenhadas do punho até a ponta)
def axis(hand, tip):
    dx, dy = tip[0] - hand[0], tip[1] - hand[1]
    n = math.hypot(dx, dy) or 1
    return dx / n, dy / n, n


def at(hand, tip, t, s=0.0):
    """Ponto na arma: t = distância ao longo do cabo a partir da ponta (px, + para dentro), s = lado."""
    ux, uy, n = axis(hand, tip)
    px_, py_ = -uy, ux
    return tip[0] - ux * t + px_ * s, tip[1] - uy * t + py_ * s


def haft(c, hand, tip, col, hi=None, t=1):
    c.line(hand[0], hand[1], tip[0], tip[1], col, t)
    if hi:
        c.line(hand[0], hand[1] - 1, tip[0], tip[1] - 1, hi, 1)


def w_whip(c, hand, tip, fr):
    leather, hi = hx('#6a3a1a'), hx('#a8683a')
    mid = at(hand, tip, 6)
    haft(c, hand, mid, leather, hi)
    # espiral de couro: três voltas em anel no fim do cabo
    cx, cy = at(hand, tip, 3, 0)
    for k in range(14):
        a = k / 14 * 2 * math.pi
        c.put(cx + math.cos(a) * 3.2, cy + math.sin(a) * 3.2, hx('#e0b878'))
    for k in range(14):
        a = k / 14 * 2 * math.pi
        c.put(cx + math.cos(a) * 2.0 + 0.5, cy + math.sin(a) * 2.0, hx('#9a6a3a'))
    ex, ey = at(hand, tip, -1, 1)
    c.line(cx - 3, cy + 3, ex - 1, ey + 4, hx('#e0b878'))
    c.put(ex - 1, ey + 4, hx('#ff3a4a'))
    c.put(ex, ey + 4, hx('#ff7a5a'))
    c.rect(hand[0] - 1, hand[1] - 1, 2, 3, hx('#ffd23f'))


def w_wand(c, hand, tip, fr):
    c.line(hand[0], hand[1], tip[0], tip[1], hx('#8a5a2a'))
    c.line(hand[0], hand[1] - 1, tip[0], tip[1] - 1, hx('#c99a5a'))
    c.rect(hand[0] - 1, hand[1] - 1, 2, 3, hx('#ffd23f'))
    x, y = tip
    glow = hx('#7ffff0') if fr % 2 == 0 else hx('#bffff8')
    for dx, dy, col in [(0, 0, hx('#ffffff')), (-1, 0, glow), (1, 0, glow), (0, -1, glow), (0, 1, glow),
                        (-2, 0, hx('#3fd8c8')), (2, 0, hx('#3fd8c8')), (0, -2, hx('#3fd8c8')), (0, 2, hx('#3fd8c8')),
                        (-1, -1, hx('#3fd8c8')), (1, -1, hx('#3fd8c8')), (-1, 1, hx('#3fd8c8')), (1, 1, hx('#3fd8c8'))]:
        c.put(x + dx, y + dy, col)
    for dx, dy in [(-3, -2), (3, -2), (-2, 3), (2, -3)]:
        c.put(x + dx, y + dy, hx('#bffff8'))


def w_garlic(c, hand, tip, fr):
    haft(c, hand, tip, hx('#5a4a3a'), hx('#8a7a68'))
    c.rect(hand[0] - 1, hand[1] - 1, 2, 3, hx('#c8d0dc'))
    x, y = tip
    # bulbo de alho: cabeça cremosa com gomos e a pontinha verde
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            if dx * dx + dy * dy <= 10:
                c.put(x + dx, y + dy, hx('#f4f0dc'))
    for dx, dy in [(-2, 1), (-1, 2), (0, 2), (1, 2), (2, 1)]:
        c.put(x + dx, y + dy, hx('#cfc8a8'))
    for dy in range(-3, 3):
        c.put(x, y + dy, hx('#cfc8a8')) if dy in (-1, 0, 1) else None
    c.put(x - 2, y - 2, hx('#ffffff'))
    c.put(x, y - 4, hx('#7fdc8a'))
    c.put(x - 1, y - 5, hx('#4fbf5a'))
    c.put(x + 1, y - 5, hx('#7fdc8a'))
    glow = hx('#7fdc8a')
    for dx, dy in [(-5, 0), (5, -1), (0, 5), (-4, -4), (4, 4)]:
        if fr % 2 == 0:
            c.put(x + dx, y + dy, glow)


def w_flask(c, hand, tip, fr):
    c.line(hand[0], hand[1], at(hand, tip, 4)[0], at(hand, tip, 4)[1], hx('#8a6a4a'))
    c.rect(hand[0] - 1, hand[1] - 1, 2, 3, hx('#c8d0dc'))
    x, y = tip
    # frasco redondo de vidro com lava
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            if dx * dx + dy * dy <= 11:
                c.put(x + dx, y + dy, hx('#9fd8f0'))
    for dy in range(0, 3):
        for dx in range(-2, 3):
            if dx * dx + dy * dy <= 7:
                c.put(x + dx, y + dy, hx('#ff6a1a'))
    for dx in range(-1, 2):
        c.put(x + dx, y + 1, hx('#ffb02e'))
    c.rect(x - 1, y - 6, 3, 3, hx('#9fd8f0'))
    c.rect(x - 1, y - 7, 3, 1, hx('#8a5a2a'))
    c.put(x - 2, y - 1, hx('#ffffff'))
    c.put(x + (fr % 3) - 1, y, hx('#ffe08a'))
    c.put(x, y - 9 + (fr % 2), hx('#ff6a1a'))


def w_ember(c, hand, tip, fr):
    c.line(hand[0], hand[1], tip[0], tip[1], hx('#6a2a1a'))
    c.line(hand[0], hand[1] - 1, tip[0], tip[1] - 1, hx('#b8683a'))
    c.rect(hand[0] - 1, hand[1] - 1, 2, 3, hx('#ffb02e'))
    x, y = tip
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            if dx * dx + dy * dy <= 10:
                c.put(x + dx, y + dy, hx('#ff7a1a'))
    for dy in range(-2, 2):
        for dx in range(-2, 2):
            if dx * dx + dy * dy <= 3:
                c.put(x + dx, y + dy, hx('#ffd23f'))
    c.put(x, y, hx('#fff3b0'))
    f = fr % 2
    for dx, dy, col in [(0, -4 - f, '#ffb02e'), (-1, -5 - f, '#ff7a1a'), (1, -5, '#ffd23f'), (-4, -2, '#ff7a1a'), (4, -1, '#ffb02e'),
                        (-3, 4, '#ff3a1a'), (3, 3, '#ff7a1a')]:
        c.put(x + dx, y + dy, hx(col))


def w_moon(c, hand, tip, fr):
    c.line(hand[0], hand[1], tip[0], tip[1], hx('#7a5a2a'))
    c.line(hand[0], hand[1] - 1, tip[0], tip[1] - 1, hx('#d9aa5a'))
    c.rect(hand[0] - 1, hand[1] - 1, 2, 3, hx('#7fe0ff'))
    x, y = tip
    # lua crescente
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            d = dx * dx + dy * dy
            d2 = (dx - 2) ** 2 + (dy + 1) ** 2
            if d <= 17 and d2 > 12:
                c.put(x + dx, y + dy, hx('#fff6b8') if (dx + dy) % 3 else hx('#f4e9a0'))
    for dx, dy in [(3, -3), (5, 0), (4, 3), (-5, -3), (-3, 4)]:
        if fr % 2 == 0:
            c.put(x + dx, y + dy, hx('#7fe0ff'))
    c.put(x + 3, y + 3 - fr % 2, hx('#bff4ff'))


def w_axe(c, hand, tip, fr):
    haft(c, hand, tip, hx('#7a4a22'), hx('#b8823f'), 1)
    c.rect(hand[0] - 1, hand[1] - 1, 2, 3, hx('#3a2616'))
    ux, uy, _ = axis(hand, tip)
    # cabeça do machado: lâmina larga em meia-lua, perpendicular ao cabo, na ponta
    for t in range(-1, 5):
        for s in range(-5, 6):
            w = 5 - abs(s) * 0.55
            if 0 <= t <= w:
                x, y = at(hand, tip, -t + 1, s)
                col = hx('#d8e4f0') if t < w - 1.5 else hx('#8fa0b4')
                if s < -2:
                    col = hx('#ffffff') if t == 1 else col
                c.put(x, y, col)
    for s in (-1, 0, 1):
        x, y = at(hand, tip, 2, s)
        c.put(x, y, hx('#55657a'))


WEAPONS = {'whip': w_whip, 'wand': w_wand, 'garlic': w_garlic, 'flask': w_flask, 'ember': w_ember, 'moon': w_moon, 'axe': w_axe}


# ------------------------------------------------------------------ cabeça (capuz, cabelo, elmo, barba)
# O rosto do Kael é pequeno: pele em x15-18, y2-6 (a faixa dourada em y3). O resto da cabeça é x14-19, y1-6.
def head_vesper(c, dy):
    hair, hi, sh = hx('#a81d4a'), hx('#e0457a'), hx('#5c0f2a')
    c.rect(14, 1 + dy, 6, 1, hair)
    c.rect(15, 2 + dy, 4, 1, hair)  # franja
    c.rect(14, 2 + dy, 1, 5, hair)
    c.rect(19, 2 + dy, 1, 5, hair)
    c.behind(20, 3 + dy, 3, 12, hair)  # cabelo comprido caindo atrás
    c.behind(21, 5 + dy, 1, 9, sh)
    for x in (15, 17):
        c.put(x, 1 + dy, hi)
    c.rect(15, 7 + dy, 4, 1, hx('#ffd23f'))  # gargantilha dourada


def head_mara(c, dy):
    g, hi, sh = hx('#2f7a3c'), hx('#5cc068'), hx('#1c4a26')
    c.rect(14, 0 + dy, 6, 1, sh)
    c.rect(14, 1 + dy, 6, 1, g)
    c.rect(15, 1 + dy, 4, 1, hi)
    c.rect(14, 2 + dy, 1, 5, g)  # o capuz emoldura o rosto sem cobri-lo
    c.rect(19, 2 + dy, 1, 5, g)
    c.rect(13, 3 + dy, 1, 5, sh)
    c.rect(20, 3 + dy, 1, 5, sh)
    c.rect(14, 7 + dy, 6, 2, g)  # gola do manto
    c.put(16, 8 + dy, hx('#d9b36a'))  # fecho


def head_brann(c, dy):
    st, hi, sh = hx('#a9b8c8'), hx('#e6eef8'), hx('#55657a')
    c.rect(14, 0 + dy, 6, 2, st)
    c.rect(14, 2 + dy, 1, 5, st)
    c.rect(19, 2 + dy, 1, 5, st)
    c.rect(15, 1 + dy, 3, 1, hi)
    c.rect(15, 2 + dy, 4, 1, sh)
    c.rect(16, 3 + dy, 1, 3, sh)  # nasal do elmo
    c.behind(18, 0 + dy, 6, 2, hx('#4fbf5a'))  # pluma verde
    c.behind(21, 2 + dy, 3, 2, hx('#4fbf5a'))
    c.put(20, 0 + dy, hx('#7fdc8a'))
    c.put(22, 1 + dy, hx('#7fdc8a'))


def head_dorian(c, dy):
    hair, hi = hx('#efe6ff'), hx('#ffffff')
    c.rect(14, 0 + dy, 6, 2, hair)
    c.rect(14, 2 + dy, 1, 3, hair)
    c.rect(19, 2 + dy, 1, 3, hair)
    c.behind(13, 1 + dy, 1, 3, hair)
    c.behind(20, 1 + dy, 3, 2, hair)
    for x in (15, 17):
        c.put(x, 0 + dy, hi)
    c.put(21, 3 + dy, hair)
    # óculos de proteção
    c.rect(14, 3 + dy, 6, 1, hx('#3a2a1e'))
    c.rect(15, 3 + dy, 2, 2, hx('#7fe0ff'))
    c.rect(17, 3 + dy, 2, 2, hx('#7fe0ff'))
    c.put(15, 3 + dy, hx('#e8ffff'))
    c.put(17, 3 + dy, hx('#e8ffff'))


def head_selene(c, dy, fr=0):
    o, y, r = hx('#ff7a1a'), hx('#ffd23f'), hx('#c4380a')
    f = fr % 2
    c.rect(14, 1 + dy, 6, 1, o)
    c.rect(15, 2 + dy, 4, 1, o)
    c.rect(14, 2 + dy, 1, 5, o)
    c.rect(19, 2 + dy, 1, 5, o)
    c.behind(20, 3 + dy, 3, 8, r)
    # chamas no alto da cabeça
    for x, h in [(14, 1), (16, 2), (18, 1)]:
        c.put(x, 0 + dy, y if (x + f) % 2 else o)
        if h == 2:
            c.put(x, -1 + dy, y)
    c.put(15, 0 + dy, o)
    c.put(17, 0 + dy, o)
    c.put(19, 0 + dy, y if f else o)
    c.put(21, 5 + dy, y)


def head_ysolde(c, dy):
    s, hi, sh = hx('#e8f0ff'), hx('#ffffff'), hx('#9aaad0')
    c.rect(14, 1 + dy, 6, 1, s)
    c.rect(15, 2 + dy, 4, 1, hx('#7fe0ff'))  # diadema
    c.rect(14, 2 + dy, 1, 5, s)
    c.rect(19, 2 + dy, 1, 5, s)
    c.behind(20, 3 + dy, 3, 12, s)
    c.behind(21, 6 + dy, 1, 8, sh)
    c.put(16, 2 + dy, hx('#ffffff'))
    c.put(15, 1 + dy, hi)


def head_rurik(c, dy):
    cap, sh, hi = hx('#6a4220'), hx('#3a2410'), hx('#9a6a38')
    c.rect(14, 1 + dy, 6, 1, cap)
    c.rect(14, 2 + dy, 6, 1, sh)
    c.rect(13, 2 + dy, 8, 1, cap)  # aba do gorro
    c.rect(15, 1 + dy, 3, 1, hi)
    c.put(16, 0 + dy, hx('#d94a4a'))  # pompom
    b, bs, bh = hx('#8a5428'), hx('#5a3416'), hx('#b8803f')
    c.rect(14, 6 + dy, 6, 2, b)  # barba cheia (a testa e os olhos ficam à mostra)
    c.rect(15, 8 + dy, 4, 2, b)
    c.rect(16, 10 + dy, 2, 1, bs)
    c.rect(14, 7 + dy, 1, 2, bs)
    c.rect(19, 7 + dy, 1, 2, bs)
    for x in (15, 17):
        c.put(x, 7 + dy, bh)


HEADS = {'vesper': head_vesper, 'mara': head_mara, 'brann': head_brann, 'dorian': head_dorian,
         'selene': head_selene, 'ysolde': head_ysolde, 'rurik': head_rurik}

# ------------------------------------------------------------------ os heróis
# armor/pants: (matiz, saturação, brilho); steel: None mantém o aço, ou uma cor para virar couro/tecido
HEROES = {
    'vesper': dict(weapon='whip', armor=(345, 0.95, 0.95), pants=(285, 0.55, 0.55), steel=hx('#7a3a2a')),
    'mara': dict(weapon='wand', armor=(128, 0.9, 0.9), pants=(30, 0.55, 0.75), steel=hx('#8a5a2e')),
    'brann': dict(weapon='garlic', armor=(150, 0.35, 0.8), pants=(210, 0.25, 0.7), steel=None),
    'dorian': dict(weapon='flask', armor=(278, 0.85, 0.95), pants=(30, 0.5, 0.6), steel=hx('#7a5a3a')),
    'selene': dict(weapon='ember', armor=(14, 1.0, 1.1), pants=(350, 0.8, 0.7), steel=hx('#b8602a')),
    'ysolde': dict(weapon='moon', armor=(235, 0.95, 0.85), pants=(260, 0.6, 0.6), steel=hx('#5a6aa8')),
    'rurik': dict(weapon='axe', armor=(8, 0.9, 0.85), pants=(28, 0.55, 0.55), steel=None),
}


def make(frames, hid):
    spec = HEROES[hid]
    out = {}
    for n, im in frames.items():
        im = im.copy()
        c = Canvas(im)
        rows, bx0, bx1, hand, tip = BLADE[n]
        ys, ye = rows
        for y in range(32):
            for x in range(32):
                p = c.px[x, y]
                k = cls(p)
                blade = ys <= y <= ye and bx0 <= x <= bx1 and k in 'WLm'
                if blade:
                    c.px[x, y] = (24, 32, 60, 255)  # tira a espada (fundo escuro do corpo)
                    continue
                if k in 'Bb':
                    c.px[x, y] = reh(p, *spec['armor'])
                elif k in 'Rr':
                    c.px[x, y] = reh(p, *spec['pants'])
                elif k in 'WLm' and spec['steel'] is not None:
                    c.px[x, y] = tone(p, spec['steel'])
                elif k == 'Y':
                    c.px[x, y] = tone(p, hx('#d8d0c0'))
        fr = FRAMES.index(n) % 4
        if n in HEAD_DY:
            fn = HEADS[hid]
            if hid == 'selene':
                fn(c, HEAD_DY[n], fr)
            else:
                fn(c, HEAD_DY[n])
        WEAPONS[spec['weapon']](c, hand, tip, fr)
        c.outline()
        out[n] = im
    return out


def sheet(frames_by_hero, kael, path, scale=8, names=('Idle00', 'Move01', 'Move03')):
    cols = len(names)
    rows = len(frames_by_hero) + 1
    W = (cols * 32 + 6) * scale
    H = rows * 32 * scale
    img = Image.new('RGBA', (W, H), (75, 109, 59, 255))
    def draw(im, r, k):
        big = im.resize((32 * scale, 32 * scale), Image.NEAREST)
        img.alpha_composite(big, (k * (32 + 2) * scale, r * 32 * scale))
    for k, n in enumerate(names):
        draw(kael[n], 0, k)
    for r, (hid, fr) in enumerate(frames_by_hero.items(), start=1):
        for k, n in enumerate(names):
            draw(fr[n], r, k)
    img.save(path)


def lineup(made, kael, path, scale=6):
    names = ['kael'] + list(made)
    img = Image.new('RGBA', (len(names) * 34 * scale, 36 * scale), (75, 109, 59, 255))
    for k, nm in enumerate(names):
        im = kael['Idle00'] if nm == 'kael' else made[nm]['Idle00']
        img.alpha_composite(im.resize((32 * scale, 32 * scale), Image.NEAREST), (k * 34 * scale + scale, scale))
    img.save(path)


if __name__ == '__main__':
    atlas, meta, outdir = sys.argv[1:4]
    base = load_frames(atlas, meta)
    made = {h: make(base, h) for h in HEROES}
    sheet(made, base, outdir + '/heroes-mock.png')
    lineup(made, base, outdir + '/heroes-lineup.png')
    for h in HEROES:
        sheet({h: made[h]}, base, outdir + f'/hero-{h}.png', 10, ('Idle00', 'Idle01', 'Move00', 'Move01', 'Move02', 'Move03'))
