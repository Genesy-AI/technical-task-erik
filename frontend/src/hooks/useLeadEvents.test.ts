import { describe, expect, it } from 'vitest'
import { Lead } from '../api/types/leads/getMany'
import { applyLeadUpdate, markQueuedLeadsPending } from './useLeadEvents'

const makeLead = (id: number, overrides: Partial<Lead> = {}): Lead => ({
  id,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  firstName: `Lead ${id}`,
  lastName: null,
  email: `lead${id}@example.com`,
  jobTitle: null,
  countryCode: null,
  companyName: null,
  message: null,
  emailVerificationStatus: null,
  phoneNumber: null,
  yearsAtCompany: null,
  linkedinUrl: null,
  companyWebsite: null,
  ...overrides,
})

describe('applyLeadUpdate', () => {
  it('replaces the matching lead and keeps the order', () => {
    const leads = [makeLead(1), makeLead(2), makeLead(3)]
    const updated = makeLead(2, { emailVerificationStatus: 'VERIFIED' })

    const result = applyLeadUpdate(leads, updated)

    expect(result?.map((lead) => lead.id)).toEqual([1, 2, 3])
    expect(result?.[1]).toBe(updated)
    expect(result?.[0]).toBe(leads[0])
  })

  it('returns undefined when the lead is not in the list', () => {
    expect(applyLeadUpdate([makeLead(1)], makeLead(99))).toBeUndefined()
  })

  it('returns undefined when the list is not loaded', () => {
    expect(applyLeadUpdate(undefined, makeLead(1))).toBeUndefined()
  })
})

describe('markQueuedLeadsPending', () => {
  const before = '2025-01-01T00:00:00.000Z'
  const after = '2025-01-01T00:00:05.000Z'

  it('marks queued leads that no event has updated yet', () => {
    const leads = [makeLead(1), makeLead(2)]

    const result = markQueuedLeadsPending(leads, [1], new Map([[1, before]]))

    expect(result?.[0].emailVerificationStatus).toBe('PENDING')
    expect(result?.[1]).toBe(leads[1])
  })

  it('keeps a result that arrived through an event before the response', () => {
    // The verification finished first: the event already set INVALID and bumped updatedAt.
    const finished = makeLead(1, { emailVerificationStatus: 'INVALID', updatedAt: after })

    const result = markQueuedLeadsPending([finished], [1], new Map([[1, before]]))

    expect(result?.[0]).toBe(finished)
  })

  it('keeps a re-verified lead whose new result matches its old one', () => {
    // VERIFIED -> PENDING -> VERIFIED: same status as before, but updatedAt moved on.
    const reverified = makeLead(1, { emailVerificationStatus: 'VERIFIED', updatedAt: after })

    const result = markQueuedLeadsPending([reverified], [1], new Map([[1, before]]))

    expect(result?.[0].emailVerificationStatus).toBe('VERIFIED')
  })

  it('returns undefined when the list is not loaded', () => {
    expect(markQueuedLeadsPending(undefined, [1], new Map())).toBeUndefined()
  })
})
