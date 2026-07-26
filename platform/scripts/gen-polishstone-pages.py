#!/usr/bin/env python3
"""Polish Stone — SEO landing page generator (premium editorial system).
Every page shares assets/site.css + assets/site.js (curtain, cursor, reveals,
parallax) and carries unique title/description/H1 + LocalBusiness/Service/
Breadcrumb/FAQ JSON-LD. Regenerates services, locations and Muskoka."""
import os, json, html

SITE = os.path.join(os.path.dirname(__file__), "..", "polishstone-site")
BASE = "https://polishstone.ca"
PHONE = "(437) 555-0140"; TEL = "+1-437-555-0140"; EMAIL = "info@polishstone.ca"

def esc(s): return html.escape(s, quote=True)

SERVICES = [("granite-quartz-countertops", "Countertops"),
            ("tile-installation", "Tile"),
            ("kitchen-bathroom-renovation", "Renovations"),
            ("commercial-stone-tile", "Commercial")]
LOCS = [("toronto-stone-tile", "Toronto"), ("mississauga-stone-tile", "Mississauga"),
        ("oakville-stone-tile", "Oakville"), ("vaughan-stone-tile", "Vaughan"),
        ("muskoka-stone-tile-granite", "Muskoka")]

def related_for(current):
    pool = [(s, n) for s, n in SERVICES + LOCS if s != current]
    return pool[:5]

def page(slug, title, desc, keywords, eyebrow, h1_html, hero_lead, hero_img,
         intro_h2_html, intro_body, features, gallery, faqs, cta_h2_html,
         cta_lead, schema_extra):
    url = f"{BASE}/{slug}/"
    h1_plain = h1_html.replace('<span class="em">', "").replace("</span>", "")
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": ["GeneralContractor", "HomeAndConstructionBusiness"],
         "@id": f"{BASE}/#business", "name": "Polish Stone",
         "url": BASE + "/", "telephone": TEL, "email": EMAIL,
         "image": f"{BASE}/assets/og-image.png", "priceRange": "$$$",
         "slogan": "Polish by heritage. Polished by hand.",
         "founder": {"@type": "Person", "name": "Daniel Dziura", "jobTitle": "Owner & Master Stoneworker"},
         "knowsLanguage": ["en", "pl"],
         "description": "Family-run granite, tile and natural-stone installation contractor serving the GTA, Southern Ontario and Muskoka."},
        schema_extra,
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
            {"@type": "ListItem", "position": 2, "name": h1_plain, "item": url}]},
        {"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q,
             "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]}
    ]}

    feats = "\n".join(
        f'''      <div class="frow rv"><span class="num-idx">{i+1:02d}</span><h3>{esc(t)}</h3><p>{esc(p)}</p></div>'''
        for i, (t, p) in enumerate(features))
    gal = "\n".join(
        f'''      <figure class="rv-img"><img src="../assets/{src}" alt="{esc(alt)}" loading="lazy"><figcaption>{esc(cap)}<i>{esc(sub)}</i></figcaption></figure>'''
        for src, alt, cap, sub in gallery)
    faq_html = "\n".join(
        f'''      <div class="faq__item">
        <button class="faq__q" aria-expanded="false"><span class="num-idx">{i+1:02d}</span><h3>{esc(q)}</h3><span class="faq__ic"></span></button>
        <div class="faq__a"><p>{esc(a)}</p></div>
      </div>''' for i, (q, a) in enumerate(faqs))
    rel = "\n".join(
        f'      <a href="../{s}/">{esc(n)}</a>' for s, n in related_for(slug))

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
<meta name="theme-color" content="#12100D">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Polish Stone">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{BASE}/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="../assets/icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,300..900&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False)}
</script>
<link rel="stylesheet" href="../assets/site.css">
</head>
<body>
<div class="curtain" aria-hidden="true"></div>
<div class="cursor" aria-hidden="true"><div class="cursor__ring"><span class="cursor__label"></span></div><div class="cursor__dot"></div></div>

