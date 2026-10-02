import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dev only: a phone on the same Wi-Fi loads the dev server by its LAN address
// (npm run demo:passes sets this). Production ignores allowedDevOrigins.
const devOrigins = (process.env.NEXT_DEV_ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);

const nextConfig = {
  output: "standalone",
  ...(devOrigins.length ? { allowedDevOrigins: devOrigins } : {}),
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Conservative baseline only. A route-aware Content-Security-Policy
          // and HSTS are deliberate follow-ups once dgtl.chat HTTPS is stable —
          // a global CSP would have to account for tenant YouTube embeds and
          // the sandboxed artifact preview iframe, so it is not rushed in here.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // SAMEORIGIN (not DENY) because the generation-job review page frames
          // the sandboxed artifact preview from this same origin.
          { key: "X-Frame-Options", value: "SAMEORIGIN" }
        ]
      },
      {
        // DGTL Pass holder pages: the URL is the credential, so it must never
        // be cached, indexed, or leaked to another site in a Referer header.
        source: "/p/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" }
        ]
      }
    ];
  }
};

export default nextConfig;
