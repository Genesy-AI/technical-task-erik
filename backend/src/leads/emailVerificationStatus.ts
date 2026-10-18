import type { EmailVerificationStatus } from '@prisma/client'

// Type-only import: this module is also used from Temporal workflow code, which runs in a sandbox and must
// not load the Prisma runtime.
export type { EmailVerificationStatus }

/** `null` means the email has never been verified. */
export type EmailVerificationState = EmailVerificationStatus | null

/**
 * Allowed transitions:
 *
 *   null ──► PENDING ──► VERIFIED | INVALID | FAILED
 *               ▲                    │
 *               └────────────────────┘  (retry / re-verify)
 *
 * PENDING → PENDING is intentionally not allowed: a lead that is already being verified must not be
 * queued again.
 */
const TRANSITIONS: Record<EmailVerificationStatus | 'NONE', readonly EmailVerificationStatus[]> = {
  NONE: ['PENDING'],
  PENDING: ['VERIFIED', 'INVALID', 'FAILED'],
  VERIFIED: ['PENDING'],
  INVALID: ['PENDING'],
  FAILED: ['PENDING'],
}

const ALL_STATES: readonly EmailVerificationState[] = [null, 'PENDING', 'VERIFIED', 'INVALID', 'FAILED']

export function canTransitionEmailVerification(
  from: EmailVerificationState,
  to: EmailVerificationStatus
): boolean {
  return TRANSITIONS[from ?? 'NONE'].includes(to)
}

/** States from which `to` can be reached; useful for guarded (compare-and-set) updates. */
export function emailVerificationSourceStates(to: EmailVerificationStatus): EmailVerificationState[] {
  return ALL_STATES.filter((from) => canTransitionEmailVerification(from, to))
}
