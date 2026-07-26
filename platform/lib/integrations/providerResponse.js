export function providerSuccess(provider, data, meta = {}) {
  return {
    ok: true,
    provider,
    configured: true,
    data,
    meta
  };
}

export function providerNotConfigured(provider, envName) {
  const error = `${envName} is not configured.`;
  return {
    ok: false,
    provider,
    configured: false,
    error,
    reason: error,
    data: null,
    meta: {}
  };
}

export function providerFailure(provider, error, meta = {}) {
  return {
    ok: false,
    provider,
    configured: true,
    error,
    reason: error,
    data: null,
    meta
  };
}
