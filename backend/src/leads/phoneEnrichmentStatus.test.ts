import { describe, it, expect } from 'vitest'
import { canTransitionPhoneEnrichment, phoneEnrichmentSourceStates } from './phoneEnrichmentStatus'

describe('phone enrichment state machine', () => {
  it('starts from never-enriched or a retryable outcome', () => {
    expect(canTransitionPhoneEnrichment(null, 'PENDING')).toBe(true)
    expect(canTransitionPhoneEnrichment('NOT_FOUND', 'PENDING')).toBe(true)
    expect(canTransitionPhoneEnrichment('FAILED', 'PENDING')).toBe(true)
  })

  it('never re-enriches a lead whose phone was found', () => {
    expect(canTransitionPhoneEnrichment('FOUND', 'PENDING')).toBe(false)
  })

  it('does not queue a lead that is already being enriched', () => {
    expect(canTransitionPhoneEnrichment('PENDING', 'PENDING')).toBe(false)
  })

  it('only settles from PENDING', () => {
    for (const outcome of ['FOUND', 'NOT_FOUND', 'FAILED'] as const) {
      expect(phoneEnrichmentSourceStates(outcome)).toEqual(['PENDING'])
    }
  })

  it('lists source states for PENDING', () => {
    expect(phoneEnrichmentSourceStates('PENDING')).toEqual([null, 'NOT_FOUND', 'FAILED'])
  })
})
