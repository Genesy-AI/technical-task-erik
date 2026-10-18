import { config } from '../../config'
import { prisma } from '../../db'
import { resolveCompanyWebsite } from '../../enrichment/phone/companyWebsite'
import { PHONE_PROVIDER_ORDER, PhoneProviderId } from '../../enrichment/phone/constants'
import { createPhoneProviders, lookupWithProvider } from '../../enrichment/phone/providers'
import { PhoneLookupInput, PhoneLookupResult } from '../../enrichment/phone/types'
import { setPhoneEnrichmentProgress, transitionPhoneEnrichmentStatus } from '../../leads/phoneEnrichmentStore'

const phoneProviders = createPhoneProviders(config.phoneProviders)

export type PhoneEnrichmentPlan = {
  input: PhoneLookupInput
  /** Providers to query, in waterfall order. */
  providers: PhoneProviderId[]
  /** Providers left out because the lead lacks inputs they require. */
  skipped: Array<{ providerId: PhoneProviderId; reason: string }>
}

export type PhoneEnrichmentOutcome =
  | { status: 'FOUND'; phoneNumber: string; provider: PhoneProviderId }
  | { status: 'NOT_FOUND' | 'FAILED' }

/** Builds the provider-agnostic input and decides which providers can be queried. Null if the lead is gone. */
export async function planPhoneEnrichment(leadId: number): Promise<PhoneEnrichmentPlan | null> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) return null

  const input: PhoneLookupInput = {
    fullName: `${lead.firstName} ${lead.lastName}`.trim(),
    email: lead.email,
    jobTitle: lead.jobTitle,
    companyWebsite: resolveCompanyWebsite(lead),
  }

  const plan: PhoneEnrichmentPlan = { input, providers: [], skipped: [] }
  for (const providerId of PHONE_PROVIDER_ORDER) {
    const missingInputs = phoneProviders[providerId].missingInputs(input)
    if (missingInputs.length > 0) {
      plan.skipped.push({ providerId, reason: `missing ${missingInputs.join(', ')}` })
    } else {
      plan.providers.push(providerId)
    }
  }
  return plan
}

/** One provider call. Scheduled on the provider's own task queue so its rate limit applies. */
export async function lookupPhone(
  providerId: PhoneProviderId,
  input: PhoneLookupInput
): Promise<PhoneLookupResult> {
  return lookupWithProvider(phoneProviders[providerId], input)
}

export async function reportPhoneEnrichmentProgress(
  leadId: number,
  providerId: PhoneProviderId
): Promise<void> {
  await setPhoneEnrichmentProgress(leadId, providerId)
}

/** Persists the outcome (and the phone, when found) and notifies subscribers (SSE clients). */
export async function completePhoneEnrichment(
  leadId: number,
  outcome: PhoneEnrichmentOutcome
): Promise<void> {
  const updated =
    outcome.status === 'FOUND'
      ? await transitionPhoneEnrichmentStatus(leadId, 'FOUND', {
          phoneNumber: outcome.phoneNumber,
          provider: outcome.provider,
        })
      : await transitionPhoneEnrichmentStatus(leadId, outcome.status)

  if (!updated) {
    // The lead was deleted, or is no longer PENDING. Nothing to persist; retrying would not help.
    console.warn(`Skipped persisting phone enrichment outcome ${outcome.status} for lead ${leadId}`)
  }
}
