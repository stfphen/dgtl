// DGTL Pass — default email + SMS copy per variant.
//
// Every string here is a *default*. A pass type can override any key in its
// `email.copy` / `sms.copy` JSON, so a tenant rewrites the voice without a
// deploy. Placeholders are filled by fill(), which HTML-escapes nothing (the
// renderer escapes the result).
//
// Placeholders: {brand} {firstName} {holderName} {passName} {fromDate} {from}
//               {until} {untilShort} {senderName} {senderTitle}
//
// House rules for this copy (09-brand-and-tiers.md §Voice):
//   - Promise only what the system enforces. No "skip the line" unless a perk says so.
//   - One idea per sentence. No exclamation marks. No emoji in SMS (keeps GSM-7, 160 chars).
//   - Tiers get warmer as they climb: Day is practical, VIP is personal.
//   - CTAs end in "→" (a DGTL brand-kit tic). The renderer adds it if an
//     override forgets, and strips it from the plain-text part.

export const EMAIL_COPY = Object.freeze({
  day: {
    subject: "Your {brand} pass for {fromDate}",
    preheader: "Show it at the door from this email, your pass page, or Apple Wallet.",
    eyebrow: "Day pass",
    headline: "You're in, {firstName}.",
    body: "You're set for {fromDate}. Show the code below at the door. It works from this email, from your pass page, or from Apple Wallet.",
    cta: "Open my pass →",
    tip: "At the door: open your pass and turn your screen brightness up. Apple Wallet is the fastest way in.",
    reason: "You're receiving this because a {brand} pass was issued to this address."
  },
  monthly: {
    subject: "Your {brand} Monthly Pass is active",
    preheader: "Active now. {until}.",
    eyebrow: "Monthly pass",
    headline: "A month of access starts now.",
    body: "{firstName}, your {passName} is active. Keep it in Apple Wallet and it's one tap away every time you arrive.",
    cta: "Open my pass →",
    tip: "Your pass works every visit until it ends. Add it to Wallet once and you won't need this email again.",
    reason: "You're receiving this because a {brand} pass was issued to this address."
  },
  yearly: {
    subject: "Welcome to your year, {firstName}",
    preheader: "Your {brand} Annual Pass is active. {until}.",
    eyebrow: "Annual pass",
    headline: "Your year starts today.",
    body: "Twelve months of access on one pass. Add it to Apple Wallet once and it stays with you all year.",
    cta: "Open my pass →",
    tip: "Your pass works every visit until it ends. Add it to Wallet once and you won't need this email again.",
    reason: "You're receiving this because a {brand} pass was issued to this address."
  },
  vip_lifetime: {
    subject: "{firstName}, your VIP Lifetime pass",
    preheader: "It carries your name, and it never expires.",
    eyebrow: "VIP · Lifetime",
    headline: "Access that doesn't expire.",
    body: "This pass is yours for good. It carries your name, it has no end date, and it lives in your Apple Wallet.",
    cta: "Open my VIP pass →",
    tip: "Keep it in Wallet. The code is yours alone, so please don't share screenshots of it.",
    closing: "Welcome in.",
    reason: "You're receiving this because {brand} issued you a VIP pass."
  },
  vip_onboarding: {
    subject: "{firstName}, you're on the list",
    preheader: "A private invitation from {brand}. Your VIP pass is inside.",
    eyebrow: "By invitation",
    headline: "The list is short. You're on it.",
    body: "{firstName}, we keep our VIP list small on purpose, and we've added you to it. Inside is a lifetime pass in your name, plus a welcome that's only for the people on this list.",
    offerLabel: "Your welcome",
    perksLabel: "What comes with it",
    cta: "Accept my VIP pass →",
    tip: "Your pass never expires and carries your name. It's yours alone, so please don't forward this email.",
    signoff: "{senderName}",
    signoffTitle: "{senderTitle}",
    reason: "You're receiving this invitation because {brand} added you to its VIP list."
  }
});

// SMS: one message, under 160 GSM-7 characters with a ~45-char link. First
// send to a number carries the opt-out line (carrier + A2P expectation).
export const SMS_COPY = Object.freeze({
  standard: "{brand}: your {passName} is ready. Show this at the door: {url}",
  vip: "{brand} VIP: {firstName}, your lifetime pass is live. Keep it in Wallet: {url}",
  optOutSuffix: " Reply STOP to opt out."
});

export function fill(template, vars) {
  return String(template ?? "").replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? "") : match
  );
}
