import type { PhoneEnrichmentStatus } from '@prisma/client'

// Type-only import: this module is also used from Temporal workflow code, which runs in a sandbox and must
// not load the Prisma runtime.
export type { PhoneEnrichmentStatus }

/** `null` means phone enrichment has never run for the lead. */
export type PhoneEnrichmentState = PhoneEnrichmentStatus | null

/**
 * Allowed transitions:
 *
 *   null ──► PENDING ──► FOUND | NOT_FOUND | FAILED
 *               ▲             │        │          │
 *               └─────────────┴────────┴──────────┘  (retry, only while the lead has no phone)
 *
 * We never overwrite a phone we already have: entering PENDING additionally requires an empty phone (see
 * phoneEnrichmentStore), so FOUND is final unless the phone is later removed. PENDING → PENDING is not
 * allowed so a lead can only be enriched once at a time.
 */
const TRANSITIONS: Record<PhoneEnrichmentStatus | 'NONE', readonly PhoneEnrichmentStatus[]> = {
  NONE: ['PENDING'],
  PENDING: ['FOUND', 'NOT_FOUND', 'FAILED'],
  FOUND: ['PENDING'],
  NOT_FOUND: ['PENDING'],
  FAILED: ['PENDING'],
}

const ALL_STATES: readonly PhoneEnrichmentState[] = [null, 'PENDING', 'FOUND', 'NOT_FOUND', 'FAILED']

export function canTransitionPhoneEnrichment(from: PhoneEnrichmentState, to: PhoneEnrichmentStatus): boolean {
  return TRANSITIONS[from ?? 'NONE'].includes(to)
}

/** States from which `to` can be reached; used for guarded (compare-and-set) updates. */
export function phoneEnrichmentSourceStates(to: PhoneEnrichmentStatus): PhoneEnrichmentState[] {
  return ALL_STATES.filter((from) => canTransitionPhoneEnrichment(from, to))
}
