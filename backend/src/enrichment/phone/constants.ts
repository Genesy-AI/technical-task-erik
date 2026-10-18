// Dependency-free on purpose: imported by both the Temporal workflow sandbox and Node activities.

export const PHONE_PROVIDER_IDS = ['orionConnect', 'astraDialer', 'nimbusLookup'] as const
export type PhoneProviderId = (typeof PHONE_PROVIDER_IDS)[number]

/** Waterfall order: best data first, then fastest, then the newcomer. */
export const PHONE_PROVIDER_ORDER: readonly PhoneProviderId[] = [
  'orionConnect',
  'astraDialer',
  'nimbusLookup',
]

/**
 * Per-attempt HTTP timeout. Orion answers in ~4s when healthy, Astra ~1s, Nimbus ~2s.
 * The activity startToCloseTimeout adds a small margin on top so the fetch aborts first.
 */
export const PHONE_PROVIDER_TIMEOUT_MS: Record<PhoneProviderId, number> = {
  orionConnect: 8_000,
  astraDialer: 3_000,
  nimbusLookup: 5_000,
}

export const PHONE_PROVIDER_ERROR_TYPES = {
  /** 5xx, network error, timeout, unparsable body: worth retrying. */
  UNAVAILABLE: 'PhoneProviderUnavailable',
  /** 429: retry, honouring Retry-After when present. */
  RATE_LIMITED: 'PhoneProviderRateLimited',
  /** 4xx (bad credentials, missing input): retrying won't help. */
  REJECTED: 'PhoneProviderRejected',
} as const
