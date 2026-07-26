#!/usr/bin/env python3
"""Expanded procedural stone / marble / granite / tile texture set for Dziura Stone & Tile.
No copyrighted photos — all generated. Outputs to public/assets/dziura/."""
import os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "dziura")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1017)

def value_noise(w, h, octaves=6, persistence=0.55, base=8):
    acc = np.zeros((h, w), np.float32); amp = 1.0; tot = 0.0
    for o in range(octaves):
        cells = base * (2 ** o)
        gh, gw = max(2, int(cells * h / w)), max(2, cells)
        grid = rng.random((gh, gw)).astype(np.float32)
        img = Image.fromarray((grid * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        acc += amp * (np.asarray(img, np.float32) / 255.0)
        tot += amp; amp *= persistence
    n = acc / tot
    return (n - n.min()) / (np.ptp(n) + 1e-6)

def lerp(c1, c2, t): return tuple(int(c1[i]+(c2[i]-c1[i])*t) for i in range(3))

def ramp(n, stops):
    h, w = n.shape; out = np.zeros((h, w, 3), np.uint8)
    for i in range(len(stops)-1):
        p0,c0=stops[i]; p1,c1=stops[i+1]
        m=(n>=p0)&(n<=p1); t=(n[m]-p0)/(p1-p0+1e-6)
        for k in range(3): out[...,k][m]=(c0[k]+(c1[k]-c0[k])*t).astype(np.uint8)
    return out

def marble(w,h,palette,vein_color,vein_strength=0.9,scale=1.0,seed=None):
    global rng
    if seed is not None: rng=np.random.default_rng(seed)
    base=value_noise(w,h,6,base=int(6*scale)); warp=value_noise(w,h,5,base=int(4*scale))
    xs=np.linspace(0,6*math.pi,w)[None,:].repeat(h,0)
    veins=np.abs(np.sin(xs+warp*9.0+base*3.0))
    veins=np.power(1.0-np.clip(veins,0,1),3.5)
    img=ramp(base,palette).astype(np.float32); vc=np.array(vein_color,np.float32)
    a=(veins*vein_strength)[...,None]; img=img*(1-a)+vc*a
    spk=(rng.random((h,w))<0.004); img[spk]=np.clip(img[spk]+45,0,255)
    return Image.fromarray(np.clip(img,0,255).astype(np.uint8))

def granite(w,h,base_col,fleck_cols,seed=None):
    global rng
    if seed is not None: rng=np.random.default_rng(seed)
    n=value_noise(w,h,7,base=10); img=np.zeros((h,w,3),np.float32)
    for k in range(3): img[...,k]=base_col[k]+(n-0.5)*40
    fl=value_noise(w,h,5,base=48)
    for i,c in enumerate(fleck_cols):
        m=fl>(0.82-i*0.06)
        for k in range(3): img[...,k][m]=c[k]
    m=rng.random((h,w))<0.02; img[m]=np.clip(img[m]+60,0,255)
    return Image.fromarray(np.clip(img,0,255).astype(np.uint8))

def vignette(img,strength=0.55):
    w,h=img.size; y,x=np.ogrid[:h,:w]; cx,cy=w/2,h/2
    d=np.sqrt(((x-cx)/(w/2))**2+((y-cy)/(h/2))**2); v=np.clip(1-(d-0.55)*strength,0,1)
    return Image.fromarray(np.clip(np.asarray(img,np.float32)*v[...,None],0,255).astype(np.uint8))

def grout_grid(base,tw,th,grout=(28,28,30),gw=6,offset=False):
    img=base.copy(); d=ImageDraw.Draw(img); W,H=img.size; row=0; y=0
    while y<H:
        d.rectangle([0,y,W,y+gw],fill=grout)
        x=-tw//2 if(offset and row%2) else 0
        while x<W:
            d.rectangle([x,y,x+gw,y+th],fill=grout); x+=tw
        y+=th; row+=1
    d.rectangle([0,0,W,gw],fill=grout); d.rectangle([0,0,gw,H],fill=grout)
    return img

def diagonal_tile(W,H,tile=150,seed=7,pal=None):
    """Tight brick grid rotated 45° — reads as a clean diagonal/herringbone-style tile field."""
    r=np.random.default_rng(seed)
    pal=pal or [(238,236,231),(228,224,216),(214,210,203),(246,244,240)]
    big=int(max(W,H)*1.7)
    layer=Image.new("RGB",(big,big),(30,30,32)); d=ImageDraw.Draw(layer)
    tw,th=tile,tile//2; row=0; y=0
    while y<big:
        x=-tw//2 if row%2 else 0
        while x<big:
            c=tuple(int(v+r.integers(-10,10)) for v in pal[r.integers(0,len(pal))])
            d.rectangle([x+4,y+4,x+tw-4,y+th-4],fill=c)
            x+=tw
        y+=th; row+=1
    layer=layer.rotate(45,expand=0,resample=Image.BICUBIC)
    cx,cy=layer.size[0]//2,layer.size[1]//2
    layer=layer.crop((cx-W//2,cy-H//2,cx-W//2+W,cy-H//2+H))
    return layer

def stacked_stone(W,H,seed=11,tones=None):
    r=np.random.default_rng(seed)
    tones=tones or [(92,86,76),(74,70,62),(108,100,88),(66,62,55),(120,112,98)]
    base=granite(W,H,(86,82,74),[(120,112,98),(60,56,50)],seed=seed); d=ImageDraw.Draw(base); y=0
    while y<H:
        rh=r.integers(34,64); x=0
        while x<W:
            rw=r.integers(70,150)
            c=tuple(int(v+r.integers(-12,12)) for v in tones[r.integers(0,len(tones))])
            d.rectangle([x,y,x+rw,y+rh],fill=c,outline=(28,26,23),width=3)
            d.line([x,y+2,x+rw,y+2],fill=(150,142,126),width=1); x+=rw+r.integers(2,6)
        y+=rh+r.integers(2,6)
    return base.filter(ImageFilter.SMOOTH_MORE)

def save(img,name,size=None):
    if size: img=img.resize(size,Image.LANCZOS)
    img.convert("RGB").save(os.path.join(OUT,name),"PNG"); print("wrote",name,img.size)

# palettes
CARRARA=[(0.0,(196,196,200)),(0.5,(226,226,228)),(1.0,(246,246,246))]
BLACKGOLD=[(0.0,(38,40,44)),(0.4,(70,72,78)),(0.7,(150,150,156)),(1.0,(226,224,222))]
GREIGE=[(0.0,(150,142,130)),(0.5,(178,170,158)),(1.0,(206,200,190))]
CALACATTA=[(0.0,(214,212,206)),(0.5,(236,234,229)),(1.0,(250,249,246))]

# HERO — black + gold marble with legibility gradient
hero=vignette(marble(1600,1000,BLACKGOLD,(196,150,74),0.85,1.4,seed=1017),0.6)
ov=Image.new("RGBA",hero.size,(0,0,0,0)); do=ImageDraw.Draw(ov); W2,H2=hero.size
for y in range(H2):
    t=max(0.0,(y-H2*0.45)/(H2*0.55)); do.line([(0,y),(W2,y)],fill=(14,15,17,int(150*t)))
for x in range(W2):
    t=max(0.0,1-x/(W2*0.6)); do.line([(x,0),(x,H2)],fill=(14,15,17,int(90*t)))
hero=Image.alpha_composite(hero.convert("RGBA"),ov).convert("RGB")
save(hero,"hero-granite.png"); save(hero,"og-image.png",(1200,630))

# HERO alt — calacatta light (for service pages)
save(vignette(marble(1600,1000,CALACATTA,(150,152,160),0.7,1.1,seed=99),0.4),"hero-marble.png")

# PORTFOLIO / SERVICE IMAGES
save(vignette(granite(1000,750,(46,44,42),[(198,160,92),(150,146,140),(28,26,25)],seed=21),0.4),"portfolio-kitchen.png")
save(vignette(marble(1000,750,CARRARA,(150,152,158),0.75,1.0,seed=33),0.3),"portfolio-bath.png")
save(vignette(grout_grid(marble(1000,750,GREIGE,(120,112,100),0.28,0.7,seed=44),330,250,(120,112,100),5),0.35),"portfolio-floor.png")
sb=grout_grid(marble(1000,750,[(0.0,(214,212,206)),(0.5,(234,232,227)),(1.0,(248,247,244))],(176,178,184),0.5,0.9,seed=63),250,96,(196,192,184),7,offset=True)
save(vignette(sb,0.3),"portfolio-backsplash.png")
cm=grout_grid(marble(1000,750,[(0.0,(28,30,33)),(0.5,(52,54,58)),(1.0,(96,98,104))],(150,120,70),0.5,1.1,seed=55),200,750,(18,19,21),6)
save(vignette(cm,0.5),"portfolio-commercial.png")
save(vignette(stacked_stone(1000,750,seed=12),0.4),"portfolio-outdoor.png")
# fireplace — dark ledgestone
save(vignette(stacked_stone(1000,750,seed=71,tones=[(58,54,50),(44,42,40),(74,68,60),(38,36,34),(90,82,72)]),0.5),"portfolio-fireplace.png")
# shower — large marble tile w/ grid
sh=grout_grid(marble(1000,750,CARRARA,(150,152,158),0.6,0.8,seed=81),500,340,(214,212,206),6)
save(vignette(sh,0.3),"portfolio-shower.png")
# quartz vanity — bright quartz, faint veins
save(vignette(marble(1000,750,CALACATTA,(206,196,150),0.35,0.8,seed=91),0.3),"portfolio-vanity.png")
# porcelain slab — dramatic veined slab
save(vignette(marble(1000,750,[(0.0,(230,228,224)),(0.5,(210,206,200)),(1.0,(250,249,247))],(120,118,122),0.9,1.3,seed=101),0.35),"portfolio-slab.png")
# diagonal marble tile
save(vignette(diagonal_tile(1000,750,150,seed=7),0.35),"portfolio-diagonal.png")
# herringbone-ish darker
save(vignette(diagonal_tile(1000,750,140,seed=23,pal=[(60,58,56),(48,46,44),(74,70,66),(40,38,36)]),0.4),"portfolio-slate.png")

# texture strip
def brass_wash(img,top=(24,26,28),bottom=(58,44,26),at=0.30,ab=0.10):
    W,H=img.size; grad=Image.new("RGB",(1,H))
    for y in range(H): grad.putpixel((0,y),lerp(top,bottom,y/H))
    grad=grad.resize((W,H)); a=Image.new("L",(W,H))
    for y in range(H): a.paste(int(255*(at+(ab-at)*(y/H))),[0,y,W,y+1])
    return Image.composite(grad,img,ImageChops.invert(a).point(lambda p:255-p))
save(brass_wash(vignette(granite(1600,400,(34,36,40),[(176,134,65),(70,72,78)],seed=9),0.5)),"texture-strip.png")

# PARTNER WORDMARKS
def wordmark(text,sub=""):
    W,H=480,150; img=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(img)
    try:
        f=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",40)
        fs=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",18)
    except Exception: f=ImageFont.load_default(); fs=ImageFont.load_default()
    tb=d.textbbox((0,0),text,font=f); d.text(((W-(tb[2]-tb[0]))//2,44),text,font=f,fill=(196,154,84,255))
    if sub:
        sbb=d.textbbox((0,0),sub,font=fs); d.text(((W-(sbb[2]-sbb[0]))//2,96),sub,font=fs,fill=(150,150,156,255))
    return img
for name,txt,sub in [("partner-onhomedecor","ON HOME DECOR","Interior Design"),
                     ("partner-northshore","NORTHSHORE","Builders"),
                     ("partner-lakeside","LAKESIDE","Design Co."),
                     ("partner-rosseau","ROSSEAU","Custom Homes")]:
    wordmark(txt,sub).save(os.path.join(OUT,name+".png")); print("wrote",name+".png")
print("DONE")
