import { ActivityFailure, log, proxyActivities, RetryPolicy, workflowInfo } from '@temporalio/workflow'
import type * as activities from './activities'
import {
  PHONE_PROVIDER_ERROR_TYPES,
  PHONE_PROVIDER_TIMEOUT_MS,
  PhoneProviderId,
  phoneProviderTaskQueue,
} from '../enrichment/phone/constants'

/** Bounded retries per provider: 3 attempts with 1s → 2s backoff. A 429's Retry-After overrides the delay. */
export const PHONE_PROVIDER_RETRY_POLICY: RetryPolicy = {
  maximumAttempts: 3,
  initialInterval: '1 second',
  backoffCoefficient: 2,
  maximumInterval: '30 seconds',
  nonRetryableErrorTypes: [PHONE_PROVIDER_ERROR_TYPES.REJECTED],
}

/** Margin on top of the HTTP timeout so the fetch aborts (and reports why) before Temporal gives up. */
const ACTIVITY_TIMEOUT_MARGIN_MS = 2_000

/**
 * Upper bound for one provider including retries and time spent queued behind its rate limit. When the
 * provider is throttled this hard, we move on to the next one instead of holding the lead in PENDING.
 */
const PROVIDER_SCHEDULE_TO_CLOSE = '5 minutes'

const { planPhoneEnrichment, reportPhoneEnrichmentProgress, completePhoneEnrichment } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '10 seconds',
  retry: { maximumAttempts: 5, initialInterval: '1 second', backoffCoefficient: 2 },
})

function lookupPhoneOn(providerId: PhoneProviderId) {
  return proxyActivities<typeof activities>({
    taskQueue: phoneProviderTaskQueue(workflowInfo().taskQueue, providerId),
    startToCloseTimeout: PHONE_PROVIDER_TIMEOUT_MS[providerId] + ACTIVITY_TIMEOUT_MARGIN_MS,
    scheduleToCloseTimeout: PROVIDER_SCHEDULE_TO_CLOSE,
    retry: PHONE_PROVIDER_RETRY_POLICY,
  }).lookupPhone
}

export type EnrichPhoneWorkflowInput = { leadId: number }
export type EnrichPhoneWorkflowResult = activities.PhoneEnrichmentOutcome | { status: 'LEAD_NOT_FOUND' }

/**
 * Waterfall phone lookup: query providers in order and stop at the first phone found.
 *
 * Outcome: FOUND, NOT_FOUND when every queried provider answered without data, or FAILED when at least one
 * provider kept erroring (so a retry may still find a phone). Expects the lead to already be PENDING.
 */
export async function enrichPhoneWorkflow({
  leadId,
}: EnrichPhoneWorkflowInput): Promise<EnrichPhoneWorkflowResult> {
  const plan = await planPhoneEnrichment(leadId)
  if (!plan) {
    log.warn('Lead disappeared before phone enrichment', { leadId })
    return { status: 'LEAD_NOT_FOUND' }
  }
  for (const { providerId, reason } of plan.skipped) {
    log.info('Skipping phone provider', { leadId, providerId, reason })
  }

  let anyProviderFailed = false
  for (const providerId of plan.providers) {
    await reportPhoneEnrichmentProgress(leadId, providerId)
    try {
      const result = await lookupPhoneOn(providerId)(providerId, plan.input)
      if (result.status === 'found') {
        const outcome = { status: 'FOUND', phoneNumber: result.phone, provider: providerId } as const
        await completePhoneEnrichment(leadId, outcome)
        return outcome
      }
    } catch (error) {
      if (!(error instanceof ActivityFailure)) throw error
      log.warn('Phone provider failed after retries', { leadId, providerId, cause: error.cause?.message })
      anyProviderFailed = true
    }
  }

  const outcome = { status: anyProviderFailed ? 'FAILED' : 'NOT_FOUND' } as const
  await completePhoneEnrichment(leadId, outcome)
  return outcome
}
