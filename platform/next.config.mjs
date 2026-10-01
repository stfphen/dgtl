import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  output: "standalone",
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
      }
    ];
  }
};

export default nextConfig;
