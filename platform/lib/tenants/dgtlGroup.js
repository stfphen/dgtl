import { normalizeTenantConfig } from "../defaultTenant.js";

// DGTL Group — the agency's own brand page (template: "agency").
//
// A standalone tenant for the agency that operates this platform, rendered by
// components/agency/AgencyPage instead of the shared FunnelPage. Section
// content the funnel template cannot express (results wall, white-label
// roster, growth-platform rail, funding band, team tracks) lives in the
// top-level `agency` block, which rides through normalize/sanitize untouched.
// That block is seed-authored only (never public input), so components must
// defensively default when reading it.
//
// Facts policy: every metric below is verified (repo configs or public
// dgtlgroup.io snippets). No founder name is printed anywhere on the page:
// public sources and internal anchors disagree, so it stays out until the
// team confirms.
export const dgtlGroupTenant = normalizeTenantConfig({
  id: "tenant_dgtl_group",
  slug: "dgtl-group",
  status: "active",
  template: "agency",
  domains: ["dgtlgroup.io", "www.dgtlgroup.io"],
  defaultPackageId: "pro-content-day",
  brand: {
    name: "DGTL Group",
    eyebrow: "Growth + Creative Agency",
    logoText: "DGTL",
    tagline: "Growth and creative, built in Toronto.",
    logo: "/assets/brand/dgtl-logo.svg",
    primaryColor: "#F0CF50",
    accentColor: "#0a0a0b"
  },
  // The agency page is typographic; no inherited Content Day hero media.
  media: {
    heroImage: "",
    heroAlt: "",
    heroVideo: { url: "", kind: "", videoId: "", playlistId: "" }
  },
  hero: {
    headline: "Toronto's results-driven growth and creative agency.",
    subheadline:
      "Full-service digital marketing and high-impact content production, run as one system from DGTL Studio in downtown Toronto.",
    primaryCta: "Start a project",
    secondaryCta: "See the work",
    stats: [
      { value: "75+", label: "campaigns since 2022" },
      { value: "$1M+", label: "direct client revenue" },
      { value: "250M+", label: "creator network reach" }
    ]
  },
  packageSection: {
    eyebrow: "",
    headline: "The offer ladder.",
    body:
      "Productized content systems with prices up front. Campaign Scope covers the higher-ticket end: productions, activations, placements, and partner-led media."
  },
  // The canonical Content Day ladder (ids and prices match lib/defaultTenant.js
  // so lead tagging stays consistent across tenants). This page is inquiry-led:
  // package cards route into the Start-a-project form, never straight to Stripe.
  packages: [
    {
      id: "ugc-content",
      name: "UGC Content",
      summary: "Fast, native-feeling content volume for brands that publish daily.",
      price: "$1,500",
      priceQualifier: "/ month",
      priceDisplay: "$1,500/month",
      altPrice: "$500 weekly option",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Start a project",
      description:
        "12-20 native-feeling short-form videos a month for brands that need fast content volume.",
      features: [
        "12-20 short-form videos",
        "iPhone or creator-style footage",
        "Fast turnaround",
        "Platform-ready formatting"
      ]
    },
    {
      id: "pro-content-day",
      name: "Pro Content Day",
      summary: "The flagship: a full month of content filmed in one day.",
      price: "$2,500",
      priceQualifier: "one time",
      priceDisplay: "$2,500",
      altPrice: "Most businesses start here",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Start a project",
      featured: true,
      description:
        "20+ videos from one structured shoot day, including strategy, hooks, scripting, production, and edits.",
      features: [
        "20+ short-form videos",
        "Strategy, hooks, and scripting",
        "Professional camera production",
        "Direction on shoot day"
      ]
    },
    {
      id: "growth-retainer",
      name: "Growth Retainer",
      summary: "Ongoing content infrastructure for teams that want consistency.",
      price: "$3,500+",
      priceQualifier: "/ month",
      priceDisplay: "$3,500-$5,000/month",
      altPrice: "Custom monthly scope",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Start a project",
      description:
        "Monthly shoot days, ongoing strategy, and a scalable content system for consistent publishing.",
      features: [
        "30-60 videos monthly",
        "Ongoing strategy",
        "Monthly shoot days",
        "Scalable content system"
      ]
    },
    {
      id: "campaign-scope",
      name: "Campaign Scope",
      summary: "Higher-ticket productions, activations, placements, and partner-led media.",
      price: "Custom",
      priceQualifier: "",
      priceDisplay: "Custom",
      altPrice: "Qualified project scope",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Start a project",
      description:
        "Campaign production, activations, influencer collaborations, placements, software-backed campaigns, and partner services.",
      features: [
        "Production strategy",
        "Creator and influencer options",
        "Interactive campaign options",
        "Partner service routing"
      ]
    }
  ],
  checkout: {
    eyebrow: "",
    headline: "Start a project.",
    body: "Tell us what you are trying to grow. We reply with a scope, a timeline, and a price.",
    submitCta: "Start a project",
    disclaimer: "Inquiry-led: no payment is processed on this page."
  },
  // The agency block renders its own funding band; the generic promo stays off.
  fundingPromo: { enabled: false },
  faq: {
    eyebrow: "",
    headline: "Questions, answered.",
    items: [
      {
        question: "How do engagements start?",
        answer:
          "Most clients start with a productized package (Pro Content Day at $2,500 is the flagship) or a scoped campaign. Retainers come after we have shipped together and know the monthly cadence."
      },
      {
        question: "How fast is a Content Day?",
        answer:
          "One structured shoot day produces 20+ ready-to-post videos, enough for roughly 30 days of publishing. Larger campaigns get a timeline in the proposal before anything is booked."
      },
      {
        question: "How does pricing work?",
        answer:
          "The entry ladder has public prices: UGC Content at $1,500/month, Pro Content Day at $2,500, Growth Retainer from $3,500/month. Campaign Scope is quoted after qualification. No surprise line items."
      },
      {
        question: "Can government funding cover this?",
        answer:
          "Sometimes. Our Funded Growth Studio screens plans across 8 Canadian funding lanes, starting with a free Funding Fit Scan. The scan does not guarantee program eligibility or funding approval; those depend on the specific program, timing, and business evidence."
      },
      {
        question: "What does white-label mean here?",
        answer:
          "We build and quietly operate the whole funnel: the page, the outreach, the lead filtering, the sales ops, and the production. Your brand stays front-facing; DGTL runs the machine behind it."
      },
      {
        question: "Where do you work?",
        answer:
          "Shoot days run out of DGTL Studio in downtown Toronto and on location across the GTA, Kitchener, Barrie, Newmarket, and Bradford. Campaigns and platform work run wherever the client is."
      }
    ]
  },
  contractorSettings: {
    serviceAreas: ["Toronto", "GTA", "Kitchener", "Barrie", "Newmarket", "Bradford"],
    defaultCapacityNotes:
      "Track shoot-day crews, campaign assignments, white-label operations, and funding-desk work here."
  },

  // ---------------------------------------------------------------------------
  // Agency-template content. Read with defensive defaults in components
  // (tenant.agency?.x) — this block is not walked by tenant sanitization.
  // ---------------------------------------------------------------------------
  agency: {
    // Selected work: verified names and verified numbers only. Imagery is a
    // deliberate gap until the team supplies real stills (see Known Issues).
    results: {
      headline: "Selected work and results.",
      body: "Real campaigns, real numbers. Everything below is client work since 2022.",
      caseStudies: [
        {
          name: "Guild's Garage",
          blurb: "Automotive content brand grown on organic short-form.",
          stats: [
            { value: "150K+", label: "organic followers" },
            { value: "22M+", label: "impressions" },
            { value: "<6", label: "months to get there" }
          ]
        },
        {
          name: "DMTV",
          blurb: "Music media network built and operated on the DGTL platform.",
          stats: [
            { value: "3M+", label: "series views" },
            { value: "10K", label: "avg / video" },
            { value: "110K", label: "monthly reach" }
          ]
        }
      ],
      artists: ["Swae Lee", "Lil Tjay", "A Boogie Wit Da Hoodie", "Lil Tecca", "Central Cee", "Killy"],
      brands: ["Epidemic Sound", "DJI", "PolarPro", "Canon"],
      alsoNamed: "Also on the books: The 400 Market, and the Pacific High Dewata content campaign in Bali."
    },
    funnels: {
      eyebrow: "White-Label",
      headline: "Brand funnels we run.",
      body:
        "DGTL builds and quietly operates entire brand funnels: the page, the outreach, the lead filtering, the sales ops, and the production. The client's brand stays front-facing. These three are live right now.",
      roster: [
        {
          name: "DMTV",
          blurb: "Music media: features, live shows, and brand campaigns from inside the culture.",
          proof: "3M+ series views, 110K monthly reach",
          entryOffer: "Features from $300",
          href: "/t/dmtv-studio"
        },
        {
          name: "ELiXR Gallery",
          blurb: "High-ticket original art, sold through a curated funnel.",
          proof: "Original works, private placements",
          entryOffer: "$2,500 to $10,000+ ladder",
          href: "/t/elixr"
        },
        {
          name: "ON Home Decor",
          blurb: "Home transformations laddered from a curated entry offer.",
          proof: "$200 entry to $50K projects",
          entryOffer: "$200 curated-paint entry",
          href: "/t/on-home-decor"
        }
      ],
      form: {
        headline: "Want your brand run like this?",
        body: "Tell us about the brand. We map the funnel, the offer ladder, and the ops behind it.",
        submitCta: "Ask about white-label"
      }
    },
    platform: {
      headline: "The Growth Platform.",
      body:
        "Every engagement runs on the operating system we built for ourselves: one pipeline from first prospect to funded project.",
      steps: [
        { title: "Lead pipeline", body: "Every prospect tracked from first touch to close." },
        { title: "Prospecting + batch builder", body: "Target lists built and qualified in batches." },
        { title: "Enrichment + AI research", body: "Deep research on every account before anyone reaches out." },
        { title: "Human-approved outreach", body: "AI drafts, people approve. Nothing sends itself." },
        { title: "Telephony + transcription", body: "Calls recorded, transcribed, and summarized automatically." },
        { title: "Checkout + funding engine", body: "Stripe checkout and funding-readiness screening in the same flow." }
      ],
      footnote: "Built on Next.js and Postgres, with Claude AI throughout."
    },
    funding: {
      headline: "Could funding help pay for your next growth project?",
      body:
        "The Funded Growth Studio screens your plans across 8 Canadian funding lanes, starting with a free Funding Fit Scan.",
      linkLabel: "Visit the Funded Growth Studio",
      href: "/t/funded-growth",
      form: { submitCta: "Check your funding fit" },
      disclaimer:
        "The scan does not guarantee program eligibility or funding approval. Eligibility and approval depend on the specific program, timing, and business evidence."
    },
    about: {
      headline: "Built in Toronto. Working worldwide.",
      paragraphs: [
        "DGTL Group is a results-driven growth and creative agency. The production hub is DGTL Studio in downtown Toronto; the company works from Toronto, Paris, and Bali.",
        "Since 2022 the team has executed 75+ campaigns and projects across multiple markets, generating over $1M in direct client revenue and multi-9-figure organic impressions. The creator and influencer network behind that work reaches over 250M unique accounts."
      ],
      offices: ["Toronto", "Paris", "Bali"],
      since: "2022"
    },
    startProject: {
      headline: "Start a project.",
      body: "Tell us what you are trying to grow. We reply with a scope, a timeline, and a price.",
      submitCta: "Start a project"
    },
    join: {
      eyebrow: "Careers",
      headline: "Join DGTL.",
      body: "The team is built from people who ship. Pick your lane.",
      tracks: [
        {
          id: "production",
          label: "Production",
          blurb: "Shooters, editors, directors, and producers for client and studio work."
        },
        {
          id: "strategy",
          label: "Strategy",
          blurb: "Growth strategists, media planners, and account leads who own outcomes."
        },
        {
          id: "sales",
          label: "Sales",
          blurb: "Partnership and client development. Commission-forward, pipeline-backed."
        }
      ],
      form: { headline: "Apply for a role.", submitCta: "Apply to DGTL" }
    },
    footer: {
      blurb: "Growth and creative. Toronto, Paris, Bali.",
      links: [
        { label: "dgtlgroup.io", url: "https://dgtlgroup.io" },
        { label: "Instagram", url: "https://www.instagram.com/dgtlgroup.io/" },
        { label: "LinkedIn", url: "https://www.linkedin.com/company/dgtlgroup" },
        { label: "dgtl.bio", url: "https://dgtl.bio" }
      ]
    }
  }
});
