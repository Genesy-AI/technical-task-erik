import type { EmailVerificationStatus } from '../../leads/emailVerificationStatus'
import { transitionEmailVerificationStatus } from '../../leads/emailVerificationStore'

/** Persists the outcome of a verification and notifies subscribers (SSE clients) about the change. */
export async function setEmailVerificationStatus(
  leadId: number,
  status: Exclude<EmailVerificationStatus, 'PENDING'>
): Promise<void> {
  const updated = await transitionEmailVerificationStatus(leadId, status)
  if (!updated) {
    // The lead was deleted, or is no longer PENDING. Nothing to persist; retrying would not help.
    console.warn(`Skipped persisting email verification status ${status} for lead ${leadId}`)
  }
}
