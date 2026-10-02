// Throwaway certificates shaped like Apple's: a "WWDR" CA, and a Pass Type ID
// signer whose subject carries UID=<pass type id> and OU=<team id>, exactly
// as the Apple Developer portal issues them. OpenSSL makes them, and OpenSSL
// later verifies our signature: an independent implementation, not our own.
// iOS will not install a pass signed with these (wrong root); that is the point.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const TEST_PASS_TYPE_ID = "pass.test.dgtl";
export const TEST_TEAM_ID = "TEAM123456";

export const opensslAvailable = spawnSync("openssl", ["version"], { encoding: "utf8" }).status === 0;

function openssl(args, cwd) {
  const result = spawnSync("openssl", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`openssl ${args[0]} failed: ${result.stderr}`);
  return result.stdout;
}

export function makeAppleTestCerts({ passTypeId = TEST_PASS_TYPE_ID, teamId = TEST_TEAM_ID } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "dgtl-pass-certs-"));
  openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "wwdr.key", "-out", "wwdr.pem", "-days", "2", "-subj", "/CN=Test WWDR G4/O=Test CA/C=CA"], dir);
  openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "other.key", "-out", "other.pem", "-days", "2", "-subj", "/CN=Some Other CA/C=CA"], dir);
  openssl(["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "signer.key", "-out", "signer.csr", "-subj", `/UID=${passTypeId}/CN=Pass Type ID: ${passTypeId}/OU=${teamId}/O=DGTL Test/C=CA`], dir);
  openssl(["x509", "-req", "-in", "signer.csr", "-CA", "wwdr.pem", "-CAkey", "wwdr.key", "-CAcreateserial", "-out", "signer.pem", "-days", "2"], dir);
  const b64 = (file) => readFileSync(path.join(dir, file)).toString("base64");
  return {
    dir,
    env: {
      PASSKIT_TEAM_ID: teamId,
      PASSKIT_PASS_TYPE_ID: passTypeId,
      PASSKIT_SIGNER_CERT_B64: b64("signer.pem"),
      PASSKIT_SIGNER_KEY_B64: b64("signer.key"),
      PASSKIT_WWDR_CERT_B64: b64("wwdr.pem")
    },
    otherCaB64: b64("other.pem"),
    otherKeyB64: b64("other.key"),
    // Verify a detached CMS signature over `content` against the test WWDR.
    verify(signature, content) {
      const work = mkdtempSync(path.join(dir, "verify-"));
      const sig = path.join(work, "signature");
      const body = path.join(work, "manifest.json");
      writeFileSync(sig, signature);
      writeFileSync(body, content);
      const result = spawnSync("openssl", ["cms", "-verify", "-inform", "DER", "-binary", "-in", sig, "-content", body, "-CAfile", path.join(dir, "wwdr.pem"), "-purpose", "any", "-out", os.devNull], { encoding: "utf8" });
      return { ok: result.status === 0, output: `${result.stdout}${result.stderr}`.trim() };
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}
