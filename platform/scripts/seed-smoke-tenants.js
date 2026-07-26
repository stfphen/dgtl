/**
 * Seed the template-library smoke matrix: funnel and authority archetypes
 * across all 5 design directions, each direction exercised with 2 vertical
 * fixtures, plus 2 showcase tenants proving direction tokens never leak into
 * the showcase's isolated theme. 22 tenants total, slugs prefixed smoke-.
 *
 * Content is demo/sample data for internal smoke rendering only (stats and
 * names are illustrative). Images are picsum placeholder photography with
 * descriptive seeds; real packs come from docs/design-research/asset-prompts.md.
 *
 * Run against a scratch store, never prod:
 *   APP_STORE_PATH=/tmp/smoke-store.json DATABASE_URL= node scripts/seed-smoke-tenants.js
 * Idempotent (upsert by deterministic tenant id).
 */

const pic = (seed, w, h) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

function buildVerticalFixtures(defaultTenant) {
  return {
    "agency-creative": {
      brand: {
        ...defaultTenant.brand,
        name: "Halftone Studio",
        eyebrow: "Brand and campaign studio",
        logoText: "Halftone",
        tagline: "Campaigns people remember",
        primaryColor: "#0f4c81",
        accentColor: "#101014"
      },
      hero: {
        headline: "Work that wins the room",
        subheadline: "Brand systems, campaign film, and launch content for teams that compete on craft.",
        primaryCta: "Start a project",
        secondaryCta: "See packages",
        stats: [
          { value: "126", label: "campaigns shipped" },
          { value: "9 yrs", label: "running the studio" },
          { value: "31", label: "retained brands" }
        ]
      },
      problem: {
        eyebrow: "The gap",
        headline: "Pretty work that sells nothing is expensive",
        points: [
          "Your last campaign looked fine and moved nothing. The deck was strong, the numbers were not.",
          "In-house teams ship on time but drift off brand. Freelancers nail one asset and vanish.",
          "Buyers remember one campaign per quarter. If it is not yours, the budget worked for a competitor."
        ]
      },
      system: {
        eyebrow: "The system",
        headline: "One studio, the whole campaign",
        body: "Strategy, identity, film, and rollout handled by one senior team with one creative direction.",
        features: [
          { title: "Brand systems", body: "Identity, voice, and usage rules built to survive real marketing calendars." },
          { title: "Campaign film", body: "Concept to color grade in four weeks, cut for every placement you buy." },
          { title: "Launch content", body: "The full asset stack: social cuts, landing pages, sales collateral, out-of-home." }
        ]
      },
      process: {
        eyebrow: "Process",
        headline: "Four weeks from brief to launch",
        steps: [
          { title: "Read", body: "We audit the brand, the market, and the last three campaigns before proposing anything." },
          { title: "Concept", body: "Two directions, presented as finished frames. You pick one, we kill the other." },
          { title: "Make", body: "Production weeks with a standing Thursday review. No surprise reveals." },
          { title: "Launch", body: "Assets delivered per channel with a rollout calendar your team can run." }
        ]
      },
      output: {
        eyebrow: "Output",
        headline: "What lands in your drive",
        body: "Every engagement ends with a complete, organized asset library and the source files.",
        tiles: ["Campaign film", "Identity kit", "Social cuts", "Launch page", "Sales deck", "OOH masters"]
      },
      portfolio: {
        eyebrow: "Selected work",
        headline: "Recent campaigns",
        body: "",
        items: [
          {
            id: "smoke-agency-1",
            title: "Northbeam relaunch",
            caption: "Full rebrand and launch film for a logistics platform.",
            client: "Northbeam",
            result: "Pipeline up 42% in one quarter",
            mediaType: "image",
            src: pic("agency-campaign-film-set", 1600, 1200),
            alt: "Campaign film production set"
          },
          {
            id: "smoke-agency-2",
            title: "Field & Salt",
            caption: "Identity system and packaging for a coastal food brand.",
            client: "Field & Salt",
            result: "Retail placement in 90 stores",
            mediaType: "image",
            src: pic("agency-packaging-identity", 1600, 1200),
            alt: "Packaging identity spread"
          },
          {
            id: "smoke-agency-3",
            title: "Crosstown FC",
            caption: "Season campaign for a city football club.",
            client: "Crosstown FC",
            result: "Season tickets sold out",
            mediaType: "image",
            src: pic("agency-stadium-campaign", 1600, 1200),
            alt: "Stadium campaign billboard"
          }
        ]
      },
      references: {
        eyebrow: "References",
        headline: "What clients say after launch",
        testimonials: [
          {
            quote: "They are the only agency that argued with our brief and was right.",
            name: "Mara Ellison",
            role: "VP Marketing",
            company: "Northbeam"
          },
          {
            quote: "The campaign paid for itself before the second flight ran.",
            name: "Devon Okafor",
            role: "Founder",
            company: "Field & Salt"
          },
          {
            quote: "Every asset was ready the day they said it would be.",
            name: "Priya Nathan",
            role: "Commercial Director",
            company: "Crosstown FC"
          }
        ],
        logos: [
          { src: pic("logo-northbeam-mark", 320, 120), alt: "Northbeam", name: "Northbeam" },
          { src: pic("logo-fieldsalt-mark", 320, 120), alt: "Field & Salt", name: "Field & Salt" },
          { src: pic("logo-crosstown-mark", 320, 120), alt: "Crosstown FC", name: "Crosstown FC" },
          { src: pic("logo-arcline-mark", 320, 120), alt: "Arcline", name: "Arcline" }
        ]
      },
      packageSection: {
        eyebrow: "Engagements",
        headline: "Three ways to work with us",
        body: "Priced by engagement shape, not deliverable count."
      },
      packages: [
        {
          id: "smoke-agency-sprint",
          name: "Campaign Sprint",
          summary: "One campaign, concept to launch, in four weeks.",
          price: "$18,000",
          priceQualifier: "fixed",
          priceDisplay: "$18,000",
          action: "capture",
          cta: "Book the sprint",
          featured: false,
          description: "A single campaign shipped end to end.",
          features: ["One campaign concept", "Film plus full asset stack", "Four-week timeline", "Rollout calendar"]
        },
        {
          id: "smoke-agency-retainer",
          name: "Studio Retainer",
          summary: "Your brand team, three campaigns per year.",
          price: "$9,500",
          priceQualifier: "per month",
          priceDisplay: "$9,500/mo",
          action: "capture",
          cta: "Talk retainers",
          featured: true,
          description: "Ongoing creative direction and production.",
          features: ["Three campaigns per year", "Standing creative direction", "Priority production weeks", "Quarterly brand review"]
        },
        {
          id: "smoke-agency-identity",
          name: "Identity Build",
          summary: "The brand system, built once and built right.",
          price: "$24,000",
          priceQualifier: "fixed",
          priceDisplay: "$24,000",
          action: "capture",
          cta: "Scope the build",
          featured: false,
          description: "Identity, voice, and usage system.",
          features: ["Identity and wordmark", "Voice and messaging rules", "Usage system and templates", "Handoff workshop"]
        }
      ],
      enterprise: {
        eyebrow: "Larger scope",
        headline: "Multi-brand or multi-market?",
        body: "We run portfolio engagements for holding companies and franchise groups.",
        cta: "Scope it with us",
        packageId: "smoke-agency-retainer"
      },
      faq: {
        eyebrow: "Questions",
        headline: "Before you ask",
        items: [
          { question: "How many revision rounds?", answer: "Two structured rounds per deliverable. Unlimited nitpicks inside a round." },
          { question: "Who owns the files?", answer: "You do, including source files, the day the invoice clears." },
          { question: "What happens after handoff?", answer: "Thirty days of launch support, then an optional retainer if you want us to stay." },
          { question: "Do you work with in-house teams?", answer: "Constantly. We set direction, your team keeps shipping inside it." }
        ]
      },
      checkout: {
        ...defaultTenant.checkout,
        eyebrow: "Start",
        headline: "Tell us what you are launching",
        body: "Two sentences is enough. We reply within one business day with a straight answer on fit and timing.",
        submitCta: "Start the conversation",
        urlLabel: "Website or Instagram",
        notesLabel: "What are you launching?"
      },
      finalCta: {
        eyebrow: "",
        headline: "The next memorable campaign in your category is unclaimed",
        body: "Bring us the brief while it still is.",
        cta: "Start a project"
      },
      mobileCta: { primary: "Start a project", secondary: "See packages" },
      defaultPackageId: "smoke-agency-retainer",
      verticalPreset: "agency-creative"
    },

    "professional-services-b2b": {
      brand: {
        ...defaultTenant.brand,
        name: "Meridian Advisory",
        eyebrow: "Funding and finance advisory",
        logoText: "Meridian",
        tagline: "Advisory measured in outcomes",
        primaryColor: "#1c5d43",
        accentColor: "#101210"
      },
      hero: {
        headline: "Funding that lands",
        subheadline: "Grant, credit, and incentive advisory for operating companies. $46M secured for clients since 2019.",
        primaryCta: "Book a consultation",
        secondaryCta: "See engagements",
        stats: [
          { value: "$46M", label: "secured for clients" },
          { value: "87%", label: "application win rate" },
          { value: "140+", label: "engagements completed" }
        ]
      },
      problem: {
        eyebrow: "The risk",
        headline: "Missed programs are money left on the table",
        points: [
          "Most operators find out about a funding window after it closes. The programs do not advertise.",
          "Applications written by generalists win at half the rate. Reviewers can tell.",
          "A rejected application burns the round. You rarely get a second read in the same cycle."
        ]
      },
      system: {
        eyebrow: "The practice",
        headline: "A funding pipeline, not a one-off application",
        body: "We map every program your company qualifies for, then run the applications on a calendar.",
        features: [
          { title: "Program mapping", body: "A ranked map of grants, credits, and incentives your profile actually qualifies for." },
          { title: "Application drafting", body: "Written by advisors who have sat on review panels, with your numbers verified." },
          { title: "Compliance and claims", body: "Reporting, claims, and audit files handled so funds arrive and stay yours." }
        ]
      },
      process: {
        eyebrow: "Engagement",
        headline: "How an engagement runs",
        steps: [
          { title: "Eligibility review", body: "A 45-minute working session on your financials and roadmap. Go or no-go, stated plainly." },
          { title: "Program map", body: "Within two weeks: every program worth your time, ranked by value and win probability." },
          { title: "Applications", body: "We draft, you verify, we file. You see every document before it moves." },
          { title: "Claims and reporting", body: "We run the compliance calendar until the last dollar lands." }
        ]
      },
      output: {
        eyebrow: "Outcomes",
        headline: "What clients received last cycle",
        body: "Figures below are aggregate client outcomes across the most recent program year.",
        tiles: ["$4.2M hiring grant", "$860K R&D credit", "$1.5M export program", "$390K training fund", "$2.1M equipment incentive", "$275K digital adoption"]
      },
      portfolio: {
        eyebrow: "Case files",
        headline: "Recent engagements",
        body: "",
        items: [
          {
            id: "smoke-b2b-1",
            title: "Precision manufacturer, 85 staff",
            caption: "Stacked a hiring grant with an equipment incentive across two fiscal years.",
            client: "Manufacturing",
            result: "$3.1M combined",
            mediaType: "image",
            src: pic("advisory-factory-floor-review", 1600, 1200),
            alt: "Advisors reviewing plans on a factory floor"
          },
          {
            id: "smoke-b2b-2",
            title: "Software firm, series A",
            caption: "R&D credit recovery going back three filing years.",
            client: "Technology",
            result: "$860K recovered",
            mediaType: "image",
            src: pic("advisory-office-documents", 1600, 1200),
            alt: "Financial documents on a desk"
          }
        ]
      },
      references: {
        eyebrow: "References",
        headline: "Trusted by operating companies",
        testimonials: [
          {
            quote: "They found two programs our accountants had never heard of.",
            name: "Ruth Kalejaiye",
            role: "CFO",
            company: "Vantage Components"
          },
          {
            quote: "The program map alone was worth the fee. The $1.5M was the bonus.",
            name: "Marc Deschamps",
            role: "CEO",
            company: "Ferrolux Exports"
          },
          {
            quote: "First advisory firm that told us no on a program we wanted. Right call.",
            name: "Anneli Voss",
            role: "COO",
            company: "Corvid Analytics"
          }
        ],
        logos: [
          { src: pic("logo-vantage-mark", 320, 120), alt: "Vantage Components", name: "Vantage" },
          { src: pic("logo-ferrolux-mark", 320, 120), alt: "Ferrolux", name: "Ferrolux" },
          { src: pic("logo-corvid-mark", 320, 120), alt: "Corvid Analytics", name: "Corvid" },
          { src: pic("logo-halden-mark", 320, 120), alt: "Halden Group", name: "Halden" },
          { src: pic("logo-atrium-mark", 320, 120), alt: "Atrium Legal", name: "Atrium" },
          { src: pic("logo-novafield-mark", 320, 120), alt: "Novafield", name: "Novafield" }
        ]
      },
      packageSection: {
        eyebrow: "Engagements",
        headline: "Engagement options",
        body: "Scoped by outcome. Success fees apply only to funds that land."
      },
      packages: [
        {
          id: "smoke-b2b-map",
          name: "Program Map",
          summary: "Know every program you qualify for.",
          price: "$4,500",
          priceQualifier: "fixed",
          priceDisplay: "$4,500",
          action: "capture",
          cta: "Book the review",
          featured: false,
          description: "Ranked funding map with win probabilities.",
          features: ["Eligibility review", "Ranked program map", "Two-week turnaround", "Go/no-go on each program"]
        },
        {
          id: "smoke-b2b-pipeline",
          name: "Funding Pipeline",
          summary: "We run your applications for a full year.",
          price: "$3,800",
          priceQualifier: "per month",
          priceDisplay: "$3,800/mo",
          action: "capture",
          cta: "Book a consultation",
          featured: true,
          description: "Full-year application and claims management.",
          features: ["Everything in Program Map", "All applications drafted and filed", "Claims and compliance calendar", "Quarterly outcome review"]
        },
        {
          id: "smoke-b2b-recovery",
          name: "Credit Recovery",
          summary: "Recover credits from past filing years.",
          price: "Success fee",
          priceQualifier: "of recovered funds",
          priceDisplay: "Success fee",
          action: "capture",
          cta: "Check eligibility",
          featured: false,
          description: "Retroactive credit recovery engagement.",
          features: ["Three-year lookback", "No recovery, no fee", "Audit-ready claim files", "Filed within one quarter"]
        }
      ],
      enterprise: {
        eyebrow: "Portfolio scope",
        headline: "PE-backed or multi-entity?",
        body: "We run funding programs across portfolios with consolidated reporting.",
        cta: "Talk to our team",
        packageId: "smoke-b2b-pipeline"
      },
      faq: {
        eyebrow: "Diligence",
        headline: "The questions buyers ask us",
        items: [
          { question: "What are your qualifications?", answer: "CPAs and former program reviewers. Credentials are listed in every proposal, engagement letters name your advisors." },
          { question: "How is confidentiality handled?", answer: "Mutual NDA before any document moves. Financials live in your data room, not our inbox." },
          { question: "What happens in the first 30 days?", answer: "Eligibility review, program map, and the first application drafted if a window is open." },
          { question: "What do engagements cost overall?", answer: "Fixed fees are quoted before we start. Success fees apply only to funds received." }
        ]
      },
      checkout: {
        ...defaultTenant.checkout,
        eyebrow: "Consultation",
        headline: "Book the eligibility review",
        body: "A 45-minute working session with a senior advisor. You leave with a straight answer on what your company can access.",
        submitCta: "Book a consultation",
        urlLabel: "Company website",
        notesLabel: "What are you trying to fund?"
      },
      finalCta: {
        eyebrow: "",
        headline: "This quarter's funding windows are already open",
        body: "The review takes 45 minutes. The programs take applications until they do not.",
        cta: "Book a consultation"
      },
      mobileCta: { primary: "Book consultation", secondary: "Engagements" },
      defaultPackageId: "smoke-b2b-pipeline",
      verticalPreset: "professional-services-b2b"
    },

    "saas-tech-ecommerce": {
      brand: {
        ...defaultTenant.brand,
        name: "Freightline",
        eyebrow: "Dispatch software for freight brokers",
        logoText: "Freightline",
        tagline: "Dispatch without the spreadsheet",
        primaryColor: "#2451e6",
        accentColor: "#0a0a14"
      },
      hero: {
        headline: "Book loads in half the clicks",
        subheadline: "Freightline replaces the dispatch spreadsheet with one board for loads, carriers, and margins.",
        primaryCta: "Start free",
        secondaryCta: "See pricing",
        stats: [
          { value: "3,400+", label: "brokerages on the board" },
          { value: "11 hrs", label: "saved per dispatcher weekly" },
          { value: "99.95%", label: "uptime last 12 months" }
        ]
      },
      problem: {
        eyebrow: "The spreadsheet",
        headline: "Your dispatch board is a liability",
        points: [
          "Loads live in a spreadsheet, carrier docs in email, margins in someone's head.",
          "Every double-booked truck and missed insurance lapse traces back to a tab nobody refreshed.",
          "Your best dispatcher spends two hours a day copying numbers between windows."
        ]
      },
      system: {
        eyebrow: "The product",
        headline: "One board for the whole brokerage",
        body: "Loads, carriers, compliance, and margin in one screen your team already understands.",
        features: [
          { title: "Live load board", body: "Every load, status, and assignment updates in real time for the whole floor." },
          { title: "Carrier compliance", body: "Insurance and authority checks run automatically before a truck is booked." },
          { title: "Margin tracking", body: "Buy, sell, and margin per load, rolled up by lane, customer, and dispatcher." }
        ]
      },
      process: {
        eyebrow: "Rollout",
        headline: "Live in a week",
        steps: [
          { title: "Import", body: "Bring your current spreadsheet. The importer maps columns automatically." },
          { title: "Connect", body: "Link your load boards and factoring account with two-click integrations." },
          { title: "Dispatch", body: "Run the floor from one board. Most teams stop opening the spreadsheet by day three." }
        ]
      },
      output: {
        eyebrow: "In the product",
        headline: "What the board replaces",
        body: "Everything below ships in the core product, no add-on pricing.",
        tiles: ["Load board", "Carrier vault", "Rate confirmations", "Margin reports", "Driver app", "QuickBooks sync"]
      },
      portfolio: {
        eyebrow: "In production",
        headline: "The board at work",
        body: "",
        items: [
          {
            id: "smoke-saas-1",
            title: "Dispatch view",
            caption: "The live board a 14-dispatcher floor runs on.",
            client: "Product",
            result: "",
            mediaType: "image",
            src: pic("saas-dispatch-dashboard-ui", 1600, 1000),
            alt: "Dispatch dashboard interface"
          },
          {
            id: "smoke-saas-2",
            title: "Margin rollup",
            caption: "Lane-level margin, updated per booking.",
            client: "Product",
            result: "",
            mediaType: "image",
            src: pic("saas-margin-report-ui", 1600, 1000),
            alt: "Margin reporting interface"
          }
        ]
      },
      references: {
        eyebrow: "Proof",
        headline: "Brokerages run on Freightline",
        testimonials: [
          {
            quote: "We onboarded on a Monday and killed the spreadsheet that Friday.",
            name: "Colton Reyes",
            role: "Operations Manager",
            company: "Bluegate Logistics"
          },
          {
            quote: "The compliance checks alone caught two lapsed carriers in week one.",
            name: "Hana Sorensen",
            role: "Owner",
            company: "Sorensen Freight"
          }
        ],
        logos: [
          { src: pic("logo-bluegate-mark", 320, 120), alt: "Bluegate Logistics", name: "Bluegate" },
          { src: pic("logo-sorensen-mark", 320, 120), alt: "Sorensen Freight", name: "Sorensen" },
          { src: pic("logo-lanepoint-mark", 320, 120), alt: "Lanepoint", name: "Lanepoint" },
          { src: pic("logo-cargoworks-mark", 320, 120), alt: "Cargoworks", name: "Cargoworks" }
        ]
      },
      packageSection: {
        eyebrow: "Pricing",
        headline: "Priced per dispatcher, nothing hidden",
        body: "Every plan includes the full board. Tiers change limits, not features."
      },
      packages: [
        {
          id: "smoke-saas-solo",
          name: "Solo",
          summary: "For owner-operators booking their own loads.",
          price: "$0",
          priceQualifier: "up to 20 loads/mo",
          priceDisplay: "Free",
          action: "capture",
          cta: "Start free",
          featured: false,
          description: "Free tier for single-seat dispatch.",
          features: ["One seat", "20 loads per month", "Carrier compliance checks", "Email support"]
        },
        {
          id: "smoke-saas-team",
          name: "Team",
          summary: "For brokerage floors up to 25 dispatchers.",
          price: "$89",
          priceQualifier: "per seat, monthly",
          priceDisplay: "$89/seat",
          action: "capture",
          cta: "Start free",
          featured: true,
          description: "The standard brokerage plan.",
          features: ["Unlimited loads", "Margin and lane reports", "Load board integrations", "Priority support"]
        },
        {
          id: "smoke-saas-scale",
          name: "Scale",
          summary: "For multi-office brokerages and 3PLs.",
          price: "$74",
          priceQualifier: "per seat, annual",
          priceDisplay: "$74/seat",
          action: "capture",
          cta: "Book a demo",
          featured: false,
          description: "Volume plan with SSO and API.",
          features: ["Everything in Team", "SSO and audit log", "API access", "Dedicated onboarding"]
        }
      ],
      enterprise: {
        eyebrow: "Enterprise",
        headline: "Running more than 50 seats?",
        body: "Custom contracts, data residency, and a named engineer.",
        cta: "Book a demo",
        packageId: "smoke-saas-scale"
      },
      faq: {
        eyebrow: "Adoption",
        headline: "Before your team switches",
        items: [
          { question: "How does migration work?", answer: "Upload your spreadsheet, review the mapped columns, done. Average import takes 20 minutes." },
          { question: "Which load boards integrate?", answer: "DAT, Truckstop, and 123Loadboard today. The API covers anything else." },
          { question: "How is our data secured?", answer: "SOC 2 Type II, encrypted at rest and in transit, daily backups you can export." },
          { question: "Can we cancel anytime?", answer: "Monthly plans cancel in one click. Your data exports as CSV the same day." }
        ]
      },
      checkout: {
        ...defaultTenant.checkout,
        eyebrow: "Start",
        headline: "Put your floor on the board",
        body: "Free for 14 days on any paid tier. No card up front, import included.",
        submitCta: "Start free",
        urlLabel: "Company website",
        notesLabel: "What does your dispatch stack look like today?"
      },
      finalCta: {
        eyebrow: "",
        headline: "The spreadsheet is not getting better",
        body: "Import it and see your floor on one board this week.",
        cta: "Start free"
      },
      mobileCta: { primary: "Start free", secondary: "See pricing" },
      defaultPackageId: "smoke-saas-team",
      verticalPreset: "saas-tech-ecommerce"
    },

    "local-trades-retail": {
      brand: {
        ...defaultTenant.brand,
        name: "Harbour City Roofing",
        eyebrow: "Roofing across the North Shore",
        logoText: "Harbour City",
        tagline: "Licensed, insured, local since 2008",
        primaryColor: "#b34a1f",
        accentColor: "#141210"
      },
      hero: {
        headline: "Your roof, fixed right, this month",
        subheadline: "Repairs and full replacements across the North Shore. Free inspection with a written photo report.",
        primaryCta: "Get a free quote",
        secondaryCta: "See the offer",
        stats: [
          { value: "4.9", label: "Google rating, 312 reviews" },
          { value: "17 yrs", label: "serving the North Shore" },
          { value: "10 yr", label: "workmanship warranty" }
        ]
      },
      problem: {
        eyebrow: "The leak",
        headline: "Small roof problems become ceiling problems",
        points: [
          "A lifted shingle is a $400 fix. The same shingle after one wet winter is a $4,000 ceiling.",
          "Storm season books out every crew on the shore. The queue starts now, not when it drips.",
          "Insurance covers sudden damage, not the slow leak you knew about."
        ]
      },
      system: {
        eyebrow: "What we do",
        headline: "Repairs, replacements, and honest calls",
        body: "One local crew, no subcontracted strangers on your roof.",
        features: [
          { title: "Repairs", body: "Flashing, shingles, and leak tracing. Most repairs done in one visit." },
          { title: "Full replacement", body: "Tear-off to ridge cap in two to three days, yard spotless after." },
          { title: "Inspections", body: "A 21-point check with photos of everything we find, whether or not you hire us." }
        ]
      },
      process: {
        eyebrow: "How it goes",
        headline: "From call to dry roof",
        steps: [
          { title: "Inspect", body: "We walk the roof, photograph every issue, and hand you the report on the spot." },
          { title: "Quote", body: "A written fixed price. No allowances, no surprise extras on the invoice." },
          { title: "Work", body: "Crew arrives on the scheduled day. The site is cleaner when we leave than when we came." }
        ]
      },
      output: {
        eyebrow: "The report",
        headline: "What the free inspection covers",
        body: "Every inspection ends with a written report you keep.",
        tiles: ["Shingle condition", "Flashing and seals", "Gutter health", "Attic ventilation", "Moss and drainage", "Photo file"]
      },
      portfolio: {
        eyebrow: "Recent jobs",
        headline: "Before and after, around the shore",
        body: "",
        items: [
          {
            id: "smoke-local-1",
            title: "Cedar Grove full replacement",
            caption: "1970s duplex, torn off and re-shingled in two days.",
            client: "Cedar Grove",
            result: "Done in 2 days",
            mediaType: "image",
            src: pic("roofing-before-after-shingles", 1600, 1200),
            alt: "Roof replacement before and after"
          },
          {
            id: "smoke-local-2",
            title: "Marine Drive leak repair",
            caption: "Chimney flashing traced and resealed after two failed patches by others.",
            client: "Marine Drive",
            result: "Dry through storm season",
            mediaType: "image",
            src: pic("roofing-crew-chimney-flashing", 1600, 1200),
            alt: "Crew repairing chimney flashing"
          },
          {
            id: "smoke-local-3",
            title: "Lynn Valley cedar conversion",
            caption: "Cedar shake to architectural asphalt with new ventilation.",
            client: "Lynn Valley",
            result: "10-year warranty",
            mediaType: "image",
            src: pic("roofing-cedar-conversion-house", 1600, 1200),
            alt: "Completed cedar to asphalt conversion"
          }
        ]
      },
      references: {
        eyebrow: "Neighbours",
        headline: "What the street says",
        testimonials: [
          {
            quote: "They found the leak two other companies missed, and the price matched the quote to the dollar.",
            name: "Sandra Whitfield",
            role: "Homeowner",
            company: "Upper Lonsdale"
          },
          {
            quote: "Crew of four, done in two days, and my garden survived. Recommended them to both neighbours.",
            name: "Ken Osei",
            role: "Homeowner",
            company: "Cedar Grove"
          },
          {
            quote: "The photo report told me exactly what could wait a year. Nobody upsold anything.",
            name: "Lucia Marchetti",
            role: "Landlord",
            company: "Marine Drive"
          }
        ],
        logos: []
      },
      packageSection: {
        eyebrow: "The offer",
        headline: "Start with the free inspection",
        body: "One clear way to start. Repairs and replacements are quoted from the report."
      },
      packages: [
        {
          id: "smoke-local-inspection",
          name: "Free Roof Inspection",
          summary: "21-point check with a written photo report, yours to keep.",
          price: "$0",
          priceQualifier: "no obligation",
          priceDisplay: "Free",
          action: "capture",
          cta: "Book the inspection",
          featured: true,
          description: "The starting point for every job we do.",
          features: ["21-point roof check", "Photo report on the spot", "Written fixed quote if work is needed", "Storm-season priority list"]
        },
        {
          id: "smoke-local-tuneup",
          name: "Roof Tune-Up",
          summary: "Resecure, reseal, and clear before storm season.",
          price: "$490",
          priceQualifier: "flat rate",
          priceDisplay: "$490",
          action: "capture",
          cta: "Book a tune-up",
          featured: false,
          description: "Preventive package for roofs under 15 years.",
          features: ["Loose shingles resecured", "Flashing resealed", "Gutters cleared", "Report included"]
        }
      ],
      enterprise: {
        eyebrow: "Strata and commercial",
        headline: "Managing more than one roof?",
        body: "We hold maintenance contracts for strata councils and property managers.",
        cta: "Talk to our team",
        packageId: "smoke-local-inspection"
      },
      faq: {
        eyebrow: "Logistics",
        headline: "Quick answers",
        items: [
          { question: "What area do you cover?", answer: "North Vancouver, West Vancouver, and Deep Cove. Outside that, we will say so on the phone." },
          { question: "Are you licensed and insured?", answer: "Licensed, bonded, and carrying $5M liability. Certificates come attached to every quote." },
          { question: "How fast can you come out?", answer: "Inspections within one week, urgent leaks usually within 48 hours." },
          { question: "How do payments work?", answer: "Nothing up front for repairs. Replacements are 30% on start, balance on completion." }
        ]
      },
      checkout: {
        ...defaultTenant.checkout,
        eyebrow: "Book",
        headline: "Book your free inspection",
        body: "Tell us the address and what you have noticed. We confirm a time by the next morning.",
        submitCta: "Book the inspection",
        urlLabel: "Property address",
        notesLabel: "What have you noticed on the roof?"
      },
      finalCta: {
        eyebrow: "",
        headline: "Storm season does not wait for quotes",
        body: "The inspection is free and the report is yours either way.",
        cta: "Get a free quote"
      },
      mobileCta: { primary: "Get a free quote", secondary: "See the offer" },
      defaultPackageId: "smoke-local-inspection",
      verticalPreset: "local-trades-retail"
    }
  };
}

