import { describe, expect, it } from 'vitest'
import { Lead } from '../api/types/leads/getMany'
import { applyLeadUpdate } from './useLeadEvents'

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
