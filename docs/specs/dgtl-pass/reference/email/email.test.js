import assert from "node:assert/strict";
import test from "node:test";
import { EMAIL_VARIANTS, renderPassEmail, renderPassSms, safeUrl, smsSegments } from "./render.js";
import { buildSample } from "./fixtures.js";
import { resolveBrandKit } from "../brand.js";

test("all five variants render, fill every placeholder, and are sendable", () => {
  assert.deepEqual(EMAIL_VARIANTS, ["day", "monthly", "yearly", "vip_lifetime", "vip_onboarding"]);
  for (const variant of EMAIL_VARIANTS) {
    const out = renderPassEmail(buildSample(variant));
    assert.equal(out.sendable, true, `${variant}: ${out.blockers.join(",")}`);
    assert.doesNotMatch(out.subject, /[{}]/, `${variant} subject`);
    assert.doesNotMatch(out.html, /\{(firstName|brand|passName|until|fromDate|senderName)\}/, `${variant} html`);
    assert.match(out.html, /^<!doctype html>/);
    assert.ok(out.html.includes("https://pass.example.com/p/"), `${variant} links the pass page`);
    assert.ok(out.text.includes("https://pass.example.com/p/"), `${variant} text part links the pass page`);
    assert.ok(out.html.includes("Sample address"), `${variant} identifies the sender`);
  }
});

test("standard emails print the QR and code; the invitation does not", () => {
  for (const variant of ["day", "monthly", "yearly", "vip_lifetime"]) {
    const out = renderPassEmail(buildSample(variant));
    assert.ok(out.html.includes("QR code for your pass"), variant);
    assert.ok(out.text.includes("Pass code:"), variant);
  }
  const invite = renderPassEmail(buildSample("vip_onboarding"));
  assert.ok(!invite.html.includes("QR code for your pass"));
  assert.ok(invite.html.includes("Accept my VIP pass"));
});

test("tier colors differ per variant and VIP gets the gold frame", () => {
  const accents = { day: "#A9B4C2", monthly: "#D29666", yearly: "#DCE1E8", vip_lifetime: "#F0CF50" };
  for (const [variant, accent] of Object.entries(accents)) {
    assert.ok(renderPassEmail(buildSample(variant)).html.includes(accent), variant);
  }
  assert.match(renderPassEmail(buildSample("vip_lifetime")).html, /class="container"[^>]+border:1px solid/);
  assert.doesNotMatch(renderPassEmail(buildSample("day")).html, /class="container"[^>]+border:1px solid/);
});

test("holder input is escaped everywhere", () => {
  const input = buildSample("day");
  input.holder = { name: `<script>alert("x")</script> O'Neil` };
  const out = renderPassEmail(input);
  assert.ok(!out.html.includes("<script>"));
  assert.ok(out.html.includes("&lt;script&gt;"));
  assert.ok(out.html.includes("O&#39;Neil"));
});

test("unsafe URLs are dropped, and a missing pass link blocks the send", () => {
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("http://example.com/x"), "");
  assert.equal(safeUrl("http://localhost:8088/p/X"), "http://localhost:8088/p/X");
  assert.equal(safeUrl("data:image/png;base64,AAAA"), "");
  assert.equal(safeUrl("data:image/png;base64,AAAA", { allowDataImages: true }), "data:image/png;base64,AAAA");
  const input = buildSample("monthly");
  input.links.passPageUrl = "javascript:alert(1)";
  const out = renderPassEmail(input);
  assert.equal(out.sendable, false);
  assert.ok(out.blockers.includes("missing_pass_page_url"));
  assert.ok(!out.html.includes("javascript:"));
});

test("no postal address or preferences link means no send (sender identification)", () => {
  const input = buildSample("yearly");
  input.brandKit = resolveBrandKit({});
  input.links.preferencesUrl = "";
  const out = renderPassEmail(input);
  assert.equal(out.sendable, false);
  assert.deepEqual(out.blockers.sort(), ["missing_postal_address", "missing_preferences_url"]);
});

test("the onboarding offer needs marketing consent; without it the invite still goes, minus the offer", () => {
  const withConsent = renderPassEmail(buildSample("vip_onboarding", { marketingAllowed: true }));
  assert.equal(withConsent.marketing, true);
  assert.ok(withConsent.html.includes("VIP-WELCOME"));
  assert.ok(withConsent.html.includes("Unsubscribe"));
  assert.equal(withConsent.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(withConsent.headers["List-Unsubscribe"], /^<https:\/\/.+>$/);

  const without = renderPassEmail(buildSample("vip_onboarding", { marketingAllowed: false }));
  assert.equal(without.sendable, true);
  assert.equal(without.marketing, false);
  assert.ok(!without.html.includes("VIP-WELCOME"));
  assert.ok(without.warnings.includes("offer_suppressed_no_marketing_consent"));
  assert.deepEqual(without.headers, {});

  const noUnsub = buildSample("vip_onboarding", { marketingAllowed: true });
  noUnsub.links.unsubscribeUrl = "";
  const blocked = renderPassEmail(noUnsub);
  assert.equal(blocked.sendable, false);
  assert.ok(blocked.blockers.includes("missing_unsubscribe_url"));
});

test("pass-type copy overrides replace the defaults", () => {
  const input = buildSample("monthly");
  input.passType.email = { copy: { headline: "Welcome to the {brand} studio, {firstName}." } };
  const out = renderPassEmail(input);
  assert.ok(out.html.includes("Welcome to the DGTL studio, Maya."));
});

test("the Apple badge placeholder is flagged until the official artwork is configured", () => {
  assert.ok(renderPassEmail(buildSample("day")).warnings.includes("wallet_badge_placeholder"));
  const withBadge = renderPassEmail(buildSample("day", { walletBadgeUrl: "https://pass.example.com/assets/add-to-apple-wallet.png" }));
  assert.ok(!withBadge.warnings.includes("wallet_badge_placeholder"));
});

test("SMS stays in one GSM-7 segment with a real-length link", () => {
  const brandKit = resolveBrandKit({});
  const url = "https://pass.example.com/p/0123456789ABCDEFGHJKMNPQRS";
  const standard = renderPassSms({ brandKit, passType: { name: "Monthly Pass" }, holder: { name: "Maya Chen" }, url });
  assert.equal(standard.encoding, "GSM-7");
  assert.equal(standard.segments, 1, `${standard.units} chars: ${standard.body}`);
  assert.ok(standard.body.endsWith("Reply STOP to opt out."));
  const vip = renderPassSms({ vip: true, brandKit, passType: { name: "VIP Lifetime" }, holder: { name: "Alex Rivera" }, url });
  assert.equal(vip.segments, 1, `${vip.units} chars: ${vip.body}`);
  assert.ok(vip.body.includes("Alex"));
  assert.equal(smsSegments("Your pass is ready 🎟️").encoding, "UCS-2");
  const emoji = renderPassSms({ brandKit, passType: { name: "Day ✨", sms: {} }, holder: { name: "A" }, url });
  assert.ok(emoji.warnings.includes("sms_not_gsm7"));
});