<header class="nav nav--dark" id="nav">
  <div class="nav__in">
    <a class="brand" href="../" aria-label="Polish Stone — home">
      <b>POLISH<span class="brand__ps">&nbsp;STONE</span></b>
      <small>est. 2015</small>
    </a>
    <nav class="nav__links" aria-label="Primary">
      <a href="../#services">Services</a>
      <a href="../#work">Work</a>
      <a href="../#pricing">Pricing</a>
      <a href="../#areas">Areas</a>
      <span class="nav__tel"><a href="tel:{TEL}">{PHONE}</a></span>
      <a href="#contact" class="btn btn--solid">Free Quote <span class="arw">→</span></a>
    </nav>
    <button class="burger" aria-label="Open menu"><i></i><i></i><i></i></button>
  </div>
</header>

<nav class="menu" aria-label="Menu">
  <button class="menu__close micro" aria-label="Close menu" style="color:var(--d-mut)">Close ✕</button>
  <a class="menu__l" href="../#services"><span class="num-idx">01</span> Services</a>
  <a class="menu__l" href="../#work"><span class="num-idx">02</span> Work</a>
  <a class="menu__l" href="../#pricing"><span class="num-idx">03</span> Pricing</a>
  <a class="menu__l" href="#contact"><span class="num-idx">04</span> Free Quote</a>
  <div class="menu__meta">
    <span><a href="tel:{TEL}">{PHONE}</a></span>
    <span><a href="mailto:{EMAIL}">{EMAIL}</a></span>
    <span>GTA → Muskoka</span>
  </div>
</nav>

<section class="hero phero">
  <div class="hero__bg"><img src="../assets/{hero_img}" alt="{esc(h1_plain)} — Polish Stone" fetchpriority="high"></div>
  <div class="hero__in">
    <p class="crumb micro"><a href="../">Home</a> <span>→</span> <span style="color:var(--gold)">{esc(eyebrow)}</span></p>
    <h1 class="d1 rv-t">{h1_html}</h1>
    <p class="lead rv dly-2">{esc(hero_lead)}</p>
    <div class="hero__cta rv dly-3">
      <a href="#contact" class="btn btn--solid" data-cursor="Call">Get a Free Phone Estimate <span class="arw">→</span></a>
      <a href="tel:{TEL}" class="btn btn--ghost">Call {PHONE}</a>
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap" style="max-width:1080px">
    <p class="eyebrow micro micro--accent rv">{esc(eyebrow)}</p>
    <h2 class="d2 rv-t">{intro_h2_html}</h2>
    <p class="lead rv" style="max-width:none;margin-top:24px">{esc(intro_body)}</p>
  </div>
</section>

<section class="sec sec--tint hairline-t sec--flush" style="padding:clamp(70px,9vw,130px) 0">
  <div class="wrap">
    <div class="frows">
{feats}
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap">
    <p class="eyebrow micro micro--accent rv">Selected work &amp; finishes</p>
    <div class="trio" style="margin-top:clamp(24px,3vw,40px)">
{gal}
    </div>
  </div>
</section>

<section class="sec sec--tint hairline-t">
  <div class="wrap" style="max-width:1080px">
    <p class="eyebrow micro micro--accent rv">Questions</p>
    <div class="faq rv" style="margin-top:clamp(20px,3vw,34px)">
{faq_html}
    </div>
  </div>
</section>

<section class="sec sec--dark" id="contact">
  <div class="wrap cta__grid">
    <div>
      <p class="eyebrow micro rv" style="color:var(--gold)">Zaczynamy · Let's begin</p>
      <h2 class="d2 rv-t">{cta_h2_html}</h2>
      <p class="lead rv" style="margin-top:20px">{esc(cta_lead)}</p>
      <ul class="cta__facts rv">
        <li><span class="micro" style="color:var(--gold)">Phone</span><a href="tel:{TEL}">{PHONE}</a></li>
        <li><span class="micro" style="color:var(--gold)">Email</span><a href="mailto:{EMAIL}">{EMAIL}</a></li>
        <li><span class="micro" style="color:var(--gold)">Owner</span><span>Daniel Dziura</span></li>
      </ul>
      <div class="related rv" style="margin-top:34px">
{rel}
      </div>
    </div>
    <form class="form rv dly-1" data-demo>
      <div class="form__row">
        <div><label class="micro">Name</label><input required name="name" placeholder="Your name"></div>
        <div><label class="micro">Phone</label><input required name="phone" placeholder="(000) 000-0000"></div>
      </div>
      <div class="form__row">
        <div><label class="micro">Email</label><input required type="email" name="email" placeholder="you@email.com"></div>
        <div><label class="micro">City</label><input name="city" placeholder="e.g. Oakville"></div>
      </div>
      <label class="micro">The project</label>
      <textarea name="details" rows="3" placeholder="Rooms, rough square footage, timeline, photos or plans…"></textarea>
      <button class="btn btn--solid" type="submit">Request My On-Site Quote <span class="arw">→</span></button>
      <div class="form__ok">Dziękujemy — your request has been noted. In the live version this routes straight into the Polish Stone lead pipeline.</div>
    </form>
  </div>
