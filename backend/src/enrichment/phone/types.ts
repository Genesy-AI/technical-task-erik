import type { PhoneProviderId } from './constants'

/** Provider-agnostic view of a lead. Each provider maps it to its own request shape. */
export interface PhoneLookupInput {
  fullName: string
  email: string
  jobTitle: string | null
  /** Bare domain, e.g. `acme.com`. See resolveCompanyWebsite. */
  companyWebsite: string | null
}

export type PhoneLookupResult =
  | { status: 'found'; phone: string }
  | { status: 'no_data' }
  | { status: 'skipped'; reason: string }

export interface PhoneProvider {
  readonly id: PhoneProviderId
  /**
   * Names of required inputs the lead is missing. Providers answer HTTP 400 when any is absent,
   * so we skip them instead of burning a call.
   */
  missingInputs(input: PhoneLookupInput): string[]
  /** Resolves to the phone found or null. Throws a Temporal ApplicationFailure on transport/API errors. */
  lookup(input: PhoneLookupInput): Promise<string | null>
}

export interface PhoneProviderCredentials {
  baseUrl: string
  apiKey: string
}

export type PhoneProvidersConfig = Record<PhoneProviderId, PhoneProviderCredentials>
