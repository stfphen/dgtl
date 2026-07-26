#!/usr/bin/env python3
"""Procedural stone / marble / granite / tile texture generator for Nowak Stoneworks.
Produces tasteful placeholder imagery (no copyrighted photos) for the tenant funnel
and the standalone SEO site."""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "nowak")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1017)

def value_noise(w, h, octaves=6, persistence=0.55, base=8):
    """Fractal value noise in [0,1]."""
    acc = np.zeros((h, w), np.float32)
    amp = 1.0; tot = 0.0
    for o in range(octaves):
        cells = base * (2 ** o)
        gh, gw = max(2, int(cells * h / w)), max(2, cells)
        grid = rng.random((gh, gw)).astype(np.float32)
        img = Image.fromarray((grid * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        acc += amp * (np.asarray(img, np.float32) / 255.0)
        tot += amp; amp *= persistence
    n = acc / tot
    return (n - n.min()) / (np.ptp(n) + 1e-6)

def lerp(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def ramp(n, stops):
    """Map noise [0,1] through color stops [(pos,color),...]."""
    h, w = n.shape
    out = np.zeros((h, w, 3), np.uint8)
    for i in range(len(stops) - 1):
        p0, c0 = stops[i]; p1, c1 = stops[i + 1]
        m = (n >= p0) & (n <= p1)
        t = (n[m] - p0) / (p1 - p0 + 1e-6)
        for k in range(3):
            out[..., k][m] = (c0[k] + (c1[k] - c0[k]) * t).astype(np.uint8)
    return out

def marble(w, h, palette, vein_color, vein_strength=0.9, scale=1.0, seed=None):
    global rng
    if seed is not None: rng = np.random.default_rng(seed)
    base = value_noise(w, h, octaves=6, base=int(6*scale))
    warp = value_noise(w, h, octaves=5, base=int(4*scale))
    xs = np.linspace(0, 6*math.pi, w)[None, :].repeat(h, 0)
    veins = np.sin(xs + warp * 9.0 + base * 3.0)
    veins = np.abs(veins)
    veins = np.power(1.0 - np.clip(veins, 0, 1), 3.5)  # thin bright veins
    img = ramp(base, palette).astype(np.float32)
    vc = np.array(vein_color, np.float32)
    a = (veins * vein_strength)[..., None]
    img = img * (1 - a) + vc * a
    # fine speckle
    spk = (rng.random((h, w)) < 0.004)
    img[spk] = np.clip(img[spk] + 45, 0, 255)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))

def granite(w, h, base_col, fleck_cols, seed=None):
    global rng
    if seed is not None: rng = np.random.default_rng(seed)
    n = value_noise(w, h, octaves=7, base=10)
    img = np.zeros((h, w, 3), np.float32)
    for k in range(3):
        img[..., k] = base_col[k] + (n - 0.5) * 40
    # scatter flecks
    fl = value_noise(w, h, octaves=5, base=48)
    for i, c in enumerate(fleck_cols):
        thr = 0.82 - i*0.06
        m = fl > thr
        for k in range(3):
            img[..., k][m] = c[k]
    spk = rng.random((h, w))
    m = spk < 0.02
    img[m] = np.clip(img[m] + 60, 0, 255)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))

def vignette(img, strength=0.55):
    w, h = img.size
    y, x = np.ogrid[:h, :w]
    cx, cy = w/2, h/2
    d = np.sqrt(((x-cx)/(w/2))**2 + ((y-cy)/(h/2))**2)
    v = np.clip(1 - (d-0.55)*strength, 0, 1)
    arr = np.asarray(img, np.float32) * v[..., None]
    return Image.fromarray(np.clip(arr,0,255).astype(np.uint8))

