// Sample inputs for the email renderer: shared by email.test.js and preview.js.
// Every person, address and offer here is fictional sample content.

import { resolveBrandKit } from "../brand.js";
import { TIER_PRESETS, resolvePassDesign } from "../tiers.js";
import { computeValidityWindow, describeValidity } from "../validity.js";

export const SAMPLE_TENANT = {
  brand: { name: "DGTL", logoText: "DGTL", primaryColor: "#F0CF50" },
  passes: {
    timeZone: "America/Toronto",
    dayCutoffHour: 0,
    brandKit: {
      // Production: the media-library URL of assets/dgtl-wordmark@4x.png. The wordmark
      // spells the name, so Wallet omits logoText.
      logoUrl: "https://pass.example.com/assets/dgtl-wordmark@4x.png",
      logoIncludesName: true,
      // "DGTL⚡ PASS": the product lockup on Wallet and the email pass card.
      walletLogoText: "PASS",
      sender: { fromName: "DGTL", fromEmail: "passes@example.com" },
      legal: {
        postalAddress: "Sample address · Toronto, ON · Canada",
        supportEmail: "help@example.com"
      }
    }
  }
};

const BASE = "https://pass.example.com";

export const SAMPLES = {
  day: {
    presetId: "day_single",
    holder: { name: "Jordan Avery" },
    startDate: "2026-10-03",
    pass: { id: "pass_9d2e41", shortCode: "K7M2QX9P" }
  },
  monthly: {
    presetId: "monthly",
    holder: { name: "Maya Chen" },
    startDate: "2026-09-30",
    pass: { id: "pass_31ab07", shortCode: "Q4TN8WZ2" }
  },
  yearly: {
    presetId: "yearly",
    holder: { name: "Sam Okafor" },
    startDate: "2026-09-30",
    pass: { id: "pass_c81f5d", shortCode: "M3RX7HB9" }
  },
  vip_lifetime: {
    presetId: "vip_lifetime",
    holder: { name: "Alex Rivera" },
    startDate: "2026-09-30",
    pass: { id: "pass_0vip11", shortCode: "V1PG0LD8" }
  },
  vip_onboarding: {
    presetId: "vip_lifetime",
    holder: { name: "Alex Rivera" },
    startDate: "2026-09-30",
    pass: { id: "pass_0vip11", shortCode: "V1PG0LD8" }
  }
};

export const SAMPLE_VIP_PERKS = [
  { title: "Your name on the door", body: "No list check, no wait at the rope. Staff see VIP the moment you scan." },
  { title: "A guest, on us", body: "Bring one guest on any visit. We'll look after them like they're on the list too." },
  { title: "First word on everything", body: "New events and releases reach you before they're announced anywhere else." }
];

export const SAMPLE_OFFER = {
  title: "Your first night is on us",
  body: "Come in this month and your first round is covered. Just scan in and tell the bar you're new to the list.",
  code: "VIP-WELCOME",
  expiresLabel: "Sat, Oct 31, 2026",
  terms: "One per member. Sample offer for preview."
};

export function buildSample(variant, { qrImageUrl = `${BASE}/p/SAMPLE/qr.png`, walletBadgeUrl = "", marketingAllowed = true } = {}) {
  const sample = SAMPLES[variant];
  const preset = TIER_PRESETS[sample.presetId];
  const brandKit = resolveBrandKit(SAMPLE_TENANT);
  const passType = {
    name: preset.name,
    tier: preset.tier,
    isVip: preset.isVip,
    design: preset.design,
    perks: preset.isVip ? SAMPLE_VIP_PERKS : []
  };
  const window = computeValidityWindow({ rule: preset.validity, startDate: sample.startDate, timeZone: SAMPLE_TENANT.passes.timeZone });
  const pass = { ...sample.pass, maxUses: preset.usage.maxUses, ...window, status: "active" };
  const credentialPath = `${BASE}/p/${"0123456789ABCDEFGHJKMNPQRS"}`;
  return {
    variant,
    brandKit,
    design: resolvePassDesign(passType, brandKit),
    pass,
    passType,
    holder: sample.holder,
    validity: describeValidity(pass, { timeZone: SAMPLE_TENANT.passes.timeZone }),
    links: {
      passPageUrl: credentialPath,
      walletUrl: `${credentialPath}/wallet.pkpass`,
      qrImageUrl,
      passArtUrl: `${BASE}/passes/art/${sample.presetId}@2x.png`,
      preferencesUrl: `${BASE}/email/preferences?t=SAMPLE`,
      unsubscribeUrl: `${BASE}/email/unsubscribe?t=SAMPLE`
    },
    assets: { walletBadgeUrl },
    offer: variant === "vip_onboarding" ? SAMPLE_OFFER : null,
    sender: { name: "Alexis Marin", title: "VIP host (sample)" },
    year: 2026,
    marketingAllowed
  };
}
