import { normalizeTenantConfig } from "../defaultTenant.js";

// DGTL Growth Platform — the marketing-first funnel for the platform itself
// (template: "platform"), served at the canonical app host app.dgtlmedia.io.
//
// This page sells the software this repo IS — tenant-branded funnels, the lead
// pipeline, prospecting/enrichment, the outreach engine, built-in checkout, and
// the funding radar — positioned as white-label B2B software with a Register
// (access request) flow instead of the Content Day service funnel it replaces
// on this host. Content the funnel schema cannot express lives in the
// top-level `platform` block, which rides through normalize/sanitize untouched
// (same passthrough contract as the agency template's `agency` block). The
// block is seed-authored only — components must read it with defensive
// defaults.
//
// Facts policy: agency stats (75+ campaigns, $1M+ direct client revenue,
// 250M+ creator reach) are the verified set already published on the
// dgtl-group tenant. Live-funnel roster links point at real tenant slugs
// (asserted in tests/platform-template.test.js). The 400 Market numbers match
// the verified case record (Lighthouse 45 → 86 mobile, organic doubled in 12
// months). No invented clients, prices, or results.
//
// Registration is honest: it is an access REQUEST captured into the lead
// pipeline (category "platform-registration", package "platform-access"),
// not a self-serve signup — self-serve tenant onboarding is Sprint-2 scope.
export const dgtlPlatformTenant = normalizeTenantConfig({
  id: "tenant_dgtl_platform",
  slug: "dgtl-platform",
  status: "active",
  template: "platform",
  // Canonical app host. dgtlmag.com (Content Day) and dgtlgroup.io (agency
  // page) keep their own tenants; this domain must be claimed by no other
  // tenant — tests enforce the exclusivity.
  domains: ["app.dgtlmedia.io"],
  defaultPackageId: "platform-access",
  brand: {
    name: "DGTL Growth Platform",
    eyebrow: "B2B Growth Software",
    logoText: "DGTL",
    tagline: "One system from first click to paid invoice.",
    logo: "/assets/brand/dgtl-logo.svg",
    appIcon: "",
    primaryColor: "#F0CF50",
    accentColor: "#000000"
  },
  media: {
    heroImage: "",
    heroAlt: "",
    heroVideo: { url: "", kind: "", videoId: "", playlistId: "" }
  },
  hero: {
    headline: "One system from first click to paid invoice.",
    subheadline:
      "DGTL Growth Platform puts a branded funnel, a live lead pipeline, AI prospect research, and a compliant outreach engine under one roof — the same software DGTL Group runs its own agency on. Register your company for access.",
    primaryCta: "Register for Access",
    secondaryCta: "See the System",
    stats: [
      { value: "75+", label: "campaigns run through it since 2022" },
      { value: "$1M+", label: "direct client revenue closed on-platform" },
      { value: "250M+", label: "creator network reach behind it" }
    ]
  },
  // One honest "package": access is provisioned per company and scoped at
  // onboarding. action "capture" — the register form is the only intake; no
  // Stripe link, no booking link, nothing to pretend.
  packages: [
    {
      id: "platform-access",
      name: "Platform Access",
      summary: "White-label growth infrastructure, provisioned per company.",
      price: "Scoped",
      priceQualifier: "at onboarding",
      priceDisplay: "Scoped at onboarding",
      altPrice: "",
      action: "capture",
      paymentLink: "",
      bookingLink: "",
      cta: "Register for Access",
      description:
        "Your branded funnel, admin, pipeline, outreach engine, and checkout — stood up on your domain and operated with you.",
      features: [
        "Branded funnel on your domain",
        "Lead pipeline + scoring",
        "AI prospecting & enrichment",
        "Outreach engine with compliance built in"
      ]
    }
  ],
  // ——— platform template content (rides through sanitize untouched) ———
  platform: {
    nav: [
      { href: "#platform", label: "Platform" },
      { href: "#system", label: "The System" },
      { href: "#proof", label: "Proof" },
      { href: "#faq", label: "FAQ" }
    ],
    marquee: {
      label: "The system behind DGTL's work for",
      logos: [
        { name: "On Running", src: "/assets/brand/logos/on-running.png" },
        { name: "Canon", src: "/assets/brand/logos/canon.png" },
        { name: "DJI", src: "/assets/brand/logos/dji.png" },
        { name: "Epidemic Sound", src: "/assets/brand/logos/epidemic-sound.png" },
        { name: "Mercedes-Benz", src: "/assets/brand/logos/mercedes-benz.png" },
        { name: "Anker", src: "/assets/brand/logos/anker.png" },
        { name: "Hyundai", src: "/assets/brand/logos/hyundai.png" },
        { name: "Six Senses Ibiza", src: "/assets/brand/logos/six-senses-ibiza.png" },
        { name: "Arc'teryx", src: "/assets/brand/logos/arcteryx.png" },
        { name: "Audi", src: "/assets/brand/logos/audi.png" },
        { name: "Lexus", src: "/assets/brand/logos/lexus.png" },
        { name: "PolarPro", src: "/assets/brand/logos/polarpro.png" },
        { name: "Ford", src: "/assets/brand/logos/ford.png" },
        { name: "Porsche", src: "/assets/brand/logos/porsche.png" },
        { name: "Corona", src: "/assets/brand/logos/corona.png" },
        { name: "Guild's Garage", src: "/assets/brand/logos/guilds-garage.png" },
        { name: "Rotary", src: "/assets/brand/logos/rotary.png" },
        { name: "CanaDream", src: "/assets/brand/logos/canadream.png" }
      ]
    },
    problem: {
      eyebrow: "The Problem",
      headline: "Growth tools shouldn't be duct tape.",
      body:
        "Most B2B teams run growth across five disconnected tools and a prayer. Every gap between them is where revenue leaks.",
      points: [
        {
          title: "Leads live in five inboxes",
          body: "Inquiries scatter across DMs, email, and form tools. Nothing is scored, nothing is staged, and the fastest competitor wins the reply."
        },
        {
          title: "Your funnel is rented",
          body: "A page-builder subdomain that doesn't look like your brand, doesn't feed your pipeline, and doesn't belong to you."
        },
        {
          title: "Outreach is manual",
          body: "Follow-ups fired from personal inboxes. No sequences, no approvals, no compliance trail when someone asks to be removed."
        },
        {
          title: "Reporting is vibes",
          body: "No single view from first touch to paid invoice — so nobody can say which channel actually made money."
        }
      ]
    },
    pillars: {
      eyebrow: "The Platform",
      headline: "Everything between first click and paid invoice.",
      body:
        "Six modules, one login, your brand on the front of all of it.",
      items: [
        {
          tag: "Funnels",
          title: "Branded funnels",
          body: "Conversion funnels on your own domain — four templates, your colors, your offer ladder. Live in days, not quarters."
        },
        {
          tag: "Pipeline",
          title: "Live lead pipeline",
          body: "Every inquiry lands scored, staged, and owned. Work leads in a command-center admin instead of an inbox."
        },
        {
          tag: "Prospecting",
          title: "AI prospecting & enrichment",
          body: "Point it at a market and it researches, enriches, and scores prospects before your team spends a minute on them."
        },
        {
          tag: "Outreach",
          title: "Outreach engine",
          body: "Sequenced email with follow-up drips, batch sending, approval gates, and signed one-click unsubscribe compliance."
        },
        {
          tag: "Checkout",
          title: "Checkout built in",
          body: "Stripe-backed packages sell your productized offers straight from the funnel — no invoice ping-pong."
        },
        {
          tag: "Funding",
          title: "Funding radar",
          body: "Flags Canadian funding programs your business may qualify for, matched against your pipeline and readiness signals."
        }
      ]
    },
    rail: {
      eyebrow: "The System",
      headline: "Watch a stranger become revenue.",
      body: "One pipeline, end to end. No exports, no re-keying, no leaks between tools.",
      steps: [
        { title: "Visitor", body: "Lands on your branded funnel — your domain, your offer, your proof." },
        { title: "Lead", body: "Captured, scored, and staged in the pipeline the moment they submit." },
        { title: "Enriched", body: "AI research fills in the company, the context, and the angle." },
        { title: "Outreach", body: "Sequences and follow-up drips run on schedule, with approvals and compliance." },
        { title: "Booked", body: "Qualified conversations land on your calendar, not in a spreadsheet." },
        { title: "Paid", body: "Built-in checkout closes the loop — first click to paid invoice, one system." }
      ],
      footnote: "Every stage is tenant-scoped, permissioned, and audit-logged."
    },
    onboarding: {
      eyebrow: "How It Works",
      headline: "Register today. Live in days.",
      steps: [
        { title: "Register", body: "Tell us who you are and what you sell. Every registration is reviewed within one business day." },
        { title: "Provision", body: "We stand up your tenant — funnel, admin, pipeline, and domain wiring." },
        { title: "Load the offer", body: "Your packages, pricing, booking, and outreach templates go in." },
        { title: "Go live", body: "Traffic in, pipeline fills, follow-up runs itself. You work the calls." }
      ]
    },
    proof: {
      eyebrow: "Receipts, Not Promises",
      headline: "Already running real brands.",
      body:
        "These aren't mockups. The platform serves production funnels today — click through and you're on it.",
      funnels: [
        {
          name: "DMTV Studio",
          blurb: "Music media network built and operated on the platform.",
          href: "/t/dmtv-studio"
        },
        {
          name: "Elixr",
          blurb: "Brand funnel running the full capture-to-checkout flow.",
          href: "/t/elixr"
        },
        {
          name: "ON Home Decor",
          blurb: "White-label retail funnel with its own offer ladder.",
          href: "/t/on-home-decor"
        }
      ],
      caseStudy: {
        eyebrow: "Build discipline",
        title: "The 400 Market",
        body:
          "A 40-year-old market's legacy WordPress site, rebuilt by the same team: security hardened in week one, mobile Lighthouse 45 → 86, organic traffic doubled in 12 months — then rebuilt as a Next.js platform with Stripe e-commerce and CRM sync scoring 90/91 Lighthouse.",
        stats: [
          { value: "45 → 86", label: "mobile Lighthouse" },
          { value: "2×", label: "organic traffic in 12 months" },
          { value: "90/91", label: "Lighthouse on the rebuild" }
        ]
      },
      statement: "If it can run an agency, it can run your pipeline."
    },
    faq: {
      headline: "Straight answers.",
      items: [
        {
          question: "Is this really white-label?",
          answer:
            "Yes. Your funnel runs on your domain with your brand — logo, colors, copy, offer ladder. DGTL operates the infrastructure behind it; your customers only ever see you."
        },
        {
          question: "What happens after I register?",
          answer:
            "Registration is an access request, not a contract. We review every registration, reply within one business day, and onboard in cohorts — you'll get a provisioning call where we map your offer onto the platform."
        },
        {
          question: "Do I have to replace my website or CRM?",
          answer:
            "No. The funnel runs alongside whatever you have today, and the pipeline becomes the working view for the leads it generates. Most teams retire the old tools later, on their own schedule."
        },
        {
          question: "What does it cost?",
          answer:
            "Access is scoped at onboarding based on the modules you need and your volume — some teams pair the platform with DGTL content and creative retainers, some run it standalone. No pricing surprises mid-quarter."
        },
        {
          question: "Who's behind it?",
          answer:
            "DGTL Group, Toronto. The platform is the system DGTL runs its own agency on — the funnels, pipeline, and outreach it sells with are the ones you're registering for."
        }
      ]
    },
    register: {
      eyebrow: "Access",
      headline: "Register your company.",
      body:
        "Access is provisioned in onboarding cohorts. Tell us what you sell — every registration is reviewed and answered within one business day.",
      submitCta: "Register",
      successMessage: "Registered. Watch your inbox — onboarding details within one business day.",
      footnote: "No credit card. Registration is an access request, not a contract."
    },
    footer: {
      blurb:
        "Built and operated by DGTL Group, Toronto. The platform behind DGTL's own funnels, pipeline, and outreach.",
      links: [
        { label: "DGTL Group", url: "https://dgtlgroup.io" },
        { label: "Book a Call", url: "https://dgtlgroup.io/book-a-call" },
        { label: "Instagram", url: "https://instagram.com/dgtlgroup" },
        { label: "LinkedIn", url: "https://linkedin.com/company/dgtlgroup" }
      ]
    }
  }
});
