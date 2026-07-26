import { normalizeTenantConfig } from "../defaultTenant.js";

export const fundedGrowthTenant = normalizeTenantConfig({
  id: "tenant_funded_growth",
  slug: "funded-growth",
  status: "active",
  domains: ["funding.dgtlmag.com", "grants.dgtlmag.com"],
  defaultPackageId: "funding-fit-scan",
  brand: {
    name: "DGTL Funded Growth Studio",
    eyebrow: "DGTL Funded Growth Studio",
    logoText: "DGTL Growth",
    tagline: "Turn growth plans into funded projects.",
    logo: "",
    primaryColor: "#0b8a5a",
    accentColor: "#04231a"
  },
  hero: {
    headline: "Find out if your business may qualify for funding-backed digital growth.",
    subheadline:
      "We help Canadian businesses identify funding pathways for digital modernization, e-commerce, export marketing, automation, and market expansion.",
    primaryCta: "Start Funding Fit Scan",
    secondaryCta: "View Growth Packages",
    stats: [
      { value: "8", label: "funding lanes screened" },
      { value: "Free", label: "initial fit scan" },
      { value: "Canada", label: "business-growth focus" }
    ]
  },
  problem: {
    eyebrow: "The Gap",
    headline: "Growth funding is hard to act on without a project shape.",
    points: [
      "You are not sure which programs fit your business.",
      "Your digital, export, or automation needs are scattered.",
      "You need a fundable project scope before application work.",
      "You want growth execution that can survive grant timelines."
    ]
  },
  system: {
    eyebrow: "The Studio",
    headline: "Turn growth goals into fundable digital projects.",
    body:
      "We screen your business context, map likely funding lanes, and shape practical growth packages for modernization, e-commerce, export marketing, automation, and market expansion.",
    features: [
      {
        title: "Fit Scan",
        body: "Capture business readiness, funding lane signals, and project gaps."
      },
      {
        title: "Blueprint",
        body: "Convert the opportunity into a scoped, budgeted project plan."
      },
      {
        title: "Execution",
        body: "Build the digital growth assets, campaigns, and systems after approval."
      }
    ]
  },
  process: {
    eyebrow: "How It Works",
    headline: "Start with eligibility signals, then scope the project.",
    steps: [
      { title: "Funding Fit Scan", body: "Share your business profile, goals, needs, and current readiness." },
      { title: "Lane Review", body: "We identify likely pathways and the gaps that need clarification." },
      { title: "Project Blueprint", body: "We shape budget, milestones, outcomes, and implementation scope." },
      { title: "Application and Delivery", body: "Support application work and execute the approved growth plan." }
    ]
  },
  output: {
    eyebrow: "Funding Lanes",
    headline: "What the scan screens for.",
    body:
      "The intake looks for signals across common Canadian business-growth pathways without making eligibility claims before review.",
    tiles: ["DIGITAL", "ECOMMERCE", "EXPORT", "CREATIVE TECH", "CLEAN TECH", "TRAINING", "PROCUREMENT", "EXPANSION"]
  },
  fundedOpportunity: {
    eyebrow: "Opportunity Intelligence",
    headline: "Find programs that can fund the marketing and digital work.",
    body:
      "We monitor grant, contribution, digital adoption, export, creative, workforce, and funded-contract pathways, then match them to business needs before recommending a practical service package.",
    points: [
      "Program fit mapped to business type, location, sector, and project goal.",
      "Outreach angles for eligible prospects and warm funding-scan leads.",
      "Proposal support checklist for scope, budget, milestones, and evidence."
    ]
  },
  packageSection: {
    eyebrow: "Growth Packages",
    headline: "Choose the next step for funded growth.",
    body:
      "Start with the free scan, then move into blueprint, application, execution, or ongoing opportunity intelligence as the business case becomes clear."
  },
  packages: [
    {
      id: "funding-fit-scan",
      name: "Funding Fit Scan",
      summary: "A lightweight intake to identify likely funding-backed growth pathways.",
      price: "Free",
      priceQualifier: "/ apply",
      priceDisplay: "Free / Apply",
      altPrice: "Best first step",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Start Scan",
      featured: true,
      description: "A free intake that captures business readiness, growth goals, and likely funding lane signals.",
      features: ["Funding lane screen", "Readiness gaps", "Recommended next step", "No eligibility claim before review"]
    },
    {
      id: "fundable-project-blueprint",
      name: "Fundable Project Blueprint",
      summary: "Turn the opportunity into a scoped project plan.",
      price: "$2,500",
      priceQualifier: "one time",
      priceDisplay: "$2,500",
      altPrice: "Project plan and budget",
      action: "checkout",
      paymentLink: "",
      bookingLink: "",
      cta: "Select Blueprint",
      description: "A practical blueprint for digital modernization, market expansion, or funded growth execution.",
      features: ["Project scope", "Budget assumptions", "Milestones", "Application-ready narrative"]
    },
    {
      id: "application-support",
      name: "Application Support",
      summary: "Support for packaging the project into an application-ready format.",
      price: "$5,000+",
      priceQualifier: "",
      priceDisplay: "$5,000+",
      altPrice: "Based on program complexity",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Scope Support",
      description: "Hands-on support for application materials, project narrative, documentation, and budget alignment.",
      features: ["Application narrative", "Budget support", "Document checklist", "Submission coordination"]
    },
    {
      id: "funded-growth-execution",
      name: "Funded Growth Execution",
      summary: "Digital growth delivery after the project is approved or budgeted.",
      price: "Custom",
      priceQualifier: "",
      priceDisplay: "Custom",
      altPrice: "Scoped to the approved project",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Scope Execution",
      description: "Execution support for digital assets, campaigns, automation, and market expansion initiatives.",
      features: ["Growth systems", "Campaign assets", "Automation support", "Measurement setup"]
    },
    {
      id: "monthly-opportunity-intelligence",
      name: "Monthly Opportunity Intelligence",
      summary: "Ongoing funding and growth opportunity monitoring.",
      price: "Retainer",
      priceQualifier: "",
      priceDisplay: "Retainer",
      altPrice: "Monthly advisory rhythm",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Discuss Retainer",
      description: "Monthly monitoring and strategic guidance for business-growth funding opportunities.",
      features: ["Opportunity watchlist", "Monthly review", "Project prioritization", "Readiness guidance"]
    }
  ],
  enterprise: {
    eyebrow: "Execution",
    headline: "Move from funding signal to a real growth project.",
    body:
      "For businesses with a clear lane, we can scope digital modernization, e-commerce growth, export marketing, automation, market expansion, and ongoing intelligence.",
    cta: "Scope Growth Project",
    packageId: "funded-growth-execution"
  },
  checkout: {
    eyebrow: "Funding Fit Scan",
    headline: "Start with a business readiness intake.",
    body:
      "Select a growth package and share the business context needed to review potential funding-backed digital growth paths.",
    submitCta: "Submit Funding Fit Scan",
    disclaimer: "This scan does not guarantee program eligibility or funding approval."
  },
  faq: {
    eyebrow: "Questions",
    headline: "Funding fit starts with evidence, not assumptions.",
    items: [
      {
        question: "Is this a grant application?",
        answer: "No. The scan captures readiness signals before application or program-specific work begins."
      },
      {
        question: "Do you guarantee funding?",
        answer: "No. Eligibility and approval depend on the specific program, timing, and business evidence."
      },
      {
        question: "What happens after the scan?",
        answer: "We review the context and recommend whether a blueprint, application support, or execution scope makes sense."
      }
    ]
  },
  finalCta: {
    eyebrow: "Ready",
    headline: "Find the strongest path before you spend on growth.",
    body: "Start with a focused scan of your business, goals, budget, and digital needs.",
    cta: "Start Funding Fit Scan"
  },
  mobileCta: {
    primary: "Start Scan",
    secondary: "Packages"
  }
});
