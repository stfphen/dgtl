// DGTL Pass — a .pkpass signed with DGTL's own Apple Pass Type ID certificate.
// This is the exact design: buildPassJson's per-tier layout, label colours and
// the brand-kit artwork (lib/passes/wallet/images.js), as in
// docs/specs/dgtl-pass/previews/wallet.html.
//
// A .pkpass is a ZIP of pass.json, the images, manifest.json (SHA-1 of every
// file) and `signature`: a detached CMS (PKCS#7) SignedData over manifest.json,
// signed by the Pass Type ID certificate and carrying Apple's WWDR intermediate.
// Built on Node's WebCrypto through pkijs; no node-forge.

import { createHash, webcrypto } from "node:crypto";
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";
import { appleImages } from "./images.js";
import { buildPassJson } from "./passJson.js";
import { zip } from "./zip.js";

const engine = new pkijs.CryptoEngine({ name: "node", crypto: webcrypto });
const OID = {
  data: "1.2.840.113549.1.7.1",
  signedData: "1.2.840.113549.1.7.2",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingTime: "1.2.840.113549.1.9.5"
};

const arrayBuffer = (buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

/** The detached CMS signature Wallet checks before it will add a pass. */
export async function signManifest(manifest, { signerCertDer, wwdrCertDer, privateKey, signingTime = new Date() }) {
  const signerCert = pkijs.Certificate.fromBER(arrayBuffer(signerCertDer));
  const wwdrCert = pkijs.Certificate.fromBER(arrayBuffer(wwdrCertDer));
  const key = await webcrypto.subtle.importKey(
    "pkcs8",
    privateKey.export({ format: "der", type: "pkcs8" }),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = createHash("sha256").update(manifest).digest();
  const signed = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({ eContentType: OID.data }),
    certificates: [signerCert, wwdrCert],
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({ issuer: signerCert.issuer, serialNumber: signerCert.serialNumber }),
        signedAttrs: new pkijs.SignedAndUnsignedAttributes({
          type: 0,
          attributes: [
            new pkijs.Attribute({ type: OID.contentType, values: [new asn1js.ObjectIdentifier({ value: OID.data })] }),
            new pkijs.Attribute({ type: OID.signingTime, values: [new asn1js.UTCTime({ valueDate: signingTime })] }),
            new pkijs.Attribute({ type: OID.messageDigest, values: [new asn1js.OctetString({ valueHex: arrayBuffer(digest) })] })
          ]
        })
      })
    ]
  });
  await signed.sign(key, 0, "SHA-256", undefined, engine);
  const contentInfo = new pkijs.ContentInfo({ contentType: OID.signedData, content: signed.toSchema(true) });
  return Buffer.from(contentInfo.toSchema().toBER(false));
}

const sha1 = (buffer) => createHash("sha1").update(buffer).digest("hex");

/**
 * The signed pass for a holder view (lib/passes/holderView.js).
 * apple: config.wallet.apple ({ teamId, passTypeId, signerCertDer, wwdrCertDer, privateKey }).
 */
export async function buildApplePass(view, apple, { now = new Date() } = {}) {
  const issuedLabel = new Intl.DateTimeFormat("en-CA", { timeZone: view.settings.timeZone, month: "short", day: "numeric", year: "numeric" }).format(
    new Date(view.pass.createdAt || now)
  );
  const json = buildPassJson({
    pass: view.pass,
    passType: view.passType,
    holder: view.holder,
    brandKit: view.kit,
    design: view.design,
    validity: view.validity,
    links: { credentialUrl: view.passPageUrl, passPageUrl: view.passPageUrl },
    wallet: { passTypeIdentifier: apple.passTypeId, teamIdentifier: apple.teamId },
    issuedLabel
  });
  const files = { "pass.json": Buffer.from(JSON.stringify(json)), ...(await appleImages(view.design)) };
  const manifest = Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(files).map(([name, data]) => [name, sha1(data)]))));
  const signature = await signManifest(manifest, { ...apple, signingTime: now });
  return zip({ ...files, "manifest.json": manifest, signature });
}
