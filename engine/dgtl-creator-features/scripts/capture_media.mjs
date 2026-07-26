/**
 * capture_media.mjs — headless screenshot helper for PUBLIC pages.
 *
 * For social posts, reels and news articles that render with JavaScript, prefer the
 * Chrome browser tools (mcp__claude-in-chrome__navigate + screenshot) — they render the
 * page like a human sees it and use the environment you already have. Use this script for
 * batch-capturing simple public URLs, or when a headless pass is enough.
 *
 * NEVER use this to log in, pass a paywall/age-gate, or defeat a CAPTCHA. Public pages only.
 * Always attribute captured media (creator handle + source link) in the page caption/alt.
 *
 * Usage:
 *   node capture_media.mjs --jobs jobs.json
 *
 * jobs.json: [
 *   { "url": "https://…", "out": "/abs/path/assets/media/<slug>/work-1.png",
 *     "width": 1200, "height": 1500, "fullPage": false, "waitMs": 1500,
 *     "clip": { "x": 0, "y": 0, "width": 1080, "height": 1350 } }   // clip optional
 * ]
 *
 * Requires puppeteer-core + a Chromium. Resolution order for the browser binary:
 *   1. $PUPPETEER_EXECUTABLE_PATH
 *   2. @sparticuz/chromium (npm i @sparticuz/chromium puppeteer-core)
 *   3. common system paths (Chrome/Chromium)
 */
import fs from "node:fs";
import path from "node:path";

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

async function resolveExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return { path: process.env.PUPPETEER_EXECUTABLE_PATH, args: [] };
  try {
    const chromium = (await import("@sparticuz/chromium")).default;
    return { path: await chromium.executablePath(), args: chromium.args };
  } catch {}
  const guesses = [
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
    "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  for (const g of guesses) if (fs.existsSync(g)) return { path: g, args: [] };
  return null;
}

async function main() {
  const jobsPath = arg("--jobs");
  if (!jobsPath) { console.error("--jobs <jobs.json> is required"); process.exit(1); }
  const jobs = JSON.parse(fs.readFileSync(jobsPath, "utf-8"));

  const exe = await resolveExecutable();
  if (!exe) {
    console.error("No Chromium found. Set PUPPETEER_EXECUTABLE_PATH, or `npm i @sparticuz/chromium puppeteer-core`,\n" +
                  "or capture these pages with the Chrome browser tools instead (recommended for social/JS-heavy pages).");
    process.exit(3);
  }
  let puppeteer;
  try { puppeteer = (await import("puppeteer-core")).default; }
  catch { console.error("puppeteer-core not installed. Run: npm i puppeteer-core @sparticuz/chromium"); process.exit(3); }

  const browser = await puppeteer.launch({ executablePath: exe.path, args: [...exe.args, "--no-sandbox"], headless: true });
  for (const j of jobs) {
    try {
      const page = await browser.newPage();
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      await page.setViewport({ width: j.width || 1200, height: j.height || 1500, deviceScaleFactor: 2 });
      await page.goto(j.url, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise((r) => setTimeout(r, j.waitMs || 1500));
      fs.mkdirSync(path.dirname(j.out), { recursive: true });
      const opts = { path: j.out };
      if (j.clip) opts.clip = j.clip; else opts.fullPage = !!j.fullPage;
      await page.screenshot(opts);
      console.log("✓", j.out, "←", j.url);
      await page.close();
    } catch (e) {
      console.error("✗", j.url, "—", e.message);
    }
  }
  await browser.close();
}
main();
