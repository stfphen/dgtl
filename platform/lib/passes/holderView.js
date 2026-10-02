// DGTL Pass — everything the holder's pages need for one credential: the pass
// page (/p/<credential>) and its Wallet routes share this, so a pass that the
// page would refuse can never be added to Wallet either.

import { getTenantByIdOrSlug } from "../store.js";
import { passesConfig } from "./config.js";
import { CREDENTIAL_LENGTH, credentialUrl, normalizeCode } from "./credentials.js";
import { passSettingsForTenant } from "./settings.js";
import { getPassForHolder } from "./store.js";
import { resolvePassDesign } from "./tiers.js";
import { describeValidity } from "./validity.js";

// The QR shows only while a pass can be used, or is about to be. A dead code
// is never put on a screen that could be waved at a busy door.
export const SHOWS_CODE = new Set(["active", "scheduled"]);

/** Returns null for anything that is not a live credential: the caller renders one identical 404. */
export async function loadHolderPass(rawCredential) {
  const config = passesConfig();
  if (!config.enabled) return null;
  const credential = normalizeCode(decodeURIComponent(String(rawCredential || "")));
  if (!credential || credential.length !== CREDENTIAL_LENGTH) return null;
  const found = await getPassForHolder(credential);
  if (!found) return null;
  const tenant = await getTenantByIdOrSlug(found.pass.tenantId);
  const settings = passSettingsForTenant(tenant || {});
  const design = resolvePassDesign(found.passType, settings.brandKit);
  const validity = describeValidity(found.pass, settings);
  return {
    ...found,
    credential,
    config,
    settings,
    kit: settings.brandKit,
    design,
    validity,
    passPageUrl: credentialUrl(config.baseUrl, credential)
  };
}
