import { normalizeTenantConfig } from "../defaultTenant.js";

// ELiXR Gallery — original artwork for professional spaces.
//
// A high-ticket art sales funnel: acquire original paintings, commission custom
// work, or curate a full professional space. Designed so the artist does not
// handle high-pressure sales — DGTL runs the page, outreach, lead filtering, and
// proposal process while ELiXR approves availability, pricing, and creative
// direction. Copy is adapted from the ELiXR branded demo. Gold + dark palette.
export const elixrTenant = normalizeTenantConfig({
  id: "tenant_elixr",
  slug: "elixr",
  status: "active",
  domains: ["elixr.dgtlmag.com"],
  defaultPackageId: "custom-commission",
  brand: {
    name: "ELiXR Gallery",
    eyebrow: "Original Artwork for Professional Spaces",
    logoText: "ELiXR",
    tagline: "Art that changes the feeling of a room.",
    logo: "",
    primaryColor: "#b89b5e",
    accentColor: "#211b18"
  },
  media: {
    heroImage: "/assets/content-day-hero.png",
    heroAlt:
      "An original painting on a feature wall in a refined professional reception space."
  },
  hero: {
    headline: "Art that changes the feeling of a room.",
    subheadline:
      "Acquire original paintings, commission custom artwork, or curate a full professional space with work from ELiXR — built for offices, clinics, firms, homes, and commercial environments that want more than generic decor.",
    primaryCta: "Request a Private Art Proposal",
    secondaryCta: "View Offer Options",
    stats: [
      { value: "1-of-1", label: "original works" },
      { value: "Private", label: "acquisition process" },
      { value: "Curated", label: "for your space" }
    ]
  },
  problem: {
    eyebrow: "Who It's For",
    headline: "Private acquisition for serious buyers.",
    points: [
      "Law firms, medical clinics, dental offices, and real estate offices.",
      "Private collectors and interior designers seeking original work.",
      "Boutique hotels and commercial spaces where atmosphere matters.",
      "Executive offices, boardrooms, and feature walls that set a first impression."
    ]
  },
  system: {
    eyebrow: "The Concept",
    headline: "Original artwork for spaces where first impressions matter.",
    body:
      "Most professional spaces rely on generic prints or empty walls. Original artwork creates a different impression — it gives the room identity, warmth, taste, and a sense of intention. ELiXR helps professionals, organizations, designers, and collectors acquire original work for environments where atmosphere matters.",
    features: [
      {
        title: "Acquire",
        body: "Existing original pieces for a lobby, boardroom, waiting room, executive office, or private collection."
      },
      {
        title: "Commission",
        body: "A one-of-one piece created for your wall, space, emotional direction, brand tone, or design concept."
      },
      {
        title: "Curate",
        body: "Multiple works across an office, clinic, commercial environment, boutique hotel, or luxury residence."
      }
    ]
  },
  process: {
    eyebrow: "How It Works",
    headline: "A calm, simple process for serious buyers.",
    steps: [
      { title: "Submit an Inquiry", body: "Tell us about the space, budget, timeline, and type of artwork you are considering." },
      { title: "Receive a Recommendation", body: "We prepare a private recommendation or proposal based on your goals and environment." },
      { title: "Confirm the Direction", body: "Approve the piece, commission, deposit, delivery details, and timeline." },
      { title: "Delivery and Placement", body: "Your artwork is delivered with coordination support and optional installation planning." }
    ]
  },
  output: {
    eyebrow: "Available Works",
    headline: "Private catalog available by request.",
    body:
      "Selected works can be shown as a preview, while pricing, availability, and commission details are handled through private proposals. Replace these placeholders with current ELiXR artwork.",
    tiles: ["ORIGINALS", "COMMISSIONS", "FEATURE WALLS", "LOBBY", "BOARDROOM", "CLINIC", "OFFICE", "HOSPITALITY", "RESIDENTIAL"]
  },
  packageSection: {
    eyebrow: "Offer Framework",
    headline: "Choose the right path for your space.",
    body:
      "From a single statement piece to a full curated environment, each path begins with a private proposal — no public pricing, no high-pressure sales."
  },
  packages: [
    {
      id: "original-statement-piece",
      name: "Original Statement Piece",
      summary: "Acquire an existing original piece for a key space.",
      price: "$2,500+",
      priceQualifier: "starting at",
      priceDisplay: "Starting at $2,500+",
      altPrice: "Existing original work",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Request available works",
      description:
        "Acquire an existing original piece for a lobby, boardroom, waiting room, executive office, or private collection.",
      features: ["Existing original artwork", "For lobbies + boardrooms", "Executive offices", "Private collections"]
    },
    {
      id: "custom-commission",
      name: "Custom Commission",
      summary: "Commission a one-of-one piece created for your space.",
      price: "$5,000+",
      priceQualifier: "starting at",
      priceDisplay: "Starting at $5,000+",
      altPrice: "One-of-one commission",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Start a commission",
      featured: true,
      description:
        "Commission a one-of-one piece created specifically for your wall, space, emotional direction, brand tone, or interior design concept.",
      features: ["Created for your wall", "Emotional + brand direction", "Interior design alignment", "One-of-one original"]
    },
    {
      id: "professional-space-curation",
      name: "Professional Space Curation",
      summary: "Curate multiple works across a full professional environment.",
      price: "$10,000+",
      priceQualifier: "starting at",
      priceDisplay: "Starting at $10,000+",
      altPrice: "Full space curation",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Request a space proposal",
      description:
        "Curate multiple works across an office, clinic, commercial environment, boutique hotel, or luxury residential project.",
      features: ["Multiple original works", "Office + clinic environments", "Boutique hotels", "Luxury residential projects"]
    }
  ],
  enterprise: {
    eyebrow: "Designer / Trade",
    headline: "Designer and trade partnerships.",
    body:
      "Interior designers and trade partners can curate ELiXR originals across multiple projects with private pricing, availability, and commission coordination handled for you.",
    cta: "Request a space proposal",
    packageId: "professional-space-curation"
  },
  checkout: {
    eyebrow: "Private Proposal",
    headline: "Request a private art proposal.",
    body:
      "Share a few details about your space. We will follow up with available works, commission options, or a curated recommendation.",
    submitCta: "Request My Proposal",
    disclaimer:
      "Artwork purchased for a professional space may have business accounting or tax considerations depending on use and jurisdiction. Confirm details with your accountant or financial advisor."
  },
  // ELiXR is a high-ticket art funnel, not a funding tenant.
  fundingPromo: { enabled: false },
  faq: {
    eyebrow: "Questions",
    headline: "Artist-led, sales-supported.",
    items: [
      {
        question: "Do I have to deal with sales calls?",
        answer:
          "No. This funnel is designed so ELiXR does not handle high-pressure sales calls, constant meetings, or uncomfortable outreach."
      },
      {
        question: "Who manages the buyer process?",
        answer:
          "DGTL can manage the page, outreach, lead filtering, buyer communication, and proposals. ELiXR only approves artwork availability, pricing, creative direction, and serious commission opportunities."
      },
      {
        question: "Can I see pricing and availability?",
        answer:
          "Pricing, availability, and commission details are shared privately through a proposal tailored to your space and goals."
      }
    ]
  },
  finalCta: {
    eyebrow: "Ready",
    headline: "Request a private art proposal.",
    body: "Tell us about your space and we will follow up with available works, commission options, or a curated recommendation.",
    cta: "Request a Private Art Proposal"
  },
  mobileCta: {
    primary: "Request Proposal",
    secondary: "Offers"
  },
  contractorSettings: {
    serviceAreas: ["Toronto", "GTA", "Remote"],
    defaultCapacityNotes:
      "Track available originals, commission slots, curation projects, and delivery / installation coordination here."
  }
});
