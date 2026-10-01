# 11 · Admin: the Passes tab, and the holder pass page

## Placement

A ninth tab, **Passes** (lucide `Ticket` icon), in `components/admin/AdminTabbedShell.jsx`
`navItems`, visible when the session has `pass.view`. The panel is `PassesPanel`, loaded through
`components/admin/lazyPanels.jsx` (`ssr:false`) like the other off-default tabs. It fetches its own
data from the API. It does not add queries to the already-large server `page.jsx`.

Design targets: [`previews/admin.html`](previews/admin.html) (the tab) and
[`previews/pass-page.html`](previews/pass-page.html) (the holder page), both built to the DGTL
brand kit's app components (`engine/dgtl-brand-kit/references/ui-components.md`).

Styling comes only from `app/admin/dgtl-admin.css` tokens and primitives (`.button--primary`,
cards, tables, `.admin-notice`). The gold is `var(--blue)` there: the kit's alias layer, see its
`repo-surfaces.md`. Never write `var(--gold)` in `platform/`. Tier chips use the tier materials via
CSS custom properties set inline from the API (`style={{ "--tier": design.accent }}`) and render as
the kit's tint pill (`color-mix(in srgb, var(--tier) 12%, transparent)` background, tier text). No
hex literals go in components.

The kit's internal-tool register applies: **gold marks only the active nav item (tint + 2-px rail),
the active sub-tab underline, the headline KPI ("Active passes"), and the one primary action
("Issue pass →" / "Issue & send →")**. Everything else is white, `#D0D0D0` or `#8a8a8a`. Status
uses the functional badges (success / warning / error / info tint + text), never gold.

Inside the tab, sub-navigation uses segmented buttons in the same pattern as the other tabs:

```
Overview · Issue · Passes · Pass types · Scans
```

## Overview

```
┌ Tenant ▾ DGTL ───────────────────────────────────────────── [ Issue pass ] ┐
│  ACTIVE        ISSUED TODAY    SCANS TODAY     ADMITTED   DENIED   EXPIRING 7D  │
│  1,284         147             892             861        31       42 →         │
│                                                                              │
│  BY TIER   Steel ████████████ 610   Bronze ████████ 402                      │
│            Silver █████ 219         Gold ▌ 53                                │
│                                                                              │
│  LIVE SCANS                                                    ● auto-refresh │
│  21:15  ✓  Maya Chen        Monthly Pass    Main door     Door iPhone 2      │
│  21:14  ✕  Jordan Avery     Single Entry    Main door     used               │
│  21:12  !  Sam Okafor       Annual Pass     Side door     recently used      │
└──────────────────────────────────────────────────────────────────────────────┘
```

- KPI cards follow the kit: 12-px uppercase dim label, 38-px/800 tabular value, delta as a tiny
  success/error badge. Only "Active passes" is gold. Tiles are numbers in Manrope tabular figures. "Expiring 7D" links to the Passes list with that
  filter. That is the renewal list.
- Live scans poll `GET /api/admin/passes/overview` every 10 s while the tab is visible
  (`document.visibilityState`), with no websockets.
- Empty state for a tenant with passes not enabled: "Passes aren't set up for {tenant} yet" →
  **Set up passes**, a three-step checklist (timezone · postal address · first pass type).

## Issue

A single form with a live preview on the right (desktop) or below (mobile):

```
RECIPIENT                                   PREVIEW  [ Email ▾ | SMS | Wallet ]
Name*        [ Alex Rivera           ]      ┌──────────────────────────────┐
Email        [ alex@example.com      ]      │  (renderPassEmail output in   │
Phone        [ +1 416 555 0100       ]      │   an iframe, updates on edit) │
                                            │                              │
PASS                                        └──────────────────────────────┘
Type*        [ VIP Lifetime (Gold) ▾ ]      Blockers: none · Warnings: badge placeholder
Starts*      [ 2026-10-03 ]   → Never expires
                                            VIP list: 53 members  ← keeps "the list is short" honest
DELIVERY
☑ Email   ◉ VIP invitation  ○ Standard VIP email
☑ SMS
☐ This person agreed to receive offers      Note* [ Signed up at the bar 28 Sep ]
                                            (unticked → invitation sends without the offer)
OFFER (VIP invitation only; defaults from tenant)  ▸ edit

                                   [ Cancel ]   [ Issue & send ]
```

- `issueRequestId` is generated when the form mounts and regenerated only after a success. A
  double-click is safe.
- Phone input normalises to E.164 as you type (default country from the tenant's timezone
  region), and the preview shows the exact SMS with its character count.
