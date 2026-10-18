/** `null` means the email has never been verified. */
export type EmailVerificationStatus = 'PENDING' | 'VERIFIED' | 'INVALID' | 'FAILED'

/** `null` means phone enrichment has never run. */
export type PhoneEnrichmentStatus = 'PENDING' | 'FOUND' | 'NOT_FOUND' | 'FAILED'

export type PhoneProviderId = 'orionConnect' | 'astraDialer' | 'nimbusLookup'

export type LeadsGetManyInput = undefined

export type LeadsGetManyOutput = {
  id: number
  createdAt: string
  updatedAt: string
  firstName: string
  lastName: string | null
  email: string | null
  jobTitle: string | null
  countryCode: string | null
  companyName: string | null
  message: string | null
  emailVerificationStatus: EmailVerificationStatus | null
  phoneNumber: string | null
  yearsAtCompany: number | null
  linkedinUrl: string | null
  companyWebsite: string | null
  phoneEnrichmentStatus: PhoneEnrichmentStatus | null
  /** While PENDING: provider being queried. When FOUND: provider that found the phone. */
  phoneEnrichmentProvider: PhoneProviderId | null
}[]

export type Lead = LeadsGetManyOutput[number]