// direction → [primary vertical, secondary vertical]: primary follows the
// preset's own directionAffinity, secondary proves the combo on a second
// register.
const DIRECTION_VERTICALS = {
  "premium-agency": ["agency-creative", "saas-tech-ecommerce"],
  "editorial-minimal": ["professional-services-b2b", "agency-creative"],
  "bold-brutalist": ["agency-creative", "local-trades-retail"],
  "warm-boutique": ["local-trades-retail", "professional-services-b2b"],
  "dark-cinematic": ["saas-tech-ecommerce", "agency-creative"]
};

// Eyebrow discipline (taste skill): max 1 eyebrow per 3 sections. Smoke pages
// keep the hero (brand), packages, and checkout eyebrows; everything else
// renders headline-only.
const sparse = (block) => ({ ...block, eyebrow: "" });

function buildTenant(defaultTenant, fixture, { slug, direction, template, verticalPreset }) {
  const { verticalPreset: fixturePreset, defaultPackageId, ...content } = fixture;
  return {
    ...defaultTenant,
    ...content,
    problem: sparse(content.problem),
    system: sparse(content.system),
    process: sparse(content.process),
    output: sparse(content.output),
    portfolio: sparse(content.portfolio),
    references: sparse(content.references),
    faq: sparse(content.faq),
    enterprise: sparse(content.enterprise),
    fundingPromo: { ...defaultTenant.fundingPromo, enabled: false },
    id: `tenant_${slug.replace(/-/g, "_")}`,
    slug,
    status: "active",
    domains: [`${slug}.example.com`],
    defaultPackageId,
    media: {
      ...defaultTenant.media,
      heroImage: pic(`${slug}-hero`, 2000, 1250),
      heroAlt: `${content.brand.name} hero`,
      heroVideo: null
    },
    design: {
      direction,
      overrides: {},
      ...(verticalPreset === null ? {} : { verticalPreset: verticalPreset ?? fixturePreset })
    },
    ...(template ? { template } : {})
  };
}