- **The preview is the real renderer.** `POST /api/admin/passes/preview` (pass.issue) returns
  `renderPassEmail` output for unsaved input. The admin sees blockers (e.g. "Add a postal address
  in Brand kit") before sending, not after.
- Validity preview text comes from `describeValidity`, e.g. "Sat, Oct 3 · until Sun 4:00 AM"
  with a cutoff.

**After issue:** the form is replaced by a result card:

```
✓ PASS ISSUED                         Alex Rivera · VIP Lifetime · V1PG-0LD8
  Email  ✓ sent (VIP invitation, offer included)
  SMS    ✕ failed — Twilio: number not verified            [ Retry SMS ]
  [ View pass ]  [ Copy link ]  [ Download .pkpass ]  [ Issue another ]  [ Revoke ]
```

## Passes (list + drawer)

The table has columns Holder · Type (tier chip) · Status (effective) · Valid until · Uses · Last
scan · Issued. Filters: status, type, "expiring in 7 days", and search (name, email, phone, short
code). Cursor pagination, 50 rows per page. **Export CSV** requires `pass.export`.

The drawer (the same drawer component pattern as the lead pipeline) has four sections:

- **Header:** holder name, tier chip, effective status, short code.
- **Actions:** Resend (email/SMS), Copy link, Rotate code, Extend, Suspend/Reactivate, Revoke.
  Every destructive action goes through a confirm dialog with a reason field, and the reason lands
  in the audit log.
- **Timeline:** issue → deliveries (with provider status) → first view → scans (verdict, gate,
  verifier) → admin actions, interleaved by time.
- **Holder:** email, phone, consent state with source and date, suppression flags.

## Pass types

Cards per type (tier chip, name, validity rule, entry rule, active count), with **New pass type**
→ pick a preset → editor:

- name, description, validity count (or fixed window), entry (single / N / unlimited), cooldown
- design: accent (or "Use brand color"), Wallet background/text/label, strip/thumbnail image
  (media picker), with live contrast warnings from `resolvePassDesign`
- email: variant, copy overrides (headline, body, CTA; the rest behind "More"), perks (≤ 5)
- SMS on/off + copy override with a character counter

Archiving hides a type from Issue and keeps every issued pass working.

## Scans

The ledger table has columns Time · Result · Holder · Type · Gate · Verifier · Device · Input.
Filters: result, gate, verifier, date range. The top row shows the counts per result for the
filtered range. `not_found` rows show "unknown code" and, for owner/admin, the `internal_reason`
(e.g. `foreign_team`, `foreign_host`). These are useful for spotting a phishing or copy attempt.

## Brand kit (inside the existing Tenants tab)

A **Passes** section in the tenant editor, behind the same draft/publish flow as the rest of the
tenant config: enabled, timezone, day cutoff, gates, theme, colors (with defaults shown as
placeholders), email logo (media picker, PNG only), sender, legal (postal address is *required*),
default VIP offer, sign-off person. Validation lives in `lib/tenantValidation.js`.

## The holder pass page `/p/<credential>`

Server-rendered with the brand kit, mobile-first, and no client JS beyond one brightness hint.
Status drives the layout:

```
┌──────────────────────────────┐
│ DGTL                    VIP  │   brand wordmark / logo · tier chip
│                              │
│   Alex Rivera                │
│   VIP Lifetime · Never expires│
│  ┌────────────────────────┐  │
│  │      ▓▓ QR (white) ▓▓   │  │   QR 280px, 4-module quiet zone
│  └────────────────────────┘  │
│        V1PG-0LD8             │   short code (mono)
│   [ Show barcode instead ]   │   Code 128 toggle for old scanners
│                              │
│   [  Add to Apple Wallet  ]  │   iOS/macOS Safari only (official badge)
│   Turn your brightness up at │
│   the door.                  │
│  ─────────────────────────── │
│  ☐ Send me VIP offers        │   express consent (only if not already consented)
│  Help · Terms                │
└──────────────────────────────┘
```

- **Expired / used / revoked / suspended** passes show the state in plain words ("This pass
  expired on Thu, Oct 29") with **no QR**, so a dead code can't be waved at a busy door. Offer
  "Contact {brand}" (support link).
- **Scheduled** passes show the QR with "Valid from Sat, Oct 3", because holders want to add it to
  Wallet early.
- The page is `noindex, nofollow`, `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
  Its title is `{brand} pass`, never the holder's name, because titles leak into history and
  screenshots.
