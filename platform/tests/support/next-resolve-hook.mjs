// Node ESM resolves neither Next's extensionless entry points ("next/server",
// "next/navigation", "next/headers") nor the extensionless relative imports
// ("../../lib/audit") that Next's bundler accepts in route files. Tests that
// import route handlers or server helpers directly register this hook first:
//   import { register } from "node:module";
//   register("./support/next-resolve-hook.mjs", import.meta.url);
const NEXT_ENTRIES = new Set(["next/server", "next/navigation", "next/headers", "next/cache"]);
const HAS_EXTENSION = /\.[cm]?[jt]sx?$|\.json$/;

export async function resolve(specifier, context, nextResolve) {
  if (NEXT_ENTRIES.has(specifier)) return nextResolve(`${specifier}.js`, context);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !HAS_EXTENSION.test(specifier)) {
    for (const candidate of [`${specifier}.js`, `${specifier}/index.js`]) {
      try {
        return await nextResolve(candidate, context);
      } catch {
        // try the next candidate
      }
    }
  }
  return nextResolve(specifier, context);
}