</section>

<footer class="foot">
  <div class="foot__bar" style="border-top:none">
    <span>© <span data-year></span> Polish Stone · Granite, Tile &amp; Stonework · <a href="../" class="link-u" style="color:var(--gold-2)">polishstone.ca</a></span>
    <span>A <span class="em">Dziura</span> family company · Demo site — placeholder contact details</span>
  </div>
</footer>

<script src="../assets/site.js" defer></script>
</body>
</html>"""
    os.makedirs(os.path.join(SITE, slug), exist_ok=True)
    open(os.path.join(SITE, slug, "index.html"), "w").write(doc)
    print("wrote", slug)
    return slug

def svc_schema(name):
    return {"@type": "Service", "serviceType": name,
            "provider": {"@id": f"{BASE}/#business"},
            "areaServed": [{"@type": "AdministrativeArea", "name": "Greater Toronto Area"},
                           {"@type": "AdministrativeArea", "name": "Muskoka"}]}

def loc_schema(city):
    return {"@type": "Service", "serviceType": "Stone, tile and granite installation",
            "provider": {"@id": f"{BASE}/#business"},
            "areaServed": {"@type": "City", "name": city + ", Ontario"}}

pages = []

# ============ SERVICE PAGES ============
pages.append(page("granite-quartz-countertops",
    "Granite & Quartz Countertops GTA & Muskoka | Polish Stone",
    "Granite, quartz and marble countertops templated, fabricated and installed across the GTA, Southern Ontario and Muskoka. Waterfall edges, book-matched slabs. From $3,900. Free quote.",
    "granite countertops GTA, quartz countertops Toronto, marble countertops, waterfall edge, kitchen countertop installer, countertop fabrication Ontario",
    "Countertops",
    'Countertops that anchor <span class="em">the whole kitchen.</span>',
    "Laser-templated granite, quartz and marble with flawless seams, waterfall edges and book-matched veining — installed by the family that cut it.",
    "hero-marble.png",
    'Priced by the slab. Finished <span class="em">by hand.</span>',
    "Your countertop is the surface everyone touches and every guest sees. We laser-template for a perfect fit, fabricate granite, quartz, marble or porcelain to your chosen edge, and install seamlessly — undermount cutouts, waterfall ends and book-matched veining included. In the GTA, installed countertops generally run $85–$180 per square foot depending on the slab and edge, and a typical kitchen starts around $3,900.",
    [("Granite", "Durable, heat-resistant natural stone with one-of-a-kind veining — sealed and installed to last decades."),
     ("Quartz", "Consistent, low-maintenance engineered stone in a huge range of colours; no sealing required."),
     ("Marble & porcelain", "Statement marble and large-format porcelain slabs for waterfall islands and full-height backsplashes."),
     ("Waterfall & mitred edges", "Book-matched waterfall ends and mitred profiles fabricated for a thick, seamless look."),
     ("Laser templating", "Digital templating captures every wall so your tops drop in with tight, even reveals."),
     ("Undermount cutouts", "Clean undermount sink, cooktop and faucet cutouts, polished and ready for install.")],
    [("portfolio-kitchen.png", "Dark granite waterfall island", "Waterfall granite island", "Rosedale, Toronto"),
     ("portfolio-vanity.png", "White quartz vanity waterfall", "Quartz vanity", "Forest Hill"),
     ("portfolio-slab.png", "Book-matched porcelain slab", "Book-matched slab", "porcelain")],
    [("How much do granite and quartz countertops cost in the GTA?",
      "Generally $85–$180 per square foot installed for granite and quartz, with exotic and book-matched stone higher. That includes laser templating, fabrication, cutouts and installation. A typical kitchen starts around $3,900, confirmed after templating."),
     ("What's the difference between granite and quartz?",
      "Granite is natural stone — unique veining, heat-resistant, needs periodic sealing. Quartz is engineered — highly consistent, non-porous and maintenance-free. We'll help you choose for your use and budget."),
     ("Can you do a waterfall island?",
      "Yes. We fabricate book-matched waterfall ends and mitred edges so the veining flows down the side for a seamless, thick-edge look."),
     ("Do you supply the slab or can I?",
      "Either — we supply through our stone suppliers, or fabricate and install a slab you and your designer selected.")],
    'Price your <span class="em">new countertops.</span>',
    "Send the kitchen dimensions and the look you're after — we'll template, quote and install.",
    svc_schema("Granite & Quartz Countertop Installation")))

pages.append(page("tile-installation",
    "Tile Installation Toronto & GTA — Floors, Walls, Backsplash | Polish Stone",
    "Professional tile installation across the GTA and Muskoka — floors, walls, showers, backsplashes and heated floors. Large-format and natural stone. $30–$40/sq ft. Free on-site quote.",
    "tile installation Toronto, tile contractor GTA, backsplash installation, bathroom tile, heated floor tile, large format tile installer, floor tiling",
    "Tile installation",
    'Tile done right starts <span class="em">under the surface.</span>',
    "Porcelain, ceramic and natural stone set dead-flat — proper substrate, waterproofing and layout so it stays flawless for decades.",
    "portfolio-diagonal.png",
    'Flat floors. Tight lines. <span class="em">No shortcuts.</span>',
    "Beautiful tile is only as good as what's under it. We prep and level the substrate, install uncoupling and waterproofing membranes, and lay out every field so cuts land where they should. From herringbone backsplashes to 4,000 sq ft of heated large-format porcelain, the finish is dead-flat with tight, even grout lines. As a rule of thumb, installed tile runs $30–$40 per square foot, and a single-room project starts at $2,500.",
    [("Floor tile", "Porcelain, ceramic and natural stone over properly prepped, level substrate — including heated-floor systems."),
     ("Wall & shower tile", "Fully waterproofed showers, tub surrounds and feature walls with curbless entries and niches."),
     ("Backsplashes", "Subway, herringbone, mosaic and full-height stone backsplashes with mitred edges and hidden outlets."),
     ("Large-format & slab", "Big-format porcelain and slab tile that demands flatness prep and the right tools — our specialty."),
     ("Heated floors", "In-floor heat with uncoupling membranes so tile stays crack-free through seasonal movement."),
     ("Natural stone", "Marble, limestone, slate and travertine set, honed and sealed with the care natural stone needs.")],
    [("portfolio-backsplash.png", "Marble subway backsplash", "Marble backsplash", "King West"),
     ("portfolio-floor.png", "Heated porcelain floor", "Heated porcelain floor", "Muskoka"),
     ("portfolio-shower.png", "Curbless marble shower", "Curbless shower", "Forest Hill")],
    [("How much does tile installation cost per square foot?",
      "About $30–$40 per square foot installed depending on the tile, layout and substrate. Large-format, natural stone and patterns like herringbone sit higher. A single room typically starts at $2,500, confirmed after an on-site measure."),
     ("Do you remove old tile and prep the subfloor?",
      "Yes — we self-perform demolition, haul-away, substrate levelling and waterproofing before a single tile goes down."),
     ("Can you install heated floors?",
      "Absolutely. In-floor heat under large-format porcelain is one of our specialties, with the uncoupling membranes that keep it flawless."),
     ("Do you do curbless showers?",
      "Yes — fully waterproofed curbless showers with benches, niches and laser-level linear drains.")],
    'Quote your <span class="em">tile project.</span>',
    "Tell us the rooms, rough square footage and the look — we'll measure and quote.",
    svc_schema("Tile Installation")))

pages.append(page("kitchen-bathroom-renovation",
    "Kitchen & Bathroom Stone Renovations GTA | Polish Stone",
    "Full kitchen and bathroom stone renovations across the GTA and Muskoka — demolition, tile, backsplash, countertops and showers by one accountable crew. From $12,000. Free quote.",
    "kitchen renovation tile GTA, bathroom renovation Toronto, stone renovation, backsplash and countertop, curbless shower, gut renovation contractor",
    "Renovations",
    'One crew, from demo to <span class="em">the final seam.</span>',
    "Demolition through finished stone — floor, wall, backsplash, shower and countertops handled by one accountable master crew.",
    "portfolio-bath.png",
    'Renovations fail between trades. <span class="em">So we are all of them.</span>',
    "Renovations go sideways when four trades point fingers. We self-perform the whole stone-and-tile scope of your kitchen or bathroom: demolition and haul-away, substrate and waterproofing, floor and wall tile, backsplash, and fabricated countertops. You get a clear timeline, a clean site, and one team accountable for every surface. Kitchen and bath stone renovations start around $12,000; full gut renovations start around $35,000.",
    [("Demolition & haul-away", "We take the room back to studs and subfloor and dispose of it cleanly."),
     ("Waterproofing", "Proper membranes and slopes so wet areas stay watertight for the long haul."),
     ("Tile & backsplash", "Floors, walls, showers and backsplashes set flat with tight, even grout lines."),
     ("Countertops", "Templated and installed granite, quartz or marble tops to match the design."),
     ("Curbless showers & heated floors", "Spa-grade curbless showers, niches and warm underfoot tile."),
     ("Trade coordination", "We coordinate cleanly with your designer, plumber and electrician.")],
    [("portfolio-bath.png", "Marble ensuite renovation", "Marble ensuite", "Oakville"),
     ("portfolio-kitchen.png", "Granite kitchen renovation", "Granite kitchen", "Rosedale"),
     ("portfolio-shower.png", "Curbless shower renovation", "Curbless shower", "Forest Hill")],
    [("What does a kitchen or bathroom renovation cost?",
      "Stone and tile renovations of a kitchen or bath start around $12,000; full gut renovations with demolition start around $35,000. Your firm price is set after an on-site measure and scope review."),
     ("Do you handle everything or just the stone?",
      "We self-perform all the stone and tile scope — demo, prep, waterproofing, tile and countertops — and coordinate with your other trades."),
     ("How long does a bathroom take?",
      "A typical bathroom runs one to two weeks depending on scope and fabrication lead time; we give you a realistic phased timeline in the quote."),
     ("Can you work from my designer's plans?",
      "Yes — much of our work comes through designers like ON Home Decor. We execute the selections and layout you've approved.")],
    'Plan your <span class="em">renovation.</span>',
    "Share the space and scope — we'll walk it, measure and quote.",
    svc_schema("Kitchen & Bathroom Renovation")))

pages.append(page("commercial-stone-tile",
    "Commercial Tile & Natural Stone Installation GTA | Polish Stone",
    "Commercial tile and natural-stone installation across the GTA — lobbies, retail, restaurants and offices. Live-building and construction-schedule capable. Request a tender.",
    "commercial tile contractor GTA, natural stone lobby, commercial flooring Toronto, retail tile installation, restaurant tile, stone cladding commercial",
    "Commercial",
    'Built for schedules, spec <span class="em">and scale.</span>',
    "Lobbies, retail, restaurants and offices — large-scale tile and natural-stone installation delivered on a construction schedule.",
    "portfolio-commercial.png",
    'Commercial stone, delivered <span class="em">to the date.</span>',
    "Commercial work rewards crews who can phase around a live building, hit spec, and protect a finished space. We install honed floor tile, full-height natural-stone cladding, feature walls and washroom packages for lobbies, retail, hospitality and offices — coordinated with the GC and delivered on the construction schedule. We tender whole-project stone and tile scope and staff it to hit the date.",
    [("Lobbies & cladding", "Full-height natural-stone cladding and honed floor tile that set the tone at the entrance."),
     ("Retail & hospitality", "Durable, on-brand tile and stone for stores, restaurants and bars."),
     ("Washroom packages", "Repeatable, fully waterproofed commercial washroom tile packages."),
     ("Live-building capable", "Phasing, protection and off-hours work to keep an operating building running."),
     ("Spec & submittals", "We work to spec, provide samples and hit the finish schedule."),
     ("Tendered scope", "Whole-project stone and tile scope tendered and staffed to the date.")],
    [("portfolio-commercial.png", "Natural stone commercial lobby", "Natural stone lobby", "Mississauga"),
     ("portfolio-slate.png", "Slate-look commercial floor tile", "Honed floor tile", "commercial"),
     ("portfolio-slab.png", "Large-format stone cladding", "Large-format cladding", "feature wall")],
    [("Do you work on live commercial buildings?",
      "Yes — we phase work, protect finished areas and work off-hours where needed to keep an operating building running."),
     ("Can you tender whole-project scope?",
      "We tender and staff the complete stone and tile scope of a project and manage it to the construction schedule."),
     ("What commercial spaces do you do?",
      "Lobbies, retail, restaurants, bars, offices and washroom packages — floors, walls, cladding and feature stone."),
     ("Do you work to spec and provide submittals?",
      "Yes — samples, submittals and finish-schedule adherence are standard on our commercial work.")],
    'Request a <span class="em">commercial tender.</span>',
    "Send the drawings and finish schedule — we'll price the stone and tile scope.",
    svc_schema("Commercial Tile & Stone Installation")))

# ============ LOCATION PAGES ============
def loc_page(slug, city, h1_html, blurb, hero_img, features=None, faqs=None, gallery=None):
    features = features or [
        ("Countertops", "Granite, quartz and marble countertops templated, fabricated and installed."),
        ("Tile — floors & walls", "Porcelain, ceramic and natural-stone tile with proper prep and waterproofing."),
        ("Backsplashes", "Subway, herringbone and full-height stone backsplashes."),
        ("Renovations", "Full kitchen and bath stone renovations, demo to finished surface."),
        ("Heated floors", "Large-format porcelain over in-floor heat, crack-free for the long haul."),
        ("Free on-site quote", "We visit, measure and send a transparent written quote — no obligation.")]
    faqs = faqs or [
        (f"Do you serve {city}?",
         f"Yes — {city} is part of our core service area. We provide free on-site quotes and self-perform the full stone and tile scope."),
        ("How much does tile cost per square foot?",
         "About $30–$40 per square foot installed depending on tile, layout and substrate; a single room starts at $2,500. Countertops run $85–$180 per square foot installed."),
        ("Do you handle demolition and prep?",
         "Yes — demo, haul-away, substrate prep and waterproofing are all self-performed by our crew."),
        (f"Can you work with my {city} designer or builder?",
         "Absolutely — much of our work comes through designers and builders. We coordinate cleanly and execute the approved selections.")]
    gallery = gallery or [
        ("portfolio-kitchen.png", f"Granite kitchen {city}", "Granite kitchen", city),
        ("portfolio-backsplash.png", f"Marble backsplash {city}", "Marble backsplash", city),
        ("portfolio-bath.png", f"Marble bathroom {city}", "Marble bathroom", city)]
    return page(slug,
        f"{city} Stone, Tile & Granite Contractor | Polish Stone",
        f"Granite & quartz countertops, tile installation, backsplashes and renovations in {city}. Polish master stoneworkers led by Daniel Dziura. Free on-site quotes. $30–$40/sq ft tile.",
        f"stone contractor {city}, tile installation {city}, granite countertops {city}, {city} tile contractor, backsplash {city}, bathroom renovation {city}",
        city, h1_html,
        f"Granite and quartz countertops, floor and wall tile, backsplashes and full renovations for {city} homes and businesses — installed by a Polish family master crew.",
        hero_img,
        f'High-end stone and tile, <span class="em">in {city}.</span>',
        blurb, features, gallery, faqs,
        f'Book your free {city} <span class="em">on-site quote.</span>',
        f"Tell us about your {city} project — countertops, tile, backsplash or a full renovation — and we'll schedule a measure.",
        loc_schema(city))

pages.append(loc_page("toronto-stone-tile", "Toronto",
    'Toronto\'s stone crew for homes that <span class="em">get noticed.</span>',
    "From Rosedale kitchens to King West condos and Forest Hill baths, Toronto's finest homes trust us with the surfaces that get seen and touched every day. We handle condo access, tight downtown sites and heritage details, self-performing demolition through finished stone so there's one crew accountable for the result. Installed tile runs about $30–$40 per square foot, with single-room projects from $2,500 and countertops from $3,900.",
    "portfolio-kitchen.png"))

pages.append(loc_page("mississauga-stone-tile", "Mississauga",
    'Estate to condo, Mississauga gets <span class="em">the same standard.</span>',
    "Across Mississauga's estates, condos and commercial spaces, we deliver granite and quartz countertops, large-format tile and full renovations to a craftsman's tolerance. From lakeside homes to Square One-area builds and commercial lobbies, we self-perform the whole stone and tile scope and keep the site clean and on schedule. Installed tile runs about $30–$40 per square foot, with countertops from $3,900.",
    "portfolio-commercial.png"))

pages.append(loc_page("oakville-stone-tile", "Oakville",
    'Oakville renovations, finished to <span class="em">a hand-flat tolerance.</span>',
    "Oakville's high-budget renovations demand flawless marble, book-matched slabs and dead-flat large-format floors — exactly the work we're known for. We take primary baths and chef's kitchens from demolition through finished stone with waterproofing, heated floors and seamless countertops. Installed tile runs about $30–$40 per square foot, with kitchen and bath renovations from $12,000.",
    "portfolio-bath.png"))

pages.append(loc_page("vaughan-stone-tile", "Vaughan",
    'Vaughan custom builds, stoned <span class="em">on schedule.</span>',
    "In Vaughan's custom homes and new builds, we install granite and quartz countertops, full-height stone backsplashes and large-format tile throughout. We coordinate with builders and designers on a construction schedule and self-perform every surface so nothing falls between trades. Installed tile runs about $30–$40 per square foot, with whole-home programs quoted by tender.",
    "portfolio-slab.png"))

pages.append(loc_page("muskoka-stone-tile-granite", "Muskoka",
    'Cottage country deserves <span class="em">city-grade stone.</span>',
    "Muskoka properties push stone and tile hard — seasonal movement, radiant heat, big open floor plans and statement natural-stone features. We plan the substrate, membranes and layout so your floors don't crack, your seams disappear, and your feature walls look like they grew there. We coordinate templating and fabrication around cottage access and your builder's schedule so the trip north is worth it in one clean mobilization.",
    "portfolio-floor.png",
    features=[
        ("Heated large-format floors", "Porcelain and stone over in-floor heat with proper uncoupling — flawless through Muskoka's seasonal swings."),
        ("Natural-stone fireplaces", "Full-height stone surrounds and feature walls that anchor a lakehouse great room."),
        ("Granite & quartz kitchens", "Book-matched islands, waterfall edges and durable surfaces built for busy cottage kitchens."),
        ("Patios, steps & exterior", "Mortar-set and dry-laid natural stone for lakeside patios, walkways and retaining details."),
        ("One clean mobilization", "Templating and fabrication planned around cottage access and your builder's schedule."),
        ("Port Carling → Huntsville", "Gravenhurst, Bracebridge, Huntsville, Port Carling and the lakes — we're there regularly.")],
    faqs=[
        ("Do you travel to Muskoka for stone and tile projects?",
         "Yes. We regularly deliver high-ticket projects across Muskoka — Port Carling, Bracebridge, Huntsville, Gravenhurst and the lakes — coordinating templating, fabrication and installation around cottage and build schedules so travel is efficient and the work is done right in one mobilization."),
        ("Can you install heated floors and large-format tile in a lakehouse?",
         "Absolutely. Large-format porcelain over in-floor heat is one of our specialties, along with the substrate prep and uncoupling membranes that keep it flawless through seasonal movement."),
        ("Do you do natural-stone fireplaces and exterior stonework?",
         "Yes — interior and exterior natural-stone cladding, fireplace surrounds, patios, steps and feature walls, mortar-set or dry-laid to suit the property."),
        ("How do you handle cottage access and scheduling?",
         "We plan the scope so materials, templating and crew arrive in coordinated mobilizations, working with your builder's schedule and the realities of cottage-road access.")],
    gallery=[
        ("portfolio-floor.png", "Heated porcelain floor Lake Rosseau", "Heated porcelain floors", "Lake Rosseau"),
        ("portfolio-outdoor.png", "Natural stone patio Port Carling", "Stone patio & steps", "Port Carling"),
        ("portfolio-fireplace.png", "Ledgestone fireplace Muskoka great room", "Ledgestone fireplace", "Muskoka Lakes")]))

# ============ SITEMAP + ROBOTS ============
urls = [BASE + "/"] + [f"{BASE}/{s}/" for s in pages]
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
for i, u in enumerate(urls):
    pr = "1.0" if i == 0 else "0.8"
    cf = "weekly" if i == 0 else "monthly"
    sm += f"  <url><loc>{u}</loc><changefreq>{cf}</changefreq><priority>{pr}</priority></url>\n"
sm += "</urlset>\n"
open(os.path.join(SITE, "sitemap.xml"), "w").write(sm)
open(os.path.join(SITE, "robots.txt"), "w").write(
    "User-agent: *\nAllow: /\n\nSitemap: " + BASE + "/sitemap.xml\n")
print("sitemap urls:", len(urls))
print("DONE")
