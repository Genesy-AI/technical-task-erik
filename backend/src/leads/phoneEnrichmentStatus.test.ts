import { describe, it, expect } from 'vitest'
import { canTransitionPhoneEnrichment, phoneEnrichmentSourceStates } from './phoneEnrichmentStatus'

describe('phone enrichment state machine', () => {
  it('starts from never-enriched or a retryable outcome', () => {
    expect(canTransitionPhoneEnrichment(null, 'PENDING')).toBe(true)
    expect(canTransitionPhoneEnrichment('NOT_FOUND', 'PENDING')).toBe(true)
    expect(canTransitionPhoneEnrichment('FAILED', 'PENDING')).toBe(true)
  })

  it('allows re-enriching a FOUND lead (the store only does so once its phone was removed)', () => {
    expect(canTransitionPhoneEnrichment('FOUND', 'PENDING')).toBe(true)
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
    expect(phoneEnrichmentSourceStates('PENDING')).toEqual([null, 'FOUND', 'NOT_FOUND', 'FAILED'])
  })
})
