import { ActivityFailure, log, proxyActivities, RetryPolicy } from '@temporalio/workflow'
import type * as activities from './activities'
import type { EmailVerificationStatus } from '../leads/emailVerificationStatus'

/**
 * Upper bound for a single call to the email provider. Slow providers must not hold a lead in PENDING
 * forever: after this timeout the attempt fails and is retried according to the policy below.
 */
export const VERIFY_EMAIL_START_TO_CLOSE_TIMEOUT = '5 seconds'

/** Bounded retries: worst case ~3 x 5s + 1s + 2s backoff before the lead is marked FAILED. */
export const VERIFY_EMAIL_RETRY_POLICY: RetryPolicy = {
  maximumAttempts: 3,
  initialInterval: '1 second',
  backoffCoefficient: 2,
}

const { verifyEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: VERIFY_EMAIL_START_TO_CLOSE_TIMEOUT,
  retry: VERIFY_EMAIL_RETRY_POLICY,
})

// Local DB write: retried more generously than the provider call, but still bounded.
const { setEmailVerificationStatus } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: { maximumAttempts: 5, initialInterval: '1 second', backoffCoefficient: 2 },
})

export type VerifyEmailWorkflowInput = {
  leadId: number
  email: string
}

export type EmailVerificationOutcome = Exclude<EmailVerificationStatus, 'PENDING'>

/**
 * Verifies a lead's email and persists the outcome. Expects the lead to already be PENDING.
 * A provider that keeps failing or timing out ends as FAILED rather than leaving the lead PENDING.
 */
export async function verifyEmailWorkflow({
  leadId,
  email,
}: VerifyEmailWorkflowInput): Promise<EmailVerificationOutcome> {
  let outcome: EmailVerificationOutcome
  try {
    outcome = (await verifyEmail(email)) ? 'VERIFIED' : 'INVALID'
  } catch (error) {
    if (!(error instanceof ActivityFailure)) throw error
    log.warn('Email verification failed after retries', { leadId, cause: error.cause?.message })
    outcome = 'FAILED'
  }

  await setEmailVerificationStatus(leadId, outcome)
  return outcome
}
