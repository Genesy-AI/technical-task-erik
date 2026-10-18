import { PHONE_PROVIDER_TIMEOUT_MS, PhoneProviderId } from './constants'
import { asRecord, FetchFn, normalizePhone, postJson } from './http'
import { PhoneLookupInput, PhoneProvider, PhoneProviderCredentials, PhoneProvidersConfig } from './types'

function missing(fields: Record<string, string | null | undefined>): string[] {
  return Object.entries(fields)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name)
}

/** Orion Connect — best data, slow, flaky. Auth via `x-auth-me` header. */
function orionConnect({ baseUrl, apiKey }: PhoneProviderCredentials, fetchFn: FetchFn): PhoneProvider {
  return {
    id: 'orionConnect',
    missingInputs: (input) => missing({ fullName: input.fullName, companyWebsite: input.companyWebsite }),
    async lookup(input) {
      const data = await postJson(
        'orionConnect',
        {
          url: baseUrl,
          body: { fullName: input.fullName, companyWebsite: input.companyWebsite },
          headers: { 'x-auth-me': apiKey },
          timeoutMs: PHONE_PROVIDER_TIMEOUT_MS.orionConnect,
        },
        fetchFn
      )
      return normalizePhone(asRecord(data).phone)
    },
  }
}

/** Astra Dialer — fastest, worst data. Auth via `apiKey` header. */
function astraDialer({ baseUrl, apiKey }: PhoneProviderCredentials, fetchFn: FetchFn): PhoneProvider {
  return {
    id: 'astraDialer',
    missingInputs: (input) => missing({ email: input.email }),
    async lookup(input) {
      const data = await postJson(
        'astraDialer',
        {
          url: baseUrl,
          body: { email: input.email },
          headers: { apiKey },
          timeoutMs: PHONE_PROVIDER_TIMEOUT_MS.astraDialer,
        },
        fetchFn
      )
      return normalizePhone(asRecord(data).phoneNmbr)
    },
  }
}

/** Nimbus Lookup — newcomer. Auth via `api` query param. */
function nimbusLookup({ baseUrl, apiKey }: PhoneProviderCredentials, fetchFn: FetchFn): PhoneProvider {
  return {
    id: 'nimbusLookup',
    missingInputs: (input) => missing({ email: input.email, jobTitle: input.jobTitle }),
    async lookup(input) {
      const url = new URL(baseUrl)
      url.searchParams.set('api', apiKey)
      const data = asRecord(
        await postJson(
          'nimbusLookup',
          {
            url: url.toString(),
            body: { email: input.email, jobTitle: input.jobTitle },
            timeoutMs: PHONE_PROVIDER_TIMEOUT_MS.nimbusLookup,
          },
          fetchFn
        )
      )
      // Docs promise `number`; the live API answers `phoneNmbr` (a JSON number). Accept both.
      // `countryCode` (ISO alpha-2) is dropped until we store phones in E.164.
      return normalizePhone(data.number ?? data.phoneNmbr)
    },
  }
}

export function createPhoneProviders(
  config: PhoneProvidersConfig,
  fetchFn: FetchFn = fetch
): Record<PhoneProviderId, PhoneProvider> {
  return {
    orionConnect: orionConnect(config.orionConnect, fetchFn),
    astraDialer: astraDialer(config.astraDialer, fetchFn),
    nimbusLookup: nimbusLookup(config.nimbusLookup, fetchFn),
  }
}

export async function lookupWithProvider(provider: PhoneProvider, input: PhoneLookupInput) {
  const missingInputs = provider.missingInputs(input)
  if (missingInputs.length > 0) {
    return { status: 'skipped', reason: `missing ${missingInputs.join(', ')}` } as const
  }
  const phone = await provider.lookup(input)
  return phone ? ({ status: 'found', phone } as const) : ({ status: 'no_data' } as const)
}
