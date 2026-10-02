// DGTL Pass — set up DGTL's own Apple Wallet signing in two steps.
//
//   npm run passkit:setup -- csr --email you@dgtl.ltd
//       Makes an RSA 2048 key and a certificate signing request in
//       platform/data/passkit/ (git-ignored). Upload passkit.csr in the Apple
//       Developer portal: Certificates → + → Pass Type ID Certificate.
//
//   npm run passkit:setup -- env --pass-type-id pass.io.dgtl.passes --team-id ABCDE12345
//       Reads the certificate Apple gives back (platform/data/passkit/pass.cer),
//       the key from step 1 and Apple's WWDR G4 intermediate (downloaded from
//       apple.com if it is not there yet), checks them exactly as the app will
//       at load, and writes the PASSKIT_* lines to platform/data/passkit/passkit.env.
//       Copy those into the production secrets store, never into a committed file.
//
// Needs the `openssl` command line (macOS and Linux ship it).

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPassesConfig } from "../lib/passes/config.js";

const dir = process.env.PASSKIT_SETUP_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/passkit");
const WWDR_URL = "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer";
const [command, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.map((arg, i) => (arg.startsWith("--") ? [arg.slice(2), rest[i + 1]] : null)).filter(Boolean));
const fail = (message) => {
  console.error(`\n[passkit:setup] ${message}\n`);
  process.exit(1);
};
const openssl = (args) => {
  const result = spawnSync("openssl", args, { cwd: dir, encoding: "utf8" });
  if (result.status !== 0) fail(`openssl ${args[0]} failed: ${result.stderr.trim()}`);
  return result.stdout;
};
const file = (name) => path.join(dir, name);

mkdirSync(dir, { recursive: true, mode: 0o700 });

if (command === "csr") {
  const email = flags.email;
  if (!email || !/^[^\s@]+@[^\s@]+$/.test(email)) fail("Pass your Apple account email: -- csr --email you@example.com");
  if (existsSync(file("passkit.key"))) fail(`${file("passkit.key")} already exists. Keep it: it is the only key that matches a certificate made from its CSR.`);
  openssl(["req", "-new", "-newkey", "rsa:2048", "-nodes", "-keyout", "passkit.key", "-out", "passkit.csr", "-subj", `/emailAddress=${email}/CN=DGTL Pass/C=CA`]);
  console.log(`
  Wrote ${file("passkit.key")} (private, git-ignored: back it up in the secrets store)
  and   ${file("passkit.csr")}.

  Next, in https://developer.apple.com/account/resources:
    1. Identifiers → + → Pass Type IDs → e.g. pass.io.dgtl.passes
    2. Certificates → + → Pass Type ID Certificate → that ID → upload passkit.csr
    3. Download the certificate and save it as ${file("pass.cer")}
  Then: npm run passkit:setup -- env --pass-type-id <id> --team-id <10-char Team ID>
`);
} else if (command === "env") {
  const passTypeId = flags["pass-type-id"];
  const teamId = flags["team-id"];
  if (!passTypeId || !teamId) fail("Pass both: -- env --pass-type-id pass.io.dgtl.passes --team-id ABCDE12345");
  for (const needed of ["passkit.key", "pass.cer"]) if (!existsSync(file(needed))) fail(`Missing ${file(needed)}. Run the csr step, then save Apple's certificate there.`);
  if (!existsSync(file("AppleWWDRCAG4.cer"))) {
    const response = await fetch(WWDR_URL);
    if (!response.ok) fail(`Could not download Apple's WWDR G4 from ${WWDR_URL}. Download it by hand into ${dir}.`);
    writeFileSync(file("AppleWWDRCAG4.cer"), Buffer.from(await response.arrayBuffer()));
  }
  // Apple ships both certificates as DER; the app reads base64 PEM.
  const toPem = (name) => (readFileSync(file(name), "utf8").includes("BEGIN CERTIFICATE") ? readFileSync(file(name), "utf8") : openssl(["x509", "-inform", "DER", "-in", name]));
  const env = {
    PASSKIT_TEAM_ID: teamId,
    PASSKIT_PASS_TYPE_ID: passTypeId,
    PASSKIT_SIGNER_CERT_B64: Buffer.from(toPem("pass.cer")).toString("base64"),
    PASSKIT_SIGNER_KEY_B64: readFileSync(file("passkit.key")).toString("base64"),
    PASSKIT_WWDR_CERT_B64: Buffer.from(toPem("AppleWWDRCAG4.cer")).toString("base64")
  };
  let config;
  try {
    config = readPassesConfig({ ...env, PASS_WALLET_PROVIDER: "apple" });
  } catch (error) {
    fail(`The files do not check out: ${error.message}`);
  }
  writeFileSync(file("passkit.env"), `# DGTL Pass: Apple Wallet signing. Secrets: never commit.\nPASS_WALLET_PROVIDER=apple\n${Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n")}\n`, { mode: 0o600 });
  console.log(`
  Checked: key matches certificate, Pass Type ID ${config.wallet.apple.passTypeId}, team ${config.wallet.apple.teamId},
  issued by the WWDR intermediate supplied, valid until ${config.wallet.apple.expiresAt}.

  Wrote ${file("passkit.env")}. Add those lines to the production secrets
  (and platform/.env for the demo), restart, and "Add to Apple Wallet" signs
  the DGTL design itself. Put a reminder in for the expiry date above.
`);
} else {
  fail("Usage: npm run passkit:setup -- csr --email <apple id email>   |   -- env --pass-type-id <id> --team-id <team>");
}
