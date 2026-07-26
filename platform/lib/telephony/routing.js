// Pure inbound-call routing. No I/O, no provider SDK — given a lead, the tenant
// telephony config, and the team's reps, decide where the call should go.
//
// MVP logic only:
//   1. lead.assignedToUserId  -> that rep's phone
//   2. routingMode "single_rep" -> defaultRepId's phone
//   3. else -> fallbackNumber
//   4. else -> voicemail (if enabled) or reject
//
// round_robin / team_ring / availability_based are TODO and currently fall back
// to single_rep behaviour.

/**
 * @param {object} lead
 * @param {object} tenantTelephony  normalized tenant.telephony config
 * @param {Array<object>} reps      team members (id, phoneNumber, ...)
 * @returns {{type:"rep"|"fallback"|"voicemail"|"reject", destinationNumber:(string|null), repId?:string, reason:string}}
 */
export function decideRoute(lead, tenantTelephony, reps = []) {
  const tel = tenantTelephony || {};
  const repList = Array.isArray(reps) ? reps : [];

  const findRepPhone = (repId) => {
    if (!repId) return null;
    const rep = repList.find(
      (candidate) =>
        candidate &&
        (candidate.id === repId || candidate.userId === repId || candidate.membershipId === repId)
    );
    const phone = rep?.phoneNumber || "";
    return phone ? { phone, repId } : null;
  };

  // 1. Lead's assigned owner takes precedence.
  const assigned = findRepPhone(lead?.assignedToUserId);
  if (assigned) {
    return { type: "rep", destinationNumber: assigned.phone, repId: assigned.repId, reason: "assigned_rep" };
  }

  // 2. single_rep default. Unimplemented modes fall back to this for now.
  const mode = tel.routingMode || "single_rep";
  const isStubMode = mode !== "single_rep";
  const fallbackReason = isStubMode ? `${mode}_todo_fallback_default_rep` : "default_rep";
  const defaultRep = findRepPhone(tel.defaultRepId);
  if (defaultRep) {
    return { type: "rep", destinationNumber: defaultRep.phone, repId: defaultRep.repId, reason: fallbackReason };
  }

  // 3. Tenant fallback number.
  if (tel.fallbackNumber) {
    return { type: "fallback", destinationNumber: tel.fallbackNumber, reason: "fallback_number" };
  }

  // 4. Voicemail or safe rejection.
  if (tel.voicemailEnabled) {
    return { type: "voicemail", destinationNumber: null, reason: "voicemail" };
  }
  return { type: "reject", destinationNumber: null, reason: "no_route" };
}
