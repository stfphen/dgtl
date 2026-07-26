import { normalizeTenantConfig } from "../defaultTenant.js";

// Polish Stone — GTA / Southern Ontario / Muskoka stone, tile & granite
// contracting, owned and led by Daniel Dziura. A Polish family of master
// stoneworkers delivering large-scale installation projects for high-budget
// residential and commercial clients: granite & quartz countertops, floor and
// wall tiling, kitchen and bathroom backsplashes, full renovations with
// demolition, natural-stone cladding, fireplaces, and commercial fit-outs.
//
// Positioned alongside (not competing with) the ON Home Decor design tenant:
// ON Home Decor curates design + selections, Dziura Stone & Tile executes the
// stone/tile/granite installation. Inquiry-led funnel — a complimentary in-home
// consultation & detailed quote is the low-friction entry offer, laddering up
// into room installs, countertops, kitchen/bath renos, full-gut renovations,
// and whole-home / commercial stone programs.
//
// Purpose-built to surface high-value granite, stone, and tile leads via strong
// local SEO across the Greater Toronto Area, Southern Ontario, and Muskoka.
export const polishStoneTenant = normalizeTenantConfig({
  id: "tenant_polish_stone",
  slug: "polish-stone",
  status: "active",
  domains: [
    "polishstone.ca",
    "www.polishstone.ca",
    "polishstone.com"
  ],
  defaultPackageId: "in-home-consultation-quote",
  brand: {
    name: "Polish Stone",
    eyebrow: "GTA · Southern Ontario · Muskoka Stone, Tile & Granite Contractors",
    logoText: "POLISH STONE",
    tagline: "Polish by heritage. Polished by hand.",
    logo: "",
    appIcon: "",
    primaryColor: "#33383D",
    accentColor: "#B08641"
  },
  media: {
    heroImage: "/assets/polishstone/hero-granite.png",
    heroAlt:
      "A high-end Toronto kitchen with a waterfall-edge granite island, natural-stone backsplash, and large-format porcelain tile floor installed by Polish Stone."
  },
  hero: {
    headline: "Master stone, tile & granite work for Ontario's most demanding projects.",
    subheadline:
      "Polish Stone is a family of Polish master stoneworkers, led by Daniel Dziura, delivering full-scale granite countertops, floor and wall tiling, backsplashes, renovations, and commercial installations across the GTA, Southern Ontario, and Muskoka. Precision cutting, flawless installation, and workmanship built to last generations.",
    primaryCta: "Book Your Free On-Site Quote",
    secondaryCta: "See Our Work",
    stats: [
      { value: "10+ yrs", label: "referral-built reputation" },
      { value: "$30–40", label: "per sq ft installed tile" },
      { value: "GTA→Muskoka", label: "full service region" }
    ]
  },
  problem: {
    eyebrow: "Why It Matters",
    headline: "On a high-budget project, the stonework is where it can all go wrong.",
    points: [
      "A single miscut slab or lippage line shows forever — and costs a fortune to redo.",
      "Backsplashes, waterfall edges, and book-matched veining demand a true craftsman, not a general handyman.",
      "Large tile and natural stone need proper substrate, waterproofing, and flatness — or they crack and lift.",
      "Most trades can't self-perform demolition, subfloor, tile, and countertop under one accountable crew."
    ]
  },
  system: {
    eyebrow: "The Standard",
    headline: "One family, one crew, accountable for every cut.",
    body:
      "For over a decade, Daniel Dziura and his crew have let the work speak for itself — nearly every project has come from a referral or a returning client. We bring old-world Polish stonemasonry discipline to modern, high-budget builds: measured twice, cut once, installed to a tolerance you can run your hand across and never feel a seam.",
    features: [
      {
        title: "Self-performed, start to finish",
        body: "Demolition, substrate prep, waterproofing, tile, and stone fabrication handled by one crew — no finger-pointing between trades."
      },
      {
        title: "Natural stone specialists",
        body: "Granite, quartz, marble, porcelain, and natural stone — including book-matched slabs, waterfall edges, and full-height feature walls."
      },
      {
        title: "Built to spec, built to last",
        body: "Proper mortar beds, uncoupling membranes, and flatness prep so large-format and natural stone stays flawless for decades."
      }
    ]
  },
  process: {
    eyebrow: "How We Work",
    headline: "Clear scope. Firm quote. Clean site.",
    steps: [
      { title: "On-site consultation", body: "Daniel visits the property, measures, reviews substrate and access, and understands the vision and budget." },
      { title: "Detailed written quote", body: "A transparent, line-item quote covering material, labour, demolition, prep, and installation — no surprise extras." },
      { title: "Fabrication & installation", body: "Templating, precision cutting, and installation by our own master crew, with the site kept clean and protected." },
      { title: "Walkthrough & warranty", body: "A final walkthrough on every seam and edge, plus a workmanship warranty you can count on." }
    ]
  },
  output: {
    eyebrow: "What We Install",
    headline: "From a single backsplash to a whole-home stone program.",
    body:
      "Whether it's one bathroom floor or a full commercial fit-out, we bring the same craftsmanship to every square foot of stone and tile we set.",
    tiles: [
      "GRANITE COUNTERTOPS", "QUARTZ COUNTERTOPS", "KITCHEN BACKSPLASHES", "BATHROOM TILE",
      "FLOOR TILING", "WALL TILING", "HEATED FLOORS", "NATURAL STONE CLADDING",
      "FIREPLACES", "FULL RENOVATIONS", "DEMOLITION", "COMMERCIAL PROJECTS"
    ]
  },
  portfolio: {
    eyebrow: "Selected Work",
    headline: "The work speaks for itself.",
    body:
      "A sample of high-end residential and commercial stone, tile, and granite projects delivered across the GTA, Southern Ontario, and Muskoka.",
    items: [
      { id: "rosedale-granite-kitchen", title: "Waterfall Granite Island — Rosedale", caption: "Book-matched granite island with a waterfall edge, full-height stone backsplash, and large-format porcelain floor.", client: "Rosedale, Toronto", result: "Whole-kitchen stone program", mediaType: "image", src: "/assets/polishstone/portfolio-kitchen.png" },
      { id: "oakville-marble-ensuite", title: "Full Marble Ensuite — Oakville", caption: "Book-matched marble walls, heated floors, and a curbless walk-in shower with a laser-level linear drain.", client: "Oakville", result: "Gut renovation + waterproofing", mediaType: "image", src: "/assets/polishstone/portfolio-bath.png" },
      { id: "muskoka-lakehouse-floors", title: "Heated Porcelain Floors — Muskoka Lakehouse", caption: "Large-format porcelain over in-floor heat throughout a 4,000 sq ft lakeside build.", client: "Lake Rosseau, Muskoka", result: "4,000+ sq ft installed", mediaType: "image", src: "/assets/polishstone/portfolio-floor.png" },
      { id: "kingwest-backsplash", title: "Marble Subway Backsplash — King West", caption: "Precision marble backsplash with mitred outlets and a hidden-edge profile in a downtown condo.", client: "King West, Toronto", result: "Detail-grade tile work", mediaType: "image", src: "/assets/polishstone/portfolio-backsplash.png" },
      { id: "mississauga-lobby", title: "Natural Stone Lobby — Mississauga", caption: "Full-height natural-stone cladding and honed floor tile for a commercial lobby, installed on a live-building schedule.", client: "Mississauga (commercial)", result: "Commercial fit-out", mediaType: "image", src: "/assets/polishstone/portfolio-commercial.png" },
      { id: "muskoka-stone-patio", title: "Natural Stone Patio & Steps — Muskoka", caption: "Dry-laid and mortar-set natural stone patio, steps, and retaining details for a lakeside cottage property.", client: "Port Carling, Muskoka", result: "Exterior stonework", mediaType: "image", src: "/assets/polishstone/portfolio-outdoor.png" },
      { id: "muskoka-fireplace", title: "Ledgestone Fireplace — Muskoka", caption: "Full-height natural ledgestone fireplace surround anchoring a lakehouse great room.", client: "Muskoka Lakes", result: "Feature stonework", mediaType: "image", src: "/assets/polishstone/portfolio-fireplace.png" },
      { id: "foresthill-shower", title: "Curbless Marble Shower — Forest Hill", caption: "Large-format marble walls, a curbless entry, and a fully waterproofed bench and niche.", client: "Forest Hill, Toronto", result: "Spa bathroom", mediaType: "image", src: "/assets/polishstone/portfolio-shower.png" }
    ]
  },
  references: {
    eyebrow: "Trusted By",
    headline: "Builders, designers, and homeowners who don't settle.",
    testimonials: [
      { quote: "We hand Daniel our most demanding kitchens and the seams disappear. Polish Stone is the only crew we let touch our high-end clients' homes.", name: "Interior Designer", role: "Design Partner", company: "GTA" },
      { quote: "Full gut of the primary bath — demo, waterproofing, marble, heated floor. On budget, on schedule, and flawless. They self-perform everything.", name: "Homeowner", role: "Whole-home renovation", company: "Oakville" },
      { quote: "Our Muskoka build had 4,000 square feet of large-format porcelain over in-floor heat. Not one hollow tile, not one lippage line. True craftsmen.", name: "Custom Home Builder", role: "Repeat client", company: "Muskoka" }
    ],
    logos: [
      { name: "ON Home Decor", src: "/assets/polishstone/partner-onhomedecor.png", alt: "ON Home Decor — design partner" },
      { name: "Northshore Builders", src: "/assets/polishstone/partner-northshore.png", alt: "Northshore Builders" },
      { name: "Lakeside Design Co.", src: "/assets/polishstone/partner-lakeside.png", alt: "Lakeside Design Co." },
      { name: "Rosseau Custom Homes", src: "/assets/polishstone/partner-rosseau.png", alt: "Rosseau Custom Homes" }
    ]
  },
  packageSection: {
    eyebrow: "Scope & Investment",
    headline: "Start with a free quote. Scale to a whole-home stone program.",
    body:
      "Every project is priced after an on-site consultation, because material, substrate, demolition, and access all change the number. The ranges below are honest starting points so you know what to expect. As a rule of thumb, installed tile work runs $30–$40 per square foot, and stone countertops are priced by the slab and edge."
  },
  packages: [
    { id: "in-home-consultation-quote", name: "In-Home Consultation & Detailed Quote", summary: "A no-obligation on-site visit, measure, and transparent written quote.", price: "Complimentary", priceQualifier: "on-site", priceDisplay: "Complimentary on-site quote", altPrice: "Most projects start here", action: "booking", paymentLink: "", bookingLink: "", cta: "Book Your Free On-Site Quote", featured: true, description: "We come to the property, measure the space, review substrate, access, and material options, and follow up with a clear, line-item written quote covering material, labour, prep, and installation.", features: ["On-site measure and substrate assessment", "Material and finish guidance for your budget", "Transparent, line-item written quote", "No obligation and no pressure"] },
    { id: "single-room-tile-flooring", name: "Single-Room Tile & Flooring Installation", summary: "One room of floor or wall tile, installed to a craftsman's tolerance.", price: "From $2,500", priceQualifier: "per room", priceDisplay: "From $2,500 · $30–$40 / sq ft installed", altPrice: "Floors, walls & bathrooms", action: "booking", paymentLink: "", bookingLink: "", cta: "Quote a Room", description: "Professional supply-and-install of floor or wall tile for a single room — bathrooms, mudrooms, laundry, or feature walls — including substrate prep, waterproofing where needed, and precision layout.", features: ["Substrate prep and flatness correction", "Waterproofing for wet areas", "Large-format and natural-stone capable", "Clean, protected work site"] },
    { id: "granite-quartz-countertops", name: "Granite & Quartz Countertops", summary: "Templated, fabricated, and installed natural stone and quartz surfaces.", price: "From $3,900", priceQualifier: "per kitchen", priceDisplay: "From $3,900 · $85–$180 / sq ft installed", altPrice: "Slab, edge & install", action: "booking", paymentLink: "", bookingLink: "", cta: "Price a Countertop", description: "Laser-templated granite, quartz, or marble countertops with your choice of slab and edge profile — including waterfall edges, book-matched veining, undermount cutouts, and seamless installation.", features: ["Laser templating for a perfect fit", "Granite, quartz, marble, and porcelain slabs", "Waterfall edges and book-matched options", "Undermount sink and cooktop cutouts"] },
    { id: "kitchen-bath-renovation", name: "Kitchen & Bath Stone Renovation", summary: "Backsplash, floor, countertops, and shower — one accountable crew.", price: "From $12,000", priceQualifier: "per space", priceDisplay: "From $12,000", altPrice: "Full room, self-performed", action: "booking", paymentLink: "", bookingLink: "", cta: "Plan a Renovation", description: "A complete stone and tile renovation of a kitchen or bathroom: demolition, substrate and waterproofing, floor and wall tile, backsplash, and countertops — all self-performed by our crew.", features: ["Demolition and haul-away", "Floor, wall, and backsplash tile", "Countertop fabrication and install", "Curbless showers and heated floors"] },
    { id: "full-renovation-demolition", name: "Full Renovation & Demolition", summary: "Whole-project demolition and rebuild of all stone and tile scope.", price: "From $35,000", priceQualifier: "project", priceDisplay: "From $35,000", altPrice: "Gut renos & additions", action: "booking", paymentLink: "", bookingLink: "", cta: "Scope a Full Reno", description: "Large-scale renovation and demolition where we take on all the stone and tile scope across multiple rooms — coordinated with your builder, designer, or delivered turn-key on the finishes side.", features: ["Multi-room demolition and prep", "All floor, wall, and feature stone", "Countertops throughout the home", "Coordination with your trades"] },
    { id: "whole-home-commercial-stone", name: "Whole-Home & Commercial Stone Programs", summary: "Our signature large-scale program for estates and commercial builds.", price: "$100,000+", priceQualifier: "by tender", priceDisplay: "$100,000+ · by tender", altPrice: "By application", action: "booking", paymentLink: "", bookingLink: "", cta: "Request a Tender", description: "Our flagship engagement for whole-home estates, custom builds, and commercial projects: complete stone and tile scope across the entire build, managed from templating to final walkthrough on a construction schedule.", features: ["Whole-home or full-building stone scope", "Natural stone cladding and feature walls", "Live-site and construction-schedule capable", "Dedicated project lead and warranty"] }
  ],
  enterprise: {
    eyebrow: "Signature",
    headline: "Whole-Home & Commercial Stone Programs.",
    body:
      "For custom estates, luxury builds, and commercial projects that need all of their stone and tile handled by one accountable master crew — from templating and fabrication to installation and final walkthrough, delivered on a construction schedule across the GTA, Southern Ontario, and Muskoka.",
    cta: "Request a Tender",
    packageId: "whole-home-commercial-stone"
  },
  checkout: {
    eyebrow: "Get Started",
    headline: "Book your free on-site quote.",
    body:
      "Tell us about your project and the space you want us to look at. Include the rooms involved, whether it's countertops, tile, backsplash, or a full renovation, your rough timeline, your city, and any photos or plans — Daniel will follow up to schedule an on-site consultation and measure.",
    submitCta: "Request My On-Site Quote",
    disclaimer: "Every project is priced after an on-site measure. No payment is taken online."
  },
  fundingPromo: { enabled: false },
  faq: {
    eyebrow: "Questions",
    headline: "What high-budget clients ask us first.",
    items: [
      { question: "How much does tile installation cost per square foot?", answer: "As a general rule, our installed tile work runs about $30–$40 per square foot depending on the tile, the layout, and the substrate. Natural stone, large-format, and intricate patterns like herringbone sit at the higher end. A single-room floor or wall project typically starts at $2,500, and we confirm the exact number after an on-site measure." },
      { question: "How much do granite and quartz countertops cost?", answer: "Countertops are priced by the slab and edge, generally $85–$180 per square foot installed for granite and quartz in the GTA, with exotic and book-matched stone higher. That includes laser templating, fabrication, cutouts, and installation. A typical kitchen starts around $3,900." },
      { question: "What does a whole-home or gut renovation run?", answer: "Full renovations with demolition start around $35,000, and whole-home or estate stone programs frequently run $100,000 and up depending on square footage, material selection, and scope. We quote these by tender after reviewing plans and visiting the site." },
      { question: "Do you handle demolition and prep, or just the tile?", answer: "We self-perform the entire scope: demolition, haul-away, substrate and subfloor prep, waterproofing, tile, and countertop fabrication and install — all with one accountable crew, so there's no finger-pointing between trades." },
      { question: "What areas do you serve?", answer: "We're based in the Greater Toronto Area and serve all of Southern Ontario — Toronto, Mississauga, Vaughan, Markham, Oakville, Burlington, Hamilton, and beyond — with a strong track record of high-ticket projects in Muskoka, including Port Carling, Bracebridge, and Huntsville." },
      { question: "Do you do commercial projects?", answer: "Yes. We deliver commercial tile and natural-stone installations — lobbies, retail, restaurants, and offices — and we're comfortable working on live-building and construction schedules with the right protection and phasing." },
      { question: "Do you supply the material or do I?", answer: "Either way. We can supply granite, quartz, marble, porcelain, and natural stone through our suppliers, or install material you and your designer have selected. We'll guide you to the right slab and finish for your budget and use." },
      { question: "Can you work with my designer or builder?", answer: "Absolutely — much of our work comes through designers and builders. We coordinate cleanly with other trades, and we partner with design firms like ON Home Decor who handle selections and curation while we execute the stonework." },
      { question: "How long does a project take?", answer: "A single room is often a few days; a kitchen with countertops and backsplash runs one to two weeks including templating and fabrication lead time; full renovations and whole-home programs are scheduled by phase. We give you a realistic timeline in your written quote." }
    ]
  },
  finalCta: {
    eyebrow: "Ready",
    headline: "Bring us your most demanding stone and tile project.",
    body: "A decade of referral-built craftsmanship from Daniel Dziura and his crew, one accountable team, and workmanship built to last generations. Book a free on-site quote today.",
    cta: "Book Your Free On-Site Quote"
  },
  mobileCta: { primary: "Free On-Site Quote", secondary: "Our Work" },
  contact: {
    leadName: "Daniel Dziura",
    email: "info@polishstone.ca",
    phone: "(437) 555-0140",
    location: "Greater Toronto Area · Southern Ontario · Muskoka"
  },
  routing: {
    leadWebhookUrl: "",
    replyToEmail: "info@polishstone.ca",
    phoneNumber: "(437) 555-0140",
    phoneNotes: "Stone, tile, granite, and renovation project inquiries.",
    senderDomain: "polishstone.ca"
  },
  telephony: { enabled: false },
  contractorSettings: {
    serviceAreas: [
      "Toronto", "North York", "Scarborough", "Etobicoke", "Mississauga", "Vaughan",
      "Markham", "Richmond Hill", "Oakville", "Burlington", "Hamilton", "Milton",
      "Brampton", "Aurora", "Newmarket", "King City", "Caledon", "Barrie", "Orillia",
      "Gravenhurst", "Bracebridge", "Huntsville", "Port Carling", "Muskoka Lakes",
      "Collingwood", "Niagara"
    ],
    defaultCapacityNotes: "Track site consultations, active installs, fabrication lead times, and trade/designer coordination here."
  },
  teamId: "team_default"
});

export default polishStoneTenant;
