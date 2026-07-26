import { normalizeTenantConfig } from "../defaultTenant.js";

// DMTV Studio — the standalone DMTV brand page (template: "showcase").
//
// A second, independent DMTV tenant rendered by components/showcase/ShowcasePage
// instead of the shared FunnelPage. Section content the funnel template cannot
// express (reels, video wall, film strips, team tracks) lives in the top-level
// `showcase` block, which rides through normalize/sanitize untouched. That block
// is seed-authored only (never public input), so components must defensively
// default when reading it. Media references real DMTV channels: the Underground
// Showcase concert and Minute of Music reels hot-link at runtime.
export const dmtvStudioTenant = normalizeTenantConfig({
  id: "tenant_dmtv_studio",
  slug: "dmtv-studio",
  status: "active",
  template: "showcase",
  // Deliberately NOT dmtv.dgtlmag.com: host resolution must stay deterministic
  // between this row and the original dmtv tenant.
  domains: ["studio.dmtv.dgtlmag.com"],
  defaultPackageId: "artist-content-package",
  brand: {
    name: "DMTV",
    eyebrow: "Digital Music Entertainment",
    logoText: "DMTV",
    tagline: "Discovering the next generation of artists.",
    logo: "",
    primaryColor: "#f7d64a",
    accentColor: "#050505"
  },
  media: {
    heroImage: "/assets/content-day-hero.png",
    heroAlt: "Live concert stage at a DMTV Underground Showcase in Toronto.",
    // Ambient hero background: DMTV Underground Showcase full concert.
    heroVideo: {
      url: "https://www.youtube.com/watch?v=T_xIf3tkGls",
      kind: "video",
      videoId: "T_xIf3tkGls",
      playlistId: ""
    }
  },
  hero: {
    headline: "Toronto's music media network, discovering the next generation of artists.",
    subheadline:
      "Features, music videos, live shows, and brand campaigns from inside the culture.",
    primaryCta: "Submit your minute",
    secondaryCta: "See the packages",
    stats: [
      { value: "3M+", label: "series views" },
      { value: "10K", label: "avg / video" },
      { value: "110K", label: "monthly reach" }
    ]
  },
  packageSection: {
    eyebrow: "",
    headline: "Content packages",
    body: "From a first feature to a full campaign. Pick a lane and we scope the rest with you."
  },
  packages: [
    {
      id: "minute-of-music-feature",
      name: "A Minute of Music Feature",
      summary: "One minute. One take. Your track in front of the DMTV audience.",
      price: "$300+",
      priceQualifier: "per feature",
      priceDisplay: "From $300",
      altPrice: "Entry-level exposure",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Request this package",
      description:
        "A short-form vertical feature built for discovery: shot, edited, and released on DMTV's channels with your track linked in the comments.",
      features: ["Vertical one-minute feature", "Released on DMTV channels", "Track linked in comments", "Platform-ready edit"]
    },
    {
      id: "artist-content-package",
      name: "Artist Content Package",
      summary: "A bundled content system for rollout-ready artists.",
      price: "$1K-$5K+",
      priceQualifier: "per package",
      priceDisplay: "$1K-$5K",
      altPrice: "Most artists start here",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Request this package",
      featured: true,
      description:
        "Performance clips, interviews, behind-the-scenes, cover assets, reels, and rollout content, all edited platform-ready.",
      features: ["Performance + interview clips", "Behind-the-scenes + reels", "Cover and rollout assets", "Platform-ready edits"]
    },
    {
      id: "music-video-production",
      name: "Music Video Production",
      summary: "Full concept, direction, and delivery for artists or labels.",
      price: "$5K+",
      priceQualifier: "per project",
      priceDisplay: "$5K+",
      altPrice: "Polished video + cutdowns",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Request this package",
      description:
        "Concept, creative direction, full production crew, a polished music video, and short-form cutdowns for socials.",
      features: ["Concept + creative direction", "Full production crew", "Polished music video", "Short-form cutdowns"]
    },
    {
      id: "brand-product-placement",
      name: "Brand Product Placement",
      summary: "Native sponsor integrations inside DMTV content.",
      price: "$10K+",
      priceQualifier: "per campaign",
      priceDisplay: "$10K+",
      altPrice: "Sponsor visibility",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Request this package",
      description:
        "Product placement, branded captions, logo watermarking, and creator-led visibility across every episode your campaign touches.",
      features: ["Logo watermark on episodes", "Product placement", "Branded captions + links", "Multi-platform visibility"]
    },
    {
      id: "rollout-campaign",
      name: "Label / Artist Rollout Campaign",
      summary: "A rollout system for singles, projects, and launches.",
      price: "$15K+",
      priceQualifier: "per rollout",
      priceDisplay: "$15K+",
      altPrice: "Full rollout system",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Request this package",
      description:
        "Creative direction, content production, distribution support, and audience-building assets for a single, project, or label launch.",
      features: ["Creative direction", "Content production", "Distribution support", "Audience-building assets"]
    },
    {
      id: "custom-brand-activation",
      name: "Custom Brand Activation",
      summary: "A full cultural campaign, built around your brand.",
      price: "$25K+",
      priceQualifier: "custom",
      priceDisplay: "$25K+",
      altPrice: "Full cultural campaign",
      action: "booking",
      paymentLink: "",
      bookingLink: "",
      cta: "Request this package",
      description:
        "Branded music content, artist collaborations, event tie-ins, influencer distribution, and sponsor reporting.",
      features: ["Branded music content", "Artist collaborations", "Event / festival tie-ins", "Influencer distribution + reporting"]
    }
  ],
  checkout: {
    eyebrow: "",
    headline: "Tell us which package fits.",
    body: "Share a few details and the team routes you to the right scope and timeline.",
    submitCta: "Request this package",
    disclaimer: "Artist, manager, label, or brand: we match the offer to you."
  },
  fundingPromo: { enabled: false },
  faq: {
    eyebrow: "",
    headline: "Questions, answered.",
    items: [
      {
        question: "How do Minute of Music submissions work?",
        answer:
          "Send your name, handle, and a link to the track. If it's a fit, we book a shoot date, film your minute in one session, and release it on DMTV's channels with your track linked in the comments."
      },
      {
        question: "What does a feature cost?",
        answer:
          "Minute of Music features start at $300. Content packages run $1K to $5K, music videos from $5K, and brand campaigns are scoped custom."
      },
      {
        question: "Do I keep the rights to my music?",
        answer:
          "Yes. You keep your masters and publishing. DMTV holds distribution rights to the feature video itself so it can live on our channels."
      },
      {
        question: "How long until my video is released?",
        answer:
          "Most features release within two to three weeks of the shoot. Larger productions get a timeline in the proposal before anything is booked."
      },
      {
        question: "Do I need to be in Toronto?",
        answer:
          "Shoots run out of Toronto and the GTA. Remote and travel productions are possible for packages and campaigns; ask when you submit."
      },
      {
        question: "How does brand partnering work?",
        answer:
          "Brands live inside DMTV content through product placement, episode sponsorship, and artist integrations, not interruption ads. Every campaign ships with reporting."
      }
    ]
  },
  contractorSettings: {
    serviceAreas: ["Toronto", "GTA", "Remote"],
    defaultCapacityNotes:
      "Track artist features, production crews, sponsor placements, and campaign assignments here."
  },

  // ---------------------------------------------------------------------------
  // Showcase-template content. Read with defensive defaults in components
  // (tenant.showcase?.x) — this block is not walked by tenant sanitization.
  // ---------------------------------------------------------------------------
  showcase: {
    // Video examples wall: exactly as many cells as real assets.
    videoWall: {
      headline: "Video examples",
      body: "Interviews, live sets, and behind-the-scenes from the DMTV channels.",
      primary: {
        videoId: "HrPVuOFeL2Y",
        title: "Maxim Bayarsky x Lil Esso",
        caption: "On building DMTV and the future of digital music."
      },
      tiles: [
        {
          type: "reel",
          code: "DPPM_tegXLV",
          title: "Behind the scenes",
          caption: "On set with babey8lue."
        },
        {
          type: "channel",
          url: "https://www.youtube.com/@DMTVyt",
          title: "More on YouTube",
          caption: "Full features, sets, and interviews on @DMTVyt."
        }
      ]
    },
    // The signature series + submission form.
    minuteOfMusic: {
      eyebrow: "The Series",
      headline: "A Minute of Music",
      body:
        "One minute, one take, one artist. We shoot it, we post it, your track goes in the comments. This is how the next generation gets found.",
      reels: [
        { code: "DLdeWQDSwt8", artist: "@raquelllofficial" },
        { code: "DHbdneaRZDb", artist: "@princedawwn" },
        { code: "DH1D0u-xjAM", artist: "@lostatsleep" },
        { code: "DFf1ffSxQdv", artist: "@aidanskira" }
      ],
      form: {
        headline: "Submit your minute.",
        body: "Tell us who you are and where the track lives. The team reviews every submission.",
        submitCta: "Submit your minute"
      }
    },
    // Full-width live band: the Underground Showcase concert.
    live: {
      headline: "DMTV Underground Showcase",
      body: "Full concert, shot live in Toronto. This is what the network sounds like in a room.",
      videoId: "T_xIf3tkGls",
      note: "Recorded at Revival Bar, Toronto."
    },
    about: {
      eyebrow: "",
      headline: "Who is DMTV?",
      paragraphs: [
        "DMTV is a Toronto music media company founded by Maxim Bayarsky. What started as a production outfit became a network: a place where emerging artists get their first feature, their first press, and their first stage.",
        "Today DMTV runs A Minute of Music, produces music videos and artist content, throws the Underground Showcase, and builds cultural campaigns for brands that want in on the culture instead of around it."
      ],
      stats: [
        { value: "3M+", label: "series views" },
        { value: "10K", label: "avg / video" },
        { value: "110K", label: "monthly reach" }
      ]
    },
    // Short films strip: content categories (not invented titles) until the
    // team supplies real posters/stills.
    films: {
      eyebrow: "In Production",
      headline: "Short films and such",
      body: "Original films and longer cuts from inside the network, rolling out on the channel.",
      channelUrl: "https://www.youtube.com/@DMTVyt",
      strips: [
        { label: "Artist documentaries", seed: "dmtv-artist-doc" },
        { label: "Studio sessions", seed: "dmtv-studio-session" },
        { label: "Event recaps", seed: "dmtv-event-recap" },
        { label: "Original shorts", seed: "dmtv-original-short" }
      ]
    },
    partnering: {
      headline: "Brand partnering",
      body:
        "Your brand inside music culture: product placement, episode sponsorship, artist integrations, and custom campaigns with real reporting.",
      form: {
        submitCta: "Start a partnership"
      }
    },
    team: {
      eyebrow: "Join the Team",
      headline: "Apply to be a part of DMTV.",
      body: "The network runs on people who want to build it. Pick your lane.",
      tracks: [
        {
          id: "sales",
          label: "Sales",
          blurb: "Bring brands, sponsors, and artists into the network. Commission-forward, relationship-driven."
        },
        {
          id: "production",
          label: "Production",
          blurb: "Shooters, editors, directors, and producers for features, videos, and live shows."
        },
        {
          id: "casting",
          label: "Casting",
          blurb: "On-camera talent and actors for shorts, skits, and original films."
        }
      ],
      form: {
        headline: "Apply for a role.",
        submitCta: "Apply for this role"
      }
    },
    footer: {
      blurb: "Digital Music Entertainment. Toronto.",
      links: [
        { label: "Instagram", url: "https://www.instagram.com/dmtv/" },
        { label: "TikTok", url: "https://www.tiktok.com/@dmtv.22" },
        { label: "YouTube", url: "https://www.youtube.com/@DMTVyt" },
        { label: "dmtv.ca", url: "https://www.dmtv.ca/" }
      ]
    }
  }
});
