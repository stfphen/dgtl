import { normalizeTenantConfig } from "../defaultTenant.js";

// DMTV — Digital Music Entertainment.
//
// A music-media checkout funnel: short-form artist features, content packages,
// music video production, sponsorships, rollout campaigns, and custom brand
// activations. Copy and product ladder are adapted from the DMTV v3 reference
// deck; production/sales infrastructure is quietly powered by DGTL while the
// customer-facing brand stays DMTV-first. Black + yellow brand palette.
export const dmtvTenant = normalizeTenantConfig({
  id: "tenant_dmtv",
  slug: "dmtv",
  status: "active",
  domains: ["dmtv.dgtlmag.com"],
  defaultPackageId: "artist-content-package",
  brand: {
    name: "DMTV",
    eyebrow: "Digital Music Entertainment",
    logoText: "DMTV",
    tagline: "Turn music culture into attention.",
    logo: "",
    primaryColor: "#f7d64a",
    accentColor: "#050505"
  },
  media: {
    heroImage: "/assets/content-day-hero.png",
    heroAlt:
      "A music studio production setup with cameras and lighting for short-form artist features."
  },
  hero: {
    headline: "Turn music culture into attention.",
    subheadline:
      "DMTV helps artists, labels, and brands buy into a music media ecosystem through short-form features, production packages, sponsorships, product placement, and custom cultural campaigns.",
    primaryCta: "Request a Custom Proposal",
    secondaryCta: "Explore the Offers",
    stats: [
      { value: "3M+", label: "series views" },
      { value: "10K", label: "avg / video" },
      { value: "110K", label: "monthly reach" }
    ]
  },
  problem: {
    eyebrow: "Who It's For",
    headline: "Music media built for discovery.",
    points: [
      "Emerging artists who need a feature and fast audience discovery.",
      "Labels and managers running single, project, and rollout launches.",
      "Sponsors and audio brands who want cultural integration, not ads.",
      "Events, fashion, lifestyle, and cultural campaign partners."
    ]
  },
  system: {
    eyebrow: "The Platform",
    headline: "Music media built for the attention economy.",
    body:
      "DMTV turns artist discovery into a structured media product — serving the low-ticket artist who needs a feature, the serious artist who needs a rollout, and the brand partner who wants cultural integration without looking like a traditional ad.",
    features: [
      {
        title: "Feature",
        body: "A Minute of Music: short-form, vertical, social-first artist features built for discovery."
      },
      {
        title: "Produce",
        body: "Artist content packages and music video production with creative direction and edits."
      },
      {
        title: "Partner",
        body: "Native sponsor integrations, product placement, and custom cultural campaigns."
      }
    ]
  },
  process: {
    eyebrow: "How It Works",
    headline: "From idea to launch.",
    steps: [
      { title: "Submit the Brief", body: "Tell us whether you are an artist, label, sponsor, agency, or brand partner." },
      { title: "Match the Offer", body: "We recommend the right feature, content package, production scope, or activation." },
      { title: "Confirm Scope", body: "Approve pricing, timeline, deliverables, platform placements, and production details." },
      { title: "Produce + Distribute", body: "DMTV launches the content and tracks the campaign for follow-up opportunities." }
    ]
  },
  output: {
    eyebrow: "Sponsorship",
    headline: "Sponsorship that feels like music content.",
    body:
      "Instead of interrupting the audience with ads, brands live inside the DMTV universe through product placement, episode sponsorship, artist integrations, and social-first campaign assets across Instagram, TikTok, and YouTube.",
    tiles: ["FEATURES", "UGC", "BTS", "PRODUCTION", "INTERVIEWS", "ROLLOUTS", "SPONSORSHIP", "PLACEMENT", "ACTIVATIONS"]
  },
  packageSection: {
    eyebrow: "Product Ladder",
    headline: "Offers for artists, labels, and brands.",
    body:
      "A simple ladder from entry-level exposure to high-ticket campaigns lets DMTV sell features, content, production, sponsorship, and custom activations from one branded funnel."
  },
  packages: [
    {
      id: "minute-of-music-feature",
      name: "A Minute of Music Feature",
      summary: "Low ticket: a short-form music feature for artists who want exposure.",
      price: "$300+",
      priceQualifier: "per feature",
      priceDisplay: "From $300+",
      altPrice: "Entry-level exposure",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Book a music feature",
      description:
        "A short-form music feature for artists who want exposure through the DMTV platform. Built for vertical video, social distribution, and fast audience discovery.",
      features: ["Short-form vertical feature", "Social-first distribution", "Fast audience discovery", "Platform-ready edit"]
    },
    {
      id: "artist-content-package",
      name: "Artist Content Package",
      summary: "Artist growth: a bundled content system for rollout-ready artists.",
      price: "$1K–$5K+",
      priceQualifier: "per package",
      priceDisplay: "$1K–$5K+",
      altPrice: "Most artists start here",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Build an artist package",
      featured: true,
      description:
        "A bundled content system for artists: performance clips, interviews, behind-the-scenes, cover assets, reels, rollout content, and platform-ready edits.",
      features: ["Performance + interview clips", "Behind-the-scenes + reels", "Cover and rollout assets", "Platform-ready edits"]
    },
    {
      id: "music-video-production",
      name: "Music Video Production",
      summary: "Production: full concept, direction, and delivery for artists or labels.",
      price: "$5K+",
      priceQualifier: "per project",
      priceDisplay: "$5K+",
      altPrice: "Polished video + cutdowns",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Start a video project",
      description:
        "Full concept, direction, production, and delivery for artists or labels that need a polished music video and supporting short-form cutdowns.",
      features: ["Concept + creative direction", "Full production crew", "Polished music video", "Short-form cutdowns"]
    },
    {
      id: "brand-product-placement",
      name: "Brand Product Placement",
      summary: "Sponsorship: native sponsor integrations inside DMTV content.",
      price: "$10K+",
      priceQualifier: "per campaign",
      priceDisplay: "$10K+",
      altPrice: "Sponsor visibility",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Discuss sponsorship",
      description:
        "Native sponsor integrations inside DMTV content, including product placement, branded captions, logo watermarking, website links, and creator-led visibility.",
      features: ["Logo watermark on episodes", "Product placement", "Branded captions + links", "Multi-platform visibility"]
    },
    {
      id: "rollout-campaign",
      name: "Label / Artist Rollout Campaign",
      summary: "Campaign: a rollout system for singles, projects, and launches.",
      price: "$15K+",
      priceQualifier: "per rollout",
      priceDisplay: "$15K+",
      altPrice: "Full rollout system",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Plan a rollout",
      description:
        "A rollout system for singles, projects, label launches, or artist development: creative direction, content production, distribution support, and audience-building assets.",
      features: ["Creative direction", "Content production", "Distribution support", "Audience-building assets"]
    },
    {
      id: "custom-brand-activation",
      name: "Custom Brand Activation",
      summary: "High ticket: a full custom cultural campaign with reporting.",
      price: "$25K+",
      priceQualifier: "custom",
      priceDisplay: "$25K+",
      altPrice: "Full cultural campaign",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Build an activation",
      description:
        "A full custom cultural campaign: branded music content, artist collaborations, event or festival tie-ins, influencer distribution, product placement, and sponsor reporting.",
      features: ["Branded music content", "Artist collaborations", "Event / festival tie-ins", "Influencer distribution + reporting"]
    }
  ],
  enterprise: {
    eyebrow: "Brand Partners",
    headline: "Sponsorship that feels like music content.",
    body:
      "Brands can live inside the DMTV universe through product placement, episode sponsorship, artist integrations, and social-first campaign assets — including custom production for launches, events, and cultural moments.",
    cta: "Build an activation",
    packageId: "custom-brand-activation"
  },
  checkout: {
    eyebrow: "Campaign Inquiry",
    headline: "Request a custom music media proposal.",
    body:
      "Share a few details and DMTV can route your inquiry to the right offer: artist feature, content package, music video, sponsorship, rollout campaign, or custom activation.",
    submitCta: "Request My Proposal",
    disclaimer:
      "Tell us whether you are an artist, manager, label, brand, agency, sponsor, or event partner and we will match the right offer."
  },
  // DMTV is a creative-services funnel, not a funding tenant.
  fundingPromo: { enabled: false },
  faq: {
    eyebrow: "Questions",
    headline: "What a sponsor can buy.",
    items: [
      {
        question: "How does brand placement work?",
        answer:
          "Logo watermark on official short-form episodes, plus product placement in intros, interviews, studio sessions, or artist content."
      },
      {
        question: "Where does my campaign show up?",
        answer:
          "Brand name, account tag, and campaign link in captions or descriptions, with visibility across Instagram, TikTok, YouTube, and supporting creator channels."
      },
      {
        question: "Can you produce a custom campaign?",
        answer: "Yes — optional custom campaign production for launches, events, and cultural moments."
      }
    ]
  },
  finalCta: {
    eyebrow: "Ready",
    headline: "Request a custom music media proposal.",
    body: "Tell us about your artist, label, or brand and DMTV will route you to the right offer.",
    cta: "Request a Custom Proposal"
  },
  mobileCta: {
    primary: "Request Proposal",
    secondary: "Offers"
  },
  contractorSettings: {
    serviceAreas: ["Toronto", "GTA", "Remote"],
    defaultCapacityNotes:
      "Track artist features, production crews, sponsor placements, and campaign assignments here."
  }
});