def grout_grid(base, tile_w, tile_h, grout=(28,28,30), gw=6, offset_rows=False):
    img = base.copy(); d = ImageDraw.Draw(img)
    W, H = img.size
    row = 0; y = 0
    while y < H:
        d.rectangle([0, y, W, y+gw], fill=grout)
        x = -tile_w//2 if (offset_rows and row % 2) else 0
        while x < W:
            d.rectangle([x, y, x+gw, y+tile_h], fill=grout)
            x += tile_w
        y += tile_h; row += 1
    d.rectangle([0,0,W,gw], fill=grout); d.rectangle([0,0,gw,H], fill=grout)
    return img

def herringbone(W, H, tile_l=150, tile_w=46, seed=7):
    r = np.random.default_rng(seed)
    img = Image.new("RGB", (W, H), (24,24,26))
    pal = [(238,236,231),(228,224,216),(214,210,203),(246,244,240)]
    layer = Image.new("RGBA", (int(W*1.6), int(H*1.6)), (0,0,0,0))
    d = ImageDraw.Draw(layer)
    step = tile_l + tile_w
    for gy in range(-2, layer.size[1]//step + 2):
        for gx in range(-2, layer.size[0]//step + 2):
            ox, oy = gx*step, gy*step
            c1 = tuple(pal[r.integers(0,len(pal))])
            c2 = tuple(pal[r.integers(0,len(pal))])
            d.rectangle([ox, oy, ox+tile_l, oy+tile_w], fill=c1, outline=(30,30,32), width=4)
            d.rectangle([ox+tile_l, oy, ox+tile_l+tile_w, oy+tile_l+tile_w], fill=c2, outline=(30,30,32), width=4)
    layer = layer.rotate(45, expand=1, resample=Image.BICUBIC)
    lx, ly = layer.size
    img.paste(layer, ((W-lx)//2, (H-ly)//2), layer)
    # subtle sheen
    return img

def stacked_stone(W, H, seed=11):
    r = np.random.default_rng(seed)
    base = granite(W, H, (86,82,74), [(120,112,98),(60,56,50)], seed=seed)
    d = ImageDraw.Draw(base)
    y = 0
    tones = [(92,86,76),(74,70,62),(108,100,88),(66,62,55),(120,112,98)]
    while y < H:
        rh = r.integers(38, 70)
        x = 0
        while x < W:
            rw = r.integers(70, 150)
            c = tuple(int(v + r.integers(-12,12)) for v in tones[r.integers(0,len(tones))])
            d.rectangle([x, y, x+rw, y+rh], fill=c, outline=(30,28,25), width=3)
            # top highlight
            d.line([x, y+2, x+rw, y+2], fill=(150,142,126), width=1)
            x += rw + r.integers(2,6)
        y += rh + r.integers(2,6)
    return base.filter(ImageFilter.SMOOTH_MORE)

# ---- warm brass wash for cohesion ----
def brass_wash(img, top=(24,26,28), bottom=(58,44,26), alpha_top=0.30, alpha_bot=0.10):
    W, H = img.size
    grad = Image.new("RGB", (1, H))
    for y in range(H):
        t = y / H
        grad.putpixel((0, y), lerp(top, bottom, t))
    grad = grad.resize((W, H))
    a = Image.new("L", (W, H))
    for y in range(H):
        t = y / H
        av = int(255 * (alpha_top + (alpha_bot - alpha_top) * t))
        a.paste(av, [0, y, W, y+1])
    return Image.composite(grad, img, ImageChops.invert(a).point(lambda p: 255-p))

def save(img, name, size=None, q=88):
    if size: img = img.resize(size, Image.LANCZOS)
    img.convert("RGB").save(os.path.join(OUT, name), "PNG")
    print("wrote", name, img.size)

# ---------- HERO ----------
carrara = [(0.0,(38,40,44)),(0.4,(70,72,78)),(0.7,(150,150,156)),(1.0,(226,224,222))]
hero = marble(1600, 1000, carrara, (196,150,74), vein_strength=0.85, scale=1.4, seed=1017)
hero = vignette(hero, 0.6)
# darken lower band + left edge for headline legibility (no bloom blobs)
ov = Image.new("RGBA", hero.size, (0,0,0,0))
do = ImageDraw.Draw(ov)
W2, H2 = hero.size
for y in range(H2):
    t = max(0.0, (y - H2*0.45) / (H2*0.55))
    do.line([(0,y),(W2,y)], fill=(14,15,17,int(150*t)))
for x in range(W2):
    t = max(0.0, 1 - x/(W2*0.6))
    do.line([(x,0),(x,H2)], fill=(14,15,17,int(90*t)))
hero = Image.alpha_composite(hero.convert("RGBA"), ov).convert("RGB")
save(hero, "hero-granite.png")
save(hero, "og-image.png", (1200, 630))

# ---------- PORTFOLIO ----------
# Kitchen: dark granite w/ gold flecks
k = granite(1000, 750, (46,44,42), [(198,160,92),(150,146,140),(28,26,25)], seed=21)
k = vignette(k, 0.4)
save(k, "portfolio-kitchen.png")

# Bath: carrara marble
b = marble(1000, 750, [(0.0,(196,196,200)),(0.5,(226,226,228)),(1.0,(246,246,246))], (150,152,158), vein_strength=0.75, scale=1.0, seed=33)
save(vignette(b,0.3), "portfolio-bath.png")

# Floor: large-format greige porcelain tiles
gp = marble(1000, 750, [(0.0,(150,142,130)),(0.5,(178,170,158)),(1.0,(206,200,190))], (120,112,100), vein_strength=0.28, scale=0.7, seed=44)
gp = grout_grid(gp, 330, 250, grout=(120,112,100), gw=5)
save(vignette(gp,0.35), "portfolio-floor.png")

# Backsplash: marble subway tile (offset brick), clearly a backsplash
sb = marble(1000, 750, [(0.0,(214,212,206)),(0.5,(234,232,227)),(1.0,(248,247,244))], (176,178,184), vein_strength=0.5, scale=0.9, seed=63)
sb = grout_grid(sb, 250, 96, grout=(196,192,184), gw=7, offset_rows=True)
save(vignette(sb,0.3), "portfolio-backsplash.png")

# Commercial: honed dark stone cladding, vertical joints
cm = marble(1000, 750, [(0.0,(28,30,33)),(0.5,(52,54,58)),(1.0,(96,98,104))], (150,120,70), vein_strength=0.5, scale=1.1, seed=55)
cm = grout_grid(cm, 200, 750, grout=(18,19,21), gw=6)
save(vignette(cm,0.5), "portfolio-commercial.png")

# Outdoor: stacked natural stone
save(vignette(stacked_stone(1000,750),0.4), "portfolio-outdoor.png")

# small texture strip for site section bg
strip = granite(1600, 400, (34,36,40), [(176,134,65),(70,72,78)], seed=9)
save(brass_wash(vignette(strip,0.5)), "texture-strip.png")

# ---------- PARTNER WORDMARK LOGOS ----------
def wordmark(text, sub=""):
    W, H = 480, 150
    img = Image.new("RGBA", (W, H), (0,0,0,0))
    d = ImageDraw.Draw(img)
    try:
        f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 40)
        fs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    except Exception:
        f = ImageFont.load_default(); fs = ImageFont.load_default()
    col = (196, 154, 84, 255)
    tb = d.textbbox((0,0), text, font=f)
    d.text(((W-(tb[2]-tb[0]))//2, 44), text, font=f, fill=col)
    if sub:
        sb = d.textbbox((0,0), sub, font=fs)
        d.text(((W-(sb[2]-sb[0]))//2, 96), sub, font=fs, fill=(150,150,156,255))
    return img

for name, txt, sub in [
    ("partner-onhomedecor","ON HOME DECOR","Interior Design"),
    ("partner-northshore","NORTHSHORE","Builders"),
    ("partner-lakeside","LAKESIDE","Design Co."),
    ("partner-rosseau","ROSSEAU","Custom Homes"),
]:
    wm = wordmark(txt, sub)
    wm.save(os.path.join(OUT, name + ".png"))
    print("wrote", name+".png")

print("DONE")
