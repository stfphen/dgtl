import { normalizeTenantConfig } from "../defaultTenant.js";

// ON Home Decor — Toronto / GTA interior design, curated paint selection,
// styling, and full-home renovation planning. Led by designer Elena.
//
// Migrated from the standalone Lovable site (twistedrc1017/on-home-decor-ddemo)
// into the DGTL Platform tenant architecture. The funnel is built
// around a low-friction paid entry offer — Curated Paint Selection at $200 per
// colour — that ladders up into room styling, renovation design direction, and
// a signature full-home transformation. Warm-luxury palette: taupe + blush.
//
// No hospitality / accommodation language is carried over; this is an interior
// design, paint, decor, styling, and renovation business.
export const onHomeDecorTenant = normalizeTenantConfig({
  id: "tenant_on_home_decor",
  slug: "on-home-decor",
  status: "active",
  domains: [
    "on-homedecor.com",
    "www.on-homedecor.com"
  ],
  defaultPackageId: "curated-paint-selection",
  brand: {
    name: "ON Home Decor",
    eyebrow: "Toronto Interior Design & Paint Consultation",
    logoText: "ON Home Decor",
    tagline: "Start with one colour.",
    logo: "",
    appIcon: "",
    primaryColor: "#8B7A5E",
    accentColor: "#C9A9A6"
  },
  media: {
    heroImage: "/assets/content-day-hero.png",
    heroAlt:
      "A warm, elegantly styled Toronto living room with curated paint, layered neutrals, and refined decor."
  },
  hero: {
    headline: "Choose the perfect paint colour for your home — with a designer's eye.",
    subheadline:
      "ON Home Decor helps Toronto homeowners create warmer, more cohesive, beautifully designed spaces through curated paint selections, room styling, and full-service interior design.",
    primaryCta: "Book Your Paint Consultation",
    secondaryCta: "Explore Design Packages",
    stats: [
      { value: "$200", label: "per curated colour" },
      { value: "1", label: "room to start" },
      { value: "GTA", label: "Toronto & area" }
    ]
  },
  problem: {
    eyebrow: "The Problem",
    headline: "Choosing paint is harder than it looks.",
    points: [
      "Undertones shift the moment they hit your walls.",
      "Lighting changes the colour throughout the day.",
      "Flooring, trim, and furniture can clash with the wrong shade.",
      "A wrong choice wastes time, money, and a weekend repainting."
    ]
  },
  system: {
    eyebrow: "The Approach",
    headline: "A designer-approved colour you can feel confident about.",
    body:
      "Choosing the right paint colour should not feel like a gamble. Elena reviews your lighting, furniture, flooring, trim, and how you actually want the room to feel — then curates a colour that works in your real space, not just on a screen.",
    features: [
      {
        title: "Read the room",
        body: "Natural and artificial light, existing finishes, flooring, trim, and decor are all reviewed together."
      },
      {
        title: "Curate the colour",
        body: "A designer-approved paint selection with finish, sheen, and complementary accent or trim guidance."
      },
      {
        title: "Explain the why",
        body: "You learn why the colour works and the mood it creates, so you can move forward without second-guessing."
      }
    ]
  },
  process: {
    eyebrow: "How It Works",
    headline: "Simple. Personal. Designer-led.",
    steps: [
      {
        title: "Book your consultation",
        body: "Reserve your Curated Paint Selection and tell us about the space."
      },
      {
        title: "Share your space",
        body: "Send photos, room goals, lighting, existing finishes, and any inspiration."
      },
      {
        title: "Elena curates the colour",
        body: "She reviews your space and selects a designer-approved paint recommendation."
      },
      {
        title: "Receive your direction",
        body: "You get a clear colour selection, finish guidance, and confident next steps."
      }
    ]
  },
  output: {
    eyebrow: "Where We Help",
    headline: "From one room to a full home.",
    body:
      "Whether you are refreshing a single wall or planning a whole-home renovation, we bring a designer's eye to the decisions that make a space feel intentional.",
    tiles: [
      "PAINT REFRESH",
      "CONDO MAKEOVER",
      "PRE-SALE REFRESH",
      "RENOVATION PLANNING",
      "KITCHEN & BATH",
      "TRIM & CABINETS",
      "ROOM STYLING",
      "COMMERCIAL SPACES",
      "FULL HOME"
    ]
  },
  packageSection: {
    eyebrow: "Design Packages",
    headline: "Start with one colour. Grow into a full transformation.",
    body:
      "Begin with a curated paint selection, then step up to room styling, renovation design direction, or a full-home transformation as your project grows. Larger renovation and full-home scopes are confirmed after a short consultation."
  },
  packages: [
    {
      id: "curated-paint-selection",
      name: "Curated Paint Selection",
      summary: "Designer-approved paint colour for one room, wall, cabinet, trim, or feature.",
      price: "$200",
      priceQualifier: "per colour",
      priceDisplay: "$200 per colour",
      altPrice: "Most homeowners start here",
      action: "checkout",
      paymentLink: "",
      bookingLink: "",
      stripe: {
        amount: 20000,
        currency: "cad",
        productName: "Curated Paint Selection",
        mode: "payment"
      },
      cta: "Book Your Paint Consultation",
      featured: true,
      description:
        "A personalized, designer-approved paint colour for a room, wall, cabinet, door, trim, or feature — chosen for your lighting, finishes, and the way you want the space to feel.",
      features: [
        "Personalized colour recommendation for your chosen area",
        "Lighting, flooring, trim, and furniture reviewed together",
        "Suggested finish/sheen and accent or trim guidance",
        "A clear explanation of why the colour works"
      ]
    },
    {
      id: "room-refresh-consultation",
      name: "Room Refresh Consultation",
      summary: "One-room design direction for clients who need more than paint.",
      price: "$500–$750",
      priceQualifier: "per room",
      priceDisplay: "$500–$750",
      altPrice: "Layout, palette & styling plan",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Plan a Room Refresh",
      description:
        "A focused design session for one room: layout suggestions, paint and palette direction, furniture and decor recommendations, lighting ideas, and a clear action plan.",
      features: [
        "Layout and styling priorities",
        "Paint and palette direction",
        "Furniture, decor, and lighting recommendations",
        "Shopping direction and a clear action plan"
      ]
    },
    {
      id: "designer-room-styling",
      name: "Designer Room Styling Package",
      summary: "A hands-on transformation of one room, concept to styling.",
      price: "$1,500–$3,500",
      priceQualifier: "per room",
      priceDisplay: "$1,500–$3,500 per room",
      altPrice: "Full concept + sourcing",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Style My Room",
      description:
        "A complete room design concept with colour palette, furniture and decor sourcing, moodboard, shopping list, and a placement and layout guide — with optional final styling install.",
      features: [
        "Full room design concept and moodboard",
        "Colour palette and furniture/decor sourcing",
        "Shopping list and placement/layout guide",
        "Optional install or final styling add-on"
      ]
    },
    {
      id: "kitchen-bath-design-direction",
      name: "Kitchen & Bathroom Design Direction",
      summary: "Renovation design support for higher-investment spaces.",
      price: "$2,500–$7,500+",
      priceQualifier: "per space",
      priceDisplay: "$2,500–$7,500+",
      altPrice: "Contractor-ready direction",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Get Renovation Direction",
      description:
        "Design vision and material direction for kitchens and bathrooms: cabinet, fixture, tile, countertop, and finish suggestions with layout feedback and contractor-ready guidance.",
      features: [
        "Design vision and material palette",
        "Cabinet, fixture, and finish direction",
        "Tile, countertop, and layout feedback",
        "Contractor-ready guidance where appropriate"
      ]
    },
    {
      id: "full-home-design-renovation-planning",
      name: "Full Home Design & Renovation Planning",
      summary: "Whole-home design and renovation planning support.",
      price: "$8,000–$25,000+",
      priceQualifier: "project",
      priceDisplay: "$8,000–$25,000+",
      altPrice: "Room-by-room planning",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Plan My Renovation",
      description:
        "A whole-home design concept with interior style direction, paint and materials palette, space planning, room-by-room guidance, renovation planning, and contractor coordination support.",
      features: [
        "Whole-home design concept and style direction",
        "Paint, materials, and finish selections",
        "Space planning and room-by-room guidance",
        "Renovation planning and contractor coordination support"
      ]
    },
    {
      id: "on-home-transformation-experience",
      name: "The ON Home Transformation Experience",
      summary: "Our signature, designer-led transformation from concept to completion.",
      price: "$15,000–$50,000+",
      priceQualifier: "by scope",
      priceDisplay: "$15,000–$50,000+",
      altPrice: "By application",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Apply for a Full Home Consultation",
      description:
        "Our flagship service for serious homeowners who want a trusted design partner to guide the whole transformation: discovery, whole-home vision, selections, sourcing, vendor coordination, timeline guidance, and a styled final reveal.",
      features: [
        "Initial discovery and whole-home design vision",
        "Paint, material, finish selections, and sourcing",
        "Kitchen/bath concepts and space planning",
        "Contractor coordination, timeline, and final styling"
      ]
    }
  ],
  enterprise: {
    eyebrow: "Signature",
    headline: "The ON Home Transformation Experience.",
    body:
      "For serious homeowners who want more than advice — a trusted design partner to guide a cohesive, designer-led transformation from concept to completion, including selections, sourcing, vendor coordination, and a styled final reveal.",
    cta: "Apply for a Full Home Consultation",
    packageId: "on-home-transformation-experience"
  },
  checkout: {
    eyebrow: "Get Started",
    headline: "Book your Curated Paint Selection.",
    body:
      "Tell us about your space and the room or feature you want help with. In your message, include the number of colours you need, your timeline, and any photos or inspiration links — Elena will follow up to confirm your consultation.",
    submitCta: "Book My Consultation",
    disclaimer: "No payment is processed until live checkout is enabled by the admin."
  },
  fundingPromo: { enabled: false },
  faq: {
    eyebrow: "Questions",
    headline: "Everything you need to feel confident.",
    items: [
      {
        question: "How does the $200 paint selection work?",
        answer:
          "You book the consultation and share photos, room goals, lighting, and existing finishes. Elena reviews your space and curates a designer-approved colour with finish and next-step guidance."
      },
      {
        question: "Is the price really $200 per colour?",
        answer:
          "Yes. Each curated colour selection is $200. If you need colours for several rooms or features, simply request the number you need and we will plan accordingly."
      },
      {
        question: "Can I book help for more than one room?",
        answer:
          "Absolutely. Many clients start with one colour, then move into a Room Refresh, Designer Room Styling, or full-home planning as their project grows."
      },
      {
        question: "Do you help with paint finishes and trim colours?",
        answer:
          "Yes. Along with the wall colour, you get finish/sheen guidance and complementary accent, trim, cabinet, or feature-wall direction where it helps."
      },
      {
        question: "Do you provide full design services too?",
        answer:
          "Yes. We offer room styling, kitchen and bathroom design direction, full-home design and renovation planning, and our signature ON Home Transformation Experience."
      },
      {
        question: "Do you work outside Toronto?",
        answer:
          "We are based in Toronto and serve the GTA. Photo-based paint and styling guidance can often be provided beyond the immediate area — just ask."
      },
      {
        question: "Can you help with renovations?",
        answer:
          "Yes. We support renovation planning with material palettes, finish selections, layout feedback, contractor-ready direction, and project coordination."
      },
      {
        question: "Can you help small businesses or commercial spaces?",
        answer:
          "Yes. We help restaurants, retail shops, salons, clinics, and boutique offices create cohesive, elevated interiors that fit their brand."
      },
      {
        question: "What if I need furniture and decor recommendations too?",
        answer:
          "Our Room Refresh and Designer Room Styling packages include furniture, decor, lighting, and placement guidance with a shopping list."
      }
    ]
  },
  finalCta: {
    eyebrow: "Ready",
    headline: "Start with one colour. Transform the feeling of your entire space.",
    body: "Choose a colour you can feel confident about — with a designer's eye guiding the way.",
    cta: "Book Your Curated Paint Selection"
  },
  mobileCta: {
    primary: "Book Paint Consult",
    secondary: "Packages"
  },
  contact: {
    leadName: "Elena",
    email: "contact@on-homedecor.com",
    phone: "647-627-3803",
    location: "Toronto, Ontario / GTA"
  },
  routing: {
    leadWebhookUrl: "",
    replyToEmail: "contact@on-homedecor.com",
    phoneNumber: "647-627-3803",
    phoneNotes: "Curated Paint Selection and design consultation inquiries.",
    senderDomain: "on-homedecor.com"
  },
  telephony: { enabled: false },
  contractorSettings: {
    serviceAreas: ["Toronto", "GTA", "North York", "Scarborough", "Etobicoke", "Mississauga", "Vaughan", "Markham"],
    defaultCapacityNotes: "Track design consultation availability, project scopes, and trade/vendor coordination here."
  },
  teamId: "team_default"
});

export default onHomeDecorTenant;