async function main() {
  if (!process.env.APP_STORE_PATH) {
    throw new Error("Refusing to run without APP_STORE_PATH — smoke tenants never go to a real store.");
  }
  delete process.env.DATABASE_URL;

  const { upsertTenantConfig } = await import("../lib/store.js");
  const { defaultTenant } = await import("../lib/defaultTenant.js");
  const { dmtvStudioTenant } = await import("../lib/tenants/dmtvStudio.js");
  const { listDesignDirections } = await import("../lib/tenantBuilder/designDirections.js");

  const fixtures = buildVerticalFixtures(defaultTenant);
  const tenants = [];

  for (const direction of listDesignDirections().map((d) => d.id)) {
    const [primary, secondary] = DIRECTION_VERTICALS[direction];
    for (const [vertical, tag] of [
      [primary, "a"],
      [secondary, "b"]
    ]) {
      const fixture = fixtures[vertical];
      tenants.push(
        buildTenant(defaultTenant, fixture, {
          slug: `smoke-f-${direction}-${tag}`,
          direction
        })
      );
      tenants.push(
        buildTenant(defaultTenant, fixture, {
          slug: `smoke-au-${direction}-${tag}`,
          direction,
          template: "authority",
          verticalPreset: null
        })
      );
    }
  }

  // Showcase isolation probes: direction tokens must not alter the showcase.
  for (const direction of ["premium-agency", "dark-cinematic"]) {
    tenants.push({
      ...dmtvStudioTenant,
      id: `tenant_smoke_sc_${direction.replace(/-/g, "_")}`,
      slug: `smoke-sc-${direction}`,
      domains: [`smoke-sc-${direction}.example.com`],
      design: { direction, overrides: {} }
    });
  }

  for (const config of tenants) {
    await upsertTenantConfig(config, { teamId: "team_default" });
    console.log(`seeded ${config.slug} (${config.template || "funnel"}, ${config.design.direction})`);
  }
  console.log(`\n${tenants.length} smoke tenants seeded.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
