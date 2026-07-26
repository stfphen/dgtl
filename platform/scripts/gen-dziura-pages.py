#!/usr/bin/env python3
"""Generate SEO landing pages (service + location) for the Dziura Stone & Tile
standalone site. Each page is self-contained, shares assets/site.css, and carries
unique title/description/H1 plus LocalBusiness/Service/Breadcrumb/FAQ JSON-LD."""
import os, json, html

SITE = os.path.join(os.path.dirname(__file__), "..", "dziura-site")
BASE = "https://dziurastoneandtile.ca"
PHONE = "(437) 555-0140"; TEL = "+1-437-555-0140"; EMAIL = "info@dziurastoneandtile.ca"

def esc(s): return html.escape(s, quote=True)

def page(slug, title, desc, keywords, eyebrow, h1, hero_lead, hero_img,
         intro_h2, intro_body, features, gallery, faqs, cta_h2, cta_lead,
         schema_extra, related):
    url = f"{BASE}/{slug}/"
    ld = {"@context":"https://schema.org","@graph":[
        {"@type":["GeneralContractor","HomeAndConstructionBusiness"],"@id":f"{BASE}/#business",
         "name":"Dziura Stone & Tile","url":BASE+"/","telephone":TEL,"email":EMAIL,
         "image":f"{BASE}/assets/og-image.png","priceRange":"$$$","founder":{"@type":"Person","name":"Daniel Dziura"},
         "description":"Family-run granite, tile and natural-stone installation contractor serving the GTA, Southern Ontario and Muskoka."},
        schema_extra,
        {"@type":"BreadcrumbList","itemListElement":[
            {"@type":"ListItem","position":1,"name":"Home","item":BASE+"/"},
            {"@type":"ListItem","position":2,"name":h1,"item":url}]},
        {"@type":"FAQPage","mainEntity":[
            {"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in faqs]}
    ]}
    feats = "\n".join(
        f'      <div class="feature reveal"><h3 class="gold">{esc(t)}</h3><p>{esc(p)}</p></div>'
        for t,p in features)
    gal = "\n".join(
        f'      <div class="pf reveal"><img src="../assets/{src}" alt="{esc(alt)}"><div class="cap"><b>{esc(cap)}</b></div></div>'
        for src,alt,cap in gallery)
    faq_html = "\n".join(
        f'      <div class="faq-item"><button class="faq-q" aria-expanded="false">{esc(q)}<span class="ic">+</span></button><div class="faq-a"><p>{esc(a)}</p></div></div>'
        for q,a in faqs)
    rel = " · ".join(f'<a href="../{s}/" style="color:var(--gold-2)">{esc(n)}</a>' for s,n in related)
    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="keywords" content="{esc(keywords)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#111214">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Dziura Stone & Tile">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{BASE}/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False)}
</script>
<link rel="stylesheet" href="../assets/site.css">
</head>
<body>
<header class="nav scrolled" id="nav">
  <div class="wrap nav-inner">
    <a class="brand" href="../"><span class="mark"><span>D</span></span><span>Dziura Stone &amp; Tile<small>Stone · Tile · Granite</small></span></a>
    <nav class="navlinks">
      <a href="../#services">Services</a>
      <a href="../#work">Our Work</a>
      <a href="../#pricing">Pricing</a>
      <a href="../#areas">Service Areas</a>
      <a href="../#faq">FAQ</a>
      <a href="#contact" class="btn btn-gold">Free On-Site Quote</a>
    </nav>
    <button class="navtoggle" id="navtoggle" aria-label="Menu">☰</button>
  </div>
</header>
<a id="top"></a>
<section class="hero" id="hero" style="min-height:76vh">
  <div class="hero-bg"><img src="../assets/{hero_img}" alt="{esc(h1)} by Dziura Stone & Tile"></div>
  <div class="wrap"><div class="hero-inner">
    <p class="eyebrow reveal">{esc(eyebrow)}</p>
    <h1 class="reveal">{esc(h1)}</h1>
    <p class="lead reveal">{esc(hero_lead)}</p>
    <div class="hero-cta reveal">
      <a href="#contact" class="btn btn-gold">Book Your Free On-Site Quote →</a>
      <a href="tel:{TEL}" class="btn btn-ghost">Call {PHONE}</a>
    </div>
  </div></div>
</section>

<section>
  <div class="wrap" style="max-width:820px">
    <p class="eyebrow reveal">{esc(eyebrow)}</p>
    <h2 class="reveal">{esc(intro_h2)}</h2>
    <p class="lead reveal" style="max-width:none">{esc(intro_body)}</p>
  </div>
</section>

<section style="background:var(--panel);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding-top:70px">
  <div class="wrap">
    <div class="grid g3">
{feats}
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="center reveal" style="max-width:640px;margin:0 auto 40px"><p class="eyebrow">Selected Work</p><h2 style="font-size:clamp(1.7rem,3vw,2.4rem)">Recent projects &amp; finishes.</h2></div>
    <div class="grid g3">
{gal}
    </div>
  </div>
</section>

<section id="faq" style="background:var(--panel);border-top:1px solid var(--line);border-bottom:1px solid var(--line)">
  <div class="wrap" style="max-width:900px">
    <div class="reveal" style="margin-bottom:20px"><p class="eyebrow">Questions</p><h2 style="font-size:clamp(1.7rem,3vw,2.4rem)">Good to know.</h2></div>
    <div class="reveal">
{faq_html}
    </div>
  </div>
</section>

<section id="contact">
  <div class="wrap"><div class="cta reveal"><div class="cta-grid">
    <div>
      <p class="eyebrow">Get Started</p>
      <h2 style="font-size:clamp(1.8rem,3.4vw,2.6rem)">{esc(cta_h2)}</h2>
      <p class="lead" style="max-width:none;margin-bottom:24px">{esc(cta_lead)}</p>
      <ul class="contact-facts">
        <li><span class="k">Phone</span><a href="tel:{TEL}">{PHONE}</a></li>
        <li><span class="k">Email</span><a href="mailto:{EMAIL}">{EMAIL}</a></li>
        <li><span class="k">Owner</span><span>Daniel Dziura</span></li>
      </ul>
      <a href="../#pricing" class="btn btn-ghost" style="margin-top:20px">View Pricing Reference →</a>
    </div>
    <div>
      <form onsubmit="return submitQuote(event)">
        <div class="row"><div><label>Name</label><input required placeholder="Your name"></div><div><label>Phone</label><input required placeholder="(000) 000-0000"></div></div>
        <div class="row"><div><label>Email</label><input required type="email" placeholder="you@email.com"></div><div><label>City</label><input placeholder="e.g. Oakville"></div></div>
        <label>Tell us about the project</label>
        <textarea rows="3" placeholder="Rooms, rough square footage, timeline, photos or plans…"></textarea>
        <button class="btn btn-gold" type="submit">Request My On-Site Quote →</button>
        <div class="formok" id="formok">Thanks — your request has been noted. In the live version this routes straight into the Dziura Stone &amp; Tile lead pipeline.</div>
      </form>
    </div>
  </div></div></div>
</section>

<footer class="site">
  <div class="wrap">
    <div style="padding-bottom:22px;color:var(--muted);font-size:.9rem">Related: {rel} · <a href="../" style="color:var(--gold-2)">Home</a></div>
    <div class="foot-bottom" style="border-top:1px solid var(--line);padding-top:22px">
      <span>© <span id="yr"></span> Dziura Stone &amp; Tile · Granite, Tile &amp; Stone Contractors · GTA to Muskoka</span>
      <span>Placeholder brand assets — for demonstration.</span>
    </div>
  </div>
</footer>
<script>
document.getElementById('yr').textContent=new Date().getFullYear();
document.getElementById('navtoggle').onclick=()=>document.querySelector('.navlinks').style.display='flex';
document.querySelectorAll('.faq-q').forEach(q=>{{q.onclick=()=>{{const o=q.getAttribute('aria-expanded')==='true';q.setAttribute('aria-expanded',!o);const a=q.nextElementSibling;a.style.maxHeight=o?null:a.scrollHeight+'px';}};}});
const io=new IntersectionObserver(es=>es.forEach(e=>{{if(e.isIntersecting){{e.target.classList.add('in');io.unobserve(e.target)}}}}),{{threshold:.12}});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
function submitQuote(e){{e.preventDefault();document.getElementById('formok').style.display='block';e.target.querySelector('button').textContent='Request Sent ✓';return false;}}
</script>
</body>
</html>"""
    os.makedirs(os.path.join(SITE, slug), exist_ok=True)
    open(os.path.join(SITE, slug, "index.html"), "w").write(doc)
    print("wrote", slug)
    return slug

def svc(name): return {"@type":"Service","serviceType":name,"provider":{"@id":f"{BASE}/#business"},
    "areaServed":[{"@type":"AdministrativeArea","name":"Greater Toronto Area"},{"@type":"AdministrativeArea","name":"Muskoka"}]}
def place(city): return {"@type":"Service","serviceType":"Stone, tile and granite installation","provider":{"@id":f"{BASE}/#business"},
    "areaServed":{"@type":"City","name":city+", Ontario"}}

SERVICES=[("granite-quartz-countertops","Granite & Quartz Countertops"),
          ("tile-installation","Tile Installation"),
          ("kitchen-bathroom-renovation","Kitchen & Bath Renovation"),
          ("commercial-stone-tile","Commercial Stone & Tile")]
LOCS=[("toronto-stone-tile","Toronto"),("mississauga-stone-tile","Mississauga"),
      ("oakville-stone-tile","Oakville"),("vaughan-stone-tile","Vaughan"),
      ("muskoka-stone-tile-granite","Muskoka")]
def related_for(current):
    out=[(s,n) for s,n in SERVICES if s!=current][:3]+[(s,n) for s,n in LOCS if s!=current][:2]
    return out[:4]

pages=[]

# ---- SERVICE PAGES ----
pages.append(page("granite-quartz-countertops",
    "Granite & Quartz Countertops GTA & Muskoka | Dziura Stone & Tile",
    "Granite, quartz and marble countertops templated, fabricated and installed across the GTA, Southern Ontario and Muskoka. Waterfall edges, book-matched slabs. From $3,900. Free quote.",
    "granite countertops GTA, quartz countertops Toronto, marble countertops, waterfall edge, kitchen countertop installer, countertop fabrication Ontario",
    "Countertops · GTA · Southern Ontario · Muskoka",
    "Granite & Quartz Countertops",
    "Laser-templated, precision-fabricated granite, quartz and marble countertops with flawless seams and the edge profile your kitchen deserves.",
    "hero-marble.png",
    "Countertops that anchor the whole kitchen.",
    "Your countertop is the surface everyone touches and every guest sees. We laser-template for a perfect fit, fabricate granite, quartz, marble or porcelain to your chosen edge, and install seamlessly — undermount cutouts, waterfall ends and book-matched veining included. In the GTA, installed countertops generally run $85–$180 per square foot depending on the slab and edge, and a typical kitchen starts around $3,900.",
    [("Granite","Durable, heat-resistant natural stone with one-of-a-kind veining — sealed and installed to last decades."),
     ("Quartz","Consistent, low-maintenance engineered stone in a huge range of colours; no sealing required."),
     ("Marble & Porcelain","Statement marble and large-format porcelain slabs for waterfall islands and full-height backsplashes."),
     ("Waterfall & Mitred Edges","Book-matched waterfall ends and mitred profiles fabricated for a thick, seamless look."),
     ("Laser Templating","Digital templating captures every wall so your tops drop in with tight, even reveals."),
     ("Undermount Cutouts","Clean undermount sink, cooktop and faucet cutouts, polished and ready for install.")],
    [("portfolio-kitchen.png","Dark granite waterfall island","Waterfall granite island — Rosedale"),
     ("portfolio-vanity.png","White quartz vanity waterfall","Quartz vanity — Forest Hill"),
     ("portfolio-slab.png","Book-matched porcelain slab","Book-matched porcelain slab")],
    [("How much do granite and quartz countertops cost in the GTA?","Generally $85–$180 per square foot installed for granite and quartz, with exotic and book-matched stone higher. That includes laser templating, fabrication, cutouts and installation. A typical kitchen starts around $3,900, confirmed after templating."),
     ("What's the difference between granite and quartz?","Granite is natural stone — unique veining, heat-resistant, needs periodic sealing. Quartz is engineered — highly consistent, non-porous and maintenance-free. We'll help you choose for your use and budget."),
     ("Can you do a waterfall island?","Yes. We fabricate book-matched waterfall ends and mitred edges so the veining flows down the side for a seamless, thick-edge look."),
     ("Do you supply the slab or can I?","Either — we supply through our stone suppliers, or fabricate and install a slab you and your designer selected.")],
    "Price your new countertops.",
    "Send the kitchen dimensions and the look you're after — we'll template, quote and install.",
    svc("Granite & Quartz Countertop Installation"),
    related_for("granite-quartz-countertops")))

pages.append(page("tile-installation",
    "Tile Installation Toronto & GTA — Floors, Walls, Backsplash | Dziura Stone & Tile",
    "Professional tile installation across the GTA and Muskoka — floors, walls, showers, backsplashes and heated floors. Large-format and natural stone. $30–$40/sq ft. Free on-site quote.",
    "tile installation Toronto, tile contractor GTA, backsplash installation, bathroom tile, heated floor tile, large format tile installer, floor tiling",
    "Tile · Floors · Walls · Backsplashes",
    "Tile Installation — Floors, Walls & Backsplashes",
    "Porcelain, ceramic and natural-stone tile set to a craftsman's tolerance — proper substrate, waterproofing and layout so it stays flawless for decades.",
    "portfolio-diagonal.png",
    "Tile done right starts under the surface.",
    "Beautiful tile is only as good as what's under it. We prep and level the substrate, install uncoupling and waterproofing membranes, and lay out every field so cuts land where they should. From herringbone backsplashes to 4,000 sq ft of heated large-format porcelain, the finish is dead-flat with tight, even grout lines. As a rule of thumb, installed tile runs $30–$40 per square foot, and a single-room project starts at $2,500.",
    [("Floor Tile","Porcelain, ceramic and natural stone over properly prepped, level substrate — including heated-floor systems."),
     ("Wall & Shower Tile","Fully waterproofed showers, tub surrounds and feature walls with curbless entries and niches."),
     ("Backsplashes","Subway, herringbone, mosaic and full-height stone backsplashes with mitred edges and hidden outlets."),
     ("Large-Format & Slab","Big-format porcelain and slab tile that demands flatness prep and the right tools — our specialty."),
     ("Heated Floors","In-floor heat with uncoupling membranes so tile stays crack-free through seasonal movement."),
     ("Natural Stone","Marble, limestone, slate and travertine set, honed and sealed with the care natural stone needs.")],
    [("portfolio-backsplash.png","Marble subway backsplash","Marble backsplash — King West"),
     ("portfolio-floor.png","Heated porcelain floor","Heated porcelain floor — Muskoka"),
     ("portfolio-shower.png","Curbless marble shower","Curbless shower — Forest Hill")],
    [("How much does tile installation cost per square foot?","About $30–$40 per square foot installed depending on the tile, layout and substrate. Large-format, natural stone and patterns like herringbone sit higher. A single room typically starts at $2,500, confirmed after an on-site measure."),
     ("Do you remove old tile and prep the subfloor?","Yes — we self-perform demolition, haul-away, substrate levelling and waterproofing before a single tile goes down."),
     ("Can you install heated floors?","Absolutely. In-floor heat under large-format porcelain is one of our specialties, with the uncoupling membranes that keep it flawless."),
     ("Do you do curbless showers?","Yes — fully waterproofed curbless showers with benches, niches and laser-level linear drains.")],
    "Quote your tile project.",
    "Tell us the rooms, rough square footage and the look — we'll measure and quote.",
    svc("Tile Installation"),
    related_for("tile-installation")))

pages.append(page("kitchen-bathroom-renovation",
    "Kitchen & Bathroom Stone Renovations GTA | Dziura Stone & Tile",
    "Full kitchen and bathroom stone renovations across the GTA and Muskoka — demolition, tile, backsplash, countertops and showers by one accountable crew. From $12,000. Free quote.",
    "kitchen renovation tile GTA, bathroom renovation Toronto, stone renovation, backsplash and countertop, curbless shower, gut renovation contractor",
    "Renovations · Kitchen · Bath",
    "Kitchen & Bathroom Stone Renovations",
    "Demolition through finished stone — floor, wall, backsplash, shower and countertops handled by one accountable master crew.",
    "portfolio-bath.png",
    "One crew, from demo to the final seam.",
    "Renovations go sideways when four trades point fingers. We self-perform the whole stone-and-tile scope of your kitchen or bathroom: demolition and haul-away, substrate and waterproofing, floor and wall tile, backsplash, and fabricated countertops. You get a clear timeline, a clean site, and one team accountable for every surface. Kitchen and bath stone renovations start around $12,000; full gut renovations start around $35,000.",
    [("Demolition & Haul-Away","We take the room back to studs and subfloor and dispose of it cleanly."),
     ("Waterproofing","Proper membranes and slopes so wet areas stay watertight for the long haul."),
     ("Tile & Backsplash","Floors, walls, showers and backsplashes set flat with tight, even grout lines."),
     ("Countertops","Templated and installed granite, quartz or marble tops to match the design."),
     ("Curbless Showers & Heated Floors","Spa-grade curbless showers, niches and warm underfoot tile."),
     ("Trade Coordination","We coordinate cleanly with your designer, plumber and electrician.")],
    [("portfolio-bath.png","Marble ensuite renovation","Marble ensuite — Oakville"),
     ("portfolio-kitchen.png","Granite kitchen renovation","Granite kitchen — Rosedale"),
     ("portfolio-shower.png","Curbless shower renovation","Curbless shower — Forest Hill")],
    [("What does a kitchen or bathroom renovation cost?","Stone and tile renovations of a kitchen or bath start around $12,000; full gut renovations with demolition start around $35,000. Your firm price is set after an on-site measure and scope review."),
     ("Do you handle everything or just the stone?","We self-perform all the stone and tile scope — demo, prep, waterproofing, tile and countertops — and coordinate with your other trades."),
     ("How long does a bathroom take?","A typical bathroom runs one to two weeks depending on scope and fabrication lead time; we give you a realistic phased timeline in the quote."),
     ("Can you work from my designer's plans?","Yes — much of our work comes through designers like ON Home Decor. We execute the selections and layout you've approved.")],
    "Plan your renovation.",
    "Share the space and scope — we'll walk it, measure and quote.",
    svc("Kitchen & Bathroom Renovation"),
    related_for("kitchen-bathroom-renovation")))

pages.append(page("commercial-stone-tile",
    "Commercial Tile & Natural Stone Installation GTA | Dziura Stone & Tile",
    "Commercial tile and natural-stone installation across the GTA — lobbies, retail, restaurants and offices. Live-building and construction-schedule capable. Request a tender.",
    "commercial tile contractor GTA, natural stone lobby, commercial flooring Toronto, retail tile installation, restaurant tile, stone cladding commercial",
    "Commercial · Live-Site Capable",
    "Commercial Tile & Natural Stone Installation",
    "Lobbies, retail, restaurants and offices — large-scale tile and natural-stone installation delivered on a construction schedule.",
    "portfolio-commercial.png",
    "Built for schedules, spec and scale.",
    "Commercial work rewards crews who can phase around a live building, hit spec, and protect a finished space. We install honed floor tile, full-height natural-stone cladding, feature walls and washroom packages for lobbies, retail, hospitality and offices — coordinated with the GC and delivered on the construction schedule. We tender whole-project stone and tile scope and staff it to hit the date.",
    [("Lobbies & Cladding","Full-height natural-stone cladding and honed floor tile that set the tone at the entrance."),
     ("Retail & Hospitality","Durable, on-brand tile and stone for stores, restaurants and bars."),
     ("Washroom Packages","Repeatable, fully waterproofed commercial washroom tile packages."),
     ("Live-Building Capable","Phasing, protection and off-hours work to keep an operating building running."),
     ("Spec & Submittals","We work to spec, provide samples and hit the finish schedule."),
     ("Tendered Scope","Whole-project stone and tile scope tendered and staffed to the date.")],
    [("portfolio-commercial.png","Natural stone commercial lobby","Natural stone lobby — Mississauga"),
     ("portfolio-slate.png","Slate-look commercial floor tile","Honed floor tile"),
     ("portfolio-slab.png","Large-format stone cladding","Large-format cladding")],
    [("Do you work on live commercial buildings?","Yes — we phase work, protect finished areas and work off-hours where needed to keep an operating building running."),
     ("Can you tender whole-project scope?","We tender and staff the complete stone and tile scope of a project and manage it to the construction schedule."),
     ("What commercial spaces do you do?","Lobbies, retail, restaurants, bars, offices and washroom packages — floors, walls, cladding and feature stone."),
     ("Do you work to spec and provide submittals?","Yes — samples, submittals and finish-schedule adherence are standard on our commercial work.")],
    "Request a commercial tender.",
    "Send the drawings and finish schedule — we'll price the stone and tile scope.",
    svc("Commercial Tile & Stone Installation"),
    related_for("commercial-stone-tile")))

# ---- LOCATION PAGES ----
def loc_page(slug, city, blurb, hero_img, nearby):
    return page(slug,
        f"{city} Stone, Tile & Granite Contractor | Dziura Stone & Tile",
        f"Granite & quartz countertops, tile installation, backsplashes and renovations in {city}. Family master stoneworkers led by Daniel Dziura. Free on-site quotes. $30–$40/sq ft tile.",
        f"stone contractor {city}, tile installation {city}, granite countertops {city}, {city} tile contractor, backsplash {city}, bathroom renovation {city}",
        f"{city} · GTA · Southern Ontario",
        f"{city} Stone, Tile & Granite Contractor",
        f"Granite and quartz countertops, floor and wall tile, backsplashes and full renovations for {city} homes and businesses — installed by a family master crew.",
        hero_img,
        f"High-end stone and tile in {city}.",
        blurb,
        [("Countertops","Granite, quartz and marble countertops templated, fabricated and installed."),
         ("Tile — Floors & Walls","Porcelain, ceramic and natural-stone tile with proper prep and waterproofing."),
         ("Backsplashes","Subway, herringbone and full-height stone backsplashes."),
         ("Renovations","Full kitchen and bath stone renovations, demo to finished surface."),
         ("Heated Floors","Large-format porcelain over in-floor heat, crack-free for the long haul."),
         ("Free On-Site Quote","We visit, measure and send a transparent written quote — no obligation.")],
        [("portfolio-kitchen.png",f"Granite kitchen {city}","Granite kitchen"),
         ("portfolio-backsplash.png",f"Marble backsplash {city}","Marble backsplash"),
         ("portfolio-bath.png",f"Marble bathroom {city}","Marble bathroom")],
        [(f"Do you serve {city}?","Yes — {c} is part of our core GTA service area. We provide free on-site quotes and self-perform the full stone and tile scope.".format(c=city)),
         ("How much does tile cost per square foot?","About $30–$40 per square foot installed depending on tile, layout and substrate; a single room starts at $2,500. Countertops run $85–$180 per square foot installed."),
         ("Do you handle demolition and prep?","Yes — demo, haul-away, substrate prep and waterproofing are all self-performed by our crew."),
         (f"Can you work with my {city} designer or builder?","Absolutely — much of our work comes through designers and builders. We coordinate cleanly and execute the approved selections.")],
        f"Book your free {city} on-site quote.",
        f"Tell us about your {city} project — countertops, tile, backsplash or a full renovation — and we'll schedule a measure.",
        place(city), related_for(slug))

pages.append(loc_page("toronto-stone-tile","Toronto",
    "From Rosedale kitchens to King West condos and Forest Hill baths, Toronto's finest homes trust us with the surfaces that get seen and touched every day. We handle condo access, tight downtown sites and heritage details, self-performing demolition through finished stone so there's one crew accountable for the result. Installed tile runs about $30–$40 per square foot, with single-room projects from $2,500 and countertops from $3,900.",
    "portfolio-kitchen.png",["North York","Scarborough","Etobicoke"]))
pages.append(loc_page("mississauga-stone-tile","Mississauga",
    "Across Mississauga's estates, condos and commercial spaces, we deliver granite and quartz countertops, large-format tile and full renovations to a craftsman's tolerance. From lakeside homes to Square One-area builds and commercial lobbies, we self-perform the whole stone and tile scope and keep the site clean and on schedule. Installed tile runs about $30–$40 per square foot, with countertops from $3,900.",
    "portfolio-commercial.png",["Oakville","Brampton","Milton"]))
pages.append(loc_page("oakville-stone-tile","Oakville",
    "Oakville's high-budget renovations demand flawless marble, book-matched slabs and dead-flat large-format floors — exactly the work we're known for. We take primary baths and chef's kitchens from demolition through finished stone with waterproofing, heated floors and seamless countertops. Installed tile runs about $30–$40 per square foot, with kitchen and bath renovations from $12,000.",
    "portfolio-bath.png",["Burlington","Mississauga","Milton"]))
pages.append(loc_page("vaughan-stone-tile","Vaughan",
    "In Vaughan's custom homes and new builds, we install granite and quartz countertops, full-height stone backsplashes and large-format tile throughout. We coordinate with builders and designers on a construction schedule and self-perform every surface so nothing falls between trades. Installed tile runs about $30–$40 per square foot, with whole-home programs quoted by tender.",
    "portfolio-slab.png",["Richmond Hill","Markham","Aurora"]))

# ---- SITEMAP ----
all_slugs=list(pages)+["muskoka-stone-tile-granite"]
urls=[BASE+"/"]+[f"{BASE}/{s}/" for s in all_slugs]
sm='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
for i,u in enumerate(urls):
    pr="1.0" if i==0 else "0.8"
    cf="weekly" if i==0 else "monthly"
    sm+=f"  <url><loc>{u}</loc><changefreq>{cf}</changefreq><priority>{pr}</priority></url>\n"
sm+="</urlset>\n"
open(os.path.join(SITE,"sitemap.xml"),"w").write(sm)
print("sitemap urls:",len(urls))
print("DONE")
