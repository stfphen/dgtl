import { headers } from "next/headers";
import { notFound } from "next/navigation";
import DgtlWordmark from "../../../components/brand/DgtlWordmark";
import { cardArtSvg, SPARK, sparkSvg, svgDataUri } from "../../../lib/passes/art";
import { formatShortCode } from "../../../lib/passes/credentials";
import { loadHolderPass, SHOWS_CODE } from "../../../lib/passes/holderView";
import { qrDataUri } from "../../../lib/passes/qr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The title names the brand, never the holder: titles leak into history,
// tab switchers and screenshots.
export async function generateMetadata({ params }) {
  const { credential } = await params;
  const view = await loadHolderPass(credential).catch(() => null);
  return { title: `${view?.kit.name || "DGTL"} pass` };
}

const STATE_COPY = {
  expired: (v) => ({ pill: "Expired", title: `This pass expired on ${v.validity.untilShort}.` }),
  used: () => ({ pill: "Used", title: "This pass has been used." }),
  revoked: () => ({ pill: "Revoked", title: "This pass is no longer valid." }),
  suspended: () => ({ pill: "On hold", title: "This pass is on hold.", warning: true })
};

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.37 12.62c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-2.99-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.88 1.15 9.13.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.22.87-1.28 1.23-2.51 1.25-2.58-.03-.01-2.39-.92-2.4-3.66zM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.02.61-2.67 1.37-.58.67-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.28z" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M2.5 9.5h19M16 14.5h2.5" />
    </svg>
  );
}

export default async function HolderPassPage({ params, searchParams }) {
  const { credential } = await params;
  const query = await searchParams;
  const view = await loadHolderPass(credential);
  if (!view) notFound();

  const { pass, passType, holder, design, validity, kit, status, config } = view;
  const showCode = SHOWS_CODE.has(status);
  const tierLabel = design.isVip ? "VIP · Lifetime" : [design.materialLabel, passType.name].filter(Boolean).join(" · ");
  const cardStyle = { "--face": design.face, "--line": design.faceLine, "--acc": design.accentOnFace };
  const art = svgDataUri(cardArtSvg(design, SPARK));
  const watermark = svgDataUri(sparkSvg(design.accent));
  const qr = showCode ? await qrDataUri(view.passPageUrl) : null;
  const state = showCode ? null : STATE_COPY[status]?.(view) || STATE_COPY.revoked(view);

  // Offer the wallet that matches the device; a desktop sees both.
  const ua = (await headers()).get("user-agent") || "";
  const apple = /iPhone|iPad|iPod|Macintosh/.test(ua);
  const android = /Android/.test(ua);
  const walletOn = showCode && config.walletEnabled;
  // A hosted provider issues one pass for both wallets; DGTL's own Apple
  // certificate signs Apple Wallet only (Google Wallet is roadmap R2).
  const googleOn = walletOn && config.wallet.provider === "walletwallet";
  const year = new Date().getFullYear();

  return (
    <>
      <img className="pp-watermark" src={watermark} alt="" />
      <div className="pp-vignette" />
      <header className="pp-bar">
        <DgtlWordmark className="pp-wordmark" title={kit.name} />
        <span className="pp-chip" style={{ "--tier": design.accentText }}>{design.isVip ? "VIP" : design.materialLabel || passType.name}</span>
      </header>

      <main className="pp">
        <article className={`pcard${showCode ? "" : " is-void"}`} style={cardStyle} aria-label={`${kit.name} ${passType.name}`}>
          <div className="pc-top">
            <DgtlWordmark className="pp-wordmark" />
            {kit.walletLogoText ? <span className="pc-lock">{kit.walletLogoText}</span> : null}
            <span className="pc-tier">{tierLabel}</span>
          </div>
          <img className="pc-art" src={art} alt="" width="750" height="240" />
          <div className="pc-body">
            <div>
              <span className="pc-l">{design.isVip ? "Member" : "Holder"}</span>
              <span className="pc-name">{holder.name}</span>
            </div>
            <div className="pc-fields">
              <div>
                <span className="pc-l">{status === "scheduled" ? "Starts" : "Pass"}</span>
                <span className="pc-v">{status === "scheduled" ? validity.fromDate : passType.name}</span>
              </div>
              <div>
                <span className="pc-l">{status === "expired" ? "Expired" : validity.lifetime ? "Expires" : "Valid until"}</span>
                <span className="pc-v">{validity.untilShort}</span>
              </div>
            </div>
            {showCode ? (
              <div className="pp-code">
                <div className="qr-tile">
                  <img src={qr} alt="Pass QR code" width="248" height="248" />
                </div>
                <span className="pp-shortcode" aria-label="Pass code">{formatShortCode(pass.shortCode)}</span>
              </div>
            ) : null}
          </div>
        </article>

        {state ? (
          <section className="pp-state" aria-live="polite">
            <span className={`pp-pill${state.warning ? " is-warning" : ""}`}>{state.pill}</span>
            <h2>{state.title}</h2>
            <p>The code is hidden so it can't be used at the door. To renew or ask a question, contact {kit.name}.</p>
            {kit.legal.supportEmail ? <p><a href={`mailto:${kit.legal.supportEmail}`}>{kit.legal.supportEmail}</a></p> : null}
          </section>
        ) : (
          <div className="pp-actions">
            {query?.wallet === "unavailable" ? (
              <p className="pp-notice" role="status">Wallet is unavailable right now. Your pass still works: show this page at the door.</p>
            ) : null}
            {walletOn && (apple || !android) ? (
              <a className="pp-wallet" href={`/p/${view.credential}/wallet.pkpass`}>
                <AppleIcon /> Add to Apple Wallet
              </a>
            ) : null}
            {googleOn && (android || !apple) ? (
              <a className="pp-wallet" href={`/p/${view.credential}/google-wallet`} rel="noreferrer">
                <WalletIcon /> Save to Google Wallet
              </a>
            ) : null}
            <p className="pp-tip">Turn your brightness up at the door.</p>
          </div>
        )}

        <footer className="pp-foot">
          {kit.legal.supportUrl || kit.legal.termsUrl ? (
            <span>
              {kit.legal.supportUrl ? <a href={kit.legal.supportUrl}>Help</a> : null}
              {kit.legal.supportUrl && kit.legal.termsUrl ? " · " : null}
              {kit.legal.termsUrl ? <a href={kit.legal.termsUrl}>Terms</a> : null}
            </span>
          ) : null}
          <span>© {year} {kit.name}. All rights reserved.</span>
        </footer>
      </main>
    </>
  );
}
